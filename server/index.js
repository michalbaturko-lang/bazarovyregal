'use strict';

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');

const app = express();

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Serve tracker
app.get('/tracker.js', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'tracker', 'tracker.js'));
});

// API routes
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/events', require('./routes/events'));
app.use('/api/funnels', require('./routes/funnels'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/segments', require('./routes/segments'));

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
