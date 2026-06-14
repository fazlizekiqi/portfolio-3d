/**
 * config.js — Central tuning knobs.
 *
 * Gather magic numbers here so they're easy to find and change.
 */
export const CFG = {
  // Asset loading weights (must sum to 1.0)
  CHAR_LOAD_WEIGHT:  0.6,
  ENV_LOAD_WEIGHT:   0.4,
  // Max wait for the environment GLB before starting anyway (ms)
  ENV_TIMEOUT_MS:    5000,

  // Camera
  CAMERA_FOV:  44,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR:  100,

  // Iris transition speed (progress units / second)
  IRIS_SPEED: 0.55,

  // Presentation
  SLIDE_CARD_DELAY: 550,

  /**
   * Guestbook — set to your Formspree endpoint to enable the message form.
   * 1. Sign up at https://formspree.io (free tier supports 50 submissions/month)
   * 2. Create a new form, copy the endpoint URL
   * 3. Replace the empty string below, e.g.:
   *      'https://formspree.io/f/xwkgkqzp'
   * Leave empty to fall back to the mailto: link.
   */
  FORMSPREE_ENDPOINT: '',

  /**
   * EmailJS — powers the inline "Send me a message" form on the Contact slide.
   * Sends email directly to your inbox without any backend or redirect.
   *
   * Setup (free, 200 emails/month):
   *   1. Sign up at https://www.emailjs.com
   *   2. Add Email Service → connect your Hotmail/Gmail account
   *   3. Create an Email Template with variables:
   *        {{from_name}}  {{reply_to}}  {{message}}
   *      Set "To email" to fazlizekiqi1@hotmail.com
   *   4. Fill in the three fields below from your EmailJS dashboard
   */
  EMAILJS_PUBLIC_KEY:  '',   // Account → API Keys → Public Key
  EMAILJS_SERVICE_ID:  '',   // Email Services → Service ID
  EMAILJS_TEMPLATE_ID: '',   // Email Templates → Template ID
};
