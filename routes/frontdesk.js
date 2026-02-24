const express = require("express");
const router = express.Router();
const verifyJWT = require("../middleware/verifyFrontDeskJWT");

const FrontDesk = require("../models/FrontDesk");
const Client = require("../models/Client");
const Loan = require("../models/Loan");
const Payment = require("../models/Payment");
const CallLog = require("../models/CallLog");
const Complaint = require("../models/Complaint");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


/*
router.post("/register", async (req, res) => {
  console.log("REGISTER HIT");
  res.json({ message: "Test working" });
});
*/

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    const exists = await FrontDesk.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "Email already exists" });

    await FrontDesk.create({
      fullName,
      email,
      phone,
      password
    });

    res.status(201).json({ message: "FrontDesk account created" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const staff = await FrontDesk.findOne({ email });
    if (!staff)
      return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, staff.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: staff._id, role: staff.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      staff: {
        id: staff._id,
        name: staff.fullName,
        email: staff.email
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});




router.use(verifyJWT);

router.get("/clients/:id",verifyJWT, async (req, res) => {
  const client = await Client.findById(req.params.id);
  if (!client)
    return res.status(404).json({ message: "Client not found" });

  const loans = await Loan.find({ clientId: client._id });
  const payments = await Payment.find({ clientId: client._id });

  if (!client) return res.status(404).json({ message: "Client not found" });

  res.json({
    client: {
      id: client._id,
      name: client.fullName,
      phone: client.phone,
      balance: client.balance,
      savings: client.savings,
      onboardedAt: client.createdAt,
      loans,
      payments
    }
  });
});


router.get("/disbursements",verifyJWT,async (req, res) => {
  const payments = await Payment.find({ status: "approved" });
  //const withdrawals = await Withdrawal.find({ status: "approved" });

  res.json({ payments});
});

router.post("/disbursements/:id/treated",verifyJWT,async (req, res) => {
  const { type } = req.body; // payment | withdrawal

  const Model = type === "payment" ? Payment : Withdrawal;
  const record = await Model.findById(req.params.id);

  if (!record) return res.status(404).json({ message: "Not found" });

  record.treatedByFrontDesk = true;
  record.treatedAt = new Date();
  await record.save();

  res.json({ message: "Marked as treated" });
});


router.get("/loan-defaulters",verifyJWT,async (req, res) => {
  const today = new Date();

  const defaulters = await Loan.find({
    status: "approved",
    dueDate: { $lt: today }
  }).populate("clientId", "fullName phone");

  res.json(defaulters);
});


router.post("/calls/log",verifyJWT,async (req, res) => {
  const { clientId, loanId, note, outcome } = req.body;

  const log = await CallLog.create({
    clientId,
    loanId,
    staffId: req.staff.id,
    note,
    outcome
  });

  res.json({ message: "Call logged", log });
});

router.get("/calls/daily",verifyJWT,async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const count = await CallLog.countDocuments({
    staffId: req.staff.id,
    createdAt: { $gte: start }
  });

  res.json({ callsToday: count });
});


router.get("/clients/search/:query",verifyJWT,async (req, res) => {
  const query = req.params.query;

  const client = await Client.findOne({
    $or: [
      { fullName: { $regex: query, $options: "i" } },
      { phone: query }
    ]
  });

  if (!client) {
    return res.status(404).json({ message: "Client not found" });
  }

  const loans = await Loan.find({ clientId: client._id });
  const payments = await Payment.find({ clientId: client._id });

  res.json({
    client: {
      ...client.toObject(),
      loans,
      payments
    }
  });

  if (!client) {
    return res.status(404).json({ message: "Client not found" });
  }

  res.json({ client });
});


router.post("/complaints", verifyJWT, async (req, res) => {
  try {
    const { clientId, title, description } = req.body;

    const complaint = await Complaint.create({
      clientId,
      staffId: req.staff.id,
      title,
      description
    });

    res.json({ message: "Complaint logged", complaint });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


router.patch("/complaints/:id/resolve", verifyJWT, async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint)
    return res.status(404).json({ message: "Not found" });

  complaint.status = "resolved";
  complaint.resolvedAt = new Date();
  await complaint.save();

  res.json({ message: "Complaint resolved" });
});

router.get("/clients/:id/complaints", verifyJWT, async (req, res) => {
  const complaints = await Complaint.find({
    clientId: req.params.id
  }).sort({ createdAt: -1 });

  res.json(complaints);
});

module.exports = router;