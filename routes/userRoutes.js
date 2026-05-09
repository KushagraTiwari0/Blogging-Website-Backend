const express = require('express');
const router = express.Router();
const userController = require('../controllers/usersController');
const verifyJWT = require("../middleware/verifyJWT");

// POST /api/users          → register (step 1: validate + send OTP)
router.post('/users', userController.registerUser);

// POST /api/users/login    → login (step 1: validate + send OTP)
router.post('/users/login', userController.userLogin);

// POST /api/users/verify-otp → step 2: verify OTP (shared for login + register)
router.post('/users/verify-otp', userController.verifyOTP);

// POST /api/users/resend-otp → resend OTP (shared for login + register)
router.post('/users/resend-otp', userController.resendOTP);

// GET  /api/user           → get current logged-in user (protected)
router.get('/user', verifyJWT, userController.getCurrentUser);

// PUT  /api/user           → update current user (protected)
router.put('/user', verifyJWT, userController.updateUser);

module.exports = router;