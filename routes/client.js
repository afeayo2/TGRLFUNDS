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
  console.log("Dashboard route: ", req.clientId, req.params.id);

  if (req.clientId !== req.params.id) {
    console.warn("Client ID mismatch");
    return res.status(403).json({ error: "Forbidden. Token doesn't match client." });
  }

  try {
    const client = await Client.findById(req.params.id).lean(); // lean() is optional but faster
    if (!client) return res.status(404).json({ error: "Client not found" });

    // Fetch recent payments from the separate Payment model
    const payments = await Payment.find({ clientId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Get recent withdrawals from embedded array (in client document)
    const withdrawals = (client.withdrawals || [])
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    const responseData = {
      fullName: client.fullName,
      balance: client.balance,
      payments,
      withdrawals,
      faceUrl: client.faceUrl || "",
    };

    //console.log("Dashboard response:", responseData);
    res.json(responseData);
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

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
        callback_url: "https://golden-funds.onrender.com/verify-payment",
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
    const amount = data.amount / 100;

    const client = await Client.findById(clientId);
    if (!client) return res.status(404).send("Client not found");

    const exists = await Payment.findOne({ reference });
    if (!exists) {
      const payment = new Payment({
        clientId,
        amount,
        method: "Paystack",
        reference,
      });

      await payment.save();

      client.balance += amount;
      await client.save();
    }

    // Redirect to dashboard
    res.redirect(`https://trustgoldethrift.onrender.com/dashboard.html`);
  } catch (err) {
    console.error("Verification failed:", err.response?.data || err.message);
    res.status(500).send("Payment verification failed");
  }
});


// POST: Withdrawal Request
router.post("/withdraw", verifyJWT, async (req, res) => {
  const { clientId, amount, bankName, accountNumber } = req.body;
  const client = await Client.findById(clientId);
  if (!client) return res.status(404).send("Client not found");

  if (client.balance < amount) {
    return res.send("❌ Insufficient funds.");
  }

  client.balance -= amount;

  client.withdrawals.push({
    amount,
    bankName,
    accountNumber,
    status: "pending",
     createdAt: new Date()
  });

  await client.save();
  res.send(`✅ ₦${amount} will be sent to your account within 24 hours.`);
});

// routes/client.js
router.get("/profile", verifyJWT, async (req, res) => {
  try {
    const client = await Client.findById(req.clientId).select(
      "fullName phone email address"
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
