const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const mongoosePaginate = require('mongoose-paginate-v2');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['user', 'author', 'admin'],
    default: 'user'
  },
  isVip: {
    type: Boolean,
    default: false
  },
  vipExpiry: {
    type: Date
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpiry: Date,
  // User preferences
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    language: {
      type: String,
      default: 'vi'
    },
    notifications: {
      newChapter: {
        type: Boolean,
        default: true
      },
      systemUpdate: {
        type: Boolean,
        default: true
      }
    }
  },
  // Reading history
  readingHistory: [{
    comic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comic'
    },
    chapter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chapter'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Followed comics
  followedComics: [{
    comic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comic'
    },
    followedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Favorite comics
  favoriteComics: [{
    comic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comic'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if user is VIP
userSchema.methods.isVipActive = function() {
  return this.isVip && this.vipExpiry && this.vipExpiry > new Date();
};

// Add to reading history
userSchema.methods.addToReadingHistory = async function(comicId, chapterId) {
  // Remove existing entry if exists
  this.readingHistory = this.readingHistory.filter(item => 
    !item.comic.equals(comicId) || !item.chapter.equals(chapterId)
  );
  
  // Add new entry at the beginning
  this.readingHistory.unshift({
    comic: comicId,
    chapter: chapterId,
    readAt: new Date()
  });
  
  // Keep only last 50 entries
  if (this.readingHistory.length > 50) {
    this.readingHistory = this.readingHistory.slice(0, 50);
  }
  
  await this.save();
};

// Follow/unfollow comic
userSchema.methods.toggleFollowComic = async function(comicId) {
  const existingIndex = this.followedComics.findIndex(item => 
    item.comic.equals(comicId)
  );
  
  if (existingIndex > -1) {
    this.followedComics.splice(existingIndex, 1);
  } else {
    this.followedComics.push({
      comic: comicId,
      followedAt: new Date()
    });
  }
  
  await this.save();
  return existingIndex === -1; // Return true if followed, false if unfollowed
};

// Add/remove favorite
userSchema.methods.toggleFavoriteComic = async function(comicId) {
  const existingIndex = this.favoriteComics.findIndex(item => 
    item.comic.equals(comicId)
  );
  
  if (existingIndex > -1) {
    this.favoriteComics.splice(existingIndex, 1);
  } else {
    this.favoriteComics.push({
      comic: comicId,
      addedAt: new Date()
    });
  }
  
  await this.save();
  return existingIndex === -1; // Return true if added, false if removed
};

// Add pagination plugin
userSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('User', userSchema);