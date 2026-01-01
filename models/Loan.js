const mongoose = require("mongoose");

const loanSchema = new mongoose.Schema(
  {
    /* ================= CLIENT & STAFF ================= */
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true
    },

    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true
    },

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

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "paid"],
      default: "pending"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Loan", loanSchema);
