const AWS = require('aws-sdk')
const dynamodb = new AWS.DynamoDB.DocumentClient()

const USERS_TABLE = process.env.USERS_TABLE
const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE
const BANK_ACCOUNTS_TABLE = process.env.BANK_ACCOUNTS_TABLE
const CREDIT_CARDS_TABLE = process.env.CREDIT_CARDS_TABLE
const DAILY_BALANCE_TABLE = process.env.DAILY_BALANCE_TABLE

// ────────────────────────────────────────────
// ユーティリティ
// ────────────────────────────────────────────

function getAccountId(transaction) {
  if (!transaction.accountType || transaction.accountType === 'cash') return 'cash'
  if (transaction.accountType === 'bank') return `bank-${transaction.accountId}`
  if (transaction.accountType === 'credit') return `credit-${transaction.accountId}`
  return 'cash'
}

function getPreviousDate(dateString) {
  const date = new Date(dateString)
  date.setDate(date.getDate() - 1)
  return date.toISOString().split('T')[0]
}

function getUpdateDate(transaction) {
  if (transaction.accountType === 'cash') return transaction.date
  return transaction.withdrawalDate || transaction.date
}

// ────────────────────────────────────────────
// 日付取得
// ────────────────────────────────────────────

// 取引テーブルから最新取引日を取得（なければ本日）
async function getLatestTransactionDate() {
  try {
    const result = await dynamodb.scan({
      TableName: TRANSACTIONS_TABLE,
      ProjectionExpression: '#date',
      ExpressionAttributeNames: { '#date': 'date' }
    }).promise()

    const dates = (result.Items || []).map(i => i.date).filter(Boolean)
    if (dates.length === 0) return new Date().toISOString().split('T')[0]
    return dates.sort().reverse()[0]
  } catch (error) {
    console.error('Error getting latest transaction date:', error)
    return new Date().toISOString().split('T')[0]
  }
}

// 口座の最古取引日を取得（なければ本日）
async function getOldestTransactionDate(accountId) {
  try {
    let filterExpression
    const expressionAttributeValues = { ':userId': 'default-user' }
    const expressionAttributeNames = { '#date': 'date' }

    if (accountId === 'cash') {
      filterExpression = '(attribute_not_exists(accountType) OR accountType = :accountType)'
      expressionAttributeValues[':accountType'] = 'cash'
    } else if (accountId.startsWith('bank-')) {
      const originalId = accountId.replace('bank-', '')
      filterExpression = 'accountId = :accountId AND accountType = :accountType'
      expressionAttributeValues[':accountId'] = originalId
      expressionAttributeValues[':accountType'] = 'bank'
    }

    const params = {
      TableName: TRANSACTIONS_TABLE,
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: filterExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ProjectionExpression: '#date'
    }

    const result = await dynamodb.query(params).promise()
    const dates = (result.Items || []).map(i => i.date).filter(Boolean)
    if (dates.length === 0) return new Date().toISOString().split('T')[0]
    return dates.sort()[0]
  } catch (error) {
    console.error('Error getting oldest transaction date:', error)
    return new Date().toISOString().split('T')[0]
  }
}

// ────────────────────────────────────────────
// 残高取得・保存
// ────────────────────────────────────────────

async function getPreviousDayBalance(accountId, date) {
  try {
    const result = await dynamodb.query({
      TableName: DAILY_BALANCE_TABLE,
      KeyConditionExpression: 'accountId = :accountId AND #date <= :date',
      ExpressionAttributeNames: { '#date': 'date' },
      ExpressionAttributeValues: { ':accountId': accountId, ':date': date },
      ScanIndexForward: false,
      Limit: 1
    }).promise()

    if (result.Items && result.Items.length > 0) return result.Items[0].balance

    if (accountId === 'cash') {
      const userResult = await dynamodb.get({
        TableName: USERS_TABLE,
        Key: { userId: 'default-user' }
      }).promise()
      return userResult.Item?.initialBalance || 0
    } else if (accountId.startsWith('bank-')) {
      const originalId = accountId.replace('bank-', '')
      const bankResult = await dynamodb.get({
        TableName: BANK_ACCOUNTS_TABLE,
        Key: { userId: 'default-user', accountId: originalId }
      }).promise()
      return bankResult.Item?.balance || 0
    }
    return 0
  } catch (error) {
    console.error('Error getting previous balance:', error)
    return 0
  }
}

