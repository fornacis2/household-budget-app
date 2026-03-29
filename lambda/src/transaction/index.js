const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid')
const dynamodb = new AWS.DynamoDB.DocumentClient()

const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE
const {
  updateDailyBalancesWithWithdrawal
} = require('../shared/dailyBalanceHelper')

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  }

  try {
    console.log('Event:', JSON.stringify(event, null, 2))
    const { httpMethod, pathParameters } = event
    const userId = 'default-user' // 簡単のため固定ユーザー
    console.log('HTTP Method:', httpMethod)
    console.log('Path Parameters:', pathParameters)

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
      const { transactionId } = pathParameters || {}
      
      if (transactionId) {
        // 単一取引取得
        const result = await dynamodb.get({
          TableName: TRANSACTIONS_TABLE,
          Key: {
            userId,
            transactionId
          }
        }).promise()
        
        if (!result.Item) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: '取引が見つかりません' })
          }
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            transaction: result.Item
          })
        }
      } else {
        // 取引一覧取得
        const { startDate, endDate } = event.queryStringParameters || {}
        
        const params = {
          TableName: TRANSACTIONS_TABLE,
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId
          },
          ScanIndexForward: false
        }
        
        if (startDate && endDate) {
          params.FilterExpression = '#date BETWEEN :startDate AND :endDate'
          params.ExpressionAttributeNames = { '#date': 'date' }
          params.ExpressionAttributeValues[':startDate'] = startDate
          params.ExpressionAttributeValues[':endDate'] = endDate
        }
        
        const result = await dynamodb.query(params).promise()

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            transactions: result.Items || []
          })
        }
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
        accountType: transaction.accountType || 'cash',
        accountId: transaction.accountId || null,
        withdrawalDate: transaction.withdrawalDate || null,
        createdAt: new Date().toISOString()
      }

      await dynamodb.put({
        TableName: TRANSACTIONS_TABLE,
        Item: item
      }).promise()

      // 残高更新処理
      await updateDailyBalancesWithWithdrawal(item, 'add')

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          message: '取引を作成しました',
          transaction: item
        })
      }
    }

    if (httpMethod === 'PUT') {
      // 取引更新
      const { transactionId } = pathParameters
      const updatedTransaction = JSON.parse(event.body)
      
      // 既存の取引を取得
      const existingResult = await dynamodb.get({
        TableName: TRANSACTIONS_TABLE,
        Key: {
          userId,
          transactionId
        }
      }).promise()
      
      if (!existingResult.Item) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: '取引が見つかりません' })
        }
      }
      
      const oldTransaction = existingResult.Item
      
      // 新しい取引データ
      const newTransaction = {
        ...oldTransaction,
        ...updatedTransaction,
        updatedAt: new Date().toISOString()
      }
      
      // 取引を更新
      await dynamodb.put({
        TableName: TRANSACTIONS_TABLE,
        Item: newTransaction
      }).promise()
      
      // 日次残高を更新（古い取引を削除して新しい取引を追加）
      await updateDailyBalancesWithWithdrawal(oldTransaction, 'delete')
      await updateDailyBalancesWithWithdrawal(newTransaction, 'add')
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: '取引を更新しました',
          transaction: newTransaction
        })
      }
    }

    if (httpMethod === 'DELETE') {
      // 取引削除
      const { transactionId } = pathParameters

      // 削除前に取引情報を取得
      const result = await dynamodb.get({
        TableName: TRANSACTIONS_TABLE,
        Key: {
          userId,
          transactionId
        }
      }).promise()

      await dynamodb.delete({
        TableName: TRANSACTIONS_TABLE,
        Key: {
          userId,
          transactionId
        }
      }).promise()

      // 日次残高テーブルを更新
      if (result.Item) {
        await updateDailyBalancesWithWithdrawal(result.Item, 'delete')
      }

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

async function getPreviousDayBalance(accountId, date) {  // 互換性のため残す
  return 0 // 互換性のためのスタブ（実処理はsharedに移行済み）
}

// 既存の関数を残す（互換性のため）
async function updateDailyBalances(transaction, operation) {
  return updateDailyBalancesWithWithdrawal(transaction, operation)
}