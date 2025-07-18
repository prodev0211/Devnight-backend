const Comic = require('../models/Comic');
const Chapter = require('../models/Chapter');
const User = require('../models/User');

// Get all comics with pagination and filtering
const getComics = async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = 'latest', category, status, search } = req.query;
    
    let query = { isApproved: true };
    let sortOptions = {};

    // Apply filters
    if (category) {
      query.categories = category;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { alternativeTitle: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort options
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
        { path: 'author', select: 'username' },
        { path: 'categories', select: 'name color' }
      ]
    };

    const comics = await Comic.paginate(query, options);

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
    console.error('Get comics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get featured comics for homepage
const getFeaturedComics = async (req, res) => {
  try {
    const [hot, popular, recommended, latest] = await Promise.all([
      Comic.getHot(10),
      Comic.getPopular(10),
      Comic.getRecommended(10),
      Comic.getLatest(10)
    ]);

    res.json({
      hot,
      popular,
      recommended,
      latest
    });
  } catch (error) {
    console.error('Get featured comics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get comic by slug
const getComicBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    const comic = await Comic.findOne({ slug, isApproved: true })
      .populate('author', 'username avatar')
      .populate('categories', 'name color slug')
      .populate({
        path: 'chapters',
        match: { isPublished: true, isApproved: true },
        select: 'title chapterNumber publishedAt views',
        options: { sort: { chapterNumber: 1 } }
      });

    if (!comic) {
      return res.status(404).json({ message: 'Comic not found' });
    }

    // Increment views
    await comic.incrementViews();

    // Add reading history if user is authenticated
    if (req.user) {
      const user = await User.findById(req.user.id);
      // Check if user follows/favorites this comic
      const isFollowing = user.followedComics.some(item => item.comic.equals(comic._id));
      const isFavorite = user.favoriteComics.some(item => item.comic.equals(comic._id));
      
      res.json({
        comic,
        userInteraction: {
          isFollowing,
          isFavorite
        }
      });
    } else {
      res.json({ comic });
    }
  } catch (error) {
    console.error('Get comic by slug error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create new comic (Author/Admin only)
const createComic = async (req, res) => {
  try {
    const { title, description, alternativeTitle, artists, categories, tags, status, isVipOnly } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Cover image is required' });
    }

    const comic = new Comic({
      title,
      description,
      alternativeTitle,
      coverImage: req.file.path,
      author: req.user.id,
      artists: artists || [],
      categories: categories || [],
      tags: tags || [],
      status: status || 'ongoing',
      isVipOnly: isVipOnly || false,
      isApproved: req.user.role === 'admin' // Auto-approve for admin
    });

    await comic.save();
    await comic.populate('author', 'username');
    await comic.populate('categories', 'name color');

    res.status(201).json({
      message: 'Comic created successfully',
      comic
    });
  } catch (error) {
    console.error('Create comic error:', error);
    res.status(500).json({ message: 'Server error during comic creation' });
  }
};

// Update comic (Author/Admin only)
const updateComic = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, alternativeTitle, artists, categories, tags, status, isVipOnly } = req.body;

    const comic = await Comic.findById(id);
    if (!comic) {
      return res.status(404).json({ message: 'Comic not found' });
    }

    // Check ownership
    if (req.user.role !== 'admin' && !comic.author.equals(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update fields
    if (title) comic.title = title;
    if (description) comic.description = description;
    if (alternativeTitle !== undefined) comic.alternativeTitle = alternativeTitle;
    if (artists) comic.artists = artists;
    if (categories) comic.categories = categories;
    if (tags) comic.tags = tags;
    if (status) comic.status = status;
    if (isVipOnly !== undefined) comic.isVipOnly = isVipOnly;

    // Update cover image if provided
    if (req.file) {
      // Delete old cover image
      if (comic.coverImage) {
        const { deleteFromCloudinary, extractPublicId } = require('../middleware/upload');
        const publicId = extractPublicId(comic.coverImage);
        await deleteFromCloudinary(publicId);
      }
      comic.coverImage = req.file.path;
    }

    comic.lastUpdated = new Date();
    await comic.save();
    await comic.populate('author', 'username');
    await comic.populate('categories', 'name color');

    res.json({
      message: 'Comic updated successfully',
      comic
    });
  } catch (error) {
    console.error('Update comic error:', error);
    res.status(500).json({ message: 'Server error during comic update' });
  }
};

// Delete comic (Author/Admin only)
const deleteComic = async (req, res) => {
  try {
    const { id } = req.params;
    
    const comic = await Comic.findById(id);
    if (!comic) {
      return res.status(404).json({ message: 'Comic not found' });
    }

    // Check ownership
    if (req.user.role !== 'admin' && !comic.author.equals(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Delete cover image from Cloudinary
    if (comic.coverImage) {
      const { deleteFromCloudinary, extractPublicId } = require('../middleware/upload');
      const publicId = extractPublicId(comic.coverImage);
      await deleteFromCloudinary(publicId);
    }

    // Delete all chapters and their images
    const chapters = await Chapter.find({ comic: id });
    for (const chapter of chapters) {
      for (const image of chapter.images) {
        const { deleteFromCloudinary, extractPublicId } = require('../middleware/upload');
        const publicId = extractPublicId(image.url);
        await deleteFromCloudinary(publicId);
      }
    }

    // Delete chapters
    await Chapter.deleteMany({ comic: id });

    // Delete comic
    await Comic.findByIdAndDelete(id);

    res.json({ message: 'Comic deleted successfully' });
  } catch (error) {
    console.error('Delete comic error:', error);
    res.status(500).json({ message: 'Server error during comic deletion' });
  }
};

// Get comics by author
const getComicsByAuthor = async (req, res) => {
  try {
    const { authorId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const query = { author: authorId, isApproved: true };
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { lastUpdated: -1 },
      populate: [
        { path: 'categories', select: 'name color' }
      ]
    };

    const comics = await Comic.paginate(query, options);

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
    console.error('Get comics by author error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Search comics
const searchComics = async (req, res) => {
  try {
    const { q, categories, status, sort = 'popular', page = 1, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const options = {
      categories: categories ? categories.split(',') : undefined,
      status,
      sort: sort === 'popular' ? { 'views.total': -1 } : 
            sort === 'rating' ? { 'rating.average': -1 } :
            sort === 'latest' ? { lastUpdated: -1 } : 
            { title: 1 },
      limit: parseInt(limit)
    };

    const comics = await Comic.searchComics(q, options);
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedComics = comics.slice(startIndex, endIndex);

    res.json({
      comics: paginatedComics,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: comics.length,
        pages: Math.ceil(comics.length / limit)
      }
    });
  } catch (error) {
    console.error('Search comics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Rate comic
const rateComic = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const comic = await Comic.findById(id);
    if (!comic) {
      return res.status(404).json({ message: 'Comic not found' });
    }

    await comic.updateRating(rating);

    res.json({
      message: 'Rating submitted successfully',
      rating: comic.rating
    });
  } catch (error) {
    console.error('Rate comic error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getComics,
  getFeaturedComics,
  getComicBySlug,
  createComic,
  updateComic,
  deleteComic,
  getComicsByAuthor,
  searchComics,
  rateComic
};