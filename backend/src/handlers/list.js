import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, json, userIdFrom, strip } from "../lib/common.js";

export const handler = async (event) => {
  try {
    const userId = userIdFrom(event);

    // Query, not Scan. Scan reads the whole table and costs real money at scale.
    const { Items = [] } = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": `USER#${userId}`, ":sk": "TODO#" },
        ScanIndexForward: false,
      })
    );

    return json(200, Items.map(strip));
  } catch (err) {
    console.error(err);
    return json(500, { message: "Internal error" });
  }
};
