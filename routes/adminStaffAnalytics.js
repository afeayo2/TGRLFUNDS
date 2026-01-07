const express = require("express");
const router = express.Router();
const Loan = require("../models/Loan");
const Staff = require("../models/Staff");
const authAdmin = require("../middleware/authAdmin");

router.get("/staff-loan-analytics", authAdmin, async (req, res) => {
  try {
    const staffs = await Staff.find({}, "fullName phone");

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );

    const results = [];

    for (const staff of staffs) {
      const loans = await Loan.find({
        staffId: staff._id,
        status: { $in: ["approved", "active", "paid"] }
      }).populate("clientId", "_id");

      let totalGiven = 0;
      let totalCollected = 0;
      let remaining = 0;
      let defaulters = 0;

      let todayCollected = 0;
      let weekCollected = 0;
      let monthCollected = 0;

      const uniqueClients = new Set();

      loans.forEach(loan => {
        totalGiven += loan.approvedAmount || 0;
        remaining += loan.remainingBalance || 0;

        uniqueClients.add(String(loan.clientId?._id));

        loan.installments.forEach(inst => {
          if (inst.status === "paid") {
            totalCollected += inst.amount;

            if (inst.paidAt >= todayStart) {
              todayCollected += inst.amount;
            }
            if (inst.paidAt >= weekStart) {
              weekCollected += inst.amount;
            }
            if (inst.paidAt >= monthStart) {
              monthCollected += inst.amount;
            }
          }

          if (
            inst.status === "unpaid" &&
            new Date(inst.dueDate) < new Date()
          ) {
            defaulters++;
          }
        });
      });

      results.push({
        staffId: staff._id,
        staffName: staff.fullName,
        phone: staff.phone,

        loanClients: uniqueClients.size,
        totalLoans: loans.length,

        totalGiven,
        totalCollected,
        remaining,

        defaulters,

        todayCollected,
        weekCollected,
        monthCollected
      });
    }

    res.json(results);
  } catch (err) {
    console.error("Admin staff analytics error:", err);
    res.status(500).json({ message: "Failed to load staff analytics" });
  }
});

module.exports = router;
