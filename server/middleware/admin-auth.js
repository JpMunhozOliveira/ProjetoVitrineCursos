const { timingSafeEqual } = require("node:crypto");

function adminAuth(req, res, next) {
  const expectedKey = process.env.ADMIN_API_KEY;
  const providedKey = req.get("x-admin-api-key");

  if (!expectedKey) {
    return res.status(503).json({
      error: "Admin API is not configured.",
    });
  }

  if (typeof providedKey !== "string") {
    return res.status(401).json({ error: "Invalid or missing admin key." });
  }

  const expected = Buffer.from(expectedKey);
  const provided = Buffer.from(providedKey);

  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    return res.status(401).json({ error: "Invalid or missing admin key." });
  }

  return next();
}

module.exports = adminAuth;
