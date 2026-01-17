const mongoose = require("mongoose");

const callLogSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
  loanId: { type: mongoose.Schema.Types.ObjectId, ref: "Loan" },
  note: String,
  outcome: {
    type: String,
    enum: ["answered", "no-answer", "promised-to-pay", "wrong-number"]
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("CallLog", callLogSchema);
