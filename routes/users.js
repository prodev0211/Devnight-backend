const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../middleware/auth');
const { validateMongoId } = require('../middleware/validation');
const User = require('../models/User');
const Comic = require('../models/Comic');

// @route   GET /api/users/:id
// @desc    Get user profile by ID
// @access  Public
router.get('/:id', validateMongoId, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -email -readingHistory -followedComics -favoriteComics')
      .populate('role');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's public comics if they're an author
    let comics = [];
    if (user.role === 'author') {
      comics = await Comic.find({ author: user._id, isApproved: true })
        .select('title slug coverImage status rating views statistics')
        .sort({ lastUpdated: -1 })
        .limit(10);
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        role: user.role,
        createdAt: user.createdAt
      },
      comics
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/comics
// @desc    Get user's published comics
// @access  Public
router.get('/:id/comics', validateMongoId, async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = 'latest' } = req.query;
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'author') {
      return res.status(400).json({ message: 'User is not an author' });
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
        { path: 'categories', select: 'name color' }
      ]
    };

    const comics = await Comic.paginate(
      { author: userId, isApproved: true },
      options
    );

    res.json({
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar
      },
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
    console.error('Get user comics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/stats
// @desc    Get user statistics
// @access  Public
router.get('/:id/stats', validateMongoId, async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let stats = {
      joinedAt: user.createdAt,
      readingHistory: user.readingHistory.length,
      followedComics: user.followedComics.length,
      favoriteComics: user.favoriteComics.length
    };

    // Add author-specific stats
    if (user.role === 'author') {
      const Comic = require('../models/Comic');
      const Chapter = require('../models/Chapter');

      const [totalComics, totalChapters, totalViews] = await Promise.all([
        Comic.countDocuments({ author: userId, isApproved: true }),
        Chapter.countDocuments({ 
          comic: { $in: await Comic.find({ author: userId, isApproved: true }).distinct('_id') },
          isApproved: true 
        }),
        Comic.aggregate([
          { $match: { author: userId, isApproved: true } },
          { $group: { _id: null, totalViews: { $sum: '$views.total' } } }
        ])
      ]);

      stats.author = {
        totalComics,
        totalChapters,
        totalViews: totalViews.length > 0 ? totalViews[0].totalViews : 0
      };
    }

    res.json({ stats });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/authors
// @desc    Get list of authors
// @access  Public
router.get('/authors', async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = 'name' } = req.query;

    let sortOptions = {};
    switch (sort) {
      case 'comics':
        // We'll handle this with aggregation
        break;
      case 'latest':
        sortOptions = { createdAt: -1 };
        break;
      case 'name':
      default:
        sortOptions = { username: 1 };
        break;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: sortOptions,
      select: 'username avatar createdAt'
    };

    const authors = await User.paginate({ role: 'author' }, options);

    // Get comic counts for each author
    const authorsWithStats = await Promise.all(
      authors.docs.map(async (author) => {
        const comicsCount = await Comic.countDocuments({ 
          author: author._id, 
          isApproved: true 
        });
        
        return {
          ...author.toObject(),
          comicsCount
        };
      })
    );

    res.json({
      authors: authorsWithStats,
      pagination: {
        page: authors.page,
        limit: authors.limit,
        total: authors.totalDocs,
        pages: authors.totalPages,
        hasNext: authors.hasNextPage,
        hasPrev: authors.hasPrevPage
      }
    });
  } catch (error) {
    console.error('Get authors error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;