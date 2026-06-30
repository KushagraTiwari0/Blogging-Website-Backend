require("dotenv").config();
const express = require("express");

const app = express();
const PORT = process.env.PORT || 4000;
const connectDB = require("../config/dbConnect");
const mongoose = require("mongoose");
var cors = require('cors')
const corsOptions = require('../config/corsOptions');


const rateLimiter = require("../middleware/rateLimiter");

connectDB();
//user routes => /api/users and /api/user
app.use(cors(corsOptions));
app.use(express.json({ limit: '15kb' })); // limit express parser size globally to 15kb
app.use(rateLimiter); // custom IP rate-limiter middleware

// ping route for cron job
app.get("/ping", (req, res) => {
  console.log(`server awaked at time ${new Date().toLocaleString()}`);
  res.status(200).send("Server is awake");
});

/**
 * Sitemap & robots.txt — NO authentication, NO CORS needed.
 * These must be publicly accessible by Google's crawler.
 *
 * Required .env vars:
 *   FRONTEND_URL  — e.g. https://undsund.in
 *   BACKEND_URL   — e.g. https://blogging-website-backend-9gfs.onrender.com
 *
 * Endpoints served:
 *   GET /sitemap.xml  → dynamically built XML (cached 1 hr, auto-busted on article mutations)
 *   GET /robots.txt   → crawler directives pointing to the sitemap
 */
app.use("/", require("../routes/sitemapRoutes"));

// user routes for /api/users and /api/user
app.use("/api", require("../routes/userRoutes"));

// profile routes
app.use("/api/profiles", require("../routes/profileRoutes"));

// article routes 

app.use("/api/articles", require("../routes/articleRoutes"));

//tag routes

app.use("/api/tags", require("../routes/tagRoutes"));

//comment routes

app.use("/api/articles", require("../routes/commentRoutes"));


mongoose.connection.once("open", () => {
  console.log("Connected to MongoDB");

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

mongoose.connection.on('error', (err) => {
    console.log('Error while connection to MongoDB: ',err)
});