async function getBalanceForDate(accountId, date) {
  const result = await dynamodb.get({
    TableName: DAILY_BALANCE_TABLE,
    Key: { accountId, date }
  }).promise()

  if (result.Item) return result.Item.balance

  const queryResult = await dynamodb.query({
    TableName: DAILY_BALANCE_TABLE,
    KeyConditionExpression: 'accountId = :accountId AND #date < :date',
    ExpressionAttributeNames: { '#date': 'date' },
    ExpressionAttributeValues: { ':accountId': accountId, ':date': date },
    ScanIndexForward: false,
    Limit: 1
  }).promise()

  if (queryResult.Items && queryResult.Items.length > 0) return queryResult.Items[0].balance

  if (accountId === 'cash') {
    const userResult = await dynamodb.get({
      TableName: USERS_TABLE,
      Key: { userId: 'default-user' }
    }).promise()
    return userResult.Item?.initialBalance || 0
  } else if (accountId.startsWith('bank-')) {
    const originalId = accountId.replace('bank-', '')
    const bankResult = await dynamodb.get({
      TableName: BANK_ACCOUNTS_TABLE,
      Key: { userId: 'default-user', accountId: originalId }
    }).promise()
    return bankResult.Item?.balance || 0
  }
  return 0
}

async function saveDailyBalance(accountId, date, balance, transactionCount) {
  await dynamodb.put({
    TableName: DAILY_BALANCE_TABLE,
    Item: { accountId, date, balance, transactionCount, updatedAt: new Date().toISOString() }
  }).promise()
}

async function getTransactionsForDate(accountId, date) {
  const params = {
    TableName: TRANSACTIONS_TABLE,
    KeyConditionExpression: 'userId = :userId',
    FilterExpression: '#date = :date',
    ExpressionAttributeNames: { '#date': 'date' },
    ExpressionAttributeValues: { ':userId': 'default-user', ':date': date }
  }

  if (accountId === 'cash') {
    params.FilterExpression += ' AND (attribute_not_exists(accountType) OR accountType = :accountType)'
    params.ExpressionAttributeValues[':accountType'] = 'cash'
  } else if (accountId.startsWith('bank-')) {
    const originalId = accountId.replace('bank-', '')
    params.FilterExpression += ' AND accountId = :accountId'
    params.ExpressionAttributeValues[':accountId'] = originalId
  } else if (accountId.startsWith('credit-')) {
    const originalId = accountId.replace('credit-', '')
    params.FilterExpression += ' AND accountId = :accountId'
    params.ExpressionAttributeValues[':accountId'] = originalId
  }

  const result = await dynamodb.query(params).promise()
  return result.Items || []
}

// ────────────────────────────────────────────
// 残高更新
// ────────────────────────────────────────────

async function updateFutureDailyBalances(accountId, fromDate, delta) {
  const result = await dynamodb.query({
    TableName: DAILY_BALANCE_TABLE,
    KeyConditionExpression: 'accountId = :accountId AND #date > :fromDate',
    ExpressionAttributeNames: { '#date': 'date' },
    ExpressionAttributeValues: { ':accountId': accountId, ':fromDate': fromDate }
  }).promise()

  for (const item of result.Items || []) {
    await dynamodb.update({
      TableName: DAILY_BALANCE_TABLE,
      Key: { accountId: item.accountId, date: item.date },
      UpdateExpression: 'SET balance = balance + :delta, updatedAt = :updatedAt',
      ExpressionAttributeValues: { ':delta': delta, ':updatedAt': new Date().toISOString() }
    }).promise()
  }
}

