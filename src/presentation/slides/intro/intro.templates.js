/**
 * intro.templates.js — Pure HTML-string builder for the intro slide's body content.
 */

/** Terminal boot sequence for the intro slide. */
export function buildIntroHTML() {
  const rows = [
    { delay: 0.25, prompt: true,  content: `<span class="_tb-blink-cursor">▌</span>&nbsp;ESTABLISHING_CONNECTION<span class="_tb-blink-cursor">...</span>` },
    { delay: 0.85, prompt: false, content: `<span class="_tb-key">ENGINEER </span><span class="_tb-val">FAZLI ZEKIQI</span>` },
    { delay: 1.30, prompt: false, content: `<span class="_tb-key">ROLE     </span><span class="_tb-val">SR. SOFTWARE ENGINEER</span>` },
    { delay: 1.75, prompt: false, content: `<span class="_tb-key">LOCATION </span><span class="_tb-val">STOCKHOLM, SWEDEN</span>` },
    { delay: 2.20, prompt: false, content: `<span class="_tb-key">FOCUS    </span><span class="_tb-val">DISTRIBUTED SYSTEMS</span>` },
    { delay: 2.80, prompt: false, content: `<span class="_tb-key">SYSTEMS  </span><span class="_tb-bar">██████████</span>&nbsp;<span class="_tb-pct">100% ONLINE</span>` },
    { delay: 3.40, prompt: true,  content: `<span class="_tb-blink-cursor">▌</span>` },
  ];
  const html = rows.map(r => {
    const promptHtml = r.prompt
      ? `<span class="_tb-prompt">&gt;</span>`
      : `<span class="_tb-prompt" style="opacity:0.35">&gt;</span>`;
    return `<div class="_tb-row" style="animation-delay:${r.delay}s">${promptHtml}&nbsp;${r.content}</div>`;
  }).join('');
  return `<div class="_term-boot">${html}</div>`;
}
