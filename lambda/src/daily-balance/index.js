const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || 'household-budget';

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  try {
    const { httpMethod, pathParameters, queryStringParameters } = event;

    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.accountId) {
          return await getAccountDailyBalances(pathParameters.accountId, queryStringParameters, headers);
        } else {
          return await getAllDailyBalances(queryStringParameters, headers);
        }
      case 'POST':
        return await recalculateDailyBalances(event, headers);
      case 'OPTIONS':
        return { statusCode: 200, headers };
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};

async function getAccountDailyBalances(accountId, queryParams, headers) {
  const { startDate, endDate } = queryParams || {};
  
  let filterExpression = 'accountId = :accountId';
  const expressionAttributeValues = {
    ':accountId': accountId
  };

  if (startDate && endDate) {
    filterExpression += ' AND #date BETWEEN :startDate AND :endDate';
    expressionAttributeValues[':startDate'] = startDate;
    expressionAttributeValues[':endDate'] = endDate;
  }

  const params = {
    TableName: TABLE_NAME,
    FilterExpression: filterExpression,
    ExpressionAttributeNames: {
      '#date': 'date'
    },
    ExpressionAttributeValues: expressionAttributeValues
  };

  const result = await dynamodb.scan(params).promise();
  
  // 日付順でソート
  const balances = (result.Items || [])
    .filter(item => item.type === 'daily-balance')
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      accountId,
      balances
    })
  };
}

async function getAllDailyBalances(queryParams, headers) {
  const { date } = queryParams || {};
  const targetDate = date || new Date().toISOString().split('T')[0];

  const params = {
    TableName: TABLE_NAME,
    FilterExpression: '#type = :type AND #date = :date',
    ExpressionAttributeNames: {
      '#type': 'type',
      '#date': 'date'
    },
    ExpressionAttributeValues: {
      ':type': 'daily-balance',
      ':date': targetDate
    }
  };

  const result = await dynamodb.scan(params).promise();

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      date: targetDate,
      balances: result.Items || []
    })
  };
}

async function recalculateDailyBalances(event, headers) {
  const body = JSON.parse(event.body || '{}');
  const { startDate, endDate, accountId } = body;

  console.log(`Recalculating daily balances from ${startDate} to ${endDate} for account: ${accountId || 'all'}`);

  try {
    // 全口座情報を取得
    const accounts = await getAllAccounts();
    
    // 対象口座をフィルタリング
    const targetAccounts = accountId ? 
      accounts.filter(acc => acc.accountId === accountId) : 
      accounts;

    const results = [];

    for (const account of targetAccounts) {
      console.log(`Processing account: ${account.accountId}`);
      const accountResult = await recalculateAccountBalances(account, startDate, endDate);
      results.push(accountResult);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Daily balances recalculated successfully',
        results,
        processedAccounts: results.length
      })
    };

  } catch (error) {
    console.error('Recalculation failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Recalculation failed', 
        details: error.message 
      })
    };
  }
}

async function getAllAccounts() {
  const accounts = [];
  
  // 現金口座
  accounts.push({
    accountId: 'cash',
    accountType: 'cash',
    accountName: '現金',
    initialBalance: await getInitialCashBalance()
  });

  // 銀行口座
  const bankAccounts = await getBankAccounts();
  for (const bank of bankAccounts) {
    accounts.push({
      accountId: `bank-${bank.accountId}`,
      accountType: 'bank',
      accountName: bank.bankName,
      originalId: bank.accountId,
      initialBalance: 0 // 銀行口座は現在残高から逆算
    });
  }

  // クレジットカード
  const creditCards = await getCreditCards();
  for (const card of creditCards) {
    accounts.push({
      accountId: `credit-${card.cardId}`,
      accountType: 'credit',
      accountName: card.cardName,
      originalId: card.cardId,
      initialBalance: 0 // クレカは利用残高
    });
  }

  return accounts;
}

async function getInitialCashBalance() {
  try {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: '#type = :type',
      ExpressionAttributeNames: {
        '#type': 'type'
      },
      ExpressionAttributeValues: {
        ':type': 'user'
      }
    };

    const result = await dynamodb.scan(params).promise();
    return result.Items?.[0]?.initialBalance || 0;
  } catch (error) {
    console.log('Initial cash balance not found, using 0');
    return 0;
  }
}

