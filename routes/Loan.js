
const express = require("express");
const router = express.Router();
const axios = require("axios");
const Loan = require("../models/Loan");
const Client = require("../models/Client");
const verifyJWT = require("../middleware/verifyJWT");

const DOJAH_API_KEY = process.env.DOJAH_API_KEY;
const DOJAH_APP_ID = process.env.DOJAH_APP_ID;

router.post("/request", verifyJWT, async (req, res) => {
  try {
    const { amount, bvn, nin, durationInMonths } = req.body;
    const client = await Client.findById(req.clientId);
    if (!client) return res.status(404).json({ message: "Client not found" });

    // ⛔ Prevent multiple loans
    const existing = await Loan.findOne({
      clientId: req.clientId,
      status: { $in: ["pending", "approved", "unpaid"] }
    });

    if (existing) {
      return res.status(400).json({
        eligible: false,
        message: "You already have an active or pending loan."
      });
    }

    // ⛔ Enforce duration 3–6 months
    let months = Number(durationInMonths);
    if (months < 3) months = 3;
    if (months > 6) months = 6;

    let creditScore = 0;
    let riskClass = "Unknown";
    let externalVerified = false;

    // Same BVN/NIN/credit score check you already have...
    // (Keeping your logic unchanged)
    // --------------------------------------------
    // External verification block
    if (bvn) {
      try {
        const verifyBVN = await axios.get("https://api.dojah.io/api/v1/kyc/bvn/full", {
          headers: {
            Authorization: `Bearer ${DOJAH_API_KEY}`,
            AppId: DOJAH_APP_ID,
          },
          params: { bvn },
        });

        const bvnData = verifyBVN.data.data;
        if (
          bvnData &&
          bvnData.first_name.toLowerCase() === client.fullName.split(" ")[0].toLowerCase()
        ) {
          const creditCheck = await axios.get("https://api.dojah.io/api/v1/credit/lookup", {
            headers: {
              Authorization: `Bearer ${DOJAH_API_KEY}`,
              AppId: DOJAH_APP_ID,
            },
            params: { bvn },
          });

          const creditData = creditCheck.data.data;
          creditScore = creditData.credit_score || 0;
          riskClass = creditData.risk_class || "Unknown";
          externalVerified = true;
        }
      } catch (err) {
        console.log("External verification failed.");
      }
    }
    // --------------------------------------------

    // Fallback internal scoring
    if (!externalVerified) {
      const accountAgeMonths = Math.max(
        (new Date() - new Date(client.onboardedAt)) / (1000 * 60 * 60 * 24 * 30), 1
      );
      const totalSavings = client.balance || 0;
      const withdrawalCount = client.withdrawals.length;
      const savingsBehavior = totalSavings / (withdrawalCount + 1);

      creditScore = Math.min(
        900,
        Math.floor((savingsBehavior / 1000) * 100 + accountAgeMonths * 20)
      );
      riskClass = creditScore > 750 ? "LOW" :
                  creditScore > 500 ? "MEDIUM" : "HIGH";
    }

    // ❌ NOT ELIGIBLE
    if (creditScore < 500 || riskClass === "HIGH") {
      return res.status(403).json({
        eligible: false,
        message: "You are not currently eligible for a loan. Please keep saving and try again in 30–60 days."
      });
    }

    // 🧮 LOAN CALCULATION
    const eligibleAmount = Math.min(amount, (creditScore / 900) * 500000);
    const interestRate = 0.06;
    const totalInterest = eligibleAmount * interestRate * months;
    const totalRepayment = eligibleAmount + totalInterest;

    // 🧮 MONTHLY INSTALLMENT BREAKDOWN
    const monthlyInstallment = Math.round(totalRepayment / months);

    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + months);

    // RETURN PREVIEW ONLY
    return res.json({
      eligible: true,
      message: "Loan offer available",
      preview: {
        approvedAmount: Math.round(eligibleAmount),
        monthlyInstallment,
        totalRepayment: Math.round(totalRepayment),
        months,
        dueDate: dueDate.toDateString()
      }
    });

  } catch (err) {
    console.error("Loan request error:", err);
    res.status(500).json({ message: "Server error." });
  }
});


