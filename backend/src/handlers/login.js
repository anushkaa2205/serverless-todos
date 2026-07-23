import jwt from "jsonwebtoken";
import { json } from "../lib/common.js";

export const handler = async (event) => {
  const { email, password } = JSON.parse(event.body ?? "{}");

  if (email !== process.env.DEMO_EMAIL || password !== process.env.DEMO_PASSWORD)
    return json(401, { message: "Invalid credentials" });

  const token = jwt.sign(
    { userId: "demo-user", email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return json(200, { token, user: { email } });
};
