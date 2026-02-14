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
 * 4. Deploy the updated file to BOTH domains:
 *    - bazarovyregal.cz (this site)
 *    - vyprodej-regalu.cz (checkout site)
 */

window.BAZAROVYREGAL_TRACKING = {
  // === REAL IDs (configured 2026-02-14) ===
  GA4_MEASUREMENT_ID: 'G-X2JLKXMNZ4',
  GOOGLE_ADS_ID: 'AW-17952868610',
  CONVERSION_LABEL_PURCHASE: 'LIcHCKyrsPgbEIKSzPBC',
  CONVERSION_LABEL_ADD_TO_CART: 'LIcHCKyrsPgbEIKSzPBC', // Same label for now, update when separate add_to_cart conversion is created

  // === CROSS-DOMAIN TRACKING ===
  // Both domains MUST share the same GA4 property and tracking IDs
  LINKER_DOMAINS: ['bazarovyregal.cz', 'vyprodej-regalu.cz'],

  // === CONFIGURATION ===
  CURRENCY: 'CZK',
  DEBUG_MODE: false,                           // Set true for testing (logs events to console)
};
