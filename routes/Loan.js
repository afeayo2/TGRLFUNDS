const express = require("express");
const router = express.Router();
const axios = require("axios");

const Loan = require("../models/Loan");
const Client = require("../models/Client");
const verifyJWT = require("../middleware/verifyJWT");

const DOJAH_API_KEY = process.env.DOJAH_API_KEY;
const DOJAH_APP_ID = process.env.DOJAH_APP_ID;

/**
 * ============================
 * REQUEST LOAN (PREVIEW)
 * ============================
 */
router.post("/request", verifyJWT, async (req, res) => {
  try {
    const { amount, bvn, durationInMonths } = req.body;

    const client = await Client.findById(req.clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    // ❌ Prevent multiple active loans
    const existingLoan = await Loan.findOne({
      clientId: req.clientId,
      status: { $in: ["pending", "approved", "unpaid"] },
    });

    if (existingLoan) {
      return res.status(400).json({
        eligible: false,
        message: "You already have an active or pending loan.",
      });
    }

    // ✅ Enforce 3–6 months
    let months = Number(durationInMonths);
    if (months < 3) months = 3;
    if (months > 6) months = 6;

    let creditScore = 0;
    let riskClass = "Unknown";
    let externalVerified = false;

    /**
     * ============================
     * BVN / DOJAH VERIFICATION
     * ============================
     */
    if (bvn) {
      try {
        const verifyBVN = await axios.get(
          "https://api.dojah.io/api/v1/kyc/bvn/full",
          {
            headers: {
              Authorization: `Bearer ${DOJAH_API_KEY}`,
              AppId: DOJAH_APP_ID,
            },
            params: { bvn },
          }
        );

        const bvnData = verifyBVN.data?.data;

        if (
          bvnData &&
          bvnData.first_name?.toLowerCase() ===
            client.fullName.split(" ")[0].toLowerCase()
        ) {
          const creditCheck = await axios.get(
            "https://api.dojah.io/api/v1/credit/lookup",
            {
              headers: {
                Authorization: `Bearer ${DOJAH_API_KEY}`,
                AppId: DOJAH_APP_ID,
              },
              params: { bvn },
            }
          );

          creditScore = creditCheck.data?.data?.credit_score || 0;
          riskClass = creditCheck.data?.data?.risk_class || "Unknown";
          externalVerified = true;
        }
      } catch (err) {
        console.log("External verification failed, using internal scoring");
      }
    }

    /**
     * ============================
     * INTERNAL CREDIT SCORING
     * ============================
     */
    if (!externalVerified) {
      const accountAgeMonths = Math.max(
        (Date.now() - new Date(client.onboardedAt)) /
          (1000 * 60 * 60 * 24 * 30),
        1
      );

      const totalSavings = client.balance || 0;
      const withdrawalCount = client.withdrawals?.length || 0;
      const savingsBehavior = totalSavings / (withdrawalCount + 1);

      creditScore = Math.min(
        900,
        Math.floor((savingsBehavior / 1000) * 100 + accountAgeMonths * 20)
      );

      riskClass =
        creditScore > 750 ? "LOW" :
        creditScore > 500 ? "MEDIUM" :
        "HIGH";
    }

    // ❌ Not eligible
    if (creditScore < 500 || riskClass === "HIGH") {
      return res.status(403).json({
        eligible: false,
        message:
          "You are not eligible for a loan at this time. Please keep saving.",
      });
    }

    /**
     * ============================
     * LOAN CALCULATION
     * ============================
     */
    const eligibleAmount = Math.min(amount, (creditScore / 900) * 500000);

    const interestRate = 0.06; // 6% monthly
    const totalInterest = eligibleAmount * interestRate * months;
    const totalRepayment = Math.round(eligibleAmount + totalInterest);

    /**
     * ============================
     * WEEKLY INSTALLMENTS
     * ============================
     */
    const weeksPerMonth = 4;
    const totalWeeks = months * weeksPerMonth;

    const weeklyBase = Math.floor(totalRepayment / totalWeeks);
    let remaining = totalRepayment;

    const installments = [];
    let repaymentDate = new Date();
    repaymentDate.setDate(repaymentDate.getDate() + 7);

    for (let i = 1; i <= totalWeeks; i++) {
      let installmentAmount = weeklyBase;

      if (i === totalWeeks) {
        installmentAmount = remaining;
      }

      installments.push({
        week: i,
        amount: installmentAmount,
        dueDate: new Date(repaymentDate),
        day: repaymentDate.toLocaleDateString("en-US", {
          weekday: "long",
        }),
        status: "unpaid",
      });

      remaining -= installmentAmount;
      repaymentDate.setDate(repaymentDate.getDate() + 7);
    }

    const dueDate = installments[installments.length - 1].dueDate;
    const nextRepayment = installments[0];

    return res.json({
      eligible: true,
      message: "Loan offer available",
      preview: {
        approvedAmount: Math.round(eligibleAmount),
        interestRate: 6,
        repaymentType: "weekly",
        weeklyInstallment: weeklyBase,
        totalRepayment,
        duration: `${totalWeeks} weeks`,
        nextRepayment,
        dueDate,
        installments,
        creditScore,
        riskClass,
        externalVerified,
      },
    });
  } catch (err) {
    console.error("Loan request error:", err);
    res.status(500).json({ message: "Loan request failed" });
  }
});

/**
 * ============================
 * CONFIRM LOAN
 * ============================
 */
router.post("/confirm", verifyJWT, async (req, res) => {
  try {
    const client = await Client.findById(req.clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    const existingLoan = await Loan.findOne({
      clientId: req.clientId,
      status: { $in: ["pending", "approved", "unpaid"] }
    });

    if (existingLoan) {
      return res.status(400).json({ message: "You already have an active loan." });
    }

    const {
      approvedAmount,
      totalRepayment,
      installments,
      dueDate,
      creditScore,
      riskClass,
      externalVerified
    } = req.body;

    const loan = await Loan.create({
      clientId: req.clientId,
      staffId: client.staffId, // ✅ ASSIGNED STAFF
      approvedAmount,
      amount: approvedAmount,
      totalRepayment,
      durationInMonths: Math.ceil(installments.length / 4),
      installments,
      dueDate,
      creditScore,
      riskClass,
      externalVerified,

      staffReview: {
        decision: "pending"
      },

      status: "pending"
    });

    res.json({
      message: "Loan request submitted. Await staff and admin review.",
      loan
    });
  } catch (err) {
    console.error("Loan confirm error:", err);
    res.status(500).json({ message: "Failed to save loan" });
  }
});


/**
 * ============================
 * GET ACTIVE LOAN STATUS
 * ============================
 */
router.get("/status", verifyJWT, async (req, res) => {
  try {
    const activeLoan = await Loan.findOne({
      clientId: req.clientId,
      status: { $in: ["pending", "approved", "unpaid"] },
    }).sort({ createdAt: -1 });

    if (!activeLoan) {
      return res.json({
        activeLoan: null,
        message: "No active loan found.",
      });
    }

    res.json({
      activeLoan: {
        status: activeLoan.status,
        amount: activeLoan.amount,
        approvedAmount: activeLoan.approvedAmount,
        totalRepayment: activeLoan.totalRepayment,
        dueDate: activeLoan.dueDate,
        createdAt: activeLoan.createdAt,
      },
    });
  } catch (err) {
    console.error("Loan status error:", err);
    res.status(500).json({ message: "Failed to fetch loan status." });
  }
});

module.exports = router;
