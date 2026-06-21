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
    // init() loads the save FIRST (load() is internally safe: a bad save just yields a
    // fresh in-memory state) and sets window.GAME.state before any later step runs. So if a
    // later init step ever throws, the loaded state already exists — we must NOT reset()
    // here, because reset() ERASES the save from disk (the root cause of "progress + balance
    // vanished and onboarding replayed on refresh"). Swallow the error and keep the save.
    try { offline = window.GAME.init(); }
    catch (e) { console.error('init error', e); }
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
      hidden = document.hidden;
      if (document.hidden) { window.GAME.save(); window.GAME_SDK.gameplayStop(); if (window.GAME_MUSIC) window.GAME_MUSIC.stop(); if (window.GAME_AUDIO && window.GAME_AUDIO.suspend) window.GAME_AUDIO.suspend(); }
      else { lastT = 0; window.GAME_SDK.gameplayStart(); catchUpOffline(); if (window.GAME_MUSIC && window.GAME.state.music) window.GAME_MUSIC.start(); if (window.GAME_AUDIO && window.GAME_AUDIO.resume) window.GAME_AUDIO.resume(); }
    });
    window.addEventListener('pagehide', function () { window.GAME.save(); });
    window.addEventListener('beforeunload', function () { window.GAME.save(); });

    // Android (Capacitor) hardware BACK button — graceful no-op on plain web / Yandex.
    try {
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        var App = window.Capacitor.Plugins.App;
        App.addListener('backButton', function () {
          if (!window.GAME_UI.back()) { window.GAME.save(); App.exitApp(); }
        });
        try { if (window.Capacitor.Plugins.StatusBar) window.Capacitor.Plugins.StatusBar.setStyle({ style: 'DARK' }); } catch (e) {}
      }
    } catch (e) {}
  }

  // when returning to a backgrounded tab, credit elapsed time
  var lastActive = Date.now();
  function catchUpOffline() {
    var now = Date.now();
    var elapsed = (now - lastActive) / 1000;
    if (elapsed > 60) {
      var off = window.GAME.computeOffline(elapsed, false);
      // v17: settle accrued electricity + taxes via the accountant too (pass `off`), even when
      // there were no earnings — bills don't pause while you're away.
      if (off.earned > 0 || off.elecBill > 0 || off.taxBill > 0) window.GAME.applyOffline(off.earned, off);
    }
    lastActive = now;
  }

  // ---- main loop: RAF + delta accumulation ----
  var lastT = 0;
  var acc = 0;
  var uiAcc = 0;
  var STEP = 0.05;        // fixed sim step (s) for determinism
  var UI_STEP = 0.033;    // refresh the DOM at ~30fps — sim + CSS animations stay smooth,
                          // but we halve style-recalc/DOM writes vs 60fps on low-end Android.
  var hidden = false;
  function frame(ts) {
    if (!lastT) lastT = ts;
    var dt = (ts - lastT) / 1000;
    lastT = ts;
    lastActive = Date.now();
    if (dt > C.SETTINGS.TICK_MAX_DELTA) dt = C.SETTINGS.TICK_MAX_DELTA; // clamp (offline handles big gaps)
    // Pause idle gain while an interrupt decision modal is open (Phase 2 Sub-part D):
    // the sim is frozen so a decision truly demands attention; UI still refreshes.
    var paused = window.GAME_UI && window.GAME_UI.isPaused && window.GAME_UI.isPaused();
    if (!hidden) {
      if (!paused) {
        acc += dt;
        var guard = 0;
        while (acc >= STEP && guard++ < 20) { window.GAME.tick(STEP); acc -= STEP; }
      } else { acc = 0; }   // drop accumulated time so we don't fast-forward on resume
      uiAcc += dt;
      if (uiAcc >= UI_STEP) { uiAcc = 0; window.GAME_UI.update(); }
    }
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
