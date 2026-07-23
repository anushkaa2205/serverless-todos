import jwt from "jsonwebtoken";

const DENY = { isAuthorized: false, context: { userId: "" } };

export const handler = async (event) => {
  try {
    const header = event.headers?.authorization ?? event.headers?.Authorization;
    if (!header?.startsWith("Bearer ")) return DENY;

    const payload = jwt.verify(header.slice(7).trim(), process.env.JWT_SECRET);

    // This context is forwarded to the business Lambda — that's how the
    // handler learns who is calling without re-parsing the JWT.
    return { isAuthorized: true, context: { userId: payload.userId } };
  } catch (err) {
    // Expired, tampered, wrong secret — all land here. Always deny, never say why.
    console.error("Auth failed:", err.message);
    return DENY;
  }
};
