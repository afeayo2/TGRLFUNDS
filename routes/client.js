const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const upload = require("../middleware/upload");
const Client = require("../models/Client");
const verifyJWT = require("../middleware/verifyJWT");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const Payment = require("../models/Payment");
const Loan = require("../models/Loan");
const LoanRepayment = require("../models/LoanPayment");




// Register new client
router.post(
  "/register-client",
  upload.fields([
    { name: "passportPhoto", maxCount: 1 },
    { name: "faceCapture", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { body, files } = req;

      const existingClient = await Client.findOne({ phone: body.phone });
      if (existingClient) {
        return res
          .status(409)
          .send("Client with this phone number already exists.");
      }

      const hashedPassword = await bcrypt.hash(body.password, 10);

      const newClient = new Client({
        fullName: body.fullName,
        dateOfBirth: body.dateOfBirth,
        gender: body.gender,
        maritalStatus: body.maritalStatus,
        phone: body.phone,
        email: body.email,
        password: hashedPassword,
        address: {
          street: body.street,
          city: body.city,
          lga: body.lga,
          state: body.state,
          landmark: body.landmark,
        },
        idType: body.idType,
        idNumber: body.idNumber,
     passportUrl: files.passportPhoto?.[0]?.secure_url || "",
faceUrl: files.faceCapture?.[0]?.secure_url || "",
        bvn: body.bvn,
        savings: {
          type: body.savingsType,
          days: body.collectionDays,
          targetAmount: body.targetAmount,
          duration: body.duration,
          method: body.collectionMethod,
        },
        nextOfKin: {
          fullName: body.kinFullName,
          relationship: body.kinRelationship,
          phone: body.kinPhone,
          address: body.kinAddress,
        },
      });

      await newClient.save();
      res.status(201).send("Client registered successfully!");
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error while registering client.");
    }
  }
);

// POST: Login client

router.post("/login", async (req, res) => {
  const { phone, password } = req.body;
  try {
    const client = await Client.findOne({ phone });
    if (!client) return res.status(401).json({ error: "Client not found." });

    const isMatch = await bcrypt.compare(password, client.password);
    if (!isMatch) return res.status(401).json({ error: "Incorrect password." });

    // Create JWT
    const token = jwt.sign({ clientId: client._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.status(200).json({ token, clientId: client._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed. Server error." });
  }
});


router.get("/dashboard/:id", verifyJWT, async (req, res) => {
  if (req.clientId !== req.params.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const client = await Client.findById(req.params.id).lean();
    if (!client) return res.status(404).json({ error: "Client not found" });

    // Savings (Paystack)
    const payments = await Payment.find({ clientId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();

    // Withdrawals (embedded)
    const withdrawals = (client.withdrawals || []).map(w => ({
      ...w,
      type: "withdrawal"
    }));

    // ✅ Loans (ONLY disbursed)
    const loans = await Loan.find({
      clientId: req.params.id,
      status: "disbursed"
    }).lean();

    // ✅ Loan repayments
    const loanRepayments = await LoanRepayment.find({
      clientId: req.params.id
    }).lean();

    res.json({
      fullName: client.fullName,
      balance: client.balance,
      faceUrl: client.faceUrl || "",
      payments,
      withdrawals,
      loans,
      loanRepayments
    });

  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/*
// POST: Make online payment (simplified)
router.post("/pay", verifyJWT, async (req, res) => {
  const { amount, email } = req.body;

  const client = await Client.findById(req.clientId);
  if (!client) return res.status(404).send("Client not found");

  try {
    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: Number(amount) * 100,
        metadata: { clientId: client._id },
        callback_url: "https://trustgolden.com.ng/client/verify-payment",
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({ url: paystackRes.data.data.authorization_url });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Payment initialization failed");
  }
})*/

router.post("/pay", verifyJWT, async (req, res) => {
  const { amount, email } = req.body;

  const client = await Client.findById(req.clientId);
  if (!client) return res.status(404).send("Client not found");

  try {
    const rawAmount = Number(amount);

    // Paystack charge
    let charge = rawAmount * 0.015 + 100;
    if (charge > 2000) charge = 2000;

    const totalAmount = rawAmount + charge;

    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: Math.round(totalAmount * 100),
        metadata: {
          clientId: client._id,
          originalAmount: rawAmount,
          charge: charge
        },
        callback_url: "https://golden-funds.onrender.com/client/verify-payment",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      url: paystackRes.data.data.authorization_url,
      totalAmount,
      charge
    });

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Payment initialization failed");
  }
});


// Get client info (used for payment email)
router.get("/client/:id", verifyJWT, async (req, res) => {
  const { id } = req.params;
  try {
    const client = await Client.findById(id).select("phone email"); // Keep it minimal
    if (!client) return res.status(404).send("Client not found");
    res.json(client);
  } catch (err) {
    res.status(500).send("Server error");
  }
});


router.get("/verify-payment", async (req, res) => {
  const { reference } = req.query;
  if (!reference) return res.status(400).send("Missing reference");

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = response.data.data;

    if (data.status !== "success") {
      return res.status(400).send("Payment not successful");
    }

    const clientId = data.metadata?.clientId;
    const totalPaid = data.amount / 100;
    const originalAmount = data.metadata?.originalAmount;
    const charge = data.metadata?.charge;

    const client = await Client.findById(clientId);
    if (!client) return res.status(404).send("Client not found");

    const exists = await Payment.findOne({ reference });
    if (!exists) {
      const payment = new Payment({
        clientId,
        amount: originalAmount,
        method: "card",
        totalPaid,
        reference,
        charge
      });

      await payment.save();

      client.balance =
        Number(client.balance || 0) + Number(originalAmount);

      await client.save();
    }

    // Redirect to dashboard
    res.redirect(`https://trustgolden.com.ng/dashboard.html`);
  } catch (err) {
    console.error("Verification failed:", err.response?.data || err.message);
    res.status(500).send("Payment verification failed");
  }
});

// POST: Withdrawal Request (CLIENT)
router.post("/withdraw", verifyJWT, async (req, res) => {
  try {
    const { clientId, amount, bankName, accountNumber } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).send("Invalid withdrawal amount");
    }

    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).send("Client not found");
    }

    // ✅ Check available balance ONLY
    if (Number(client.balance) < Number(amount)) {
      return res.status(400).send("❌ Insufficient funds.");
    }

    // ❌ DO NOT deduct balance here
    client.withdrawals.push({
      amount: Number(amount),
      bankName,
      accountNumber,
      status: "pending",
      createdAt: new Date(),
    });

    await client.save();

    res.json({
      message: `✅ ₦${amount} withdrawal request submitted and pending approval.`,
      status: "pending",
    });

  } catch (err) {
    console.error("Withdrawal request error:", err);
    res.status(500).send("Server error");
  }
});


// routes/client.js
router.get("/profile", verifyJWT, async (req, res) => {
  try {
    const client = await Client.findById(req.clientId).select("fullName phone email address faceUrl"

    );

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    res.json(client);
  } catch (err) {
    console.error("PROFILE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});



/*
// Get payments by client ID
router.get('/payments/:clientId', async (req, res) => {
  const payments = await Payment.find({ clientId: req.params.clientId }).sort({ createdAt: -1 }).limit(5);
  res.json(payments);
});

// Get withdrawals by client ID
router.get('/withdrawals/:clientId', async (req, res) => {
  const withdrawals = await Withdrawal.find({ clientId: req.params.clientId }).sort({ createdAt: -1 }).limit(5);
  res.json(withdrawals);
});
*/

router.get("/test", (req, res) => {
  res.send("welcome he dey work");
});

module.exports = router;
