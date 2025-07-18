const User = require('../models/User');
const Comic = require('../models/Comic');
const Chapter = require('../models/Chapter');
const Category = require('../models/Category');
const Comment = require('../models/Comment');

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalComics,
      totalChapters,
      totalCategories,
      totalComments,
      vipUsers,
      pendingComics,
      pendingChapters,
      recentUsers,
      recentComics
    ] = await Promise.all([
      User.countDocuments(),
      Comic.countDocuments(),
      Chapter.countDocuments(),
      Category.countDocuments(),
      Comment.countDocuments(),
      User.countDocuments({ isVip: true }),
      Comic.countDocuments({ isApproved: false }),
      Chapter.countDocuments({ isApproved: false }),
      User.find().sort({ createdAt: -1 }).limit(10).select('username email role createdAt'),
      Comic.find().sort({ createdAt: -1 }).limit(10).populate('author', 'username').select('title author createdAt isApproved')
    ]);

    res.json({
      stats: {
        totalUsers,
        totalComics,
        totalChapters,
        totalCategories,
        totalComments,
        vipUsers,
        pendingComics,
        pendingChapters
      },
      recent: {
        users: recentUsers,
        comics: recentComics
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all users with pagination
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search, sort = 'latest' } = req.query;

    let query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    let sortOptions = {};
    switch (sort) {
      case 'name':
        sortOptions = { username: 1 };
        break;
      case 'email':
        sortOptions = { email: 1 };
        break;
      case 'role':
        sortOptions = { role: 1 };
        break;
      case 'latest':
      default:
        sortOptions = { createdAt: -1 };
        break;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: sortOptions,
      select: '-password'
    };

    const users = await User.paginate(query, options);

    res.json({
      users: users.docs,
      pagination: {
        page: users.page,
        limit: users.limit,
        total: users.totalDocs,
        pages: users.totalPages,
        hasNext: users.hasNextPage,
        hasPrev: users.hasPrevPage
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user role
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'author', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent changing own role
    if (user._id.equals(req.user.id)) {
      return res.status(400).json({ message: 'Cannot change your own role' });
    }

    user.role = role;
    await user.save();

    res.json({
      message: 'User role updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user VIP status
const updateUserVipStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isVip, vipExpiry } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isVip = isVip;
    if (isVip && vipExpiry) {
      user.vipExpiry = new Date(vipExpiry);
    }

    await user.save();

    res.json({
      message: 'User VIP status updated successfully',
      user: {
        id: user._id,
        username: user.username,
        isVip: user.isVip,
        vipExpiry: user.vipExpiry
      }
    });
  } catch (error) {
    console.error('Update user VIP status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get pending comics
const getPendingComics = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'author', select: 'username' },
        { path: 'categories', select: 'name' }
      ]
    };

    const comics = await Comic.paginate({ isApproved: false }, options);

    res.json({
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
    console.error('Get pending comics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Approve/reject comic
const approveComic = async (req, res) => {
  try {
    const { comicId } = req.params;
    const { approved, rejectionReason } = req.body;

    const comic = await Comic.findById(comicId);
    if (!comic) {
      return res.status(404).json({ message: 'Comic not found' });
    }

    comic.isApproved = approved;
    comic.approvedBy = req.user.id;
    comic.approvedAt = new Date();

    if (!approved && rejectionReason) {
      comic.rejectionReason = rejectionReason;
    }

    await comic.save();

    res.json({
      message: approved ? 'Comic approved successfully' : 'Comic rejected successfully',
      comic
    });
  } catch (error) {
    console.error('Approve comic error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get pending chapters
const getPendingChapters = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'comic', select: 'title' }
      ]
    };

    const chapters = await Chapter.paginate({ isApproved: false }, options);

    res.json({
      chapters: chapters.docs,
      pagination: {
        page: chapters.page,
        limit: chapters.limit,
        total: chapters.totalDocs,
        pages: chapters.totalPages,
        hasNext: chapters.hasNextPage,
        hasPrev: chapters.hasPrevPage
      }
    });
  } catch (error) {
    console.error('Get pending chapters error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Approve/reject chapter
const approveChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { approved, rejectionReason } = req.body;

    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    chapter.isApproved = approved;
    chapter.approvedBy = req.user.id;
    chapter.approvedAt = new Date();

    if (!approved && rejectionReason) {
      chapter.rejectionReason = rejectionReason;
    }

    await chapter.save();

    res.json({
      message: approved ? 'Chapter approved successfully' : 'Chapter rejected successfully',
      chapter
    });
  } catch (error) {
    console.error('Approve chapter error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update comic status (hot, recommended, etc.)
const updateComicStatus = async (req, res) => {
  try {
    const { comicId } = req.params;
    const { isHot, isRecommended, isVipOnly } = req.body;

    const comic = await Comic.findById(comicId);
    if (!comic) {
      return res.status(404).json({ message: 'Comic not found' });
    }

    if (isHot !== undefined) comic.isHot = isHot;
    if (isRecommended !== undefined) comic.isRecommended = isRecommended;
    if (isVipOnly !== undefined) comic.isVipOnly = isVipOnly;

    await comic.save();

    res.json({
      message: 'Comic status updated successfully',
      comic
    });
  } catch (error) {
    console.error('Update comic status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get reported comments
const getReportedComments = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const comments = await Comment.find({ 'reports.0': { $exists: true } })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('author', 'username')
      .populate('comic', 'title')
      .populate('chapter', 'title');

    const total = await Comment.countDocuments({ 'reports.0': { $exists: true } });

    res.json({
      comments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get reported comments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Moderate comment
const moderateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { action } = req.body; // 'approve' or 'delete'

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (action === 'approve') {
      comment.isApproved = true;
      comment.reports = []; // Clear reports
      await comment.save();
    } else if (action === 'delete') {
      await Comment.findByIdAndDelete(commentId);
    }

    res.json({
      message: action === 'approve' ? 'Comment approved' : 'Comment deleted'
    });
  } catch (error) {
    console.error('Moderate comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
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
};