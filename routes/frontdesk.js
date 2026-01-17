const express = require("express");
const router = express.Router();
//const verifyJWT = require("../middleware/verifyStaffJWT");
//const requireFrontDesk = require("../middleware/requireFrontDesk");
const Client = require("../models/Client");
const Loan = require("../models/Loan");
const Payment = require("../models/Payment");
//const Withdrawal = require("../models/Withdrawal");
const CallLog = require("../models/CallLog");

//router.use(verifyJWT, requireFrontDesk);


router.get("/clients/:id", async (req, res) => {
  const client = await Client.findById(req.params.id)
    .populate("loans")
    .populate("payments")
    //.populate("withdrawals");

  if (!client) return res.status(404).json({ message: "Client not found" });

  res.json({
    client: {
      id: client._id,
      name: client.fullName,
      phone: client.phone,
      balance: client.balance,
      savings: client.savings,
      onboardedAt: client.createdAt,
      loans: client.loans,
      payments: client.payments,
      //withdrawals: client.withdrawals
    }
  });
});


router.get("/disbursements", async (req, res) => {
  const payments = await Payment.find({ status: "approved" });
  //const withdrawals = await Withdrawal.find({ status: "approved" });

  res.json({ payments});
});

router.post("/disbursements/:id/treated", async (req, res) => {
  const { type } = req.body; // payment | withdrawal

  const Model = type === "payment" ? Payment : Withdrawal;
  const record = await Model.findById(req.params.id);

  if (!record) return res.status(404).json({ message: "Not found" });

  record.treatedByFrontDesk = true;
  record.treatedAt = new Date();
  await record.save();

  res.json({ message: "Marked as treated" });
});


router.get("/loan-defaulters", async (req, res) => {
  const today = new Date();

  const defaulters = await Loan.find({
    status: "approved",
    dueDate: { $lt: today }
  }).populate("clientId", "fullName phone");

  res.json(defaulters);
});


router.post("/calls/log", async (req, res) => {
  const { clientId, loanId, note, outcome } = req.body;

  const log = await CallLog.create({
    clientId,
    loanId,
    staffId: req.staff.id,
    note,
    outcome
  });

  res.json({ message: "Call logged", log });
});

router.get("/calls/daily", async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const count = await CallLog.countDocuments({
    staffId: req.staff.id,
    createdAt: { $gte: start }
  });

  res.json({ callsToday: count });
});

module.exports = router;