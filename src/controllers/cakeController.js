import Cake from '../models/Cake.js';
import Category from '../models/Category.js';
import { createAuditLog } from '../services/auditLogService.js';

// Helper to convert cake name to URL-friendly slug
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * GET /api/cakes
 * Public: Query and filter the cake catalog
 */
export const getCakes = async (req, res, next) => {
  try {
    const {
      search,
      category,
      categorySlug,
      featured,
      minPrice,
      maxPrice,
      flavour,
      size,
      available,
      sort = 'newest',
      page = 1,
      limit = 12
    } = req.query;

    const query = {};

    // Availability filter (default true for public unless admin asks for all)
    if (available !== undefined) {
      query.available = available === 'true';
    } else if (!req.user || req.user.role !== 'admin') {
      query.available = true;
    }

    if (featured === 'true') {
      query.featured = true;
    }

    // Category filter by ID or by Slug
    if (category) {
      query.category = category;
    } else if (categorySlug) {
      const catDoc = await Category.findOne({ slug: categorySlug });
      if (catDoc) {
        query.category = catDoc._id;
      }
    }

    // Price range
    if (minPrice || maxPrice) {
      query.basePrice = {};
      if (minPrice) query.basePrice.$gte = Number(minPrice);
      if (maxPrice) query.basePrice.$lte = Number(maxPrice);
    }

    // Text search on name, description, tags
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { categoryName: searchRegex },
        { tags: searchRegex }
      ];
    }

    // Flavour filter
    if (flavour) {
      query['flavours.name'] = new RegExp(flavour, 'i');
    }

    // Size filter
    if (size) {
      query['sizes.name'] = new RegExp(size, 'i');
    }

    // Sorting
    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc' || sort === 'price-asc') {
      sortOption = { basePrice: 1 };
    } else if (sort === 'price_desc' || sort === 'price-desc') {
      sortOption = { basePrice: -1 };
    } else if (sort === 'rating') {
      sortOption = { rating: -1, reviewsCount: -1 };
    } else if (sort === 'featured') {
      sortOption = { featured: -1, createdAt: -1 };
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 12));
    const skip = (currentPage - 1) * pageLimit;

    const [cakes, total] = await Promise.all([
      Cake.find(query)
        .populate('category', 'name slug image')
        .sort(sortOption)
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      Cake.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / pageLimit) || 1;

    return res.status(200).json({
      success: true,
      data: cakes,
      pagination: {
        page: currentPage,
        limit: pageLimit,
        total,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/cakes/featured
 * Public: Fast endpoint for featured cakes on the homepage
 */
export const getFeaturedCakes = async (req, res, next) => {
  try {
    const cakes = await Cake.find({ featured: true, available: true })
      .populate('category', 'name slug')
      .sort({ rating: -1, createdAt: -1 })
      .limit(8)
      .lean();

    return res.status(200).json({
      success: true,
      count: cakes.length,
      data: cakes
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/cakes/:slugOrId
 * Public: Get single cake by slug or ObjectId
 */
export const getCakeBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;

    let cake = null;
    if (slug.match(/^[0-9a-fA-F]{24}$/)) {
      cake = await Cake.findById(slug).populate('category', 'name slug image');
    }
    if (!cake) {
      cake = await Cake.findOne({ slug }).populate('category', 'name slug image');
    }

    if (!cake) {
      return res.status(404).json({ success: false, message: 'Cake not found in our bakery catalog' });
    }

    return res.status(200).json({
      success: true,
      data: cake
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/cakes
 * Admin: Create a new artisanal cake item
 */
export const createCake = async (req, res, next) => {
  try {
    const {
      name,
      description,
      category,
      images,
      basePrice,
      sizes,
      flavours,
      fillings,
      decorationOptions,
      preparationTimeHours,
      preparationTimeText,
      available,
      featured,
      tags
    } = req.body;

    if (!name || !category || basePrice === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Cake name, category ID, and base price are required.'
      });
    }

    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) {
      return res.status(400).json({ success: false, message: 'Selected category does not exist.' });
    }

    let baseSlug = generateSlug(name);
    let slug = baseSlug;
    let counter = 1;
    while (await Cake.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const newCake = await Cake.create({
      name,
      slug,
      description: description || '',
      category: categoryDoc._id,
      categoryName: categoryDoc.name,
      images: Array.isArray(images) ? images : (images ? [images] : []),
      basePrice: Number(basePrice),
      sizes: Array.isArray(sizes) && sizes.length > 0 ? sizes : undefined,
      flavours: Array.isArray(flavours) && flavours.length > 0 ? flavours : undefined,
      fillings: Array.isArray(fillings) && fillings.length > 0 ? fillings : undefined,
      decorationOptions: Array.isArray(decorationOptions) && decorationOptions.length > 0 ? decorationOptions : undefined,
      preparationTimeHours: preparationTimeHours ? Number(preparationTimeHours) : 24,
      preparationTimeText: preparationTimeText || '24-48 hours',
      available: available !== false,
      featured: !!featured,
      tags: Array.isArray(tags) ? tags : []
    });

    await createAuditLog({
      user: req.user?.id,
      userName: req.user?.fullName || 'Admin',
      role: req.user?.role || 'admin',
      action: 'Cake Created',
      details: `Created new cake: "${newCake.name}" (KES ${newCake.basePrice})`,
      category: 'Cake Management',
      status: 'Success',
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Cake created successfully',
      data: newCake
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/cakes/:id
 * Admin: Update cake
 */
export const updateCake = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cake = await Cake.findById(id);

    if (!cake) {
      return res.status(404).json({ success: false, message: 'Cake not found' });
    }

    const {
      name,
      description,
      category,
      images,
      basePrice,
      sizes,
      flavours,
      fillings,
      decorationOptions,
      preparationTimeHours,
      preparationTimeText,
      available,
      featured,
      tags
    } = req.body;

    if (name && name !== cake.name) {
      cake.name = name;
      let baseSlug = generateSlug(name);
      let slug = baseSlug;
      let counter = 1;
      while (await Cake.findOne({ slug, _id: { $ne: cake._id } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      cake.slug = slug;
    }

    if (category) {
      const categoryDoc = await Category.findById(category);
      if (categoryDoc) {
        cake.category = categoryDoc._id;
        cake.categoryName = categoryDoc.name;
      }
    }

    if (description !== undefined) cake.description = description;
    if (images !== undefined) cake.images = Array.isArray(images) ? images : [images];
    if (basePrice !== undefined) cake.basePrice = Number(basePrice);
    if (sizes !== undefined) cake.sizes = sizes;
    if (flavours !== undefined) cake.flavours = flavours;
    if (fillings !== undefined) cake.fillings = fillings;
    if (decorationOptions !== undefined) cake.decorationOptions = decorationOptions;
    if (preparationTimeHours !== undefined) cake.preparationTimeHours = Number(preparationTimeHours);
    if (preparationTimeText !== undefined) cake.preparationTimeText = preparationTimeText;
    if (available !== undefined) cake.available = available;
    if (featured !== undefined) cake.featured = featured;
    if (tags !== undefined) cake.tags = tags;

    await cake.save();

    await createAuditLog({
      user: req.user?.id,
      userName: req.user?.fullName || 'Admin',
      role: req.user?.role || 'admin',
      action: 'Cake Updated',
      details: `Updated cake: "${cake.name}" (ID: ${cake._id})`,
      category: 'Cake Management',
      status: 'Success',
      ipAddress: req.ip
    });

    return res.status(200).json({
      success: true,
      message: 'Cake updated successfully',
      data: cake
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/cakes/:id
 * Admin: Delete cake
 */
export const deleteCake = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cake = await Cake.findById(id);

    if (!cake) {
      return res.status(404).json({ success: false, message: 'Cake not found' });
    }

    await Cake.findByIdAndDelete(id);

    await createAuditLog({
      user: req.user?.id,
      userName: req.user?.fullName || 'Admin',
      role: req.user?.role || 'admin',
      action: 'Cake Deleted',
      details: `Deleted cake: "${cake.name}"`,
      category: 'Cake Management',
      status: 'Success',
      ipAddress: req.ip
    });

    return res.status(200).json({
      success: true,
      message: 'Cake deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/cakes/:id/toggle-availability
 */
export const toggleAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cake = await Cake.findById(id);
    if (!cake) {
      return res.status(404).json({ success: false, message: 'Cake not found' });
    }

    cake.available = !cake.available;
    await cake.save();

    return res.status(200).json({
      success: true,
      message: `Cake is now ${cake.available ? 'available' : 'unavailable'}`,
      available: cake.available
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/cakes/:id/toggle-featured
 */
export const toggleFeatured = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cake = await Cake.findById(id);
    if (!cake) {
      return res.status(404).json({ success: false, message: 'Cake not found' });
    }

    cake.featured = !cake.featured;
    await cake.save();

    return res.status(200).json({
      success: true,
      message: `Cake ${cake.featured ? 'is now featured on homepage' : 'removed from featured list'}`,
      featured: cake.featured
    });
  } catch (error) {
    next(error);
  }
};
