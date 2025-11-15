const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

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
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      creditCards: result.Items || []
    })
  };
}

async function createCreditCard(event, headers) {
  const body = JSON.parse(event.body);
  const { cardName, withdrawalAccountId, closingDay, withdrawalMonth, withdrawalDay } = body;

  if (!cardName || !withdrawalAccountId || !closingDay || !withdrawalMonth || !withdrawalDay) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing required fields' })
    };
  }

  const cardId = uuidv4();
  const creditCard = {
    cardId,
    type: 'credit-card',
    cardName,
    withdrawalAccountId,
    closingDay: parseInt(closingDay),
    withdrawalMonth,
    withdrawalDay: parseInt(withdrawalDay),
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

  if (withdrawalMonth) {
    updateExpression.push('withdrawalMonth = :withdrawalMonth');
    expressionAttributeValues[':withdrawalMonth'] = withdrawalMonth;
  }

  if (withdrawalDay) {
    updateExpression.push('withdrawalDay = :withdrawalDay');
    expressionAttributeValues[':withdrawalDay'] = parseInt(withdrawalDay);
  }

  updateExpression.push('updatedAt = :updatedAt');
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();

  const params = {
    TableName: TABLE_NAME,
    Key: { cardId, type: 'credit-card' },
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

  const params = {
    TableName: TABLE_NAME,
    Key: { cardId, type: 'credit-card' }
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