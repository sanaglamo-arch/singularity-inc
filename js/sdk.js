/* Yandex Games SDK abstraction -> window.GAME_SDK.
   Loads the SDK dynamically; if it fails (local dev, offline) every method
   degrades to a safe no-op / localStorage fallback. The game runs perfectly
   with NO SDK present. This is the ONLY external script the game ever loads,
   and only when actually hosted on Yandex. */
(function () {
  'use strict';

  var ya = null;       // YaGames SDK instance
  var player = null;   // player object (if authorized)
  var ready = false;
  var SDK_URL = 'https://yandex.ru/games/sdk/v2';
  var initCallbacks = [];

  function loadScript(src, onload, onerror) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = onload;
    s.onerror = onerror;
    document.head.appendChild(s);
  }

  function finishInit() {
    ready = true;
    initCallbacks.forEach(function (cb) { try { cb(); } catch (e) {} });
    initCallbacks = [];
  }

  // Only load the SDK when we are actually hosted by Yandex (inside their
  // iframe, or on a yandex/app domain). Locally / standalone we make ZERO
  // external requests and run fully in fallback mode.
  function onYandex() {
    try {
      if (window.top !== window.self) return true; // framed by the platform
    } catch (e) { return true; } // cross-origin frame access throws => we are framed
    var h = (location.hostname || '').toLowerCase();
    return /(^|\.)yandex\.|games\.s3|\.app$|yandex/.test(h);
  }

  function init(onDone) {
    if (onDone) initCallbacks.push(onDone);
    // Already inside Yandex? (rare: SDK script preloaded)
    if (window.YaGames) { _doInit(); return; }
    if (!onYandex()) { finishInit(); return; } // standalone => no network, no SDK
    // Try to load. On any failure, run in fallback mode.
    var settled = false;
    var timer = setTimeout(function () {
      if (!settled) { settled = true; finishInit(); }
    }, 4000);
    loadScript(SDK_URL, function () {
      if (settled) return; settled = true; clearTimeout(timer);
      _doInit();
    }, function () {
      if (settled) return; settled = true; clearTimeout(timer);
      finishInit(); // no SDK -> fallback
    });
  }

  function _doInit() {
    if (!window.YaGames || !window.YaGames.init) { finishInit(); return; }
    window.YaGames.init().then(function (sdk) {
      ya = sdk;
      // optional player object
      if (ya.getPlayer) {
        ya.getPlayer({ scopes: false }).then(function (p) { player = p; }).catch(function () {});
      }
      finishInit();
    }).catch(function () { finishInit(); });
  }

  // LoadingAPI.ready() — tell Yandex the game finished loading
  function loadingReady() {
    try { if (ya && ya.features && ya.features.LoadingAPI) ya.features.LoadingAPI.ready(); } catch (e) {}
  }

  // GameplayAPI start/stop around active play
  function gameplayStart() {
    try { if (ya && ya.features && ya.features.GameplayAPI) ya.features.GameplayAPI.start(); } catch (e) {}
  }
  function gameplayStop() {
    try { if (ya && ya.features && ya.features.GameplayAPI) ya.features.GameplayAPI.stop(); } catch (e) {}
  }

  // Player data persistence: SDK if available, else localStorage (handled by save.js)
  function savePlayerData(obj) {
    try {
      if (player && player.setData) return player.setData(obj);
    } catch (e) {}
    return Promise.reject('no sdk');
  }
  function loadPlayerData() {
    try {
      if (player && player.getData) return player.getData();
    } catch (e) {}
    return Promise.reject('no sdk');
  }

  function hasSDK() { return !!ya; }
  function getSDK() { return ya; }
  function isReady() { return ready; }

  window.GAME_SDK = {
    init: init,
    loadingReady: loadingReady,
    gameplayStart: gameplayStart,
    gameplayStop: gameplayStop,
    savePlayerData: savePlayerData,
    loadPlayerData: loadPlayerData,
    hasSDK: hasSDK,
    getSDK: getSDK,
    isReady: isReady
  };
})();
