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
app.use('/api/heatmaps', require('../server/routes/heatmaps'));
app.use('/api/users', require('../server/routes/users'));
app.use('/api/projects', require('../server/routes/projects'));
app.use('/api/notes', require('../server/routes/notes'));
app.use('/api/export', require('../server/routes/export'));
app.use('/api/journeys', require('../server/routes/journeys'));
app.use('/api/ecommerce', require('../server/routes/ecommerce'));
app.use('/api/behavioral', require('../server/routes/behavioral'));
app.use('/api/insights', require('../server/routes/insights'));

module.exports = app;
