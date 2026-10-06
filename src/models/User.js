import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, required: true },
    city: { type: String, required: true, default: 'Nairobi' },
    houseNumber: { type: String, default: '' },
    landmark: { type: String, default: '' },
    instructions: { type: String, default: '' },
    isDefault: { type: Boolean, default: false }
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      trim: true
    },
    lastName: {
      type: String,
      trim: true
    },
    fullName: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false
    },
    role: {
      type: String,
      enum: ['user', 'customer', 'admin'],
      default: 'customer',
      index: true
    },
    status: {
      type: String,
      enum: ['Pending', 'Active', 'Suspended'],
      default: 'Active',
      index: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    mustChangePassword: {
      type: Boolean,
      default: false
    },
    passwordChangedAt: {
      type: Date,
      default: null
    },
    lastLogin: {
      type: Date
    },
    addresses: [addressSchema]
  },
  {
    timestamps: true
  }
);

userSchema.pre('save', async function () {
  if (this.firstName || this.lastName) {
    this.fullName = `${this.firstName || ''} ${this.lastName || ''}`.trim();
  }
  if (!this.isModified('passwordHash')) return;
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
