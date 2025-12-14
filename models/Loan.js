
const mongoose = require("mongoose");

const loanSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
  requestedAmount: Number,
  amount: Number,
  interestRate: Number,
  totalInterest: Number,
  totalRepayment: Number,
  durationInMonths: Number,
  dueDate: Date,
  creditScore: Number,
  riskClass: String,
  creditScore: Number,
riskClass: String,
externalVerified: Boolean,
bvnUsed: String,
  bvn: String,
  nin: String,
  status: { type: String, enum: ["pending", "approved", "rejected", "paid"], default: "pending" },
}, { timestamps: true });

module.exports = mongoose.model("Loan", loanSchema);







/*const mongoose = require("mongoose");

const loanSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ["pending", "approved", "rejected", "disbursed", "repaid", "defaulted"], default: "pending" },
  bvn: { type: String, required: true },
  nin: { type: String },
  creditScore: { type: Number },
  riskClass: { type: String },
  bureauReportId: { type: String },
  dueDate: { type: Date },
  requestedAt: { type: Date, default: Date.now },
  approvedAt: { type: Date },
  repaidAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model("Loan", loanSchema);
*/
