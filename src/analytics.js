/**
 * analytics.js — Thin wrapper around GA4 / gtag.
 *
 * Wire up a real GA4 Measurement ID by adding the gtag snippet to index.html:
 *   <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
 *   <script>
 *     window.dataLayer = window.dataLayer || [];
 *     function gtag(){dataLayer.push(arguments);}
 *     gtag('js', new Date());
 *     gtag('config', 'G-XXXXXXXXXX');
 *   </script>
 *
 * All calls are no-ops when gtag is not loaded (dev / ad-blocked).
 */

function _gtag(...args) {
  try {
    // eslint-disable-next-line no-undef
    if (typeof gtag === 'function') gtag(...args);
  } catch (_) {}
}

/** Fire once per slide navigation. */
export function trackSlide(name) {
  _gtag('event', 'slide_view', {
    event_category: 'presentation',
    event_label: name,
  });
}

/** Generic event (project click, CTA click, skip, etc.). */
export function trackEvent(action, label) {
  _gtag('event', action, {
    event_category: 'portfolio',
    event_label: label,
  });
}
