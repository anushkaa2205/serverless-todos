import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, json, userIdFrom, strip } from "../lib/common.js";

export const handler = async (event) => {
  try {
    const userId = userIdFrom(event);
    const { id } = event.pathParameters;
    const { title, completed } = JSON.parse(event.body ?? "{}");

    if (title === undefined && completed === undefined)
      return json(400, { message: "Provide title and/or completed" });

    const sets = [];
    const names = {};
    const values = {};

    if (title !== undefined) {
      sets.push("#t = :t"); names["#t"] = "title"; values[":t"] = title.trim();
    }
    if (completed !== undefined) {
      sets.push("#c = :c"); names["#c"] = "completed"; values[":c"] = Boolean(completed);
    }

    const { Attributes } = await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `USER#${userId}`, SK: `TODO#${id}` },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        // Without this, UpdateItem would CREATE a todo that never existed.
        ConditionExpression: "attribute_exists(PK)",
        ReturnValues: "ALL_NEW",
      })
    );

    return json(200, strip(Attributes));
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException")
      return json(404, { message: "Not found" });
    console.error(err);
    return json(500, { message: "Internal error" });
  }
};
