const Chapter = require('../models/Chapter');
const Comic = require('../models/Comic');
const User = require('../models/User');

// Get chapters by comic
const getChaptersByComic = async (req, res) => {
  try {
    const { comicId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const comic = await Comic.findById(comicId);
    if (!comic) {
      return res.status(404).json({ message: 'Comic not found' });
    }

    const options = {
      limit: parseInt(limit),
      vipOnly: req.user && req.user.isVipActive() ? undefined : false
    };

    const chapters = await Chapter.getChaptersByComic(comicId, options);

    res.json({
      chapters,
      comic: {
        id: comic._id,
        title: comic.title,
        slug: comic.slug,
        isVipOnly: comic.isVipOnly
      }
    });
  } catch (error) {
    console.error('Get chapters by comic error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get chapter by comic and chapter number
const getChapterByNumber = async (req, res) => {
  try {
    const { comicId, chapterNumber } = req.params;

    const chapter = await Chapter.getChapterByNumber(comicId, parseInt(chapterNumber));
    
    if (!chapter) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    // Check VIP access
    if (chapter.isVipOnly && (!req.user || !req.user.isVipActive())) {
      return res.status(403).json({ message: 'VIP access required' });
    }

    // Get next and previous chapters
    const [nextChapter, prevChapter] = await Promise.all([
      chapter.getNextChapter(),
      chapter.getPreviousChapter()
    ]);

    // Increment views
    await chapter.incrementViews();

    // Add to reading history if user is authenticated
    if (req.user) {
      const user = await User.findById(req.user.id);
      await user.addToReadingHistory(chapter.comic._id, chapter._id);
    }

    res.json({
      chapter,
      navigation: {
        next: nextChapter ? {
          id: nextChapter._id,
          title: nextChapter.title,
          chapterNumber: nextChapter.chapterNumber
        } : null,
        previous: prevChapter ? {
          id: prevChapter._id,
          title: prevChapter.title,
          chapterNumber: prevChapter.chapterNumber
        } : null
      }
    });
  } catch (error) {
    console.error('Get chapter by number error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create new chapter (Author/Admin only)
const createChapter = async (req, res) => {
  try {
    const { comicId } = req.params;
    const { title, chapterNumber, content, isVipOnly, authorNotes } = req.body;

    // Check if comic exists and user has permission
    const comic = await Comic.findById(comicId);
    if (!comic) {
      return res.status(404).json({ message: 'Comic not found' });
    }

    if (req.user.role !== 'admin' && !comic.author.equals(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if chapter number already exists
    const existingChapter = await Chapter.findOne({
      comic: comicId,
      chapterNumber: parseInt(chapterNumber)
    });

    if (existingChapter) {
      return res.status(400).json({ message: 'Chapter number already exists' });
    }

    // Validate uploaded images
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one image is required' });
    }

    // Process images
    const images = req.files.map((file, index) => ({
      url: file.path,
      order: index + 1,
      width: file.width || 0,
      height: file.height || 0,
      size: file.size
    }));

    const chapter = new Chapter({
      title,
      chapterNumber: parseInt(chapterNumber),
      comic: comicId,
      images,
      content,
      isVipOnly: isVipOnly || false,
      authorNotes,
      isPublished: true,
      isApproved: req.user.role === 'admin' // Auto-approve for admin
    });

    await chapter.save();
    await chapter.populate('comic', 'title slug');

    // Update comic statistics
    await comic.updateStatistics();

    res.status(201).json({
      message: 'Chapter created successfully',
      chapter
    });
  } catch (error) {
    console.error('Create chapter error:', error);
    res.status(500).json({ message: 'Server error during chapter creation' });
  }
};

// Update chapter (Author/Admin only)
const updateChapter = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, chapterNumber, content, isVipOnly, authorNotes } = req.body;

    const chapter = await Chapter.findById(id).populate('comic');
    if (!chapter) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    // Check ownership
    if (req.user.role !== 'admin' && !chapter.comic.author.equals(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update fields
    if (title) chapter.title = title;
    if (content !== undefined) chapter.content = content;
    if (isVipOnly !== undefined) chapter.isVipOnly = isVipOnly;
    if (authorNotes !== undefined) chapter.authorNotes = authorNotes;

    // Update chapter number if provided and different
    if (chapterNumber && parseInt(chapterNumber) !== chapter.chapterNumber) {
      // Check if new chapter number already exists
      const existingChapter = await Chapter.findOne({
        comic: chapter.comic._id,
        chapterNumber: parseInt(chapterNumber),
        _id: { $ne: id }
      });

      if (existingChapter) {
        return res.status(400).json({ message: 'Chapter number already exists' });
      }

      chapter.chapterNumber = parseInt(chapterNumber);
    }

    // Update images if provided
    if (req.files && req.files.length > 0) {
      // Delete old images from Cloudinary
      const { deleteFromCloudinary, extractPublicId } = require('../middleware/upload');
      for (const image of chapter.images) {
        const publicId = extractPublicId(image.url);
        await deleteFromCloudinary(publicId);
      }

      // Add new images
      chapter.images = req.files.map((file, index) => ({
        url: file.path,
        order: index + 1,
        width: file.width || 0,
        height: file.height || 0,
        size: file.size
      }));
    }

    await chapter.save();

    res.json({
      message: 'Chapter updated successfully',
      chapter
    });
  } catch (error) {
    console.error('Update chapter error:', error);
    res.status(500).json({ message: 'Server error during chapter update' });
  }
};

// Delete chapter (Author/Admin only)
const deleteChapter = async (req, res) => {
  try {
    const { id } = req.params;

    const chapter = await Chapter.findById(id).populate('comic');
    if (!chapter) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    // Check ownership
    if (req.user.role !== 'admin' && !chapter.comic.author.equals(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Delete images from Cloudinary
    const { deleteFromCloudinary, extractPublicId } = require('../middleware/upload');
    for (const image of chapter.images) {
      const publicId = extractPublicId(image.url);
      await deleteFromCloudinary(publicId);
    }

    // Delete chapter
    await Chapter.findByIdAndDelete(id);

    // Update comic statistics
    await chapter.comic.updateStatistics();

    res.json({ message: 'Chapter deleted successfully' });
  } catch (error) {
    console.error('Delete chapter error:', error);
    res.status(500).json({ message: 'Server error during chapter deletion' });
  }
};

// Get latest chapters
const getLatestChapters = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const chapters = await Chapter.getLatestChapters(parseInt(limit));

    res.json({ chapters });
  } catch (error) {
    console.error('Get latest chapters error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get most viewed chapters
const getMostViewedChapters = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const chapters = await Chapter.getMostViewed(parseInt(limit));

    res.json({ chapters });
  } catch (error) {
    console.error('Get most viewed chapters error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get chapter comments
const getChapterComments = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, sort = 'latest' } = req.query;

    const Comment = require('../models/Comment');
    const comments = await Comment.getCommentsByChapter(id, {
      sort: sort === 'oldest' ? 'oldest' : 'latest',
      limit: parseInt(limit)
    });

    res.json({ comments });
  } catch (error) {
    console.error('Get chapter comments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add comment to chapter
const addChapterComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, parentComment } = req.body;

    const chapter = await Chapter.findById(id);
    if (!chapter) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    const Comment = require('../models/Comment');
    const comment = new Comment({
      content,
      author: req.user.id,
      chapter: id,
      parentComment: parentComment || null
    });

    await comment.save();
    await comment.populate('author', 'username avatar');

    res.status(201).json({
      message: 'Comment added successfully',
      comment
    });
  } catch (error) {
    console.error('Add chapter comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getChaptersByComic,
  getChapterByNumber,
  createChapter,
  updateChapter,
  deleteChapter,
  getLatestChapters,
  getMostViewedChapters,
  getChapterComments,
  addChapterComment
};