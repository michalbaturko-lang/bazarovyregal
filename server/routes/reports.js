'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { generateReport } = require('../report-generator');

// ============================================================================
// Helpers
// ============================================================================

/**
 * Compute period start/end based on frequency relative to now.
 */
function computePeriodDates(frequency) {
  const now = new Date();
  let periodStart, periodEnd;

  periodEnd = now.toISOString();

  switch (frequency) {
    case 'daily':
      periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'monthly':
      periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'weekly':
    default:
      periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      break;
  }

  return { periodStart, periodEnd };
}

/**
 * Send email via Resend API if RESEND_API_KEY is configured.
 * Returns true if sent, false if no email service configured.
 */
async function sendEmailViaResend(recipients, subject, htmlContent) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const fromAddress = process.env.RESEND_FROM || 'Regal Master Look <reports@regalmaster.look>';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: recipients,
        subject: subject,
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('[reports] Resend API error:', errData);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[reports] Email send error:', err.message);
    return false;
  }
}

// ============================================================================
// GET /api/reports/config — Get current report configuration
// ============================================================================
router.get('/config', async (req, res) => {
  try {
    const { project_id = 'default' } = req.query;

    const { data, error } = await supabase.from('report_configs')
      .select('*')
      .eq('project_id', project_id)
      .single();

    if (error && error.code === 'PGRST116') {
      // No config exists yet — return defaults
      return res.json({
        id: 'default',
        project_id,
        enabled: false,
        recipients: [],
        frequency: 'weekly',
        day_of_week: 1,
        hour: 9,
        timezone: 'Europe/Prague',
        include_sections: ['overview', 'top_pages', 'errors', 'performance'],
        email_service_configured: !!process.env.RESEND_API_KEY,
      });
    }

    if (error) throw error;

    res.json({
      ...data,
      email_service_configured: !!process.env.RESEND_API_KEY,
    });
  } catch (err) {
    console.error('[reports] GET /config error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/reports/config — Save report configuration
// ============================================================================
router.post('/config', async (req, res) => {
  try {
    const {
      project_id = 'default',
      enabled = false,
      recipients = [],
      frequency = 'weekly',
      day_of_week = 1,
      hour = 9,
      timezone = 'Europe/Prague',
      include_sections = ['overview', 'top_pages', 'errors', 'performance'],
    } = req.body;

    // Validate frequency
    const validFrequencies = ['daily', 'weekly', 'monthly'];
    if (!validFrequencies.includes(frequency)) {
      return res.status(400).json({ error: 'Invalid frequency. Must be daily, weekly, or monthly.' });
    }

    // Validate day_of_week
    if (day_of_week < 0 || day_of_week > 6) {
      return res.status(400).json({ error: 'day_of_week must be 0-6 (Sunday-Saturday).' });
    }

    // Validate hour
    if (hour < 0 || hour > 23) {
      return res.status(400).json({ error: 'hour must be 0-23.' });
    }

    // Validate sections
    const validSections = ['overview', 'top_pages', 'errors', 'performance', 'ecommerce'];
    const filteredSections = include_sections.filter(s => validSections.includes(s));

    // Validate recipients
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validRecipients = recipients.filter(r => emailRegex.test(r));

    const configData = {
      id: project_id,
      project_id,
      enabled,
      recipients: validRecipients,
      frequency,
      day_of_week,
      hour,
      timezone,
      include_sections: filteredSections,
      updated_at: new Date().toISOString(),
    };

    // Upsert: insert or update
    const { data, error } = await supabase.from('report_configs')
      .upsert(configData, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    res.json({
      ...data,
      email_service_configured: !!process.env.RESEND_API_KEY,
      message: 'Report configuration saved successfully.',
    });
  } catch (err) {
    console.error('[reports] POST /config error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/reports/send-now — Manually trigger a report send
// ============================================================================
router.post('/send-now', async (req, res) => {
  try {
    const { project_id = 'default' } = req.body;

    // Fetch config
    const { data: config, error: configError } = await supabase.from('report_configs')
      .select('*')
      .eq('project_id', project_id)
      .single();

    // Use defaults if no config saved
    const frequency = (config && config.frequency) || 'weekly';
    const sections = (config && config.include_sections) || ['overview', 'top_pages', 'errors', 'performance'];
    const recipients = (config && config.recipients) || [];

    const { periodStart, periodEnd } = computePeriodDates(frequency);

    // Build dashboard URL from request origin
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const dashboardUrl = `${protocol}://${host}/#dashboard`;

    // Generate the report
    const { html, stats } = await generateReport(project_id, periodStart, periodEnd, sections, frequency, dashboardUrl);

    // Attempt to send via email
    let emailSent = false;
    if (recipients.length > 0) {
      const freqLabel = frequency.charAt(0).toUpperCase() + frequency.slice(1);
      const subject = `Regal Master Look - ${freqLabel} Analytics Report`;
      emailSent = await sendEmailViaResend(recipients, subject, html);
    }

    // Save to history
    const { error: historyError } = await supabase.from('report_history')
      .insert({
        project_id,
        period_start: periodStart,
        period_end: periodEnd,
        recipients,
        html_content: html,
        sent_at: new Date().toISOString(),
      });

    if (historyError) {
      console.error('[reports] Failed to save report history:', historyError);
    }

    res.json({
      success: true,
      email_sent: emailSent,
      recipients_count: recipients.length,
      period_start: periodStart,
      period_end: periodEnd,
      stats,
      message: emailSent
        ? `Report sent to ${recipients.length} recipient(s).`
        : recipients.length > 0
          ? 'Report generated but email service is not configured. Report saved to history.'
          : 'Report generated and saved to history. No recipients configured.',
    });
  } catch (err) {
    console.error('[reports] POST /send-now error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/reports/preview — Generate report HTML without sending
// ============================================================================
router.get('/preview', async (req, res) => {
  try {
    const { project_id = 'default', frequency } = req.query;

    // Fetch config for sections and frequency
    const { data: config } = await supabase.from('report_configs')
      .select('*')
      .eq('project_id', project_id)
      .single();

    const freq = frequency || (config && config.frequency) || 'weekly';
    const sections = (config && config.include_sections) || ['overview', 'top_pages', 'errors', 'performance'];

    const { periodStart, periodEnd } = computePeriodDates(freq);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const dashboardUrl = `${protocol}://${host}/#dashboard`;

    const { html, stats } = await generateReport(project_id, periodStart, periodEnd, sections, freq, dashboardUrl);

    res.json({
      html,
      stats,
      period_start: periodStart,
      period_end: periodEnd,
      frequency: freq,
      sections,
    });
  } catch (err) {
    console.error('[reports] GET /preview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/reports/history — List sent reports
// ============================================================================
router.get('/history', async (req, res) => {
  try {
    const {
      project_id = 'default',
      page: rawPage = '1',
      limit: rawLimit = '20',
    } = req.query;

    const page = Math.max(1, parseInt(rawPage, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(rawLimit, 10) || 20));
    const offset = (page - 1) * limit;

    // Fetch count
    const { count, error: countError } = await supabase.from('report_history')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project_id);

    if (countError) throw countError;

    const total = count || 0;
    const pages = Math.ceil(total / limit);

    // Fetch paginated results (without html_content for the list to keep it light)
    const { data, error } = await supabase.from('report_history')
      .select('id, project_id, period_start, period_end, recipients, sent_at')
      .eq('project_id', project_id)
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      reports: data || [],
      total,
      page,
      pages,
    });
  } catch (err) {
    console.error('[reports] GET /history error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/reports/history/:id — Get a single report's HTML content
// ============================================================================
router.get('/history/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase.from('report_history')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Report not found.' });
      }
      throw error;
    }

    res.json(data);
  } catch (err) {
    console.error('[reports] GET /history/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
