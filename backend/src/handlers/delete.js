import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, json, userIdFrom } from "../lib/common.js";

export const handler = async (event) => {
  try {
    const userId = userIdFrom(event);
    const { id } = event.pathParameters;

    await ddb.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `USER#${userId}`, SK: `TODO#${id}` },
        ConditionExpression: "attribute_exists(PK)",
      })
    );

    return json(204, null);
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException")
      return json(404, { message: "Not found" });
    console.error(err);
    return json(500, { message: "Internal error" });
  }
};