router.post("/confirm", verifyJWT, async (req, res) => {
  try {
    const { approvedAmount, totalRepayment, months, dueDate, monthlyInstallment } = req.body;

    const existing = await Loan.findOne({
      clientId: req.clientId,
      status: { $in: ["pending", "approved", "unpaid"] }
    });

    if (existing) {
      return res.status(400).json({ message: "You already have an active loan." });
    }

    const loan = await Loan.create({
      clientId: req.clientId,
      amount: approvedAmount,
      approvedAmount,
      totalRepayment,
      durationInMonths: months,
      monthlyInstallment,
      dueDate,
      creditScore,
  riskClass,
  externalVerified,
      status: "pending"
    });

    res.json({ message: "Loan request submitted! Await approval.", loan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save loan." });
  }
});



// ✅ Get loan status for a logged-in client
router.get("/status", verifyJWT, async (req, res) => {
  try {
    const clientId = req.clientId;

    const activeLoan = await Loan.findOne({
      clientId,
      status: { $in: ["pending", "approved", "unpaid"] },
    }).sort({ createdAt: -1 });

    if (!activeLoan) {
      return res.json({ activeLoan: null, message: "No active loan found." });
    }

    res.json({
      activeLoan: {
        status: activeLoan.status,
        amount: activeLoan.amount,
        totalRepayment: activeLoan.totalRepayment,
        dueDate: activeLoan.dueDate,
        approvedAmount: activeLoan.approvedAmount,
        createdAt: activeLoan.createdAt,
      },
    });
  } catch (err) {
    console.error("Error fetching loan status:", err);
    res.status(500).json({ message: "Failed to fetch loan status." });
  }
});


module.exports = router;







/*
const express = require("express");
const router = express.Router();
const axios = require("axios");
const Loan = require("../models/Loan");
const Client = require("../models/Client");
const verifyJWT = require("../middleware/verifyJWT");

const DOJAH_API_KEY = process.env.DOJAH_API_KEY;
const DOJAH_APP_ID = process.env.DOJAH_APP_ID;

router.post("/request", verifyJWT, async (req, res) => {
  try {
    const { amount, bvn, nin, durationInMonths } = req.body;
    const client = await Client.findById(req.clientId);

    if (!client) return res.status(404).json({ message: "Client not found" });

    let creditScore = 0;
    let riskClass = "Unknown";
    let externalVerified = false;

    // ============= TRY EXTERNAL BVN/NIN VERIFICATION =============
    if (bvn) {
      try {
        const verifyBVN = await axios.get("https://api.dojah.io/api/v1/kyc/bvn/full", {
          headers: { Authorization: `Bearer ${DOJAH_API_KEY}`, AppId: DOJAH_APP_ID },
          params: { bvn }
        });

        const bvnData = verifyBVN.data.data;
        if (bvnData && bvnData.first_name.toLowerCase() === client.fullName.split(" ")[0].toLowerCase()) {
          // BVN verified, now fetch credit data
          const creditCheck = await axios.get("https://api.dojah.io/api/v1/credit/lookup", {
            headers: { Authorization: `Bearer ${DOJAH_API_KEY}`, AppId: DOJAH_APP_ID },
            params: { bvn }
          });

          const creditData = creditCheck.data.data;
          creditScore = creditData.credit_score || 0;
          riskClass = creditData.risk_class || "Unknown";
          externalVerified = true;
        }
      } catch (error) {
        console.warn("⚠️ BVN verification failed, using internal score.");
      }
    }

    // ============= INTERNAL CREDITWORTHINESS =============
    if (!externalVerified) {
      const accountAgeMonths = Math.max(
        (new Date() - new Date(client.onboardedAt)) / (1000 * 60 * 60 * 24 * 30),
        1
      );

      const totalSavings = client.balance || 0;
      const withdrawalCount = client.withdrawals.length;
      const savingsBehavior = totalSavings / (withdrawalCount + 1);

      // Simple internal credit scoring
      creditScore = Math.min(900, Math.floor((savingsBehavior / 1000) * 100 + accountAgeMonths * 20));
      riskClass = creditScore > 750 ? "LOW" : creditScore > 500 ? "MEDIUM" : "HIGH";
    }

    // ============= DETERMINE LOAN ELIGIBILITY =============
    const eligibleAmount = Math.min(amount, (creditScore / 900) * 500000); // cap eligibility
    const months = Math.max(0.25, Math.min(durationInMonths || 1, 6)); // min 7 days = 0.25 month
    const interestRate = 0.06; // 6% monthly
    const totalInterest = eligibleAmount * interestRate * months;
    const totalRepayment = eligibleAmount + totalInterest;

    // Compute due date
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + months);

    // ============= SAVE LOAN REQUEST =============
    const loan = new Loan({
      clientId: client._id,
      amount: eligibleAmount,
      requestedAmount: amount,
      interestRate,
      totalInterest,
      totalRepayment,
      durationInMonths: months,
      dueDate,
      creditScore,
      riskClass,
      bvn,
      nin,
      status: "pending"
    });

    await loan.save();

    // Save BVN to client if not saved
    if (bvn && !client.bvn) {
      client.bvn = bvn;
      await client.save();
    }

    res.json({
      message: externalVerified
        ? "Loan request submitted (verified externally). Await admin approval."
        : "Loan request submitted (based on internal credit scoring). Await admin approval.",
      loan,
    });
  } catch (err) {
    console.error("Loan request error:", err.response?.data || err.message);
    res.status(500).json({ message: "Error verifying creditworthiness." });
  }
});

module.exports = router;





/*const express = require("express");
const router = express.Router();
const axios = require("axios");
const Loan = require("../models/Loan");
const Client = require("../models/Client");
const verifyJWT = require("../middleware/verifyJWT");

const DOJAH_API_KEY = process.env.DOJAH_API_KEY;
const DOJAH_APP_ID = process.env.DOJAH_APP_ID;

// Request Loan
router.post("/request", verifyJWT, async (req, res) => {
  try {
    const { amount, bvn, nin } = req.body;
    const client = await Client.findById(req.clientId);

    if (!client) return res.status(404).json({ message: "Client not found" });

    // 🔹 Verify BVN details
    const verifyBVN = await axios.get(`https://api.dojah.io/api/v1/kyc/bvn/full`, {
      headers: { Authorization: `Bearer ${DOJAH_API_KEY}`, "AppId": DOJAH_APP_ID },
      params: { bvn }
    });

    const bvnData = verifyBVN.data.data;
    if (!bvnData || bvnData.first_name.toLowerCase() !== client.fullName.split(" ")[0].toLowerCase()) {
      return res.status(400).json({ message: "BVN verification failed. BVN does not match registered name." });
    }

    // 🔹 Fetch creditworthiness
    const creditCheck = await axios.get(`https://api.dojah.io/api/v1/credit/lookup`, {
      headers: { Authorization: `Bearer ${DOJAH_API_KEY}`, "AppId": DOJAH_APP_ID },
      params: { bvn }
    });

    const creditData = creditCheck.data.data;
    const creditScore = creditData.credit_score || 0;
    const riskClass = creditData.risk_class || "Unknown";

    // Save loan request
    const loan = new Loan({
      clientId: client._id,
      amount,
      bvn,
      nin,
      creditScore,
      riskClass,
      bureauReportId: creditData.report_id
    });

    await loan.save();

    // Save BVN to client if not saved
    if (!client.bvn) {
      client.bvn = bvn;
      await client.save();
    }

    res.json({
      message: "Loan request submitted successfully. Await admin approval.",
      loan
    });
  } catch (err) {
    console.error("Loan request error:", err.response?.data || err.message);
    res.status(500).json({ message: "Error verifying BVN or credit status." });
  }
});

module.exports = router;
*/