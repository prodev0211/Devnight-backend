const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const comicSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  alternativeTitle: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  coverImage: {
    type: String,
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  artists: [{
    type: String,
    trim: true
  }],
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  tags: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['ongoing', 'completed', 'paused', 'dropped'],
    default: 'ongoing'
  },
  isVipOnly: {
    type: Boolean,
    default: false
  },
  isRecommended: {
    type: Boolean,
    default: false
  },
  isHot: {
    type: Boolean,
    default: false
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  views: {
    total: {
      type: Number,
      default: 0
    },
    weekly: {
      type: Number,
      default: 0
    },
    monthly: {
      type: Number,
      default: 0
    }
  },
  statistics: {
    totalChapters: {
      type: Number,
      default: 0
    },
    totalFollows: {
      type: Number,
      default: 0
    },
    totalFavorites: {
      type: Number,
      default: 0
    },
    totalComments: {
      type: Number,
      default: 0
    }
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  publishedAt: {
    type: Date,
    default: Date.now
  },
  // SEO fields
  seoTitle: String,
  seoDescription: String,
  seoKeywords: [String],
  // Admin fields
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectionReason: String
}, {
  timestamps: true
});

// Indexes for better performance
comicSchema.index({ slug: 1 });
comicSchema.index({ title: 'text', description: 'text' });
comicSchema.index({ categories: 1 });
comicSchema.index({ author: 1 });
comicSchema.index({ isApproved: 1 });
comicSchema.index({ isHot: 1 });
comicSchema.index({ isRecommended: 1 });
comicSchema.index({ 'views.total': -1 });
comicSchema.index({ 'rating.average': -1 });
comicSchema.index({ lastUpdated: -1 });
comicSchema.index({ publishedAt: -1 });

// Virtual for chapters
comicSchema.virtual('chapters', {
  ref: 'Chapter',
  localField: '_id',
  foreignField: 'comic',
  options: { sort: { chapterNumber: 1 } }
});

// Virtual for comments
comicSchema.virtual('comments', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'comic'
});

// Pre-save middleware to generate slug
comicSchema.pre('save', async function(next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
    
    // Ensure slug is unique
    const existingComic = await this.constructor.findOne({ slug: this.slug });
    if (existingComic && !existingComic._id.equals(this._id)) {
      this.slug = `${this.slug}-${Date.now()}`;
    }
  }
  next();
});

// Methods
comicSchema.methods.incrementViews = async function() {
  this.views.total += 1;
  this.views.weekly += 1;
  this.views.monthly += 1;
  await this.save();
};

comicSchema.methods.updateRating = async function(newRating) {
  const totalRating = this.rating.average * this.rating.count + newRating;
  this.rating.count += 1;
  this.rating.average = totalRating / this.rating.count;
  await this.save();
};

comicSchema.methods.updateStatistics = async function() {
  const Chapter = mongoose.model('Chapter');
  const User = mongoose.model('User');
  
  // Update chapter count
  this.statistics.totalChapters = await Chapter.countDocuments({ comic: this._id });
  
  // Update follows count
  this.statistics.totalFollows = await User.countDocuments({
    'followedComics.comic': this._id
  });
  
  // Update favorites count
  this.statistics.totalFavorites = await User.countDocuments({
    'favoriteComics.comic': this._id
  });
  
  this.lastUpdated = new Date();
  await this.save();
};

// Static methods
comicSchema.statics.getPopular = function(limit = 10) {
  return this.find({ isApproved: true })
    .sort({ 'views.total': -1 })
    .limit(limit)
    .populate('author', 'username')
    .populate('categories', 'name');
};

comicSchema.statics.getHot = function(limit = 10) {
  return this.find({ isApproved: true, isHot: true })
    .sort({ 'views.weekly': -1 })
    .limit(limit)
    .populate('author', 'username')
    .populate('categories', 'name');
};

comicSchema.statics.getRecommended = function(limit = 10) {
  return this.find({ isApproved: true, isRecommended: true })
    .sort({ 'rating.average': -1 })
    .limit(limit)
    .populate('author', 'username')
    .populate('categories', 'name');
};

comicSchema.statics.getLatest = function(limit = 10) {
  return this.find({ isApproved: true })
    .sort({ lastUpdated: -1 })
    .limit(limit)
    .populate('author', 'username')
    .populate('categories', 'name');
};

comicSchema.statics.searchComics = function(query, options = {}) {
  const searchQuery = {
    $and: [
      { isApproved: true },
      {
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { alternativeTitle: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $regex: query, $options: 'i' } }
        ]
      }
    ]
  };
  
  if (options.categories && options.categories.length > 0) {
    searchQuery.$and.push({ categories: { $in: options.categories } });
  }
  
  if (options.status) {
    searchQuery.$and.push({ status: options.status });
  }
  
  return this.find(searchQuery)
    .sort(options.sort || { 'views.total': -1 })
    .limit(options.limit || 20)
    .populate('author', 'username')
    .populate('categories', 'name');
};

// Add pagination plugin
comicSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Comic', comicSchema);