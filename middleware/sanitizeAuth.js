const sanitizeAuth = (req, res, next) => {
  const body = req.body || {};

  // If the request body has email/password at the root, normalize it by nesting it under user
  if (!body.user && (body.email !== undefined || body.password !== undefined)) {
    body.user = {
      email: body.email,
      password: body.password,
      username: body.username
    };
  }

  const { user } = body;

  if (!user) {
    return res.status(400).json({
      error: "Required a User object",
      message: "Required a User object"
    });
  }

  const { email, password, username } = user;

  // Ensure fields are defined before accessing properties
  if (email === undefined || password === undefined) {
    return res.status(400).json({
      error: "Required fields missing",
      message: "Required fields missing"
    });
  }

  // The core defense against Type Inflation
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({
      error: "Invalid data types provided. Strings required.",
      message: "Invalid data types provided. Strings required."
    });
  }

  // If registering (path is /users), check username if present
  if (req.path === '/users' && typeof username !== 'string') {
    return res.status(400).json({
      error: "Invalid data types provided. Strings required.",
      message: "Invalid data types provided. Strings required."
    });
  }

  next();
};

module.exports = sanitizeAuth;
