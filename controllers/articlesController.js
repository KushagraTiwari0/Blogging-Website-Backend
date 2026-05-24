const Article = require("../models/Article");
const User = require("../models/User");
// STEP 6 (Auto-update): Bust sitemap cache after any article mutation
const sitemapCache = require('../utils/sitemapCache');

const createArticle = async (req, res) => {
  const id = req.userId;
  const author = await User.findById(id).exec();
  const { title = "", description, body, tagList } = req.body.article;

  if (!title || !description || !body) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const article = await Article.create({ title, description, body });
  article.author = id;

  if (Array.isArray(tagList) && tagList.length > 0) {
    article.tagList = [...new Set(tagList.map(t => t.trim().toLowerCase()).filter(Boolean))];
  }

  await article.save();

  // Invalidate sitemap so the new article appears on the next crawl.
  sitemapCache.invalidate();

  return res.status(200).json({ article: await article.toArticleResponse(author) });
};

// ── Your Feed — only posts from followed users ─────────────────
const feedArticles = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const user = req.loggedin ? await User.findById(req.userId).exec() : null;

    if (!user || !user.following?.length) {
      return res.status(200).json({ articles: [], articlesCount: 0, followingCount: 0 });
    }

    const query = { author: { $in: user.following } };
    const articlesCount = await Article.countDocuments(query);
    
    const articles = await Article.find(query)
      .limit(limit)
      .skip(offset)
      .sort({ createdAt: -1 })
      .populate("author")
      .exec();

    const formattedArticles = await Promise.all(
      articles.map((a) => a.toArticleResponse(user, a.author))
    );

    return res.status(200).json({
      articles: formattedArticles,
      articlesCount,
      followingCount: user.following.length,
    });
  } catch (err) {
    console.error("Error fetching feed articles", err);
    return res.status(500).json({ error: "Error fetching articles" });
  }
};

// ── Global Feed ────────────────────────────────────────────────
const listArticles = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    let query = {};

    // Filter by tag (case-insensitive)
    if (req.query.tag) {
      query.tagList = { $regex: new RegExp(`^${req.query.tag}$`, 'i') };
    }

    // Filter by author username
    if (req.query.author) {
      const authorUsername = (req.query.author.startsWith("@")
        ? req.query.author.substring(1)
        : req.query.author).trim();
      const author = await User.findOne({ username: authorUsername }).exec();
      if (author) {
        query.author = author._id;
      } else {
        return res.status(200).json({ articles: [], articlesCount: 0 });
      }
    }

    // ── Filter by favorited username ───────────────────────
    if (req.query.favorited) {
      const favUsername = (req.query.favorited.startsWith("@")
        ? req.query.favorited.substring(1)
        : req.query.favorited).trim();

      const favUser = await User.findOne({ username: favUsername }).exec();

      if (!favUser) {
        return res.status(200).json({ articles: [], articlesCount: 0 });
      }

      query.favorites = favUser._id;
    }

    const articlesCount = await Article.countDocuments(query);
    const articles = await Article.find(query)
      .limit(limit)
      .skip(offset)
      .sort({ createdAt: -1 })
      .populate("author")
      .exec();

    const user = req.loggedin ? await User.findById(req.userId).exec() : false;

    const formattedArticles = await Promise.all(
      articles.map((a) => a.toArticleResponse(user, a.author))
    );

    return res.status(200).json({ 
      articles: formattedArticles,
      articlesCount 
    });
  } catch (err) {
    console.error("Error fetching articles", err);
    return res.status(500).json({ error: "Error fetching articles" });
  }
};

const getArticleWithSlug = async (req, res) => {
  const { slug } = req.params;
  const article = await Article.findOne({ slug }).exec();

  if (!article) {
    return res.status(404).json({ message: "Article Not Found" });
  }

  const user = req.loggedin ? await User.findById(req.userId).exec() : false;
  return res.status(200).json({ article: await article.toArticleResponse(user) });
};

const updateArticle = async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.userId;
    const article = await Article.findOne({ slug }).exec();

    if (!article) return res.status(404).json({ message: "Article Not Found" });
    if (article.author.toString() !== userId.toString())
      return res.status(403).json({ message: "You are not authorized to update this article" });

    const { title, description, body, tagList } = req.body.article;
    if (title !== undefined) article.title = title;
    if (description !== undefined) article.description = description;
    if (body !== undefined) article.body = body;
    if (Array.isArray(tagList)) article.tagList = [...new Set(tagList.map(t => t.trim().toLowerCase()).filter(Boolean))];

    await article.save();

    // Invalidate sitemap so the updated lastmod is reflected immediately.
    sitemapCache.invalidate();

    const author = await User.findById(userId).exec();
    return res.status(200).json({ article: await article.toArticleResponse(author) });
  } catch (err) {
    console.error("Error updating article", err);
    return res.status(500).json({ error: "Error updating article" });
  }
};

const deleteArticle = async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.userId;
    const article = await Article.findOne({ slug }).exec();

    if (!article) return res.status(404).json({ message: "Article Not Found" });
    if (article.author.toString() !== userId.toString())
      return res.status(403).json({ message: "You are not authorized to delete this article" });

    await Article.deleteOne({ _id: article._id });

    // Invalidate sitemap so the deleted article is removed from the next crawl.
    sitemapCache.invalidate();

    return res.status(200).json({ message: "Article deleted successfully" });
  } catch (err) {
    console.error("Error deleting article", err);
    return res.status(500).json({ error: "Error deleting article" });
  }
};

const favoriteArticle = async (req, res) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug }).exec();
    if (!article) return res.status(404).json({ errors: { article: ["not found"] } });

    const user = await User.findById(req.userId).exec();
    if (!user) return res.status(401).json({ errors: { user: ["not authenticated"] } });

    await article.favorite(req.userId);
    return res.status(200).json({ article: await article.toArticleResponse(user) });
  } catch (err) {
    console.error("Error favoriting article", err);
    return res.status(500).json({ errors: { body: [err.message] } });
  }
};

const unfavoriteArticle = async (req, res) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug }).exec();
    if (!article) return res.status(404).json({ errors: { article: ["not found"] } });

    const user = await User.findById(req.userId).exec();
    if (!user) return res.status(401).json({ errors: { user: ["not authenticated"] } });

    await article.unfavorite(req.userId);
    return res.status(200).json({ article: await article.toArticleResponse(user) });
  } catch (err) {
    console.error("Error unfavoriting article", err);
    return res.status(500).json({ errors: { body: [err.message] } });
  }
};

module.exports = {
  createArticle,
  feedArticles,
  listArticles,
  getArticleWithSlug,
  updateArticle,
  deleteArticle,
  favoriteArticle,
  unfavoriteArticle,
};