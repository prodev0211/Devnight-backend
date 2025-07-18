const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Register new user
const register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        message: existingUser.email === email ? 'Email already exists' : 'Username already exists'
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      role: role || 'user'
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isVip: user.isVip,
        avatar: user.avatar,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isVip: user.isVip,
        avatar: user.avatar,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// Get current user
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isVip: user.isVip,
        avatar: user.avatar,
        preferences: user.preferences,
        readingHistory: user.readingHistory,
        followedComics: user.followedComics,
        favoriteComics: user.favoriteComics
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { username, email, currentPassword, newPassword, preferences } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if new username/email already exists
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      user.username = username;
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists' });
      }
      user.email = email;
    }

    // Update password if provided
    if (currentPassword && newPassword) {
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      user.password = newPassword;
    }

    // Update preferences
    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isVip: user.isVip,
        avatar: user.avatar,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error during profile update' });
  }
};

// Upload avatar
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete old avatar if exists
    if (user.avatar) {
      // Extract public ID and delete from Cloudinary
      const { deleteFromCloudinary, extractPublicId } = require('../middleware/upload');
      const publicId = extractPublicId(user.avatar);
      await deleteFromCloudinary(publicId);
    }

    // Update user avatar
    user.avatar = req.file.path;
    await user.save();

    res.json({
      message: 'Avatar uploaded successfully',
      avatar: user.avatar
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ message: 'Server error during avatar upload' });
  }
};

// Follow/unfollow comic
const toggleFollowComic = async (req, res) => {
  try {
    const { comicId } = req.params;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isFollowing = await user.toggleFollowComic(comicId);

    res.json({
      message: isFollowing ? 'Comic followed' : 'Comic unfollowed',
      isFollowing
    });
  } catch (error) {
    console.error('Toggle follow error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add/remove favorite comic
const toggleFavoriteComic = async (req, res) => {
  try {
    const { comicId } = req.params;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isFavorite = await user.toggleFavoriteComic(comicId);

    res.json({
      message: isFavorite ? 'Comic added to favorites' : 'Comic removed from favorites',
      isFavorite
    });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get reading history
const getReadingHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const user = await User.findById(req.user.id)
      .populate({
        path: 'readingHistory.comic',
        select: 'title coverImage slug'
      })
      .populate({
        path: 'readingHistory.chapter',
        select: 'title chapterNumber'
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const history = user.readingHistory.slice(startIndex, endIndex);

    res.json({
      history,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: user.readingHistory.length,
        pages: Math.ceil(user.readingHistory.length / limit)
      }
    });
  } catch (error) {
    console.error('Get reading history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get followed comics
const getFollowedComics = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const user = await User.findById(req.user.id)
      .populate({
        path: 'followedComics.comic',
        select: 'title coverImage slug status lastUpdated statistics'
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const followed = user.followedComics.slice(startIndex, endIndex);

    res.json({
      followed,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: user.followedComics.length,
        pages: Math.ceil(user.followedComics.length / limit)
      }
    });
  } catch (error) {
    console.error('Get followed comics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get favorite comics
const getFavoriteComics = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const user = await User.findById(req.user.id)
      .populate({
        path: 'favoriteComics.comic',
        select: 'title coverImage slug status rating statistics'
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const favorites = user.favoriteComics.slice(startIndex, endIndex);

    res.json({
      favorites,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: user.favoriteComics.length,
        pages: Math.ceil(user.favoriteComics.length / limit)
      }
    });
  } catch (error) {
    console.error('Get favorite comics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  uploadAvatar,
  toggleFollowComic,
  toggleFavoriteComic,
  getReadingHistory,
  getFollowedComics,
  getFavoriteComics
};