'use strict';

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');
const { authMiddleware, loginHandler, checkAuthHandler } = require('./middleware/auth');

const app = express();

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Serve tracker
app.get('/tracker.js', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'tracker', 'tracker.js'));
});

// Serve consent banner
app.get('/consent-banner.js', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'tracker', 'consent-banner.js'));
});

// Auth routes (before auth middleware)
app.post('/api/auth/login', loginHandler);
app.get('/api/auth/check', checkAuthHandler);

// Auth middleware (after auth routes, before other routes)
app.use(authMiddleware);

// API routes
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/events', require('./routes/events'));
app.use('/api/funnels', require('./routes/funnels'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/segments', require('./routes/segments'));
app.use('/api/heatmaps', require('./routes/heatmaps'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/export', require('./routes/export'));

// Serve dashboard (local dev only)
app.use(express.static(path.join(__dirname, '..', 'dashboard')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dashboard', 'index.html'));
});

// Only listen when running directly (not imported by Vercel)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Regal Master Look running at http://localhost:${PORT}`);
  });
}

module.exports = app;
