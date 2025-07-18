const Category = require('../models/Category');
const Comic = require('../models/Comic');

// Get all categories
const getCategories = async (req, res) => {
  try {
    const categories = await Category.getActiveCategories();
    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get category by slug
const getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const category = await Category.getCategoryBySlug(slug);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ category });
  } catch (error) {
    console.error('Get category by slug error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get comics by category
const getComicsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 20, sort = 'latest' } = req.query;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    let sortOptions = {};
    switch (sort) {
      case 'popular':
        sortOptions = { 'views.total': -1 };
        break;
      case 'rating':
        sortOptions = { 'rating.average': -1 };
        break;
      case 'name':
        sortOptions = { title: 1 };
        break;
      case 'latest':
      default:
        sortOptions = { lastUpdated: -1 };
        break;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: sortOptions,
      populate: [
        { path: 'author', select: 'username' },
        { path: 'categories', select: 'name color' }
      ]
    };

    const comics = await Comic.paginate(
      { categories: categoryId, isApproved: true },
      options
    );

    res.json({
      category,
      comics: comics.docs,
      pagination: {
        page: comics.page,
        limit: comics.limit,
        total: comics.totalDocs,
        pages: comics.totalPages,
        hasNext: comics.hasNextPage,
        hasPrev: comics.hasPrevPage
      }
    });
  } catch (error) {
    console.error('Get comics by category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get top categories
const getTopCategories = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const categories = await Category.getTopCategories(parseInt(limit));
    res.json({ categories });
  } catch (error) {
    console.error('Get top categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Search categories
const searchCategories = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const categories = await Category.searchCategories(q);
    res.json({ categories });
  } catch (error) {
    console.error('Search categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create category (Admin only)
const createCategory = async (req, res) => {
  try {
    const { name, description, color, icon, parentCategory, order } = req.body;

    const category = new Category({
      name,
      description,
      color,
      icon,
      parentCategory,
      order
    });

    await category.save();

    res.status(201).json({
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    console.error('Create category error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Category name already exists' });
    }
    res.status(500).json({ message: 'Server error during category creation' });
  }
};

// Update category (Admin only)
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, icon, parentCategory, order, isActive } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Update fields
    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    if (color) category.color = color;
    if (icon) category.icon = icon;
    if (parentCategory !== undefined) category.parentCategory = parentCategory;
    if (order !== undefined) category.order = order;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    res.json({
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    console.error('Update category error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Category name already exists' });
    }
    res.status(500).json({ message: 'Server error during category update' });
  }
};

// Delete category (Admin only)
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if category has comics
    const comicsCount = await Comic.countDocuments({ categories: id });
    if (comicsCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete category with associated comics' 
      });
    }

    // Check if category has subcategories
    const subcategoriesCount = await Category.countDocuments({ parentCategory: id });
    if (subcategoriesCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete category with subcategories' 
      });
    }

    await Category.findByIdAndDelete(id);

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ message: 'Server error during category deletion' });
  }
};

// Update category statistics (Admin only)
const updateCategoryStatistics = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    await category.updateStatistics();

    res.json({
      message: 'Category statistics updated successfully',
      statistics: category.statistics
    });
  } catch (error) {
    console.error('Update category statistics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getCategories,
  getCategoryBySlug,
  getComicsByCategory,
  getTopCategories,
  searchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  updateCategoryStatistics
};