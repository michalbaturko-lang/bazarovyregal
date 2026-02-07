'use strict';

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Supabase connectivity check at startup
// ---------------------------------------------------------------------------
const supabase = require('./supabase');

async function checkSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('projects').select('id').limit(1);
    if (error) {
      console.error('[server] Supabase connection check failed:', error.message);
      console.error('[server] Make sure SUPABASE_URL and SUPABASE_SERVICE_KEY env vars are set');
      console.error('[server] and that you have run the schema.sql migration.');
    } else {
      console.log('[server] Supabase connection verified successfully.');
    }
  } catch (err) {
    console.error('[server] Could not reach Supabase:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Import route modules
// ---------------------------------------------------------------------------
const sessionsRouter = require('./routes/sessions');
const eventsRouter = require('./routes/events');
const funnelsRouter = require('./routes/funnels');
const dashboardRouter = require('./routes/dashboard');
const segmentsRouter = require('./routes/segments');

// ---------------------------------------------------------------------------
// Create Express application
// ---------------------------------------------------------------------------
const app = express();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// ---------------------------------------------------------------------------
// Serve the tracker script
// ---------------------------------------------------------------------------
const TRACKER_PATH = path.join(__dirname, '..', 'tracker', 'tracker.js');
app.get('/tracker.js', (_req, res) => {
  if (fs.existsSync(TRACKER_PATH)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5-minute cache
    res.sendFile(TRACKER_PATH);
  } else {
    res.status(404).send('// tracker.js not found');
  }
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use('/api/sessions', sessionsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/funnels', funnelsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/segments', segmentsRouter);

// ---------------------------------------------------------------------------
// Serve the dashboard (static SPA)
// ---------------------------------------------------------------------------
const DASHBOARD_DIR = path.join(__dirname, '..', 'dashboard');
app.use(express.static(DASHBOARD_DIR));

// SPA fallback — serve index.html for any non-API, non-file request
app.get('*', (_req, res) => {
  const indexPath = path.join(DASHBOARD_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Dashboard not found' });
  }
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Start listening
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`[server] Session recorder backend running on http://localhost:${PORT}`);
  await checkSupabaseConnection();
});

module.exports = app;
