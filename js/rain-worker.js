/* ==========================================================================
   Rain Worker — Thin wrapper around shared RainEngine.
   All physics + rendering are in rain-engine.js (loaded via importScripts).
   This file only handles message passing between main thread ↔ engine.
   ========================================================================== */
importScripts('rain-engine.js');

var engine = createRainEngine();

function loop() {
  var result = engine.draw();
  if (result === 'drained') {
    self.postMessage({ type: 'drained' });
    return;
  }
  if (result === 'stopped') return;
  requestAnimationFrame(loop);
}

self.onmessage = function (e) {
  var msg = e.data;

  switch (msg.type) {
    case 'init':
      engine.init(msg.canvas, msg.width, msg.height, msg.dropCount);
      break;

    case 'start':
      engine.start(msg.scrollY);
      requestAnimationFrame(loop);
      break;

    case 'stop':
      engine.stop();
      break;

    case 'drain':
      engine.drain();
      break;

    case 'scroll':
      engine.setScroll(msg.scrollY);
      break;

    case 'resize':
      engine.resize(msg.width, msg.height, msg.dropCount);
      if (msg.scrollY !== undefined) engine.setScroll(msg.scrollY);
      break;

    case 'surfaces':
      engine.setSurfaces(msg.surfaces);
      if (msg.scrollY !== undefined) engine.setScroll(msg.scrollY);
      break;

    case 'cursor':
      engine.setCursor(msg.x, msg.y);
      break;

    case 'theme':
      engine.setTheme(msg.theme);
      break;
  }
};
