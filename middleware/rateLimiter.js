const ipHits = new Map();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LIMIT = 100; // max requests per window per IP

const rateLimiter = (req, res, next) => {
  // IMPORTANT: Only trust x-forwarded-for if app.set('trust proxy', true) is enabled in Express!
  // Otherwise, fallback safely to req.ip or remoteAddress.
  const ip = req.ip || req.socket.remoteAddress;
  
  if (!ip) {
    return next();
  }

  const now = Date.now();
  const record = ipHits.get(ip);

  // Case 1: First time this IP is visiting, or their old 15-minute window completely expired
  if (!record || now > record.resetTime) {
    ipHits.set(ip, {
      count: 1,
      resetTime: now + WINDOW_MS
    });
    return next();
  }

  // Case 2: They are within their active 15-minute window and hit the limit
  if (record.count >= MAX_LIMIT) {
    return res.status(429).json({
      message: "Too many requests from this IP. Please try again later."
    });
  }

  // Case 3: Within window and under limit, increment count
  record.count += 1;
  next();
};

// Periodic Garbage Collector to prevent Memory Leaks from dead IPs
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipHits.entries()) {
    if (now > record.resetTime) {
      ipHits.delete(ip); // Safely remove expired tracking entries to free up RAM
    }
  }
}, WINDOW_MS);

module.exports = rateLimiter;
