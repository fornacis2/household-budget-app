const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid')
const dynamodb = new AWS.DynamoDB.DocumentClient()

const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE

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
      // 取引一覧取得
      const result = await dynamodb.query({
        TableName: TRANSACTIONS_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        ScanIndexForward: false // 新しい順
      }).promise()

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          transactions: result.Items || []
        })
      }
    }

    if (httpMethod === 'POST') {
      // 取引作成
      const transaction = JSON.parse(event.body)
      const transactionId = uuidv4()

      const item = {
        userId,
        transactionId,
        ...transaction,
        createdAt: new Date().toISOString()
      }

      await dynamodb.put({
        TableName: TRANSACTIONS_TABLE,
        Item: item
      }).promise()

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          message: '取引を作成しました',
          transaction: item
        })
      }
    }

    if (httpMethod === 'DELETE') {
      // 取引削除
      const { transactionId } = pathParameters

      await dynamodb.delete({
        TableName: TRANSACTIONS_TABLE,
        Key: {
          userId,
          transactionId
        }
      }).promise()

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: '取引を削除しました'
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