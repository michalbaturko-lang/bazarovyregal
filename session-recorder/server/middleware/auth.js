const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'admin';

// Simple token: base64 of password + salt
function generateToken(password) {
  return Buffer.from(password + ':rml-auth-2024').toString('base64');
}

function authMiddleware(req, res, next) {
  // Skip auth for these paths (tracker and event ingestion must be public)
  if (req.path === '/tracker.js' ||
      req.path === '/api/events' ||
      req.path === '/login' ||
      req.path === '/api/auth/login' ||
      req.path === '/api/auth/check' ||
      req.path.startsWith('/api/sharing/') ||
      req.path.startsWith('/api/v1/') ||
      req.path === '/shared' ||
      req.path === '/shared.html' ||
      req.path.startsWith('/css/') ||
      req.path.startsWith('/js/')) {
    return next();
  }

  // Check auth cookie or Authorization header
  const token = req.cookies?.rml_token || req.headers.authorization?.replace('Bearer ', '');
  const validToken = generateToken(DASHBOARD_PASSWORD);

  if (token === validToken) {
    return next();
  }

  // If requesting API, return 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Redirect to login page
  res.redirect('/login');
}

// Login endpoint
function loginHandler(req, res) {
  const { password } = req.body;
  if (password === DASHBOARD_PASSWORD) {
    const token = generateToken(password);
    res.cookie('rml_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Wrong password' });
}

function checkAuthHandler(req, res) {
  const token = req.cookies?.rml_token || req.headers.authorization?.replace('Bearer ', '');
  const validToken = generateToken(DASHBOARD_PASSWORD);
  res.json({ authenticated: token === validToken });
}

module.exports = { authMiddleware, loginHandler, checkAuthHandler };
