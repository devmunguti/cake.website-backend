import SystemSetting from '../models/SystemSetting.js';
import { createAuditLog } from '../services/auditLogService.js';

/**
 * Helper to initialize or fetch settings document
 */
export async function getOrInitSettings() {
  let settings = await SystemSetting.findOne();
  if (!settings) {
    settings = await SystemSetting.create({
      general: {
        platformName: 'Sweet Delights Bakery',
        supportEmail: 'orders@sweetdelightsbakery.co.ke',
        adminAlertEmail: 'admin@sweetdelightsbakery.co.ke',
        supportPhone: '+254 700 000 000',
        whatsappNumber: '+254 700 000 000',
        storeAddress: '1st Avenue, Parklands / Westlands, Nairobi, Kenya',
        currency: 'KES'
      },
      bakeryOperations: {
        defaultDeliveryFee: 350,
        freeDeliveryThreshold: 6000,
        minimumLeadTimeHours: 24,
        openingTime: '08:00 AM',
        closingTime: '07:00 PM',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        pickupInstructions: 'Pickups are ready at our main bakery shop between 9 AM and 6 PM. Please present your Order Reference upon arrival.',
        deliveryInstructions: 'We hand-deliver delicate cakes in temperature-controlled carriers across Nairobi and surrounding zones.'
      },
      operations: {
        maintenanceMode: false
      }
    });
  }
  return settings;
}

/**
 * GET /api/public/settings
 * Public: Get store settings for customer client
 */
export const getPublicSettings = async (req, res, next) => {
  try {
    const settings = await getOrInitSettings();

    return res.status(200).json({
      success: true,
      data: {
        platformName: settings.general?.platformName || 'Sweet Delights Bakery',
        supportEmail: settings.general?.supportEmail || 'orders@sweetdelightsbakery.co.ke',
        supportPhone: settings.general?.supportPhone || '+254 700 000 000',
        whatsappNumber: settings.general?.whatsappNumber || '+254 700 000 000',
        storeAddress: settings.general?.storeAddress || 'Nairobi, Kenya',
        currency: settings.general?.currency || 'KES',
        logoUrl: settings.general?.logoUrl || '',
        defaultDeliveryFee: settings.bakeryOperations?.defaultDeliveryFee ?? 350,
        freeDeliveryThreshold: settings.bakeryOperations?.freeDeliveryThreshold ?? 6000,
        minimumLeadTimeHours: settings.bakeryOperations?.minimumLeadTimeHours ?? 24,
        openingTime: settings.bakeryOperations?.openingTime || '08:00 AM',
        closingTime: settings.bakeryOperations?.closingTime || '07:00 PM',
        workingDays: settings.bakeryOperations?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        pickupInstructions: settings.bakeryOperations?.pickupInstructions || '',
        deliveryInstructions: settings.bakeryOperations?.deliveryInstructions || '',
        maintenanceMode: !!settings.operations?.maintenanceMode,
        paymentMethods: settings.paymentMethods || {}
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/settings
 * Admin: Get all settings
 */
export const getAllSettings = async (req, res, next) => {
  try {
    const settings = await getOrInitSettings();
    return res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/settings
 * Admin: Update store settings
 */
export const updateSystemSettings = async (req, res, next) => {
  try {
    const { general, bakeryOperations, notifications, operations, paymentMethods } = req.body;

    let settings = await getOrInitSettings();

    if (general) {
      settings.general = { ...settings.general.toObject(), ...general };
    }
    if (bakeryOperations) {
      settings.bakeryOperations = { ...settings.bakeryOperations.toObject(), ...bakeryOperations };
    }
    if (notifications) {
      settings.notifications = { ...settings.notifications.toObject(), ...notifications };
    }
    if (operations) {
      settings.operations = { ...settings.operations.toObject(), ...operations };
    }
    if (paymentMethods) {
      settings.paymentMethods = { ...settings.paymentMethods.toObject(), ...paymentMethods };
    }

    settings.updatedBy = req.user?.id || null;
    await settings.save();

    await createAuditLog({
      user: req.user?.id,
      userName: req.user?.fullName || 'Admin',
      role: 'admin',
      action: 'System Settings Updated',
      details: 'Updated bakery store settings and operational parameters',
      category: 'Settings',
      status: 'Success',
      ipAddress: req.ip
    });

    return res.status(200).json({
      success: true,
      message: 'Bakery settings updated successfully',
      data: settings
    });
  } catch (error) {
    next(error);
  }
};
