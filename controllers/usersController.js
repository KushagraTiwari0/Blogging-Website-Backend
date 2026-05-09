const User = require("../models/User");
const bcrypt = require("bcryptjs");
const dns = require("dns").promises;
const crypto = require("crypto");
const nodemailer = require("nodemailer");

// ─── OTP STORE ────────────────────────────────────────────────────────────────
// Stores both OTP codes and pending registrations
// { email -> { otp, expiresAt, pendingUser? } }
const otpStore = new Map();

// ─── MAILER ───────────────────────────────────────────────────────────────────
let transporter;

const createTransporter = () => {
  console.log("[MAILER] Creating transporter...");
  console.log("[MAILER] MAIL_USER:", process.env.MAIL_USER || "❌ NOT SET");
  console.log("[MAILER] MAIL_PASS:", process.env.MAIL_PASS ? "✅ SET" : "❌ NOT SET");

  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    family: 4,
    requireTLS: true,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

createTransporter();

transporter.verify((error) => {
  if (error) {
    console.error("[MAILER] ❌ SMTP connection failed:", error.message);
  } else {
    console.log("[MAILER] ✅ SMTP connection verified — ready to send mail");
  }
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const validateEmail = async (email) => {
  console.log(`[EMAIL VALIDATE] Checking format for: ${email}`);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.log("[EMAIL VALIDATE] ❌ Invalid format");
    return { valid: false, reason: "Invalid email format" };
  }

  const domain = email.split("@")[1];
  console.log(`[EMAIL VALIDATE] Checking MX records for domain: ${domain}`);
  try {
    const records = await dns.resolveMx(domain);
    if (!records || records.length === 0) {
      console.log("[EMAIL VALIDATE] ❌ No MX records found");
      return { valid: false, reason: "Email domain cannot receive mail" };
    }
    console.log(`[EMAIL VALIDATE] ✅ MX records found:`, records.map(r => r.exchange));
  } catch (err) {
    console.log("[EMAIL VALIDATE] ❌ DNS lookup failed:", err.message);
    return { valid: false, reason: "Email domain does not exist" };
  }

  return { valid: true };
};

const generateOTP = () => {
  const otp = crypto.randomInt(0, 1000000).toString().padStart(6, "0");
  console.log(`[OTP] Generated OTP: ${otp}`); // ⚠️ Remove in production
  return otp;
};

const sendOTP = async (email, purpose = "login") => {
  const otp = generateOTP();

  // Preserve any pendingUser data already stored (for registration flow)
  const existing = otpStore.get(email) || {};
  otpStore.set(email, {
    ...existing,
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  console.log(`[OTP] Stored OTP for ${email} (purpose: ${purpose}), expires in 5 minutes`);

  const subjectMap = {
    login: "Your Login OTP",
    register: "Verify your email to complete registration",
  };

  const bodyMap = {
    login: "Use the OTP below to complete your login:",
    register: "Use the OTP below to verify your email and complete registration:",
  };

  // ─── SEND EMAIL (Non-blocking) ─────────────────────────────────────────────
  // We don't await this to prevent the API response from hanging if SMTP is slow.
  transporter.sendMail({
    from: `"Blogging Platform" <${process.env.MAIL_USER}>`,
    to: email,
    subject: subjectMap[purpose] || "Your OTP",
    html: `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 40px auto; padding: 40px; border: 1px solid #e8e8e8; border-radius: 0; color: #111111; background-color: #ffffff;">
        
        <!-- Logo / Header -->
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: 700; margin: 0; letter-spacing: -0.02em;">Blogging</h1>
          <div style="width: 40px; height: 1px; background-color: #d0d0d0; margin: 16px auto 0;"></div>
        </div>

        <!-- Quotation -->
        <div style="text-align: center; margin-bottom: 40px; font-style: italic; color: #888888; font-family: Georgia, serif; font-size: 15px; line-height: 1.6; padding: 0 20px;">
          "Blogging is not just about writing, it's about sharing your voice and connecting with a world of ideas."
        </div>

        <!-- Main Content -->
        <div style="text-align: center;">
          <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.15em; color: #888888; margin-bottom: 24px; font-weight: 600;">
            ${purpose === 'login' ? 'Login Verification' : 'Email Verification'}
          </h2>
          <p style="font-size: 16px; margin-bottom: 32px; color: #3a3a3a;">
            ${bodyMap[purpose]}
          </p>
          
          <!-- OTP Box -->
          <div style="background-color: #fafafa; border: 1px solid #e8e8e8; padding: 24px; margin-bottom: 32px;">
            <div style="font-size: 38px; font-weight: 700; letter-spacing: 14px; color: #111111; margin-left: 14px;">
              ${otp}
            </div>
          </div>

          <p style="color: #888888; font-size: 13px; margin-top: 24px;">
            This code expires in <strong>5 minutes</strong>.<br>
            If you did not request this, please ignore this email.
          </p>
        </div>

        <!-- Footer -->
        <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #e8e8e8; text-align: center;">
          <p style="font-size: 11px; color: #b0b0b0; text-transform: uppercase; letter-spacing: 0.1em; margin: 0;">
            Sent by Blogging Platform
          </p>
        </div>
      </div>
    `,
  }).then(() => {
    console.log(`[MAILER] ✅ OTP email sent to ${email}`);
  }).catch(err => {
    console.error(`[MAILER] ❌ Failed to send email to ${email}:`, err.message);
  });
};

const verifyOTPCode = (email, inputOtp) => {
  console.log(`[OTP VERIFY] Verifying OTP for: ${email}`);
  const record = otpStore.get(email);

  if (!record) {
    console.log("[OTP VERIFY] ❌ No OTP found in store");
    return { valid: false, reason: "OTP not found. Please try again." };
  }

  const timeLeft = Math.round((record.expiresAt - Date.now()) / 1000);
  console.log(`[OTP VERIFY] Time remaining: ${timeLeft}s`);

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    console.log("[OTP VERIFY] ❌ OTP expired");
    return { valid: false, reason: "OTP has expired. Please try again." };
  }

  console.log(`[OTP VERIFY] Stored: ${record.otp} | Received: ${String(inputOtp)}`);

  if (record.otp !== String(inputOtp)) {
    console.log("[OTP VERIFY] ❌ OTP mismatch");
    return { valid: false, reason: "Wrong OTP! Please check your email and fill it again." };
  }

  console.log("[OTP VERIFY] ✅ OTP matched");
  return { valid: true, record };
};

// ─── CONTROLLERS ─────────────────────────────────────────────────────────────

const getCurrentUser = async (req, res) => {
  const email = req.userEmail;
  const user = await User.findOne({ email }).exec();
  if (!user) return res.status(404).json({ message: "User Not Found" });
  return res.status(200).json({ user: user.toUserResponse() });
};

/**
 * REGISTER — Step 1
 * Validates input + email domain, stores pending user data, sends OTP.
 * Does NOT create the user yet — waits for OTP verification.
 */
const registerUser = async (req, res) => {
  console.log("\n[REGISTER] ── New registration attempt ────────────");
  const { user } = req.body;

  if (!user || !user.email || !user.password || !user.username) {
    return res.status(400).json({ message: "All fields are required" });
  }

  console.log(`[REGISTER] Email: ${user.email}`);

  // Check if email already registered
  const existing = await User.findOne({ email: user.email }).exec();
  if (existing) {
    console.log("[REGISTER] ℹ️ Email already in use, suggesting login");
    return res.status(200).json({ 
      message: "You already have an account! Please sign in using your email and password.",
      step: "already-registered"
    });
  }

  // Validate email domain
  const emailCheck = await validateEmail(user.email);
  if (!emailCheck.valid) {
    return res.status(400).json({ message: emailCheck.reason });
  }

  // Hash password and store pending user in OTP store (not DB yet)
  const hashedPass = await bcrypt.hash(user.password, 10);
  otpStore.set(user.email, {
    pendingUser: {
      username: user.username,
      password: hashedPass,
      email: user.email,
    },
    otp: null,
    expiresAt: null,
  });

  // Send OTP
  try {
    await sendOTP(user.email, "register");
    console.log("[REGISTER] ✅ OTP sent, waiting for verification");
    return res.status(200).json({
      message: "OTP sent to your email. Please verify to complete registration.",
      step: "verify-otp",
      email: user.email,
    });
  } catch (err) {
    console.error("[REGISTER] ❌ Failed to send OTP:", err.message);
    otpStore.delete(user.email);
    return res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }
};

/**
 * LOGIN — Step 1
 * Validates credentials + email domain, sends OTP.
 */
const userLogin = async (req, res) => {
  console.log("\n[LOGIN] ── New login attempt ──────────────────────");
  const { user } = req.body;

  if (!user || !user.email || !user.password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  console.log(`[LOGIN] Email: ${user.email}`);

  const loginUser = await User.findOne({ email: user.email }).exec();
  if (!loginUser) {
    console.log("[LOGIN] ❌ User not found");
    return res.status(404).json({ message: "User Not Found" });
  }
  console.log("[LOGIN] ✅ User found");

  const match = await bcrypt.compare(user.password, loginUser.password);
  if (!match) {
    console.log("[LOGIN] ❌ Wrong password");
    return res.status(401).json({ message: "Unauthorized: Wrong password" });
  }
  console.log("[LOGIN] ✅ Password matched");

  const emailCheck = await validateEmail(user.email);
  if (!emailCheck.valid) {
    return res.status(400).json({ message: emailCheck.reason });
  }

  try {
    await sendOTP(user.email, "login");
    console.log("[LOGIN] ✅ OTP sent, waiting for verification");
    return res.status(200).json({
      message: "OTP sent to your email. Please verify to complete login.",
      step: "verify-otp",
      email: user.email,
    });
  } catch (err) {
    console.error("[LOGIN] ❌ Failed to send OTP:", err.message);
    return res.status(500).json({ message: "Failed to send OTP. Try again." });
  }
};

/**
 * VERIFY OTP — Step 2 (shared for both login and register)
 * - For login: finds existing user and returns them
 * - For register: creates the user from pendingUser data, then returns them
 */
const verifyOTP = async (req, res) => {
  console.log("\n[VERIFY OTP] ── New OTP verification ──────────────");
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  const result = verifyOTPCode(email, otp);
  if (!result.valid) {
    return res.status(400).json({ message: result.reason });
  }

  const record = result.record;

  // ── Registration flow: create user now that OTP is verified
  if (record.pendingUser) {
    console.log("[VERIFY OTP] Registration flow — creating user in DB");
    try {
      const createdUser = await User.create(record.pendingUser);
      otpStore.delete(email);
      console.log("[VERIFY OTP] ✅ User created and verified:", email);
      return res.status(201).json({
        message: "Registration successful",
        user: createdUser.toUserResponse(),
      });
    } catch (err) {
      console.error("[VERIFY OTP] ❌ Failed to create user:", err.message);
      return res.status(500).json({ message: "Failed to create account. Please try again." });
    }
  }

  // ── Login flow: user already exists
  console.log("[VERIFY OTP] Login flow — fetching existing user");
  const loginUser = await User.findOne({ email }).exec();
  if (!loginUser) {
    return res.status(404).json({ message: "User Not Found" });
  }

  otpStore.delete(email);
  loginUser.lastLogin = Date.now();
  await loginUser.save();

  console.log("[VERIFY OTP] ✅ Login verified:", email);
  return res.status(200).json({
    message: "Login successful",
    user: loginUser.toUserResponse(),
  });
};

/**
 * RESEND OTP — works for both login and register
 */
const resendOTP = async (req, res) => {
  console.log("\n[RESEND OTP] ── Resend request ─────────────────────");
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: "Email is required" });

  const record = otpStore.get(email);
  if (!record) {
    console.log("[RESEND OTP] ❌ No pending OTP session for this email");
    return res.status(400).json({ message: "No active session. Please start again." });
  }

  // Determine purpose from whether pendingUser exists
  const purpose = record.pendingUser ? "register" : "login";
  console.log(`[RESEND OTP] Purpose: ${purpose}`);

  try {
    await sendOTP(email, purpose);
    return res.status(200).json({ message: "OTP resent successfully." });
  } catch (err) {
    console.error("[RESEND OTP] ❌ Failed:", err.message);
    return res.status(500).json({ message: "Failed to resend OTP." });
  }
};

const updateUser = async (req, res) => {
  const { user } = req.body;
  if (!user) return res.status(400).json({ message: "Required a User object" });

  const email = req.userEmail;
  const target = await User.findOne({ email }).exec();

  if (user.email) {
    const emailCheck = await validateEmail(user.email);
    if (!emailCheck.valid) return res.status(400).json({ message: emailCheck.reason });
    target.email = user.email;
  }

  if (user.username) target.username = user.username;
  if (user.password) target.password = await bcrypt.hash(user.password, 10);
  if (typeof user.image !== "undefined") target.image = user.image;
  if (typeof user.bio !== "undefined") target.bio = user.bio;

  await target.save();
  return res.status(200).json({ user: target.toUserResponse() });
};

module.exports = {
  registerUser,
  userLogin,
  verifyOTP,
  resendOTP,
  getCurrentUser,
  updateUser,
};