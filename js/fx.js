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

  // tap burst scales with the overclock combo `heat` (0..1): more particles + wider
  // spread + hotter color as the streak climbs — the slot-machine feel (hook, first 90s).
  function tapBurst(x, y, heat) {
    var h = (typeof heat === 'number' && heat > 0) ? (heat > 1 ? 1 : heat) : 0;
    var count = Math.round(8 + h * 14);          // 8 cold → 22 fully overclocked
    var spread = 70 + h * 70;
    var col = h > 0.5
      ? 'radial-gradient(circle,#fff3c4,#fb9c3c)'  // hot amber on a streak
      : 'radial-gradient(circle,#ffe9a8,#ffd86b)';
    spawn(x, y, col, count, spread, 0.8);
  }
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

  // confetti rain from the top (capped); mixed neon colors
  function confetti(n) {
    if (reduce) return;
    var r = root(); if (!r) return;
    var colors = ['#8b5cf6', '#22d3ee', '#fbbf24', '#34d399', '#fb5c78'];
    n = Math.min(n || 60, MAX_PARTICLES - live);
    var w = window.innerWidth;
    for (var i = 0; i < n; i++) {
      var p = document.createElement('div');
      p.className = 'particle';
      var sz = 6 + Math.random() * 7;
      p.style.left = (Math.random() * w) + 'px';
      p.style.top = '-10px';
      p.style.width = sz + 'px'; p.style.height = sz + 'px';
      p.style.background = colors[i % colors.length];
      p.style.borderRadius = (Math.random() < 0.5 ? '50%' : '2px');
      p.style.setProperty('--dx', (Math.random() * 80 - 40).toFixed(0) + 'px');
      p.style.setProperty('--dy', (window.innerHeight + 40) + 'px');
      var dur = 1.4 + Math.random() * 1.1;
      p.style.animationDuration = dur + 's';
      r.appendChild(p); live++;
      (function (el) { setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); live--; }, dur * 1000 + 60); })(p);
    }
  }

  // expanding shockwave ring from a point
  function shockwave(x, y, color, size) {
    if (reduce) return;
    var r = root(); if (!r) return;
    var e = document.createElement('div');
    e.className = 'shockwave';
    e.style.left = x + 'px'; e.style.top = y + 'px';
    e.style.setProperty('--sw', (size || 520) + 'px');
    e.style.borderColor = color || 'rgba(34,211,238,0.7)';
    r.appendChild(e);
    setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 760);
  }

  // quick fullscreen color flash
  function flash(color) {
    if (reduce) return;
    var f = document.createElement('div'); f.className = 'screenflash';
    f.style.background = 'radial-gradient(circle at 50% 45%, ' + (color || 'rgba(139,92,246,0.5)') + ', transparent 70%)';
    document.body.appendChild(f);
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 600);
  }

  // celebration for a big milestone: layered flash + shockwave + burst + pop
  function celebrate(x, y, text, big) {
    flash('rgba(34,211,238,0.4)');
    shockwave(x, y, 'rgba(34,211,238,0.8)', big ? 640 : 460);
    milestoneBurst(x, y);
    if (big) { milestoneBurst(x, y); confetti(40); }
    popText(x, y, text, 'crit');
  }

  // prestige / singularity ritual cinematic. opts: {title, subtitle, kind}
  function ritual(opts) {
    opts = opts || {};
    var kind = opts.kind || 'prestige';
    if (reduce) { flash(kind === 'singularity' ? 'rgba(34,211,238,0.5)' : 'rgba(139,92,246,0.5)'); return; }
    var ov = document.createElement('div');
    ov.className = 'ritual ' + kind;
    ov.innerHTML =
      '<div class="ritual-core"></div>' +
      '<div class="ritual-sweep"></div>' +
      '<div class="ritual-text"><div class="ritual-title">' + (opts.title || '') + '</div>' +
      '<div class="ritual-sub">' + (opts.subtitle || '') + '</div></div>';
    document.body.appendChild(ov);
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    var col = kind === 'singularity' ? 'rgba(34,211,238,0.85)' : 'rgba(139,92,246,0.85)';
    flash(kind === 'singularity' ? 'rgba(34,211,238,0.4)' : 'rgba(139,92,246,0.4)');
    shockwave(cx, cy, col, 900);
    setTimeout(function () { shockwave(cx, cy, col, 700); }, 180);
    confetti(80);
    var removed = false;
    function done() { if (removed) return; removed = true; ov.classList.add('out'); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 350); }
    ov.addEventListener('click', done);
    setTimeout(done, 2300);
  }

  window.GAME_FX = {
    tapBurst: tapBurst, buyBurst: buyBurst, milestoneBurst: milestoneBurst,
    insightBurst: insightBurst, ripple: ripple, confetti: confetti, flash: flash,
    shockwave: shockwave, celebrate: celebrate, ritual: ritual,
    popText: popText, cardFlash: cardFlash, incident: incident
  };
})();
