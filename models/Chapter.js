const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const chapterSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  chapterNumber: {
    type: Number,
    required: true
  },
  comic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comic',
    required: true
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    order: {
      type: Number,
      required: true
    },
    width: Number,
    height: Number,
    size: Number // in bytes
  }],
  content: {
    type: String,
    trim: true
  },
  isVipOnly: {
    type: Boolean,
    default: false
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  },
  publishedAt: {
    type: Date
  },
  // SEO fields
  seoTitle: String,
  seoDescription: String,
  // Admin fields
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectionReason: String,
  // Author notes
  authorNotes: {
    type: String,
    trim: true
  },
  // Statistics
  statistics: {
    totalComments: {
      type: Number,
      default: 0
    },
    totalLikes: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes
chapterSchema.index({ comic: 1, chapterNumber: 1 }, { unique: true });
chapterSchema.index({ comic: 1, publishedAt: -1 });
chapterSchema.index({ isPublished: 1 });
chapterSchema.index({ isApproved: 1 });
chapterSchema.index({ views: -1 });

// Virtual for comments
chapterSchema.virtual('comments', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'chapter'
});

// Pre-save middleware
chapterSchema.pre('save', function(next) {
  if (this.isModified('isPublished') && this.isPublished && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

// Post-save middleware to update comic statistics
chapterSchema.post('save', async function(doc) {
  if (doc.isPublished && doc.isApproved) {
    const Comic = mongoose.model('Comic');
    const comic = await Comic.findById(doc.comic);
    if (comic) {
      await comic.updateStatistics();
    }
  }
});

// Methods
chapterSchema.methods.incrementViews = async function() {
  this.views += 1;
  await this.save();
  
  // Also increment comic views
  const Comic = mongoose.model('Comic');
  const comic = await Comic.findById(this.comic);
  if (comic) {
    await comic.incrementViews();
  }
};

chapterSchema.methods.getNextChapter = async function() {
  return await this.constructor.findOne({
    comic: this.comic,
    chapterNumber: { $gt: this.chapterNumber },
    isPublished: true,
    isApproved: true
  }).sort({ chapterNumber: 1 });
};

chapterSchema.methods.getPreviousChapter = async function() {
  return await this.constructor.findOne({
    comic: this.comic,
    chapterNumber: { $lt: this.chapterNumber },
    isPublished: true,
    isApproved: true
  }).sort({ chapterNumber: -1 });
};

// Static methods
chapterSchema.statics.getLatestChapters = function(limit = 20) {
  return this.find({ isPublished: true, isApproved: true })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate('comic', 'title coverImage slug')
    .populate('comic.author', 'username');
};

chapterSchema.statics.getChaptersByComic = function(comicId, options = {}) {
  const query = {
    comic: comicId,
    isPublished: true,
    isApproved: true
  };
  
  if (options.vipOnly !== undefined) {
    query.isVipOnly = options.vipOnly;
  }
  
  return this.find(query)
    .sort({ chapterNumber: options.reverse ? -1 : 1 })
    .limit(options.limit || 50)
    .select(options.select || 'title chapterNumber publishedAt views');
};

chapterSchema.statics.getChapterByNumber = function(comicId, chapterNumber) {
  return this.findOne({
    comic: comicId,
    chapterNumber: chapterNumber,
    isPublished: true,
    isApproved: true
  }).populate('comic', 'title slug author isVipOnly');
};

chapterSchema.statics.getMostViewed = function(limit = 10) {
  return this.find({ isPublished: true, isApproved: true })
    .sort({ views: -1 })
    .limit(limit)
    .populate('comic', 'title coverImage slug')
    .populate('comic.author', 'username');
};

// Add pagination plugin
chapterSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Chapter', chapterSchema);