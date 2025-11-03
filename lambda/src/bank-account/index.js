const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid')
const dynamodb = new AWS.DynamoDB.DocumentClient()

const BANK_ACCOUNTS_TABLE = process.env.BANK_ACCOUNTS_TABLE
const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  }

  try {
    const { httpMethod, pathParameters, path } = event
    const userId = 'default-user'

    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Max-Age': '86400'
        },
        body: ''
      }
    }

    if (httpMethod === 'GET') {
      // 銀行口座一覧取得
      const result = await dynamodb.query({
        TableName: BANK_ACCOUNTS_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      }).promise()

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          bankAccounts: result.Items || []
        })
      }
    }

    if (httpMethod === 'POST') {
      // 預金・引出処理 or 口座作成
      if (path.includes('/transfer')) {
        return await handleTransfer(event, userId, headers)
      } else {
        return await createBankAccount(event, userId, headers)
      }
    }

    if (httpMethod === 'PUT') {
      // 銀行口座更新
      const { accountId } = pathParameters
      const { bankName, balance } = JSON.parse(event.body)

      await dynamodb.update({
        TableName: BANK_ACCOUNTS_TABLE,
        Key: { userId, accountId },
        UpdateExpression: 'SET bankName = :bankName, balance = :balance, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':bankName': bankName,
          ':balance': balance,
          ':updatedAt': new Date().toISOString()
        }
      }).promise()

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: '銀行口座を更新しました'
        })
      }
    }

    if (httpMethod === 'DELETE') {
      // 銀行口座削除
      const { accountId } = pathParameters

      await dynamodb.delete({
        TableName: BANK_ACCOUNTS_TABLE,
        Key: { userId, accountId }
      }).promise()

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: '銀行口座を削除しました'
        })
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

// 銀行口座作成
async function createBankAccount(event, userId, headers) {
  const { bankName, initialBalance } = JSON.parse(event.body)
  const accountId = uuidv4()

  const bankAccount = {
    userId,
    accountId,
    bankName,
    balance: initialBalance || 0,
    createdAt: new Date().toISOString()
  }

  await dynamodb.put({
    TableName: BANK_ACCOUNTS_TABLE,
    Item: bankAccount
  }).promise()

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({
      message: '銀行口座を作成しました',
      bankAccount
    })
  }
}

// 預金・引出処理
async function handleTransfer(event, userId, headers) {
  const { accountId } = event.pathParameters
  const { type, amount, memo, date } = JSON.parse(event.body)

  // 口座情報取得
  const accountResult = await dynamodb.get({
    TableName: BANK_ACCOUNTS_TABLE,
    Key: { userId, accountId }
  }).promise()

  if (!accountResult.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: '口座が見つかりません' })
    }
  }

  const account = accountResult.Item
  const newBalance = type === 'deposit' 
    ? account.balance + amount 
    : account.balance - amount

  if (newBalance < 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '残高不足です' })
    }
  }

  // 口座残高更新
  await dynamodb.update({
    TableName: BANK_ACCOUNTS_TABLE,
    Key: { userId, accountId },
    UpdateExpression: 'SET balance = :balance, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':balance': newBalance,
      ':updatedAt': new Date().toISOString()
    }
  }).promise()

  // 取引履歴に記録
  const transactionId = uuidv4()
  const transaction = {
    userId,
    transactionId,
    type: type === 'deposit' ? 'income' : 'expense',
    amount: amount,
    category: type === 'deposit' ? '預金' : '引出',
    subcategory: account.bankName,
    memo: memo || '',
    accountType: 'bank',
    accountId: accountId,
    date: date || new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  }

  await dynamodb.put({
    TableName: TRANSACTIONS_TABLE,
    Item: transaction
  }).promise()

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      message: `${type === 'deposit' ? '預金' : '引出'}処理が完了しました`,
      newBalance,
      transaction
    })
  }
}