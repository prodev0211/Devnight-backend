const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Optional authentication (for features that work both with and without auth)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access required' });
  }
};

// Check if user is author or admin
const isAuthor = (req, res, next) => {
  if (req.user && (req.user.role === 'author' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Author access required' });
  }
};

// Check if user is VIP
const isVip = (req, res, next) => {
  if (req.user && req.user.isVipActive()) {
    next();
  } else {
    res.status(403).json({ message: 'VIP access required' });
  }
};

// Check if user owns the resource or is admin
const isOwnerOrAdmin = (resourceField = 'author') => {
  return (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
      return next();
    }
    
    // Check if user owns the resource
    if (req.resource && req.resource[resourceField] && req.resource[resourceField].equals(req.user._id)) {
      return next();
    }
    
    res.status(403).json({ message: 'Access denied' });
  };
};

module.exports = {
  auth,
  optionalAuth,
  isAdmin,
  isAuthor,
  isVip,
  isOwnerOrAdmin
};