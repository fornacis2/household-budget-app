const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid')
const dynamodb = new AWS.DynamoDB.DocumentClient()

const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE

// 事前定義カテゴリ
const DEFAULT_CATEGORIES = [
  // 収入カテゴリ
  { type: 'income', name: '給与', subcategories: ['基本給', '残業代', '賞与'] },
  { type: 'income', name: '副業', subcategories: ['フリーランス', 'アルバイト'] },
  { type: 'income', name: 'その他収入', subcategories: ['投資', '臨時収入'] },
  
  // 支出カテゴリ
  { type: 'expense', name: '食費', subcategories: ['食材', '外食', '弁当'] },
  { type: 'expense', name: '住居費', subcategories: ['家賃', '光熱費', '通信費'] },
  { type: 'expense', name: '交通費', subcategories: ['電車', 'バス', 'ガソリン'] },
  { type: 'expense', name: '娯楽費', subcategories: ['映画', '書籍', 'ゲーム'] },
  { type: 'expense', name: '日用品', subcategories: ['洗剤', '衣類', '雑貨'] }
]

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Max-Age': '86400'
        },
        body: ''
      }
    }

    if (httpMethod === 'GET') {
      // カテゴリ一覧取得
      const result = await dynamodb.query({
        TableName: CATEGORIES_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      }).promise()

      let categories = result.Items || []

      // 初回アクセス時にデフォルトカテゴリを作成
      if (categories.length === 0) {
        categories = await createDefaultCategories(userId)
      }

      // ツリー構造に変換
      const categoryTree = buildCategoryTree(categories)

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          categories: categoryTree
        })
      }
    }

    if (httpMethod === 'POST') {
      // カテゴリ作成
      const { type, name, parentId, subcategories } = JSON.parse(event.body)
      const categoryId = uuidv4()

      const category = {
        userId,
        categoryId,
        type, // 'income' or 'expense'
        name,
        parentId: parentId || null,
        subcategories: subcategories || [],
        createdAt: new Date().toISOString()
      }

      await dynamodb.put({
        TableName: CATEGORIES_TABLE,
        Item: category
      }).promise()

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          message: 'カテゴリを作成しました',
          category
        })
      }
    }

    if (httpMethod === 'PUT') {
      // カテゴリ更新
      const { categoryId } = pathParameters
      const { name, subcategories } = JSON.parse(event.body)

      await dynamodb.update({
        TableName: CATEGORIES_TABLE,
        Key: { userId, categoryId },
        UpdateExpression: 'SET #name = :name, subcategories = :subcategories, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#name': 'name'
        },
        ExpressionAttributeValues: {
          ':name': name,
          ':subcategories': subcategories || [],
          ':updatedAt': new Date().toISOString()
        }
      }).promise()

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'カテゴリを更新しました'
        })
      }
    }

    if (httpMethod === 'DELETE') {
      // カテゴリ削除
      const { categoryId } = pathParameters

      await dynamodb.delete({
        TableName: CATEGORIES_TABLE,
        Key: { userId, categoryId }
      }).promise()

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'カテゴリを削除しました'
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

// デフォルトカテゴリを作成
async function createDefaultCategories(userId) {
  const categories = []
  
  for (const defaultCat of DEFAULT_CATEGORIES) {
    const categoryId = uuidv4()
    const category = {
      userId,
      categoryId,
      type: defaultCat.type,
      name: defaultCat.name,
      parentId: null,
      subcategories: defaultCat.subcategories,
      createdAt: new Date().toISOString()
    }

    await dynamodb.put({
      TableName: CATEGORIES_TABLE,
      Item: category
    }).promise()

    categories.push(category)
  }

  return categories
}

// ツリー構造に変換
function buildCategoryTree(categories) {
  const incomeCategories = categories.filter(cat => cat.type === 'income')
  const expenseCategories = categories.filter(cat => cat.type === 'expense')

  return {
    income: incomeCategories,
    expense: expenseCategories
  }
}