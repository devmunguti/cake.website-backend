import mongoose from 'mongoose';

const systemSettingSchema = new mongoose.Schema(
  {
    general: {
      platformName: { type: String, default: 'Sweet Delights Bakery', trim: true },
      supportEmail: { type: String, default: 'orders@sweetdelightsbakery.co.ke', trim: true },
      adminAlertEmail: { type: String, default: 'admin@sweetdelightsbakery.co.ke', trim: true },
      supportPhone: { type: String, default: '+254 700 000 000', trim: true },
      whatsappNumber: { type: String, default: '+254 700 000 000', trim: true },
      storeAddress: { type: String, default: '1st Avenue, Parklands / Westlands, Nairobi, Kenya', trim: true },
      currency: { type: String, default: 'KES', trim: true },
      logoUrl: { type: String, default: '' }
    },
    bakeryOperations: {
      defaultDeliveryFee: { type: Number, default: 350, min: 0 },
      freeDeliveryThreshold: { type: Number, default: 6000, min: 0 },
      minimumLeadTimeHours: { type: Number, default: 24, min: 1 },
      openingTime: { type: String, default: '08:00 AM' },
      closingTime: { type: String, default: '07:00 PM' },
      workingDays: { type: [String], default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
      pickupInstructions: { type: String, default: 'Pickups are ready at our main bakery shop between 9 AM and 6 PM. Please present your Order Reference upon arrival.' },
      deliveryInstructions: { type: String, default: 'We hand-deliver delicate cakes in temperature-controlled carriers across Nairobi and surrounding zones.' }
    },
    notifications: {
      newOrders: { type: Boolean, default: true },
      customCakeRequests: { type: Boolean, default: true },
      paymentReceipts: { type: Boolean, default: true },
      newReviews: { type: Boolean, default: true },
      securityAlerts: { type: Boolean, default: true }
    },
    operations: {
      maintenanceMode: { type: Boolean, default: false }
    },
    paymentMethods: {
      mpesaTillNumber: { type: String, default: '8995354', trim: true },
      mpesaPaybillNumber: { type: String, default: '522522', trim: true },
      mpesaAccountNumber: { type: String, default: 'SWEETCAKES', trim: true },
      instructions: { type: String, default: 'Make payment via M-Pesa STK Push prompt on your phone or use our Paybill/Till.' }
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

const SystemSetting = mongoose.models.SystemSetting || mongoose.model('SystemSetting', systemSettingSchema);
export default SystemSetting;
