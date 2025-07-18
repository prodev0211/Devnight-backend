const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    default: '#3B82F6' // Default blue color
  },
  icon: {
    type: String,
    default: 'folder'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  order: {
    type: Number,
    default: 0
  },
  // SEO fields
  seoTitle: String,
  seoDescription: String,
  seoKeywords: [String],
  // Statistics
  statistics: {
    totalComics: {
      type: Number,
      default: 0
    },
    totalViews: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes
categorySchema.index({ slug: 1 });
categorySchema.index({ name: 'text', description: 'text' });
categorySchema.index({ isActive: 1 });
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ order: 1 });

// Virtual for subcategories
categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentCategory',
  options: { sort: { order: 1 } }
});

// Virtual for comics
categorySchema.virtual('comics', {
  ref: 'Comic',
  localField: '_id',
  foreignField: 'categories'
});

// Pre-save middleware to generate slug
categorySchema.pre('save', async function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
    
    // Ensure slug is unique
    const existingCategory = await this.constructor.findOne({ slug: this.slug });
    if (existingCategory && !existingCategory._id.equals(this._id)) {
      this.slug = `${this.slug}-${Date.now()}`;
    }
  }
  next();
});

// Methods
categorySchema.methods.updateStatistics = async function() {
  const Comic = mongoose.model('Comic');
  
  // Count total comics in this category
  this.statistics.totalComics = await Comic.countDocuments({
    categories: this._id,
    isApproved: true
  });
  
  // Calculate total views for comics in this category
  const viewsResult = await Comic.aggregate([
    { $match: { categories: this._id, isApproved: true } },
    { $group: { _id: null, totalViews: { $sum: '$views.total' } } }
  ]);
  
  this.statistics.totalViews = viewsResult.length > 0 ? viewsResult[0].totalViews : 0;
  
  await this.save();
};

// Static methods
categorySchema.statics.getActiveCategories = function() {
  return this.find({ isActive: true })
    .sort({ order: 1, name: 1 })
    .populate('subcategories');
};

categorySchema.statics.getTopCategories = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ 'statistics.totalComics': -1 })
    .limit(limit);
};

categorySchema.statics.getCategoryBySlug = function(slug) {
  return this.findOne({ slug: slug, isActive: true })
    .populate('subcategories')
    .populate('parentCategory');
};

categorySchema.statics.searchCategories = function(query) {
  return this.find({
    $and: [
      { isActive: true },
      {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } }
        ]
      }
    ]
  }).sort({ 'statistics.totalComics': -1 });
};

module.exports = mongoose.model('Category', categorySchema);