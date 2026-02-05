const express = require("express");
const router = express.Router();
const Loan = require("../models/Loan");
const Client = require("../models/Client");
const authAdmin = require("../middleware/authAdmin");

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
      .populate("clientId", "fullName phone email balance onboardedAt withdrawals")
      .populate("staffId", "fullName phone");

    if (!loan) return res.status(404).json({ message: "Loan not found" });

    const client = loan.clientId;

    const withdrawalCount = client.withdrawals?.length || 0;
    const totalSavings = client.balance || 0;

    const worthiness = {
      accountAgeMonths: Math.floor(
        (Date.now() - new Date(client.onboardedAt)) / (1000 * 60 * 60 * 24 * 30)
      ),
      totalSavings,
      withdrawalCount,
      savingsBehavior: totalSavings / (withdrawalCount + 1),
      creditScore: loan.creditScore,
      riskClass: loan.riskClass
    };

    res.json({
      loan,
      staffReview: loan.staffReview || { decision: "pending", note: null },
      worthiness
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
        message: `Loan already ${loan.status}`
      });
    }

    // 🔥 ADMIN HAS FINAL SAY — NO STAFF CHECK
    loan.status = "approved";
    loan.approvedAt = new Date();
    loan.adminNote = req.body?.note || "Approved by admin";

    await loan.save();

    

// ✅ CREDIT CLIENT BALANCE
    // 1️⃣ Credit client balance
    await Client.findByIdAndUpdate(
      loan.clientId,
      { $inc: { balance: loan.approvedAmount } }
    );

    // 2️⃣ Record loan disbursement
    await Payment.create({
      clientId: loan.clientId,
      staffId: loan.staffId, // optional but useful
      amount: loan.approvedAmount,
      method: "loan-disbursement",
      reference: `LOAN-DISB-${loan._id}-${Date.now()}`,
      date: new Date()
    });



    res.json({
      message: "Loan approved by admin",
      loan
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
        message: `Loan already ${loan.status}`
      });
    }

    loan.status = "rejected";
    loan.adminNote = req.body?.note || "Rejected by admin";

    await loan.save();

    res.json({
      message: "Loan rejected by admin",
      loan
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
        message: "Only approved loans can be marked as paid"
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



module.exports = router;
