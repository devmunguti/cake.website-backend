import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    userName: {
      type: String,
      default: 'Unknown User',
      trim: true
    },
    role: {
      type: String,
      default: 'Unauthenticated',
      trim: true
    },
    action: {
      type: String,
      required: true,
      trim: true
    },
    details: {
      type: String,
      required: true,
      trim: true
    },
    ipAddress: {
      type: String,
      default: 'Unknown',
      trim: true
    },
    status: {
      type: String,
      enum: ['Success', 'Failed'],
      required: true
    },
    category: {
      type: String,
      enum: [
        'Authentication',
        'User Management',
        'Cake Management',
        'Category Management',
        'Order',
        'Payment',
        'Custom Cake',
        'Promotion',
        'Settings',
        'Security',
        'Admin',
        'Other'
      ],
      default: 'Other'
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    userAgent: {
      type: String,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ status: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ category: 1, createdAt: -1 });

auditLogSchema.index({
  userName: 'text',
  role: 'text',
  action: 'text',
  details: 'text'
});

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
