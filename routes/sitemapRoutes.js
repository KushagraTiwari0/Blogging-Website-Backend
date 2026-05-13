const express = require("express");
const router = express.Router();
const Article = require("../models/Article");
const User = require("../models/User");

// Frontend URL — used to build sitemap URLs
const FRONTEND_URL = process.env.FRONTEND_URL || "https://undsund.in";

// Cache: store generated sitemap XML and timestamp
let cachedSitemap = null;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * GET /sitemap.xml
 * Dynamically generates an XML sitemap from the database.
 * Includes: static pages, all articles, and all user profiles.
 * Cached for 1 hour to avoid excessive DB queries.
 */
router.get("/sitemap.xml", async (req, res) => {
  try {
    const now = Date.now();

    // Return cached version if still fresh
    if (cachedSitemap && now - cacheTimestamp < CACHE_DURATION_MS) {
      res.set("Content-Type", "application/xml");
      return res.send(cachedSitemap);
    }

    // ── Static pages ────────────────────────────────────────
    const staticPages = [
      { loc: "/", changefreq: "daily", priority: "1.0" },
      { loc: "/login", changefreq: "monthly", priority: "0.3" },
      { loc: "/register", changefreq: "monthly", priority: "0.3" },
    ];

    // ── Dynamic article pages ───────────────────────────────
    const articles = await Article.find({}, "slug updatedAt")
      .sort({ updatedAt: -1 })
      .lean()
      .exec();

    // ── Dynamic profile pages ───────────────────────────────
    const users = await User.find({}, "username updatedAt")
      .sort({ updatedAt: -1 })
      .lean()
      .exec();

    // ── Build XML ───────────────────────────────────────────
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Static pages
    for (const page of staticPages) {
      xml += `  <url>\n`;
      xml += `    <loc>${FRONTEND_URL}${page.loc}</loc>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += `  </url>\n`;
    }

    // Article pages
    for (const article of articles) {
      const lastmod = article.updatedAt
        ? new Date(article.updatedAt).toISOString()
        : new Date().toISOString();
      xml += `  <url>\n`;
      xml += `    <loc>${FRONTEND_URL}/article/${article.slug}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    }

    // Profile pages
    for (const user of users) {
      const lastmod = user.updatedAt
        ? new Date(user.updatedAt).toISOString()
        : new Date().toISOString();
      xml += `  <url>\n`;
      xml += `    <loc>${FRONTEND_URL}/profile/@${user.username}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.6</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>\n`;

    // Cache the result
    cachedSitemap = xml;
    cacheTimestamp = now;

    res.set("Content-Type", "application/xml");
    return res.send(xml);
  } catch (err) {
    console.error("Error generating sitemap:", err);
    return res.status(500).send("Error generating sitemap");
  }
});

module.exports = router;
