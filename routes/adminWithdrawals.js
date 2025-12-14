const express = require("express");
const router = express.Router();
const Client = require("../models/Client");
const authAdmin = require("../middleware/authAdmin");
const mongoose = require("mongoose");

/**
 * ✅ GET ALL WITHDRAWALS (ADMIN)
 * ✅ Pagination + Filters
 *
 * Query Params:
 * - page (default 1)
 * - limit (default 10)
 * - status (pending | approved | rejected)
 * - startDate, endDate
 * - minAmount, maxAmount
 */
router.get("/", authAdmin, async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      status,
      startDate,
      endDate,
      minAmount,
      maxAmount,
    } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    const clients = await Client.find()
      .select("fullName phone email balance withdrawals")
      .lean();

    let withdrawals = [];

    clients.forEach(client => {
      client.withdrawals?.forEach(w => {
        withdrawals.push({
          withdrawalId: w._id,
          clientId: client._id,
          fullName: client.fullName,
          phone: client.phone,
          email: client.email,
          balance: client.balance,
          amount: w.amount,
          bankName: w.bankName,
          accountNumber: w.accountNumber,
          status: w.status,
          date: w.date
        });
      });
    });

    // ✅ FILTERS
    if (status) {
      withdrawals = withdrawals.filter(w => w.status === status);
    }

    if (startDate) {
      withdrawals = withdrawals.filter(w => new Date(w.date) >= new Date(startDate));
    }

    if (endDate) {
      withdrawals = withdrawals.filter(w => new Date(w.date) <= new Date(endDate));
    }

    if (minAmount) {
      withdrawals = withdrawals.filter(w => w.amount >= Number(minAmount));
    }

    if (maxAmount) {
      withdrawals = withdrawals.filter(w => w.amount <= Number(maxAmount));
    }

    const total = withdrawals.length;

    // ✅ PAGINATION
    const start = (page - 1) * limit;
    const paginated = withdrawals.slice(start, start + limit);

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      withdrawals: paginated
    });

  } catch (err) {
    console.error("Error fetching withdrawals:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * ✅ GET SINGLE WITHDRAWAL DETAILS
 */
router.get("/:withdrawalId", authAdmin, async (req, res) => {
  try {
    const { withdrawalId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(withdrawalId)) {
      return res.status(400).json({ message: "Invalid withdrawal ID" });
    }

    const client = await Client.findOne({ "withdrawals._id": withdrawalId })
      .select("fullName phone email balance withdrawals");

    if (!client) {
      return res.status(404).json({ message: "Withdrawal not found" });
    }

    const withdrawal = client.withdrawals.id(withdrawalId);

    res.json({
      withdrawalId: withdrawal._id,
      clientId: client._id,
      fullName: client.fullName,
      phone: client.phone,
      email: client.email,
      balance: client.balance,
      amount: withdrawal.amount,
      bankName: withdrawal.bankName,
      accountNumber: withdrawal.accountNumber,
      status: withdrawal.status,
      date: withdrawal.date
    });

  } catch (err) {
    console.error("Error fetching withdrawal details:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * ✅ APPROVE WITHDRAWAL
 */
router.post("/:withdrawalId/approve", authAdmin, async (req, res) => {
  try {
    const { withdrawalId } = req.params;

    const client = await Client.findOne({ "withdrawals._id": withdrawalId });

    if (!client) {
      return res.status(404).json({ message: "Withdrawal not found" });
    }

    const withdrawal = client.withdrawals.id(withdrawalId);

    if (withdrawal.status !== "pending") {
      return res.status(400).json({ message: "Withdrawal is not pending" });
    }

    if (client.balance < withdrawal.amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    client.balance -= withdrawal.amount;
    withdrawal.status = "approved";
    await client.save();

    res.json({ message: "Withdrawal approved successfully" });

  } catch (err) {
    console.error("Error approving withdrawal:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * ✅ REJECT WITHDRAWAL
 */
router.post("/:withdrawalId/reject", authAdmin, async (req, res) => {
  try {
    const { withdrawalId } = req.params;

    const client = await Client.findOne({ "withdrawals._id": withdrawalId });

    if (!client) {
      return res.status(404).json({ message: "Withdrawal not found" });
    }

    const withdrawal = client.withdrawals.id(withdrawalId);

    if (withdrawal.status !== "pending") {
      return res.status(400).json({ message: "Withdrawal is not pending" });
    }

    withdrawal.status = "rejected";
    await client.save();

    res.json({ message: "Withdrawal rejected successfully" });

  } catch (err) {
    console.error("Error rejecting withdrawal:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;














/*

// routes/adminWithdrawals.js
const express = require("express");
const Client = require("../models/Client");
const authAdmin = require("../middleware/authAdmin"); 
const router = express.Router();

// Get all pending withdrawals
router.get("/pending", authAdmin, async (req, res) => {
  try {
    // Find all clients that have pending withdrawals
    const clients = await Client.find({ "withdrawals.status": "pending" })
      .select("fullName phone email balance withdrawals");

    // Flatten pending withdrawals for admin list
    const pendingList = [];
    clients.forEach(client => {
      client.withdrawals.forEach(w => {
        if (w.status === "pending") {
          pendingList.push({
            withdrawalId: w._id,
            clientId: client._id,
            fullName: client.fullName,
            phone: client.phone,
            email: client.email,
            balance: client.balance,
            amount: w.amount,
            bankName: w.bankName,
            accountNumber: w.accountNumber,
            date: w.date
          });
        }
      });
    });

    res.json(pendingList);
  } catch (err) {
    console.error("Error fetching pending withdrawals:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// Get single withdrawal details
router.get("/:withdrawalId", authAdmin, async (req, res) => {
  try {
    const { withdrawalId } = req.params;

    const client = await Client.findOne({ "withdrawals._id": withdrawalId })
      .select("fullName phone email balance withdrawals");

    if (!client) {
      return res.status(404).json({ message: "Withdrawal not found" });
    }

    const withdrawal = client.withdrawals.id(withdrawalId);

    res.json({
      withdrawalId: withdrawal._id,
      clientId: client._id,
      fullName: client.fullName,
      phone: client.phone,
      email: client.email,
      balance: client.balance,
      amount: withdrawal.amount,
      bankName: withdrawal.bankName,
      accountNumber: withdrawal.accountNumber,
      status: withdrawal.status,
      date: withdrawal.date
    });
  } catch (err) {
    console.error("Error fetching withdrawal details:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// Approve withdrawal
router.post("/:withdrawalId/approve", authAdmin, async (req, res) => {
  try {
    const { withdrawalId } = req.params;

    const client = await Client.findOne({ "withdrawals._id": withdrawalId });

    if (!client) {
      return res.status(404).json({ message: "Withdrawal not found" });
    }

    const withdrawal = client.withdrawals.id(withdrawalId);

    if (withdrawal.status !== "pending") {
      return res.status(400).json({ message: "Withdrawal is not pending" });
    }

    // Deduct from balance
    if (client.balance < withdrawal.amount) {
      return res.status(400).json({ message: "Insufficient balance for approval" });
    }
    client.balance -= withdrawal.amount;

    withdrawal.status = "approved";
    await client.save();

    res.json({ message: "Withdrawal approved successfully", withdrawal });
  } catch (err) {
    console.error("Error approving withdrawal:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Reject withdrawal
router.post("/:withdrawalId/reject", authAdmin, async (req, res) => {
  try {
    const { withdrawalId } = req.params;

    const client = await Client.findOne({ "withdrawals._id": withdrawalId });

    if (!client) {
      return res.status(404).json({ message: "Withdrawal not found" });
    }

    const withdrawal = client.withdrawals.id(withdrawalId);

    if (withdrawal.status !== "pending") {
      return res.status(400).json({ message: "Withdrawal is not pending" });
    }

    withdrawal.status = "rejected";
    await client.save();

    res.json({ message: "Withdrawal rejected successfully", withdrawal });
  } catch (err) {
    console.error("Error rejecting withdrawal:", err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
*/