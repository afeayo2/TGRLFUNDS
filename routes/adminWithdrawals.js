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
 /* =====================================================
 * ✅ GET ALL WITHDRAWALS (ADMIN)
 * Pagination + Filters + Sorted by Date
 * =====================================================
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
      maxAmount
    } = req.query;

    page = Number(page);
    limit = Number(limit);

    const match = {};

    if (status) match["withdrawals.status"] = status;
    if (startDate) match["withdrawals.date"] = { $gte: new Date(startDate) };
    if (endDate)
      match["withdrawals.date"] = {
        ...match["withdrawals.date"],
        $lte: new Date(endDate)
      };
    if (minAmount) match["withdrawals.amount"] = { $gte: Number(minAmount) };
    if (maxAmount)
      match["withdrawals.amount"] = {
        ...match["withdrawals.amount"],
        $lte: Number(maxAmount)
      };

    const pipeline = [
      { $unwind: "$withdrawals" },
      { $match: match },
      {
        $project: {
          withdrawalId: "$withdrawals._id",
          clientId: "$_id",
          fullName: 1,
          phone: 1,
          email: 1,
          balance: 1,
          amount: "$withdrawals.amount",
          bankName: "$withdrawals.bankName",
          accountNumber: "$withdrawals.accountNumber",
          status: "$withdrawals.status",
          date: "$withdrawals.date"
        }
      },
      { $sort: { date: -1 } },
      {
        $facet: {
          data: [
            { $skip: (page - 1) * limit },
            { $limit: limit }
          ],
          total: [{ $count: "count" }]
        }
      }
    ];

    const result = await Client.aggregate(pipeline);

    const withdrawals = result[0].data;
    const total = result[0].total[0]?.count || 0;

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      withdrawals
    });

  } catch (err) {
    console.error("Error fetching withdrawals:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/**
 * =====================================================
 * ✅ GET SINGLE WITHDRAWAL DETAILS (ADMIN)
 * =====================================================
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
      date: withdrawal.date,
    });

  } catch (err) {
    console.error("Error fetching withdrawal:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/**
 * ✅ APPROVE WITHDRAWAL
 */
router.post("/:withdrawalId/approve", authAdmin, async (req, res) => {
  try {
    const { withdrawalId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(withdrawalId)) {
      return res.status(400).json({ message: "Invalid withdrawal ID" });
    }

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

    // ✅ SINGLE place balance is deducted
    client.balance -= withdrawal.amount;
    withdrawal.status = "approved";

    await client.save();

    res.json({
      message: "Withdrawal approved successfully",
      withdrawalId,
      newBalance: client.balance
    });

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













