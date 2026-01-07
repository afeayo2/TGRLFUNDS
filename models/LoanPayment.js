const mongoose = require("mongoose");

const loanPaymentSchema = new mongoose.Schema({
  loanId: { type: mongoose.Schema.Types.ObjectId, ref: "Loan", required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },

  amount: Number,
  method: { type: String, enum: ["card", "cash"], required: true },

  installmentWeek: Number,

  reference: String,
  status: { type: String, enum: ["pending", "success", "failed"], default: "pending" }
}, { timestamps: true });

module.exports = mongoose.model("LoanPayment", loanPaymentSchema);
