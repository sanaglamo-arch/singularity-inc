/* Singularity Inc. v2 — VISUAL FACILITY VIEW -> window.GAME_FACILITY.
   A living 2.5D "diorama" of the player's current premises with their hardware
   rendered INSIDE as rack/server units. Reactive: racks grow as gear is bought,
   committed units GLOW (cyan, "powering your model"), idle ones are dim
   ("for rent"). The whole room transforms when the player MOVES premises.

   SELF-CONTAINED on purpose: it imports NOTHING from cutscene.js. It carries its
   own tiny copies of the proven SVG helpers (svg/rgba/line/circle/rng/glow) and
   its own palette, so it can never break if cutscene internals change. Layered
   inline SVG only — no canvas/WebGL, no external assets.

   Guard everything: if GAME / state is missing we render nothing gracefully and
   never throw. 0 console errors is the #1 requirement. */
(function () {
  'use strict';

  // ============================ tiny self-contained helpers ============================
  // (intentional duplicates of the cutscene primitives — keeps this module decoupled)
  function rgba(c, a) { return 'rgba(' + c + ',' + a + ')'; }
  var VIOLET = '139,92,246', VIOLET2 = '167,139,250', CYAN = '34,211,238',
      CYAN2 = '103,232,249', GOLD = '251,191,36', WHITE = '255,255,255';

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
      out += '<circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="' + rr.toFixed(1) +
        '" fill="' + (col || rgba(WHITE, 1)) + '" opacity="' + op.toFixed(2) + '"/>';
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

  function svgLayer(cls, inner) {
    return '<svg class="facility-layer ' + cls + '" viewBox="0 0 ' + VBW + ' ' + VBH +
      '" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      inner + '</svg>';
  }

  // ============================ the rack unit drawer ============================
  // One self-contained server rack of blinking units. glow=true => committed
  // (cyan power glow); glow=false => idle (dimmer, "for rent" tint).
  function rack(x, y, w, h, glow, seed) {
    var top = y - h, rr = rng(seed || (x * 7 + y)), s = '';
    var edge = glow ? CYAN2 : VIOLET2;
    var edgeA = glow ? 0.55 : 0.24;
    // cabinet body
    s += '<rect x="' + x + '" y="' + top + '" width="' + w + '" height="' + h + '" rx="3" fill="#0b1018" stroke="' + rgba(edge, edgeA) + '" stroke-width="' + (glow ? 2 : 1.5) + '"/>';
    s += '<rect x="' + x + '" y="' + top + '" width="' + w + '" height="' + h + '" rx="3" fill="none" stroke="' + rgba(WHITE, 0.04) + '" stroke-width="4"/>';
    // committed: cyan power glow underlight at the base + a soft halo
    if (glow) {
      s += '<rect x="' + (x - 2) + '" y="' + (top + h - 4) + '" width="' + (w + 4) + '" height="7" rx="3" fill="' + rgba(CYAN2, 0.7) + '" filter="url(#facGlow)"/>';
    }
    // rack units (1U slats) with LED rows
    var uy, k = 0, step = Math.max(11, h / 7);
    for (uy = top + 6; uy < y - 5; uy += step) {
      s += '<rect x="' + (x + 4) + '" y="' + uy.toFixed(1) + '" width="' + (w - 8) + '" height="' + (step - 4).toFixed(1) + '" rx="1.5" fill="' + (glow ? '#0e1726' : '#0d1320') + '"/>';
      var lx, cy = uy + (step - 4) / 2;
      for (lx = x + 8; lx < x + w - 6; lx += 9) {
        var on = rr() > (glow ? 0.28 : 0.62);
        var col = glow ? (rr() > 0.5 ? CYAN2 : CYAN) : (rr() > 0.6 ? VIOLET2 : GOLD);
        s += circle(lx, cy, 1.5, rgba(col, on ? (glow ? 0.95 : 0.45) : 0.14),
          on ? ' class="fac-pulse" style="--pd:' + (k % 6) + 's"' : '');
        k++;
      }
    }
    // idle racks read a touch darker overall
    if (!glow) s += '<rect x="' + x + '" y="' + top + '" width="' + w + '" height="' + h + '" rx="3" fill="' + rgba('5,8,15', 0.32) + '"/>';
    return s;
  }

  // ============================ per-premise backdrops ============================
  // Each returns { bg, mid } HTML (atmosphere behind + ambient in front of the
  // floor). The racks are laid by render() between them. One backdrop per tier
  // of C.PREMISES (garage -> basement -> office -> bizpark -> megacampus).
  var BACKDROPS = {
    // small cluttered warm room
    garage: function () {
      var bg =
        '<defs>' +
          '<linearGradient id="fGarW" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#16112c"/><stop offset="0.55" stop-color="#0d0a1f"/><stop offset="1" stop-color="#080612"/></linearGradient>' +
          '<radialGradient id="fGarWin" cx="0.5" cy="0.4" r="0.8">' +
            '<stop offset="0" stop-color="#1b2c48"/><stop offset="1" stop-color="#0a1122"/></radialGradient>' +
          '<radialGradient id="fGarAmb" cx="0.5" cy="0.9" r="0.7">' +
            '<stop offset="0" stop-color="' + rgba(GOLD, 0.16) + '"/><stop offset="1" stop-color="' + rgba(GOLD, 0) + '"/></radialGradient>' +
        '</defs>' +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fGarW)"/>' +
        // back-wall window with moon + skyline (top-left, atmospheric)
        '<g opacity="0.92">' +
          '<rect x="70" y="40" width="240" height="150" rx="5" fill="url(#fGarWin)"/>' +
          cityline(70, 190, 240, rng(7), rgba(CYAN2, 0.35)) +
          starfield(31, 22, 78, 48, 224, 90, rgba(WHITE, 1)) +
          '<circle cx="250" cy="86" r="30" fill="' + rgba(CYAN2, 0.5) + '"/>' +
          '<rect x="70" y="40" width="240" height="150" rx="5" fill="none" stroke="' + rgba(VIOLET2, 0.28) + '" stroke-width="3"/>' +
          line(190, 40, 190, 190, rgba(VIOLET2, 0.22), 2) +
          line(70, 115, 310, 115, rgba(VIOLET2, 0.22), 2) +
        '</g>' +
        // cluttered shelf of boxes (top-right)
        line(900, 70, 1150, 70, rgba(VIOLET2, 0.16), 3) +
        '<g fill="#0e0b20" stroke="' + rgba(VIOLET2, 0.12) + '" stroke-width="2">' +
          '<rect x="930" y="32" width="40" height="38" rx="3"/>' +
          '<rect x="982" y="38" width="32" height="32" rx="3"/>' +
          '<rect x="1028" y="28" width="38" height="42" rx="3"/>' +
        '</g>' +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fGarAmb)"/>';
      var mid =
        '<rect x="0" y="' + FLOOR + '" width="' + VBW + '" height="' + (VBH - FLOOR) + '" fill="#0c0a18"/>' +
        line(0, FLOOR, VBW, FLOOR, rgba(WHITE, 0.05), 2) +
        '<ellipse cx="600" cy="' + (FLOOR + 12) + '" rx="380" ry="22" fill="' + rgba(GOLD, 0.05) + '"/>';
      return { bg: bg, mid: mid, edge: GOLD };
    },
    // dark, caged bulb
    basement: function () {
      var bg =
        '<defs>' +
          '<linearGradient id="fBsW" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#0c1320"/><stop offset="0.55" stop-color="#080d18"/><stop offset="1" stop-color="#05080f"/></linearGradient>' +
          '<radialGradient id="fBsBulb" cx="0.5" cy="0.5" r="0.5">' +
            '<stop offset="0" stop-color="' + rgba(GOLD, 0.5) + '"/><stop offset="0.5" stop-color="' + rgba(GOLD, 0.12) + '"/><stop offset="1" stop-color="' + rgba(GOLD, 0) + '"/></radialGradient>' +
        '</defs>' +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fBsW)"/>' +
        // bare concrete seams + damp patches
        line(0, 150, VBW, 150, rgba(WHITE, 0.04), 2) +
        line(0, 250, VBW, 250, rgba(WHITE, 0.04), 2) +
        '<g fill="' + rgba(CYAN, 0.03) + '"><ellipse cx="210" cy="120" rx="120" ry="60"/><ellipse cx="1000" cy="200" rx="150" ry="80"/></g>' +
        // small barred basement window (top-left)
        '<g opacity="0.9">' +
          '<rect x="100" y="50" width="130" height="62" rx="3" fill="#0d1a2c"/>' +
          '<rect x="100" y="50" width="130" height="62" rx="3" fill="none" stroke="' + rgba(CYAN2, 0.22) + '" stroke-width="3"/>' +
          line(143, 50, 143, 112, rgba(CYAN2, 0.3), 2) +
          line(186, 50, 186, 112, rgba(CYAN2, 0.3), 2) +
          line(100, 81, 230, 81, rgba(CYAN2, 0.2), 2) +
        '</g>' +
        // the caged hanging bulb, the only soft light
        line(600, 0, 600, 70, rgba(WHITE, 0.18), 2) +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fBsBulb)" opacity="0.5"/>';
      var mid =
        '<defs>' + glowFilter('fBsL', 8) + '</defs>' +
        '<g><circle cx="600" cy="82" r="9" fill="' + rgba(GOLD, 0.95) + '" filter="url(#fBsL)"/>' +
          '<g fill="none" stroke="' + rgba(WHITE, 0.16) + '" stroke-width="2">' +
            '<path d="M586 72 q14 24 28 0"/>' + line(600, 72, 600, 92, rgba(WHITE, 0.16), 2) +
          '</g></g>' +
        '<rect x="0" y="' + FLOOR + '" width="' + VBW + '" height="' + (VBH - FLOOR) + '" fill="#070a12"/>' +
        line(0, FLOOR, VBW, FLOOR, rgba(WHITE, 0.05), 2) +
        '<ellipse cx="600" cy="' + (FLOOR + 10) + '" rx="320" ry="22" fill="' + rgba(GOLD, 0.06) + '"/>';
      return { bg: bg, mid: mid, edge: CYAN2 };
    },
    // bright, daylight, desks
    office: function () {
      var bg =
        '<defs>' +
          '<linearGradient id="fOfW" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#172338"/><stop offset="0.6" stop-color="#101a2c"/><stop offset="1" stop-color="#0b1320"/></linearGradient>' +
          '<linearGradient id="fOfDay" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="' + rgba(CYAN2, 0.85) + '"/><stop offset="0.6" stop-color="' + rgba(CYAN2, 0.32) + '"/><stop offset="1" stop-color="' + rgba(GOLD, 0.16) + '"/></linearGradient>' +
          '<radialGradient id="fOfSun" cx="0.5" cy="0.2" r="0.7">' +
            '<stop offset="0" stop-color="' + rgba(GOLD, 0.2) + '"/><stop offset="1" stop-color="' + rgba(GOLD, 0) + '"/></radialGradient>' +
        '</defs>' +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fOfW)"/>' +
        // wall of tall daylight windows with a soft city beyond
        '<g>' +
          '<rect x="120" y="40" width="960" height="190" rx="6" fill="url(#fOfDay)" opacity="0.5"/>' +
          cityline(120, 230, 960, rng(17), rgba(WHITE, 0.45)) +
          '<g stroke="' + rgba(WHITE, 0.16) + '" stroke-width="2.5" fill="none">' +
            '<rect x="120" y="40" width="960" height="190" rx="6"/>' +
            line(360, 40, 360, 230, rgba(WHITE, 0.14), 2.5) +
            line(600, 40, 600, 230, rgba(WHITE, 0.14), 2.5) +
            line(840, 40, 840, 230, rgba(WHITE, 0.14), 2.5) +
            line(120, 135, 1080, 135, rgba(WHITE, 0.1), 2.5) +
          '</g>' +
        '</g>' +
        // a potted plant by the window (legitimacy)
        '<g transform="translate(140,250)">' +
          '<path d="M0 44 l24 0 -3 -38 -18 0 z" fill="#2a1f14"/>' +
          '<g fill="none" stroke="' + rgba(CYAN2, 0.5) + '" stroke-width="3" stroke-linecap="round">' +
            '<path d="M12 8 q-18 -26 -32 -28"/><path d="M12 8 q3 -30 -8 -42"/><path d="M12 8 q20 -22 34 -22"/>' +
          '</g></g>' +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fOfSun)"/>';
      var mid =
        '<rect x="0" y="' + FLOOR + '" width="' + VBW + '" height="' + (VBH - FLOOR) + '" fill="#0c1422"/>' +
        line(0, FLOOR, VBW, FLOOR, rgba(WHITE, 0.06), 2) +
        '<ellipse cx="600" cy="' + (FLOOR + 12) + '" rx="420" ry="22" fill="' + rgba(CYAN2, 0.05) + '"/>';
      return { bg: bg, mid: mid, edge: CYAN2 };
    },
    // industrial server hall
    bizpark: function () {
      var bg =
        '<defs>' +
          '<radialGradient id="fBzBg" cx="0.5" cy="0.4" r="0.85">' +
            '<stop offset="0" stop-color="#101a30"/><stop offset="0.6" stop-color="#0a1022"/><stop offset="1" stop-color="#06080f"/></radialGradient>' +
          '<linearGradient id="fBzFloor" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#0d1424"/><stop offset="1" stop-color="#070b14"/></linearGradient>' +
          glowFilter('fBzV', 12) +
        '</defs>' +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fBzBg)"/>' +
        // ceiling: receding light strips toward a bright vanishing point
        '<g stroke-linecap="round">' +
          line(0, 30, 540, 150, rgba(CYAN2, 0.16), 3) +
          line(1200, 30, 660, 150, rgba(CYAN2, 0.16), 3) +
          line(240, 10, 560, 150, rgba(CYAN2, 0.1), 2) +
          line(960, 10, 640, 150, rgba(CYAN2, 0.1), 2) +
        '</g>' +
        // bright vanishing-point glow at the aisle's end
        '<g filter="url(#fBzV)"><ellipse cx="600" cy="170" rx="46" ry="80" fill="' + rgba(CYAN2, 0.45) + '"/></g>' +
        '<ellipse cx="600" cy="170" rx="16" ry="48" fill="' + rgba(WHITE, 0.6) + '"/>';
      var mid =
        '<rect x="0" y="' + FLOOR + '" width="' + VBW + '" height="' + (VBH - FLOOR) + '" fill="url(#fBzFloor)"/>' +
        line(0, FLOOR, VBW, FLOOR, rgba(CYAN, 0.08), 2) +
        '<ellipse cx="600" cy="' + (FLOOR + 14) + '" rx="440" ry="24" fill="' + rgba(CYAN, 0.06) + '"/>';
      return { bg: bg, mid: mid, edge: CYAN2 };
    },
    // vast hyperscale datacenter at dusk
    megacampus: function () {
      var bg =
        '<defs>' +
          '<linearGradient id="fMgSky" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#0c2236"/><stop offset="0.45" stop-color="#0b1430"/><stop offset="1" stop-color="#0a0e22"/></linearGradient>' +
          '<radialGradient id="fMgGlow" cx="0.5" cy="0.3" r="0.7">' +
            '<stop offset="0" stop-color="' + rgba(CYAN2, 0.32) + '"/><stop offset="0.5" stop-color="' + rgba(VIOLET, 0.1) + '"/><stop offset="1" stop-color="transparent"/></radialGradient>' +
          glowFilter('fMgCore', 14) +
          '<radialGradient id="fMgCoreFill" cx="0.5" cy="0.5" r="0.5">' +
            '<stop offset="0" stop-color="#ffffff"/><stop offset="0.4" stop-color="' + rgba(CYAN2, 1) + '"/><stop offset="0.75" stop-color="' + rgba(VIOLET, 0.55) + '"/><stop offset="1" stop-color="' + rgba(VIOLET, 0) + '"/></radialGradient>' +
        '</defs>' +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fMgSky)"/>' +
        starfield(41, 50, 0, 0, VBW, 180, rgba(WHITE, 1)) +
        '<rect width="' + VBW + '" height="' + VBH + '" fill="url(#fMgGlow)"/>' +
        cityline(0, 210, VBW, rng(29), rgba(CYAN2, 0.36)) +
        line(0, 210, VBW, 210, rgba(CYAN, 0.16), 2) +
        // rising AGI core on the horizon
        '<g fill="none">' +
          '<circle cx="600" cy="150" r="62" stroke="' + rgba(CYAN, 0.28) + '" stroke-width="2" class="fac-ring"/>' +
          '<circle cx="600" cy="150" r="92" stroke="' + rgba(VIOLET2, 0.18) + '" stroke-width="2"/>' +
        '</g>' +
        '<g filter="url(#fMgCore)"><circle cx="600" cy="150" r="30" fill="url(#fMgCoreFill)" class="fac-breathe"/></g>';
      var mid =
        '<rect x="0" y="' + FLOOR + '" width="' + VBW + '" height="' + (VBH - FLOOR) + '" fill="#070b16"/>' +
        line(0, FLOOR, VBW, FLOOR, rgba(CYAN2, 0.1), 2) +
        // distant low halls behind the racks
        '<g opacity="0.5">' +
          '<rect x="120" y="248" width="160" height="26" rx="3" fill="#0b1322" stroke="' + rgba(CYAN2, 0.25) + '" stroke-width="1.2"/>' +
          '<rect x="520" y="248" width="200" height="26" rx="3" fill="#0b1322" stroke="' + rgba(VIOLET2, 0.25) + '" stroke-width="1.2"/>' +
          '<rect x="940" y="248" width="150" height="26" rx="3" fill="#0b1322" stroke="' + rgba(CYAN2, 0.25) + '" stroke-width="1.2"/>' +
        '</g>' +
        '<ellipse cx="600" cy="' + (FLOOR + 14) + '" rx="480" ry="24" fill="' + rgba(CYAN2, 0.05) + '"/>';
      return { bg: bg, mid: mid, edge: CYAN2 };
    }
  };

  // ============================ rack layout ============================
  // Lay up to CAP racks in tidy rows on the floor. We draw the FAR (idle) row
  // first, then the NEAR (committed) row in front, so committed glow reads on top.
  var CAP = 30;          // max visible rack units (keeps it fast on thousands)

  function layRacks(committed, idle) {
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
      s += '<g opacity="0.82">' + rack(fx0 + i * (fw + fgap), fy, fw, fh, fglow, 1000 + i) + '</g>';
    }
    // NEAR row (front): larger racks sitting on the floor line
    var ny = FLOOR + 2, nh = 118, nw = 40, ngap = 11;
    var nearTotalW = nearCount * nw + (nearCount - 1) * ngap;
    var nx0 = (VBW - nearTotalW) / 2;
    for (i = 0; i < nearCount; i++) {
      var nglow = list[i];
      s += rack(nx0 + i * (nw + ngap), ny, nw, nh, nglow, 2000 + i);
    }
    return { svg: s, more: more };
  }

  // ============================ signature (re-render only on change) ============================
  function signature(st) {
    try {
      var G = window.GAME, committed = 0, idle = 0;
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
      var laid = layRacks(committed, idle);

      // defs shared by the rack drawer (glow filter) live in the rack layer
      var rackDefs = '<defs>' + glowFilter('facGlow', 5) + '</defs>';
      // a subtle model-core glow once version >= 1
      var coreGlow = (st.version >= 1)
        ? '<ellipse cx="600" cy="' + (FLOOR - 30) + '" rx="300" ry="60" fill="' + rgba(CYAN, 0.06) + '" class="fac-coreglow"/>'
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

      var html =
        '<div class="facility-stage">' +
          svgLayer('facility-bg', scene.bg) +
          svgLayer('facility-mid', scene.mid + coreGlow) +
          svgLayer('facility-fg', rackDefs + laid.svg) +
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