async function updateSpecificDailyBalance(accountId, date, amountChange) {
  const existingBalance = await getBalanceForDate(accountId, date)
  const newBalance = existingBalance + amountChange

  await dynamodb.put({
    TableName: DAILY_BALANCE_TABLE,
    Item: { accountId, date, balance: newBalance, transactionCount: 1, updatedAt: new Date().toISOString() }
  }).promise()

  await updateFutureDailyBalances(accountId, date, amountChange)
}

async function getCreditCardInfo(cardId) {
  const result = await dynamodb.get({
    TableName: CREDIT_CARDS_TABLE,
    Key: { userId: 'default-user', cardId }
  }).promise()
  return result.Item
}

// 取引操作時のリアルタイム日次残高更新
async function updateDailyBalancesWithWithdrawal(transaction, operation) {
  const accountId = getAccountId(transaction)
  const updateDate = getUpdateDate(transaction)
  const amount = transaction.amount
  const isIncome = transaction.type === 'income'

  // クレジットカードの場合は引落口座を更新
  if (transaction.accountType === 'credit' && transaction.type === 'expense') {
    const creditCard = await getCreditCardInfo(transaction.accountId)
    if (creditCard) {
      const bankAccountId = `bank-${creditCard.withdrawalAccountId}`
      const delta = operation === 'add' ? -amount : amount
      await updateSpecificDailyBalance(bankAccountId, updateDate, delta)
    }
    return
  }

  // 現金・銀行口座の場合
  const previousDate = getPreviousDate(updateDate)
  const previousBalance = await getPreviousDayBalance(accountId, previousDate)

  const transactions = await getTransactionsForDate(accountId, updateDate)
  let currentBalance = previousBalance
  for (const tx of transactions) {
    currentBalance += tx.type === 'income' ? tx.amount : -tx.amount
  }

  await saveDailyBalance(accountId, updateDate, currentBalance, transactions.length)

  const delta = operation === 'add'
    ? (isIncome ? amount : -amount)
    : (isIncome ? -amount : amount)

  await updateFutureDailyBalances(accountId, updateDate, delta)
}

// ────────────────────────────────────────────
// 一括再計算
// ────────────────────────────────────────────

// 開始日以降の全期間を再計算（終了日は最新取引日を自動取得）
async function recalculateFromDate(account, startDate) {
  const endDate = await getLatestTransactionDate()

  // 取引データ取得
  const transactions = await getAccountTransactionsForRecalc(account, startDate, endDate)

  // 既存残高レコード取得
  const existingBalances = await getExistingBalances(account.accountId, startDate, endDate)
  const existingDates = existingBalances.map(b => b.date)

  const transactionsByDate = {}
  transactions.forEach(tx => {
    const date = (tx.accountType === 'credit' && tx.withdrawalDate) ? tx.withdrawalDate : tx.date
    if (!transactionsByDate[date]) transactionsByDate[date] = []
    transactionsByDate[date].push(tx)
  })

  let currentBalance = await getStartingBalance(account, startDate)

  const allDates = [...new Set([...Object.keys(transactionsByDate), ...existingDates])].sort()

  for (const date of allDates) {
    const dayTransactions = transactionsByDate[date] || []
    for (const tx of dayTransactions) {
      if (account.accountType === 'cash') {
        currentBalance += tx.type === 'income' ? tx.amount : -tx.amount
      } else if (account.accountType === 'bank') {
        if (tx.accountType === 'credit') {
          currentBalance -= tx.amount
        } else {
          currentBalance += tx.type === 'income' ? tx.amount : -tx.amount
        }
      }
    }
    await saveDailyBalance(account.accountId, date, currentBalance, dayTransactions.length)
  }
}

