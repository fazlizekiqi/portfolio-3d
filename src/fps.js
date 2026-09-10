// ── FPS counter ───────────────────────────────────────────────────────────────
const fpsEl = document.createElement('div');
fpsEl.style.cssText = `
  position:fixed;top:12px;right:16px;z-index:100;
  font-family:'Share Tech Mono','Courier New',monospace;
  font-size:11px;color:#336677;letter-spacing:.08em;pointer-events:none;`;
fpsEl.textContent = 'FPS --';
document.body.appendChild(fpsEl);

let _frameCount = 0;
let _lastTime   = performance.now();

export function tickFps() {
  _frameCount++;
  const now = performance.now();
  if (now - _lastTime >= 600) {
    fpsEl.textContent = `FPS ${Math.round(_frameCount * 1000 / (now - _lastTime))}`;
    _frameCount = 0;
    _lastTime   = now;
  }
}
