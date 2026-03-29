const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const USERS_TABLE = process.env.USERS_TABLE;
const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE;
const BANK_ACCOUNTS_TABLE = process.env.BANK_ACCOUNTS_TABLE;
const CREDIT_CARDS_TABLE = process.env.CREDIT_CARDS_TABLE;
const DAILY_BALANCE_TABLE = process.env.DAILY_BALANCE_TABLE;

const {
  getLatestTransactionDate,
  recalculateFromDate,
  saveDailyBalance,
  getExistingBalances
} = require('../shared/dailyBalanceHelper');

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
    TableName: DAILY_BALANCE_TABLE,
    FilterExpression: filterExpression,
    ExpressionAttributeNames: {
      '#date': 'date'
    },
    ExpressionAttributeValues: expressionAttributeValues
  };

  const result = await dynamodb.scan(params).promise();
  
  const balances = (result.Items || []).sort((a, b) => new Date(a.date) - new Date(b.date));

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
  const { date, startDate, endDate } = queryParams || {};
  
  let filterExpression;
  const expressionAttributeValues = {};
  const expressionAttributeNames = {
    '#date': 'date'
  };
  
  if (startDate && endDate) {
    // 範囲指定での読み込み
    filterExpression = '#date BETWEEN :startDate AND :endDate';
    expressionAttributeValues[':startDate'] = startDate;
    expressionAttributeValues[':endDate'] = endDate;
  } else {
    // 特定日の読み込み（既存の動作）
    const targetDate = date || new Date().toISOString().split('T')[0];
    filterExpression = '#date = :date';
    expressionAttributeValues[':date'] = targetDate;
  }

  const params = {
    TableName: DAILY_BALANCE_TABLE,
    FilterExpression: filterExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues
  };

  const result = await dynamodb.scan(params).promise();
  const balances = (result.Items || []).sort((a, b) => new Date(a.date) - new Date(b.date));

  if (startDate && endDate) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        startDate,
        endDate,
        balances
      })
    };
  } else {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        date: targetDate,
        balances
      })
    };
  }
}

async function recalculateDailyBalances(event, headers) {
  const body = JSON.parse(event.body || '{}');
  const { startDate, accountId } = body;

  // endDate未指定の場合は最新取引日を自動取得
  const endDate = body.endDate || await getLatestTransactionDate();

  console.log(`Recalculating daily balances from ${startDate} to ${endDate} for account: ${accountId || 'all'}`);

  try {
    const accounts = await getAllAccounts();
    
    const targetAccounts = accountId ? 
      accounts.filter(acc => acc.accountId === accountId) : 
      accounts;

    const results = [];

    for (const account of targetAccounts) {
      console.log(`Processing account: ${account.accountId}`);
      await recalculateFromDate(account, startDate);
      results.push({ accountId: account.accountId, accountName: account.accountName });
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
  
  accounts.push({
    accountId: 'cash',
    accountType: 'cash',
    accountName: '現金',
    initialBalance: await getInitialCashBalance()
  });

  const bankAccounts = await getBankAccounts();
  for (const bank of bankAccounts) {
    accounts.push({
      accountId: `bank-${bank.accountId}`,
      accountType: 'bank',
      accountName: bank.bankName,
      originalId: bank.accountId,
      initialBalance: bank.balance || 0  // 銀行口座の現在残高を初期残高として使用
    });
  }

  // クレジットカードは再計算対象から除外
  return accounts;
}

async function getInitialCashBalance() {
  try {
    const params = {
      TableName: USERS_TABLE,
      Key: {
        userId: 'default-user'
      }
    };

    const result = await dynamodb.get(params).promise();
    return result.Item?.initialBalance || 0;
  } catch (error) {
    console.log('Initial cash balance not found, using 0');
    return 0;
  }
}

async function getBankAccounts() {
  const params = {
    TableName: BANK_ACCOUNTS_TABLE,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': 'default-user'
    }
  };

  const result = await dynamodb.query(params).promise();
  return result.Items || [];
}

async function getCreditCards() {
  const params = {
    TableName: CREDIT_CARDS_TABLE,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': 'default-user'
    }
  };

  const result = await dynamodb.query(params).promise();
  return result.Items || [];
}

// ────────────────────────────────────────────
// 口座情報取得
// ────────────────────────────────────────────