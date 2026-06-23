/* Singularity Inc. v2 — VISUAL FACILITY VIEW -> window.GAME_FACILITY.
   A living, cinematic 2.5D "diorama" of the player's current premises with their
   hardware rendered INSIDE as rack/server units. Reactive: racks grow as gear is
   bought, committed units GLOW (cyan, "powering your model"), idle ones are dim
   ("for rent"). The whole room transforms when the player MOVES premises.

   PREMIUM PASS: every premise is a multi-layer scene — far background (sky/wall),
   mid atmosphere (god-rays, glow, distant structure), and a foreground floor with
   racks + a soft vignette on top. Subtle life: blinking LEDs, a slow light sweep,
   faint drifting dust, a breathing core. Animation budget is tight (a few SMIL +
   the existing CSS classes) so it holds ~30fps on weak Android.

   SELF-CONTAINED on purpose: it imports NOTHING from cutscene.js. It carries its
   own tiny copies of the proven SVG helpers and its own palette, so it can never
   break if cutscene internals change. Layered inline SVG only — no canvas/WebGL,
   no external assets, no external fonts.

   Guard everything: if GAME / state is missing we render nothing gracefully and
   never throw. 0 console errors is the #1 requirement. */
(function () {
  'use strict';

  // ============================ tiny self-contained helpers ============================
  // (intentional duplicates of the cutscene primitives — keeps this module decoupled)
  function rgba(c, a) { return 'rgba(' + c + ',' + a + ')'; }
  var VIOLET = '139,92,246', VIOLET2 = '167,139,250', CYAN = '34,211,238',
      CYAN2 = '103,232,249', GOLD = '251,191,36', GOLD2 = '253,224,138',
      WHITE = '255,255,255', AMBER = '245,158,66';

  function line(x1, y1, x2, y2, col, w, op) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
      '" stroke="' + col + '" stroke-width="' + (w || 1) + '" stroke-linecap="round"' +
      (op != null ? ' opacity="' + op + '"' : '') + '/>';
  }
  function circle(cx, cy, r, fill, extra) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + fill + '"' + (extra || '') + '/>';
  }
  // deterministic pseudo-random so the diorama is stable frame-to-frame
  function rng(seed) {
    var s = (seed || 1) >>> 0;
    return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }
  function glowFilter(id, dev) {
    return '<filter id="' + id + '" x="-80%" y="-80%" width="260%" height="260%">' +
      '<feGaussianBlur stdDeviation="' + (dev || 6) + '" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
  }
  function starfield(seed, n, x0, y0, w, h, col) {
    var r = rng(seed), out = '', i;
    for (i = 0; i < n; i++) {
      var x = x0 + r() * w, y = y0 + r() * h, rr = 0.4 + r() * 1.4, op = 0.2 + r() * 0.55;
      var twk = r() > 0.7;
      out += '<circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="' + rr.toFixed(1) +
        '" fill="' + (col || rgba(WHITE, 1)) + '" opacity="' + op.toFixed(2) + '">' +
        (twk ? '<animate attributeName="opacity" values="' + op.toFixed(2) + ';' + (op * 0.25).toFixed(2) + ';' + op.toFixed(2) +
          '" dur="' + (2.6 + r() * 3).toFixed(1) + 's" begin="' + (r() * 3).toFixed(1) + 's" repeatCount="indefinite"/>' : '') +
        '</circle>';
    }
    return out;
  }
  function cityline(x0, baseY, w, r, col) {
    var out = '<g fill="' + (col || rgba(CYAN2, 0.4)) + '">', x = x0, end = x0 + w;
    while (x < end) {
      var bw = 10 + r() * 26, bh = 8 + r() * 46;
      out += '<rect x="' + x.toFixed(0) + '" y="' + (baseY - bh).toFixed(0) + '" width="' + bw.toFixed(0) + '" height="' + bh.toFixed(0) + '"/>';
      x += bw + 3 + r() * 6;
    }
    return out + '</g>';
  }
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // viewBox the diorama is composed in. We slice it so it always covers the panel.
  var VBW = 1200, VBH = 420, FLOOR = 348;

  function svgLayer(cls, defs, inner) {
    return '<svg class="facility-layer ' + cls + '" viewBox="0 0 ' + VBW + ' ' + VBH +
      '" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      (defs || '') + inner + '</svg>';
  }

  // ---- shared cinematic atmosphere bits (used across scenes) ----
  // Slow diagonal light sweep — ONE animated rect, cheap. `tint` is "r,g,b".
  function lightSweep(tint, op, dur, skew) {
    var a = op == null ? 0.06 : op, d = dur || 14, sk = skew == null ? -16 : skew;
    return '<g opacity="' + a + '" transform="skewX(' + sk + ')">' +
      '<rect x="-260" y="-40" width="120" height="' + (VBH + 120) + '" ' +
      'fill="' + rgba(tint, 1) + '">' +
      '<animate attributeName="x" values="-260;' + (VBW + 200) + '" dur="' + d + 's" repeatCount="indefinite"/>' +
      '</rect></g>';
  }
  // God-ray fan from a point — static gradient triangles, no animation.
  function godRays(cx, cy, count, len, spread, tint, op, seed) {
    var r = rng(seed || 5), out = '<g opacity="' + (op == null ? 0.5 : op) + '">', i;
    for (i = 0; i < count; i++) {
      var ang = -Math.PI / 2 + (i / (count - 1) - 0.5) * spread;
      var w = (4 + r() * 10);
      var x1 = cx + Math.cos(ang) * len, y1 = cy + Math.sin(ang) * len;
      var px = Math.cos(ang + Math.PI / 2) * w, py = Math.sin(ang + Math.PI / 2) * w;
      out += '<path d="M' + cx.toFixed(0) + ' ' + cy.toFixed(0) +
        ' L' + (x1 + px).toFixed(0) + ' ' + (y1 + py).toFixed(0) +
        ' L' + (x1 - px).toFixed(0) + ' ' + (y1 - py).toFixed(0) + ' Z" fill="' + tint + '"/>';
    }
    return out + '</g>';
  }
  // Drifting dust motes — a small handful of slowly-rising flecks (SMIL).
  function dust(seed, n, x0, w, yTop, yBot, tint) {
    var r = rng(seed), out = '<g>', i;
    for (i = 0; i < n; i++) {
      var x = x0 + r() * w, y = yTop + r() * (yBot - yTop), rr = 0.6 + r() * 1.3;
      var dur = (9 + r() * 9).toFixed(1), rise = 26 + r() * 40, op = 0.12 + r() * 0.28;
      out += '<circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="' + rr.toFixed(1) +
        '" fill="' + (tint || rgba(WHITE, 1)) + '" opacity="' + op.toFixed(2) + '">' +
        '<animate attributeName="cy" values="' + y.toFixed(0) + ';' + (y - rise).toFixed(0) + ';' + y.toFixed(0) +
          '" dur="' + dur + 's" begin="' + (r() * 6).toFixed(1) + 's" repeatCount="indefinite"/>' +
        '<animate attributeName="opacity" values="0;' + op.toFixed(2) + ';0" dur="' + dur + 's" begin="' + (r() * 6).toFixed(1) + 's" repeatCount="indefinite"/>' +
        '</circle>';
    }
    return out + '</g>';
  }
  // Soft top-and-bottom vignette as the topmost foreground layer (frames the UI).
  function vignette(id) {
    return '<defs>' +
      '<radialGradient id="' + id + '" cx="0.5" cy="0.46" r="0.75">' +
        '<stop offset="0" stop-color="#000" stop-opacity="0"/>' +
        '<stop offset="0.7" stop-color="#000" stop-opacity="0"/>' +
        '<stop offset="1" stop-color="#000" stop-opacity="0.42"/>' +
      '</radialGradient>' +
      '<linearGradient id="' + id + 'b" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#04040c" stop-opacity="0.28"/>' +
        '<stop offset="0.18" stop-color="#04040c" stop-opacity="0"/>' +
        '<stop offset="0.82" stop-color="#04040c" stop-opacity="0"/>' +
        '<stop offset="1" stop-color="#04040c" stop-opacity="0.5"/>' +
      '</linearGradient>' +
      '</defs>' +
      '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#' + id + ')"/>' +
      '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#' + id + 'b)"/>';
  }

  // ============================ the rack unit drawer ============================
  // One self-contained server rack of blinking units. glow=true => committed
  // (cyan power glow); glow=false => idle (dimmer, "for rent" tint).
  // Adds a thin 2.5D side face for depth + a soft floor reflection.
  // `density` (default 1) scales how many LED slats read "on" + their brightness,
  // so higher tiers (bizpark/megacampus) render busier, denser racks than a garage.
  function rack(x, y, w, h, glow, seed, density) {
    var den = density == null ? 1 : density;          // ~0.85 garage .. ~1.35 megacampus
    var top = y - h, rr = rng(seed || (x * 7 + y)), s = '';
    var edge = glow ? CYAN2 : VIOLET2;
    var edgeA = glow ? 0.6 : 0.24;
    var depth = Math.max(5, w * 0.16);
    // 2.5D side face (extruded to the right) — gives racks volume
    s += '<path d="M' + (x + w) + ' ' + top + ' l' + depth + ' ' + (depth * 0.5) +
      ' l0 ' + h + ' l' + (-depth) + ' ' + (-depth * 0.5) + ' z" fill="#070b12" stroke="' +
      rgba(edge, edgeA * 0.5) + '" stroke-width="1"/>';
    // top face
    s += '<path d="M' + x + ' ' + top + ' l' + depth + ' ' + (depth * 0.5) +
      ' l' + w + ' 0 l' + (-depth) + ' ' + (-depth * 0.5) + ' z" fill="#0d1422" opacity="0.9"/>';
    // cabinet body (front)
    s += '<rect x="' + x + '" y="' + top + '" width="' + w + '" height="' + h + '" rx="3" fill="#0b1018" stroke="' + rgba(edge, edgeA) + '" stroke-width="' + (glow ? 2 : 1.5) + '"/>';
    s += '<rect x="' + x + '" y="' + top + '" width="' + w + '" height="' + h + '" rx="3" fill="none" stroke="' + rgba(WHITE, 0.04) + '" stroke-width="4"/>';
    // committed: cyan power glow underlight at the base + a soft halo
    if (glow) {
      s += '<rect x="' + (x - 2) + '" y="' + (top + h - 4) + '" width="' + (w + 4) + '" height="7" rx="3" fill="' + rgba(CYAN2, 0.7) + '" filter="url(#facGlow)"/>';
      // faint floor reflection of the glow
      s += '<ellipse cx="' + (x + w / 2) + '" cy="' + (y + 9) + '" rx="' + (w * 0.7) + '" ry="6" fill="' + rgba(CYAN2, 0.18) + '"/>';
    }
    // rack units (1U slats) with LED rows
    var uy, k = 0, step = Math.max(11, h / 7);
    for (uy = top + 6; uy < y - 5; uy += step) {
      s += '<rect x="' + (x + 4) + '" y="' + uy.toFixed(1) + '" width="' + (w - 8) + '" height="' + (step - 4).toFixed(1) + '" rx="1.5" fill="' + (glow ? '#0e1726' : '#0d1320') + '"/>';
      var lx, cy = uy + (step - 4) / 2;
      // denser tiers light up MORE slats: shift the on-threshold down by (den-1).
      var onThr = (glow ? 0.28 : 0.62) - (den - 1) * 0.34;
      if (onThr < 0.06) onThr = 0.06;
      // a touch more lit brightness in dense halls (capped at 1)
      var onA = (glow ? 0.95 : 0.45) + (den - 1) * 0.12;
      if (onA > 1) onA = 1;
      for (lx = x + 8; lx < x + w - 6; lx += 9) {
        var on = rr() > onThr;
        var col = glow ? (rr() > 0.5 ? CYAN2 : CYAN) : (rr() > 0.6 ? VIOLET2 : GOLD);
        s += circle(lx, cy, 1.5, rgba(col, on ? onA : 0.14),
          on ? ' class="fac-pulse" style="--pd:' + (k % 6) + 's"' : '');
        k++;
      }
    }
    // idle racks read a touch darker overall
    if (!glow) s += '<rect x="' + x + '" y="' + top + '" width="' + w + '" height="' + h + '" rx="3" fill="' + rgba('5,8,15', 0.32) + '"/>';
    return s;
  }

  // ============================ per-premise backdrops ============================
  // Each returns { bg, mid, fg, edge }:
  //   bg  = far background (sky / back wall / windows / atmosphere)
  //   mid = mid layer (god-rays, distant structure, floor, light pools)
  //   fg  = foreground accents drawn ABOVE racks (vignette, near dust, frame)
  // The racks are laid by render() into the fg layer (behind fg.frame via order).
  // One backdrop per tier of C.PREMISES (garage -> ... -> megacampus).
  var BACKDROPS = {
    // ---- GARAGE: humble, warm, a single work-lamp, dust in the lamp light ----
    garage: function () {
      var bg =
        '<defs>' +
          '<linearGradient id="fGarW" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#1a1330"/><stop offset="0.5" stop-color="#0e0a1d"/><stop offset="1" stop-color="#070510"/></linearGradient>' +
          '<radialGradient id="fGarWin" cx="0.5" cy="0.4" r="0.85">' +
            '<stop offset="0" stop-color="#21304e"/><stop offset="1" stop-color="#0a1122"/></radialGradient>' +
          '<radialGradient id="fGarLamp" cx="0.5" cy="0.5" r="0.5">' +
            '<stop offset="0" stop-color="' + rgba(GOLD2, 0.55) + '"/><stop offset="0.5" stop-color="' + rgba(GOLD, 0.14) + '"/><stop offset="1" stop-color="' + rgba(GOLD, 0) + '"/></radialGradient>' +
          '<radialGradient id="fGarAmb" cx="0.42" cy="0.92" r="0.8">' +
            '<stop offset="0" stop-color="' + rgba(GOLD, 0.18) + '"/><stop offset="1" stop-color="' + rgba(GOLD, 0) + '"/></radialGradient>' +
        '</defs>' +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fGarW)"/>' +
        // garage-door ribbing on the right wall (texture/depth)
        '<g stroke="' + rgba(WHITE, 0.035) + '" stroke-width="2">' +
          line(820, 0, 820, FLOOR, rgba(WHITE, 0.05), 2) +
          line(820, 70, VBW, 70, rgba(WHITE, 0.03), 2) + line(820, 130, VBW, 130, rgba(WHITE, 0.03), 2) +
          line(820, 190, VBW, 190, rgba(WHITE, 0.03), 2) + line(820, 250, VBW, 250, rgba(WHITE, 0.03), 2) +
        '</g>' +
        // back-wall window with moon + skyline (top-left, atmospheric)
        '<g opacity="0.94">' +
          '<rect x="70" y="40" width="260" height="158" rx="6" fill="url(#fGarWin)"/>' +
          cityline(70, 198, 260, rng(7), rgba(CYAN2, 0.32)) +
          starfield(31, 20, 78, 48, 244, 96, rgba(WHITE, 1)) +
          '<circle cx="262" cy="84" r="30" fill="' + rgba(CYAN2, 0.5) + '"/>' +
          '<circle cx="262" cy="84" r="46" fill="' + rgba(CYAN2, 0.12) + '"/>' +
          '<rect x="70" y="40" width="260" height="158" rx="6" fill="none" stroke="' + rgba(VIOLET2, 0.3) + '" stroke-width="3"/>' +
          line(200, 40, 200, 198, rgba(VIOLET2, 0.22), 2) +
          line(70, 119, 330, 119, rgba(VIOLET2, 0.22), 2) +
        '</g>' +
        // cluttered shelf of boxes (top-right) — the "stuff" of a real garage
        line(900, 70, 1150, 70, rgba(VIOLET2, 0.16), 3) +
        '<g fill="#0f0b22" stroke="' + rgba(VIOLET2, 0.12) + '" stroke-width="2">' +
          '<rect x="930" y="32" width="42" height="38" rx="3"/>' +
          '<rect x="984" y="40" width="32" height="30" rx="3"/>' +
          '<rect x="1028" y="26" width="40" height="44" rx="3"/>' +
        '</g>' +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fGarAmb)"/>';
      var mid =
        '<defs>' + glowFilter('fGarL', 7) + '</defs>' +
        // clamp work-lamp hanging center-left, casting a warm cone of light
        '<g opacity="0.7">' + godRays(560, 96, 7, 250, 0.7, rgba(GOLD, 0.06), 0.8, 11) + '</g>' +
        line(560, 0, 560, 80, rgba(WHITE, 0.16), 2) +
        '<path d="M540 80 q20 26 40 0 z" fill="#1a1206" stroke="' + rgba(GOLD, 0.4) + '" stroke-width="1.5"/>' +
        '<circle cx="560" cy="92" r="6" fill="' + rgba(GOLD2, 0.95) + '" filter="url(#fGarL)"/>' +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fGarLamp)" opacity="0.85" transform="translate(0,-260)"/>' +
        // floor
        '<rect x="0" y="' + FLOOR + '" width="' + VBW + '" height="' + (VBH - FLOOR) + '" fill="#0d0a18"/>' +
        line(0, FLOOR, VBW, FLOOR, rgba(WHITE, 0.06), 2) +
        '<ellipse cx="560" cy="' + (FLOOR + 12) + '" rx="360" ry="22" fill="' + rgba(GOLD, 0.07) + '"/>' +
        // faint dust caught in the warm lamp light
        dust(71, 9, 380, 380, 130, FLOOR - 40, rgba(GOLD2, 1));
      var fg =
        vignette('fGarVg') +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="' + rgba(GOLD, 0.018) + '"/>';
      return { bg: bg, mid: mid, fg: fg, edge: GOLD };
    },

    // ---- BASEMENT: cramped, cyan-cold, a single caged bulb, damp concrete ----
    basement: function () {
      var bg =
        '<defs>' +
          '<linearGradient id="fBsW" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#0d1422" stop-opacity="1"/><stop offset="0.55" stop-color="#080d18"/><stop offset="1" stop-color="#04070d"/></linearGradient>' +
          '<radialGradient id="fBsBulb" cx="0.5" cy="0.5" r="0.5">' +
            '<stop offset="0" stop-color="' + rgba(GOLD2, 0.5) + '"/><stop offset="0.5" stop-color="' + rgba(GOLD, 0.1) + '"/><stop offset="1" stop-color="' + rgba(GOLD, 0) + '"/></radialGradient>' +
          '<radialGradient id="fBsCold" cx="0.5" cy="1" r="0.9">' +
            '<stop offset="0" stop-color="' + rgba(CYAN, 0.1) + '"/><stop offset="1" stop-color="' + rgba(CYAN, 0) + '"/></radialGradient>' +
        '</defs>' +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fBsW)"/>' +
        // bare concrete seams + damp patches (texture)
        '<g stroke="' + rgba(WHITE, 0.04) + '" stroke-width="2">' +
          line(0, 110, VBW, 110, rgba(WHITE, 0.045), 2) + line(0, 200, VBW, 200, rgba(WHITE, 0.04), 2) +
          line(0, 286, VBW, 286, rgba(WHITE, 0.03), 2) +
          line(360, 0, 360, 286, rgba(WHITE, 0.025), 2) + line(840, 0, 840, 286, rgba(WHITE, 0.025), 2) +
        '</g>' +
        '<g fill="' + rgba(CYAN, 0.035) + '"><ellipse cx="220" cy="120" rx="130" ry="60"/><ellipse cx="1000" cy="180" rx="160" ry="80"/></g>' +
        // small barred basement window (top-left) — faint cold daylight
        '<g opacity="0.92">' +
          '<rect x="100" y="48" width="140" height="64" rx="3" fill="#0e1d30"/>' +
          '<rect x="100" y="48" width="140" height="64" rx="3" fill="none" stroke="' + rgba(CYAN2, 0.24) + '" stroke-width="3"/>' +
          line(147, 48, 147, 112, rgba(CYAN2, 0.3), 2) + line(193, 48, 193, 112, rgba(CYAN2, 0.3), 2) +
          line(100, 80, 240, 80, rgba(CYAN2, 0.22), 2) +
        '</g>' +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fBsCold)"/>';
      var mid =
        '<defs>' + glowFilter('fBsL', 8) + '</defs>' +
        // god-ray cone from the bulb
        '<g opacity="0.6">' + godRays(600, 92, 7, 270, 0.5, rgba(GOLD, 0.05), 0.8, 23) + '</g>' +
        // the caged hanging bulb, the only soft light (gently swaying)
        '<g><animateTransform attributeName="transform" type="rotate" values="-1.1 600 0;1.1 600 0;-1.1 600 0" dur="7s" repeatCount="indefinite"/>' +
          line(600, 0, 600, 70, rgba(WHITE, 0.18), 2) +
          '<g fill="none" stroke="' + rgba(WHITE, 0.16) + '" stroke-width="2">' +
            '<path d="M586 72 q14 26 28 0"/>' + line(600, 72, 600, 94, rgba(WHITE, 0.16), 2) +
            '<path d="M588 94 q12 16 24 0"/>' +
          '</g>' +
          '<circle cx="600" cy="84" r="9" fill="' + rgba(GOLD2, 0.95) + '" filter="url(#fBsL)"/>' +
        '</g>' +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fBsBulb)" opacity="0.55"/>' +
        // low ceiling pipes for "cramped" feel
        '<g stroke="' + rgba(CYAN2, 0.12) + '" stroke-width="4" fill="none" stroke-linecap="round">' +
          line(0, 26, 470, 26, rgba(CYAN2, 0.1), 5) + line(730, 26, VBW, 26, rgba(CYAN2, 0.1), 5) +
          line(0, 44, 320, 44, rgba(VIOLET2, 0.08), 3) +
        '</g>' +
        // floor
        '<rect x="0" y="' + FLOOR + '" width="' + VBW + '" height="' + (VBH - FLOOR) + '" fill="#06090f"/>' +
        line(0, FLOOR, VBW, FLOOR, rgba(WHITE, 0.05), 2) +
        '<ellipse cx="600" cy="' + (FLOOR + 10) + '" rx="320" ry="22" fill="' + rgba(GOLD, 0.06) + '"/>' +
        dust(83, 7, 440, 320, 120, FLOOR - 30, rgba(CYAN2, 1));
      var fg = vignette('fBsVg');
      return { bg: bg, mid: mid, fg: fg, edge: CYAN2 };
    },

    // ---- OFFICE: clean, bright daylight, glass windows, a plant, a slow sweep ----
    office: function () {
      var bg =
        '<defs>' +
          '<linearGradient id="fOfW" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#1a2740"/><stop offset="0.6" stop-color="#111c30"/><stop offset="1" stop-color="#0c1422"/></linearGradient>' +
          '<linearGradient id="fOfDay" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="' + rgba(CYAN2, 0.9) + '"/><stop offset="0.6" stop-color="' + rgba(CYAN2, 0.34) + '"/><stop offset="1" stop-color="' + rgba(GOLD, 0.18) + '"/></linearGradient>' +
          '<radialGradient id="fOfSun" cx="0.5" cy="0.16" r="0.75">' +
            '<stop offset="0" stop-color="' + rgba(GOLD2, 0.22) + '"/><stop offset="1" stop-color="' + rgba(GOLD, 0) + '"/></radialGradient>' +
        '</defs>' +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fOfW)"/>' +
        // wall of tall daylight windows with a soft city beyond
        '<g>' +
          '<rect x="110" y="36" width="980" height="198" rx="8" fill="url(#fOfDay)" opacity="0.55"/>' +
          cityline(120, 234, 960, rng(17), rgba(WHITE, 0.4)) +
          starfield(19, 14, 140, 50, 920, 60, rgba(WHITE, 0.7)) +
          '<g stroke="' + rgba(WHITE, 0.16) + '" stroke-width="2.5" fill="none">' +
            '<rect x="110" y="36" width="980" height="198" rx="8"/>' +
            line(355, 36, 355, 234, rgba(WHITE, 0.14), 2.5) + line(600, 36, 600, 234, rgba(WHITE, 0.14), 2.5) +
            line(845, 36, 845, 234, rgba(WHITE, 0.14), 2.5) + line(110, 135, 1090, 135, rgba(WHITE, 0.1), 2.5) +
          '</g>' +
          // mullion shadows cast onto the floor (daylight)
          '<g opacity="0.35">' +
            '<path d="M355 234 l-30 114 -10 0 30 -114 z" fill="' + rgba(GOLD, 0.06) + '"/>' +
            '<path d="M600 234 l-30 114 -10 0 30 -114 z" fill="' + rgba(GOLD, 0.06) + '"/>' +
            '<path d="M845 234 l-30 114 -10 0 30 -114 z" fill="' + rgba(GOLD, 0.06) + '"/>' +
          '</g>' +
        '</g>' +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fOfSun)"/>';
      var mid =
        // soft daylight god-rays slanting in from the top
        '<g opacity="0.7">' + godRays(700, -30, 6, 460, 0.5, rgba(GOLD2, 0.045), 0.8, 41) + '</g>' +
        // a potted plant by the window (legitimacy)
        '<g transform="translate(140,250)">' +
          '<path d="M0 44 l26 0 -3 -38 -20 0 z" fill="#2a1f14"/>' +
          '<g fill="none" stroke="' + rgba(CYAN2, 0.5) + '" stroke-width="3" stroke-linecap="round">' +
            '<path d="M13 8 q-18 -26 -32 -28"/><path d="M13 8 q3 -30 -8 -42"/><path d="M13 8 q20 -22 34 -22"/>' +
            '<path d="M13 8 q-8 -20 -22 -24"/>' +
          '</g></g>' +
        // a second plant on the right for balance
        '<g transform="translate(1040,252)" opacity="0.9">' +
          '<path d="M0 42 l22 0 -3 -34 -16 0 z" fill="#241a10"/>' +
          '<g fill="none" stroke="' + rgba(CYAN2, 0.42) + '" stroke-width="2.5" stroke-linecap="round">' +
            '<path d="M11 8 q16 -24 28 -24"/><path d="M11 8 q-3 -28 6 -38"/>' +
          '</g></g>' +
        // floor
        '<rect x="0" y="' + FLOOR + '" width="' + VBW + '" height="' + (VBH - FLOOR) + '" fill="#0d1524"/>' +
        line(0, FLOOR, VBW, FLOOR, rgba(WHITE, 0.07), 2) +
        '<ellipse cx="600" cy="' + (FLOOR + 12) + '" rx="430" ry="22" fill="' + rgba(CYAN2, 0.06) + '"/>' +
        lightSweep(WHITE, 0.05, 16, -18);
      var fg = vignette('fOfVg');
      return { bg: bg, mid: mid, fg: fg, edge: CYAN2 };
    },

    // ---- BIZPARK: corporate server hall, receding aisle, bright vanishing point ----
    bizpark: function () {
      var bg =
        '<defs>' +
          '<radialGradient id="fBzBg" cx="0.5" cy="0.42" r="0.9">' +
            '<stop offset="0" stop-color="#12203a"/><stop offset="0.55" stop-color="#0a1224"/><stop offset="1" stop-color="#05070e"/></radialGradient>' +
          '<linearGradient id="fBzFloor" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#0e1526"/><stop offset="1" stop-color="#060a13"/></linearGradient>' +
          glowFilter('fBzV', 12) +
        '</defs>' +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fBzBg)"/>' +
        // receding ceiling: light strips toward a bright vanishing point (perspective)
        '<g stroke-linecap="round">' +
          line(0, 24, 540, 152, rgba(CYAN2, 0.18), 3) + line(1200, 24, 660, 152, rgba(CYAN2, 0.18), 3) +
          line(150, 8, 555, 152, rgba(CYAN2, 0.12), 2) + line(1050, 8, 645, 152, rgba(CYAN2, 0.12), 2) +
          line(360, 4, 570, 152, rgba(CYAN2, 0.08), 1.6) + line(840, 4, 630, 152, rgba(CYAN2, 0.08), 1.6) +
        '</g>' +
        // side-wall perspective rails (the aisle's walls receding to the point)
        '<g stroke="' + rgba(CYAN2, 0.07) + '" stroke-width="2">' +
          line(0, FLOOR, 560, 168, rgba(CYAN2, 0.08), 2) + line(VBW, FLOOR, 640, 168, rgba(CYAN2, 0.08), 2) +
        '</g>' +
        // bright vanishing-point glow + soft god-rays down the aisle
        '<g opacity="0.55">' + godRays(600, 168, 9, 220, 0.8, rgba(CYAN2, 0.05), 0.9, 53) + '</g>' +
        '<g filter="url(#fBzV)"><ellipse cx="600" cy="172" rx="48" ry="84" fill="' + rgba(CYAN2, 0.48) + '"/></g>' +
        '<ellipse cx="600" cy="172" rx="16" ry="50" fill="' + rgba(WHITE, 0.6) + '"/>';
      var mid =
        '<rect x="0" y="' + FLOOR + '" width="' + VBW + '" height="' + (VBH - FLOOR) + '" fill="url(#fBzFloor)"/>' +
        line(0, FLOOR, VBW, FLOOR, rgba(CYAN, 0.1), 2) +
        // glossy aisle reflection running back to the vanishing point
        '<polygon points="540,' + FLOOR + ' 660,' + FLOOR + ' 620,178 580,178" fill="' + rgba(CYAN2, 0.06) + '"/>' +
        '<ellipse cx="600" cy="' + (FLOOR + 14) + '" rx="440" ry="24" fill="' + rgba(CYAN, 0.07) + '"/>' +
        // faint power/cooling conduit mesh tracing the back wall (static depth)
        '<g stroke="' + rgba(CYAN, 0.05) + '" stroke-width="0.7" fill="none" stroke-linecap="round">' +
          line(40, 214, 1160, 214, rgba(CYAN, 0.05), 0.7) + line(40, 226, 1160, 226, rgba(CYAN, 0.045), 0.7) +
          line(40, 238, 1160, 238, rgba(CYAN, 0.04), 0.6) +
          line(220, 206, 220, 248, rgba(CYAN, 0.05), 0.7) + line(480, 206, 480, 248, rgba(CYAN, 0.05), 0.7) +
          line(720, 206, 720, 248, rgba(CYAN, 0.05), 0.7) + line(980, 206, 980, 248, rgba(CYAN, 0.05), 0.7) +
        '</g>' +
        // denser low far-row silhouette behind the flanking racks (a bigger hall)
        '<g opacity="0.4">' +
          '<rect x="120" y="234" width="86" height="20" rx="2" fill="#0a1120" stroke="' + rgba(CYAN2, 0.16) + '" stroke-width="0.8"/>' +
          '<rect x="430" y="234" width="86" height="20" rx="2" fill="#0a1120" stroke="' + rgba(CYAN2, 0.16) + '" stroke-width="0.8"/>' +
          '<rect x="690" y="234" width="86" height="20" rx="2" fill="#0a1120" stroke="' + rgba(CYAN2, 0.16) + '" stroke-width="0.8"/>' +
          '<rect x="1000" y="234" width="86" height="20" rx="2" fill="#0a1120" stroke="' + rgba(CYAN2, 0.16) + '" stroke-width="0.8"/>' +
        '</g>' +
        // distant racks flanking the aisle (depth before the player's near racks)
        '<g opacity="0.55">' +
          '<rect x="300" y="250" width="120" height="62" rx="3" fill="#0a1322" stroke="' + rgba(CYAN2, 0.2) + '" stroke-width="1.2"/>' +
          '<rect x="780" y="250" width="120" height="62" rx="3" fill="#0a1322" stroke="' + rgba(CYAN2, 0.2) + '" stroke-width="1.2"/>' +
        '</g>' +
        lightSweep(CYAN2, 0.05, 13, -14) +
        dust(97, 8, 200, 800, 150, FLOOR - 30, rgba(CYAN2, 1));
      var fg = vignette('fBzVg');
      return { bg: bg, mid: mid, fg: fg, edge: CYAN2 };
    },

    // ---- MEGACAMPUS: vast, sublime, dusk skyline + rising AGI core on horizon ----
    megacampus: function () {
      var bg =
        '<defs>' +
          '<linearGradient id="fMgSky" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#0e2a42"/><stop offset="0.4" stop-color="#0c1838"/><stop offset="1" stop-color="#090d24"/></linearGradient>' +
          '<radialGradient id="fMgGlow" cx="0.5" cy="0.32" r="0.75">' +
            '<stop offset="0" stop-color="' + rgba(CYAN2, 0.34) + '"/><stop offset="0.5" stop-color="' + rgba(VIOLET, 0.1) + '"/><stop offset="1" stop-color="transparent"/></radialGradient>' +
          glowFilter('fMgCore', 14) +
          '<radialGradient id="fMgCoreFill" cx="0.5" cy="0.5" r="0.5">' +
            '<stop offset="0" stop-color="#ffffff"/><stop offset="0.4" stop-color="' + rgba(CYAN2, 1) + '"/><stop offset="0.75" stop-color="' + rgba(VIOLET, 0.55) + '"/><stop offset="1" stop-color="' + rgba(VIOLET, 0) + '"/></radialGradient>' +
        '</defs>' +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fMgSky)"/>' +
        starfield(41, 46, 0, 0, VBW, 170, rgba(WHITE, 1)) +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fMgGlow)"/>' +
        // far + near skyline for parallax depth
        cityline(0, 200, VBW, rng(53), rgba(VIOLET2, 0.2)) +
        cityline(0, 212, VBW, rng(29), rgba(CYAN2, 0.38)) +
        line(0, 212, VBW, 212, rgba(CYAN, 0.16), 2) +
        // aurora-like god-ray fan rising from the core
        '<g opacity="0.45">' + godRays(600, 150, 9, 200, 1.6, rgba(CYAN2, 0.05), 0.9, 61) + '</g>' +
        // rising AGI core on the horizon
        '<g fill="none">' +
          '<circle cx="600" cy="150" r="62" stroke="' + rgba(CYAN, 0.28) + '" stroke-width="2" class="fac-ring"/>' +
          '<circle cx="600" cy="150" r="92" stroke="' + rgba(VIOLET2, 0.18) + '" stroke-width="2"/>' +
          '<circle cx="600" cy="150" r="122" stroke="' + rgba(CYAN, 0.08) + '" stroke-width="1.5"/>' +
        '</g>' +
        '<g filter="url(#fMgCore)"><circle cx="600" cy="150" r="30" fill="url(#fMgCoreFill)" class="fac-breathe"/></g>';
      var mid =
        '<rect x="0" y="' + FLOOR + '" width="' + VBW + '" height="' + (VBH - FLOOR) + '" fill="#070b16"/>' +
        line(0, FLOOR, VBW, FLOOR, rgba(CYAN2, 0.1), 2) +
        // faint power/cooling conduit mesh across the hall (static, deep depth)
        '<g stroke="' + rgba(CYAN, 0.05) + '" stroke-width="0.7" fill="none" stroke-linecap="round">' +
          line(20, 230, 1180, 230, rgba(CYAN, 0.05), 0.7) + line(20, 242, 1180, 242, rgba(CYAN, 0.045), 0.7) +
          line(150, 224, 150, 250, rgba(CYAN, 0.045), 0.7) + line(420, 224, 420, 250, rgba(CYAN, 0.045), 0.7) +
          line(690, 224, 690, 250, rgba(CYAN, 0.045), 0.7) + line(960, 224, 960, 250, rgba(CYAN, 0.045), 0.7) +
        '</g>' +
        // a fainter far-far silhouette row implying a hall beyond the halls
        '<g opacity="0.34">' +
          '<rect x="40" y="232" width="130" height="16" rx="2" fill="#0a1120" stroke="' + rgba(CYAN2, 0.14) + '" stroke-width="0.8"/>' +
          '<rect x="250" y="232" width="110" height="16" rx="2" fill="#0a1120" stroke="' + rgba(VIOLET2, 0.12) + '" stroke-width="0.8"/>' +
          '<rect x="440" y="232" width="150" height="16" rx="2" fill="#0a1120" stroke="' + rgba(CYAN2, 0.14) + '" stroke-width="0.8"/>' +
          '<rect x="680" y="232" width="120" height="16" rx="2" fill="#0a1120" stroke="' + rgba(VIOLET2, 0.12) + '" stroke-width="0.8"/>' +
          '<rect x="880" y="232" width="140" height="16" rx="2" fill="#0a1120" stroke="' + rgba(CYAN2, 0.14) + '" stroke-width="0.8"/>' +
        '</g>' +
        // distant low halls behind the racks (the campus extends past view)
        '<g opacity="0.5">' +
          '<rect x="80" y="248" width="180" height="26" rx="3" fill="#0b1322" stroke="' + rgba(CYAN2, 0.25) + '" stroke-width="1.2"/>' +
          '<rect x="320" y="252" width="150" height="22" rx="3" fill="#0a1120" stroke="' + rgba(VIOLET2, 0.2) + '" stroke-width="1"/>' +
          '<rect x="520" y="248" width="200" height="26" rx="3" fill="#0b1322" stroke="' + rgba(VIOLET2, 0.25) + '" stroke-width="1.2"/>' +
          '<rect x="760" y="252" width="150" height="22" rx="3" fill="#0a1120" stroke="' + rgba(CYAN2, 0.2) + '" stroke-width="1"/>' +
          '<rect x="940" y="248" width="170" height="26" rx="3" fill="#0b1322" stroke="' + rgba(CYAN2, 0.25) + '" stroke-width="1.2"/>' +
        '</g>' +
        '<ellipse cx="600" cy="' + (FLOOR + 14) + '" rx="500" ry="24" fill="' + rgba(CYAN2, 0.06) + '"/>' +
        lightSweep(CYAN2, 0.04, 18, -12) +
        dust(101, 10, 60, 1080, 180, FLOOR - 30, rgba(CYAN2, 1));
      var fg = vignette('fMgVg');
      return { bg: bg, mid: mid, fg: fg, edge: CYAN2 };
    }
  };

  // ============================ rack layout ============================
  // Lay up to CAP racks in tidy rows on the floor. We draw the FAR (idle) row
  // first, then the NEAR (committed) row in front, so committed glow reads on top.
  var CAP = 30;          // max visible rack units (keeps it fast on thousands)

  // `density` (default 1) is forwarded to rack() so the LED look scales with tier.
  function layRacks(committed, idle, density) {
    var den = density == null ? 1 : density;
    var total = committed + idle;
    if (total <= 0) return { svg: '', more: 0 };
    // how many we actually draw (cap), preserving the committed/idle ratio
    var shownTotal = Math.min(total, CAP);
    var shownCommitted = total === 0 ? 0 : Math.round(shownTotal * (committed / total));
    if (committed > 0 && shownCommitted === 0) shownCommitted = 1;
    if (shownCommitted > shownTotal) shownCommitted = shownTotal;
    var shownIdle = shownTotal - shownCommitted;
    var more = total - shownTotal;

    var s = '';
    // Two rows: a NEAR row (bigger, front) and a FAR row (smaller, set back).
    // Committed units go in the NEAR row first (the hero glow), idle fill the rest.
    var perRow = Math.ceil(shownTotal / 2);
    var nearCount = Math.min(perRow, shownTotal);
    var farCount = shownTotal - nearCount;

    // build a flat list: committed first (glow), then idle
    var list = [], i;
    for (i = 0; i < shownCommitted; i++) list.push(true);
    for (i = 0; i < shownIdle; i++) list.push(false);

    // FAR row (drawn first, behind): smaller racks, set higher on the floor
    var fy = FLOOR - 24, fh = 86, fw = 30, fgap = 8;
    var farTotalW = farCount * fw + (farCount - 1) * fgap;
    var fx0 = (VBW - farTotalW) / 2;
    for (i = 0; i < farCount; i++) {
      var fglow = list[nearCount + i];
      s += '<g opacity="0.82">' + rack(fx0 + i * (fw + fgap), fy, fw, fh, fglow, 1000 + i, den) + '</g>';
    }
    // NEAR row (front): larger racks sitting on the floor line
    var ny = FLOOR + 2, nh = 118, nw = 40, ngap = 11;
    var nearTotalW = nearCount * nw + (nearCount - 1) * ngap;
    var nx0 = (VBW - nearTotalW) / 2;
    for (i = 0; i < nearCount; i++) {
      var nglow = list[i];
      s += rack(nx0 + i * (nw + ngap), ny, nw, nh, nglow, 2000 + i, den);
    }
    return { svg: s, more: more };
  }

  // ============================ signature (re-render only on change) ============================
  function signature(st) {
    try {
      var committed = 0, idle = 0;
      var HW = (window.GAME_CONFIG && window.GAME_CONFIG.HARDWARE) || [];
      for (var i = 0; i < HW.length; i++) {
        var id = HW[i].id;
        idle += (st.hw && st.hw[id]) || 0;
        committed += (st.committed && st.committed[id]) || 0;
      }
      var lang = (window.GAME_I18N && window.GAME_I18N.getLang && window.GAME_I18N.getLang()) || 'en';
      return [st.premise, committed, idle, st.version >= 1 ? 1 : 0, lang].join('|');
    } catch (e) { return ''; }
  }

  var _lastSig = null;
  var _lastContainer = null;

  // ============================ main render ============================
  function render(container) {
    try {
      container = container || _lastContainer;
      if (!container) return;
      _lastContainer = container;
      var G = window.GAME, I = window.GAME_I18N, C = window.GAME_CONFIG;
      if (!G || !G.state || !C) { container.innerHTML = ''; return; }
      var st = G.state;
      // before naming / first boot: render nothing gracefully
      if (!st.premise) { container.innerHTML = ''; return; }

      var sig = signature(st);
      if (sig === _lastSig && container.firstChild) return;  // nothing relevant changed
      _lastSig = sig;

      var t = (I && I.t) ? function (k, v) { return I.t(k, v); } : function (k) { return k; };

      // count owned hardware (idle + committed across all tiers)
      var committed = 0, idle = 0, HW = C.HARDWARE || [];
      for (var i = 0; i < HW.length; i++) {
        var id = HW[i].id;
        idle += (st.hw && st.hw[id]) || 0;
        committed += (st.committed && st.committed[id]) || 0;
      }

      var make = BACKDROPS[st.premise] || BACKDROPS.garage;
      var scene = make();
      // tier density: startups stay sparse, data halls read busy/alive.
      var DENS = { garage: 0.85, basement: 0.95, office: 1.05, bizpark: 1.2, megacampus: 1.35 };
      var dens = DENS[st.premise] != null ? DENS[st.premise] : 1;
      var laid = layRacks(committed, idle, dens);

      // defs shared by the rack drawer (glow filter) live in the rack layer
      var rackDefs = '<defs>' + glowFilter('facGlow', 5) + '</defs>';
      // a subtle model-core glow once version >= 1
      var coreGlow = (st.version >= 1)
        ? '<ellipse cx="600" cy="' + (FLOOR - 30) + '" rx="300" ry="60" fill="' + rgba(CYAN, 0.06) + '" class="fac-coreglow"/>'
        : '';
      // high-tier powered halls get a faint extra floor underglow when racks are committed
      var hallGlow = (dens >= 1.15 && committed > 0)
        ? '<ellipse cx="600" cy="' + (FLOOR + 16) + '" rx="' + (380 + (dens - 1) * 160).toFixed(0) +
            '" ry="26" fill="' + rgba(CYAN2, (0.05 + (dens - 1) * 0.04).toFixed(3)) + '"/>'
        : '';

      // header line: premise name + m² used/cap
      var used = 0, cap = 0;
      try { used = G.ownedM2 ? G.ownedM2() : 0; cap = G.capacityM2 ? G.capacityM2() : 0; } catch (e) {}
      var fmt = (window.GAME_FMT && window.GAME_FMT.fmt) ? window.GAME_FMT.fmt : function (n) { return Math.round(n); };
      var premName = t('prem_name_' + st.premise);

      // legend chips (committed glow / idle for rent) — only show the relevant ones
      var legend = '';
      if (committed > 0) legend += '<span class="facility-chip fac-chip-on"><i></i>' + esc(t('facility_committed')) + '</span>';
      if (idle > 0) legend += '<span class="facility-chip fac-chip-idle"><i></i>' + esc(t('facility_idle')) + '</span>';

      var moreBadge = laid.more > 0
        ? '<div class="facility-more">' + esc(t('facility_more', { n: fmt(laid.more) })) + '</div>'
        : '';

      // Layers (back -> front):
      //   bg  = far backdrop
      //   mid = atmosphere + floor + coreGlow
      //   fg  = racks (with their defs) + scene foreground accents (vignette on top)
      var html =
        '<div class="facility-stage">' +
          svgLayer('facility-bg', '', scene.bg) +
          svgLayer('facility-mid', '', scene.mid + hallGlow + coreGlow) +
          svgLayer('facility-fg', rackDefs, laid.svg + scene.fg) +
        '</div>' +
        '<div class="facility-head">' +
          '<span class="facility-prem">' + esc(premName) + '</span>' +
          '<span class="facility-m2">' + esc(t('facility_used_cap', { used: fmt(used), cap: fmt(cap) })) + '</span>' +
        '</div>' +
        (legend ? '<div class="facility-legend">' + legend + '</div>' : '') +
        moreBadge;

      container.innerHTML = html;
    } catch (e) {
      // never throw — clear gracefully on any unexpected error
      try { if (container) container.innerHTML = ''; } catch (e2) {}
    }
  }

  // force the next render() to rebuild (used on premise move / buy / release)
  function invalidate() { _lastSig = null; }

  window.GAME_FACILITY = {
    render: render,
    invalidate: invalidate
  };
})();
