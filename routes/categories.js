const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../middleware/auth');
const {
  validateCategoryCreation,
  validateMongoId,
  validateSearch
} = require('../middleware/validation');
const {
  getCategories,
  getCategoryBySlug,
  getComicsByCategory,
  getTopCategories,
  searchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  updateCategoryStatistics
} = require('../controllers/categoriesController');

// @route   GET /api/categories
// @desc    Get all active categories
// @access  Public
router.get('/', getCategories);

// @route   GET /api/categories/top
// @desc    Get top categories by comic count
// @access  Public
router.get('/top', getTopCategories);

// @route   GET /api/categories/search
// @desc    Search categories
// @access  Public
router.get('/search', validateSearch, searchCategories);

// @route   GET /api/categories/:slug
// @desc    Get category by slug
// @access  Public
router.get('/:slug', getCategoryBySlug);

// @route   GET /api/categories/:categoryId/comics
// @desc    Get comics by category
// @access  Public
router.get('/:categoryId/comics', validateMongoId, getComicsByCategory);

// @route   POST /api/categories
// @desc    Create new category
// @access  Private (Admin only)
router.post('/', auth, isAdmin, validateCategoryCreation, createCategory);

// @route   PUT /api/categories/:id
// @desc    Update category
// @access  Private (Admin only)
router.put('/:id', auth, isAdmin, validateMongoId, updateCategory);

// @route   DELETE /api/categories/:id
// @desc    Delete category
// @access  Private (Admin only)
router.delete('/:id', auth, isAdmin, validateMongoId, deleteCategory);

// @route   POST /api/categories/:id/update-stats
// @desc    Update category statistics
// @access  Private (Admin only)
router.post('/:id/update-stats', auth, isAdmin, validateMongoId, updateCategoryStatistics);

module.exports = router;