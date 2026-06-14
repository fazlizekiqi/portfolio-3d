/**
 * guestbook.js — Handles the inline contact form on the CTA slide.
 *
 * Submits via EmailJS REST API directly from the browser — no backend needed.
 * Configure CFG.EMAILJS_PUBLIC_KEY / SERVICE_ID / TEMPLATE_ID in config.js.
 * Falls back to a mailto: link when the keys are not set.
 */

import { CFG } from '../config.js';
import { trackEvent } from '../analytics.js';

const EMAILJS_URL = 'https://api.emailjs.com/api/v1.0/email/send';

export function initGuestbook(container) {
  const form      = container.querySelector('#_cta-form');
  const statusEl  = container.querySelector('#_cta-status');
  const sendBtn   = container.querySelector('#_cta-send-btn');
  if (!form || !sendBtn) return;

  const sendLabel = sendBtn.innerHTML; // preserve the styled "$ contact --send"

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameVal  = (form.querySelector('#_cta-name')?.value    ?? '').trim();
    const emailVal = (form.querySelector('#_cta-replyto')?.value ?? '').trim();
    const msgVal   = (form.querySelector('#_cta-msg')?.value     ?? '').trim();

    if (!emailVal || !msgVal) {
      _setStatus(statusEl, '✗ missing required fields · exit 1', 'err');
      return;
    }

    sendBtn.disabled    = true;
    sendBtn.textContent = '…running';
    _setStatus(statusEl, '> sending...', '');

    const keysConfigured = CFG.EMAILJS_PUBLIC_KEY && CFG.EMAILJS_SERVICE_ID && CFG.EMAILJS_TEMPLATE_ID;

    try {
      if (!keysConfigured) throw new Error('no-keys');

      const res = await fetch(EMAILJS_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id:   CFG.EMAILJS_SERVICE_ID,
          template_id:  CFG.EMAILJS_TEMPLATE_ID,
          user_id:      CFG.EMAILJS_PUBLIC_KEY,
          template_params: {
            from_name: nameVal || 'Anonymous',
            reply_to:  emailVal,
            message:   msgVal,
          },
        }),
      });

      if (!res.ok) throw new Error('server');

      _setStatus(statusEl, '✓ message sent · exit 0', 'ok');
      form.reset();
      trackEvent('contact_form_submit', nameVal ? 'named' : 'anonymous');

    } catch (err) {
      if (err.message === 'no-keys') {
        // Fallback: pre-fill native mail client
        const subject = encodeURIComponent('Portfolio Contact');
        const body    = encodeURIComponent(
          `Name: ${nameVal || 'Anonymous'}\nEmail: ${emailVal}\n\n${msgVal}`
        );
        window.open(`mailto:fazlizekiqi1@hotmail.com?subject=${subject}&body=${body}`, '_blank');
        _setStatus(statusEl, '✉ opening mail client...', 'ok');
      } else {
        _setStatus(statusEl, '✗ send failed · exit 1', 'err');
      }
    } finally {
      sendBtn.disabled  = false;
      sendBtn.innerHTML = sendLabel;
    }
  });
}

function _setStatus(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className   = '_cta-status'
    + (type === 'ok'  ? ' _cta-status-ok'  : '')
    + (type === 'err' ? ' _cta-status-err' : '');
}
