/* Visual juice -> window.GAME_FX. Pure DOM/CSS, no libs. Particle count capped
   for performance; respects reduced-motion. */
(function () {
  'use strict';
  var MAX_PARTICLES = 90;
  var live = 0;
  var reduce = false;
  try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function root() { return document.getElementById('fxRoot'); }

  function spawn(x, y, color, count, spread, dur) {
    if (reduce) return;
    var r = root();
    if (!r) return;
    count = Math.min(count, MAX_PARTICLES - live);
    if (count <= 0) return;
    for (var i = 0; i < count; i++) {
      var p = document.createElement('div');
      p.className = 'particle';
      var ang = Math.random() * Math.PI * 2;
      var dist = spread * (0.4 + Math.random() * 0.8);
      var dx = Math.cos(ang) * dist;
      var dy = Math.sin(ang) * dist - spread * 0.5; // bias upward
      var sz = 5 + Math.random() * 6;
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.width = sz + 'px';
      p.style.height = sz + 'px';
      p.style.background = color;
      p.style.setProperty('--dx', dx.toFixed(1) + 'px');
      p.style.setProperty('--dy', dy.toFixed(1) + 'px');
      p.style.animationDuration = (dur || 0.8) + 's';
      r.appendChild(p);
      live++;
      (function (el) {
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); live--; }, (dur || 0.8) * 1000 + 50);
      })(p);
    }
  }

  function tapBurst(x, y) { spawn(x, y, 'radial-gradient(circle,#ffe9a8,#ffd86b)', 8, 70, 0.8); }
  function buyBurst(x, y) { spawn(x, y, 'radial-gradient(circle,#bfe9ff,#5cc8ff)', 12, 90, 0.85); }
  function milestoneBurst(x, y) { spawn(x, y, 'radial-gradient(circle,#d7c4ff,#7c5cff)', 18, 120, 1.0); }

  function popText(x, y, text, cls) {
    if (reduce) return;
    var r = root(); if (!r) return;
    var e = document.createElement('div');
    e.className = 'float ' + (cls || '');
    e.textContent = text;
    e.style.left = (x - 16) + 'px';
    e.style.top = (y - 24) + 'px';
    r.appendChild(e);
    setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 1100);
  }

  function ripple(x, y, size) {
    if (reduce) return;
    var r = root(); if (!r) return;
    var e = document.createElement('div');
    e.className = 'ripple';
    size = size || 150;
    e.style.left = x + 'px'; e.style.top = y + 'px';
    e.style.width = size + 'px'; e.style.height = size + 'px';
    r.appendChild(e);
    setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 600);
  }

  function cardFlash(el) {
    if (!el || reduce) return;
    el.classList.remove('flash');
    void el.offsetWidth; // reflow to restart animation
    el.classList.add('flash');
    setTimeout(function () { el.classList.remove('flash'); }, 500);
  }

  function ensureVignette() {
    var v = document.getElementById('vignette');
    if (!v) { v = document.createElement('div'); v.id = 'vignette'; document.body.appendChild(v); }
    return v;
  }

  function incident() {
    if (reduce) return;
    var app = document.getElementById('app');
    if (app) { app.classList.remove('shake'); void app.offsetWidth; app.classList.add('shake'); setTimeout(function () { app.classList.remove('shake'); }, 450); }
    var v = ensureVignette();
    v.classList.remove('on'); void v.offsetWidth; v.classList.add('on');
    setTimeout(function () { v.classList.remove('on'); }, 1200);
  }

  function insightBurst(x, y) { spawn(x, y, 'radial-gradient(circle,#fff3c4,#fbbf24)', 24, 150, 1.1); }

  window.GAME_FX = {
    tapBurst: tapBurst, buyBurst: buyBurst, milestoneBurst: milestoneBurst,
    insightBurst: insightBurst, ripple: ripple,
    popText: popText, cardFlash: cardFlash, incident: incident
  };
})();
