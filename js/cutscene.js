/* Story cutscenes -> window.GAME_CUTSCENE.
   ============================================================================
   MASTER-CRAFT cinematic narrative beats. Pure DOM/SVG/CSS, no libs.

   A cutscene is a sequence of "beats". Each beat is a FULL-BLEED cinematic
   composition built from layered SVG art (background / midground / foreground)
   plus CSS particle + grade + grain + vignette layers, framed by letterbox
   bars, with a slow Ken-Burns move and rhythmic, staggered typography.

   The player is NEVER trapped: a Skip button ends it immediately, tapping the
   stage advances, and a hard ceiling timer dismisses it even with no input.

   prefers-reduced-motion: heavy motion is dropped (static beautiful stills,
   instant text), still fully skippable.

   ALL art is procedural SVG so it scales to any size (390 mobile -> 1280
   desktop) via viewBox + preserveAspectRatio. No external assets.
   ============================================================================ */
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
  // escape for SVG <text> nodes
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function lblCoin() { return esc(t('cut_lbl_price')); }
  function lblBolt() { return esc(t('cut_lbl_power')); }
  function lblShield() { return esc(t('cut_lbl_safety')); }

  var active = null;   // the live cutscene controller (so we never stack two)

  // Portrait detection: the art viewBox is landscape (1200x750) sliced to cover,
  // so on a tall portrait frame only a narrow central band (~x430..770) is
  // visible. We tag the overlay so per-scene CSS can lift focal content (window,
  // founder, orb labels) back into that safe band. Recomputed on resize/rotate.
  function isPortrait() {
    try {
      if (window.matchMedia) return window.matchMedia('(max-aspect-ratio: 5/6)').matches;
    } catch (e) {}
    return (window.innerHeight || 0) > (window.innerWidth || 0) * 1.2;
  }

  // ============================ SVG PRIMITIVES ============================
  function svg(layer, inner) {
    // a full-bleed layer svg; slice so it always covers the frame
    return '<svg class="cs-layer ' + layer + '" viewBox="0 0 1200 750" ' +
      'preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
  }
  function rgba(c, a) { return 'rgba(' + c + ',' + a + ')'; }
  // common palette tuples (so we can vary alpha cheaply)
  var VIOLET = '139,92,246', VIOLET2 = '167,139,250', CYAN = '34,211,238',
      CYAN2 = '103,232,249', GOLD = '251,191,36', WHITE = '255,255,255',
      INK = '7,6,17';

  function glowFilter(id, dev) {
    return '<filter id="' + id + '" x="-80%" y="-80%" width="260%" height="260%">' +
      '<feGaussianBlur stdDeviation="' + (dev || 8) + '" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
  }
  function line(x1, y1, x2, y2, col, w, op) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
      '" stroke="' + col + '" stroke-width="' + (w || 1) + '" stroke-linecap="round"' +
      (op != null ? ' opacity="' + op + '"' : '') + '/>';
  }
  function circle(cx, cy, r, fill, extra) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + fill + '"' + (extra || '') + '/>';
  }
  // deterministic pseudo-random so compositions are stable frame to frame
  function rng(seed) { var s = seed || 1; return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }

  function starfield(seed, n, x0, y0, w, h, baseCol) {
    var r = rng(seed), s = '', i;
    for (i = 0; i < n; i++) {
      var x = x0 + r() * w, y = y0 + r() * h, rr = 0.4 + r() * 1.6, op = 0.25 + r() * 0.6;
      s += '<circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="' + rr.toFixed(1) +
        '" fill="' + (baseCol || rgba(WHITE, 1)) + '" opacity="' + op.toFixed(2) + '"/>';
    }
    return s;
  }

  // ================================ SCENES ================================
  // Each scene returns an object: { layers:[html,...], grade:'class', particles:'type', kb:'class' }
  // Layers are stacked back->front; each gets its own parallax depth via CSS.
  var SCENES = {

    // ---------------------------------------------------------------- GARAGE
    // Warm, lonely night. Window with city + stars (far), shelves + workbench
    // (mid), founder hunched at a glowing laptop (near), desk lamp pool, cables,
    // dust motes. Color grade: warm amber.
    garage: function () {
      // Focal subject (desk + glowing laptop + founder) is centered around x=600
      // so it survives a hard portrait crop. Window + shelves are atmospheric
      // background pushed to the upper sides.
      var bg =
        '<defs>' +
        '<linearGradient id="gWall" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#16112c"/><stop offset="0.5" stop-color="#0d0a1f"/><stop offset="1" stop-color="#080612"/></linearGradient>' +
        '<radialGradient id="gWin" cx="0.5" cy="0.35" r="0.8">' +
          '<stop offset="0" stop-color="#1b2c48"/><stop offset="1" stop-color="#0a1122"/></radialGradient>' +
        '<radialGradient id="gMoon" cx="0.5" cy="0.5" r="0.5">' +
          '<stop offset="0" stop-color="' + rgba(CYAN2, 0.9) + '"/><stop offset="1" stop-color="' + rgba(CYAN2, 0) + '"/></radialGradient>' +
        '<radialGradient id="gWarmAmb" cx="0.5" cy="0.72" r="0.6">' +
          '<stop offset="0" stop-color="' + rgba(GOLD, 0.18) + '"/><stop offset="1" stop-color="' + rgba(GOLD, 0) + '"/></radialGradient>' +
        '</defs>' +
        '<rect width="1200" height="750" fill="url(#gWall)"/>' +
        // back-wall window (far depth) — moon, stars, distant skyline. In portrait
        // the whole window group is shifted toward center via CSS (cs-g-window) so
        // the moon + skyline stay inside the narrow visible band.
        '<g class="cs-g-window" opacity="0.95">' +
          '<rect x="150" y="86" width="330" height="250" rx="6" fill="url(#gWin)"/>' +
          cityline(150, 336, 330, rng(7), rgba(CYAN2, 0.4)) +
          starfield(31, 34, 158, 96, 314, 130, rgba(WHITE, 1)) +
          '<circle cx="392" cy="150" r="66" fill="url(#gMoon)" opacity="0.55"/>' +
          '<circle cx="392" cy="150" r="18" fill="' + rgba(CYAN2, 0.85) + '"/>' +
          '<rect x="150" y="86" width="330" height="250" rx="6" fill="none" stroke="' + rgba(VIOLET2, 0.30) + '" stroke-width="4"/>' +
          line(315, 86, 315, 336, rgba(VIOLET2, 0.26), 3) +
          line(150, 211, 480, 211, rgba(VIOLET2, 0.26), 3) +
        '</g>' +
        // upper-right wall shelf with boxes (far depth, balances the window)
        line(770, 150, 1050, 150, rgba(VIOLET2, 0.16), 3) +
        '<g fill="#0e0b20" stroke="' + rgba(VIOLET2, 0.12) + '" stroke-width="2">' +
          '<rect x="800" y="108" width="44" height="42" rx="3"/>' +
          '<rect x="852" y="114" width="34" height="36" rx="3"/>' +
          '<rect x="900" y="106" width="40" height="44" rx="3"/>' +
          '<rect x="956" y="116" width="30" height="34" rx="3"/>' +
        '</g>' +
        // warm ambient pooling around the desk
        '<rect width="1200" height="750" fill="url(#gWarmAmb)"/>';

      var mid =
        '<defs>' + glowFilter('gLamp', 10) + '</defs>' +
        // hanging cable + dim bulb upper area
        line(720, 30, 720, 110, rgba(VIOLET2, 0.22), 2) +
        '<circle cx="720" cy="118" r="6" fill="#1c1932"/>' +
        '<g transform="translate(0,40)"><g class="cs-g-deskfocal">' +
        // the workbench: a long desk across the lower third
        '<g>' +
          '<rect x="250" y="556" width="700" height="20" rx="4" fill="#1b1633"/>' +
          '<rect x="250" y="556" width="700" height="5" fill="' + rgba(VIOLET2, 0.20) + '"/>' +
          '<rect x="300" y="576" width="16" height="150" fill="#120f24"/>' +
          '<rect x="884" y="576" width="16" height="150" fill="#120f24"/>' +
          // a few props on the desk (kept subtle, near the edges)
          '<path d="M300 556 l34 0 0 -26 -34 0 z" fill="#161229"/>' +                 // stack of books
          '<path d="M306 530 l30 0 0 -22 -30 0 z" fill="#18142f"/>' +
          '<circle cx="892" cy="544" r="13" fill="#15122b"/>' +                        // mug
          '<rect x="886" y="533" width="12" height="11" fill="#15122b"/>' +
        '</g>' +
        // articulated desk lamp leaning over the laptop, warm bulb
        '<g>' +
          line(312, 556, 326, 452, rgba(GOLD, 0.42), 5) +
          line(326, 452, 408, 430, rgba(GOLD, 0.42), 5) +
          '<path d="M398 420 l40 8 -16 34 z" fill="#241934"/>' +
          '<circle cx="418" cy="448" r="6" fill="' + rgba(GOLD, 0.95) + '" filter="url(#gLamp)"/>' +
        '</g>' +
        '</g></g>';

      var fg =
        '<defs>' + glowFilter('gScr', 9) +
          '<linearGradient id="gScrFill" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="' + rgba(CYAN2, 0.98) + '"/><stop offset="1" stop-color="#1c5a86"/></linearGradient>' +
          '<radialGradient id="gScrGlow" cx="0.5" cy="0.5" r="0.5">' +
            '<stop offset="0" stop-color="' + rgba(CYAN, 0.6) + '"/><stop offset="1" stop-color="' + rgba(CYAN, 0) + '"/></radialGradient>' +
        '</defs>' +
        '<g transform="translate(0,40)"><g class="cs-g-founder">' +
        // glow pool from the screen, washing the desk + the founder
        '<ellipse cx="640" cy="556" rx="270" ry="88" fill="url(#gScrGlow)"/>' +
        // the open laptop (slightly right of the founder, on the desk)
        '<g filter="url(#gScr)">' +
          '<polygon points="612,556 742,556 762,486 592,486" fill="#0c1c2a"/>' +     // lid back
          '<polygon points="620,550 734,550 750,492 604,492" fill="url(#gScrFill)"/>' + // screen
          '<g>' +
            line(630, 506, 690, 506, rgba(INK, 0.5), 3) +
            line(630, 516, 716, 516, rgba(INK, 0.38), 3) +
            line(630, 526, 672, 526, rgba(INK, 0.5), 3) +
            line(630, 536, 700, 536, rgba(INK, 0.32), 3) +
          '</g>' +
          '<rect x="600" y="556" width="160" height="9" rx="3" fill="#1d1939"/>' +     // keyboard deck
        '</g>' +
        // ---- the founder: a recognizable seated figure, hunched toward the screen ----
        '<g fill="#050409">' +
          // chair back behind him (subtle)
          '<rect x="436" y="470" width="14" height="180" rx="6" fill="#0a0816"/>' +
          // back + seat (lower body), curving up into the spine
          '<path d="M452 690 ' +
            'C 452 612 446 566 470 540 ' +     // seat-to-lower-back
            'C 488 520 506 506 520 470 ' +     // curved back / spine leaning forward
            'L 600 470 ' +                     // shoulder top
            'C 612 520 614 596 612 690 Z"/>' + // chest down to lap, closing the body
          // upper arm + forearm reaching down to the keyboard
          '<path d="M560 500 C 590 512 612 532 628 552 L 612 574 C 590 552 566 536 544 528 Z"/>' +
          // neck + head, tilted down toward the screen
          '<path d="M520 472 q4 -18 22 -22 q26 -6 40 14 q10 30 -16 44 q-30 12 -46 -10 q-6 -14 0 -26 z"/>' +
          '<circle cx="552" cy="452" r="30"/>' +     // head
        '</g>' +
        // cyan rim-light from the screen tracing the founder's near edge
        '<g fill="none" stroke-linecap="round">' +
          '<path d="M578 440 q14 22 8 60 q-2 24 -10 60" stroke="' + rgba(CYAN2, 0.65) + '" stroke-width="4"/>' +
          '<path d="M572 432 q14 8 14 24" stroke="' + rgba(CYAN2, 0.5) + '" stroke-width="3"/>' +
          '<path d="M600 540 q22 8 38 22" stroke="' + rgba(CYAN2, 0.45) + '" stroke-width="3"/>' +
        '</g>' +
        '</g></g>';

      return {
        layers: [svg('cs-bg', bg), svg('cs-mid', mid), svg('cs-fg', fg)],
        grade: 'grade-amber', particles: 'dust', kb: 'kb-in'
      };
    },

    // ----------------------------------------------------------------- DREAM
    // The laptop's glow blooms into a vast neural constellation: a mind
    // awakening. Concentric synapse rings, a bright core, branching dendrites.
    dream: function () {
      var r = rng(99);
      // build a constellation of nodes around the core
      var nodes = [], i;
      for (i = 0; i < 26; i++) {
        var a = (i / 26) * Math.PI * 2 + (i % 2) * 0.18;
        var rad = 150 + (i % 4) * 70 + r() * 40;
        nodes.push([600 + Math.cos(a) * rad, 375 + Math.sin(a) * rad * 0.82]);
      }
      var links = '<g stroke="' + rgba(VIOLET2, 0.22) + '" stroke-width="1.4">';
      nodes.forEach(function (p, k) {
        links += line(600, 375, p[0], p[1], rgba(VIOLET2, 0.14 + (k % 3) * 0.05), 1.4);
        var q = nodes[(k + 5) % nodes.length];
        links += line(p[0], p[1], q[0], q[1], rgba(CYAN, 0.10), 1);
      });
      links += '</g>';
      var dots = '';
      nodes.forEach(function (p, k) {
        var rr = 2 + (k % 3) * 1.6;
        dots += circle(p[0], p[1], rr, rgba(k % 2 ? CYAN2 : VIOLET2, 0.92), ' class="cs-pulse" style="--pd:' + (k % 6) + 's"');
      });

      var bg =
        '<defs><radialGradient id="gDreamBg" cx="0.5" cy="0.5" r="0.62">' +
          '<stop offset="0" stop-color="#120e2e"/><stop offset="0.6" stop-color="#0a0820"/><stop offset="1" stop-color="#050410"/></radialGradient></defs>' +
        '<rect width="1200" height="750" fill="url(#gDreamBg)"/>' +
        starfield(11, 80, 0, 0, 1200, 750, rgba(VIOLET2, 1));

      var mid =
        '<g fill="none">' +
          ellipseRing(600, 375, 360, 150, 16, rgba(CYAN, 0.20), 1.6) +
          ellipseRing(600, 375, 320, 320, 0, rgba(VIOLET2, 0.12), 1.4) +
          ellipseRing(600, 375, 360, 150, -40, rgba(VIOLET2, 0.18), 1.6) +
        '</g>' + links;

      var fg =
        '<defs>' + glowFilter('gCore', 14) +
          '<radialGradient id="gCoreFill" cx="0.5" cy="0.5" r="0.5">' +
            '<stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="' + rgba(CYAN2, 1) + '"/><stop offset="1" stop-color="' + rgba(CYAN, 0) + '"/></radialGradient>' +
        '</defs>' +
        dots +
        '<g filter="url(#gCore)"><circle cx="600" cy="375" r="46" fill="url(#gCoreFill)" class="cs-breathe"/></g>' +
        // a few bright synapse sparks near the core
        circle(540, 320, 3, rgba(WHITE, 0.9), ' class="cs-pulse" style="--pd:1s"') +
        circle(672, 410, 2.6, rgba(WHITE, 0.85), ' class="cs-pulse" style="--pd:3s"');

      return {
        layers: [svg('cs-bg', bg), svg('cs-mid', mid), svg('cs-fg', fg)],
        grade: 'grade-cyan', particles: 'motes', kb: 'kb-zoom'
      };
    },

    // ----------------------------------------------------------------- RIVALS
    // A cold dawn horizon. Distant corporate towers race upward, each crowned
    // with a glowing logo-light. The race has begun. Color grade: cold steel.
    rivals: function () {
      var bg =
        '<defs>' +
          '<linearGradient id="gDawn" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#0b1430"/><stop offset="0.5" stop-color="#0a1326"/><stop offset="1" stop-color="#060814"/></linearGradient>' +
          '<radialGradient id="gHorizon" cx="0.5" cy="1" r="0.8">' +
            '<stop offset="0" stop-color="' + rgba(CYAN, 0.22) + '"/><stop offset="0.5" stop-color="' + rgba(VIOLET, 0.10) + '"/><stop offset="1" stop-color="transparent"/></radialGradient>' +
        '</defs>' +
        '<rect width="1200" height="750" fill="url(#gDawn)"/>' +
        starfield(53, 70, 0, 0, 1200, 360, rgba(CYAN2, 1)) +
        '<rect width="1200" height="750" fill="url(#gHorizon)"/>' +
        // ground haze line
        '<rect x="0" y="560" width="1200" height="190" fill="' + rgba(INK, 0.55) + '"/>' +
        line(0, 560, 1200, 560, rgba(CYAN, 0.25), 2);

      // a skyline of rival towers, several taller/glowing (the giants)
      function tower(x, w, h, glow, col) {
        var top = 560 - h;
        var s = '<rect x="' + x + '" y="' + top + '" width="' + w + '" height="' + (h + 4) + '" fill="#0c1124" stroke="' + rgba(col, 0.3) + '" stroke-width="1.5"/>';
        // window grid
        var gx, gy, rr = rng(x);
        for (gx = x + 8; gx < x + w - 6; gx += 14) {
          for (gy = top + 12; gy < 556; gy += 18) {
            if (rr() > 0.6) s += '<rect x="' + gx + '" y="' + gy + '" width="5" height="7" fill="' + rgba(col, 0.45) + '"/>';
          }
        }
        if (glow) {
          s += '<circle cx="' + (x + w / 2) + '" cy="' + (top - 6) + '" r="9" fill="' + rgba(col, 0.95) + '" filter="url(#gTwr)"/>';
          s += line(x + w / 2, top, x + w / 2, top - 60, rgba(col, 0.5), 2);
        }
        return s;
      }
      var mid =
        '<defs>' + glowFilter('gTwr', 8) + '</defs>' +
        // far, faint towers
        '<g opacity="0.55">' +
          tower(70, 50, 150, false, CYAN2) + tower(150, 40, 120, false, VIOLET2) +
          tower(1010, 55, 165, false, CYAN2) + tower(1110, 46, 130, false, VIOLET2) +
        '</g>' +
        // the glowing giants (nearer, racing upward). The CENTER cluster
        // (x~448..760) is packed so a hard portrait crop still reads as a
        // skyline of competing towers, not one building.
        tower(250, 70, 280, true, CYAN) +
        tower(346, 56, 220, true, VIOLET2) +
        tower(452, 70, 330, true, CYAN2) +     // center-band giants:
        tower(534, 52, 200, true, GOLD) +      //  varied heights so the crop
        tower(608, 80, 386, true, CYAN) +      //  shows a real race
        tower(700, 58, 258, true, VIOLET) +
        tower(774, 74, 312, true, CYAN2) +
        tower(866, 60, 226, true, VIOLET2);

      var fg =
        // upward "race" arrows / speed streaks rising past the towers
        '<g class="cs-streaks">' +
          line(330, 560, 318, 180, rgba(CYAN, 0.16), 2) +
          line(742, 560, 728, 120, rgba(CYAN2, 0.18), 2) +
          line(872, 560, 860, 230, rgba(VIOLET2, 0.14), 2) +
        '</g>' +
        // foreground silhouette: our small lone tower / founder vantage at lower-left
        '<g fill="#040309">' +
          '<rect x="40" y="470" width="120" height="120" rx="4"/>' +
          '<circle cx="100" cy="452" r="20"/>' +
        '</g>' +
        '<path d="M118 442 q10 18 6 44" stroke="' + rgba(GOLD, 0.5) + '" stroke-width="3" fill="none"/>';

      return {
        layers: [svg('cs-bg', bg), svg('cs-mid', mid), svg('cs-fg', fg)],
        grade: 'grade-steel', particles: 'embers', kb: 'kb-pan'
      };
    },

    // ----------------------------------------------------------------- STAKES
    // Three great glowing dials/orbs hang in the dark: Power (violet),
    // Price (gold), Safety (cyan). Each on a thin axis, gently rotating gauges.
    stakes: function () {
      var bg =
        '<defs><radialGradient id="gStkBg" cx="0.5" cy="0.46" r="0.7">' +
          '<stop offset="0" stop-color="#140f2c"/><stop offset="0.6" stop-color="#0a0820"/><stop offset="1" stop-color="#06040f"/></radialGradient></defs>' +
        '<rect width="1200" height="750" fill="url(#gStkBg)"/>' +
        starfield(71, 60, 0, 0, 1200, 750, rgba(VIOLET2, 1));

      // Triangular cluster centered on x=600 so all three orbs survive a tall
      // portrait crop (visible band ~x440..760). Top = Price, lower flanks =
      // Power (left) + Safety (right).
      function orb(cx, cy, rr, col, frac, gid) {
        var circ = 2 * Math.PI * (rr + 16);
        var dash = (circ * frac).toFixed(1) + ' ' + circ.toFixed(1);
        return '<g>' +
          // gauge track
          '<circle cx="' + cx + '" cy="' + cy + '" r="' + (rr + 16) + '" fill="none" stroke="' + rgba(WHITE, 0.07) + '" stroke-width="6"/>' +
          // gauge value arc (rotated to start at top)
          '<circle cx="' + cx + '" cy="' + cy + '" r="' + (rr + 16) + '" fill="none" stroke="' + rgba(col, 0.9) +
            '" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + dash + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>' +
          // glowing core orb
          '<g filter="url(#' + gid + ')"><circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="url(#fill' + gid + ')" class="cs-breathe"/></g>' +
          '<defs><radialGradient id="fill' + gid + '" cx="0.42" cy="0.4" r="0.62">' +
            '<stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="' + rgba(col, 1) + '"/><stop offset="1" stop-color="' + rgba(col, 0.05) + '"/></radialGradient></defs>' +
          '</g>';
      }
      // orb centers
      var PX = 466, PY = 398, CX = 600, CY = 190, SX = 734, SY = 398;
      var mid =
        '<defs>' + glowFilter('gP', 12) + glowFilter('gC', 12) + glowFilter('gS', 12) + '</defs>' +
        '<g class="cs-g-stk">' +
        // connecting triangle beams (the three are linked decisions)
        '<g stroke-linecap="round">' +
          line(CX, CY, PX, PY, rgba(WHITE, 0.12), 2) +
          line(CX, CY, SX, SY, rgba(WHITE, 0.12), 2) +
          line(PX, PY, SX, SY, rgba(WHITE, 0.10), 2) +
        '</g>' +
        orb(CX, CY, 66, GOLD, 0.55, 'gC') +
        orb(PX, PY, 54, VIOLET, 0.7, 'gP') +
        orb(SX, SY, 54, CYAN, 0.82, 'gS') +
        '</g>';

      var fg =
        '<g class="cs-g-stk">' +
        // glyphs inside each orb (coin / bolt / shield)
        '<g fill="none" stroke="' + rgba(INK, 0.62) + '" stroke-width="4" stroke-linecap="round">' +
          // coin (price) at top
          '<circle cx="' + CX + '" cy="' + CY + '" r="22"/>' +
          '<path d="M' + CX + ' ' + (CY - 12) + ' v24 M' + (CX - 11) + ' ' + CY + ' h22"/>' +
          // bolt (power) lower-left
          '<path d="M' + (PX + 6) + ' ' + (PY - 26) + ' l-18 32 14 0 -6 22 20 -34 -14 0 z" fill="' + rgba(INK, 0.6) + '" stroke="none"/>' +
          // shield (safety) lower-right
          '<path d="M' + SX + ' ' + (SY - 26) + ' l22 8 0 20 q0 17 -22 26 q-22 -9 -22 -26 l0 -20 z"/>' +
        '</g>' +
        // Decorative orb labels REMOVED: the long localized strings (МОЩНОСТЬ /
        // БЕЗОПАСНОСТЬ) collided with the lower-third caption (title/body) at desktop
        // sizes and clipped off-screen in portrait. The caption body already names
        // Power · Price · Safety, so the labels were redundant — dropping them
        // eliminates the text overlap at every size while keeping the orb glyphs.
        '</g>';

      return {
        layers: [svg('cs-bg', bg), svg('cs-mid', mid), svg('cs-fg', fg)],
        grade: 'grade-violet', particles: 'motes', kb: 'kb-in'
      };
    },

    // ------------------------------------------------------------------ TITLE
    // The SINGULARITY INC. brand bloom — a brilliant core over a horizon, the
    // path from garage to a god-from-the-machine.
    title: function () {
      var rays = '', i;
      for (i = 0; i < 40; i++) {
        var a = (i / 40) * Math.PI * 2;
        var x2 = 600 + Math.cos(a) * 760, y2 = 360 + Math.sin(a) * 760;
        rays += line(600, 360, x2, y2, rgba(i % 2 ? CYAN : VIOLET2, 0.05 + (i % 3) * 0.03), 2);
      }
      var bg =
        '<defs><radialGradient id="gTitBg" cx="0.5" cy="0.48" r="0.72">' +
          '<stop offset="0" stop-color="#16122f"/><stop offset="0.55" stop-color="#0a0820"/><stop offset="1" stop-color="#05040f"/></radialGradient></defs>' +
        '<rect width="1200" height="750" fill="url(#gTitBg)"/>' +
        starfield(91, 90, 0, 0, 1200, 750, rgba(WHITE, 1));
      var mid = '<g class="cs-spin-slow" style="transform-origin:600px 360px">' + rays + '</g>';
      var fg =
        '<defs>' + glowFilter('gTit', 18) +
          '<radialGradient id="gTitCore" cx="0.5" cy="0.5" r="0.5">' +
            '<stop offset="0" stop-color="#ffffff"/><stop offset="0.4" stop-color="' + rgba(CYAN2, 1) + '"/><stop offset="0.75" stop-color="' + rgba(VIOLET, 0.6) + '"/><stop offset="1" stop-color="' + rgba(VIOLET, 0) + '"/></radialGradient>' +
        '</defs>' +
        '<g fill="none">' +
          '<circle cx="600" cy="360" r="120" stroke="' + rgba(CYAN, 0.35) + '" stroke-width="2"/>' +
          '<circle cx="600" cy="360" r="180" stroke="' + rgba(VIOLET2, 0.22) + '" stroke-width="2"/>' +
          '<circle cx="600" cy="360" r="250" stroke="' + rgba(CYAN, 0.12) + '" stroke-width="2"/>' +
        '</g>' +
        '<g filter="url(#gTit)"><circle cx="600" cy="360" r="74" fill="url(#gTitCore)" class="cs-breathe"/></g>';
      return {
        layers: [svg('cs-bg', bg), svg('cs-mid', mid), svg('cs-fg', fg)],
        grade: 'grade-title', particles: 'motes', kb: 'kb-zoom'
      };
    },

    // ------------------------------------------------------------------ MODEL
    // First model live: a network bloom across a stylized globe of user-lights,
    // millions of nodes flaring across the world.
    model: function () {
      var bg =
        '<defs><radialGradient id="gMdlBg" cx="0.5" cy="0.5" r="0.62">' +
          '<stop offset="0" stop-color="#12102c"/><stop offset="0.6" stop-color="#090720"/><stop offset="1" stop-color="#05040f"/></radialGradient></defs>' +
        '<rect width="1200" height="750" fill="url(#gMdlBg)"/>' +
        starfield(23, 80, 0, 0, 1200, 750, rgba(CYAN2, 1));

      // a globe: latitude/longitude arcs + a scatter of user lights
      var globe = '<g fill="none" stroke="' + rgba(CYAN, 0.18) + '" stroke-width="1.4">';
      var R = 250, cx = 600, cy = 375, i;
      globe += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" stroke="' + rgba(CYAN, 0.3) + '" stroke-width="2"/>';
      for (i = 1; i < 5; i++) { // latitudes
        var yy = cy - R + (i * 2 * R / 5);
        var rx = Math.sqrt(Math.max(0, R * R - (yy - cy) * (yy - cy)));
        globe += '<ellipse cx="' + cx + '" cy="' + yy + '" rx="' + rx.toFixed(0) + '" ry="' + (rx * 0.16).toFixed(0) + '"/>';
      }
      for (i = 0; i < 5; i++) { // longitudes
        var ry2 = R, rx2 = R * (0.18 + i * 0.2);
        globe += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx2.toFixed(0) + '" ry="' + ry2 + '"/>';
      }
      globe += '</g>';

      // user lights scattered on the globe + radiating links from core
      var r = rng(5), users = [], lights = '';
      for (i = 0; i < 34; i++) {
        var a = r() * Math.PI * 2, rr = R * (0.2 + r() * 0.78);
        var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.92;
        users.push([x, y]);
        lights += circle(x, y, 1.6 + r() * 2.4, rgba(r() > 0.5 ? CYAN2 : VIOLET2, 0.9),
          ' class="cs-pulse" style="--pd:' + (i % 7) + 's"');
      }
      var links = '<g stroke="' + rgba(VIOLET2, 0.16) + '" stroke-width="1">';
      users.forEach(function (p) { links += line(cx, cy, p[0], p[1], rgba(VIOLET2, 0.12), 1); });
      links += '</g>';

      var mid = globe + links + lights;

      var fg =
        '<defs>' + glowFilter('gMdl', 16) +
          '<radialGradient id="gMdlCore" cx="0.5" cy="0.5" r="0.5">' +
            '<stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="' + rgba(VIOLET2, 1) + '"/><stop offset="1" stop-color="' + rgba(VIOLET, 0) + '"/></radialGradient>' +
        '</defs>' +
        '<g fill="none">' +
          '<circle cx="600" cy="375" r="150" stroke="' + rgba(CYAN, 0.3) + '" stroke-width="2" class="cs-ring1"/>' +
          '<circle cx="600" cy="375" r="220" stroke="' + rgba(VIOLET2, 0.2) + '" stroke-width="2" class="cs-ring2"/>' +
        '</g>' +
        '<g filter="url(#gMdl)"><circle cx="600" cy="375" r="52" fill="url(#gMdlCore)" class="cs-breathe"/></g>';

      return {
        layers: [svg('cs-bg', bg), svg('cs-mid', mid), svg('cs-fg', fg)],
        grade: 'grade-violet', particles: 'motes', kb: 'kb-zoom'
      };
    },

    // -------------------------------------------------------------- SINGULARITY
    // The grand finale: a blooming singularity cosmos — concentric rings, rays,
    // a brilliant core, the transformed world below.
    singularity: function () {
      var rays = '', i;
      for (i = 0; i < 56; i++) {
        var a = (i / 56) * Math.PI * 2;
        var x2 = 600 + Math.cos(a) * 820, y2 = 360 + Math.sin(a) * 820;
        rays += line(600, 360, x2, y2, rgba(i % 2 ? CYAN : GOLD, 0.05 + (i % 3) * 0.04), 2);
      }
      var bg =
        '<defs><radialGradient id="gSngBg" cx="0.5" cy="0.46" r="0.78">' +
          '<stop offset="0" stop-color="#0c2436"/><stop offset="0.5" stop-color="#0a0e26"/><stop offset="1" stop-color="#04040c"/></radialGradient></defs>' +
        '<rect width="1200" height="750" fill="url(#gSngBg)"/>' +
        starfield(13, 110, 0, 0, 1200, 750, rgba(WHITE, 1));

      var mid =
        '<g class="cs-spin-slow" style="transform-origin:600px 360px">' + rays + '</g>' +
        '<g fill="none">' +
          '<circle cx="600" cy="360" r="120" stroke="' + rgba(CYAN, 0.45) + '" stroke-width="2" class="cs-ring1"/>' +
          '<circle cx="600" cy="360" r="190" stroke="' + rgba(VIOLET2, 0.3) + '" stroke-width="2" class="cs-ring2"/>' +
          '<circle cx="600" cy="360" r="270" stroke="' + rgba(GOLD, 0.18) + '" stroke-width="2" class="cs-ring1"/>' +
          '<circle cx="600" cy="360" r="350" stroke="' + rgba(CYAN, 0.10) + '" stroke-width="2"/>' +
        '</g>';

      var fg =
        '<defs>' + glowFilter('gSng', 22) +
          '<radialGradient id="gSngCore" cx="0.5" cy="0.5" r="0.5">' +
            '<stop offset="0" stop-color="#ffffff"/><stop offset="0.35" stop-color="' + rgba(CYAN2, 1) + '"/><stop offset="0.7" stop-color="' + rgba(GOLD, 0.5) + '"/><stop offset="1" stop-color="' + rgba(CYAN, 0) + '"/></radialGradient>' +
        '</defs>' +
        // transformed-world horizon glow at the base
        '<rect x="0" y="600" width="1200" height="150" fill="' + rgba(INK, 0.4) + '"/>' +
        cityline(0, 612, 1200, rng(3), rgba(CYAN2, 0.5)) +
        '<g filter="url(#gSng)"><circle cx="600" cy="360" r="92" fill="url(#gSngCore)" class="cs-breathe"/></g>';

      return {
        layers: [svg('cs-bg', bg), svg('cs-mid', mid), svg('cs-fg', fg)],
        grade: 'grade-singularity', particles: 'embers', kb: 'kb-zoom'
      };
    }
  };

  // a low skyline silhouette of buildings (reused by garage window + finale)
  function cityline(x0, baseY, w, r, glowCol) {
    var s = '<g fill="#0a1224">', x = x0, lit = '';
    while (x < x0 + w) {
      var bw = 18 + r() * 40, bh = 30 + r() * 120;
      s += '<rect x="' + x.toFixed(0) + '" y="' + (baseY - bh).toFixed(0) + '" width="' + bw.toFixed(0) + '" height="' + bh.toFixed(0) + '"/>';
      // a few lit windows
      if (glowCol && r() > 0.4) {
        lit += '<rect x="' + (x + bw / 2).toFixed(0) + '" y="' + (baseY - bh + 8).toFixed(0) + '" width="3" height="4" fill="' + glowCol + '"/>';
      }
      x += bw + 2;
    }
    s += '</g>';
    return s + lit;
  }
  function ellipseRing(cx, cy, rx, ry, rot, col, w) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" stroke="' + col +
      '" stroke-width="' + (w || 1.5) + '" transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"/>';
  }

  // ================================ ENGINE ================================
  // opts: { kind, beats:[{scene,title,body}], skipLabel, lastLabel, onDone }
  function play(opts) {
    opts = opts || {};
    var beats = opts.beats || [];
    if (!beats.length) { if (opts.onDone) opts.onDone(); return; }
    if (active) { try { active.end(true); } catch (e) {} }

    var kind = opts.kind || 'intro';
    var idx = 0, ended = false, timer = null, ceiling = null;
    // dwell per beat (ms). reduced-motion -> shorter (less waiting).
    var BEAT_MS = reduce ? 2800 : 7200;
    var CEILING_MS = (BEAT_MS * beats.length) + 6000;

    var ov = document.createElement('div');
    ov.className = 'cutscene cs-' + kind + (reduce ? ' cs-reduce' : '') + (isPortrait() ? ' cs-portrait' : '');
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.innerHTML =
      '<div class="cs-stage">' +
        '<div class="cs-scene"></div>' +
        '<div class="cs-particles"></div>' +
        '<div class="cs-grade"></div>' +
        '<div class="cs-grain"></div>' +
        '<div class="cs-vignette"></div>' +
        '<div class="cs-bars"><span class="cs-bar cs-bar-t"></span><span class="cs-bar cs-bar-b"></span></div>' +
        '<div class="cs-scrim"></div>' +
      '</div>' +
      '<div class="cs-caption">' +
        '<div class="cs-title"></div>' +
        '<div class="cs-body"></div>' +
        '<div class="cs-dots"></div>' +
      '</div>' +
      '<button type="button" class="cs-skip"></button>' +
      '<button type="button" class="cs-next"></button>';
    document.body.appendChild(ov);

    var sceneEl = ov.querySelector('.cs-scene');
    var partEl = ov.querySelector('.cs-particles');
    var gradeEl = ov.querySelector('.cs-grade');
    var titleEl = ov.querySelector('.cs-title');
    var bodyEl = ov.querySelector('.cs-body');
    var dotsEl = ov.querySelector('.cs-dots');
    var capEl = ov.querySelector('.cs-caption');
    var skipBtn = ov.querySelector('.cs-skip');
    var nextBtn = ov.querySelector('.cs-next');

    skipBtn.textContent = t(opts.skipLabel || 'cut_skip');
    var d = '';
    for (var i = 0; i < beats.length; i++) d += '<span class="cs-dot"></span>';
    dotsEl.innerHTML = d;
    var dotEls = dotsEl.querySelectorAll('.cs-dot');

    // build the particle layer for a scene type
    function buildParticles(type) {
      if (reduce) return '';
      var n = type === 'dust' ? 22 : type === 'embers' ? 18 : 24;
      var r = rng(type === 'dust' ? 2 : type === 'embers' ? 4 : 6), s = '', k;
      for (k = 0; k < n; k++) {
        var left = (r() * 100).toFixed(1), top = (r() * 100).toFixed(1);
        var sz = (type === 'dust' ? 1.5 + r() * 2 : type === 'embers' ? 2 + r() * 3 : 2 + r() * 2.5).toFixed(1);
        var dur = (8 + r() * 10).toFixed(1), delay = (-r() * 12).toFixed(1);
        var drift = (-30 - r() * 50).toFixed(0);
        var dx = ((r() - 0.5) * 40).toFixed(0);
        s += '<span class="cs-pt pt-' + type + '" style="left:' + left + '%;top:' + top + '%;' +
          'width:' + sz + 'px;height:' + sz + 'px;' +
          '--dur:' + dur + 's;animation-delay:' + delay + 's;--dy:' + drift + 'px;--dx:' + dx + 'px"></span>';
      }
      return s;
    }

    function renderBeat() {
      var b = beats[idx];
      var sceneFn = (b.scene && SCENES[b.scene]) ? SCENES[b.scene] : null;
      var sc = sceneFn ? sceneFn() : { layers: [], grade: '', particles: '', kb: 'kb-in' };
      // scene layers, wrapped in a Ken-Burns mover
      sceneEl.className = 'cs-scene ' + (reduce ? '' : (sc.kb || 'kb-in'));
      sceneEl.innerHTML = sc.layers.join('');
      partEl.innerHTML = buildParticles(sc.particles);
      gradeEl.className = 'cs-grade ' + (sc.grade || '');
      // restart entrance: scene fades+blooms, caption reveals rhythmically
      sceneEl.classList.remove('in'); void sceneEl.offsetWidth; sceneEl.classList.add('in');
      capEl.classList.remove('in'); void capEl.offsetWidth; capEl.classList.add('in');
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
      idx++; renderBeat(); arm();
    }
    function arm() { if (timer) clearTimeout(timer); timer = setTimeout(advance, BEAT_MS); }
    function end(silent) {
      if (ended) return; ended = true;
      try { window.removeEventListener('resize', onResize); } catch (e) {}
      if (timer) clearTimeout(timer);
      if (ceiling) clearTimeout(ceiling);
      ov.classList.add('out');
      if (!silent) sfx('buy');
      active = null;
      setTimeout(function () {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        if (!silent && opts.onDone) { try { opts.onDone(); } catch (e) {} }
      }, 420);
    }

    // keep the portrait tag current across rotation / resize
    function onResize() { if (ov && ov.classList) ov.classList.toggle('cs-portrait', isPortrait()); }
    window.addEventListener('resize', onResize);

    nextBtn.addEventListener('click', function (e) { e.stopPropagation(); advance(); });
    skipBtn.addEventListener('click', function (e) { e.stopPropagation(); end(false); });
    ov.querySelector('.cs-stage').addEventListener('click', function () { advance(); });

    active = { end: end };
    ceiling = setTimeout(function () { end(false); }, CEILING_MS);
    renderBeat();
    arm();
    return active;
  }

  // ================================ STORIES ================================
  function intro(onDone) {
    play({
      kind: 'intro',
      skipLabel: 'cut_skip_intro',
      lastLabel: 'cut_begin',
      beats: [
        { scene: 'garage', title: 'cut_intro1_title', body: 'cut_intro1_body' },
        { scene: 'dream', title: 'cut_intro2_title', body: 'cut_intro2_body' },
        { scene: 'rivals', title: 'cut_intro3_title', body: 'cut_intro3_body' },
        { scene: 'stakes', title: 'cut_intro4_title', body: 'cut_intro4_body' },
        { scene: 'title', title: 'cut_intro5_title', body: 'cut_intro5_body' }
      ],
      onDone: onDone
    });
  }

  function firstModel(onDone) {
    play({
      kind: 'firstmodel',
      lastLabel: 'cut_continue',
      beats: [
        { scene: 'model', title: 'cut_firstmodel_title', body: 'cut_firstmodel_body' }
      ],
      onDone: onDone
    });
  }

  function agiVictory(opts) {
    opts = opts || {};
    play({
      kind: 'victory',
      lastLabel: 'cut_continue',
      beats: [
        { scene: 'singularity', title: 'cut_victory_title', body: 'cut_victory_lead' },
        { scene: 'singularity', title: 'cut_victory_title', body: opts.safe ? 'cut_victory_safe' : 'cut_victory_reckless' }
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
