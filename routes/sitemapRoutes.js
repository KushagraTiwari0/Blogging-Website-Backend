/**
 * routes/sitemapRoutes.js
 * ──────────────────────────────────────────────────────────────
 * Provides two public (no-auth) endpoints:
 *
 *   GET /sitemap.xml  — dynamically built XML sitemap
 *   GET /robots.txt   — crawler directives + sitemap pointer
 *
 * Stack:
 *   • npm package "sitemap" (SitemapStream + streamToPromise)
 *   • In-memory cache via utils/sitemapCache (TTL = 1 hour)
 *   • Auto-invalidated when articles are mutated (see articlesController)
 *
 * SEO priorities used:
 *   1.0 — homepage
 *   0.9 — tag index pages          (high-value discovery pages)
 *   0.8 — individual articles      (core content)
 *   0.7 — author profile pages
 *   0.5 — static utility pages     (privacy, terms, about)
 *   0.3 — auth pages (login/reg)   (no index value)
 */

const express       = require('express');
const router        = express.Router();
const { SitemapStream, streamToPromise } = require('sitemap');
const { Readable }  = require('stream');

const Article      = require('../models/Article');
const User         = require('../models/User');
const Tag          = require('../models/Tag');
const sitemapCache = require('../utils/sitemapCache');

// ── Environment ────────────────────────────────────────────────
const FRONTEND_URL  = (process.env.FRONTEND_URL  || 'https://undsund.in').replace(/\/$/, '');
const BACKEND_URL   = (process.env.BACKEND_URL   || 'https://blogging-website-backend-9gfs.onrender.com').replace(/\/$/, '');

// ──────────────────────────────────────────────────────────────
// STEP 1: Build sitemap links array from MongoDB
// ──────────────────────────────────────────────────────────────
async function buildSitemapLinks() {
  const links = [];

  // ── Static pages ─────────────────────────────────────────
  // changefreq: how often the page is likely to change.
  // priority:   relative importance on a 0.0–1.0 scale.
  const staticPages = [
    { url: '/',        changefreq: 'daily',   priority: 1.0 },
    { url: '/privacy', changefreq: 'monthly', priority: 0.5 },
    { url: '/terms',   changefreq: 'monthly', priority: 0.5 },
    { url: '/login',   changefreq: 'monthly', priority: 0.3 },
    { url: '/register',changefreq: 'monthly', priority: 0.3 },
  ];
  links.push(...staticPages);

  // ── Blog posts (articles) ─────────────────────────────────
  // Fetch only the fields we need — lean() for plain JS objects (faster).
  const articles = await Article
    .find({}, 'slug updatedAt createdAt')
    .sort({ updatedAt: -1 })
    .lean()
    .exec();

  for (const article of articles) {
    links.push({
      url:        `/article/${article.slug}`,
      changefreq: 'weekly',
      priority:   0.8,
      lastmod:    (article.updatedAt || article.createdAt || new Date()).toISOString(),
    });
  }

  // ── Tag pages (category-like discovery pages) ─────────────
  // Tags are stored as strings inside each article's tagList array.
  // We do a distinct() query — no need to load full docs.
  const distinctTags = await Article.distinct('tagList');

  for (const tag of distinctTags) {
    if (!tag) continue;
    // Frontend route: /?tag=javascript  (adjust if you have a dedicated /tag/:name route)
    links.push({
      url:        `/?tag=${encodeURIComponent(tag.toLowerCase())}`,
      changefreq: 'daily',
      priority:   0.9,
    });
  }

  // ── Author / profile pages ────────────────────────────────
  const users = await User
    .find({}, 'username updatedAt')
    .sort({ updatedAt: -1 })
    .lean()
    .exec();

  for (const user of users) {
    links.push({
      url:        `/profile/@${user.username}`,
      changefreq: 'weekly',
      priority:   0.7,
      lastmod:    (user.updatedAt || new Date()).toISOString(),
    });
  }

  return links;
}

// ──────────────────────────────────────────────────────────────
// STEP 2: Stream links through SitemapStream → Buffer → string
// ──────────────────────────────────────────────────────────────
async function generateSitemapXml() {
  const links = await buildSitemapLinks();

  // SitemapStream expects a base URL so it can resolve relative paths.
  const stream = new SitemapStream({ hostname: FRONTEND_URL });

  // Convert links array to a Node.js Readable stream and pipe into sitemap.
  const pipeline = Readable.from(links).pipe(stream);

  // streamToPromise collects all chunks into a single Buffer.
  const buffer = await streamToPromise(pipeline);
  return buffer.toString('utf-8');
}

// ──────────────────────────────────────────────────────────────
// ROUTE: GET /sitemap.xml
// ──────────────────────────────────────────────────────────────
/**
 * Serves a dynamically generated XML sitemap.
 *
 * Flow:
 *   1. Check in-memory cache — if fresh, return cached XML immediately.
 *   2. Otherwise, query MongoDB for articles / tags / users.
 *   3. Build sitemap using the `sitemap` npm package.
 *   4. Store in cache and return XML with proper Content-Type header.
 *
 * Cache is automatically invalidated (busted) when:
 *   • A new article is created  (articlesController.createArticle)
 *   • An article is updated     (articlesController.updateArticle)
 *   • An article is deleted     (articlesController.deleteArticle)
 */
router.get('/sitemap.xml', async (req, res) => {
  try {
    // STEP 3: Check cache first — avoid DB round-trip on every crawl.
    const cached = sitemapCache.get();
    if (cached) {
      console.log('[Sitemap] Serving from cache.');
      res.set('Content-Type', 'application/xml; charset=utf-8');
      res.set('X-Sitemap-Cache', 'HIT');
      return res.send(cached.xml);
    }

    // STEP 4: Cache miss → regenerate.
    console.log('[Sitemap] Cache miss — regenerating from DB...');
    const xml = await generateSitemapXml();

    // STEP 5: Store in cache for next request.
    sitemapCache.set(xml);

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('X-Sitemap-Cache', 'MISS');
    return res.send(xml);

  } catch (err) {
    console.error('[Sitemap] Error generating sitemap:', err);
    return res.status(500).send('<!-- Error generating sitemap -->');
  }
});

// ──────────────────────────────────────────────────────────────
// ROUTE: GET /robots.txt
// ──────────────────────────────────────────────────────────────
/**
 * Serves robots.txt dynamically from Express so the sitemap URL
 * is always in sync with BACKEND_URL environment variable.
 *
 * Rules:
 *   • Allow all crawlers on public pages
 *   • Disallow auth/private pages (/settings, /editor)
 *   • Point to the canonical sitemap.xml location
 *
 * NOTE: The static public/robots.txt in the Vite frontend is kept
 * as a fallback, but this Express route takes precedence for the API
 * domain. Vercel/Render will serve the frontend's static file for the
 * frontend domain and this route for the backend domain.
 */
router.get('/robots.txt', (req, res) => {
  const robotsContent = [
    'User-agent: *',
    'Allow: /',
    '',
    '# Disallow private / auth-only pages',
    'Disallow: /settings',
    'Disallow: /editor',
    'Disallow: /login',
    'Disallow: /register',
    '',
    '# Crawl delay (be polite to the server)',
    'Crawl-delay: 10',
    '',
    `# Sitemap`,
    `Sitemap: ${BACKEND_URL}/sitemap.xml`,
    '',
  ].join('\n');

  res.set('Content-Type', 'text/plain; charset=utf-8');
  return res.send(robotsContent);
});

module.exports = router;
