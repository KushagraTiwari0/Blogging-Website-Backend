const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profileController");
const verifyJWT = require("../middleware/verifyJWT");
const verifyJWTOptional = require("../middleware/verifyJWTOptional");

// GET  /api/profiles/:username
router.get("/:username",            verifyJWTOptional, profileController.getProfile);

// POST /api/profiles/:username/follow
router.post("/:username/follow",    verifyJWT,         profileController.followUser);

// DELETE /api/profiles/:username/follow
router.delete("/:username/follow",  verifyJWT,         profileController.unfollowUser);

// GET /api/profiles/:username/followers
router.get("/:username/followers",  verifyJWTOptional, profileController.getFollowers);

// GET /api/profiles/:username/following
router.get("/:username/following",  verifyJWTOptional, profileController.getFollowing);

module.exports = router;