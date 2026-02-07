const express = require('express');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { authMiddleware, loginHandler, checkAuthHandler } = require('../server/middleware/auth');

const app = express();

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Auth routes (before auth middleware)
app.post('/api/auth/login', loginHandler);
app.get('/api/auth/check', checkAuthHandler);

// Auth middleware (after auth routes, before other routes)
app.use(authMiddleware);

// Mount API routes
app.use('/api/sessions', require('../server/routes/sessions'));
app.use('/api/events', require('../server/routes/events'));
app.use('/api/funnels', require('../server/routes/funnels'));
app.use('/api/dashboard', require('../server/routes/dashboard'));
app.use('/api/segments', require('../server/routes/segments'));

module.exports = app;
