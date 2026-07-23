import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Created OUTSIDE the handler on purpose: runs once per cold start,
// then reused across warm invocations.
export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE = process.env.TABLE_NAME;

export const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: body === null ? "" : JSON.stringify(body),
});

export const userIdFrom = (event) =>
  event.requestContext.authorizer.lambda.userId;

export const strip = ({ PK, SK, ...rest }) => rest;
