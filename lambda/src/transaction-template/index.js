const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid')
const dynamodb = new AWS.DynamoDB.DocumentClient()

const TRANSACTION_TEMPLATES_TABLE = process.env.TRANSACTION_TEMPLATES_TABLE

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  }

  try {
    const { httpMethod, pathParameters } = event
    const userId = 'default-user'

    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Max-Age': '86400'
        },
        body: ''
      }
    }

    if (httpMethod === 'GET') {
      const result = await dynamodb.query({
        TableName: TRANSACTION_TEMPLATES_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId }
      }).promise()

      const templates = (result.Items || []).sort((a, b) =>
        a.templateName.localeCompare(b.templateName, 'ja')
      )

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ templates })
      }
    }

    if (httpMethod === 'POST') {
      const { templateName, type, amount, category, subcategory, memo, accountType, accountId } = JSON.parse(event.body)

      if (!templateName || !templateName.trim()) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'テンプレート名を入力してください' })
        }
      }

      // テンプレート名の重複チェック
      const existing = await dynamodb.query({
        TableName: TRANSACTION_TEMPLATES_TABLE,
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: 'templateName = :templateName',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':templateName': templateName.trim()
        }
      }).promise()

      if (existing.Items && existing.Items.length > 0) {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({ error: `取引テンプレート「${templateName}」は既に存在します` })
        }
      }

      const templateId = uuidv4()
      const template = {
        userId,
        templateId,
        templateName: templateName.trim(),
        type,
        amount,
        category,
        subcategory: subcategory || '',
        memo: memo || '',
        accountType: accountType || 'cash',
        accountId: accountId || null,
        createdAt: new Date().toISOString()
      }

      await dynamodb.put({
        TableName: TRANSACTION_TEMPLATES_TABLE,
        Item: template
      }).promise()

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ message: '取引テンプレートを保存しました', template })
      }
    }

    if (httpMethod === 'DELETE') {
      const { templateId } = pathParameters

      await dynamodb.delete({
        TableName: TRANSACTION_TEMPLATES_TABLE,
        Key: { userId, templateId }
      }).promise()

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: '取引テンプレートを削除しました' })
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
