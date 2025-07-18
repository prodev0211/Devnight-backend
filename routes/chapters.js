const express = require('express');
const router = express.Router();
const { auth, optionalAuth, isAuthor } = require('../middleware/auth');
const { uploadChapterImages, handleUploadError } = require('../middleware/upload');
const {
  validateChapterCreation,
  validateChapterUpdate,
  validateMongoId,
  validateChapterNumber,
  validateCommentCreation
} = require('../middleware/validation');
const {
  getChaptersByComic,
  getChapterByNumber,
  createChapter,
  updateChapter,
  deleteChapter,
  getLatestChapters,
  getMostViewedChapters,
  getChapterComments,
  addChapterComment
} = require('../controllers/chaptersController');

// @route   GET /api/chapters/latest
// @desc    Get latest chapters
// @access  Public
router.get('/latest', getLatestChapters);

// @route   GET /api/chapters/most-viewed
// @desc    Get most viewed chapters
// @access  Public
router.get('/most-viewed', getMostViewedChapters);

// @route   GET /api/chapters/comic/:comicId
// @desc    Get chapters by comic
// @access  Public (with optional auth for VIP content)
router.get('/comic/:comicId', validateMongoId, optionalAuth, getChaptersByComic);

// @route   GET /api/chapters/comic/:comicId/chapter/:chapterNumber
// @desc    Get chapter by comic and chapter number
// @access  Public (with optional auth for VIP content and reading history)
router.get('/comic/:comicId/chapter/:chapterNumber', validateMongoId, validateChapterNumber, optionalAuth, getChapterByNumber);

// @route   POST /api/chapters/comic/:comicId
// @desc    Create new chapter
// @access  Private (Author/Admin - owner only)
router.post('/comic/:comicId', auth, isAuthor, uploadChapterImages, handleUploadError, validateMongoId, validateChapterCreation, createChapter);

// @route   PUT /api/chapters/:id
// @desc    Update chapter
// @access  Private (Author/Admin - owner only)
router.put('/:id', auth, isAuthor, uploadChapterImages, handleUploadError, validateMongoId, validateChapterUpdate, updateChapter);

// @route   DELETE /api/chapters/:id
// @desc    Delete chapter
// @access  Private (Author/Admin - owner only)
router.delete('/:id', auth, isAuthor, validateMongoId, deleteChapter);

// @route   GET /api/chapters/:id/comments
// @desc    Get chapter comments
// @access  Public
router.get('/:id/comments', validateMongoId, getChapterComments);

// @route   POST /api/chapters/:id/comments
// @desc    Add comment to chapter
// @access  Private
router.post('/:id/comments', auth, validateMongoId, validateCommentCreation, addChapterComment);

module.exports = router;