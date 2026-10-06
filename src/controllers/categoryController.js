import Category from '../models/Category.js';
import Cake from '../models/Cake.js';
import { createAuditLog } from '../services/auditLogService.js';

// Helper to convert category name to URL-friendly slug
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * GET /api/categories
 * Public: Get all active categories
 */
export const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });
    return res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/categories/:slug
 * Public: Get single category by slug
 */
export const getCategoryBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const category = await Category.findOne({ slug, isActive: true });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const cakes = await Cake.find({ category: category._id, available: true }).sort({ basePrice: 1 });

    return res.status(200).json({
      success: true,
      data: {
        category,
        cakes
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/categories
 * Admin: Create a new category
 */
export const createCategory = async (req, res, next) => {
  try {
    const { name, description, image, icon, displayOrder, isActive } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const slug = generateSlug(name);
    const existing = await Category.findOne({ slug });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A category with this name or slug already exists' });
    }

    const category = await Category.create({
      name,
      slug,
      description: description || '',
      image: image || '',
      icon: icon || 'cake',
      displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
      isActive: isActive !== false
    });

    await createAuditLog({
      user: req.user?.id,
      userName: req.user?.fullName || 'Admin',
      role: req.user?.role || 'admin',
      action: 'Category Created',
      details: `Created cake category: ${category.name} (${category.slug})`,
      category: 'Category Management',
      status: 'Success',
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/categories/:id
 * Admin: Update category
 */
export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, image, icon, displayOrder, isActive } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    if (name && name !== category.name) {
      category.name = name;
      category.slug = generateSlug(name);
    }
    if (description !== undefined) category.description = description;
    if (image !== undefined) category.image = image;
    if (icon !== undefined) category.icon = icon;
    if (displayOrder !== undefined) category.displayOrder = displayOrder;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    await createAuditLog({
      user: req.user?.id,
      userName: req.user?.fullName || 'Admin',
      role: req.user?.role || 'admin',
      action: 'Category Updated',
      details: `Updated cake category: ${category.name}`,
      category: 'Category Management',
      status: 'Success',
      ipAddress: req.ip
    });

    return res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/categories/:id
 * Admin: Delete category
 */
export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Check if any cakes are using this category
    const cakeCount = await Cake.countDocuments({ category: category._id });
    if (cakeCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category: ${cakeCount} cakes belong to this category. Please reassign or delete those cakes first.`
      });
    }

    await Category.findByIdAndDelete(id);

    await createAuditLog({
      user: req.user?.id,
      userName: req.user?.fullName || 'Admin',
      role: req.user?.role || 'admin',
      action: 'Category Deleted',
      details: `Deleted cake category: ${category.name}`,
      category: 'Category Management',
      status: 'Success',
      ipAddress: req.ip
    });

    return res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