async function getBankAccounts() {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: '#type = :type',
    ExpressionAttributeNames: {
      '#type': 'type'
    },
    ExpressionAttributeValues: {
      ':type': 'bank-account'
    }
  };

  const result = await dynamodb.scan(params).promise();
  return result.Items || [];
}

async function getCreditCards() {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: '#type = :type',
    ExpressionAttributeNames: {
      '#type': 'type'
    },
    ExpressionAttributeValues: {
      ':type': 'credit-card'
    }
  };

  const result = await dynamodb.scan(params).promise();
  return result.Items || [];
}

async function recalculateAccountBalances(account, startDate, endDate) {
  // 対象期間の取引を取得
  const transactions = await getAccountTransactions(account, startDate, endDate);
  
  // 日付ごとにグループ化
  const transactionsByDate = {};
  transactions.forEach(tx => {
    const date = tx.date;
    if (!transactionsByDate[date]) {
      transactionsByDate[date] = [];
    }
    transactionsByDate[date].push(tx);
  });

  // 開始残高を取得
  let currentBalance = await getStartingBalance(account, startDate);
  
  const results = [];
  const dates = Object.keys(transactionsByDate).sort();

  for (const date of dates) {
    const dayTransactions = transactionsByDate[date];
    
    // その日の取引を適用
    for (const tx of dayTransactions) {
      if (account.accountType === 'cash' || account.accountType === 'bank') {
        currentBalance += tx.type === 'income' ? tx.amount : -tx.amount;
      } else if (account.accountType === 'credit') {
        // クレジットカードは支出のみ（利用残高として蓄積）
        if (tx.type === 'expense') {
          currentBalance += tx.amount;
        }
      }
    }

    // 日次残高を保存
    await saveDailyBalance(account.accountId, date, currentBalance, dayTransactions.length);
    
    results.push({
      date,
      balance: currentBalance,
      transactionCount: dayTransactions.length
    });
  }

  return {
    accountId: account.accountId,
    accountName: account.accountName,
    processedDays: results.length,
    finalBalance: currentBalance
  };
}

async function getAccountTransactions(account, startDate, endDate) {
  let filterExpression = '#type = :type AND #date BETWEEN :startDate AND :endDate';
  const expressionAttributeValues = {
    ':type': 'transaction',
    ':startDate': startDate,
    ':endDate': endDate
  };

  // 口座タイプに応じてフィルタリング
  if (account.accountType === 'cash') {
    filterExpression += ' AND accountType = :accountType';
    expressionAttributeValues[':accountType'] = 'cash';
  } else if (account.accountType === 'bank') {
    filterExpression += ' AND accountId = :accountId';
    expressionAttributeValues[':accountId'] = account.originalId;
  } else if (account.accountType === 'credit') {
    filterExpression += ' AND accountId = :accountId';
    expressionAttributeValues[':accountId'] = account.originalId;
  }

  const params = {
    TableName: TABLE_NAME,
    FilterExpression: filterExpression,
    ExpressionAttributeNames: {
      '#type': 'type',
      '#date': 'date'
    },
    ExpressionAttributeValues: expressionAttributeValues
  };

  const result = await dynamodb.scan(params).promise();
  return result.Items || [];
}

async function getStartingBalance(account, startDate) {
  // 前日の残高を取得
  const previousDate = new Date(startDate);
  previousDate.setDate(previousDate.getDate() - 1);
  const prevDateStr = previousDate.toISOString().split('T')[0];

  try {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        accountId: account.accountId,
        date: prevDateStr,
        type: 'daily-balance'
      }
    };

    const result = await dynamodb.get(params).promise();
    if (result.Item) {
      return result.Item.balance;
    }
  } catch (error) {
    console.log(`Previous balance not found for ${account.accountId}, using initial balance`);
  }

  return account.initialBalance;
}

async function saveDailyBalance(accountId, date, balance, transactionCount) {
  const params = {
    TableName: TABLE_NAME,
    Item: {
      accountId,
      date,
      type: 'daily-balance',
      balance,
      transactionCount,
      updatedAt: new Date().toISOString()
    }
  };

  await dynamodb.put(params).promise();
}