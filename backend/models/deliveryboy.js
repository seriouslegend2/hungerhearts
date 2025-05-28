import mongoose from "mongoose";
import bcrypt from "bcrypt";

const deliveryBoySchema = new mongoose.Schema(
    {
        deliveryBoyName: { type: String, required: true, unique: true },
        mobileNumber: { type: String, required: true },
        password: { type: String, required: true },
        vehicleNo: { type: String, required: true },
        drivingLicenseNo: { type: String, required: true },
        currentLocation: {
            type: { type: String, enum: ["Point"], required: true },
            coordinates: { type: [Number], required: true }, // Array of numbers
        },
        status: {
            type: String,
            enum: ["available", "on-going", "inactive"],
            default: "available",
        }, // Added status field
        deliveredOrders: { type: Number, default: 0 }, // New field to track number of delivered orders
    },
    { timestamps: true }
);

// Define indexes before model creation
deliveryBoySchema.index({ deliveryBoyName: 1 }, { unique: true });
deliveryBoySchema.index({ mobileNumber: 1 });
deliveryBoySchema.index({ vehicleNo: 1 });
deliveryBoySchema.index({ drivingLicenseNo: 1 });
deliveryBoySchema.index({ status: 1 });
deliveryBoySchema.index({ deliveredOrders: -1 });
deliveryBoySchema.index({ currentLocation: "2dsphere" });
deliveryBoySchema.index({ createdAt: -1 }); // For sorting by creation time

deliveryBoySchema.pre("save", async function (next) {
    const user = this;
    if (!user.isModified("password")) return next();
    try {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        user.password = hashedPassword;
        next();
    } catch (error) {
        return next(error);
    }
});

export const DeliveryBoy = mongoose.model("DeliveryBoy", deliveryBoySchema);
