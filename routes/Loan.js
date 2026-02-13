const express = require("express");
const router = express.Router();
const axios = require("axios");

const Loan = require("../models/Loan");
const Client = require("../models/Client");
const verifyJWT = require("../middleware/verifyJWT");
const LoanPayment = require("../models/LoanPayment");

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
    if (externalVerified) {
      client.bvn = bvn;
      await client.save();
    }

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

    const interestRate = 0.08; // 8% monthly
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
        interestRate: 8,
        repaymentType: "weekly",
        weeklyInstallment: weeklyBase,
        totalRepayment,
        duration: `${totalWeeks} weeks`,
        nextRepayment,
        requestedAmount: amount,
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
      requestedAmount,
      externalVerified
    } = req.body;

    const loan = await Loan.create({
        clientId: req.clientId,
        staffId: client.staffId,

        bvn: client.bvn, // ✅ ADD THIS
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
      requestedAmount,
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
    const loan = await Loan.findOne({
      clientId: req.clientId,
      status: { $in: ["pending","approved", "active"] }
    }).sort({ createdAt: -1 });

    if (!loan) {
      return res.json({ activeLoan: null });
    }

    const installments = loan.installments || [];
    const nextInstallment = installments.find(
      inst => inst.status === "unpaid"
    );

    res.json({
      activeLoan: {
        _id: loan._id,
        totalRepayment: loan.totalRepayment,
        approvedAmount: loan.approvedAmount,
        durationInMonths: loan.durationInMonths,
        status: loan.status,

        // ✅ FIX
        installments,
        nextInstallment,

        totalInstallments: installments.length,
        paidInstallments: installments.filter(i => i.status === "paid").length
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch loan status" });
  }
});



router.post("/pay/card/initiate", verifyJWT, async (req, res) => {
  try {
    const client = await Client.findById(req.clientId);

    const loan = await Loan.findOne({
      clientId: req.clientId,
      status: { $in: ["approved", "active"] }
    });

    if (!loan) {
      return res.status(404).json({ message: "No active loan" });
    }

    const installment = loan.installments.find(i => i.status === "unpaid");
    if (!installment) {
      return res.json({ message: "All installments paid" });
    }

    const payment = await LoanPayment.create({
      loanId: loan._id,
      clientId: client._id,
      amount: installment.amount,
      installmentWeek: installment.week,
      method: "card",
      paidBy: "client"
    });

    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: client.email || `${client.phone}@pacesave.com`,
        amount: installment.amount * 100,
        reference: payment._id.toString(),
        callback_url: `${process.env.BASE_URL}/loan/pay/card/verify`
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    res.json({
      authorization_url: paystackRes.data.data.authorization_url
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Payment initiation failed" });
  }
});



router.get("/pay/card/verify", async (req, res) => {
  try {
    const reference = req.query.reference || req.query.trxref;

    if (!reference) {
      return res.redirect(`${process.env.FRONTEND_URL}/payment-failed.html`);
    }

    // 1️⃣ Verify with Paystack
    const verify = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    if (verify.data.data.status !== "success") {
      return res.redirect(`${process.env.FRONTEND_URL}/payment-failed.html`);
    }

    // 2️⃣ Fetch payment using reference
    const payment = await LoanPayment.findById(reference);
    if (!payment) {
      return res.redirect(`${process.env.FRONTEND_URL}/payment-failed.html`);
    }

    // 3️⃣ Fetch loan
    const loan = await Loan.findById(payment.loanId);
    if (!loan) {
      return res.redirect(`${process.env.FRONTEND_URL}/payment-failed.html`);
    }

    // 4️⃣ Mark installment as paid
    const installment = loan.installments.find(
      i => i.week === payment.installmentWeek
    );

    if (installment && installment.status !== "paid") {
      installment.status = "paid";
      installment.paidAt = new Date();
    }

    // 5️⃣ Update loan status
    loan.status = loan.installments.every(i => i.status === "paid")
      ? "paid"
      : "active";

    payment.status = "success";
    payment.reference = reference;

    await loan.save();
    await payment.save();

    return res.redirect(`${process.env.FRONTEND_URL}/payment-success.html`);

  } catch (err) {
    console.error("Verify error:", err);
    return res.redirect(`${process.env.FRONTEND_URL}/payment-failed.html`);
  }
});



module.exports = router;
