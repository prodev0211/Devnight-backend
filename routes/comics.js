const express = require('express');
const router = express.Router();
const { auth, optionalAuth, isAuthor } = require('../middleware/auth');
const { uploadCover, handleUploadError } = require('../middleware/upload');
const {
  validateComicCreation,
  validateComicUpdate,
  validateMongoId,
  validateComicSlug,
  validateSearch
} = require('../middleware/validation');
const {
  getComics,
  getFeaturedComics,
  getComicBySlug,
  createComic,
  updateComic,
  deleteComic,
  getComicsByAuthor,
  searchComics,
  rateComic
} = require('../controllers/comicsController');

// @route   GET /api/comics
// @desc    Get all comics with filters and pagination
// @access  Public
router.get('/', getComics);

// @route   GET /api/comics/featured
// @desc    Get featured comics for homepage
// @access  Public
router.get('/featured', getFeaturedComics);

// @route   GET /api/comics/search
// @desc    Search comics
// @access  Public
router.get('/search', validateSearch, searchComics);

// @route   GET /api/comics/author/:authorId
// @desc    Get comics by author
// @access  Public
router.get('/author/:authorId', validateMongoId, getComicsByAuthor);

// @route   GET /api/comics/:slug
// @desc    Get comic by slug
// @access  Public (with optional auth for user interactions)
router.get('/:slug', validateComicSlug, optionalAuth, getComicBySlug);

// @route   POST /api/comics
// @desc    Create new comic
// @access  Private (Author/Admin)
router.post('/', auth, isAuthor, uploadCover, handleUploadError, validateComicCreation, createComic);

// @route   PUT /api/comics/:id
// @desc    Update comic
// @access  Private (Author/Admin - owner only)
router.put('/:id', auth, isAuthor, uploadCover, handleUploadError, validateMongoId, validateComicUpdate, updateComic);

// @route   DELETE /api/comics/:id
// @desc    Delete comic
// @access  Private (Author/Admin - owner only)
router.delete('/:id', auth, isAuthor, validateMongoId, deleteComic);

// @route   POST /api/comics/:id/rate
// @desc    Rate comic
// @access  Private
router.post('/:id/rate', auth, validateMongoId, rateComic);

module.exports = router;