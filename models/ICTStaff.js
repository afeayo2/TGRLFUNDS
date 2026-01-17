const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ictStaffSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    role: {
      type: String,
      default: "ict",
      enum: ["ict", "super-ict"]
    },

    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

/* Hash password */
ictStaffSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

module.exports = mongoose.model("ICTStaff", ictStaffSchema);
