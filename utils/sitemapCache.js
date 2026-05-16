/**
 * sitemapCache.js
 * ──────────────────────────────────────────────────────────────
 * Singleton in-memory cache for the generated sitemap XML.
 *
 * WHY a separate module?
 *   The sitemap route needs to store generated XML, and the article
 *   controller needs to bust that cache whenever a post is created,
 *   updated, or deleted. Sharing the cache via a plain module avoids
 *   a circular-dependency between routes ↔ controllers.
 *
 * Usage:
 *   const sitemapCache = require('../utils/sitemapCache');
 *   sitemapCache.invalidate();   // bust the cache
 *   sitemapCache.get();          // returns { xml, timestamp } | null
 *   sitemapCache.set(xml);       // store freshly generated XML
 */

let cachedXml = null;       // the generated sitemap string
let cacheTimestamp = 0;     // epoch ms when cache was last set

/** How long (in ms) the cached sitemap is considered fresh (default: 1 hour). */
const CACHE_TTL_MS = parseInt(process.env.SITEMAP_CACHE_TTL_MS, 10) || 60 * 60 * 1000;

const sitemapCache = {
  /**
   * Returns the cached entry if it is still within TTL, otherwise null.
   * @returns {{ xml: string, timestamp: number } | null}
   */
  get() {
    if (!cachedXml) return null;
    if (Date.now() - cacheTimestamp > CACHE_TTL_MS) return null;
    return { xml: cachedXml, timestamp: cacheTimestamp };
  },

  /**
   * Stores a newly generated sitemap XML string.
   * @param {string} xml
   */
  set(xml) {
    cachedXml = xml;
    cacheTimestamp = Date.now();
  },

  /**
   * Immediately invalidates the cache so the next request regenerates it.
   * Call this after any article create / update / delete operation.
   */
  invalidate() {
    cachedXml = null;
    cacheTimestamp = 0;
    console.log('[Sitemap] Cache invalidated — will regenerate on next request.');
  },

  /** Expose TTL for logging / health checks. */
  get ttl() { return CACHE_TTL_MS; },
};

module.exports = sitemapCache;
