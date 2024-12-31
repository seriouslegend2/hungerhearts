import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const donorSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  address: {
    doorNo: { type: String, required: true },
    street: { type: String, required: true },
    landmarks: { type: String },
    townCity: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  mobileNumber: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isBanned: { type: Boolean, default: false },
  donationsCount: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  rating: { type: Number, default: 0 }, // Store the rating directly
});

// Pre-save hook to hash the password
donorSchema.pre('save', async function (next) {
  const donor = this;
  if (!donor.isModified('password')) return next();
  try {
    const hashedPassword = await bcrypt.hash(donor.password, 10);
    donor.password = hashedPassword;
    next();
  } catch (error) {
    return next(error);
  }
});

// Method to calculate and update donor rating
donorSchema.methods.updateRating = function () {
  const maxDonations = this.donationsCount; // Example, the max number of donations that gives a full rating of 5
  let rating = this.donationsCount / maxDonations * 5; // Normalize and scale

  this.rating = Math.min(rating, 5); // Cap rating at 5
  return this.save(); // Save the updated rating
};

export const Donor = mongoose.model('Donor', donorSchema);
