const User = require("../models/User");

// ── Get Profile ────────────────────────────────────────────────
const getProfile = async (req, res) => {
  const { username } = req.params;
  const clean = (username.startsWith("@") ? username.substring(1) : username).trim();

  try {
    const profile = await User.findOne({ username: clean }).exec();
    if (!profile) return res.status(404).json({ message: "Profile Not Found" });

    const currentUser = req.loggedin
      ? await User.findById(req.userId).exec()
      : null;

    return res.status(200).json({ profile: profile.toProfileJSON(currentUser) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error fetching profile" });
  }
};

// ── Follow ─────────────────────────────────────────────────────
const followUser = async (req, res) => {
  const { username } = req.params;
  const clean = (username.startsWith("@") ? username.substring(1) : username).trim();

  try {
    const target = await User.findOne({ username: clean }).exec();
    if (!target) return res.status(404).json({ message: "User Not Found" });

    const currentUser = await User.findById(req.userId).exec();
    if (!currentUser) return res.status(401).json({ message: "Not authenticated" });

    if (target._id.toString() === currentUser._id.toString()) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    await currentUser.follow(target._id);

    // Re-fetch to get updated counts
    const updatedTarget = await User.findById(target._id).exec();
    return res.status(200).json({ profile: updatedTarget.toProfileJSON(currentUser) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error following user" });
  }
};

// ── Unfollow ───────────────────────────────────────────────────
const unfollowUser = async (req, res) => {
  const { username } = req.params;
  const clean = (username.startsWith("@") ? username.substring(1) : username).trim();

  try {
    const target = await User.findOne({ username: clean }).exec();
    if (!target) return res.status(404).json({ message: "User Not Found" });

    const currentUser = await User.findById(req.userId).exec();
    if (!currentUser) return res.status(401).json({ message: "Not authenticated" });

    await currentUser.unfollow(target._id);

    const updatedTarget = await User.findById(target._id).exec();
    return res.status(200).json({ profile: updatedTarget.toProfileJSON(currentUser) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error unfollowing user" });
  }
};

// ── Get Followers list ─────────────────────────────────────────
const getFollowers = async (req, res) => {
  const { username } = req.params;
  const clean = (username.startsWith("@") ? username.substring(1) : username).trim();

  try {
    const user = await User.findOne({ username: clean })
      .populate("followers", "username bio image")
      .exec();
    if (!user) return res.status(404).json({ message: "User Not Found" });

    const currentUser = req.loggedin
      ? await User.findById(req.userId).exec()
      : null;

    const followers = user.followers.map((f) => f.toProfileJSON(currentUser));
    return res.status(200).json({ followers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error fetching followers" });
  }
};

// ── Get Following list ─────────────────────────────────────────
const getFollowing = async (req, res) => {
  const { username } = req.params;
  const clean = (username.startsWith("@") ? username.substring(1) : username).trim();

  try {
    const user = await User.findOne({ username: clean })
      .populate("following", "username bio image")
      .exec();
    if (!user) return res.status(404).json({ message: "User Not Found" });

    const currentUser = req.loggedin
      ? await User.findById(req.userId).exec()
      : null;

    const following = user.following.map((f) => f.toProfileJSON(currentUser));
    return res.status(200).json({ following });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error fetching following" });
  }
};

module.exports = {
  getProfile,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
};