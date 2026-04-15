const mongoose = require("mongoose");
const installmentSchema = new mongoose.Schema({
  week: Number,
  amount: Number,
  dueDate: Date,
  day: String,
  status: {
    type: String,
    enum: ["paid", "unpaid"],
    default: "unpaid"
  },
  paidAt: Date
});

const loanSchema = new mongoose.Schema(
  {
    /* ================= CLIENT & STAFF ================= */
    clientId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Client",
  default: null // ✅ allow manual loans
},

    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true
    },

    /* ================= MANUAL LOAN SUPPORT ================= */

    loanSource: {
      type: String,
      enum: ["app", "manual"],
      default: "app"
    },

    clientName: String,
    phoneNumber: String,

    repaymentPlan: {
      type: String,
      enum: ["daily", "weekly", "monthly"]
    },

    dateDisbursed: Date,

    amountPaid: {
      type: Number,
      default: 0
    },

    balance: Number,

    nextDueDate: Date,

    rmResponsible: String,
    /* ================= LOAN DETAILS ================= */
    requestedAmount: {
      type: Number,
      required: true
    },

    approvedAmount: Number,

    interestRate: Number,
    totalInterest: Number,
    totalRepayment: Number,
    durationInMonths: Number,

    dueDate: Date,

    /* ================= CREDIT ================= */
    creditScore: Number,
    riskClass: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"]
    },
    installments: [installmentSchema], // ✅ REQUIRED

    externalVerified: Boolean,
    bvnUsed: String,

    bvn: String,
    nin: String,

    /* ================= STAFF ADVISORY REVIEW ================= */
    staffReview: {
      decision: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending"
      },
      note: {
        type: String,
        trim: true
      },
      reviewedAt: Date
    },
    /* ================= ADMIN FINAL DECISION ================= */
    adminNote: String,
    approvedAt: Date,
    adminId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Admin"
},
    financialProfile: {
      creditScore: Number,
      riskClass: String,
      totalOutstandingLoans: Number,
      activeLoanCount: Number,
      monthlyRepayment: Number,
      totalDefaults: Number,
      estimatedIncome: Number,
      pulledAt: Date,
      pulledBy: String
    },

payments: [
  {
    amount: Number,

    method: {
      type: String,
      enum: ["card", "cash"]
    },

    installmentWeek: Number,

    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff"
    },

    // ✅ OPTIONAL NOW
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null
    },

    // ✅ FOR MANUAL LOANS
    clientName: String,
    phoneNumber: String,

    paidBy: {
      type: String,
      enum: ["client", "staff"]
    },

    reference: String,

    paidAt: {
      type: Date,
      default: Date.now
    }
  }
],

 status: {
      type: String,
      enum: ["pending", "approved", "rejected", "paid", "active"],
      default: "pending"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Loan", loanSchema);
