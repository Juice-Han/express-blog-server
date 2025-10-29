const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-key";

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ error: "인증 토큰이 필요합니다." });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: "유효하지 않은 토큰입니다." });
    req.user = decoded; // { id, username, email }
    next();
  });
};

module.exports = requireAuth;
