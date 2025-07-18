const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// User validation rules
const validateUserRegistration = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  handleValidationErrors
];

const validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

const validateUserUpdate = [
  body('username')
    .optional()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('currentPassword')
    .optional()
    .notEmpty()
    .withMessage('Current password is required when updating password'),
  body('newPassword')
    .optional()
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters'),
  handleValidationErrors
];

// Comic validation rules
const validateComicCreation = [
  body('title')
    .isLength({ min: 1, max: 200 })
    .trim()
    .withMessage('Title must be 1-200 characters'),
  body('description')
    .isLength({ min: 10, max: 2000 })
    .trim()
    .withMessage('Description must be 10-2000 characters'),
  body('alternativeTitle')
    .optional()
    .isLength({ max: 200 })
    .trim()
    .withMessage('Alternative title must be max 200 characters'),
  body('artists')
    .optional()
    .isArray()
    .withMessage('Artists must be an array'),
  body('artists.*')
    .optional()
    .isLength({ max: 100 })
    .trim()
    .withMessage('Artist name must be max 100 characters'),
  body('categories')
    .optional()
    .isArray()
    .withMessage('Categories must be an array'),
  body('categories.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid category ID'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .isLength({ max: 50 })
    .trim()
    .withMessage('Tag must be max 50 characters'),
  body('status')
    .optional()
    .isIn(['ongoing', 'completed', 'paused', 'dropped'])
    .withMessage('Invalid status'),
  body('isVipOnly')
    .optional()
    .isBoolean()
    .withMessage('isVipOnly must be boolean'),
  handleValidationErrors
];

const validateComicUpdate = [
  body('title')
    .optional()
    .isLength({ min: 1, max: 200 })
    .trim()
    .withMessage('Title must be 1-200 characters'),
  body('description')
    .optional()
    .isLength({ min: 10, max: 2000 })
    .trim()
    .withMessage('Description must be 10-2000 characters'),
  body('alternativeTitle')
    .optional()
    .isLength({ max: 200 })
    .trim()
    .withMessage('Alternative title must be max 200 characters'),
  body('artists')
    .optional()
    .isArray()
    .withMessage('Artists must be an array'),
  body('categories')
    .optional()
    .isArray()
    .withMessage('Categories must be an array'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('status')
    .optional()
    .isIn(['ongoing', 'completed', 'paused', 'dropped'])
    .withMessage('Invalid status'),
  body('isVipOnly')
    .optional()
    .isBoolean()
    .withMessage('isVipOnly must be boolean'),
  handleValidationErrors
];

// Chapter validation rules
const validateChapterCreation = [
  body('title')
    .isLength({ min: 1, max: 200 })
    .trim()
    .withMessage('Title must be 1-200 characters'),
  body('chapterNumber')
    .isInt({ min: 1 })
    .withMessage('Chapter number must be a positive integer'),
  body('content')
    .optional()
    .isLength({ max: 5000 })
    .trim()
    .withMessage('Content must be max 5000 characters'),
  body('isVipOnly')
    .optional()
    .isBoolean()
    .withMessage('isVipOnly must be boolean'),
  body('authorNotes')
    .optional()
    .isLength({ max: 1000 })
    .trim()
    .withMessage('Author notes must be max 1000 characters'),
  handleValidationErrors
];

const validateChapterUpdate = [
  body('title')
    .optional()
    .isLength({ min: 1, max: 200 })
    .trim()
    .withMessage('Title must be 1-200 characters'),
  body('chapterNumber')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Chapter number must be a positive integer'),
  body('content')
    .optional()
    .isLength({ max: 5000 })
    .trim()
    .withMessage('Content must be max 5000 characters'),
  body('isVipOnly')
    .optional()
    .isBoolean()
    .withMessage('isVipOnly must be boolean'),
  body('authorNotes')
    .optional()
    .isLength({ max: 1000 })
    .trim()
    .withMessage('Author notes must be max 1000 characters'),
  handleValidationErrors
];

// Category validation rules
const validateCategoryCreation = [
  body('name')
    .isLength({ min: 1, max: 50 })
    .trim()
    .withMessage('Name must be 1-50 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .trim()
    .withMessage('Description must be max 500 characters'),
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color must be a valid hex color'),
  body('icon')
    .optional()
    .isLength({ max: 50 })
    .trim()
    .withMessage('Icon must be max 50 characters'),
  body('parentCategory')
    .optional()
    .isMongoId()
    .withMessage('Invalid parent category ID'),
  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Order must be a non-negative integer'),
  handleValidationErrors
];

// Comment validation rules
const validateCommentCreation = [
  body('content')
    .isLength({ min: 1, max: 1000 })
    .trim()
    .withMessage('Content must be 1-1000 characters'),
  body('parentComment')
    .optional()
    .isMongoId()
    .withMessage('Invalid parent comment ID'),
  handleValidationErrors
];

// Query validation rules
const validateSearch = [
  query('q')
    .optional()
    .isLength({ min: 1, max: 100 })
    .trim()
    .withMessage('Search query must be 1-100 characters'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sort')
    .optional()
    .isIn(['popular', 'latest', 'rating', 'name'])
    .withMessage('Invalid sort option'),
  handleValidationErrors
];

// Parameter validation rules
const validateMongoId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  handleValidationErrors
];

const validateComicSlug = [
  param('slug')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Invalid slug format'),
  handleValidationErrors
];

const validateChapterNumber = [
  param('chapterNumber')
    .isInt({ min: 1 })
    .withMessage('Chapter number must be a positive integer'),
  handleValidationErrors
];

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validateUserUpdate,
  validateComicCreation,
  validateComicUpdate,
  validateChapterCreation,
  validateChapterUpdate,
  validateCategoryCreation,
  validateCommentCreation,
  validateSearch,
  validateMongoId,
  validateComicSlug,
  validateChapterNumber,
  handleValidationErrors
};