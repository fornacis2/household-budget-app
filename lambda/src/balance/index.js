const AWS = require('aws-sdk')
const dynamodb = new AWS.DynamoDB.DocumentClient()

const USERS_TABLE = process.env.USERS_TABLE
const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  }

  try {
    const { httpMethod } = event
    const userId = 'default-user' // 簡単のため固定ユーザー

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
      // 初期残高取得
      const userResult = await dynamodb.get({
        TableName: USERS_TABLE,
        Key: { userId }
      }).promise()

      const initialBalance = userResult.Item?.initialBalance || 0

      // 取引一覧取得
      const transactionsResult = await dynamodb.query({
        TableName: TRANSACTIONS_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      }).promise()

      const transactions = transactionsResult.Items || []

      // 残高計算
      const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0)

      const expense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + (t.amount || 0), 0)

      const currentBalance = initialBalance + income - expense

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          initialBalance,
          income,
          expense,
          currentBalance,
          transactionCount: transactions.length
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