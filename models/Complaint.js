const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FrontDesk",
      required: true
    },
    title: String,
    description: String,
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open"
    },
    resolvedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("Complaint", complaintSchema);