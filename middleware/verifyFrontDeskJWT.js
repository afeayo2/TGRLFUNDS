const jwt = require("jsonwebtoken");
const FrontDesk = require("../models/FrontDesk");

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res.status(401).json({ message: "Unauthorized" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const staff = await FrontDesk.findById(decoded.id);
    if (!staff) return res.status(401).json({ message: "Invalid user" });

    req.staff = staff;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};