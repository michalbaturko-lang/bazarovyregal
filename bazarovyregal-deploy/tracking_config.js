/**
 * Google Ads & GA4 Tracking Configuration for Bazarovyregal.cz
 *
 * INSTRUCTIONS:
 * 1. Replace GA4_MEASUREMENT_ID with your GA4 Measurement ID (format: G-XXXXXXXXXX)
 *    - Get it from: GA4 > Admin > Data Streams > Web > Measurement ID
 *
 * 2. Replace GOOGLE_ADS_ID with your Google Ads Conversion ID (format: AW-XXXXXXXXX)
 *    - Get it from: Google Ads > Tools > Conversions > Conversion action details
 *
 * 3. Replace CONVERSION_LABEL with your conversion label
 *    - Get it from: Google Ads > Tools > Conversions > Tag setup
 *
 * 4. Deploy the updated file to your website
 */

window.BAZAROVYREGAL_TRACKING = {
  // === FILL IN YOUR IDs HERE ===
  GA4_MEASUREMENT_ID: 'G-XXXXXXXXXX',        // TODO: Replace with your GA4 Measurement ID
  GOOGLE_ADS_ID: 'AW-XXXXXXXXX',             // TODO: Replace with your Google Ads Conversion ID
  CONVERSION_LABEL_PURCHASE: 'XXXXXXXXXXX',   // TODO: Replace with purchase conversion label
  CONVERSION_LABEL_ADD_TO_CART: 'XXXXXXXXXXX', // TODO: Replace with add-to-cart conversion label

  // === CONFIGURATION (adjust as needed) ===
  CURRENCY: 'CZK',
  CROSS_DOMAIN: 'vyprodej-regalu.cz',        // Cart/checkout domain
  DEBUG_MODE: false,                           // Set true for testing (logs events to console)
};
