/* Story cutscenes -> window.GAME_CUTSCENE. Full-screen, SKIPPABLE cinematic
   narrative beats. Pure DOM/SVG/CSS, no libs. Reuses the cinematic vocabulary of
   fx.ritual (core bloom, sweep, glow) but as its own surface (new ids/classes).

   A cutscene is a sequence of "beats" {art, title, body}. Each beat auto-advances
   after a failsafe timeout; the player can tap "Next" / "Skip" at any time. The
   whole thing NEVER traps the player: a Skip button ends it immediately, and a
   hard ceiling timer dismisses it even if nothing is clicked.

   Respects prefers-reduced-motion: no heavy motion, beats shown statically and
   auto-advance is faster (still skippable). */
(function () {
  'use strict';

  var reduce = false;
  try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function t(k) {
    try { return window.GAME_I18N ? window.GAME_I18N.t(k) : k; } catch (e) { return k; }
  }
  function sfx(name) {
    try { var A = window.GAME_AUDIO; if (A && window.GAME && window.GAME.state && window.GAME.state.sound && A[name]) A[name](); } catch (e) {}
  }

  var active = null;   // the live cutscene controller (so we never stack two)

  // ----------------------------------------------------------------- ART
  // Each art scene is an atmospheric SVG composition: silhouettes, gradients,
  // glow, simple iconography. Premium, not photorealistic. Scales to any size
  // (preserveAspectRatio via viewBox + CSS width/height 100%).
  var ART = {
    // a lone figure at a workbench inside a small garage; one screen glowing
    garage: function () {
      return svg('0 0 400 300',
        defsGlow('gGarage', '#8b5cf6') +
        // floor + back wall gradient
        '<rect x="0" y="0" width="400" height="300" fill="url(#skyGarage)"/>' +
        '<defs><linearGradient id="skyGarage" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#0d0b22"/><stop offset="1" stop-color="#070611"/></linearGradient>' +
        '<radialGradient id="glowGarage" cx="0.62" cy="0.55" r="0.5">' +
        '<stop offset="0" stop-color="rgba(139,92,246,0.5)"/><stop offset="1" stop-color="transparent"/></radialGradient></defs>' +
        '<rect x="0" y="0" width="400" height="300" fill="url(#glowGarage)"/>' +
        // garage roll-up door lines (left wall)
        line(30, 60, 30, 240, 'rgba(167,139,250,0.18)', 2) +
        groupLines([[30, 90], [30, 120], [30, 150], [30, 180], [30, 210]], 110, 'rgba(167,139,250,0.10)') +
        // floor
        '<rect x="0" y="240" width="400" height="60" fill="#0a0918"/>' +
        line(0, 240, 400, 240, 'rgba(167,139,250,0.25)', 1.5) +
        // desk
        '<rect x="210" y="196" width="150" height="10" rx="2" fill="#171430"/>' +
        '<rect x="220" y="206" width="8" height="34" fill="#13112a"/>' +
        '<rect x="342" y="206" width="8" height="34" fill="#13112a"/>' +
        // laptop (glowing screen)
        '<g filter="url(#gGarage)">' +
        '<polygon points="262,196 312,196 318,170 256,170" fill="#0d2030"/>' +
        '<polygon points="266,193 308,193 313,173 261,173" fill="url(#scrGarage)"/>' +
        '<rect x="258" y="196" width="58" height="4" rx="1.5" fill="#1b1838"/></g>' +
        '<defs><linearGradient id="scrGarage" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#67e8f9"/><stop offset="1" stop-color="#1e6fa8"/></linearGradient></defs>' +
        // founder silhouette (seated)
        '<g fill="#05040c">' +
        '<ellipse cx="186" cy="206" rx="26" ry="34"/>' +     // torso
        '<circle cx="186" cy="158" r="16"/>' +                // head
        '</g>' +
        // rim light on the silhouette from the screen
        '<path d="M205 178 q8 18 6 50" stroke="rgba(103,232,249,0.55)" stroke-width="2.5" fill="none"/>' +
        '<path d="M198 150 q10 6 9 18" stroke="rgba(103,232,249,0.4)" stroke-width="2" fill="none"/>' +
        // dust motes
        dots([[90, 110], [140, 80], [330, 120], [70, 170], [360, 200]], '#a78bfa', 0.5));
    },
    // a glowing brain / network node with orbiting paths — "the dream / AGI"
    dream: function () {
      return svg('0 0 400 300',
        defsGlow('gDream', '#22d3ee') +
        '<rect x="0" y="0" width="400" height="300" fill="#070611"/>' +
        '<defs><radialGradient id="glowDream" cx="0.5" cy="0.5" r="0.5">' +
        '<stop offset="0" stop-color="rgba(34,211,238,0.32)"/><stop offset="1" stop-color="transparent"/></radialGradient></defs>' +
        '<rect x="0" y="0" width="400" height="300" fill="url(#glowDream)"/>' +
        // orbit rings
        '<g fill="none" stroke-linecap="round">' +
        ellipseRing(200, 150, 130, 52, 18, 'rgba(34,211,238,0.35)') +
        ellipseRing(200, 150, 130, 52, -36, 'rgba(167,139,250,0.30)') +
        ellipseRing(200, 150, 110, 110, 0, 'rgba(34,211,238,0.18)') +
        '</g>' +
        // network constellation around a core
        netLines(200, 150, [[120, 100], [285, 110], [300, 195], [115, 200], [200, 70], [200, 230]], 'rgba(167,139,250,0.4)') +
        dots([[120, 100], [285, 110], [300, 195], [115, 200], [200, 70], [200, 230]], '#a78bfa', 1) +
        // core bloom
        '<g filter="url(#gDream)">' +
        '<circle cx="200" cy="150" r="22" fill="url(#coreDream)"/></g>' +
        '<defs><radialGradient id="coreDream" cx="0.5" cy="0.5" r="0.5">' +
        '<stop offset="0" stop-color="#ffffff"/><stop offset="0.55" stop-color="#22d3ee"/><stop offset="1" stop-color="rgba(34,211,238,0)"/></radialGradient></defs>');
    },
    // a fork in the road / scales — "the stakes" (power · price · safety)
    stakes: function () {
      return svg('0 0 400 300',
        defsGlow('gStakes', '#fbbf24') +
        '<rect x="0" y="0" width="400" height="300" fill="#070611"/>' +
        '<defs><radialGradient id="glowStakes" cx="0.5" cy="0.42" r="0.55">' +
        '<stop offset="0" stop-color="rgba(251,191,36,0.22)"/><stop offset="1" stop-color="transparent"/></radialGradient></defs>' +
        '<rect x="0" y="0" width="400" height="300" fill="url(#glowStakes)"/>' +
        // central pillar
        line(200, 80, 200, 210, 'rgba(251,191,36,0.55)', 3) +
        '<circle cx="200" cy="74" r="7" fill="#fbbf24" filter="url(#gStakes)"/>' +
        // balance beam
        line(120, 110, 280, 110, 'rgba(251,191,36,0.6)', 3) +
        line(120, 110, 120, 130, 'rgba(251,191,36,0.4)', 1.5) +
        line(280, 110, 280, 130, 'rgba(251,191,36,0.4)', 1.5) +
        // three pans: power(violet) · price(gold) · safety(cyan)
        pan(120, 138, '#8b5cf6', 'gStakes') +
        pan(200, 158, '#fbbf24', 'gStakes') +
        pan(280, 138, '#22d3ee', 'gStakes') +
        // base platform
        '<rect x="150" y="210" width="100" height="10" rx="3" fill="#171430"/>' +
        line(150, 220, 250, 220, 'rgba(167,139,250,0.25)', 1) +
        dots([[80, 70], [330, 90], [60, 200], [350, 210]], '#a78bfa', 0.6));
    },
    // a network/model bloom radiating to many user nodes — "first model live"
    model: function () {
      var users = [];
      var i, a, r;
      for (i = 0; i < 14; i++) {
        a = (i / 14) * Math.PI * 2;
        r = 95 + (i % 3) * 18;
        users.push([200 + Math.cos(a) * r, 150 + Math.sin(a) * r * 0.78]);
      }
      return svg('0 0 400 300',
        defsGlow('gModel', '#8b5cf6') +
        '<rect x="0" y="0" width="400" height="300" fill="#070611"/>' +
        '<defs><radialGradient id="glowModel" cx="0.5" cy="0.5" r="0.55">' +
        '<stop offset="0" stop-color="rgba(139,92,246,0.34)"/><stop offset="1" stop-color="transparent"/></radialGradient></defs>' +
        '<rect x="0" y="0" width="400" height="300" fill="url(#glowModel)"/>' +
        netLines(200, 150, users, 'rgba(139,92,246,0.3)') +
        dots(users, '#22d3ee', 0.9) +
        // pulse rings
        '<g fill="none">' +
        '<ellipse cx="200" cy="150" rx="70" ry="55" stroke="rgba(34,211,238,0.28)" stroke-width="1.5"/>' +
        '<ellipse cx="200" cy="150" rx="105" ry="82" stroke="rgba(139,92,246,0.20)" stroke-width="1.5"/></g>' +
        '<g filter="url(#gModel)"><circle cx="200" cy="150" r="26" fill="url(#coreModel)"/></g>' +
        '<defs><radialGradient id="coreModel" cx="0.5" cy="0.5" r="0.5">' +
        '<stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#a78bfa"/><stop offset="1" stop-color="rgba(139,92,246,0)"/></radialGradient></defs>');
    },
    // a blinding singularity bloom over a horizon — "victory"
    singularity: function () {
      var rays = '';
      var i;
      for (i = 0; i < 24; i++) {
        var a = (i / 24) * Math.PI * 2;
        var x2 = 200 + Math.cos(a) * 260, y2 = 150 + Math.sin(a) * 260;
        rays += line(200, 150, x2, y2, 'rgba(34,211,238,' + (0.04 + (i % 2) * 0.05) + ')', 2);
      }
      return svg('0 0 400 300',
        defsGlow('gSing', '#22d3ee') +
        '<rect x="0" y="0" width="400" height="300" fill="#04040c"/>' +
        '<defs><radialGradient id="glowSing" cx="0.5" cy="0.5" r="0.6">' +
        '<stop offset="0" stop-color="rgba(34,211,238,0.5)"/><stop offset="0.6" stop-color="rgba(139,92,246,0.18)"/><stop offset="1" stop-color="transparent"/></radialGradient></defs>' +
        '<rect x="0" y="0" width="400" height="300" fill="url(#glowSing)"/>' +
        '<g>' + rays + '</g>' +
        '<g fill="none">' +
        '<circle cx="200" cy="150" r="60" stroke="rgba(34,211,238,0.4)" stroke-width="1.5"/>' +
        '<circle cx="200" cy="150" r="92" stroke="rgba(167,139,250,0.28)" stroke-width="1.5"/>' +
        '<circle cx="200" cy="150" r="124" stroke="rgba(34,211,238,0.14)" stroke-width="1.5"/></g>' +
        '<g filter="url(#gSing)"><circle cx="200" cy="150" r="34" fill="url(#coreSing)"/></g>' +
        '<defs><radialGradient id="coreSing" cx="0.5" cy="0.5" r="0.5">' +
        '<stop offset="0" stop-color="#ffffff"/><stop offset="0.4" stop-color="#67e8f9"/><stop offset="1" stop-color="rgba(34,211,238,0)"/></radialGradient></defs>');
    }
  };

  // ---- svg helpers ----
  function svg(vb, inner) {
    return '<svg class="cs-svg" viewBox="' + vb + '" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
  }
  function defsGlow(id, color) {
    return '<defs><filter id="' + id + '" x="-60%" y="-60%" width="220%" height="220%">' +
      '<feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  }
  function line(x1, y1, x2, y2, col, w) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + col + '" stroke-width="' + (w || 1) + '" stroke-linecap="round"/>';
  }
  function groupLines(starts, len, col) {
    var s = '';
    starts.forEach(function (p) { s += line(p[0], p[1], p[0] + len, p[1], col, 1); });
    return s;
  }
  function dots(pts, col, scale) {
    var s = '';
    pts.forEach(function (p, i) {
      var r = (1.6 + (i % 3) * 0.8) * (scale || 1);
      s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + r.toFixed(1) + '" fill="' + col + '" opacity="0.85"/>';
    });
    return s;
  }
  function netLines(cx, cy, pts, col) {
    var s = '<g stroke="' + col + '" stroke-width="1.2">';
    pts.forEach(function (p) { s += line(cx, cy, p[0], p[1], col, 1.2); });
    return s + '</g>';
  }
  function ellipseRing(cx, cy, rx, ry, rot, col) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" stroke="' + col + '" stroke-width="1.5" transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"/>';
  }
  function pan(x, y, col, glow) {
    return '<g>' +
      line(x, y - 22, x, y, 'rgba(255,255,255,0.18)', 1) +
      '<path d="M' + (x - 16) + ' ' + y + ' Q' + x + ' ' + (y + 14) + ' ' + (x + 16) + ' ' + y + '" fill="none" stroke="' + col + '" stroke-width="2.5"/>' +
      '<circle cx="' + x + '" cy="' + (y + 5) + '" r="4" fill="' + col + '" filter="url(#' + glow + ')"/></g>';
  }

  // ----------------------------------------------------------------- ENGINE
  // opts: { kind, beats:[{art,title,body}], skipLabel, onDone }
  function play(opts) {
    opts = opts || {};
    var beats = opts.beats || [];
    if (!beats.length) { if (opts.onDone) opts.onDone(); return; }

    // never stack: if one is live, end it first
    if (active) { try { active.end(true); } catch (e) {} }

    var kind = opts.kind || 'intro';
    var idx = 0;
    var ended = false;
    var timer = null;
    var ceiling = null;
    // per-beat dwell (ms). Reduced motion -> shorter dwell (less waiting).
    var BEAT_MS = reduce ? 2600 : 5200;
    // hard ceiling so the player is NEVER trapped even with no input
    var CEILING_MS = (BEAT_MS * beats.length) + 4000;

    var ov = document.createElement('div');
    ov.className = 'cutscene cs-' + kind + (reduce ? ' cs-reduce' : '');
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.innerHTML =
      '<div class="cs-veil"></div>' +
      '<div class="cs-stage">' +
        '<div class="cs-art"></div>' +
        '<div class="cs-grad"></div>' +
        '<div class="cs-text">' +
          '<div class="cs-title"></div>' +
          '<div class="cs-body"></div>' +
        '</div>' +
        '<div class="cs-dots"></div>' +
      '</div>' +
      '<button type="button" class="cs-skip"></button>' +
      '<button type="button" class="cs-next"></button>';
    document.body.appendChild(ov);

    var artEl = ov.querySelector('.cs-art');
    var titleEl = ov.querySelector('.cs-title');
    var bodyEl = ov.querySelector('.cs-body');
    var dotsEl = ov.querySelector('.cs-dots');
    var skipBtn = ov.querySelector('.cs-skip');
    var nextBtn = ov.querySelector('.cs-next');

    skipBtn.textContent = t(opts.skipLabel || 'cut_skip');
    // progress dots
    var d = '';
    for (var i = 0; i < beats.length; i++) d += '<span class="cs-dot"></span>';
    dotsEl.innerHTML = d;
    var dotEls = dotsEl.querySelectorAll('.cs-dot');

    function renderBeat() {
      var b = beats[idx];
      var artFn = (b.art && ART[b.art]) ? ART[b.art] : null;
      artEl.innerHTML = artFn ? artFn() : '';
      // restart entrance animation
      var txt = ov.querySelector('.cs-text');
      txt.classList.remove('in'); void txt.offsetWidth; txt.classList.add('in');
      artEl.classList.remove('in'); void artEl.offsetWidth; artEl.classList.add('in');
      titleEl.textContent = b.title ? t(b.title) : '';
      bodyEl.textContent = b.body ? t(b.body) : '';
      for (var k = 0; k < dotEls.length; k++) dotEls[k].classList.toggle('on', k === idx);
      var last = idx >= beats.length - 1;
      nextBtn.textContent = t(last ? (opts.lastLabel || 'cut_begin') : 'cut_next');
      sfx('breakthrough');
    }

    function advance() {
      if (ended) return;
      if (idx >= beats.length - 1) { end(false); return; }
      idx++;
      renderBeat();
      arm();
    }
    function arm() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(advance, BEAT_MS);
    }
    function end(silent) {
      if (ended) return; ended = true;
      if (timer) clearTimeout(timer);
      if (ceiling) clearTimeout(ceiling);
      ov.classList.add('out');
      if (!silent) sfx('buy');
      active = null;
      setTimeout(function () {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        if (!silent && opts.onDone) { try { opts.onDone(); } catch (e) {} }
      }, 360);
    }

    nextBtn.addEventListener('click', function (e) { e.stopPropagation(); advance(); });
    skipBtn.addEventListener('click', function (e) { e.stopPropagation(); end(false); });
    // tap the stage = advance (skippable-by-tap requirement)
    ov.querySelector('.cs-stage').addEventListener('click', function () { advance(); });

    active = { end: end };
    ceiling = setTimeout(function () { end(false); }, CEILING_MS);
    renderBeat();
    arm();
    return active;
  }

  // ----------------------------------------------------------------- SCENES
  function intro(onDone) {
    play({
      kind: 'intro',
      skipLabel: 'cut_skip_intro',
      lastLabel: 'cut_begin',
      beats: [
        { art: 'garage', title: 'cut_intro1_title', body: 'cut_intro1_body' },
        { art: 'dream', title: 'cut_intro2_title', body: 'cut_intro2_body' },
        { art: 'stakes', title: 'cut_intro3_title', body: 'cut_intro3_body' }
      ],
      onDone: onDone
    });
  }

  function firstModel(onDone) {
    play({
      kind: 'firstmodel',
      lastLabel: 'cut_continue',
      beats: [
        { art: 'model', title: 'cut_firstmodel_title', body: 'cut_firstmodel_body' }
      ],
      onDone: onDone
    });
  }

  // safe: boolean -> picks the closing narrative line. extraHtml optionally
  // injects an ending stat line under the body (shareable-card friendly).
  function agiVictory(opts) {
    opts = opts || {};
    play({
      kind: 'victory',
      lastLabel: 'cut_continue',
      beats: [
        {
          art: 'singularity',
          title: 'cut_victory_title',
          body: opts.safe ? 'cut_victory_safe' : 'cut_victory_reckless'
        }
      ],
      onDone: opts.onDone
    });
  }

  window.GAME_CUTSCENE = {
    play: play,
    intro: intro,
    firstModel: firstModel,
    agiVictory: agiVictory,
    isActive: function () { return !!active; }
  };
})();
