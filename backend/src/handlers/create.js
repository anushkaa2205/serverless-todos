import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { ddb, TABLE, json, userIdFrom, strip } from "../lib/common.js";

export const handler = async (event) => {
  try {
    const userId = userIdFrom(event);
    const { title } = JSON.parse(event.body ?? "{}");

    if (!title?.trim()) return json(400, { message: "title is required" });

    const todoId = randomUUID();
    const now = new Date().toISOString();

    const item = {
      PK: `USER#${userId}`,
      SK: `TODO#${todoId}`,
      todoId,
      title: title.trim(),
      completed: false,
      createdAt: now,
    };

    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    return json(201, strip(item));
  } catch (err) {
    console.error(err);
    return json(500, { message: "Internal error" });
  }
};
