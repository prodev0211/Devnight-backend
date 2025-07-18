const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  comic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comic'
  },
  chapter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chapter'
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  isApproved: {
    type: Boolean,
    default: true
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    likedAt: {
      type: Date,
      default: Date.now
    }
  }],
  dislikes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    dislikedAt: {
      type: Date,
      default: Date.now
    }
  }],
  reports: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['spam', 'harassment', 'inappropriate', 'other']
    },
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }],
  statistics: {
    totalLikes: {
      type: Number,
      default: 0
    },
    totalDislikes: {
      type: Number,
      default: 0
    },
    totalReplies: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes
commentSchema.index({ comic: 1, createdAt: -1 });
commentSchema.index({ chapter: 1, createdAt: -1 });
commentSchema.index({ author: 1 });
commentSchema.index({ parentComment: 1 });
commentSchema.index({ isApproved: 1 });

// Virtual for replies
commentSchema.virtual('replies', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parentComment',
  options: { sort: { createdAt: 1 } }
});

// Pre-save middleware
commentSchema.pre('save', function(next) {
  if (this.isModified('content') && !this.isNew) {
    this.isEdited = true;
    this.editedAt = new Date();
  }
  next();
});

// Post-save middleware to update statistics
commentSchema.post('save', async function(doc) {
  if (doc.isNew) {
    // Update parent comment reply count
    if (doc.parentComment) {
      await this.constructor.findByIdAndUpdate(
        doc.parentComment,
        { $inc: { 'statistics.totalReplies': 1 } }
      );
    }
    
    // Update comic/chapter comment count
    if (doc.comic) {
      const Comic = mongoose.model('Comic');
      await Comic.findByIdAndUpdate(
        doc.comic,
        { $inc: { 'statistics.totalComments': 1 } }
      );
    }
    
    if (doc.chapter) {
      const Chapter = mongoose.model('Chapter');
      await Chapter.findByIdAndUpdate(
        doc.chapter,
        { $inc: { 'statistics.totalComments': 1 } }
      );
    }
  }
});

// Methods
commentSchema.methods.toggleLike = async function(userId) {
  const existingLike = this.likes.find(like => like.user.equals(userId));
  const existingDislike = this.dislikes.find(dislike => dislike.user.equals(userId));
  
  if (existingLike) {
    // Remove like
    this.likes = this.likes.filter(like => !like.user.equals(userId));
    this.statistics.totalLikes -= 1;
  } else {
    // Add like
    if (existingDislike) {
      // Remove dislike if exists
      this.dislikes = this.dislikes.filter(dislike => !dislike.user.equals(userId));
      this.statistics.totalDislikes -= 1;
    }
    this.likes.push({ user: userId, likedAt: new Date() });
    this.statistics.totalLikes += 1;
  }
  
  await this.save();
  return !existingLike; // Return true if liked, false if unliked
};

commentSchema.methods.toggleDislike = async function(userId) {
  const existingDislike = this.dislikes.find(dislike => dislike.user.equals(userId));
  const existingLike = this.likes.find(like => like.user.equals(userId));
  
  if (existingDislike) {
    // Remove dislike
    this.dislikes = this.dislikes.filter(dislike => !dislike.user.equals(userId));
    this.statistics.totalDislikes -= 1;
  } else {
    // Add dislike
    if (existingLike) {
      // Remove like if exists
      this.likes = this.likes.filter(like => !like.user.equals(userId));
      this.statistics.totalLikes -= 1;
    }
    this.dislikes.push({ user: userId, dislikedAt: new Date() });
    this.statistics.totalDislikes += 1;
  }
  
  await this.save();
  return !existingDislike; // Return true if disliked, false if undisliked
};

commentSchema.methods.addReport = async function(userId, reason) {
  const existingReport = this.reports.find(report => report.user.equals(userId));
  
  if (!existingReport) {
    this.reports.push({
      user: userId,
      reason: reason,
      reportedAt: new Date()
    });
    await this.save();
  }
  
  return this.reports.length;
};

// Static methods
commentSchema.statics.getCommentsByComic = function(comicId, options = {}) {
  return this.find({
    comic: comicId,
    parentComment: null,
    isApproved: true
  })
    .sort({ createdAt: options.sort === 'oldest' ? 1 : -1 })
    .limit(options.limit || 20)
    .populate('author', 'username avatar')
    .populate('replies');
};

commentSchema.statics.getCommentsByChapter = function(chapterId, options = {}) {
  return this.find({
    chapter: chapterId,
    parentComment: null,
    isApproved: true
  })
    .sort({ createdAt: options.sort === 'oldest' ? 1 : -1 })
    .limit(options.limit || 20)
    .populate('author', 'username avatar')
    .populate('replies');
};

commentSchema.statics.getLatestComments = function(limit = 20) {
  return this.find({ isApproved: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('author', 'username avatar')
    .populate('comic', 'title slug')
    .populate('chapter', 'title chapterNumber');
};

module.exports = mongoose.model('Comment', commentSchema);