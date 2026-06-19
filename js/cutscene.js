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
    },

    // =====================================================================
    // PREMISE-MOVE CHAPTERS (garage -> AGI). One cinematic beat per upgrade.
    // Each is a bespoke composition in the master-craft style: layered SVG
    // (bg/mid/fg parallax) + Ken-Burns + grade + particles, with a central
    // focal group tagged .cs-g-prem so portrait recomposition lifts it into
    // the visible band. Focal subjects are built around x=600 to survive the
    // hard portrait crop.
    // =====================================================================

    // ------------------------------------------------- BASEMENT (chapter 1)
    // Outgrew the garage. First real servers humming in a cheap basement —
    // scrappy, illicit-feeling: a single caged bulb over two short racks of
    // blinking server LEDs in the dark, cables snaking across a concrete floor.
    premBasement: function () {
      var bg =
        '<defs>' +
          '<linearGradient id="gBsmW" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#0c1320"/><stop offset="0.55" stop-color="#080d18"/><stop offset="1" stop-color="#05080f"/></linearGradient>' +
          '<radialGradient id="gBsmBulb" cx="0.5" cy="0.5" r="0.5">' +
            '<stop offset="0" stop-color="' + rgba(GOLD, 0.55) + '"/><stop offset="0.5" stop-color="' + rgba(GOLD, 0.14) + '"/><stop offset="1" stop-color="' + rgba(GOLD, 0) + '"/></radialGradient>' +
        '</defs>' +
        '<rect width="1200" height="750" fill="url(#gBsmW)"/>' +
        // bare concrete wall: faint horizontal seams + damp patches
        '<g stroke="' + rgba(WHITE, 0.04) + '" stroke-width="2">' +
          line(0, 250, 1200, 250, rgba(WHITE, 0.04), 2) +
          line(0, 430, 1200, 430, rgba(WHITE, 0.04), 2) +
        '</g>' +
        '<g fill="' + rgba(CYAN, 0.03) + '">' +
          '<ellipse cx="210" cy="200" rx="120" ry="70"/>' +
          '<ellipse cx="1000" cy="320" rx="150" ry="90"/>' +
        '</g>' +
        // a small high basement window, barred (scrappy, illicit)
        '<g class="cs-g-bsmwin" opacity="0.9">' +
          '<rect x="120" y="110" width="150" height="74" rx="3" fill="#0d1a2c"/>' +
          '<rect x="120" y="110" width="150" height="74" rx="3" fill="none" stroke="' + rgba(CYAN2, 0.22) + '" stroke-width="3"/>' +
          line(170, 110, 170, 184, rgba(CYAN2, 0.30), 2) +
          line(220, 110, 220, 184, rgba(CYAN2, 0.30), 2) +
          line(120, 147, 270, 147, rgba(CYAN2, 0.20), 2) +
        '</g>' +
        // the caged hanging bulb, dead-center, its warm pool the only soft light
        line(600, 30, 600, 150, rgba(WHITE, 0.18), 2) +
        '<rect width="1200" height="750" fill="url(#gBsmBulb)" opacity="0.5"/>';

      var mid =
        '<defs>' + glowFilter('gBsmL', 9) + '</defs>' +
        '<g class="cs-g-prem">' +
        // caged bulb fixture
        '<g>' +
          '<circle cx="600" cy="162" r="11" fill="' + rgba(GOLD, 0.95) + '" filter="url(#gBsmL)"/>' +
          '<g fill="none" stroke="' + rgba(WHITE, 0.16) + '" stroke-width="2">' +
            '<path d="M584 150 q16 28 32 0"/>' +
            '<path d="M580 162 h40"/>' +
            line(600, 150, 600, 174, rgba(WHITE, 0.16), 2) +
            line(586, 154, 614, 170, rgba(WHITE, 0.12), 2) +
            line(614, 154, 586, 170, rgba(WHITE, 0.12), 2) +
          '</g>' +
        '</g>' +
        // concrete floor band + the pool of light on it
        '<rect x="0" y="600" width="1200" height="150" fill="#070a12"/>' +
        line(0, 600, 1200, 600, rgba(WHITE, 0.05), 2) +
        '<ellipse cx="600" cy="610" rx="300" ry="44" fill="' + rgba(GOLD, 0.07) + '"/>' +
        // cables snaking across the floor toward the racks
        '<g fill="none" stroke-linecap="round">' +
          '<path d="M470 600 q60 26 130 14 q70 -12 130 12" stroke="' + rgba(VIOLET2, 0.22) + '" stroke-width="4"/>' +
          '<path d="M500 612 q50 18 100 10 q70 -8 120 16" stroke="' + rgba(CYAN, 0.18) + '" stroke-width="3"/>' +
        '</g>' +
        '</g>';

      // two short server racks flanking center, faces of blinking LEDs
      function rack(x, w, h) {
        var top = 600 - h, s =
          '<rect x="' + x + '" y="' + top + '" width="' + w + '" height="' + h + '" rx="4" fill="#0b1018" stroke="' + rgba(CYAN2, 0.18) + '" stroke-width="2"/>' +
          '<rect x="' + x + '" y="' + top + '" width="' + w + '" height="' + h + '" rx="4" fill="none" stroke="' + rgba(WHITE, 0.04) + '" stroke-width="6"/>';
        // rack units with LED rows
        var uy, k = 0, rr = rng(x);
        for (uy = top + 10; uy < 600 - 10; uy += 26) {
          s += '<rect x="' + (x + 6) + '" y="' + uy + '" width="' + (w - 12) + '" height="20" rx="2" fill="#101826"/>';
          var lx;
          for (lx = x + 14; lx < x + w - 14; lx += 16) {
            var on = rr() > 0.45;
            var col = rr() > 0.5 ? CYAN2 : (rr() > 0.5 ? VIOLET2 : GOLD);
            s += circle(lx, uy + 10, 2.4, rgba(col, on ? 0.95 : 0.2),
              on ? ' class="cs-pulse" style="--pd:' + (k % 6) + 's"' : '');
            k++;
          }
        }
        return s;
      }
      var fg =
        '<g class="cs-g-prem">' +
        rack(396, 150, 300) +
        rack(654, 150, 330) +
        // faint cold rim-light tracing the near edges of the racks
        '<g fill="none" stroke-linecap="round">' +
          line(396, 300, 396, 600, rgba(CYAN2, 0.30), 3) +
          line(804, 300, 804, 600, rgba(CYAN2, 0.26), 3) +
        '</g>' +
        // a coil of slack cable on the floor between them
        '<path d="M560 690 q40 -28 80 0 q40 28 -10 26 q-50 -2 -70 -26 z" fill="none" stroke="' + rgba(VIOLET2, 0.3) + '" stroke-width="3"/>' +
        '</g>';

      return {
        layers: [svg('cs-bg', bg), svg('cs-mid', mid), svg('cs-fg', fg)],
        grade: 'grade-steel', particles: 'embers', kb: 'kb-in'
      };
    },

    // --------------------------------------------------- OFFICE (chapter 2)
    // Gone legit. A real office: daylight floods through tall windows, desks
    // with glowing monitors, a whiteboard of diagrams, a plant — the team
    // grows, the company becomes real.
    premOffice: function () {
      var bg =
        '<defs>' +
          '<linearGradient id="gOffW" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#172338"/><stop offset="0.6" stop-color="#101a2c"/><stop offset="1" stop-color="#0b1320"/></linearGradient>' +
          '<linearGradient id="gOffDay" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="' + rgba(CYAN2, 0.85) + '"/><stop offset="0.6" stop-color="' + rgba(CYAN2, 0.35) + '"/><stop offset="1" stop-color="' + rgba(GOLD, 0.18) + '"/></linearGradient>' +
          '<radialGradient id="gOffSun" cx="0.5" cy="0.3" r="0.7">' +
            '<stop offset="0" stop-color="' + rgba(GOLD, 0.22) + '"/><stop offset="1" stop-color="' + rgba(GOLD, 0) + '"/></radialGradient>' +
        '</defs>' +
        '<rect width="1200" height="750" fill="url(#gOffW)"/>' +
        // a long wall of tall windows with daylight + a soft city beyond
        '<g class="cs-g-offwin">' +
          '<rect x="150" y="120" width="900" height="330" rx="6" fill="url(#gOffDay)" opacity="0.55"/>' +
          cityline(150, 450, 900, rng(17), rgba(WHITE, 0.5)) +
          // window mullions
          '<g stroke="' + rgba(WHITE, 0.18) + '" stroke-width="3" fill="none">' +
            '<rect x="150" y="120" width="900" height="330" rx="6"/>' +
            line(375, 120, 375, 450, rgba(WHITE, 0.16), 3) +
            line(600, 120, 600, 450, rgba(WHITE, 0.16), 3) +
            line(825, 120, 825, 450, rgba(WHITE, 0.16), 3) +
            line(150, 285, 1050, 285, rgba(WHITE, 0.12), 3) +
          '</g>' +
        '</g>' +
        '<rect width="1200" height="750" fill="url(#gOffSun)"/>';

      var mid =
        '<defs>' + glowFilter('gOffM', 5) + '</defs>' +
        '<g class="cs-g-prem">' +
        // whiteboard of diagrams on the right wall
        '<g>' +
          '<rect x="864" y="300" width="170" height="118" rx="4" fill="#f4f6ff" opacity="0.9"/>' +
          '<g stroke="' + rgba(VIOLET, 0.65) + '" stroke-width="2.5" fill="none" stroke-linecap="round">' +
            '<circle cx="900" cy="340" r="12"/>' +
            line(912, 340, 950, 332, rgba(VIOLET, 0.6), 2.5) +
            line(912, 346, 956, 366, rgba(CYAN, 0.6), 2.5) +
            '<circle cx="962" cy="330" r="8"/>' +
            '<circle cx="968" cy="370" r="8"/>' +
            line(884, 392, 1014, 392, rgba(GOLD, 0.55), 3) +
            '<path d="M884 404 l30 -8 30 6 30 -10 26 6" stroke="' + rgba(CYAN, 0.6) + '" stroke-width="2.5"/>' +
          '</g>' +
        '</g>' +
        // a potted plant by the window (life, legitimacy)
        '<g transform="translate(170,470)">' +
          '<path d="M0 60 l30 0 -4 -50 -22 0 z" fill="#2a1f14"/>' +
          '<g fill="none" stroke="' + rgba(CYAN2, 0.5) + '" stroke-width="4" stroke-linecap="round">' +
            '<path d="M15 12 q-22 -34 -40 -36"/>' +
            '<path d="M15 12 q4 -40 -10 -56"/>' +
            '<path d="M15 12 q26 -30 44 -30"/>' +
            '<path d="M15 12 q18 -36 36 -40"/>' +
          '</g>' +
        '</g>' +
        '</g>';

      // a row of desks across the lower third, each with a glowing monitor
      function desk(x, mc) {
        return '<g>' +
          '<rect x="' + x + '" y="560" width="150" height="14" rx="3" fill="#1a2438"/>' +
          '<rect x="' + (x + 14) + '" y="574" width="10" height="92" fill="#131b2b"/>' +
          '<rect x="' + (x + 126) + '" y="574" width="10" height="92" fill="#131b2b"/>' +
          // monitor on a stand
          '<rect x="' + (x + 44) + '" y="500" width="62" height="42" rx="4" fill="#0a1018" stroke="' + rgba(mc, 0.5) + '" stroke-width="2"/>' +
          '<rect x="' + (x + 48) + '" y="504" width="54" height="34" rx="2" fill="' + rgba(mc, 0.85) + '" filter="url(#gOffM)"/>' +
          '<rect x="' + (x + 71) + '" y="542" width="8" height="14" fill="#0a1018"/>' +
          '<rect x="' + (x + 60) + '" y="556" width="30" height="5" rx="2" fill="#0a1018"/>' +
          // a seated teammate silhouette
          '<g fill="#0b121e">' +
            '<path d="M' + (x + 88) + ' 560 q6 -34 30 -34 q24 0 30 34 z"/>' +
            '<circle cx="' + (x + 118) + '" cy="516" r="13"/>' +
          '</g>';
      }
      var fg =
        '<g class="cs-g-prem">' +
        // floor
        '<rect x="0" y="640" width="1200" height="110" fill="#0c1422"/>' +
        line(0, 640, 1200, 640, rgba(WHITE, 0.06), 2) +
        desk(360, CYAN2) +
        desk(540, VIOLET2) +
        desk(720, GOLD) +
        '</g>';

      return {
        layers: [svg('cs-bg', bg), svg('cs-mid', mid), svg('cs-fg', fg)],
        grade: 'grade-cyan', particles: 'motes', kb: 'kb-pan'
      };
    },

    // -------------------------------------------------- BIZPARK (chapter 3)
    // Industrial scale. A vast data hall: rows of server racks receding in
    // one-point perspective, cooling glow underlit, the model serving millions.
    premBizpark: function () {
      var bg =
        '<defs>' +
          '<radialGradient id="gBizBg" cx="0.5" cy="0.42" r="0.8">' +
            '<stop offset="0" stop-color="#101a30"/><stop offset="0.6" stop-color="#0a1022"/><stop offset="1" stop-color="#06080f"/></radialGradient>' +
          '<linearGradient id="gBizFloor" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#0d1424"/><stop offset="1" stop-color="#070b14"/></linearGradient>' +
        '</defs>' +
        '<rect width="1200" height="750" fill="url(#gBizBg)"/>' +
        // ceiling: receding light strips toward a bright vanishing point
        '<g class="cs-g-bizceil" stroke-linecap="round">' +
          line(0, 70, 540, 250, rgba(CYAN2, 0.16), 3) +
          line(1200, 70, 660, 250, rgba(CYAN2, 0.16), 3) +
          line(220, 40, 560, 250, rgba(CYAN2, 0.12), 2) +
          line(980, 40, 640, 250, rgba(CYAN2, 0.12), 2) +
        '</g>' +
        // floor with cool reflective sheen
        '<rect x="0" y="560" width="1200" height="190" fill="url(#gBizFloor)"/>' +
        '<ellipse cx="600" cy="600" rx="360" ry="40" fill="' + rgba(CYAN, 0.06) + '"/>';

      var mid =
        '<defs>' + glowFilter('gBizV', 14) + '</defs>' +
        // bright vanishing-point glow at the center horizon (the aisle's end)
        '<g class="cs-g-prem">' +
          '<g filter="url(#gBizV)"><ellipse cx="600" cy="300" rx="60" ry="120" fill="' + rgba(CYAN2, 0.5) + '"/></g>' +
          '<ellipse cx="600" cy="300" rx="22" ry="70" fill="' + rgba(WHITE, 0.7) + '"/>' +
        '</g>';

      // two converging rows of racks (left + right of the central aisle),
      // each rack smaller/closer to center as it recedes (one-point perspective)
      function rackRow(side) {
        // side = -1 left, +1 right
        var s = '', i, n = 5;
        for (i = 0; i < n; i++) {
          var depth = i / (n - 1);            // 0 near .. 1 far
          var scale = 1 - depth * 0.72;
          var rw = 86 * scale, rh = 250 * scale;
          // x marches from the frame edge inward toward the aisle (x=600)
          var nearX = side < 0 ? 70 : 1130;
          var aisleX = side < 0 ? 520 : 680;
          var cx = nearX + (aisleX - nearX) * depth;
          var x = cx - rw / 2;
          var top = 560 - rh - depth * 6;
          var col = i % 2 ? CYAN2 : VIOLET2;
          s += '<g opacity="' + (1 - depth * 0.35).toFixed(2) + '">' +
            '<rect x="' + x.toFixed(0) + '" y="' + top.toFixed(0) + '" width="' + rw.toFixed(0) + '" height="' + rh.toFixed(0) + '" rx="3" fill="#0a111e" stroke="' + rgba(col, 0.35) + '" stroke-width="1.6"/>' +
            // underlit cooling glow at the rack base
            '<rect x="' + (x - 2).toFixed(0) + '" y="' + (top + rh - 4).toFixed(0) + '" width="' + (rw + 4).toFixed(0) + '" height="8" rx="3" fill="' + rgba(col, 0.55) + '"/>';
          // LED column
          var ly, k = 0, rr = rng(side * 100 + i);
          for (ly = top + 8; ly < top + rh - 8; ly += 18 * scale + 6) {
            if (rr() > 0.4) {
              s += circle(cx, ly, 2 * scale + 1, rgba(rr() > 0.5 ? CYAN2 : GOLD, 0.9),
                ' class="cs-pulse" style="--pd:' + (k % 5) + 's"');
            }
            k++;
          }
          s += '</g>';
        }
        return s;
      }
      var fg =
        '<g class="cs-g-prem">' +
        rackRow(-1) +
        rackRow(1) +
        // overhead cable trays running down the aisle toward the vanishing point
        '<g fill="none" stroke-linecap="round">' +
          '<path d="M150 250 L560 296" stroke="' + rgba(VIOLET2, 0.22) + '" stroke-width="3"/>' +
          '<path d="M1050 250 L640 296" stroke="' + rgba(VIOLET2, 0.22) + '" stroke-width="3"/>' +
          '<path d="M120 560 L572 318" stroke="' + rgba(CYAN, 0.12) + '" stroke-width="2"/>' +
          '<path d="M1080 560 L628 318" stroke="' + rgba(CYAN, 0.12) + '" stroke-width="2"/>' +
        '</g>' +
        '</g>';

      return {
        layers: [svg('cs-bg', bg), svg('cs-mid', mid), svg('cs-fg', fg)],
        grade: 'grade-violet', particles: 'motes', kb: 'kb-zoom'
      };
    },

    // ------------------------------------------------ MEGACAMPUS (chapter 4)
    // Hyperscale. An aerial of a datacenter campus at dusk: vast halls,
    // power substation pylons + transmission lines, a brilliant core rising
    // on the horizon — on the threshold of AGI.
    premMegacampus: function () {
      var bg =
        '<defs>' +
          '<linearGradient id="gMegSky" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#0c2236"/><stop offset="0.45" stop-color="#0b1430"/><stop offset="1" stop-color="#0a0e22"/></linearGradient>' +
          '<radialGradient id="gMegGlow" cx="0.5" cy="0.36" r="0.7">' +
            '<stop offset="0" stop-color="' + rgba(CYAN2, 0.35) + '"/><stop offset="0.5" stop-color="' + rgba(VIOLET, 0.12) + '"/><stop offset="1" stop-color="transparent"/></radialGradient>' +
        '</defs>' +
        '<rect width="1200" height="750" fill="url(#gMegSky)"/>' +
        starfield(41, 60, 0, 0, 1200, 320, rgba(WHITE, 1)) +
        '<rect width="1200" height="750" fill="url(#gMegGlow)"/>' +
        // distant skyline haze on the horizon
        cityline(0, 360, 1200, rng(29), rgba(CYAN2, 0.4)) +
        line(0, 360, 1200, 360, rgba(CYAN, 0.18), 2);

      // a rising AGI core on the horizon (the threshold)
      var mid =
        '<defs>' + glowFilter('gMegCore', 18) +
          '<radialGradient id="gMegCoreFill" cx="0.5" cy="0.5" r="0.5">' +
            '<stop offset="0" stop-color="#ffffff"/><stop offset="0.4" stop-color="' + rgba(CYAN2, 1) + '"/><stop offset="0.75" stop-color="' + rgba(VIOLET, 0.55) + '"/><stop offset="1" stop-color="' + rgba(VIOLET, 0) + '"/></radialGradient>' +
        '</defs>' +
        '<g class="cs-g-prem">' +
          '<g fill="none">' +
            '<circle cx="600" cy="300" r="86" stroke="' + rgba(CYAN, 0.3) + '" stroke-width="2" class="cs-ring1"/>' +
            '<circle cx="600" cy="300" r="130" stroke="' + rgba(VIOLET2, 0.2) + '" stroke-width="2" class="cs-ring2"/>' +
          '</g>' +
          '<g filter="url(#gMegCore)"><circle cx="600" cy="300" r="46" fill="url(#gMegCoreFill)" class="cs-breathe"/></g>' +
        '</g>';

      // the campus below: rows of long low datacenter halls in perspective,
      // flanked by power-substation pylons + transmission lines.
      function hall(x, y, w, h, col) {
        return '<g>' +
          '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="#0b1322" stroke="' + rgba(col, 0.3) + '" stroke-width="1.5"/>' +
          // roof ridge vents
          '<g stroke="' + rgba(col, 0.5) + '" stroke-width="2">' +
            line(x + 8, y + h * 0.4, x + w - 8, y + h * 0.4, rgba(col, 0.4), 2) +
          '</g>' +
          // a warm/cool edge glow along the near base
          '<rect x="' + x + '" y="' + (y + h - 3) + '" width="' + w + '" height="5" fill="' + rgba(col, 0.45) + '"/>';
      }
      function pylon(x, y) {
        return '<g stroke="' + rgba(CYAN2, 0.4) + '" stroke-width="2" fill="none">' +
          line(x, y, x, y + 70, rgba(CYAN2, 0.4), 2) +
          line(x - 16, y + 14, x + 16, y + 14, rgba(CYAN2, 0.4), 2) +
          line(x - 12, y + 30, x + 12, y + 30, rgba(CYAN2, 0.4), 2) +
          line(x - 9, y + 70, x + 9, y + 70, rgba(CYAN2, 0.3), 2) +
          '<path d="M' + (x - 16) + ' ' + (y + 14) + ' l16 16 16 -16" stroke="' + rgba(CYAN2, 0.3) + '"/>' +
          '</g>';
      }
      var fg =
        '<g class="cs-g-prem">' +
        // ground plane
        '<rect x="0" y="430" width="1200" height="320" fill="#070b16"/>' +
        // far row of halls
        '<g opacity="0.7">' +
          hall(360, 396, 130, 34, VIOLET2) + hall(510, 396, 150, 34, CYAN2) + hall(680, 396, 130, 34, VIOLET2) +
        '</g>' +
        // mid row (larger)
        hall(250, 470, 200, 60, CYAN2) + hall(480, 470, 240, 60, VIOLET2) + hall(750, 470, 200, 60, CYAN2) +
        // near row (largest, foreground)
        hall(150, 580, 270, 100, CYAN2) + hall(470, 580, 300, 100, VIOLET2) + hall(820, 580, 270, 100, CYAN2) +
        // substation pylons + transmission line strung between them
        pylon(120, 360) + pylon(1080, 360) +
        '<path d="M120 374 q480 60 960 0" fill="none" stroke="' + rgba(CYAN2, 0.22) + '" stroke-width="1.5"/>' +
        '<path d="M120 390 q480 70 960 0" fill="none" stroke="' + rgba(CYAN2, 0.16) + '" stroke-width="1.5"/>' +
        '</g>';

      return {
        layers: [svg('cs-bg', bg), svg('cs-mid', mid), svg('cs-fg', fg)],
        grade: 'grade-singularity', particles: 'embers', kb: 'kb-zoom'
      };
    },

    // -------------------------------------------------- SERVERS (the $40 beat)
    // Still the cramped garage, but a first little server rack now hums in the
    // corner. While idle it RENTS out to other companies — coins drift out the
    // door to two distant company towers. Floating labels read m² (area) and
    // POWER (what runs the model). Cool-steel grade, motes. Focal content in
    // .cs-g-prem so portrait recomposes it. Built around x=600.
    serverRent: function () {
      var bg =
        '<defs>' +
          '<linearGradient id="gSrvWall" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#141029"/><stop offset="0.5" stop-color="#0c0a1f"/><stop offset="1" stop-color="#080611"/></linearGradient>' +
          '<radialGradient id="gSrvDoor" cx="0.5" cy="0.5" r="0.6">' +
            '<stop offset="0" stop-color="#16243c"/><stop offset="1" stop-color="#0a1020"/></radialGradient>' +
          '<radialGradient id="gSrvCold" cx="0.5" cy="0.78" r="0.6">' +
            '<stop offset="0" stop-color="' + rgba(CYAN2, 0.14) + '"/><stop offset="1" stop-color="' + rgba(CYAN2, 0) + '"/></radialGradient>' +
        '</defs>' +
        '<rect width="1200" height="750" fill="url(#gSrvWall)"/>' +
        // open garage door at the back-left letting in night + two distant
        // company towers (the "other companies" that rent your idle gear)
        '<g class="cs-g-srvdoor">' +
          '<rect x="150" y="150" width="300" height="320" rx="4" fill="url(#gSrvDoor)"/>' +
          starfield(53, 26, 158, 158, 284, 150, rgba(WHITE, 1)) +
          // two faraway corporate towers, faintly lit
          '<g fill="#0c1730">' +
            '<rect x="210" y="300" width="40" height="150"/>' +
            '<rect x="300" y="262" width="52" height="188"/>' +
          '</g>' +
          '<g fill="' + rgba(CYAN2, 0.7) + '">' +
            '<rect x="220" y="318" width="5" height="6"/><rect x="234" y="340" width="5" height="6"/>' +
            '<rect x="312" y="284" width="5" height="6"/><rect x="330" y="312" width="5" height="6"/><rect x="316" y="360" width="5" height="6"/>' +
          '</g>' +
          '<rect x="150" y="150" width="300" height="320" rx="4" fill="none" stroke="' + rgba(VIOLET2, 0.26) + '" stroke-width="4"/>' +
        '</g>' +
        // shelf of junk on the upper right — this is a borrowed, lived-in space
        '<g fill="#0e0b20" stroke="' + rgba(VIOLET2, 0.12) + '" stroke-width="2">' +
          line(800, 168, 1060, 168, rgba(VIOLET2, 0.14), 3) +
          '<rect x="828" y="128" width="40" height="40" rx="3"/>' +
          '<rect x="884" y="134" width="32" height="34" rx="3"/>' +
          '<rect x="936" y="126" width="44" height="42" rx="3"/>' +
        '</g>' +
        '<rect width="1200" height="750" fill="url(#gSrvCold)"/>';

      // a single short server rack of blinking units (the just-bought mini-server)
      function rack(x, w, h) {
        var top = 600 - h, s =
          '<rect x="' + x + '" y="' + top + '" width="' + w + '" height="' + h + '" rx="5" fill="#0b1018" stroke="' + rgba(CYAN2, 0.22) + '" stroke-width="2"/>' +
          '<rect x="' + x + '" y="' + top + '" width="' + w + '" height="' + h + '" rx="5" fill="none" stroke="' + rgba(WHITE, 0.05) + '" stroke-width="6"/>';
        var uy, k = 0, rr = rng(x + 7);
        for (uy = top + 12; uy < 600 - 12; uy += 28) {
          s += '<rect x="' + (x + 8) + '" y="' + uy + '" width="' + (w - 16) + '" height="22" rx="2" fill="#101826"/>';
          var lx;
          for (lx = x + 18; lx < x + w - 16; lx += 18) {
            var on = rr() > 0.4;
            var col = rr() > 0.5 ? CYAN2 : (rr() > 0.5 ? VIOLET2 : GOLD);
            s += circle(lx, uy + 11, 2.6, rgba(col, on ? 0.95 : 0.2),
              on ? ' class="cs-pulse" style="--pd:' + (k % 6) + 's"' : '');
            k++;
          }
        }
        return s;
      }

      var mid =
        '<defs>' + glowFilter('gSrvG', 9) + '</defs>' +
        '<g class="cs-g-prem">' +
        // concrete floor band + a cold pool of light under the rack
        '<rect x="0" y="600" width="1200" height="150" fill="#070a12"/>' +
        line(0, 600, 1200, 600, rgba(WHITE, 0.05), 2) +
        '<ellipse cx="600" cy="612" rx="240" ry="40" fill="' + rgba(CYAN2, 0.08) + '"/>' +
        // the rack, center stage
        rack(520, 160, 300) +
        // cold rim-light tracing its near edge
        '<g fill="none" stroke-linecap="round">' +
          line(520, 300, 520, 600, rgba(CYAN2, 0.3), 3) +
          line(680, 300, 680, 600, rgba(CYAN2, 0.24), 3) +
        '</g>' +
        '</g>';

      // foreground: rent coins drifting from the rack out toward the door
      // (idle gear earning passive rent) + floating m² / POWER labels.
      function coin(cx, cy, pd) {
        return '<g class="cs-pulse" style="--pd:' + pd + 's">' +
          circle(cx, cy, 9, rgba(GOLD, 0.92)) +
          '<circle cx="' + cx + '" cy="' + cy + '" r="9" fill="none" stroke="' + rgba(WHITE, 0.5) + '" stroke-width="1.5"/>' +
          '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="800" fill="#5b3d05">$</text>' +
          '</g>';
      }
      var fg =
        '<defs>' + glowFilter('gSrvF', 7) + '</defs>' +
        '<g class="cs-g-prem">' +
        // a stream of rent coins arcing from the rack toward the open door
        '<path d="M512 400 q-120 -36 -150 36" fill="none" stroke="' + rgba(GOLD, 0.18) + '" stroke-width="2" stroke-dasharray="3 7"/>' +
        coin(460, 384, 0) + coin(420, 402, 2) + coin(384, 432, 4) +
        // RENT badge near the door (money leaving to other companies)
        '<g transform="translate(366,470)" font-family="system-ui,sans-serif" font-weight="800">' +
          '<rect x="-50" y="-17" width="100" height="34" rx="17" fill="' + rgba(GOLD, 0.16) + '" stroke="' + rgba(GOLD, 0.6) + '" stroke-width="1.5"/>' +
          '<text x="0" y="5" text-anchor="middle" font-size="16" fill="' + rgba(GOLD, 0.98) + '">' + esc(t('cut_lbl_rent')) + '</text>' +
        '</g>' +
        // spec callout pills floating above the rack (centered on x=600 so they
        // never clip in the narrow portrait band): area (m²) and POWER
        '<g font-family="system-ui,sans-serif" font-weight="800">' +
          '<line x1="600" y1="300" x2="600" y2="262" stroke="' + rgba(CYAN2, 0.25) + '" stroke-width="1.5" stroke-dasharray="2 5"/>' +
          '<g transform="translate(536,246)">' +
            '<rect x="-52" y="-16" width="104" height="32" rx="16" fill="' + rgba(CYAN, 0.14) + '" stroke="' + rgba(CYAN2, 0.6) + '" stroke-width="1.5"/>' +
            '<text x="0" y="5" text-anchor="middle" font-size="15" fill="' + rgba(CYAN2, 0.98) + '">' + esc(t('cut_lbl_area')) + '</text>' +
          '</g>' +
          '<g transform="translate(664,246)">' +
            '<rect x="-56" y="-16" width="112" height="32" rx="16" fill="' + rgba(VIOLET, 0.16) + '" stroke="' + rgba(VIOLET2, 0.62) + '" stroke-width="1.5"/>' +
            '<text x="0" y="5" text-anchor="middle" font-size="15" fill="' + rgba(VIOLET2, 1) + '">' + esc(t('cut_lbl_power')) + '</text>' +
          '</g>' +
        '</g>' +
        '</g>';

      return {
        layers: [svg('cs-bg', bg), svg('cs-mid', mid), svg('cs-fg', fg)],
        grade: 'grade-steel', particles: 'motes', kb: 'kb-in'
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

  // ---- premise-move chapters (one per upgrade destination) ----
  // Maps the DESTINATION premise id -> { scene, title, body }. A punchy 1-beat
  // cinematic (~7s, tap-to-skip) narrating that step on the garage->AGI journey.
  var PREMISE_CHAPTERS = {
    basement:   { scene: 'premBasement',   title: 'cut_prem_basement_title',   body: 'cut_prem_basement_body' },
    office:     { scene: 'premOffice',     title: 'cut_prem_office_title',     body: 'cut_prem_office_body' },
    bizpark:    { scene: 'premBizpark',    title: 'cut_prem_bizpark_title',    body: 'cut_prem_bizpark_body' },
    megacampus: { scene: 'premMegacampus', title: 'cut_prem_megacampus_title', body: 'cut_prem_megacampus_body' }
  };
  function premiseMove(premiseId, onDone) {
    var ch = PREMISE_CHAPTERS[premiseId];
    if (!ch) { if (onDone) { try { onDone(); } catch (e) {} } return; }
    play({
      kind: 'premise',
      lastLabel: 'cut_continue',
      beats: [{ scene: ch.scene, title: ch.title, body: ch.body }],
      onDone: onDone
    });
  }

  // ---- servers cutscene (fires once when cash first reaches the mini-server) ----
  // Beat 1: garage backstory (reuses the intro garage art for continuity).
  // Beat 2: the first rack — idle gear rents out; hardware has area (m²) + power.
  function servers(onDone) {
    play({
      kind: 'servers',
      lastLabel: 'cut_continue',
      beats: [
        { scene: 'garage', title: 'cut_servers1_title', body: 'cut_servers1_body' },
        { scene: 'serverRent', title: 'cut_servers2_title', body: 'cut_servers2_body' }
      ],
      onDone: onDone
    });
  }

  window.GAME_CUTSCENE = {
    play: play,
    intro: intro,
    firstModel: firstModel,
    agiVictory: agiVictory,
    premiseMove: premiseMove,
    servers: servers,
    isActive: function () { return !!active; }
  };
})();
