const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const User = require("./User");
const slugify = require("slugify");

const articleSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    tagList: [
      {
        type: String,
      },
    ],
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // ── Favorites ──────────────────────────────────────────
    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    favoritesCount: {
      type: Number,
      default: 0,
    },
    // ── Comments ───────────────────────────────────────────
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
  },
  {
    timestamps: true,
  }
);

articleSchema.plugin(uniqueValidator);

// Slug from title
articleSchema.pre("save", function (next) {
  this.slug = slugify(this.title, { lower: true, replacement: "-" });
  next();
});

// ── Favorite helpers ───────────────────────────────────────────
articleSchema.methods.favorite = function (userId) {
  if (!this.favorites.includes(userId)) {
    this.favorites.push(userId);
    this.favoritesCount = this.favorites.length;
  }
  return this.save();
};

articleSchema.methods.unfavorite = function (userId) {
  this.favorites = this.favorites.filter(
    (id) => id.toString() !== userId.toString()
  );
  this.favoritesCount = this.favorites.length;
  return this.save();
};

articleSchema.methods.isFavoritedBy = function (userId) {
  if (!userId) return false;
  return this.favorites.some((id) => id.toString() === userId.toString());
};

// ── Article response ───────────────────────────────────────────
articleSchema.methods.toArticleResponse = async function (user, prefetchedAuthor) {
  const authorObj = prefetchedAuthor || await User.findById(this.author).exec();

  return {
    slug:           this.slug,
    title:          this.title,
    description:    this.description,
    body:           this.body,
    createdAt:      this.createdAt,
    updatedAt:      this.updatedAt,
    tagList:        this.tagList,
    favorited:      user ? this.isFavoritedBy(user._id ?? user.id) : false,
    favoritesCount: this.favoritesCount,
    author:         authorObj ? authorObj.toProfileJSON(user) : null,
  };
};

// ── Comment helpers ────────────────────────────────────────────
articleSchema.methods.addComment = async function (commentId) {
  if (this.comments.indexOf(commentId) === -1) {
    this.comments.push(commentId);
  }
  return this.save();
};

articleSchema.methods.removeComment = async function (commentId) {
  if (this.comments.indexOf(commentId) !== -1) {
    this.comments.pull(commentId);
  }
  return this.save();
};

module.exports = mongoose.model("Article", articleSchema);