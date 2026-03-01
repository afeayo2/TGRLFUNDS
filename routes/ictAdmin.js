const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const jwt = require("jsonwebtoken");

const authICT = require("../middleware/authICT");
const Client = require("../models/Client");
const Staff = require("../models/Staff");
const ICTStaff = require("../models/ICTStaff");
const Loan = require("../models/Loan");
const Inventory = require("../models/Inventory");
const LoanPayment = require("../models/LoanPayment");
const Payment = require("../models/Payment");
const Complaint = require("../models/Complaint");
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
      stats: { totalClients, totalStaff, totalLoans }
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
    res.json({ status: "OK", uptime: process.uptime(), timestamp: new Date() });
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
    else return res.status(400).json({ message: "Invalid export type" });

    res.json({ message: "Export ready", count: data.length, data });
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * =========================
 * ADD INVENTORY ASSET
 * =========================
 */
router.post("/add", authICT, async (req, res) => {
  try {
    const asset = await Inventory.create(req.body);
    res.json({ message: "Asset added", asset });
  } catch (err) {
    console.error("Add asset error:", err);
    res.status(500).json({ message: "Error adding asset" });
  }
});

/**
 * =========================
 * VIEW ALL INVENTORY ASSETS
 * =========================
 */
/** * VIEW ALL ASSETS */ 
router.get("/", async (req, res) => {
  try {
    const assets = await Inventory.find()
      .populate("assignedToId", "fullName");
    res.json(assets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
     /**

 * =========================


/**
 * =========================
 * ASSIGN ASSET
 * =========================
 */
router.post("/:id/assign", authICT, async (req, res) => {
  try {
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
  } catch (err) {
    console.error("Assign asset error:", err);
    res.status(500).json({ message: "Error assigning asset" });
  }
});

/**
 * =========================
 * ICT STAFF REGISTRATION
 * =========================
 */
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    const exists = await ICTStaff.findOne({ email });
    if (exists) return res.status(400).json({ message: "ICT staff already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const staff = await ICTStaff.create({ fullName, email, password: hashedPassword });

    res.json({
      message: "ICT account created",
      staff: { id: staff._id, fullName: staff.fullName, email: staff.email }
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
    if (!staff) return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, staff.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: staff._id, role: staff.role, type: "ict" },
      process.env.JWT_SECRET || "ictSecret",
      { expiresIn: "8h" }
    );

    res.json({
      message: "Login successful",
      token,
      staff: { id: staff._id, fullName: staff.fullName, email: staff.email, role: staff.role }
    });
  } catch (err) {
    console.error("ICT login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * =========================
 * STAFF PERFORMANCE
 * =========================
 */
router.get("/performance", authICT, async (req, res) => {
  try {
    const { period } = req.query;
    let startDate = new Date();

    if (period === "daily") startDate.setHours(0, 0, 0, 0);
    if (period === "weekly") startDate.setDate(startDate.getDate() - 7);
    if (period === "monthly") startDate.setMonth(startDate.getMonth() - 1);
    if (period === "yearly") startDate.setFullYear(startDate.getFullYear() - 1);

    // Client onboarding per staff
    const onboarded = await Client.aggregate([
      { $match: { createdAt: { $gte: startDate }, staffId: { $ne: null } } },
      { $group: { _id: "$staffId", totalClients: { $sum: 1 } } }
    ]);

    // Loan payments collected per staff
    const loanPayments = await LoanPayment.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: "success", staffId: { $ne: null } } },
      { $group: { _id: "$staffId", loanCollected: { $sum: "$amount" } } }
    ]);

    // Other payments collected
    const otherPayments = await Payment.aggregate([
      { $match: { createdAt: { $gte: startDate }, staffId: { $ne: null } } },
      { $group: { _id: "$staffId", otherCollected: { $sum: "$amount" } } }
    ]);

    // Loans disbursed
    const loans = await Loan.aggregate([
      { $match: { createdAt: { $gte: startDate }, staffId: { $ne: null } } },
      { $group: { _id: "$staffId", totalLoans: { $sum: 1 }, totalLoanAmount: { $sum: "$amount" } } }
    ]);

    const staffPerformance = {};

    onboarded.forEach(o => {
      staffPerformance[o._id] = { staffId: o._id, totalClients: o.totalClients, totalCollected: 0, loanCollected: 0, otherCollected: 0, totalLoans: 0, totalLoanAmount: 0 };
    });
    loanPayments.forEach(p => {
      if (!staffPerformance[p._id]) staffPerformance[p._id] = { staffId: p._id, totalClients: 0, totalCollected: 0, loanCollected: 0, otherCollected: 0, totalLoans: 0, totalLoanAmount: 0 };
      staffPerformance[p._id].loanCollected = p.loanCollected;
    });
    otherPayments.forEach(p => {
      if (!staffPerformance[p._id]) staffPerformance[p._id] = { staffId: p._id, totalClients: 0, totalCollected: 0, loanCollected: 0, otherCollected: 0, totalLoans: 0, totalLoanAmount: 0 };
      staffPerformance[p._id].otherCollected = p.otherCollected;
    });
    loans.forEach(l => {
      if (!staffPerformance[l._id]) staffPerformance[l._id] = { staffId: l._id, totalClients: 0, totalCollected: 0, loanCollected: 0, otherCollected: 0, totalLoans: 0, totalLoanAmount: 0 };
      staffPerformance[l._id].totalLoans = l.totalLoans;
      staffPerformance[l._id].totalLoanAmount = l.totalLoanAmount;
    });

    Object.values(staffPerformance).forEach(s => {
      s.totalCollected = (s.loanCollected || 0) + (s.otherCollected || 0);
    });

    const staffIds = Object.keys(staffPerformance);
    const staffDocs = await Staff.find({ _id: { $in: staffIds } }).select("fullName");
    staffDocs.forEach(s => {
      if (staffPerformance[s._id]) staffPerformance[s._id].staffName = s.fullName;
    });

    res.json({ performance: Object.values(staffPerformance) });
  } catch (err) {
    console.error("Performance error:", err);
    res.status(500).json({ message: "Performance error" });
  }
});


/**
 * =========================
 * VIEW ALL COMPLAINTS (ICT ONLY)
 * =========================
 */
/**
 * =========================
 * VIEW / FILTER COMPLAINTS (ICT)
 * =========================
 */
router.get("/complaints", authICT, async (req, res) => {
  try {
    const { status } = req.query; // ?status=open or resolved

    const filter = {};
    if (status && ["open", "resolved"].includes(status)) {
      filter.status = status;
    }

    const complaints = await Complaint.find(filter)
      .populate("clientId", "fullName phone")
      .populate("staffId", "fullName email")
      .sort({ createdAt: -1 });

    res.json({
      count: complaints.length,
      complaints
    });

  } catch (err) {
    console.error("ICT complaint fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/**
 * =========================
 * RESOLVE COMPLAINT (ICT)
 * =========================
 */
router.patch("/complaints/:id/resolve", authICT, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    complaint.status = "resolved";
    complaint.resolvedAt = new Date();
    complaint.resolvedBy = req.staff.id; // optional tracking

    await complaint.save();

    res.json({ message: "Complaint resolved successfully" });

  } catch (err) {
    console.error("Resolve complaint error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
