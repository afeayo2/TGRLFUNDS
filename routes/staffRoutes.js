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
const mongoose = require("mongoose");

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
  "/add-client",authStaff,
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

            res.status(201).json({
              message: "Client added successfully",
              clientId: newClient._id,
            });
          } catch (err) {
            console.error("ADD CLIENT ERROR:", err);
            res.status(500).json({
              message: "Error adding client",
              error: err.message,
            });
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
      staffId: req.staffId, // ✅
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
  try {
    const staffObjectId = new mongoose.Types.ObjectId(req.staffId);

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [daily, weekly, monthly] = await Promise.all([
      Payment.aggregate([
        {
          $match: {
            staffId: staffObjectId,
            createdAt: { $gte: startOfDay }
          }
        },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      Payment.aggregate([
        {
          $match: {
            staffId: staffObjectId,
            createdAt: { $gte: startOfWeek }
          }
        },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      Payment.aggregate([
        {
          $match: {
            staffId: staffObjectId,
            createdAt: { $gte: startOfMonth }
          }
        },
        { $group: { _id: null, total: { $sum: "$amount" } } }
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
    const clients = await Client.find({ onboardedBy: req.staffId}).sort({
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
  staff: {
    id: staff._id,
    fullName: staff.fullName,
    phone
  }
});

  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});

// GET /api/staff/loans
router.get("/loans", authStaff, async (req, res) => {
  try {
    const staffId = new mongoose.Types.ObjectId(req.staffId);

    const loans = await Loan.find({
      staffId,
      status: { $ne: "paid" } // 👈 KEY CHANGE
    })
      .populate("clientId", "fullName phone")
      .sort({ createdAt: -1 });

    res.json(loans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch staff loans" });
  }
});


// POST /api/staff/loans/:loanId/review
router.post("/loans/:loanId/review", authStaff, async (req, res) => {
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


router.post(
  "/loan/:loanId/pay/cash",
  authStaff,
  async (req, res) => {
    const { loanId } = req.params;

    const loan = await Loan.findById(loanId);
    if (!loan) return res.status(404).json({ message: "Loan not found" });

    const installment = loan.installments.find(i => i.status === "unpaid");
    if (!installment)
      return res.status(400).json({ message: "No unpaid installment" });

    installment.status = "paid";
    installment.paidAt = new Date();

    loan.payments.push({
      amount: installment.amount,
      method: "cash",
      installmentWeek: installment.week,
      staffId: req.staffId,
      paidBy: "staff",
      reference: `CASH-${Date.now()}`
    });

    if (loan.installments.every(i => i.status === "paid")) {
      loan.status = "paid";
    }

    await loan.save();

    res.json({
      message: "Cash payment recorded successfully",
      installment
    });
  }
);


// GET /api/staff/loan-schedule
router.get("/loan-schedule", authStaff, async (req, res) => {
  try {
    const staffId = new mongoose.Types.ObjectId(req.staffId);

    const loans = await Loan.find({
      staffId,
      status: { $ne: "paid" }
    }).populate("clientId", "fullName phone");

    const schedule = [];

    loans.forEach(loan => {
      loan.installments
        .filter(i => i.status === "unpaid")
        .forEach(i => {
          schedule.push({
            loanId: loan._id,
            clientName: loan.clientId.fullName,
            phone: loan.clientId.phone,
            week: i.week,
            amount: i.amount,
            dueDate: i.dueDate,
            day: i.day
          });
        });
    });

    res.json(schedule);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load schedule" });
  }
});

// GET /api/staff/loan-schedule/filter?range=today|week|month
router.get("/loan-schedule/filter", authStaff, async (req, res) => {
  const { range } = req.query;

  const now = new Date();
  let endDate = new Date(now);

  if (range === "today") endDate.setHours(23,59,59,999);
  if (range === "week") endDate.setDate(now.getDate() + 7);
  if (range === "month") endDate.setMonth(now.getMonth() + 1);

  const loans = await Loan.find({
    staffId: req.staffId,
    status: { $ne: "paid" }
  }).populate("clientId", "fullName phone");

  const due = [];

  loans.forEach(loan => {
    loan.installments.forEach(i => {
      if (
        i.status === "unpaid" &&
        new Date(i.dueDate) <= endDate
      ) {
        due.push({
          client: loan.clientId.fullName,
          phone: loan.clientId.phone,
          amount: i.amount,
          dueDate: i.dueDate
        });
      }
    });
  });

  res.json(due);
});


// GET /api/staff/loan-defaulters
router.get("/loan-defaulters", authStaff, async (req, res) => {
  try {
    const today = new Date();

    const loans = await Loan.find({
      staffId: req.staffId,
      status: { $ne: "paid" }
    }).populate("clientId", "fullName phone");

    const defaulters = [];

    loans.forEach(loan => {
      loan.installments.forEach(i => {
        if (
          i.status === "unpaid" &&
          new Date(i.dueDate) < today
        ) {
          defaulters.push({
            loanId: loan._id,
            client: loan.clientId.fullName,
            phone: loan.clientId.phone,
            amount: i.amount,
            dueDate: i.dueDate,
            week: i.week
          });
        }
      });
    });

    res.json(defaulters);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch defaulters" });
  }
});



router.get("/installments-due", authStaff, async (req, res) => {
  try {
    const staffId = req.staff._id;
    const today = new Date();

    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const startOfMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );

    const loans = await Loan.find({
      staffId,
      status: { $in: ["active", "unpaid"] }
    });

    let todayDue = 0;
    let weekDue = 0;
    let monthDue = 0;

    loans.forEach(loan => {
      loan.installments.forEach(inst => {
        if (inst.status !== "unpaid") return;

        const due = new Date(inst.dueDate);

        if (due >= startOfToday && due <= endOfToday) {
          todayDue += inst.amount;
        }

        if (due >= startOfWeek) {
          weekDue += inst.amount;
        }

        if (due >= startOfMonth) {
          monthDue += inst.amount;
        }
      });
    });

    res.json({
      todayDue,
      weekDue,
      monthDue
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load installment dues" });
  }
});


module.exports = router;
