const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');

// GET /api/profiles/:username
router.get('/:username', profileController.getProfile);

module.exports = router;
