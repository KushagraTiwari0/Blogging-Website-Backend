const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/\S+@\S+\.\S+/, "is valid"],
    index: true,
  },
  bio: {
    type: String,
    default: "",
  },
  image: {
    type: String,
    default: "",
  },
  // ── Follow system ──────────────────────────────────────────
  following: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  followers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
});

// ── Token ──────────────────────────────────────────────────────
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { user: { id: this._id, email: this.email, password: this.password } },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "1d" }
  );
};

// ── Responses ──────────────────────────────────────────────────
userSchema.methods.toUserResponse = function () {
  return {
    username: this.username,
    email: this.email,
    bio: this.bio,
    image: this.image,
    token: this.generateAccessToken(),
  };
};

userSchema.methods.toProfileJSON = function (currentUser) {
  const isFollowing = currentUser
    ? currentUser.following?.some(
        (id) => id.toString() === this._id.toString()
      )
    : false;

  return {
    username:       this.username,
    bio:            this.bio || "",
    image:          this.image || "",
    following:      isFollowing,
    followersCount: this.followers?.length ?? 0,
    followingCount: this.following?.length ?? 0,
  };
};

// ── Follow helpers ─────────────────────────────────────────────
userSchema.methods.follow = async function (targetUserId) {
  if (!this.following.map(String).includes(String(targetUserId))) {
    this.following.push(targetUserId);
    await this.save();
  }
  const target = await mongoose.model("User").findById(targetUserId);
  if (target && !target.followers.map(String).includes(String(this._id))) {
    target.followers.push(this._id);
    await target.save();
  }
};

userSchema.methods.unfollow = async function (targetUserId) {
  this.following = this.following.filter(
    (id) => id.toString() !== targetUserId.toString()
  );
  await this.save();
  const target = await mongoose.model("User").findById(targetUserId);
  if (target) {
    target.followers = target.followers.filter(
      (id) => id.toString() !== this._id.toString()
    );
    await target.save();
  }
};

userSchema.methods.isFollowing = function (targetUserId) {
  return this.following.some(
    (id) => id.toString() === targetUserId.toString()
  );
};

module.exports = mongoose.model("User", userSchema);