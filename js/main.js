/* Bootstrap + game loop. Wires SDK lifecycle, anti-hijack guards, RAF tick
   with delta accumulation, autosave. */
(function () {
  'use strict';
  var C = window.GAME_CONFIG;

  // ---- anti-hijack (Yandex moderation: no native UI takeover) ----
  ['contextmenu', 'selectstart', 'dragstart', 'gesturestart'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false });
  });
  // block pinch-zoom / double-tap zoom leftovers
  document.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  // ---- splash (never let it trap the player) ----
  function hideSplash() {
    var s = document.getElementById('splash');
    if (s) { s.classList.add('hide'); setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 600); }
  }

  // ---- boot ----
  function boot() {
    // ABSOLUTE FAILSAFE: dismiss the loader no matter what happens below.
    setTimeout(hideSplash, 3500);

    var offline = null;
    try { offline = window.GAME.init(); }   // load() is internally safe (bad save -> fresh)
    catch (e) { try { console.error('init error', e); window.GAME.reset(); offline = window.GAME.init(); } catch (e2) { console.error(e2); } }
    try { window.GAME_UI.init(offline); }
    catch (e) { console.error('UI init error', e); }

    // SDK init (async, non-blocking). Game already works without it.
    try {
      window.GAME_SDK.init(function () {
        window.GAME_SDK.loadingReady();
        window.GAME_SDK.gameplayStart();
        if (window.GAME_ADS.available()) window.GAME_ADS.showSticky();
      });
    } catch (e) {}

    startLoop();
    startAutosave();
    setTimeout(hideSplash, 1100);   // normal branded-moment dismissal

    // lifecycle: save + gameplay stop/start
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { window.GAME.save(); window.GAME_SDK.gameplayStop(); if (window.GAME_MUSIC) window.GAME_MUSIC.stop(); }
      else { window.GAME_SDK.gameplayStart(); catchUpOffline(); if (window.GAME_MUSIC && window.GAME.state.music) window.GAME_MUSIC.start(); }
    });
    window.addEventListener('pagehide', function () { window.GAME.save(); });
    window.addEventListener('beforeunload', function () { window.GAME.save(); });
  }

  // when returning to a backgrounded tab, credit elapsed time
  var lastActive = Date.now();
  function catchUpOffline() {
    var now = Date.now();
    var elapsed = (now - lastActive) / 1000;
    if (elapsed > 60) {
      var off = window.GAME.computeOffline(elapsed, false);
      if (off.earned > 0) window.GAME.applyOffline(off.earned);
    }
    lastActive = now;
  }

  // ---- main loop: RAF + delta accumulation ----
  var lastT = 0;
  var acc = 0;
  var STEP = 0.05; // fixed sim step (s) for determinism
  function frame(ts) {
    if (!lastT) lastT = ts;
    var dt = (ts - lastT) / 1000;
    lastT = ts;
    lastActive = Date.now();
    if (dt > C.SETTINGS.TICK_MAX_DELTA) dt = C.SETTINGS.TICK_MAX_DELTA; // clamp (offline handles big gaps)
    acc += dt;
    var guard = 0;
    while (acc >= STEP && guard++ < 20) { window.GAME.tick(STEP); acc -= STEP; }
    window.GAME_UI.update();
    requestAnimationFrame(frame);
  }
  function startLoop() { requestAnimationFrame(frame); }

  // ---- autosave ----
  function startAutosave() {
    setInterval(function () { window.GAME.save(); }, C.SETTINGS.AUTOSAVE_INTERVAL * 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
