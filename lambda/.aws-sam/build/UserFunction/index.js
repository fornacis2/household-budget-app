const AWS = require('aws-sdk')
const dynamodb = new AWS.DynamoDB.DocumentClient()

const USERS_TABLE = process.env.USERS_TABLE

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  }

  try {
    const { httpMethod, pathParameters } = event
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
      const result = await dynamodb.get({
        TableName: USERS_TABLE,
        Key: { userId }
      }).promise()

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          initialBalance: result.Item?.initialBalance || 0
        })
      }
    }

    if (httpMethod === 'POST') {
      // 初期残高保存
      const { initialBalance } = JSON.parse(event.body)

      await dynamodb.put({
        TableName: USERS_TABLE,
        Item: {
          userId,
          initialBalance,
          updatedAt: new Date().toISOString()
        }
      }).promise()

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: '初期残高を保存しました',
          initialBalance
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