async function getAccountTransactionsForRecalc(account, startDate, endDate) {
  let transactions = []

  let filterExpression = '#date BETWEEN :startDate AND :endDate'
  const expressionAttributeValues = {
    ':userId': 'default-user',
    ':startDate': startDate,
    ':endDate': endDate
  }

  if (account.accountType === 'cash') {
    filterExpression += ' AND (attribute_not_exists(accountType) OR accountType = :accountType)'
    expressionAttributeValues[':accountType'] = 'cash'
  } else if (account.accountType === 'bank') {
    filterExpression += ' AND accountId = :accountId AND accountType = :accountType'
    expressionAttributeValues[':accountId'] = account.originalId
    expressionAttributeValues[':accountType'] = 'bank'
  }

  const result = await dynamodb.query({
    TableName: TRANSACTIONS_TABLE,
    KeyConditionExpression: 'userId = :userId',
    FilterExpression: filterExpression,
    ExpressionAttributeNames: { '#date': 'date' },
    ExpressionAttributeValues: expressionAttributeValues
  }).promise()
  transactions = result.Items || []

  // 銀行口座の場合はクレジットカード引落取引も取得
  if (account.accountType === 'bank') {
    const creditCards = await dynamodb.query({
      TableName: CREDIT_CARDS_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': 'default-user' }
    }).promise()

    const targetCards = (creditCards.Items || []).filter(c => c.withdrawalAccountId === account.originalId)
    for (const card of targetCards) {
      const creditResult = await dynamodb.query({
        TableName: TRANSACTIONS_TABLE,
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: '#date BETWEEN :startDate AND :endDate AND accountId = :cardId AND accountType = :accountType',
        ExpressionAttributeNames: { '#date': 'date' },
        ExpressionAttributeValues: {
          ':userId': 'default-user',
          ':startDate': startDate,
          ':endDate': endDate,
          ':cardId': card.cardId,
          ':accountType': 'credit'
        }
      }).promise()
      transactions = transactions.concat(creditResult.Items || [])
    }
  }

  return transactions
}

async function getStartingBalance(account, startDate) {
  const previousDate = new Date(startDate)
  previousDate.setDate(previousDate.getDate() - 1)
  const prevDateStr = previousDate.toISOString().split('T')[0]

  try {
    const result = await dynamodb.query({
      TableName: DAILY_BALANCE_TABLE,
      KeyConditionExpression: 'accountId = :accountId AND #date <= :date',
      ExpressionAttributeNames: { '#date': 'date' },
      ExpressionAttributeValues: { ':accountId': account.accountId, ':date': prevDateStr },
      ScanIndexForward: false,
      Limit: 1
    }).promise()

    if (result.Items && result.Items.length > 0) return result.Items[0].balance
  } catch (error) {
    console.log(`Previous balance not found for ${account.accountId}, using initial balance`)
  }
  return account.initialBalance || 0
}

async function getExistingBalances(accountId, startDate, endDate) {
  try {
    const result = await dynamodb.query({
      TableName: DAILY_BALANCE_TABLE,
      KeyConditionExpression: 'accountId = :accountId AND #date BETWEEN :startDate AND :endDate',
      ExpressionAttributeNames: { '#date': 'date' },
      ExpressionAttributeValues: { ':accountId': accountId, ':startDate': startDate, ':endDate': endDate }
    }).promise()
    return result.Items || []
  } catch (error) {
    console.error('Error getting existing balances:', error)
    return []
  }
}

module.exports = {
  getAccountId,
  getPreviousDate,
  getUpdateDate,
  getLatestTransactionDate,
  getOldestTransactionDate,
  getPreviousDayBalance,
  getBalanceForDate,
  saveDailyBalance,
  getTransactionsForDate,
  updateFutureDailyBalances,
  updateSpecificDailyBalance,
  getCreditCardInfo,
  updateDailyBalancesWithWithdrawal,
  recalculateFromDate
}
