const express = require("express");
const router = express.Router();
const Loan = require("../models/Loan");
const Staff = require("../models/Staff");
const authAdmin = require("../middleware/authAdmin");
const ExcelJS = require("exceljs");

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

router.get("/staff/:staffId/defaulters", authAdmin, async (req, res) => {
  try {
    const { staffId } = req.params;

    const loans = await Loan.find({
      staffId,
      status: { $in: ["approved", "active"] }
    })
      .populate("clientId", "fullName phone")
      .select("installments approvedAmount");

    const defaulters = [];

    loans.forEach(loan => {
      loan.installments.forEach(inst => {
        if (
          inst.status === "unpaid" &&
          inst.dueDate &&
          new Date(inst.dueDate) < new Date()
        ) {
          const daysOverdue = Math.floor(
            (Date.now() - new Date(inst.dueDate)) / (1000 * 60 * 60 * 24)
          );

          defaulters.push({
            client: loan.clientId.fullName,
            phone: loan.clientId.phone,
            installmentAmount: inst.amount,
            dueDate: inst.dueDate,
            daysOverdue
          });
        }
      });
    });

    res.json(defaulters);
  } catch (err) {
    console.error("Defaulter drill error:", err);
    res.status(500).json({ message: "Failed to fetch defaulters" });
  }
});


router.get("/staff-analytics/export", authAdmin, async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Staff Loan Report");

  sheet.columns = [
    { header: "Staff Name", key: "name" },
    { header: "Loan Clients", key: "clients" },
    { header: "Total Given", key: "given" },
    { header: "Collected", key: "collected" },
    { header: "Remaining", key: "remaining" },
    { header: "Defaulters", key: "defaulters" },
    { header: "Today", key: "today" },
    { header: "This Week", key: "week" },
    { header: "This Month", key: "month" }
  ];

  const data = await getStaffAnalytics(); // reuse your analytics logic

  data.forEach(s => {
    sheet.addRow({
      name: s.staffName,
      clients: s.loanClients,
      given: s.totalGiven,
      collected: s.totalCollected,
      remaining: s.remaining,
      defaulters: s.defaulters,
      today: s.todayCollected,
      week: s.weekCollected,
      month: s.monthCollected
    });
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", "attachment; filename=staff-report.xlsx");

  await workbook.xlsx.write(res);
  res.end();
});


router.get("/kpis", authAdmin, async (req, res) => {
  try {
    const loans = await Loan.find({
      status: { $in: ["approved", "active", "paid"] }
    });

    let totalGiven = 0;
    let totalCollected = 0;
    let outstanding = 0;
    let defaulters = 0;

    let today = 0;
    let week = 0;
    let month = 0;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );

    loans.forEach(loan => {
      totalGiven += loan.approvedAmount || 0;
      outstanding += loan.remainingBalance || 0;

      loan.installments.forEach(inst => {
        if (inst.status === "paid") {
          totalCollected += inst.amount;

          if (inst.paidAt >= todayStart) today += inst.amount;
          if (inst.paidAt >= weekStart) week += inst.amount;
          if (inst.paidAt >= monthStart) month += inst.amount;
        }

        if (
          inst.status === "unpaid" &&
          new Date(inst.dueDate) < new Date()
        ) {
          defaulters++;
        }
      });
    });

    res.json({
      totalGiven,
      totalCollected,
      outstanding,
      defaulters,
      today,
      week,
      month
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load KPIs" });
  }
});


module.exports = router;
