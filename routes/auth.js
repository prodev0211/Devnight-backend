const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { uploadAvatar, handleUploadError } = require('../middleware/upload');
const {
  validateUserRegistration,
  validateUserLogin,
  validateUserUpdate,
  validateMongoId
} = require('../middleware/validation');
const {
  register,
  login,
  getMe,
  updateProfile,
  uploadAvatar: uploadAvatarController,
  toggleFollowComic,
  toggleFavoriteComic,
  getReadingHistory,
  getFollowedComics,
  getFavoriteComics
} = require('../controllers/authController');

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', validateUserRegistration, register);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', validateUserLogin, login);

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, getMe);

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, validateUserUpdate, updateProfile);

// @route   POST /api/auth/upload-avatar
// @desc    Upload user avatar
// @access  Private
router.post('/upload-avatar', auth, uploadAvatar, handleUploadError, uploadAvatarController);

// @route   POST /api/auth/follow/:comicId
// @desc    Follow/unfollow comic
// @access  Private
router.post('/follow/:comicId', auth, validateMongoId, toggleFollowComic);

// @route   POST /api/auth/favorite/:comicId
// @desc    Add/remove comic from favorites
// @access  Private
router.post('/favorite/:comicId', auth, validateMongoId, toggleFavoriteComic);

// @route   GET /api/auth/reading-history
// @desc    Get user reading history
// @access  Private
router.get('/reading-history', auth, getReadingHistory);

// @route   GET /api/auth/followed-comics
// @desc    Get user followed comics
// @access  Private
router.get('/followed-comics', auth, getFollowedComics);

// @route   GET /api/auth/favorite-comics
// @desc    Get user favorite comics
// @access  Private
router.get('/favorite-comics', auth, getFavoriteComics);

module.exports = router;