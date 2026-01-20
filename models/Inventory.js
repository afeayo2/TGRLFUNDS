const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    assetType: {
      type: String,
      enum: ["phone", "laptop", "tablet", "sim"],
      required: true
    },

    brand: String,
    model: String,
    serialNumber: String,
    imei: String,
    simNumber: String,
    network: String,

    assignedToType: {
      type: String,
      enum: ["Staff", "Client", "none"],
      default: "none"
    },

    assignedToId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "assignedToType"
    },


    condition: {
      type: String,
      enum: ["active", "faulty", "lost", "damaged", "retired"],
      default: "active"
    },

    remarks: String,
    assignedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("Inventory", inventorySchema);
