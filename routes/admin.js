const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../middleware/auth');
const { validateMongoId } = require('../middleware/validation');
const {
  getDashboardStats,
  getUsers,
  updateUserRole,
  updateUserVipStatus,
  getPendingComics,
  approveComic,
  getPendingChapters,
  approveChapter,
  updateComicStatus,
  getReportedComments,
  moderateComment
} = require('../controllers/adminController');

// All admin routes require authentication and admin role
router.use(auth, isAdmin);

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin only)
router.get('/dashboard', getDashboardStats);

// @route   GET /api/admin/users
// @desc    Get all users with filters and pagination
// @access  Private (Admin only)
router.get('/users', getUsers);

// @route   PUT /api/admin/users/:userId/role
// @desc    Update user role
// @access  Private (Admin only)
router.put('/users/:userId/role', validateMongoId, updateUserRole);

// @route   PUT /api/admin/users/:userId/vip
// @desc    Update user VIP status
// @access  Private (Admin only)
router.put('/users/:userId/vip', validateMongoId, updateUserVipStatus);

// @route   GET /api/admin/pending-comics
// @desc    Get pending comics for approval
// @access  Private (Admin only)
router.get('/pending-comics', getPendingComics);

// @route   POST /api/admin/comics/:comicId/approve
// @desc    Approve or reject comic
// @access  Private (Admin only)
router.post('/comics/:comicId/approve', validateMongoId, approveComic);

// @route   GET /api/admin/pending-chapters
// @desc    Get pending chapters for approval
// @access  Private (Admin only)
router.get('/pending-chapters', getPendingChapters);

// @route   POST /api/admin/chapters/:chapterId/approve
// @desc    Approve or reject chapter
// @access  Private (Admin only)
router.post('/chapters/:chapterId/approve', validateMongoId, approveChapter);

// @route   PUT /api/admin/comics/:comicId/status
// @desc    Update comic status (hot, recommended, etc.)
// @access  Private (Admin only)
router.put('/comics/:comicId/status', validateMongoId, updateComicStatus);

// @route   GET /api/admin/reported-comments
// @desc    Get reported comments
// @access  Private (Admin only)
router.get('/reported-comments', getReportedComments);

// @route   POST /api/admin/comments/:commentId/moderate
// @desc    Moderate comment (approve/delete)
// @access  Private (Admin only)
router.post('/comments/:commentId/moderate', validateMongoId, moderateComment);

module.exports = router;