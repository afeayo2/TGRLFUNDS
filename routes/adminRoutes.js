const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const authAdmin = require("../middleware/authAdmin"); 
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const Client = require("../models/Client");
const Staff = require("../models/Staff");
const Payment = require("../models/Payment");



// ========================
// 1. OVERVIEW STATS
// ========================
router.get("/overview", authAdmin, async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get totals
    const totalClients = await Client.countDocuments();
    const totalStaff = await Staff.countDocuments();

    const totalCollectionsAgg = await Payment.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalCollections = totalCollectionsAgg[0]?.total || 0;

    // Total withdrawals (sum of all client.withdrawals.amount)
    const withdrawals = await Client.aggregate([
      { $unwind: "$withdrawals" },
      { $group: { _id: null, total: { $sum: "$withdrawals.amount" } } }
    ]);
    const totalWithdrawals = withdrawals[0]?.total || 0;

    // Today's collections
    const todayCollectionsAgg = await Payment.aggregate([
      { $match: { createdAt: { $gte: startOfDay } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const todayCollections = todayCollectionsAgg[0]?.total || 0;

    // Today's withdrawals
    const todayWithdrawalsAgg = await Client.aggregate([
      { $unwind: "$withdrawals" },
      { $match: { "withdrawals.date": { $gte: startOfDay } } },
      { $group: { _id: null, total: { $sum: "$withdrawals.amount" } } }
    ]);
    const todayWithdrawals = todayWithdrawalsAgg[0]?.total || 0;

    res.json({
      totalClients,
      totalStaff,
      totalCollections,
      totalWithdrawals,
      todayCollections,
      todayWithdrawals
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ========================
// 2. STAFF REPORTS
// ========================
router.get("/staff-reports", authAdmin, async (req, res) => {
  try {
    const { period } = req.query;
    const now = new Date();
    let startDate;

    if (period === "daily") startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (period === "weekly") startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    else if (period === "monthly") startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === "yearly") startDate = new Date(now.getFullYear(), 0, 1);

    const staffList = await Staff.find().lean();

    const report = await Promise.all(staffList.map(async staff => {
      const collectedAgg = await Payment.aggregate([
        { $match: { staffId: staff._id, ...(startDate && { createdAt: { $gte: startDate } }) } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);
      const totalCollected = collectedAgg[0]?.total || 0;

      const onboardedCount = await Client.countDocuments({
        onboardedBy: staff._id,
        ...(startDate && { onboardedAt: { $gte: startDate } })
      });

      return {
        staffId: staff._id,
        fullName: staff.fullName,
        totalCollected,
        clientsOnboarded: onboardedCount
      };
    }));

    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ========================
// 3. CLIENT MANAGEMENT
// ========================
router.get("/clients", authAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    let filter = {};
    if (search) {
      filter = {
        $or: [
          { fullName: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } }
        ]
      };
    }
    const clients = await Client.find(filter).populate("staffId onboardedBy", "fullName phone");
    res.json(clients);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/client/:id", authAdmin, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)
      .populate("staffId onboardedBy", "fullName phone");

    if (!client) return res.status(404).json({ message: "Client not found" });

    const payments = await Payment.find({ clientId: client._id });
    res.json({ client, payments, withdrawals: client.withdrawals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/client/:id/assign", authAdmin, async (req, res) => {
  try {
    const { staffId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(staffId))
      return res.status(400).json({ message: "Invalid staff ID" });

    const updated = await Client.findByIdAndUpdate(req.params.id, { staffId }, { new: true });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ========================
// 4. STAFF MANAGEMENT
// ========================
router.post("/staff", authAdmin, async (req, res) => {
  try {
    const { fullName, phone, email, password } = req.body;
    const staff = new Staff({ fullName, phone, email, password });
    await staff.save();
    res.json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/staff/:id", authAdmin, async (req, res) => {
  try {
    await Staff.findByIdAndDelete(req.params.id);
    res.json({ message: "Staff deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET all staff (for assignment dropdown)
router.get("/staff", authAdmin, async (req, res) => {
  try {
    const staff = await Staff.find({}, "fullName phone");
    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


// ========================
// 5. TRANSACTIONS
// ========================
router.get("/payments", authAdmin, async (req, res) => {
  try {
    const { startDate, endDate, staffId, clientId } = req.query;
    let filter = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    if (staffId) filter.staffId = staffId;
    if (clientId) filter.clientId = clientId;

    const payments = await Payment.find(filter)
      .populate("staffId clientId", "fullName phone");
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/withdrawals", authAdmin, async (req, res) => {
  try {
    const clients = await Client.find({}, "fullName phone withdrawals");
    let allWithdrawals = [];
    clients.forEach(client => {
      client.withdrawals.forEach(w => {
        allWithdrawals.push({
          clientId: client._id,
          fullName: client.fullName,
          phone: client.phone,
          ...w.toObject()
        });
      });
    });
    res.json(allWithdrawals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});



router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, admin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// Admin Registration
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const admin = new Admin({
      fullName,
      email,
      password
    });

    await admin.save();

    // Generate token
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Admin registered successfully",
      admin: {
        id: admin._id,
        fullName: admin.fullName,
        email: admin.email
      },
      token
    });
  } catch (err) {
    console.error("Admin Registration Error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
