const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin"); 

// middleware/authAdmin.js
//const jwt = require("jsonwebtoken");
require("dotenv").config();

function authAdmin(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }
    req.adminId = decoded.adminId;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

module.exports = authAdmin;









/*

module.exports = async function authAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Ensure the user is actually an admin
    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({ message: "Admin not found" });
    }

    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    req.admin = admin; // store admin info for later use
    next();
  } catch (err) {
    console.error("AuthAdmin Error:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
*/