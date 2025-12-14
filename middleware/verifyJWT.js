const jwt = require('jsonwebtoken'); // ✅ REQUIRED

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  console.log("AuthHeader:", authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized. Missing token." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded:", decoded);
    req.clientId = decoded.clientId;
    next();
  } catch (err) {
    console.error("JWT Error:", err.message);
    return res.status(401).json({ error: "Unauthorized. Invalid token." });
  }
}

module.exports = verifyJWT;


