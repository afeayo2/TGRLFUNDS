const express = require("express");
const router = express.Router();
const Client = require("../models/Client");
const Payment = require("../models/Payment");
const Staff = require("../models/Staff");
const authStaff = require("../middleware/staffAuth");
const jwt = require("jsonwebtoken");
const upload = require("../middleware/upload");
const bcrypt = require("bcrypt");
const Loan = require("../models/Loan");
//const sendSMS = require('../utils/sendSMS');
//const sendEmail = require('../utils/sendEmail');

router.get("/me", authStaff, async (req, res) => {
  try {
    const staff = await Staff.findById(req.staffId).select(
      "fullName phone email"
    );
    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/add-client",
  upload.fields([
    { name: "passportPhoto", maxCount: 1 },
    { name: "faceCapture", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      // Uploaded file URLs
      const passportUrl = req.files.passportPhoto?.[0]?.path;
      const faceUrl = req.files.faceCapture?.[0]?.path;

      if (!passportUrl || !faceUrl) {
        return res
          .status(400)
          .json({ message: "Passport or Face photo is missing" });
      }

      const {
        fullName,
        phone,
        email,
        password,
        dateOfBirth,
        gender,
        maritalStatus,
        nextOfKin,
        savings,
        address,
        idType,
        idNumber,
        bvn,
      } = req.body;

      const existingClient = await Client.findOne({ phone });
      if (existingClient) {
        return res.status(409).json({ message: "Client already exists" });
      }
     const hashedPassword = await bcrypt.hash(password, 10); 

      const newClient = new Client({
        fullName,
        phone,
        email,
        password: hashedPassword,
        dateOfBirth,
        gender,
        maritalStatus,
        nextOfKin: JSON.parse(nextOfKin), // JSON string
        savings: JSON.parse(savings), // JSON string
        address: JSON.parse(address), // JSON string
        idType,
        idNumber,
        passportUrl,
        faceUrl,
        bvn,
        staffId: req.staffId,
        onboardedBy: req.staffId,

        onboardedAt: new Date(),
      });

      await newClient.save();
      res.status(201).json({ message: "Client added successfully" });
    } catch (err) {
      console.warn(err);
      res
        .status(500)
        .json({ message: "Error adding client", error: err.message });
    }
  }
);

/*
    await newClient.save();

    // Optional SMS/email notification
    if (phone) {
      await sendSMS(phone, `Welcome to PaceSave, ${fullName}!`);
    }
    if (email) {
      await sendEmail(email, 'Welcome to PaceSave', `<p>Hi ${fullName}, welcome to PaceSave!</p>`);
    }

    res.status(201).json({ message: 'Client onboarded successfully', client: newClient });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
*/

// Record cash collection
router.post("/collect-payment", authStaff, async (req, res) => {
  const { clientId, amount } = req.body;
  try {
    const client = await Client.findById(clientId);
    if (!client) return res.status(404).json({ message: "Client not found" });

    const payment = new Payment({
      clientId,
      staffId: req.staff._id,
      amount,
      method: "cash",
      reference: `CASH-${Date.now()}`,
    });

    await payment.save();

    client.balance += amount;
    await client.save();

    // Notify client
    /*
    if (client.phone) {
      await sendSMS(client.phone, `₦${amount} has been collected. Your new balance is ₦${client.balance.toFixed(2)}.`);
    }*/

    res
      .status(201)
      .json({ message: "Payment recorded and client notified", payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get assigned clients
router.get("/assigned-clients", authStaff, async (req, res) => {
  try {
    const clients = await Client.find({ staffId: req.staffId }).sort({
      fullName: 1,
    });
    res.json(clients);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/collections-summary", authStaff, async (req, res) => {
  console.log("Staff ID from token:", req.staff._id); // ✅ Correct log

  try {
    const now = new Date();

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [daily, weekly, monthly] = await Promise.all([
      Payment.aggregate([
        {
          $match: {
            staffId: req.staff._id, // ✅ FIXED
            createdAt: { $gte: startOfDay }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" }
          }
        }
      ]),
      Payment.aggregate([
        {
          $match: {
            staffId: req.staff._id, // ✅ FIXED
            createdAt: { $gte: startOfWeek }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" }
          }
        }
      ]),
      Payment.aggregate([
        {
          $match: {
            staffId: req.staff._id, // ✅ FIXED
            createdAt: { $gte: startOfMonth }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" }
          }
        }
      ])
    ]);

    res.json({
      daily: daily[0]?.total || 0,
      weekly: weekly[0]?.total || 0,
      monthly: monthly[0]?.total || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});



// Get onboarded clients (track by date)
router.get("/onboarded-clients", authStaff, async (req, res) => {
  try {
    const clients = await Client.find({ onboardedBy: req.staff._id }).sort({
      onboardedAt: -1,
    });
    res.json(clients);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/staff/register
router.post("/register", async (req, res) => {
  const { fullName, phone, email, password } = req.body;
  try {
    const existing = await Staff.findOne({ phone });
    if (existing)
      return res.status(400).json({ message: "Staff already exists" });

    const staff = await Staff.create({ fullName, phone, email, password });

    const token = jwt.sign(
      { id: staff._id, role: "staff" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res
      .status(201)
      .json({
        token,
        staff: { id: staff._id, fullName: staff.fullName, phone },
      });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Registration failed", error: err.message });
  }
});

// POST /api/staff/login
router.post("/login", async (req, res) => {
  const { phone, password } = req.body;
  try {
    const staff = await Staff.findOne({ phone });
    if (!staff) return res.status(404).json({ message: "Staff not found" });

    const isMatch = await staff.comparePassword(password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: staff._id, role: "staff" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      staff: { id: staff._id, fullName: staff.fullName, phone },
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});

// GET /api/staff/loans
router.get("/staff/loans", authStaff, async (req, res) => {
  try {
    const loans = await Loan.find({
      staffId: req.staffId,
      status: "pending"
    })
      .populate("clientId", "fullName phone address")
      .sort({ createdAt: -1 });

    res.json(loans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch staff loans" });
  }
});

// POST /api/staff/loans/:loanId/review
router.post("/staff/loans/:loanId/review", authStaff, async (req, res) => {
  try {
    const { decision, note } = req.body;

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "Invalid decision" });
    }

    const loan = await Loan.findOne({
      _id: req.params.loanId,
      staffId: req.staffId
    });

    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    if (loan.staffReview?.decision !== "pending") {
      return res.status(400).json({ message: "Loan already reviewed" });
    }

    loan.staffReview = {
      decision,
      note,
      reviewedAt: new Date()
    };

    await loan.save();

    res.json({
      message: "Staff review submitted. Await admin decision."
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to submit review" });
  }
});


module.exports = router;
