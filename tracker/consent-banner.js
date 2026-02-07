/**
 * Regal Master Look – GDPR Consent Banner v1.0.0
 *
 * A lightweight, self-contained consent banner that integrates with the
 * RegalMasterLook tracker.  Drop it into any page:
 *
 *   <script src="https://regal-master-look.vercel.app/consent-banner.js" async></script>
 *
 * The banner remembers the visitor's choice in localStorage ('rml_consent')
 * and will not reappear once a decision has been made.
 */
(function () {
  'use strict';

  // If the user has already made a choice, do nothing.
  var STORAGE_KEY = 'rml_consent';
  try {
    var existing = localStorage.getItem(STORAGE_KEY);
    if (existing === 'granted' || existing === 'revoked') return;
  } catch (e) {
    // localStorage blocked – banner cannot persist choice, skip gracefully
    return;
  }

  // Wait for DOM to be ready before injecting the banner.
  function onReady(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  onReady(function () {
    // ---- Create banner container ----
    var banner = document.createElement('div');
    banner.id = 'rml-consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');

    // ---- Inline styles (dark theme, fixed bottom) ----
    banner.style.cssText = [
      'position:fixed',
      'bottom:0',
      'left:0',
      'right:0',
      'z-index:2147483647',
      'background:#1a1a2e',
      'color:#e0e0e0',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
      'font-size:14px',
      'line-height:1.5',
      'padding:16px 24px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'flex-wrap:wrap',
      'gap:12px',
      'box-shadow:0 -2px 12px rgba(0,0,0,0.4)',
      'transform:translateY(100%)',
      'transition:transform 0.4s cubic-bezier(0.4,0,0.2,1)',
      'box-sizing:border-box'
    ].join(';');

    // ---- Text ----
    var text = document.createElement('span');
    text.style.cssText = 'flex:1 1 300px;min-width:200px';
    text.textContent = 'Tento web pou\u017E\u00EDv\u00E1 analytick\u00E9 cookies pro zlep\u0161en\u00ED u\u017Eivatelsk\u00E9ho z\u00E1\u017Eitku.';
    banner.appendChild(text);

    // ---- Button wrapper ----
    var btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex;gap:8px;flex-shrink:0';

    // Shared button base styles
    var btnBase = [
      'border:none',
      'border-radius:6px',
      'padding:8px 20px',
      'font-size:14px',
      'font-weight:600',
      'cursor:pointer',
      'transition:opacity 0.2s',
      'outline:none'
    ].join(';');

    // Accept button (green)
    var acceptBtn = document.createElement('button');
    acceptBtn.textContent = 'P\u0159ijmout';
    acceptBtn.style.cssText = btnBase + ';background:#22c55e;color:#fff';
    acceptBtn.addEventListener('mouseover', function () { acceptBtn.style.opacity = '0.85'; });
    acceptBtn.addEventListener('mouseout', function () { acceptBtn.style.opacity = '1'; });

    // Reject button (gray)
    var rejectBtn = document.createElement('button');
    rejectBtn.textContent = 'Odm\u00EDtnout';
    rejectBtn.style.cssText = btnBase + ';background:#4b5563;color:#fff';
    rejectBtn.addEventListener('mouseover', function () { rejectBtn.style.opacity = '0.85'; });
    rejectBtn.addEventListener('mouseout', function () { rejectBtn.style.opacity = '1'; });

    btnWrap.appendChild(acceptBtn);
    btnWrap.appendChild(rejectBtn);
    banner.appendChild(btnWrap);

    // ---- Insert into page ----
    document.body.appendChild(banner);

    // Trigger the slide-up animation on next frame so the browser
    // registers the initial translateY(100%) state first.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.style.transform = 'translateY(0)';
      });
    });

    // ---- Dismiss helper ----
    function dismiss() {
      banner.style.transform = 'translateY(100%)';
      // Remove from DOM after the animation finishes
      setTimeout(function () {
        if (banner.parentNode) {
          banner.parentNode.removeChild(banner);
        }
      }, 450);
    }

    // ---- Button handlers ----
    acceptBtn.addEventListener('click', function () {
      if (window.RegalMasterLook && typeof window.RegalMasterLook.grantConsent === 'function') {
        window.RegalMasterLook.grantConsent();
      } else {
        // Tracker not loaded yet – persist manually so the tracker picks it up on init
        try { localStorage.setItem(STORAGE_KEY, 'granted'); } catch (e) { /* */ }
      }
      dismiss();
    });

    rejectBtn.addEventListener('click', function () {
      if (window.RegalMasterLook && typeof window.RegalMasterLook.revokeConsent === 'function') {
        window.RegalMasterLook.revokeConsent();
      } else {
        try { localStorage.setItem(STORAGE_KEY, 'revoked'); } catch (e) { /* */ }
      }
      dismiss();
    });
  });
})();
