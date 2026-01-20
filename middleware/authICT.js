const jwt = require("jsonwebtoken");

module.exports = function authICT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Invalid token format" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "ict") {
      return res.status(403).json({ message: "Access denied" });
    }

    req.ict = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token expired or invalid" });
  }
};