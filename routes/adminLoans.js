const express = require("express");
const router = express.Router();
const Loan = require("../models/Loan");
const Client = require("../models/Client");
const authAdmin = require("../middleware/authAdmin");

// ✅ 1. Get all pending loan requests
router.get("/pending", authAdmin, async (req, res) => {
  try {
    const pendingLoans = await Loan.find({ status: "pending" })
      .populate("clientId", "fullName phone email balance")
      .sort({ createdAt: -1 });

    res.json(pendingLoans);
  } catch (err) {
    console.error("Error fetching pending loans:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ 2. Get single loan details (with credit info + client worthiness)
router.get("/:loanId", authAdmin, async (req, res) => {
  try {
    const { loanId } = req.params;
    const loan = await Loan.findById(loanId).populate("clientId", "fullName phone email balance onboardedAt withdrawals");

    if (!loan) return res.status(404).json({ message: "Loan not found" });

    const client = loan.clientId;

    // 🧠 Compute client’s saving behavior (for insight)
    const withdrawalCount = client.withdrawals?.length || 0;
    const totalSavings = client.balance || 0;
    const savingsBehavior = totalSavings / (withdrawalCount + 1);

    const worthiness = {
      accountAgeMonths: Math.floor((new Date() - new Date(client.onboardedAt)) / (1000 * 60 * 60 * 24 * 30)),
      totalSavings,
      withdrawalCount,
      savingsBehavior,
      creditScore: loan.creditScore,
      riskClass: loan.riskClass,
    };

    res.json({ loan, worthiness });
  } catch (err) {
    console.error("Error fetching loan details:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ 3. Approve a loan
router.post("/:loanId/approve", authAdmin, async (req, res) => {
  try {
    const { loanId } = req.params;
    const loan = await Loan.findById(loanId).populate("clientId");

    if (!loan) return res.status(404).json({ message: "Loan not found" });
    if (loan.status !== "pending") return res.status(400).json({ message: "Loan is not pending" });

    loan.status = "approved";
    await loan.save();

    res.json({ message: "Loan approved successfully", loan });
  } catch (err) {
    console.error("Error approving loan:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ 4. Reject a loan
router.post("/:loanId/reject", authAdmin, async (req, res) => {
  try {
    const { loanId } = req.params;
    const loan = await Loan.findById(loanId).populate("clientId");

    if (!loan) return res.status(404).json({ message: "Loan not found" });
    if (loan.status !== "pending") return res.status(400).json({ message: "Loan is not pending" });

    loan.status = "rejected";
    await loan.save();

    res.json({ message: "Loan rejected successfully", loan });
  } catch (err) {
    console.error("Error rejecting loan:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ 5. Mark a loan as repaid
router.post("/:loanId/mark-repaid", authAdmin, async (req, res) => {
  try {
    const { loanId } = req.params;
    const loan = await Loan.findById(loanId);

    if (!loan) return res.status(404).json({ message: "Loan not found" });
    if (loan.status !== "approved") return res.status(400).json({ message: "Only approved loans can be marked repaid" });

    loan.status = "repaid";
    await loan.save();

    res.json({ message: "Loan marked as repaid successfully", loan });
  } catch (err) {
    console.error("Error marking loan as repaid:", err);
    res.status(500).json({ message: "Server error" });
  }
});



// ✅ 0. Get ALL loans (for admin dashboard)
router.get("/", authAdmin, async (req, res) => {
  try {
    const loans = await Loan.find()
      .populate("clientId", "fullName phone email")
      .sort({ createdAt: -1 });

    res.json(loans);
  } catch (err) {
    console.error("Error fetching all loans:", err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
