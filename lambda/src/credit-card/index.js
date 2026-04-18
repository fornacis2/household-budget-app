const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.CREDIT_CARDS_TABLE || 'household-credit-cards';

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  try {
    const { httpMethod, pathParameters } = event;
    const cardId = pathParameters?.cardId;

    switch (httpMethod) {
      case 'GET':
        return await getCreditCards(headers);
      case 'POST':
        return await createCreditCard(event, headers);
      case 'PUT':
        return await updateCreditCard(event, cardId, headers);
      case 'DELETE':
        return await deleteCreditCard(cardId, headers);
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

async function getCreditCards(headers) {
  const userId = 'default-user';
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId }
  };

  const result = await dynamodb.query(params).promise();
  const creditCards = (result.Items || []).sort((a, b) => {
    const aOrder = a.sortOrder !== undefined ? a.sortOrder : Number.MAX_SAFE_INTEGER
    const bOrder = b.sortOrder !== undefined ? b.sortOrder : Number.MAX_SAFE_INTEGER
    if (aOrder !== bOrder) return aOrder - bOrder
    return (a.createdAt || '').localeCompare(b.createdAt || '')
  })

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ creditCards })
  };
}

async function createCreditCard(event, headers) {
  const body = JSON.parse(event.body);
  const { cardName, withdrawalAccountId, closingDay, withdrawalMonth, withdrawalDay } = body;

  if (!cardName || !withdrawalAccountId || !closingDay || withdrawalMonth === undefined || !withdrawalDay) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing required fields' })
    };
  }

  const userId = 'default-user';

  // 既存カードの最大 sortOrder を取得して +1
  const existingResult = await dynamodb.query({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId }
  }).promise();
  const maxSortOrder = (existingResult.Items || []).reduce((max, item) => {
    return item.sortOrder !== undefined ? Math.max(max, item.sortOrder) : max
  }, 0);

  const cardId = uuidv4();
  const creditCard = {
    userId,
    cardId,
    cardName,
    withdrawalAccountId,
    closingDay: parseInt(closingDay),
    withdrawalMonth,
    withdrawalDay: parseInt(withdrawalDay),
    sortOrder: maxSortOrder + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const params = {
    TableName: TABLE_NAME,
    Item: creditCard
  };

  await dynamodb.put(params).promise();

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({
      message: 'Credit card created successfully',
      creditCard
    })
  };
}

async function updateCreditCard(event, cardId, headers) {
  if (!cardId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Card ID is required' })
    };
  }

  const body = JSON.parse(event.body);
  const { cardName, withdrawalAccountId, closingDay, withdrawalMonth, withdrawalDay } = body;

  const updateExpression = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  if (cardName) {
    updateExpression.push('#cardName = :cardName');
    expressionAttributeNames['#cardName'] = 'cardName';
    expressionAttributeValues[':cardName'] = cardName;
  }

  if (withdrawalAccountId) {
    updateExpression.push('withdrawalAccountId = :withdrawalAccountId');
    expressionAttributeValues[':withdrawalAccountId'] = withdrawalAccountId;
  }

  if (closingDay) {
    updateExpression.push('closingDay = :closingDay');
    expressionAttributeValues[':closingDay'] = parseInt(closingDay);
  }

  if (withdrawalMonth !== undefined) {
    updateExpression.push('withdrawalMonth = :withdrawalMonth');
    expressionAttributeValues[':withdrawalMonth'] = withdrawalMonth;
  }

  if (withdrawalDay) {
    updateExpression.push('withdrawalDay = :withdrawalDay');
    expressionAttributeValues[':withdrawalDay'] = parseInt(withdrawalDay);
  }

  if (body.sortOrder !== undefined) {
    updateExpression.push('sortOrder = :sortOrder');
    expressionAttributeValues[':sortOrder'] = body.sortOrder;
  }

  updateExpression.push('updatedAt = :updatedAt');
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();

  const userId = 'default-user';
  const params = {
    TableName: TABLE_NAME,
    Key: { userId, cardId },
    UpdateExpression: `SET ${updateExpression.join(', ')}`,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  };

  if (Object.keys(expressionAttributeNames).length > 0) {
    params.ExpressionAttributeNames = expressionAttributeNames;
  }

  const result = await dynamodb.update(params).promise();

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      message: 'Credit card updated successfully',
      creditCard: result.Attributes
    })
  };
}

async function deleteCreditCard(cardId, headers) {
  if (!cardId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Card ID is required' })
    };
  }

  const userId = 'default-user';
  const params = {
    TableName: TABLE_NAME,
    Key: { userId, cardId }
  };

  await dynamodb.delete(params).promise();

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      message: 'Credit card deleted successfully'
    })
  };
}