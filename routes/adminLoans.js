const express = require("express");
const router = express.Router();
const Loan = require("../models/Loan");
const Client = require("../models/Client");
const authAdmin = require("../middleware/authAdmin");
const Payment = require("../models/Payment");
const axios = require("axios");
const sendEmail = require("../utils/sendEmail");
const {
  loanApprovedTemplate,
  loanRejectedTemplate,
} = require("../utils/emailTemplates");

router.get("/test-email", async (req, res) => {
  try {
    await sendEmail(
      "afeayosunday@gmail.com",
      "Test Email",
      "<h2>SMTP is working 🎉</h2>",
    );

    res.json({ message: "Email sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * 1. GET PENDING LOANS
 * =========================
 */
router.get("/pending", authAdmin, async (req, res) => {
  try {
    const pendingLoans = await Loan.find({ status: "pending" })
      .populate("clientId", "fullName phone email balance")
      .populate("staffId", "fullName phone")
      .sort({ createdAt: -1 });

    res.json(pendingLoans);
  } catch (err) {
    console.error("Error fetching pending loans:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * =========================
 * 2. GET SINGLE LOAN DETAILS
 * =========================
 */
router.get("/:loanId", authAdmin, async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.loanId)
      .populate(
        "clientId",
        "fullName phone email balance onboardedAt withdrawals",
      )
      .populate("staffId", "fullName phone");

    if (!loan) return res.status(404).json({ message: "Loan not found" });

    const client = loan.clientId;

    const withdrawalCount = client.withdrawals?.length || 0;
    const totalSavings = client.balance || 0;

    const worthiness = {
      accountAgeMonths: Math.floor(
        (Date.now() - new Date(client.onboardedAt)) /
          (1000 * 60 * 60 * 24 * 30),
      ),
      totalSavings,
      withdrawalCount,
      savingsBehavior: totalSavings / (withdrawalCount + 1),
      creditScore: loan.creditScore,
      riskClass: loan.riskClass,
    };

    res.json({
      loan,
      staffReview: loan.staffReview || { decision: "pending", note: null },
      worthiness,
    });
  } catch (err) {
    console.error("Error fetching loan details:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * =========================
 * 3. APPROVE LOAN
 * =========================
 */
router.post("/:loanId/approve", authAdmin, async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.loanId);

    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    if (loan.status !== "pending") {
      return res.status(400).json({
        message: `Loan already ${loan.status}`,
      });
    }

    // 🔥 ADMIN HAS FINAL SAY — NO STAFF CHECK
    loan.status = "approved";
    loan.approvedAt = new Date();
    loan.adminNote = req.body?.note || "Approved by admin";

    await loan.save();

    // ✅ CREDIT CLIENT BALANCE
    // 1️⃣ Credit client balance
    await Client.findByIdAndUpdate(loan.clientId, {
      $inc: { balance: loan.approvedAmount },
    });

    // 2️⃣ Record loan disbursement
    await Payment.create({
      clientId: loan.clientId,
      staffId: loan.staffId, // optional but useful
      amount: loan.approvedAmount,
      method: "loan-disbursement",
      reference: `LOAN-DISB-${loan._id}-${Date.now()}`,
      date: new Date(),
    });

    const client = await Client.findById(loan.clientId);

    if (client?.email) {
      await sendEmail(
        client.email,
        "Your Loan Has Been Approved 🎉",
        loanApprovedTemplate(client.fullName, loan.approvedAmount),
      );
    }

    res.json({
      message: "Loan approved by admin",
      loan,
    });
  } catch (err) {
    console.error("Error approving loan:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * =========================
 * 4. REJECT LOAN
 * =========================
 */
router.post("/:loanId/reject", authAdmin, async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.loanId);

    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    if (loan.status !== "pending") {
      return res.status(400).json({
        message: `Loan already ${loan.status}`,
      });
    }

    loan.status = "rejected";
    loan.adminNote = req.body?.note || "Rejected by admin";

    await loan.save();

    const client = await Client.findById(loan.clientId);

    if (client?.email) {
      await sendEmail(
        client.email,
        "Loan Application Update",
        loanRejectedTemplate(client.fullName),
      );
    }

    res.json({
      message: "Loan rejected by admin",
      loan,
    });
  } catch (err) {
    console.error("Error rejecting loan:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * =========================
 * 5. MARK LOAN AS PAID
 * =========================
 */
router.post("/:loanId/mark-paid", authAdmin, async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.loanId);

    if (!loan) return res.status(404).json({ message: "Loan not found" });
    if (loan.status !== "approved") {
      return res.status(400).json({
        message: "Only approved loans can be marked as paid",
      });
    }

    loan.status = "paid";
    await loan.save();

    res.json({ message: "Loan marked as paid successfully", loan });
  } catch (err) {
    console.error("Error marking loan as paid:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * =========================
 * 6. GET ALL LOANS
 * =========================
 */
router.get("/", authAdmin, async (req, res) => {
  try {
    const loans = await Loan.find()
      .populate("clientId", "fullName phone email")
      .populate("staffId", "fullName phone")
      .sort({ createdAt: -1 });

    res.json(loans);
  } catch (err) {
    console.error("Error fetching all loans:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:loanId/pull-credit", authAdmin, async (req, res) => {
  try {
    const { loanId } = req.params;

    const loan = await Loan.findById(loanId).populate({
      path: "clientId",
      select: "bvn fullName phone",
    });

    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    const client = loan.clientId;

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    const bvn = client.bvn;

    if (!bvn || bvn.length !== 11) {
      return res.status(400).json({ message: "Invalid BVN" });
    }

    const response = await axios.get(
      "https://api.creditchek.africa/v1/credit/first-central",
      {
        params: { bvn },
        headers: {
          token: process.env.CREDITCHEK_SECRET,
        },
      },
    );

    // 🔥 SAVE TO DB
    loan.externalCreditReport = response.data;
    loan.externalCreditPulledAt = new Date();
    await loan.save();

    res.json(response.data);
  } catch (error) {
    console.error("Credit API Error:", error.response?.data || error.message);

    res.status(500).json({
      message: "Failed to pull credit report",
      error: error.response?.data || error.message,
    });
  }
});

/*
router.get("/:loanId/pull-credit", async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.loanId)
      .populate("clientId");

    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    const bvn = loan.clientId.bvn;

    const response = await axios.get(
      `https://api.creditchek.africa/v1/credit/premium?bvn=${bvn}`,
      {
        headers: {
          token: process.env.CREDITCHEK_SECRET
        }
      }
    );

    // 🔥 SAVE TO DB
    loan.externalCreditReport = response.data;
    loan.externalCreditPulledAt = new Date();
    await loan.save();

    res.json(response.data);

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ message: "Credit check failed" });
  }
});
*/


// ===============================
// CREATE MANUAL LOAN + INSTALLMENTS
// ===============================
router.post("/manual-loan", authAdmin, async (req, res) => {
  try {

    const {
      fullName,
      phone,
      staffId,
      amount,
      durationWeeks,
      startDate
    } = req.body;

    // ✅ VALIDATION
    if (!fullName || !phone || !staffId || !amount || !durationWeeks) {
      return res.status(400).json({
        message: "Missing required fields"
      });
    }

    // ✅ INSTALLMENTS
    const weeklyAmount = Math.ceil(Number(amount) / Number(durationWeeks));
    const installments = [];

    const start = new Date(startDate || Date.now());

    for (let i = 1; i <= durationWeeks; i++) {
      const dueDate = new Date(start);
      dueDate.setDate(start.getDate() + i * 7);

      installments.push({
        week: i,
        amount: weeklyAmount,
        dueDate,
        day: dueDate.toLocaleDateString("en-US", { weekday: "long" }),
        status: "unpaid"
      });
    }

    // ✅ CREATE LOAN (NO CLIENT MODEL USED)
    const loan = new Loan({
      // ❌ REMOVE clientId completely

      staffId,

      requestedAmount: Number(amount),
      approvedAmount: Number(amount),

      totalRepayment: Number(amount),
      durationInMonths: durationWeeks / 4,

      installments,

      status: "active",
      loanSource: "manual",

      // ✅ STORE DIRECTLY
      clientName: fullName,
      phoneNumber: phone
    });

    await loan.save();

    res.json({
      message: "Manual loan created successfully",
      loan
    });

  } catch (err) {
    console.error("Manual loan creation error:", err);

    res.status(500).json({
      message: "Failed to create loan"
    });
  }
});


router.get("/collections/today", authAdmin, async (req, res) => {
  try {

    const today = new Date();
    today.setHours(0,0,0,0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const loans = await Loan.find({
      status: { $in: ["approved", "active"] }
    })
    .populate("clientId", "fullName phone")
    .populate("staffId", "fullName");

    const collections = [];

    loans.forEach(loan => {

      loan.installments.forEach(inst => {

        if (
          inst.status === "unpaid" &&
          inst.dueDate >= today &&
          inst.dueDate < tomorrow
        ) {

          collections.push({
            loanId: loan._id,
            client: loan.clientId?.fullName || loan.clientName,
            phone: loan.clientId?.phone || loan.phoneNumber,
            amount: inst.amount,
            dueDate: inst.dueDate,
            staff: loan.staffId.fullName,
            staffId: loan.staffId._id
          });

        }

      });

    });

    res.json(collections);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Failed to load today's collections"
    });

  }
});


module.exports = router;
