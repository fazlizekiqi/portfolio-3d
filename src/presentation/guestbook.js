/**
 * guestbook.js — Visitor message form for the CTA slide.
 *
 * Usage: call initGuestbook(containerEl) after injecting the CTA HTML.
 *
 * Submissions go to the Formspree endpoint in CFG.FORMSPREE_ENDPOINT.
 * Sign up at formspree.io (free), create a form, then set:
 *   CFG.FORMSPREE_ENDPOINT = 'https://formspree.io/f/YOUR_FORM_ID'
 */

import { CFG } from '../config.js';
import { trackEvent } from '../analytics.js';

export function initGuestbook(container) {
  const toggleBtn = container.querySelector('#_gb-toggle');
  const form      = container.querySelector('#_gb-form');
  const status    = container.querySelector('#_gb-status');
  if (!toggleBtn || !form) return;

  // Expand / collapse the form
  toggleBtn.addEventListener('click', () => {
    const open = form.style.display !== 'none';
    form.style.display  = open ? 'none' : 'block';
    toggleBtn.textContent = open ? '+ LEAVE A MESSAGE' : '− LEAVE A MESSAGE';
    if (!open) form.querySelector('textarea')?.focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameVal = form.querySelector('._gb-name')?.value.trim() ?? '';
    const msgVal  = form.querySelector('._gb-msg')?.value.trim()  ?? '';
    if (!msgVal) return;

    const submitBtn = form.querySelector('._gb-submit');
    submitBtn.disabled   = true;
    submitBtn.textContent = 'SENDING...';
    status.textContent   = '';
    status.className     = '_gb-status';

    try {
      if (!CFG.FORMSPREE_ENDPOINT) throw new Error('no-endpoint');

      const res = await fetch(CFG.FORMSPREE_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name:     nameVal || 'Anonymous',
          message:  msgVal,
          _subject: 'Portfolio visitor message',
        }),
      });

      if (!res.ok) throw new Error('server');

      status.textContent = '✓ MESSAGE SENT — THANKS!';
      status.classList.add('_gb-status-ok');
      form.reset();
      trackEvent('guestbook_submit', nameVal ? 'named' : 'anonymous');

    } catch (err) {
      if (err.message === 'no-endpoint') {
        // Fallback: open mailto with pre-filled body
        const body = encodeURIComponent(
          `Name: ${nameVal || 'Anonymous'}\n\n${msgVal}`
        );
        window.open(
          `mailto:fazlizekiqi1@hotmail.com?subject=Portfolio+Message&body=${body}`,
          '_blank'
        );
        status.textContent = '✉ OPENING YOUR MAIL CLIENT...';
        status.classList.add('_gb-status-ok');
      } else {
        status.textContent = '✕ FAILED — PLEASE TRY AGAIN';
        status.classList.add('_gb-status-err');
      }
    } finally {
      submitBtn.disabled   = false;
      submitBtn.textContent = 'SEND MESSAGE →';
    }
  });
}
