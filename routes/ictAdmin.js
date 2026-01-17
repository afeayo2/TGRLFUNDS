const express = require("express");
const router = express.Router();
const authICT = require("../middleware/authICT");
const Client = require("../models/Client");
const Staff = require("../models/Staff");
const Loan = require("../models/Loan");
const Inventory = require("../models/Inventory");
const ICTStaff = require("../models/ICTStaff");


/**
 * =========================
 * ICT DASHBOARD OVERVIEW
 * =========================
 */
router.get("/dashboard", authICT, async (req, res) => {
  try {
    const totalClients = await Client.countDocuments();
    const totalStaff = await Staff.countDocuments();
    const totalLoans = await Loan.countDocuments();

    res.json({
      message: "ICT dashboard loaded",
      stats: {
        totalClients,
        totalStaff,
        totalLoans
      }
    });
  } catch (err) {
    console.error("ICT dashboard error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * =========================
 * VIEW ALL CLIENT DATA
 * =========================
 */
router.get("/clients", authICT, async (req, res) => {
  try {
    const clients = await Client.find()
      .select("-password -pin")
      .sort({ createdAt: -1 });

    res.json(clients);
  } catch (err) {
    console.error("Error fetching clients:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * =========================
 * VIEW ALL STAFF
 * =========================
 */
router.get("/staff", authICT, async (req, res) => {
  try {
    const staff = await Staff.find()
      .select("-password")
      .sort({ createdAt: -1 });

    res.json(staff);
  } catch (err) {
    console.error("Error fetching staff:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * =========================
 * SYSTEM HEALTH CHECK
 * =========================
 */
router.get("/system-health", authICT, async (req, res) => {
  try {
    res.json({
      status: "OK",
      uptime: process.uptime(),
      timestamp: new Date()
    });
  } catch (err) {
    res.status(500).json({ message: "System health error" });
  }
});

/**
 * =========================
 * EXPORT DATA (ICT ONLY)
 * =========================
 */
router.get("/export/:type", authICT, async (req, res) => {
  try {
    const { type } = req.params;
    let data;

    if (type === "clients") data = await Client.find();
    else if (type === "staff") data = await Staff.find();
    else if (type === "loans") data = await Loan.find();
    else {
      return res.status(400).json({ message: "Invalid export type" });
    }

    res.json({
      message: "Export ready",
      count: data.length,
      data
    });
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * STAFF DAILY / WEEKLY / MONTHLY REPORT
 */
router.get("/performance", authICT, async (req, res) => {
  const { period } = req.query; // daily | weekly | monthly | yearly

  let startDate = new Date();

  if (period === "daily") startDate.setHours(0, 0, 0, 0);
  if (period === "weekly") startDate.setDate(startDate.getDate() - 7);
  if (period === "monthly") startDate.setMonth(startDate.getMonth() - 1);
  if (period === "yearly") startDate.setFullYear(startDate.getFullYear() - 1);

  const onboarded = await Client.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: "$staffId",
        totalClients: { $sum: 1 }
      }
    }
  ]);

  const payments = await LoanPayment.aggregate([
    { $match: { createdAt: { $gte: startDate }, status: "success" } },
    {
      $group: {
        _id: "$staffId",
        totalCollected: { $sum: "$amount" }
      }
    }
  ]);

  res.json({ onboarded, payments });
});


/**
 * ADD ASSET
 */
router.post("/add", authICT, async (req, res) => {
  try {
    const asset = await Inventory.create(req.body);
    res.json({ message: "Asset added", asset });
  } catch (err) {
    res.status(500).json({ message: "Error adding asset" });
  }
});

/**
 * VIEW ALL ASSETS
 */
router.get("/", authICT, async (req, res) => {
  const assets = await Inventory.find().sort({ createdAt: -1 });
  res.json(assets);
});

/**
 * ASSIGN ASSET
 */
router.post("/:id/assign", authICT, async (req, res) => {
  const { assignedToType, assignedToId } = req.body;

  const asset = await Inventory.findByIdAndUpdate(
    req.params.id,
    {
      assignedToType,
      assignedToId,
      assignedAt: new Date(),
      condition: "active"
    },
    { new: true }
  );

  res.json({ message: "Asset assigned", asset });
});


/**
 * STAFF DAILY / WEEKLY / MONTHLY REPORT
 */
router.get("/performance", authICT, async (req, res) => {
  const { period } = req.query; // daily | weekly | monthly | yearly

  let startDate = new Date();

  if (period === "daily") startDate.setHours(0, 0, 0, 0);
  if (period === "weekly") startDate.setDate(startDate.getDate() - 7);
  if (period === "monthly") startDate.setMonth(startDate.getMonth() - 1);
  if (period === "yearly") startDate.setFullYear(startDate.getFullYear() - 1);

  const onboarded = await Client.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: "$staffId",
        totalClients: { $sum: 1 }
      }
    }
  ]);

  const payments = await LoanPayment.aggregate([
    { $match: { createdAt: { $gte: startDate }, status: "success" } },
    {
      $group: {
        _id: "$staffId",
        totalCollected: { $sum: "$amount" }
      }
    }
  ]);

  res.json({ onboarded, payments });
});


router.get("/payments", authICT, async (req, res) => {
  const { from, to } = req.query;

  const payments = await LoanPayment.find({
    createdAt: {
      $gte: new Date(from),
      $lte: new Date(to)
    },
    status: "success"
  });

  res.json({
    totalAmount: payments.reduce((a, b) => a + b.amount, 0),
    count: payments.length,
    payments
  });
});

/**
 * FILTERED CLIENT EXPORT
 * ?from=2025-01-01&to=2025-01-31
 */
router.get("/export", authICT, async (req, res) => {
  const { from, to } = req.query;

  const dateFilter = {};
  if (from && to) {
    dateFilter.createdAt = {
      $gte: new Date(from),
      $lte: new Date(to)
    };
  }

  const clients = await Client.find(dateFilter);
  const loans = await Loan.find(dateFilter);
  const payments = await LoanPayment.find(dateFilter);

  res.json({
    clients,
    loans,
    payments
  });
});



router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    const exists = await ICTStaff.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "ICT staff already exists" });
    }

    const staff = await ICTStaff.create({
      fullName,
      email,
      password
    });

    res.json({
      message: "ICT account created",
      staff: {
        id: staff._id,
        fullName: staff.fullName,
        email: staff.email
      }
    });
  } catch (err) {
    console.error("ICT register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * =========================
 * ICT LOGIN
 * =========================
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const staff = await ICTStaff.findOne({ email, isActive: true });
    if (!staff) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, staff.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: staff._id,
        role: staff.role,
        type: "ict"
      },
      process.env.JWT_SECRET || "ictSecret",
      { expiresIn: "8h" }
    );

    res.json({
      message: "Login successful",
      token,
      staff: {
        id: staff._id,
        fullName: staff.fullName,
        email: staff.email,
        role: staff.role
      }
    });
  } catch (err) {
    console.error("ICT login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;
