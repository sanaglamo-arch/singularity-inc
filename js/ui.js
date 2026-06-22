/* UI layer -> window.GAME_UI. v2 logic on the existing premium styles.css.
   Drives the v2 GAME engine, but emits DOM using the existing index.html ids
   and styles.css class names so the design renders identically to the reference. */
(function () {
  'use strict';

  var G = window.GAME, C = window.GAME_CONFIG, FMT = window.GAME_FMT;
  var I = window.GAME_I18N, FX = window.GAME_FX, A = window.GAME_AUDIO, M = window.GAME_MUSIC;
  var ICON = window.GAME_ICONS || {};
  var t = function (k, v) { return I.t(k, v); };
  var fmt = FMT.fmt;
  // reduced-motion guard for JS-driven juice (CSS @media handles the rest)
  var _reduceMotion = false;
  try { _reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  try { if (window.matchMedia) window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function (e) { _reduceMotion = e.matches; }); } catch (e) {}

  // cached getElementById with isConnected guard (rebuilt nodes auto-refresh)
  var _elc = {};
  var $ = function (id) { var e = _elc[id]; if (e && e.isConnected) return e; e = document.getElementById(id); if (e) _elc[id] = e; return e; };

  // guarded DOM writes — only touch the DOM when the value actually CHANGED
  function setText(el, v) { if (!el) return; if (el.__t !== v) { el.__t = v; el.textContent = v; } }
  function setStyleP(el, prop, v) { if (!el) return; var k = '__s_' + prop; if (el[k] !== v) { el[k] = v; el.style[prop] = v; } }
  function setClass(el, cls, on) { if (!el) return; var k = '__c_' + cls; on = !!on; if (el[k] !== on) { el[k] = on; el.classList.toggle(cls, on); } }
  function setHTML(el, v) { if (!el) return; if (el.__h !== v) { el.__h = v; el.innerHTML = v; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function buzz(p) { try { if (G.state.haptics && navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  var _icUid = 0;
  function ic(key) {
    var raw = ICON[key] || '';
    if (!raw || raw.indexOf('id="') < 0) return raw;
    // Icon gradient ids are static per icon-type (seeded by the key), so the SAME icon
    // rendered twice puts duplicate <linearGradient id="…"> on the page. A stroke's
    // url(#id) then resolves to the FIRST match in document order, whose <stop>
    // currentColor is taken from THAT instance's context — not this one. That left the
    // active-model brain (ic_brain, also used elsewhere) painting with another, darker
    // instance's color → a stroke that read as an empty placeholder chip. Make every
    // insertion's ids unique so each icon resolves its own gradients in its own context.
    var u = '_u' + (++_icUid);
    return raw.replace(/id="([^"]+)"/g, 'id="$1' + u + '"').replace(/url\(#([^)]+)\)/g, 'url(#$1' + u + ')');
  }
  function money(n) { return '$' + fmt(n); }
  function pct(x) { return Math.round(x * 100); }
  // market share reads as a fractional percent (e.g. 0.7%, 23.4%) — small shares matter
  // and shouldn't round up to a misleading whole number.
  function pct1(x) { return (x * 100).toFixed(1); }   // market share: always a fractional percent (e.g. 4.5%, 96.3%) — never rounded to a whole number
  // a user count is always whole people
  function uFmt(n) { return fmt(Math.round(n)); }
  function s() { return G.state; }
  var ruS = function () { return I.getLang() === 'ru' ? 'с' : 's'; };

  // Item 2 — HUD value pulse on a MEANINGFUL step. A readout pulses (.hud-pulse-*) only
  // when its numeric value jumps by more than `relStep` of the prior value, and at most
  // once per `coolMs` — so the continuous per-second income/users drip never pulses,
  // but a purchase / release / price change registers with a soft scale+glow.
  function hudPulse(el, value, cls, relStep, coolMs) {
    if (!el || _reduceMotion) return;
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var prev = el.__pv;
    el.__pv = value;
    if (prev == null || !isFinite(prev) || !isFinite(value)) return;          // first sample: just record
    var base = Math.max(1, Math.abs(prev));
    if (Math.abs(value - prev) / base < (relStep || 0.04)) return;            // change too small → drip
    if (el.__pt && now - el.__pt < (coolMs || 550)) return;                   // throttled
    el.__pt = now;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    var c = cls;
    (function (e) { setTimeout(function () { e.classList.remove(c); }, 360); })(el);
  }

  // Item 3 — owned-count "pop" after a purchase: scale up then settle. One-shot class.
  function popBadge(el) {
    if (!el || _reduceMotion) return;
    el.classList.remove('count-pop'); void el.offsetWidth; el.classList.add('count-pop');
    setTimeout(function () { el.classList.remove('count-pop'); }, 360);
  }

  // ---------------- toasts (queued, coalesced, capped) ----------------
  var _toastQ = [], _toastLive = [], TOAST_MAX = 3, TOAST_MS = 3000, TOAST_Q_MAX = 4;
  function armToastTimer(rec) {
    rec.timer = setTimeout(function () {
      if (rec.node.parentNode) rec.node.parentNode.removeChild(rec.node);
      var i = _toastLive.indexOf(rec); if (i >= 0) _toastLive.splice(i, 1);
      pumpToasts();
    }, TOAST_MS);
  }
  function toast(msg, kind, opts) {
    kind = kind || '';
    for (var i = 0; i < _toastLive.length; i++) {
      var rec = _toastLive[i];
      if (rec.item.msg === msg && rec.item.kind === kind) {
        rec.item.count++;
        if (!rec.countEl) { rec.countEl = el('span', 'toast-x'); rec.node.appendChild(rec.countEl); }
        rec.countEl.textContent = '×' + rec.item.count;
        if (rec.timer) clearTimeout(rec.timer);
        rec.node.classList.remove('flash'); void rec.node.offsetWidth; rec.node.classList.add('flash');
        armToastTimer(rec); return;
      }
    }
    for (var j = 0; j < _toastQ.length; j++) if (_toastQ[j].msg === msg && _toastQ[j].kind === kind) { _toastQ[j].count++; pumpToasts(); return; }
    _toastQ.push({ msg: msg, kind: kind, routine: !!(opts && opts.routine), count: 1 });
    while (_toastQ.length > TOAST_Q_MAX) { var ri = -1; for (var k = 0; k < _toastQ.length; k++) if (_toastQ[k].routine) { ri = k; break; } _toastQ.splice(ri >= 0 ? ri : 0, 1); }
    pumpToasts();
  }
  function pumpToasts() {
    var root = $('toastRoot'); if (!root) return;
    while (_toastLive.length < TOAST_MAX && _toastQ.length) {
      var it = _toastQ.shift();
      var e = el('div', 'toast' + (it.kind ? ' ' + it.kind : ''));
      e.appendChild(el('span', 'toast-msg', it.msg));
      root.appendChild(e);
      var rec = { item: it, node: e, countEl: null, timer: null };
      _toastLive.push(rec);
      if (it.count > 1) { e.appendChild(rec.countEl = el('span', 'toast-x')); rec.countEl.textContent = '×' + it.count; }
      armToastTimer(rec);
    }
  }
  function floatText(x, y, txt, cls) {
    var e = el('div', 'float' + (cls ? ' ' + cls : ''), txt);
    e.style.left = (x - 12) + 'px'; e.style.top = (y - 20) + 'px';
    $('fxRoot').appendChild(e);
    setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 1100);
  }

  // ---------------- modals (reuse #modalRoot + .modal) ----------------
  var modalOpen = false, modalQueue = [];
  function showModal(html) { var root = $('modalRoot'); root.onclick = null; root.innerHTML = '<div class="modal">' + html + '</div>'; root.classList.remove('hidden'); modalOpen = true; }
  function hideModal() { var root = $('modalRoot'); root.onclick = null; root.classList.add('hidden'); root.innerHTML = ''; modalOpen = false; setTimeout(drainQueue, 60); }
  function queueModal(fn) { modalQueue.push(fn); drainQueue(); }
  function drainQueue() { if (modalOpen || !modalQueue.length) return; (modalQueue.shift())(); }
  // simple teach/confirm modal
  function teachModal(opts) {
    // Never pop a teach modal in the MIDDLE of a tap-burst: it appears over the orb and the
    // player's momentum taps land on its card and get eaten (3 blind testers — incl. a first
    // EN-toggle tap swallowed by the "passive income" modal). If the player tapped <550ms ago,
    // wait for the burst to settle, re-checking every 250ms. Non-tap contexts (bill/event/offline)
    // see a stale _lastTapMs and show at once.
    var _now = (window.performance && performance.now) ? performance.now() : +new Date();
    if (_now - _lastTapMs < 550) { setTimeout(function () { teachModal(opts); }, 250); return; }
    queueModal(function () {
      showModal(
        '<div class="ob">' +
        (opts.icon ? '<div class="ob-icon">' + opts.icon + '</div>' : '') +
        '<h3>' + esc(opts.title) + '</h3>' +
        '<p>' + opts.body + '</p>' +
        '<div class="row">' +
        (opts.cancel ? '<button class="secondary" id="mCancel">' + esc(opts.cancel) + '</button>' : '') +
        '<button class="primary" id="mOk">' + esc(opts.ok || t('ftue_got_it')) + '</button>' +
        '</div></div>'
      );
      var _dismissed = false;   // idempotent: a tap on a button bubbles to root too — fire once
      var okFn = function () { if (_dismissed) return; _dismissed = true; if (s().sound) A.buy(); hideModal(); if (opts.onOk) opts.onOk(); };
      var cancelFn = function () { if (_dismissed) return; _dismissed = true; hideModal(); if (opts.onCancel) opts.onCancel(); };
      $('mOk').onclick = okFn;
      if (opts.cancel) $('mCancel').onclick = cancelFn;
      var root = $('modalRoot');
      if (opts.cancel) {
        // A real CHOICE (has a Cancel) — only the backdrop dismisses (= cancel); the two
        // buttons carry the decision. Prevents an accidental tap from auto-confirming.
        root.onclick = function (e) { if (e.target === root) cancelFn(); };
      } else {
        // Pure INFO teach (no Cancel) — a tap ANYWHERE continues. The core verb of a clicker is
        // rapid tapping; a blocking modal that appears mid-burst used to EAT taps that landed on
        // its body (blind-test, measured: 40 taps -> 3 registered). Now the first such tap just
        // dismisses the teach and the rest reach the orb — robust at ANY tap speed (time-based
        // deferral can't help the slow CDP driver). The player can still pause and read it.
        root.onclick = function () { okFn(); };
      }
    });
  }

  // ====================================================================
  //  TAB MODEL: company(Lab) · upgrades(Hardware) · research(Model) · world · settings
  // ====================================================================
  var TABS = ['company', 'upgrades', 'research', 'world', 'settings'];
  var currentTab = 'company';
  var hwRefs = {};            // hardware list row refs (Hardware tab)
  var previewPrice = null;    // price slider live preview
  var tickerIdx = 0, tickerTimer = 0, _tickerDwell = 6, _tkShift = 0, _tkScrollT = 0, _tickerLang = '';

  // -------- static labels (i18n) for the persistent chrome --------
  function renderStatic() {
    document.documentElement.lang = I.getLang();
    $('brandName').textContent = s().companyName || t('game_title');
    $('brandIcon').innerHTML = ic('ic_insight');
    // orb (tap button)
    $('tapIcon').innerHTML = ic('ic_brain');
    $('tapLabel').textContent = t('tap_train');
    $('tapBtn').setAttribute('aria-label', t('tap_train'));
    // nav labels + icons
    var navMap = { company: ['nav_company', 'nav_company'], upgrades: ['nav_hardware', 'nav_upgrades'], research: ['nav_model', 'nav_research'], world: ['nav_world', 'nav_stats'] };
    var nav = $('tabbar').children;
    for (var i = 0; i < nav.length; i++) {
      var tab = nav[i].dataset.tab;
      if (tab && navMap[tab]) {
        var lbl = nav[i].querySelector('.tl'); if (lbl) lbl.textContent = t(navMap[tab][0]);
        var ti = nav[i].querySelector('.ti'); if (ti) ti.innerHTML = ic(navMap[tab][1]);
      }
    }
    var moreTi = $('navMoreBtn').querySelector('.ti'); if (moreTi) moreTi.innerHTML = ic('nav_settings');
    $('nav_more').textContent = t('nav_settings');
    $('nav_company').textContent = t('nav_company');
    $('nav_upgrades').textContent = t('nav_hardware');
    $('nav_research').textContent = t('nav_model');
    $('nav_world').textContent = t('nav_world');
    // reveal the Hardware/Model/World nav slots (no progressive lock in v2)
    setClass($('navUpgradesBtn'), 'hidden', false);
    setClass($('navResearchBtn'), 'hidden', false);
    setClass($('navWorldBtn'), 'hidden', false);
    // hide stripped chrome
    setClass($('trustHud'), 'hidden', true);
    setClass($('ticker'), 'hidden', false);
    setClass($('runwayBar'), 'hidden', true);
    setClass($('actBar'), 'hidden', true);
    setClass($('inboxBadge'), 'hidden', true);
    // model panel res-row labels
    setHTML($('rlCompute'), t('res_power'));
    setHTML($('rlShare'), t('res_share'));
    setHTML($('rlVal'), t('res_users'));
    $('modelTitle').textContent = t('model_title');
    // settings static
    renderSettingsStatic();
    // build dynamic lists that carry names
    buildHardware();
  }

  // ============================== HUD ==============================
  // income-trend tracking: a lagging reference + hysteresis so a FALLING income shows a clear
  // signal (↓) instead of "money silently disappearing" (blind review #3). Cosmetic only.
  var _incRef = null, _incFalling = false;
  function syncHud() {
    var st = s();
    // Pre-v1 anticipation: a breathing screen-edge glow (#v1Glow) that builds as you approach
    // the first model release. The element (#v1Glow) and its CSS hook existed but nothing ever
    // set --v1, so the glow never lit — drive it now from progress toward the power needed to
    // train v1, capped so it stays atmospheric. Off once v1 ships (the hook is pre-product).
    var v1g = $('v1Glow');
    if (v1g) {
      var v1p = 0;
      if (st.version < 1) { var v1req = G.powerReq(); if (v1req && isFinite(v1req) && v1req > 0) v1p = Math.min(1, G.availablePower() / v1req); }
      v1g.style.setProperty('--v1', (v1p * 0.7).toFixed(3));
    }
    var cashEl = $('cashVal');
    setText(cashEl, fmt(st.cash));
    hudPulse(cashEl, st.cash, 'hud-pulse-gold', 0.06, 600);
    // The number under the cash must match what the cash counter ACTUALLY does each
    // second. Costs (electricity/upkeep/salary) are billed WEEKLY (deferred — see tick:
    // they accrue, they are NOT subtracted from cash live), so second-to-second the cash
    // only rises by income. Showing netPerSec() here made cash visibly grow while the
    // ticker read "−$X/sec" (owner-reported bug). Show the live cash rate = income/sec;
    // the full income · costs · NET (incl. the deferred bill) stays in the finance line below.
    var net = G.incomePerSec();
    var rate = $('cpsVal');
    if (rate) {
      // TREND: compare live income to a lagging reference (~8s). Falling >8% → ↓ amber (with
      // hysteresis so it never flickers). Makes a dropping income a visible signal.
      if (_incRef == null || !isFinite(_incRef)) _incRef = net;
      if (!_incFalling && _incRef > 0.01 && net < _incRef * 0.92) _incFalling = true;
      else if (_incFalling && (net >= _incRef * 0.99 || net <= 0)) _incFalling = false;
      _incRef += (net - _incRef) * 0.004;   // lagging reference (cosmetic; frame-paced)
      var arrow = _incFalling ? '↓ ' : '';
      setText(rate, arrow + (net >= 0 ? '+' : '−') + '$' + fmt(Math.abs(net)) + '/' + ruS());
      setClass(rate, 'rate-neg', net < 0);
      setClass(rate, 'rate-pos', net >= 0);
      setClass(rate, 'rate-falling', _incFalling);
    }
    // day + finance line (always visible — owner's #1 rule)
    setClass($('financeWrap'), 'hidden', false);
    var d = G.dateLabel();
    setText($('dayLabel'), t('day_counter', { n: d.dayNum }));
    var inc = G.incomePerSec(), cost = G.costPerSec(), nm = (inc - cost);   // PER SECOND (owner: all incomes in /s, never /month)
    var fl = $('financeLine');
    if (fl) {
      var nmZero = Math.abs(nm) < 0.005;          // never render a "−$0.00" (negative zero) — blind review
      var sign = nmZero ? '' : (nm >= 0 ? '+' : '−');
      setHTML(fl,
        '<span class="fin-in">' + t('finance_income', { y: fmt(inc) }) + '</span>' +
        '<span class="fin-out"> · ' + (cost < 0.005 ? t('finance_costs_zero') : t('finance_costs', { x: fmt(cost) })) + '</span>' +
        '<span class="fin-net ' + (nm < -0.005 ? 'neg' : 'pos') + '"> · ' + t('finance_net', { sign: sign, z: fmt(nmZero ? 0 : Math.abs(nm)) }) + '</span>');
    }
    // pre-revenue hint until first release
    setClass($('preRevHint'), 'hidden', st.version >= 1);
    if (st.version < 1) setText($('preRevHint'), t('pre_revenue_hint'));
    // debt banner when in the red
    var debt = $('debtBanner');
    if (st.cash < 0 || st.overdue) {
      setClass(debt, 'hidden', false);
      setText($('debtBannerText'), st.overdue ? t('bill_overdue') : t('finance_runway_red'));
    } else setClass(debt, 'hidden', true);
  }

  // ---------------- market-share RACE feedback (item 1+2+3) ----------------
  // The race is the owner's central mechanic but used to be SILENT. We surface it three ways:
  //   1) rank-change toasts (overtake = good, overtaken = amber/bad), throttled to real changes;
  //   2) rival-move announcements interleaved into the satire ticker when a rival crosses a
  //      power "generation" threshold (scripted growth over game-days);
  //   3) a one-shot pulse on the player's standings row when the rank flips (reduced-motion safe).
  var _lastRank = null;             // player's last observed market rank (1-based); null = unseen
  var _pulseRank = false;           // request a standings-row pulse on next World render
  var _rivalGen = {};               // rival id -> last announced "generation" (power threshold tier)
  var _rivalGenInit = false;        // first pass just records the baseline (no spurious announces)
  var _tickerQ = [];                // pending rival-move ticker lines (interleaved with satire)

  // power -> coarse "generation" tier; a rival crossing into a new tier = a notable jump worth news
  function genOf(power) { return Math.floor(Math.log2(Math.max(1, power))); }

  function checkRace() {
    var st = s();
    // the race only matters once a model has shipped (version >= 1)
    if (st.version < 1) { _lastRank = null; return; }
    var rows = G.standings();
    var rank = 0, idx = 0;
    for (var i = 0; i < rows.length; i++) if (rows[i].isPlayer) { rank = i + 1; idx = i; break; }
    if (!rank) return;

    // ----- rival generation jumps -> ticker announcement (item 2) -----
    for (var j = 0; j < rows.length; j++) {
      var r = rows[j]; if (r.isPlayer) continue;
      var g = genOf(r.power);
      if (_rivalGen[r.id] === undefined) { _rivalGen[r.id] = g; continue; }
      if (g > _rivalGen[r.id]) {
        _rivalGen[r.id] = g;
        if (_rivalGenInit) {           // skip the very first tick (baseline only)
          var key = 'rival_move_' + r.id;
          if (_tickerQ.indexOf(key) < 0 && _tickerQ.length < 3) _tickerQ.push(key);
        }
      } else if (g < _rivalGen[r.id]) { _rivalGen[r.id] = g; }   // never announce regressions
    }
    _rivalGenInit = true;

    // ----- player rank change -> toast (item 1) + row pulse (item 3) -----
    if (_lastRank === null) { _lastRank = rank; return; }   // baseline, no toast on first sight
    if (rank < _lastRank) {
      // moved UP: the rival now directly BELOW the player is the one just overtaken
      var below = rows[idx + 1];
      var upName = below && !below.isPlayer ? t('rival_name_' + below.id) : '';
      toast(t('rank_up', { rival: upName, rank: rank }), 'good'); if (s().sound && A.milestone) A.milestone();
      _pulseRank = true;
    } else if (rank > _lastRank) {
      // dropped: the rival now directly ABOVE the player is the one who overtook
      var above = rows[idx - 1];
      var dnName = above && !above.isPlayer ? t('rival_name_' + above.id) : '';
      toast(t('rank_down', { rival: dnName, rank: rank }), 'bad');
      _pulseRank = true;
    }
    _lastRank = rank;
  }

  // ---------------- milestone celebrations ----------------
  // Frequent, satisfying positive feedback as the player grows. Fires ONCE per
  // threshold per run (persisted in state.milestones). On a loaded save / huge
  // offline jump we backfill silently (mark already-passed thresholds crossed
  // without celebrating) so a reload never dumps a burst of toasts.
  var MS_CASH = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10];
  // user counts are scaled to real headcounts (×1000): a model serves ~10k at v1 up to
  // a few million near the top, so milestones celebrate those magnitudes (not the old 1e3
  // which now fires instantly on first release).
  var MS_USERS = [1e4, 5e4, 2.5e5, 1e6, 3e6];
  var MS_SHARE = [0.5, 0.75];
  // "big" cash/users thresholds get the richer achievement sound + sparkle
  var MS_BIG_CASH = 1e6, MS_BIG_USERS = 1e6;
  var _msInit = false;            // first pass after load = silent backfill only
  var _msQ = [];                  // pending celebrations { msg, big }
  var _msNextAt = 0;              // performance.now() gate: at most one per ~1.5s

  // reset the in-session milestone tracker (called on new game / reset, since
  // reset() rebuilds state in-place without a page reload — a fresh run must
  // celebrate its early milestones rather than backfill them away).
  function resetMilestones() { _msInit = false; _msQ.length = 0; _msNextAt = 0; }

  function _msKey(kind, v) { return kind + '_' + v; }
  // record a threshold as crossed (idempotent, persisted)
  function _msMark(key) { var m = s().milestones || (s().milestones = {}); m[key] = 1; }
  function _msHas(key) { var m = s().milestones; return !!(m && m[key]); }

  function pumpMilestones() {
    if (!_msQ.length) return;
    var now = performance.now();
    if (now < _msNextAt) return;          // throttle: one celebration per ~1.5s
    var c = _msQ.shift();
    toast(c.msg, 'good');
    var st = s();
    if (st.sound) { if (c.big) { if (A.achievement) A.achievement(); } else if (A.milestone) A.milestone(); }
    // tiny sparkle near the top-center stat row (won't clutter the orb/controls)
    try { if (FX && FX.milestoneBurst) FX.milestoneBurst(window.innerWidth / 2, Math.min(120, window.innerHeight * 0.18)); } catch (e) {}
    _msNextAt = now + 1500;
  }

  function checkMilestones() {
    var st = s();
    if (!st.milestones) st.milestones = {};
    // collect every threshold currently satisfied (key -> {msg,big})
    var crossed = [];
    var i, v, key;
    for (i = 0; i < MS_CASH.length; i++) {
      v = MS_CASH[i]; if (st.cash >= v) { key = _msKey('cash', v); if (!_msHas(key)) crossed.push({ key: key, msg: t('ms_cash', { v: money(v) }), big: v >= MS_BIG_CASH }); }
    }
    for (i = 0; i < MS_USERS.length; i++) {
      v = MS_USERS[i]; if (st.users >= v) { key = _msKey('users', v); if (!_msHas(key)) crossed.push({ key: key, msg: t('ms_users', { v: fmt(v) }), big: v >= MS_BIG_USERS }); }
    }
    // market share only meaningful once a model has shipped
    if (st.version >= 1) {
      var sh = G.playerShare();
      for (i = 0; i < MS_SHARE.length; i++) {
        v = MS_SHARE[i]; if (sh >= v) { key = _msKey('share', v); if (!_msHas(key)) crossed.push({ key: key, msg: t('ms_share', { v: Math.round(v * 100) }), big: true }); }
      }
    }

    // FIRST pass after load: silently backfill so a loaded save / offline jump
    // never replays a burst of toasts. Mark everything crossed, celebrate nothing.
    if (!_msInit) { _msInit = true; for (i = 0; i < crossed.length; i++) _msMark(crossed[i].key); if (crossed.length) G.save(); return; }

    // don't intrude during the forced tutorial or while a cutscene is playing
    var busy = G.tutorialActive() || st.over || (window.GAME_CUTSCENE && window.GAME_CUTSCENE.isActive());

    if (crossed.length) {
      // crossed is already in natural ascending order (arrays ascending; cash→users→share)
      for (i = 0; i < crossed.length; i++) {
        _msMark(crossed[i].key);          // mark immediately so it never re-queues
        if (!busy) _msQ.push({ msg: crossed[i].msg, big: crossed[i].big });
      }
      G.save();
    }
    if (!busy) pumpMilestones();
  }

  // A long satire line used to clip with an "…" (two blind testers noticed the perpetual
  // truncation). Premium fix: when the current line overflows, scroll it like a real LIVE
  // ticker — hold the start, glide to reveal the tail, hold the end — instead of cutting it.
  // The scroll lives INSIDE #ticker's overflow:hidden (a transform — no page reflow / no
  // H-overflow), and the line dwells long enough to finish before the reel advances.
  function applyTickerScroll(tx) {
    if (!tx) return;
    setClass(tx, 'tk-scroll', false);
    tx.style.transform = ''; tx.style.animation = '';
    _tkShift = 0; _tkScrollT = 0;
    var reduce = false; try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    var over = tx.scrollWidth - tx.clientWidth;
    if (over > 6 && !reduce) {
      _tkShift = over + 10;                               // a touch past the end so the tail clears
      var dur = Math.min(13, Math.max(7, _tkShift / 28)); // ~28px/s reading pace, clamped
      _tickerDwell = dur + 1.4;                           // keep the line up until the scroll finishes
      setClass(tx, 'tk-scroll', true);                   // .tk-scroll gives text-overflow:clip
      tx.style.animation = 'none';                       // kill the CSS keyframe (its var(--tk-shift) transform
                                                         // never interpolated — left the text stuck/truncated);
                                                         // the scroll is now JS-driven (transform set per-frame below)
    } else {
      _tickerDwell = reduce ? 8 : 6;                     // reduced-motion: no scroll, but linger a touch longer to read
    }
  }
  function syncTicker(dt) {
    tickerTimer += dt || 0;
    var tx = $('tickerText');
    // JS-driven marquee: advance the scroll every frame. The earlier CSS keyframe with a
    // var(--tk-shift) transform never actually moved the text (blind-test: the LIVE headline
    // stayed truncated, never scrolling) — driving the transform from the game loop is reliable
    // and testable. Profile: hold the start, glide left to reveal the tail, hold the end.
    if (tx && _tkShift > 0) {
      _tkScrollT += dt || 0;
      var HOLD = 1.1, scrollDur = Math.max(0.1, _tickerDwell - HOLD * 2);
      var p = (_tkScrollT - HOLD) / scrollDur; p = p < 0 ? 0 : (p > 1 ? 1 : p);
      tx.style.transform = 'translateX(' + (-_tkShift * p).toFixed(1) + 'px)';
    }
    var list = (I.DICTS[I.getLang()] || {}).news_ticker || [];
    if (!list.length) return;
    // also re-pick immediately when the UI language changes, so a switch to EN/RU swaps the
    // ticker line at once instead of leaving the previous language up for the whole dwell.
    if (tickerTimer > _tickerDwell || (tx && tx.textContent === '') || I.getLang() !== _tickerLang) {
      tickerTimer = 0;
      var ico = $('ticker').querySelector('.tk-ico'); if (ico && !ico.__set) { ico.__set = 1; }
      // interleave a pending rival-move line if one is queued, else advance the satire reel
      if (_tickerQ.length) { setText(tx, t(_tickerQ.shift())); }
      else { tickerIdx = (tickerIdx + 1) % list.length; setText(tx, list[tickerIdx]); }
      _tickerLang = I.getLang();
      applyTickerScroll(tx);
    }
  }

  // ============================== TABS ==============================
  function switchTab(tab) {
    if (TABS.indexOf(tab) < 0) tab = 'company';
    // forced tutorial: only the tabs the current step needs are reachable.
    // buy-steps (laptop/server) also unlock the Hardware tab; click/upgrade stay on Company.
    var step = G.tutorialStep();
    if (step && !tutTabAllowed(step, tab)) { tutDeny(); return false; }   // blocked → tutDeny answers (toast+sfx); report no-switch so the caller skips the confirm chime
    currentTab = tab;
    var secs = document.querySelectorAll('#content .tab');
    for (var i = 0; i < secs.length; i++) setClass(secs[i], 'active', secs[i].dataset.tab === tab);
    var nav = $('tabbar').children;
    for (var j = 0; j < nav.length; j++) setClass(nav[j], 'active', nav[j].dataset.tab === tab);
    try { if (location.hash !== '#' + tab) location.hash = '#' + tab; } catch (e) {}
    if (tab === 'research') buildModelTab();
    if (tab === 'world') buildWorldTab();
    update();
    return true;
  }

  // overclock / разгон combo: reveal #comboWrap while heat>0, label "Разгон ×1.7",
  // fill #comboFill by heat. Reuses the existing combo CSS (#comboWrap.on toggles height).
  function syncCombo(st) {
    var wrap = $('comboWrap'); if (!wrap) return;
    var heat = st && st.heat > 0 ? (st.heat > 1 ? 1 : st.heat) : 0;
    // Light the orb's overclock glow. #tapBtn::after scales its ring/halo by var(--heat),
    // but nothing ever set --heat, so the heat ring was dormant — the orb never visibly
    // intensified as a combo built. Drive it now: fast-clicking makes the sphere glow hotter
    // (juice on the single most-tapped element; the CSS was already wired, we just feed it).
    var orb = $('tapBtn'); if (orb) orb.style.setProperty('--heat', heat.toFixed(3));
    var on = heat > 0.001;
    setClass(wrap, 'on', on);
    // Keep the label in the current language even while the chip is HIDDEN (heat=0): otherwise
    // it kept the last-active language's text and a switch to EN left a stale "Разгон" in the
    // DOM (blind-test: the only Cyrillic leftover in EN mode). comboMult is '×{m}' in both langs.
    setText($('comboName'), t('combo_name'));
    if (!on) { setStyleP($('comboFill'), 'width', '0%'); return; }
    var mult = G.comboMult();   // 1 .. 1.7
    setText($('comboMult'), t('combo_mult', { m: mult.toFixed(1) }));
    setStyleP($('comboFill'), 'width', (heat * 100).toFixed(0) + '%');
  }

  // ---------------------------------------------------------- LAB (company)
  function syncLab() {
    var st = s();
    // orb value + hint — use the BASE value (no разгон heat) so the displayed
    // "+$X" stays stable; the actual click GAIN still uses heat (разгон rewards more).
    setText($('tapValue'), '+$' + fmt(G.baseTapValue()));
    var hint = $('tapHint');
    if (!st.boughtLaptop) setText(hint, t('tap_hint_buy_laptop'));
    else if (st.training) setText(hint, t('train_click_faster'));
    else setText(hint, t('tap_hint_click'));
    setClass($('riskMini'), 'hidden', true);
    syncCombo(st);
    // FTUE (items 2–7): when the current step does NOT permit clicking the orb (the
    // 'laptop' step, and the buy-server phase of 'server'), the orb must read as locked
    // — no :active squash / press feedback when tapped. doTap() already denies the action
    // (cash unchanged + toast); this kills the visual press too. tutAllows('click') is the
    // single source of truth, so the orb is interactive exactly when the step permits it.
    setClass($('tapBtn'), 'tut-orb-lock', G.tutorialActive() && !tutAllows('click'));
    setClass($('breakthroughBtn'), 'hidden', true);
    setClass($('labOrbRow'), 'hidden', true);
    setClass($('prestigeCta'), 'hidden', true);
    setClass($('buyModeBar'), 'hidden', true);
    // click-upgrade button + forced-tutorial coachmark
    syncTapUpgrade();
    syncTutorial();
    // during the HARD-LOCK tutorial steps keep the focus tight: the model panel + bills
    // are not part of those steps, so hide them. On the SOFT 'release'/'price' steps the
    // model panel (train CTA + "Need X Power" readout) IS the target — keep it visible.
    var tutOn = G.tutorialHardLock();
    // Item 7: the train CTA / "Тренировать v1" model panel must NOT exist until the
    // player has enough Power to actually train (v1's powerReq, ≥6 early). Before that
    // the panel would tempt a disabled button + show "Need X Power" during the release
    // step — instead we hide the whole panel and the release coach points at BUYING
    // HARDWARE ("копи Мощность — покупай железо"). Once power ≥ req the panel appears and
    // the coach points at the train button. Only gate this pre-v1 (version 0): after the
    // first model ships the panel is the live model/training hub and must always show.
    var prePower = (st.version < 1) && (G.availablePower() < G.powerReq());
    setClass($('modelPanel'), 'hidden', tutOn || prePower);

    // --- model panel (reuse #modelPanel / #resRow / #trainBtn / #trainProg) ---
    var powEl = $('computeVal'), shEl = $('shareVal'), usEl = $('valVal');
    setText(powEl, fmt(G.availablePower()));
    setText($('computeRate'), '+' + fmt(G.rentPerSec()) + '/' + ruS());
    setText(shEl, pct1(G.currentShare()) + '%');   // REALISED share (eases with users), not the instant target — so it doesn't snap on a price change
    setText(usEl, uFmt(st.users));
    // pulse on a meaningful step (purchase / release / price change), not the drip
    hudPulse(powEl, G.availablePower(), 'hud-pulse-violet', 0.05, 600);
    hudPulse(shEl, G.currentShare(), 'hud-pulse-cyan', 0.10, 700);
    hudPulse(usEl, st.users, 'hud-pulse-cyan', 0.06, 600);
    var def = G.currentVersionDef();
    setText($('modelProg'), 'v' + st.version + ' / ' + (C.AGI_VERSION));

    var have = G.availablePower(), need = G.powerReq();
    var trainBtn = $('trainBtn'), trainProg = $('trainProg'), trainFill = $('trainFill'), trainHint = $('trainHint');
    if (def) {
      if (st.training) {
        setClass(trainProg, 'hidden', false);
        setStyleP(trainFill, 'width', (G.trainingProgress() * 100).toFixed(1) + '%');
        setText($('trainTimer'), t('train_time_left', { t: FMT.fmtTime(G.trainingTimeLeft()) }));
        setText(trainBtn, t('train_progress', { label: def.label, pct: Math.round(G.trainingProgress() * 100) }));
        trainBtn.disabled = true;
        setText(trainHint, t('train_click_faster'));
        setClass(trainHint, 'hidden', false);
      } else {
        setClass(trainProg, 'hidden', true);
        // When you can't train yet, the BUTTON ITSELF states the blocker (Need N Power…)
        // instead of a greyed "Train v1" that reads as a silent dead end (blind-playtest).
        if (G.canStartTraining()) {
          setText(trainBtn, t('train_start', { label: def.label }));
          trainBtn.disabled = false;
          // Show the payoff of releasing (owner): projected income of the model you'd ship —
          // far above renting the same gear. Per-month to match the finance line convention.
          var projPerSec = (G.projectedReleaseIncomePerSec ? G.projectedReleaseIncomePerSec() : 0);
          if (projPerSec > 0) { setText(trainHint, t('train_expect_income', { v: fmt(projPerSec) })); setClass(trainHint, 'hidden', false); }
          else { setClass(trainHint, 'hidden', true); }
        } else {
          setText(trainBtn, t('train_need_power', { req: fmt(need), label: def.label, have: fmt(have) }));
          trainBtn.disabled = true;
          setClass(trainHint, 'hidden', true);
        }
        // First-release onboarding: on a phone the Train button can sit below the fold /
        // behind the navbar, so a new player can't see the key progression action the
        // tutorial steers them to (blind-playtest blocker). When training FIRST becomes
        // available (version 0, on the Lab tab), gently scroll it into view — once, and
        // re-arm if power later drops below the requirement.
        if (st.version === 0 && currentTab === 'company') {
          if (G.canStartTraining()) {
            if (!trainBtn._autoScrolled) {
              trainBtn._autoScrolled = true;
              try { trainBtn.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
              catch (e) { try { trainBtn.scrollIntoView(); } catch (e2) {} }
            }
          } else { trainBtn._autoScrolled = false; }
        }
      }
    } else {
      setClass(trainProg, 'hidden', true);
      setText(trainBtn, t('go_win_title')); trainBtn.disabled = true;
      setClass(trainHint, 'hidden', true);
    }
    setClass($('fundingBtn'), 'hidden', true);
    setClass($('boostBtn'), 'hidden', true);
    // bills panel
    syncBills();
    // desktop-only company snapshot that fills the wide right column
    syncLabSummary();
  }

  // Company snapshot — fills the empty #genList area on wide screens so the Lab's
  // right column reads dense + intentional (the old design packed it). CSS hides it
  // below 720px, so mobile is untouched. Reuses .glass-panel / .res / rel-row styling.
  function syncLabSummary() {
    var st = s(), list = $('genList'); if (!list) return;
    // keep the forced tutorial focused: hide the advanced snapshot until free play
    setClass(list, 'hidden', G.tutorialActive());
    if (G.tutorialActive()) return;
    if (!list.__sumInit) {
      list.__sumInit = 1;
      list.innerHTML =
        '<div id="labSummary" class="glass-panel deskonly">' +
        '<div id="labSummaryHead"><span id="labSummaryTitle"></span></div>' +
        '<div id="resRowSum" class="sum-grid">' +
          sumTile('sm-power', 'rlSmPower') + sumTile('sm-users', 'rlSmUsers') +
          sumTile('sm-share', 'rlSmShare') + sumTile('sm-net', 'rlSmNet') +
          sumTile('sm-rigs', 'rlSmRigs') + sumTile('sm-rank', 'rlSmRank') +
        '</div>' +
        '<div id="labSummaryMeters"></div>' +
        '</div>';
    }
    setText($('labSummaryTitle'), t('lab_summary_title'));
    setText($('rlSmPower'), t('power_label')); setText($('rlSmUsers'), t('users_label'));
    setText($('rlSmShare'), t('share_label')); setText($('rlSmNet'), t('res_power') === 'Power' ? 'Net/' + ruS() : 'Итог/' + ruS());
    setText($('rlSmRigs'), t('summary_rigs')); setText($('rlSmRank'), t('summary_rank'));
    setText($('sm-power'), fmt(G.availablePower()));
    setText($('sm-users'), uFmt(st.users));
    setText($('sm-share'), pct1(G.currentShare()) + '%');
    var net = G.netPerSec(), nEl = $('sm-net');
    if (nEl) { nEl.textContent = (net >= 0 ? '+$' : '−$') + fmt(Math.abs(net)); setStyleP(nEl, 'color', net >= 0 ? 'var(--green)' : 'var(--rose)'); }
    var rigs = 0; C.HARDWARE.forEach(function (h) { rigs += st.committed[h.id]; });
    setText($('sm-rigs'), fmt(rigs));
    var rows = G.standings(), rank = 0; for (var i = 0; i < rows.length; i++) if (rows[i].isPlayer) { rank = i + 1; break; }
    setText($('sm-rank'), '#' + rank + ' / ' + rows.length);
    // three risk meters (reuse rel-row strip styling)
    syncMeterStrip('labSummaryMeters', [
      ['◆', t('meter_safety'), Math.round(st.safety) + '%', Math.round(st.safety), meterColor(Math.round(st.safety))],
      ['●', t('meter_approval'), Math.round(st.approval) + '%', Math.round(st.approval), meterColor(Math.round(st.approval))],
      ['▲', t('meter_legality'), Math.round(st.legality) + '%', Math.round(st.legality), meterColor(Math.round(st.legality))]
    ]);
  }
  function sumTile(valId, lblId) {
    return '<div class="res"><span class="rlabel" id="' + lblId + '"></span><span class="rval" id="' + valId + '"></span></div>';
  }

  // PRIMARY premises control — a prominent card at the TOP of the Hardware tab.
  // Servers consume m², so the player sees МЕСТО used/cap right where they buy hardware,
  // plus the move-up button. Reuses .glass-panel / rel-row meter strip / .btn-primary.
  function syncPremiseCard() {
    var card = $('premCard'); if (!card) return;
    var st = s();
    setText($('premCardTitle'), t('prem_card_title'));
    setText($('premCardName'), t('prem_name_' + st.premise));
    var used = G.ownedM2(), cap = G.capacityM2(), full = cap > 0 ? Math.min(100, used / cap * 100) : 0;
    syncMeterStrip('premCardSpace', [
      ['▦', t('prem_space_label'), fmt(used) + '/' + fmt(cap), +full.toFixed(1), 'var(--cyan)']
    ]);
    // legality + safety meters
    syncMeterStrip('premCardMeters', [
      ['▲', t('meter_legality'), Math.round(st.legality) + '%', Math.round(st.legality), meterColor(Math.round(st.legality))],
      ['◆', t('meter_safety'), Math.round(st.safety) + '%', Math.round(st.safety), meterColor(Math.round(st.safety))]
    ]);
    var np = G.nextPremise(), btn = $('premBuyBtn'), hint = $('premCardHint');
    if (np) {
      var add = np.m2 - cap;
      setText(hint, t('prem_card_hint', { add: fmt(add) }));
      setText(btn, t('prem_upgrade', { name: t('prem_name_' + np.id), c: fmt(np.cost) }) + ' · +' + fmt(add) + t('hw_m2'));
      btn.disabled = false; setClass(btn, 'cant-afford', !G.canBuyPremise(np.id));   // clickable when unaffordable so the tap answers (toast) instead of nothing
    } else {
      setText(hint, t('prem_card_hint_max'));
      setText(btn, t('prem_max'));
      btn.disabled = true; setClass(btn, 'cant-afford', false);   // at max: native-disabled, "MAX" text explains the no-op
    }
  }

  function syncBills() {
    var st = s(), panel = $('billsPanel');
    if (st.billDue <= 0 && st.version < 1) { setClass(panel, 'hidden', true); return; }
    setClass(panel, 'hidden', false);
    setText($('billsTitle'), t('bills_title'));
    var days = Math.ceil(G.nextBillIn() / C.DAY_SEC);
    var rows = '';
    if (st.billDue > 0) {
      rows += '<div class="bills-row' + (st.overdue ? ' urgent' : '') + '">' +
        '<span class="bills-icon">⚡</span>' +
        '<span class="bills-amt">' + money(st.billDue) + '</span>' +
        '<span class="bills-when muted small">' + (st.overdue ? t('bill_overdue') : t('bill_due', { v: fmt(st.billDue) }).split('—')[0]) + '</span>' +
        '<button class="bills-pay" id="payBillBtn">' + t('bills_pay_now') + '</button></div>';
      // CLEAR SPLIT (owner): how much of the outstanding bill is electricity vs tax.
      var elecPart = G.billElecOutstanding ? G.billElecOutstanding() : st.billDue;
      var taxPart = G.billTaxOutstanding ? G.billTaxOutstanding() : 0;
      var split = '<span class="bill-seg">⚡ ' + esc(t('bill_part_elec')) + ' ' + money(elecPart) + '</span>';
      if (taxPart > 0.005) split += '<span class="bill-seg">🧾 ' + esc(t('bill_part_tax')) + ' ' + money(taxPart) + '</span>';
      rows += '<div class="bills-split muted small">' + split + '</div>';
    }
    rows += '<div class="bills-row"><span class="bills-icon">🧾</span>' +
      '<span class="bills-amt">' + money(G.billForecast()) + '</span>' +
      '<span class="bills-when muted small">' + t('bill_next', { d: days, v: fmt(G.billForecast()) }).replace(/≈.*/, '') + '</span>' +
      '<span class="bills-paid muted small">' + (G.billCovered() ? t('bill_covered') : t('bill_uncovered')) + '</span></div>';
    setHTML($('billsList'), rows);
    var pb = $('payBillBtn');
    if (pb) pb.onclick = function () {
      // during the hard-lock onboarding only the current step's action is allowed —
      // no paying bills in the background.
      if (G.tutorialHardLock()) { tutDeny(); return; }
      if (G.payBill()) { if (st.sound) A.buy(); } else if (st.sound) A.error(); buzz(14); update();
    };
  }

  // ---------------------------------------------------------- HARDWARE (upgrades tab)
  // one icon per HARDWARE tier (26). The 12 generated glyphs are mapped across the ladder so the
  // visual escalates laptop -> rig -> rack -> cluster -> datacenter -> hyperscale (extras reuse the
  // nearest-scale glyph; out-of-range indices still fall back to gen_serverRack below).
  var HW_ICONS = [
    'gen_laptop', 'gen_serverRack',                                   // laptop, miniserver
    'gen_serverRack', 'gen_laptop', 'gen_serverRack', 'gen_gpuRig',   // nas, desktop, towerserver, gpurig
    'gen_serverRack', 'gen_gpuRig', 'gen_serverRack', 'gen_serverRack', // wallcab, wscluster, rack1u, rack2u
    'gen_gpuCluster', 'gen_serverRack', 'gen_serverRack', 'gen_gpuCluster', // blade, rack24u, rack42u, bladechassis
    'gen_gpuCluster', 'gen_gpuCluster', 'gen_superComp', 'gen_superComp',   // gpurack, airack48, dgxpod, superpod
    'gen_dataCenter', 'gen_dataCenter', 'gen_dataCenter', 'gen_neuroArray', // container, rackrow, serverhall, smalldc
    'gen_neuroArray', 'gen_quantumNode', 'gen_orbital', 'gen_orbital'       // modulardc, regionaldc, hyperscale, flagship
  ];
  function buildHardware() {
    var pane = $('upgradeList'); if (!pane) return;
    setText($('upgradesTitle'), t('hw_title'));
    setClass($('managersTitle'), 'hidden', true);
    setClass($('managerList'), 'hidden', true);
    setClass($('upgradeEmpty'), 'hidden', true);
    pane.innerHTML = ''; hwRefs = {};
    // intro line as a card-less hint at the top
    var introWrap = $('upgradesPane');
    // hardware rows
    C.HARDWARE.forEach(function (h, i) {
      var clsTier = i < 3 ? 'low' : (i < 6 ? 'mid' : 'high');
      var card = el('div', 'card');
      card.dataset.cls = clsTier;
      card.style.animationDelay = (Math.min(i, 12) * 30) + 'ms';
      card.innerHTML =
        '<div class="ownedBadge hidden">0</div>' +
        '<div class="iconwrap">' + ic(HW_ICONS[i] || 'gen_serverRack') + '</div>' +
        '<div class="info">' +
          '<div class="name">' + esc(t('hw_name_' + h.id)) + '</div>' +
          '<div class="desc"></div>' +
          '<div class="each"></div>' +
          // committed-to-model pill: makes "this gear is still here, now running
          // your AI" unmistakable (additive — does not replace the .each line)
          '<div class="hwCommit hidden"><span class="hwCommit-dot"></span><span class="hwCommit-txt"></span></div>' +
        '</div>' +
        '<div class="right">' +
          '<div class="cost">0</div>' +
          '<div class="buylabel"></div>' +
        '</div>';
      card.addEventListener('click', function (e) {
        if (!tutAllows('buyHw:' + h.id)) { tutDeny(); return; }
        if (G.buyHw(h.id)) {
          if (s().sound) A.buy(); buzz(12);
          FX.cardFlash(card);
          var r = card.getBoundingClientRect();
          FX.buyBurst(e.clientX || (r.left + r.width / 2), e.clientY || (r.top + r.height / 2));
          syncHardware(); syncHud();
          popBadge(hwRefs[h.id] && hwRefs[h.id].badge);  // owned-count pop (item 3)
        } else {
          // Tell the player WHY the buy didn't happen (no money vs no space) instead of
          // a silent no-op that reads as a dead button (blind-playtest finding).
          if (s().sound) A.error();
          toast(s().cash < G.hwCost(h.id) ? t('decision_cant_afford') : t('hw_no_space'), 'bad');
        }
      });
      pane.appendChild(card);
      hwRefs[h.id] = { el: card, cost: card.querySelector('.cost'), desc: card.querySelector('.desc'), each: card.querySelector('.each'), buylabel: card.querySelector('.buylabel'), badge: card.querySelector('.ownedBadge'), commit: card.querySelector('.hwCommit'), commitTxt: card.querySelector('.hwCommit-txt') };
    });
  }
  function syncHardware() {
    var st = s(), tut = G.tutorialStep();
    // Hide the premises card only during the HARD-LOCK onboarding steps (laptop/click/
    // upgrade/server), where a single action owns the screen. From the soft steps
    // (release/price) onward it's visible — that's exactly when the player is told to
    // "buy hardware to accumulate Power", so they see their garage (5 m²) + the
    // move-up-premises path right where they shop. Returns fully at free play.
    var premHidden = G.tutorialHardLock();
    setClass($('premCard'), 'hidden', premHidden);
    if (!premHidden) syncPremiseCard();
    setText($('upgradesTitle'), t('hw_title') + ' · ' + t('prem_capacity', { used: fmt(G.ownedM2()), cap: fmt(G.capacityM2()) }));
    C.HARDWARE.forEach(function (h) {
      var r = hwRefs[h.id]; if (!r) return;
      var idle = st.hw[h.id], comm = st.committed[h.id], own = idle + comm;
      var afford = st.cash >= h.cost, space = G.freeM2() >= h.m2, can = G.canBuyHw(h.id);
      // forced tutorial: only the current step's item is permitted; dim everything else
      var allowed = tutAllows('buyHw:' + h.id);
      // Item 9: the free starter "Старый ноут" (laptop, no rent) only belongs in the list
      // for the very first 'laptop' tutorial step (which points at it to buy). Once owned
      // it has served its purpose — hide its card from the buy list thereafter so it
      // doesn't sit there cluttering. (own counts idle+committed laptops.)
      if (h.id === 'laptop' && (st.boughtLaptop || own >= 1) && tut !== 'laptop') {
        setClass(r.el, 'hidden', true);
        return;
      }
      setClass(r.el, 'hidden', false);
      // Item 8: HIGHLIGHT (gold tutorial glow / affordable accent) only when the item is
      // genuinely buyable — canBuyHw(id) === enough cash AND fits m². An item you can't
      // afford must read as locked, never highlighted.
      var isTarget = !!tut && allowed && can;   // the single item the tutorial points at
      setText(r.desc, t('hw_power') + ' +' + fmt(h.power) + ' · ' + (h.rent > 0 ? t('hw_rent') + ' $' + fmt(h.rent) + '/' + ruS() : t('hw_no_rent')) + ' · ' + fmt(h.m2) + t('hw_m2'));
      var ownTxt = [];
      if (idle > 0) ownTxt.push(t('hw_owned', { n: idle }));
      if (comm > 0) ownTxt.push(t('hw_committed', { n: comm }));
      setText(r.each, ownTxt.join(' · '));
      // committed pill: unmistakable "still here, now powering your model ×N"
      if (r.commit) {
        setClass(r.commit, 'hidden', comm <= 0);
        setClass(r.el, 'committed', comm > 0);
        if (comm > 0 && r.commitTxt) setText(r.commitTxt, t('hw_powering', { n: comm }));
      }
      setText(r.cost, !space ? t('hw_no_space') : ('$' + fmt(h.cost)));
      setClass(r.cost, 'cant', !can);
      setText(r.buylabel, t('hw_buy'));
      setClass(r.badge, 'hidden', own <= 0);
      if (own > 0) setText(r.badge, own);
      setClass(r.el, 'affordable', can && allowed);
      setClass(r.el, 'locked', !allowed || (!can && own === 0));
      // tutorial: block + dim non-target rows, glow the target
      setClass(r.el, 'tut-blocked', !!tut && !allowed);
      setClass(r.el, 'tut-hi', isTarget);
    });
  }

  // ---------------------------------------------------------- MODEL (research tab) — price slider hero
  function buildModelTab() {
    var pane = $('researchPane'); if (!pane) return;
    pane.innerHTML = '';
    var st = s();
    if (st.version < 1) {
      var def = G.currentVersionDef();
      var pre = el('div', 'glass-panel');
      pre.innerHTML =
        '<h2 style="margin-top:0">' + t('model_title') + '</h2>' +
        '<p class="muted small" style="line-height:1.5">' + t('price_intro') + '</p>' +
        '<p class="muted small" style="margin-top:10px">' + (st.training
          ? t('train_progress', { label: def ? def.label : 'v1', pct: Math.round(G.trainingProgress() * 100) })
          : t('train_need_power', { req: fmt(G.powerReq()), label: def ? def.label : 'v1', have: fmt(G.availablePower()) })) + '</p>';
      pane.appendChild(pre);
      // Power-aware label: while training show progress, when ready show "Train v1".
      var goTraining = !!st.training;
      var go = el('button', 'btn-primary', goTraining
        ? t('train_progress', { label: def ? def.label : 'v1', pct: Math.round(G.trainingProgress() * 100) })
        : t('train_start', { label: def ? def.label : 'v1' }));
      go.onclick = function () {
        // Blind-playtest #1 (critical): this Model-tab button is labelled identically to the
        // real #trainBtn but used to ALWAYS bounce to the Lab with a "need Power" toast — even
        // when Power was already sufficient — so the core action read as broken. Now it is the
        // SAME action: if Power is ready it actually starts training here; only when Power is
        // genuinely short do we explain WHY we send the player to the Lab to build it.
        if (G.tutorialHardLock()) { tutDeny(); return; }
        if (s().training) { switchTab('company'); return; }   // already training → go watch the bar
        if (G.canStartTraining() && G.startTraining()) {
          if (s().sound) A.breakthrough();
          switchTab('company');   // live progress bar lives in #modelPanel on the Lab tab
          update();
          return;
        }
        try { if (s().sound) A.error(); } catch (e) {}
        toast(t('train_need_power', { req: fmt(G.powerReq()), have: fmt(G.availablePower()), label: def ? def.label : 'v1' }), 'bad');
        switchTab('company');
      };
      pre.appendChild(go);
      return;
    }
    // price panel (reuse .glass-panel + #resRow tiles + .vol-slider)
    var pb = el('div', 'glass-panel');
    pb.innerHTML =
      '<h2 style="margin-top:0">' + t('price_title') + '</h2>' +
      '<div id="priceVal" style="font-family:var(--font-display);font-weight:800;font-size:26px;color:var(--gold);text-align:center;text-shadow:0 0 18px var(--glow-gold)"></div>' +
      '<input id="priceSlider" class="vol-slider" type="range" min="' + C.ECON.priceMin + '" max="' + C.ECON.priceMax + '" step="0.25" style="width:100%;margin:12px 0 4px" />' +
      '<div id="resRowPv" style="display:flex;gap:8px;margin-top:12px">' +
        pvTile(t('share_label'), 'pv-share') + pvTile(t('users_label'), 'pv-users') +
        pvTile(I.getLang() === 'ru' ? '≈ Прибыль/с' : '≈ Profit/s', 'pv-profit') + pvTile(t('meter_approval'), 'pv-appr') +
      '</div>' +
      '<div id="priceCooldown" class="muted small hidden" style="text-align:center;margin-top:10px"></div>';
    pane.appendChild(pb);
    // (sweet-spot hints removed — the player finds the best price from the live readouts.)
    // Price is a strategic commitment: applying a new one is rate-limited to once per real
    // minute. You can still DRAG to preview projections; on release a locked change reverts.

    var slider = $('priceSlider');
    slider.value = st.price;
    slider.addEventListener('input', function () { previewPrice = parseFloat(slider.value); syncPricePreview(); });
    slider.addEventListener('change', function () {
      var applied = G.setPrice(parseFloat(slider.value));
      if (!applied) {
        // on cooldown → revert, keep current price. Blind-test: a SILENT revert + beep read
        // as "the slider is broken" — say WHY (the once-per-minute price lock + seconds left).
        slider.value = s().price; if (s().sound) A.error();
        var cdLeft = G.priceCooldownLeft ? Math.ceil(G.priceCooldownLeft()) : 0;
        if (cdLeft > 0) toast(t('price_locked', { s: cdLeft }), 'bad');
      }
      else if (s().sound) A.buy();
      previewPrice = null; syncPricePreview();
    });

    // live model card
    var mc = el('div', 'card');
    mc.style.cursor = 'default';
    mc.innerHTML =
      '<div class="iconwrap">' + ic('ic_brain') + '</div>' +
      '<div class="info"><div class="name" id="modelVer"></div><div class="desc" id="modelStats" style="white-space:normal"></div></div>';
    pane.appendChild(mc);
    syncPricePreview();
  }
  function pvTile(k, id) {
    return '<div class="res" style="align-items:center;text-align:center;gap:4px;padding:8px 5px"><span class="rlabel" style="white-space:normal;line-height:1.2;min-height:22px;display:flex;align-items:center">' + esc(k) + '</span><span class="rval" id="' + id + '" style="font-size:14px"></span></div>';
  }
  function syncPricePreview() {
    var st = s(); if (st.version < 1 || !$('priceSlider')) return;
    var p = (previewPrice != null) ? previewPrice : st.price;
    setText($('priceVal'), '$' + p.toFixed(2));
    var net = G.rentPerSec() + G.revenuePreview(p) - G.costPerSec();   // full projected net (incl. idle rent) so it matches the finance line's "итог" basis at equilibrium
    setText($('pv-share'), pct1(G.share(p)) + '%');
    // Users tile is a PROJECTION at the selected price — distinct from the model card's
    // CURRENT users. Show the direction vs current so dragging the slider reads as
    // "this price grows / shrinks my audience" (the core pricing skill), not a second
    // confusing headcount. At equilibrium (target ≈ current) it just shows the number.
    var uTgt = G.usersTarget(p), uCur = st.users, uEl = $('pv-users');
    if (uEl) {
      var uRel = uCur > 0 ? uTgt / uCur : 1;
      if (uRel > 1.05) { uEl.textContent = '↑ ' + uFmt(uTgt); uEl.style.color = 'var(--green)'; }
      else if (uRel < 0.95) { uEl.textContent = '↓ ' + uFmt(uTgt); uEl.style.color = 'var(--rose)'; }
      else { uEl.textContent = uFmt(uTgt); uEl.style.color = ''; }
    }
    // Projected net PER SECOND (incl. idle rent) — same unit/basis as the finance line and
    // the cps ticker, so it equals the finance net at equilibrium; right after a price change
    // the live finance line just catches up to this forecast as the audience adjusts.
    var pf = $('pv-profit');   // PER SECOND (owner: all incomes in /s, never /month)
    if (pf) { pf.textContent = (net >= 0 ? '+' : '−') + '$' + fmt(Math.abs(net)); pf.style.color = net >= 0 ? 'var(--green)' : 'var(--rose)'; }
    var sweet = G.sweetSpotPrice(), ratio = sweet > 0 ? p / sweet : 1, arrow, col;
    if (ratio > C.RISK.gougeStartRatio) { arrow = t('approval_down'); col = 'var(--rose)'; }
    else if (ratio < 0.9) { arrow = t('approval_up'); col = 'var(--green)'; }
    else { arrow = t('approval_flat'); col = 'var(--cyan)'; }
    var pa = $('pv-appr'); if (pa) { pa.textContent = arrow; pa.style.color = col; }
    // (no "sweet spot" line/badge/glow — the player reads share/users/profit/approval and
    //  finds the best price themselves. The approval arrow above is a natural consequence,
    //  not a pointer to the answer.)
    // price control state: a free-edit window right after a change (adjust freely), then a
    // once-per-minute lock. Show the grace hint first (positive), then the lock countdown.
    var cdEl = $('priceCooldown');
    var cd = G.priceCooldownLeft ? G.priceCooldownLeft() : 0;
    var gr = G.priceGraceLeft ? G.priceGraceLeft() : 0;
    if (cdEl) {
      if (gr > 0.5) { setText(cdEl, t('price_grace', { s: Math.ceil(gr) })); setClass(cdEl, 'hidden', false); }
      else if (cd > 0.5) { setText(cdEl, t('price_locked', { s: Math.ceil(cd) })); setClass(cdEl, 'hidden', false); }
      else setClass(cdEl, 'hidden', true);
    }
  }
  function syncModelTab() {
    var st = s(); if (st.version < 1 || !$('priceSlider')) return;
    var sl = $('priceSlider');
    if (previewPrice == null && document.activeElement !== sl) sl.value = st.price;
    syncPricePreview();
    var def = C.VERSIONS[st.version - 1];
    setText($('modelVer'), t('model_live', { label: def ? def.label : ('v' + st.version) }));
    setText($('modelStats'), t('power_label') + ' ' + fmt(G.power()) + ' · ' + t('users_label') + ' ' + uFmt(st.users) + ' · ' + t('share_label') + ' ' + pct1(G.currentShare()) + '%');
  }

  // ---------------------------------------------------------- WORLD (rivals + meters + staff)
  function buildWorldTab() {
    setClass($('worldLocked'), 'hidden', true);
    setClass($('relMetersPanel'), 'hidden', false);
    setClass($('finaleBanner'), 'hidden', true);
    setText($('relMetersTitle'), t('meters_title'));
    // standings header
    setText($('standingsTitle'), t('standings_title'));
    setClass($('acquireBtn'), 'hidden', true);
    setClass($('raceOpenBtn'), 'hidden', true);
    setText($('worldNewsTitle'), t('staff_title'));
    setClass($('newsFlavorTitle'), 'hidden', true);
    setHTML($('newsFlavor'), '');
    // build staff hire rows into #cardList (under the "Team" header)
    var cl = $('cardList');
    if (!cl.__staffInit) {
      cl.__staffInit = 1; cl.innerHTML = '';
      C.STAFF.forEach(function (st2) {
        var card = el('div', 'card');
        card.innerHTML =
          '<div class="iconwrap">' + (ic('ic_' + st2.id) || ic('ic_manager')) + '</div>' +
          '<div class="info"><div class="name" id="staffname-' + st2.id + '">' + esc(t('staff_name_' + st2.id)) + '</div><div class="desc" id="staffdesc-' + st2.id + '"></div></div>' +
          '<div class="right"><button class="minibtn" id="staffhire-' + st2.id + '"></button></div>';
        cl.appendChild(card);
      });
      C.STAFF.forEach(function (st2) {
        var b = document.getElementById('staffhire-' + st2.id);
        if (b) b.onclick = function () {
          if (G.hire(st2.id)) {
            if (s().sound) A.hireDone();
            // juice the hire/level-up (meaningful investment toward lvl 10) — mirror the
            // hardware-purchase feedback: card flash + a burst at the button (фил pillar).
            try { var card = b.closest('.card'); if (card) FX.cardFlash(card); var r = b.getBoundingClientRect(); FX.buyBurst(r.left + r.width / 2, r.top + r.height / 2); } catch (e) {}
          } else { toast(t('decision_cant_afford'), 'bad', { routine: true }); if (s().sound) A.error(); }   // unaffordable tap now answers (toast+error sfx) instead of nothing
          buzz(10); syncWorldTab(); syncHud();
        };
      });
    }
    syncWorldTab();
  }
  function meterColor(v) { return v < 30 ? 'var(--rose)' : (v < 60 ? 'var(--gold)' : 'var(--green)'); }

  // Persistent rel-row meter strip. Builds the rows ONCE per container (keyed on the
  // row signature), then only updates fill width / value text / color on the existing
  // nodes — so the CSS `.rel-fill { transition: width }` actually EASES between values
  // instead of being thrown away and re-created at the target width on every change.
  // meters: array of [icon, name, valueText, fillPct(0..100), color]
  function syncMeterStrip(id, meters) {
    var box = $(id); if (!box) return;
    var sig = id + '|' + meters.map(function (m) { return m[0] + m[1]; }).join('~');
    if (box.__msig !== sig) {
      box.__msig = sig;
      var html = '';
      for (var i = 0; i < meters.length; i++) {
        html += '<div class="rel-row" style="cursor:default"><span class="rel-ic">' + meters[i][0] + '</span>' +
          '<span class="rel-name">' + esc(meters[i][1]) + '</span>' +
          '<span class="rel-bar"><span class="rel-fill"></span></span>' +
          '<span class="rel-val"></span></div>';
      }
      box.innerHTML = html;
      box.__rows = box.querySelectorAll('.rel-row');
    }
    var rows = box.__rows;
    for (var j = 0; j < meters.length && j < rows.length; j++) {
      var m = meters[j], f = rows[j].querySelector('.rel-fill'), v = rows[j].querySelector('.rel-val');
      setStyleP(f, 'width', m[3] + '%');
      setStyleP(f, 'background', m[4]);
      setText(v, m[2]);
      setStyleP(v, 'color', m[4]);
    }
  }
  function syncWorldTab() {
    var st = s();
    // standings rows (.standrow). Persistent rows keyed by rival id, positioned by
    // CSS `order` = current rank, so the .sbar width EASES (transition: width) between
    // frames instead of being thrown away and re-created at the target width.
    var rows = G.standings(), youRank = 0;
    // "Market position" is a SHARE board, not raw Power: sort by market value (v) and show
    // each company's % of the total market (owner: standings must read in percent).
    rows.sort(function (a, b) { return (b.v || 0) - (a.v || 0); });
    var totalV = 0; for (var _tv = 0; _tv < rows.length; _tv++) totalV += (rows[_tv].v || 0);
    totalV = Math.max(1e-9, totalV);
    var box = $('standingsRows');
    if (box && !box.__rowmap) {
      box.__rowmap = {};
      var sig = rows.map(function (r) { return r.id; }).sort().join(',');
      var html = '';
      for (var k = 0; k < rows.length; k++) {
        html += '<div class="standrow" data-rid="' + rows[k].id + '">' +
          '<span class="srank"></span><span class="sname"></span>' +
          '<span class="sbarwrap"><span class="sbar"></span></span>' +
          '<span class="sshare"></span></div>';
      }
      box.innerHTML = html;
      var nodes = box.querySelectorAll('.standrow');
      for (var n = 0; n < nodes.length; n++) box.__rowmap[nodes[n].getAttribute('data-rid')] = nodes[n];
    }
    rows.forEach(function (r, i) {
      if (r.isPlayer) youRank = i;
      var name = r.isPlayer ? t('standings_you') : t('rival_name_' + r.id);
      var shareFrac = (r.v || 0) / totalV;
      var w = Math.max(3, Math.min(100, shareFrac * 100));
      var row = box && box.__rowmap ? box.__rowmap[r.id] : null;
      if (!row) return;
      setStyleP(row, 'order', i);
      setClass(row, 'you', r.isPlayer);
      setClass(row, 'lead', i === 0);
      setText(row.querySelector('.srank'), '' + (i + 1));
      setText(row.querySelector('.sname'), name);
      setStyleP(row.querySelector('.sbar'), 'width', w.toFixed(0) + '%');
      setText(row.querySelector('.sshare'), pct1(shareFrac) + '%');
      // one-shot pulse on the player's row when their rank just changed (item 3)
      if (r.isPlayer && _pulseRank) { row.classList.remove('rank-flip'); void row.offsetWidth; row.classList.add('rank-flip'); }
    });
    _pulseRank = false;   // pulse is one-shot — consumed by this render
    // race status
    var leaderDays = G.agiLeaderDays(), msg, scol;
    if (youRank === 0) { msg = t('race_ahead'); scol = 'var(--green)'; }
    else if (youRank === rows.length - 1) { msg = t('race_behind'); scol = 'var(--rose)'; }
    else { msg = t('race_close'); scol = 'var(--gold)'; }
    // (removed the confusing "Singularity ≈ {time}" leader-ETA line per owner — it read as meaningless)
    var _raceHtml = '<span style="color:' + scol + '">' + esc(msg) + '</span>';
    // narrative identity from the choices made so far (decisions shape who you are)
    var _pathKey = (window.GAME_STORY && window.GAME_STORY.currentPath) ? window.GAME_STORY.currentPath(st.storyFlags) : null;
    if (_pathKey) _raceHtml += '<br><span class="muted small">' + esc(t('your_path')) + ': <span style="color:var(--violet-2)">' + esc(t('path_' + _pathKey)) + '</span></span>';
    // MARKET-CAPTURE goal: once you're a serious lab, surface the second victory path. Show
    // live progress while you're holding the dominant share, or a hint when you're close.
    if (G.captureEligible && G.captureEligible()) {
      var capProg = G.captureProgress ? G.captureProgress() : 0;
      var curShare = G.currentShare ? G.currentShare() : 0;
      if (capProg > 0) {
        _raceHtml += '<br><span class="small" style="color:var(--gold)">' + esc(t('capture_progress', { p: Math.round(capProg * 100) })) + '</span>';
      } else if (curShare >= 0.75) {
        _raceHtml += '<br><span class="muted small">' + esc(t('capture_hint')) + '</span>';
      }
    }
    setHTML($('agiRace'), _raceHtml);
    setText($('standingsStatus'), youRank === 0 ? t('standings_status_lead') : (youRank === rows.length - 1 ? t('standings_status_behind') : t('standings_status_close')));
    // 3 risk meters (rel-row strip)
    syncMeterStrip('relMeters', [
      ['◆', t('meter_safety'), Math.round(st.safety) + '%', Math.round(st.safety), meterColor(Math.round(st.safety))],
      ['●', t('meter_approval'), Math.round(st.approval) + '%', Math.round(st.approval), meterColor(Math.round(st.approval))],
      ['▲', t('meter_legality'), Math.round(st.legality) + '%', Math.round(st.legality), meterColor(Math.round(st.legality))]
    ]);
    // staff rows
    C.STAFF.forEach(function (st2) {
      var d = document.getElementById('staffdesc-' + st2.id); if (!d) return;
      // staff ROW is built once (cl.__staffInit) so the role title was frozen in whatever
      // language was active at first World-tab visit — a switch to EN left "Юрист" etc.
      // (blind-test). Refresh the title here each sync so it always matches the UI language.
      setText($('staffname-' + st2.id), t('staff_name_' + st2.id));
      var lvl = G.staffLevel(st2.id);
      var base = t('staff_desc_' + st2.id);
      if (lvl >= 1) {
        if (st2.effect === 'tax') {
          base += ' · ' + t('staff_lvl', { n: lvl }) + ' (−' + Math.round(lvl * C.STAFF_CFG.taxPerLevel * 100) + '%)';
        } else {
          base += ' · ' + t('staff_lvl', { n: lvl }) + ' (+' + G.levelEffect(lvl) + ')';
        }
      }
      d.textContent = base;
      var b = document.getElementById('staffhire-' + st2.id);
      if (b) {
        // Keep hire/upgrade buttons CLICKABLE even when unaffordable — a native :disabled
        // button swallows the tap, so an out-of-money player got ZERO feedback (read as
        // "broken"). Grey them via .cant-afford instead; the onclick answers with a toast.
        // maxLevel stays natively disabled (its "MAX" text already explains the no-op).
        if (lvl >= C.STAFF_CFG.maxLevel) { b.textContent = t('staff_max'); b.disabled = true; setClass(b, 'cant-afford', false); }
        else if (lvl >= 1) { b.textContent = t('staff_upgrade', { n: lvl + 1, c: fmt(G.staffHireCost(st2.id)) }); b.disabled = false; setClass(b, 'cant-afford', !G.canHire(st2.id)); }
        else { b.textContent = t('staff_hire', { c: fmt(G.staffHireCost(st2.id)) }); b.disabled = false; setClass(b, 'cant-afford', !G.canHire(st2.id)); }
      }
    });
  }

  // ---------------------------------------------------------- SETTINGS
  function renderSettingsStatic() {
    if (!$('settingsTitle')) return;
    setText($('settingsTitle'), t('settings_title'));
    setText($('companyNameLabel'), t('company_name'));
    setText($('companyNameSave'), t('rename_save'));
    setText($('langLabel'), t('lang_label'));
    setText($('soundLabel'), t('sound_label'));
    if ($('sfxVolLabel')) setText($('sfxVolLabel'), t('sfx_volume'));
    setText($('musicLabel'), t('music_label'));
    if ($('musicVolLabel')) setText($('musicVolLabel'), t('music_volume'));
    setText($('hapticsLabel'), t('haptics'));
    setText($('adBoostLabel'), t('ad_boost'));
    setText($('adCashLabel'), t('ad_cash'));
    setText($('adBoostBtn'), t('ad_boost'));
    setText($('adCashBtn'), t('ad_cash'));
    var sg = $('soundSeg').children; sg[0].textContent = t('on'); sg[1].textContent = t('off');
    var mg = $('musicSeg').children; mg[0].textContent = t('on'); mg[1].textContent = t('off');
    var hg = $('hapticsSeg').children; hg[0].textContent = t('on'); hg[1].textContent = t('off');
    // hide cosmetics rows (no v2 cosmetics) but keep section minimal
    setText($('cosmeticsTitle'), t('cosmetics_title'));
    setClass($('cosmeticsTitle'), 'hidden', true);
    var cosRows = document.querySelectorAll('.cos-row'); for (var i = 0; i < cosRows.length; i++) setClass(cosRows[i], 'hidden', true);
    setText($('saveBtn'), t('save_now'));
    if ($('backupTitle')) setText($('backupTitle'), t('backup_title'));
    if ($('backupHint')) setText($('backupHint'), t('backup_hint'));
    if ($('exportBtn')) setClass($('exportBtn'), 'hidden', true);
    if ($('importBtn')) setClass($('importBtn'), 'hidden', true);
    if ($('backupTitle')) setClass($('backupTitle'), 'hidden', true);
    if ($('backupHint')) setClass($('backupHint'), 'hidden', true);
    setText($('resetBtn'), t('reset_progress'));
    setText($('creditsTxt'), t('credits'));
    setText($('versionTxt'), t('version', { v: '2.0' }));
    var cni = $('companyNameInput'); if (cni && document.activeElement !== cni) cni.value = s().companyName || '';
    syncSettingsState();
  }
  function syncSettingsState() {
    var st = s();
    function seg(group, val) {
      var nodes = document.querySelectorAll('[data-' + group + ']');
      for (var i = 0; i < nodes.length; i++) setClass(nodes[i], 'on', nodes[i].getAttribute('data-' + group) === val);
    }
    seg('lang', I.getLang());
    seg('sound', st.sound ? 'on' : 'off');
    seg('music', st.music ? 'on' : 'off');
    seg('haptics', st.haptics ? 'on' : 'off');
    var sv = $('sfxVol'); if (sv && document.activeElement !== sv) sv.value = Math.round((st.sfxVol || 0) * 100);
    if ($('sfxVolPct')) $('sfxVolPct').textContent = Math.round((st.sfxVol || 0) * 100) + '%';
    var mv = $('musicVol'); if (mv && document.activeElement !== mv) mv.value = Math.round((st.musicVol || 0) * 100);
    if ($('musicVolPct')) $('musicVolPct').textContent = Math.round((st.musicVol || 0) * 100) + '%';
    // company-name input always reflects the live name (unless the player is mid-edit)
    var cni = $('companyNameInput'); if (cni && document.activeElement !== cni) cni.value = st.companyName || '';
  }
  function wireSettings() {
    function on(sel, fn) { var n = document.querySelectorAll(sel); for (var i = 0; i < n.length; i++) (function (b) { b.onclick = function () { fn(b); }; })(n[i]); }
    on('[data-lang]', function (b) { I.setLang(b.getAttribute('data-lang')); s().lang = I.getLang(); document.documentElement.lang = I.getLang(); G.save(); renderStatic(); rebuildActive(); update(); });
    on('[data-sound]', function (b) { s().sound = b.getAttribute('data-sound') === 'on'; A.setEnabled(s().sound); if (s().sound) A.buy(); G.save(); syncSettingsState(); });
    on('[data-music]', function (b) { s().music = b.getAttribute('data-music') === 'on'; if (M) { M.setEnabled(s().music); if (s().music) M.start(); else M.stop(); } G.save(); syncSettingsState(); });
    on('[data-haptics]', function (b) { s().haptics = b.getAttribute('data-haptics') === 'on'; if (s().haptics) buzz(10); G.save(); syncSettingsState(); });
    var sv = $('sfxVol'); if (sv) sv.oninput = function () { s().sfxVol = sv.value / 100; A.setVolume(s().sfxVol); syncSettingsState(); G.save(); };
    var mv = $('musicVol'); if (mv) mv.oninput = function () { s().musicVol = mv.value / 100; if (M && M.setVolume) M.setVolume(s().musicVol); syncSettingsState(); G.save(); };
    var save = $('companyNameSave'); if (save) save.onclick = function () { var v = ($('companyNameInput').value || '').trim().slice(0, 24); if (v) s().companyName = v; renderStatic(); if (s().sound) A.buy(); G.save(); };
    var sb = $('saveBtn'); if (sb) sb.onclick = function () { G.save(); toast(t('save_now'), 'good', { routine: true }); };
    var rb = $('resetBtn'); if (rb) rb.onclick = function () { teachModal({ title: t('reset_progress'), body: t('reset_confirm'), ok: t('confirm_reset'), cancel: t('cancel_x'), onOk: function () { G.reset(); previewPrice = null; resetMilestones(); renderStatic(); switchTab('company'); } }); };
    // mute ad buttons (no SDK on web)
    var ab = $('adBoostBtn'); if (ab) ab.onclick = function () { toast(t('ad_boost'), '', { routine: true }); };
    var ac = $('adCashBtn'); if (ac) ac.onclick = function () { toast(t('ad_cash'), '', { routine: true }); };
  }

  // ============================== ENDING ==============================
  function showEnding(outcome) {
    var monopoly = outcome === 'monopoly';
    var st = s(), win = outcome === 'agi' || monopoly;
    var go = $('gameOverScreen'); if (!go) return;
    // STORY: on the Singularity win, branch the ending by the accumulated story flags +
    // the pivotal autonomy choice. Each variant has its own title/flavor/punch
    // (go_win_<variant>_*). The MONOPOLY win is its own dedicated ending (market dominance,
    // not the Singularity), so it bypasses the variant system.
    var variant = null;
    if (outcome === 'agi' && window.GAME_STORY) {
      try { variant = window.GAME_STORY.endingVariant(st.storyFlags || {}, st); } catch (e) { variant = null; }
      if (variant === 'default') variant = null;
    }
    var winBase = monopoly ? 'go_monopoly' : (variant ? ('go_win_' + variant) : 'go_win');
    var title = t(win ? (winBase + '_title') : ('go_' + outcome + '_title'));
    var flavor = t(win ? (winBase + '_flavor') : ('go_' + outcome + '_flavor'));
    var ver = (win && !monopoly) ? t('term_singularity') : ('v' + st.version);
    setText($('goTitle'), title);
    $('goTitle').style.color = win ? 'var(--gold)' : 'var(--rose)';
    setText($('goCompany'), st.companyName || t('game_title'));
    setText($('goFlavor'), flavor);
    setHTML($('goSummary'),
      '<div class="statItem"><span>' + t('go_stat_version') + '</span><span>' + ver + '</span></div>' +
      '<div class="statItem"><span>' + t('go_stat_day') + '</span><span>' + G.dayNumber() + '</span></div>' +
      '<div class="statItem"><span>' + t('go_stat_users') + '</span><span>' + uFmt(st.users) + '</span></div>' +
      '<div class="statItem"><span>' + t('go_stat_share') + '</span><span>' + pct1(G.playerShare()) + '%</span></div>');
    var punchKey = win ? (monopoly ? 'go_monopoly_punch' : (variant ? ('go_win_' + variant + '_punch') : 'go_punch_win')) : 'go_punch_lose';
    setText($('goPunch'), t(punchKey, { day: G.dayNumber(), ver: ver, users: uFmt(st.users), share: pct1(G.playerShare()) }));
    setText($('goBrag'), t('go_brag'));
    setText($('goNewGame'), t('go_new_game'));
    setClass($('goStats'), 'hidden', true);
    $('goNewGame').onclick = function () { setClass(go, 'hidden', true); G.reset(); previewPrice = null; resetMilestones(); renderStatic(); switchTab('company'); };
    setClass(go, 'hidden', false);
    if (win) {
      if (st.sound) A.singularity();
      // The Singularity win gets its climactic AGI cutscene (branches on how safely you got
      // there). The MARKET-CAPTURE win is a different victory (you cornered the market, not the
      // Singularity) → a gold ritual flash, not the AGI narrative.
      if (!monopoly && window.GAME_CUTSCENE) window.GAME_CUTSCENE.agiVictory({ safe: st.safety >= 60, variant: variant });
      else FX.ritual({ title: title, subtitle: flavor, kind: 'singularity' });
    }
    else { FX.incident(); if (st.sound) A.incident(); }
  }

  // A SERVED LAWSUIT → a choice with stakes (settle / fight in court / bury it). Reuses the
  // decision card. Fighting's odds rise with your lawyer level (shown). Non-dismissable: the
  // player must answer (mirrors the decision modal).
  function showLawsuitModal(fine, winChance) {
    var wc = Math.round((winChance != null ? winChance : (G.lawsuitWinChance ? G.lawsuitWinChance() : 0.5)) * 100);
    var opts = [
      // the law_* templates already carry a leading "$" before {v}, so pass RAW fmt() (not
      // money(), which adds its own "$") — otherwise the fine renders as "$$40" (blind-test).
      { id: 'settle', label: t('law_settle_label'), hint: t('law_settle_hint', { v: fmt(fine) }) },
      { id: 'fight',  label: t('law_fight_label'),  hint: t('law_fight_hint', { v: fmt(Math.round(fine * 0.4)), p: wc }) },
      { id: 'bury',   label: t('law_bury_label'),   hint: t('law_bury_hint', { v: fmt(Math.round(fine * 0.3)) }) }
    ];
    queueModal(function () {
      var btns = '';
      for (var i = 0; i < opts.length; i++) {
        btns += '<button class="decision-opt" data-choice="' + esc(opts[i].id) + '">' +
          '<span class="decision-opt-label">' + esc(opts[i].label) + '</span>' +
          '<span class="decision-opt-hint">' + esc(opts[i].hint) + '</span></button>';
      }
      showModal(
        '<div class="decision">' +
        '<div class="decision-tag">' + esc(t('law_eyebrow')) + '</div>' +
        '<div class="decision-icon">' + ic('ic_risk') + '</div>' +
        '<h3>' + esc(t('ev_lawsuit_title')) + '</h3>' +
        '<p class="decision-body">' + esc(t('law_body', { v: fmt(fine) })) + '</p>' +
        '<div class="decision-opts">' + btns + '</div></div>'
      );
      var nodes = document.querySelectorAll('#modalRoot .decision-opt');
      for (var j = 0; j < nodes.length; j++) {
        (function (node) {
          node.onclick = function () {
            var choice = node.getAttribute('data-choice');
            if (s().sound) A.buy();
            var res = G.resolveLawsuit(choice);
            hideModal(); G.save(); renderStatic(); update();
            if (res) {
              if (res.choice === 'fight') toast(res.won ? t('law_won') : t('law_lost'), res.won ? 'good' : 'bad');
              else if (res.choice === 'bury') toast(t('law_buried'), 'bad');
              else toast(t('law_settled'), 'routine');
            }
          };
        })(nodes[j]);
      }
    });
  }

  // ============================== EVENT WIRING ==============================
  var FTUE = {
    rent: { title: 'ftue_rent_title', body: 'ftue_rent_body' },
    'meter:safety': { title: 'ftue_meter_title', body: 'ftue_meter_safety_body' },
    'meter:approval': { title: 'ftue_meter_title', body: 'ftue_meter_approval_body' },
    'meter:legality': { title: 'ftue_meter_title', body: 'ftue_meter_legality_body' }
  };
  function wireGameEvents() {
    G.on('ftue', function (tag) {
      var f = FTUE[tag]; if (!f) return;
      var k = tag.indexOf('meter:') === 0 ? 'meter' : tag, st = s();
      if (st.ftue[k]) return; st.ftue[k] = 1; G.save();   // persist NOW so a reload before autosave can't replay the teach
      var show = function () { teachModal({ icon: ic('ic_insight'), title: t(f.title), body: t(f.body) }); };
      // Blind-test (×2): the 'rent' (passive-income) teach fires on the first rent TICK,
      // which is the same instant the mini-server purchase advances the tutorial and pops
      // the freedom teach — two modals back-to-back ("Понятно" wall). Defer the rent teach
      // a few seconds so it lands ALONE, after the freedom modal is dismissed and rent is
      // visibly ticking in. (Strictly ≥ current behaviour: queueModal already serialises;
      // this only adds breathing room.) Flag is already set above, so it fires exactly once.
      if (tag === 'rent') { setTimeout(show, 4500); return; }
      show();
    });
    G.on('release', function (v) {
      if (s().sound) A.release ? A.release() : A.breakthrough();
      var def = C.VERSIONS[v - 1];
      FX.celebrate(window.innerWidth / 2, window.innerHeight / 2, def ? def.label : ('v' + v), v >= 3);
      // STORY: a brief one-beat flourish the FIRST time a model ships — "the world noticed".
      // Clean climax handoff: play the cinematic FIRST, then land on the Model tab and
      // show the price instruction IN CONTEXT (next to the slider) — instead of stacking
      // the teach modal over the Lab before the tab even switches.
      var firstReleaseTeach = function () {
        switchTab('research');
        if (!s().ftue.release) { s().ftue.release = 1; G.save(); teachModal({ icon: ic('ic_brain'), title: t('ftue_release_title'), body: t('ftue_release_body') }); }   // blind-test: this teach replayed after a browser reload — persist the flag immediately
      };
      if (!s().seenFirstModel && window.GAME_CUTSCENE) {
        s().seenFirstModel = true; G.save();
        window.GAME_CUTSCENE.firstModel(firstReleaseTeach);
      } else if (!s().ftue.release) {
        firstReleaseTeach();
      }
      renderStatic(); update();
    });
    G.on('bill', function (amount) { if (amount > 0 && !s().ftue.bill) { s().ftue.bill = 1; G.save(); teachModal({ icon: ic('ic_cash'), title: t('ftue_bill_title'), body: t('ftue_bill_body') }); } });
    G.on('event', function (e) {
      if (!e) return;
      if (e.type === 'fireWarn') toast(t('ev_fire_warn', { v: Math.round(e.safety) }), 'bad');
      else if (e.type === 'lawWarn') toast(t('ev_law_warn', { v: Math.round(e.legality) }), 'bad');
      else if (e.type === 'boardWarn') toast(t('ev_board_warn'), 'bad');
      else if (e.type === 'fire') { teachModal({ icon: ic('ic_risk'), title: t('ev_fire_title'), body: t('ev_fire_body', { n: e.lostUnits }) }); FX.incident(); if (s().sound) A.incident(); }
      else if (e.type === 'lawsuit') { showLawsuitModal(e.fine, e.winChance); FX.incident(); if (s().sound) A.incident(); }
      else if (e.type === 'boardConvene') teachModal({ icon: ic('ic_insight'), title: t('ev_board_convene_title'), body: t('ev_board_convene_body') });
      else if (e.type === 'priceNudge') {
        toast(t('ev_price_nudge'), 'bad', { routine: true });
        // draw the eye to the Model tab where the price slider lives
        var rb = $('navResearchBtn'); if (rb) { setClass(rb, 'nav-glow', true); setTimeout(function () { setClass(rb, 'nav-glow', false); }, 4000); }
      }
    });
    G.on('gameover', function (outcome) { showEnding(outcome); });
    G.on('tutorial', function (step) {
      // sound cue when a tutorial step is completed (entering a new step or finishing)
      if (s().sound) { try { A.buy(); } catch (e) {} }
      // right after buying the laptop: one-time teach about the start (garage + laptop + premises)
      if (step === 'click') {
        // remember the click count at the moment we enter the click step, so Phase A/B
        // is driven by clicks-SINCE-entering (robust across saves), not lifetime clicks.
        _clickStepBase = (s().clicks | 0);
        if (!s().ftue.start) {
          s().ftue.start = 1;
          teachModal({ icon: ic('ic_insight'), title: t('ftue_start_title'), body: t('ftue_start_body') });
        }
        // NOTE: the "what a click represents" teach (ftue.clickwhy) is NOT fired here — it used
        // to STACK on top of ftue.start (blind review: a wall of modals before the first click).
        // It's now deferred to fire after a few real clicks (see doTap), so teaches are spread
        // across actions instead of stacked.
      }
      // Entering the first SOFT step: teach ONCE that the leash is off, then leave the
      // player free (no persistent coach). The owner wanted breathing room here.
      if (step === 'release' && !s().ftue.freedom) {
        s().ftue.freedom = 1;
        teachModal({ icon: ic('ic_brain'), title: t('ftue_freedom_title'), body: t('ftue_freedom_body') });
      }
      if (!step) {                       // onboarding complete -> unlock everything
        clearTutorialChrome();
        renderStatic();
      }
      G.save();
      update();
    });
  }

  // ============================== FORCED TUTORIAL ("потное обучение") ==============================
  // Step-gated onboarding. During a step ONLY the current action is permitted; everything
  // else is dimmed/blocked. Reuses #nudge as a premium coachmark + toasts for gentle denials.
  var TUT_PROMPT = { laptop: 'tut_buy_laptop', click: 'tut_click', upgrade: 'tut_upgrade', server: 'tut_miniserver' };
  var TUT_STEPKEY = { laptop: 'tut_step_laptop', click: 'tut_step_click', upgrade: 'tut_step_upgrade', server: 'tut_step_server' };
  // which tabs each step may visit (buy-steps need the Hardware list)
  function tutTabAllowed(step, tab) {
    if (tab === 'company') return true;                 // home is always reachable
    if ((step === 'laptop' || step === 'server') && tab === 'upgrades') return true;
    // SOFT steps are free play — don't fence the player in. 'release' needs Hardware
    // (buy gear to accumulate Power) and Lab (train); 'price' needs the Model screen.
    if (step === 'release' || step === 'price') return true;
    return false;
  }
  // what each step lets you do (anything not listed is blocked)
  function tutAllows(action) {
    var step = G.tutorialStep();
    if (!step) return true;                 // tutorial done -> free play
    switch (step) {
      case 'laptop':  return action === 'buyHw:laptop';
      case 'click':   return action === 'click';
      // 'upgrade' step: ONLY the click-upgrade button. The player reaches this step
      // already holding enough cash for the upgrade (the 'click' step advances on
      // affordability and nothing can drain cash here), so locking the orb can't
      // trap them — it just keeps the single onboarding action in focus.
      case 'upgrade': return action === 'upgradeTap';
      case 'server':
        // PHASE-AWARE (items 2–7): while still EARNING toward the mini-server, clicking
        // the orb IS the action. Once the player can afford it, the coach switches to
        // "open Hardware / buy the server" — so the orb (and click-upgrade) must DENY
        // there, leaving the single buy action in focus. buyHw:miniserver is always
        // permitted (it's the goal of the step).
        if (action === 'buyHw:miniserver') return true;
        if (action === 'click' || action === 'upgradeTap') {
          var st = s();
          return st.cash < G.hwCost('miniserver');   // earn phase only
        }
        return false;
    }
    return true;
  }
  function tutDeny() {
    var step = G.tutorialStep(); if (!step) return;
    var k = TUT_STEPKEY[step];
    if (s().sound) A.error(); buzz(10);
    toast(t('tut_locked_step', { step: k ? t(k) : '' }), '', { routine: true });
  }
  function tutOnUpgraded() { /* engine advances 'upgrade'->'server'; render picks it up */ }
  // render the coachmark (reuse #nudge) pointing at the current step
  function syncTutorial() {
    var step = G.tutorialStep(), nudge = $('nudge');
    if (!nudge) return;
    if (!step) { setClass(nudge, 'hidden', true); setClass(nudge, 'go', false); clearTutorialChrome(); return; }
    // Item 7 (layering): the floating .ftue-coach overlay is now the single guidance UI.
    // The legacy inline #nudge banner duplicated the same prompt INSIDE #labMain and
    // overlapped/cluttered the release coach ("overlapping ugly"). Keep it hidden during
    // the forced tutorial — the coach overlay carries the message — while we still drive
    // the bottom-nav blocking below.
    setClass(nudge, 'hidden', true);
    setClass(nudge, 'go', true);
    var ni = nudge.querySelector('.nicon'); if (ni && !ni.__set) { ni.__set = 1; ni.innerHTML = ic('ic_insight'); }
    setText($('nudgeText'), t(TUT_PROMPT[step] || 'tut_buy_laptop'));
    // block bottom-nav tabs the current step can't visit (Hardware stays live on buy-steps)
    var nav = $('tabbar').children;
    for (var i = 0; i < nav.length; i++) {
      var b = nav[i], tabId = b.dataset.more ? 'settings' : b.dataset.tab;
      setClass(b, 'tut-blocked', !tutTabAllowed(step, tabId));
    }
  }
  function clearTutorialChrome() {
    var nav = $('tabbar').children;
    for (var i = 0; i < nav.length; i++) setClass(nav[i], 'tut-blocked', false);
    // drop the coach's HUD treatments when onboarding ends
    var cb = $('cashBox'); if (cb) { setClass(cb, 'ftue-lift', false); setClass(cb, 'ftue-goal-glow', false); }
  }

  // ============================== CINEMATIC GUIDED FTUE COACHMARK ==============================
  // A premium, hand-holding overlay that LEADS the player through the first steps:
  // dims everything but the one target, casts a glowing spotlight on it, and floats
  // a cutscene-styled instruction card with a bouncing arrow pointing exactly at it.
  // It NEVER swallows input (the cutout area is click-through) so the forced tutorial
  // still drives the real action — this is pure guidance chrome, fully additive.
  var _coach = null;          // { root, spot, card, title, body, arrow, hint }
  var _coachRO = null;        // reposition hook (resize/scroll)
  var _clickStepBase = 0;     // clicks counter when the 'click' step was entered (Phase A/B pivot)
  var _redlined = false;      // overclock combo at max — fire the redline payoff once per climb
  var _clickwhyTimer = null;  // deferred "why a click earns" teach — fires after the tap-burst settles
  var _lastTapMs = 0;         // wall-clock of the last orb tap — teach modals defer while a burst is active
  function showClickWhy() {
    _clickwhyTimer = null;
    if (s().over) return;     // context moved on (game ended) — skip the early-game lore
    teachModal({ icon: ic('ic_cash'), title: t('ftue_clickwhy_title'), body: t('ftue_clickwhy_body') });
  }
  var _coachRectCache = null; // { key, rect } — stable target rect, only recomputed on layout change
  function buildCoach() {
    if (_coach) return _coach;
    var root = el('div', 'ftue-coach hidden');
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="ftue-spot"></div>' +
      '<div class="ftue-arrow"></div>' +
      '<div class="ftue-card">' +
        '<div class="ftue-ic"></div>' +
        '<div class="ftue-tt"></div>' +
        '<div class="ftue-bd"></div>' +
        '<div class="ftue-hint"></div>' +
      '</div>';
    document.body.appendChild(root);
    _coach = {
      root: root,
      spot: root.querySelector('.ftue-spot'),
      arrow: root.querySelector('.ftue-arrow'),
      card: root.querySelector('.ftue-card'),
      ic: root.querySelector('.ftue-ic'),
      title: root.querySelector('.ftue-tt'),
      body: root.querySelector('.ftue-bd'),
      hint: root.querySelector('.ftue-hint')
    };
    if (!_coachRO) {
      // resize/scroll genuinely move the target — invalidate the cached rect so it
      // re-measures. (Plain per-click renders do NOT, so the coach never jitters.)
      _coachRO = function () { _coachRectCache = null; try { syncFtueCoach(); } catch (e) {} };
      window.addEventListener('resize', _coachRO);
      window.addEventListener('scroll', _coachRO, true);
    }
    return _coach;
  }
  // what each step points at: { target, dir('up'|'down'), title, body, hint, icon }
  function coachPlan(step) {
    var onHw = currentTab === 'upgrades';
    if (step === 'laptop') {
      if (!onHw) return { sel: '#navUpgradesBtn', dir: 'up', title: 'ftue_goto_hw_title', body: 'ftue_goto_hw_body', hint: 'ftue_goto_hw_arrow', icon: 'gen_laptop' };
      return { node: (hwRefs.laptop && hwRefs.laptop.el), dir: 'down', title: 'ftue_laptop_title', body: 'ftue_laptop_body', hint: 'ftue_laptop_arrow', icon: 'gen_laptop' };
    }
    if (step === 'click') {
      // after buying the laptop you may still be on Hardware — guide back to the Lab
      if (currentTab !== 'company') return { sel: '#tabbar button[data-tab="company"]', dir: 'up', title: 'ftue_click_title', body: 'ftue_click_body', hint: 'ftue_click_arrow', icon: 'ic_brain', light: true };
      // LIGHT coach on the orb — it's the obvious huge central element, so no full dim.
      // Phase A (just entered, few clicks): teach the action — "Click here!" + arrow.
      // Phase B (after ~2-3 clicks): point at the goal — live $cur/$goal toward the
      //   upgrade, with the HUD balance highlighted so progress is obvious.
      var goal = G.tapUpgradeCost(), cur = s().cash;
      var clicks = (s().clicks | 0) - (_clickStepBase | 0);
      if (clicks >= 2) {
        return { sel: '#tapBtn', dir: 'down', icon: 'ic_cash', light: true, hudGlow: true,
          title: 'ftue_click_goal_title', body: 'ftue_click_goal_body', hint: 'ftue_click_goal_hint',
          vars: { goal: fmt(goal), cur: fmt(Math.min(cur, goal)) } };
      }
      return { sel: '#tapBtn', dir: 'down', title: 'ftue_click_title', body: 'ftue_click_body', hint: 'ftue_click_arrow', icon: 'ic_brain', light: true };
    }
    if (step === 'upgrade') {
      if (currentTab !== 'company') return { sel: '#tabbar button[data-tab="company"]', dir: 'up', title: 'ftue_upgrade_title', body: 'ftue_upgrade_body', hint: 'ftue_upgrade_arrow', icon: 'ic_cash', light: true };
      // upgrade button is already on-screen + obvious — light coach, no heavy dim.
      return { sel: '#tapUpgradeBtn', dir: 'down', title: 'ftue_upgrade_title', body: 'ftue_upgrade_body', hint: 'ftue_upgrade_arrow', icon: 'ic_cash', light: true };
    }
    if (step === 'server') {
      // Phase A: not enough cash for the mini-server yet — DON'T tell them to buy it.
      // Send them back to the orb (Lab) with a live $cur/$goal toward the price, same
      // as the click step. Only once they can afford it do we point at Hardware to buy.
      var srvCost = G.hwCost('miniserver'), srvCash = s().cash;
      if (srvCash < srvCost) {
        if (currentTab !== 'company') return { sel: '#tabbar button[data-tab="company"]', dir: 'up', title: 'ftue_server_earn_title', body: 'ftue_server_earn_body', hint: 'ftue_click_arrow', icon: 'ic_cash', light: true, vars: { goal: fmt(srvCost) } };
        return { sel: '#tapBtn', dir: 'down', icon: 'ic_cash', light: true, hudGlow: true,
          title: 'ftue_server_earn_title', body: 'ftue_server_earn_body', hint: 'ftue_click_goal_hint',
          vars: { goal: fmt(srvCost), cur: fmt(Math.min(srvCash, srvCost)) } };
      }
      if (!onHw) return { sel: '#navUpgradesBtn', dir: 'up', title: 'ftue_goto_hw_title', body: 'ftue_goto_hw_server_body', hint: 'ftue_goto_hw_arrow', icon: 'gen_serverRack' };
      return { node: (hwRefs.miniserver && hwRefs.miniserver.el), dir: 'down', title: 'ftue_server_title', body: 'ftue_server_body', hint: 'ftue_server_arrow', icon: 'gen_serverRack' };
    }
    // SOFT steps (release / price) are FREE PLAY — the owner wants room to breathe in the
    // gaps between the guided stages. We do NOT render a persistent coach here (the glowing
    // "Копи Мощность" overlay nagged and got in the way). Instead each soft step teaches
    // ONCE on entry (see the G.on('tutorial') handler) and then leaves the player alone;
    // a single gentle toast fires when Power is finally enough to ship. No coach overlay.
    if (step === 'release' || step === 'price') return null;
    return null;
  }
  // STABLE rect for the coach target. CSS transforms (e.g. the orb's .squash scale on
  // every click) change getBoundingClientRect(), which would make the spotlight/arrow
  // re-snap and jitter. offsetWidth/offsetHeight return the UNTRANSFORMED layout size,
  // and a centered scale keeps the visual center fixed — so we reconstruct the stable
  // layout box from the current center ± half the layout size. The result is cached per
  // target+step and only invalidated on real layout changes (resize/scroll/step/tab), so
  // per-click renders reuse it verbatim and the coach stays perfectly still.
  function coachHide() { if (_coach) { setClass(_coach.root, 'hidden', true); _coach.root.style.pointerEvents = ''; _coach.root.onclick = null; } liftCashBox(false); hudGoalGlow(false); }
  function stableRect(target, key) {
    if (_coachRectCache && _coachRectCache.key === key) return _coachRectCache.rect;
    var r = target.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    var lw = target.offsetWidth || r.width, lh = target.offsetHeight || r.height;
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var rect = { left: cx - lw / 2, top: cy - lh / 2, width: lw, height: lh };
    _coachRectCache = { key: key, rect: rect };
    return rect;
  }
  // raise #cashBox above the coach dim so the money balance is ALWAYS visible during
  // the tutorial (even on the dimmed BUY steps), per owner intent.
  function liftCashBox(on) { var cb = $('cashBox'); if (cb) setClass(cb, 'ftue-lift', !!on); }
  // Phase B: subtly highlight the HUD balance so the player watches it grow.
  function hudGoalGlow(on) { var cb = $('cashBox'); if (cb) setClass(cb, 'ftue-goal-glow', !!on); }
  function syncFtueCoach() {
    var step = G.tutorialStep();
    // hide while a cutscene or any modal (naming/teach) is up — they own the screen
    var blocked = !step ||
      (window.GAME_CUTSCENE && window.GAME_CUTSCENE.isActive()) ||
      !$('modalRoot').classList.contains('hidden');
    if (blocked) { coachHide(); return; }
    var plan = coachPlan(step);
    if (!plan) { coachHide(); return; }
    var target = plan.node || (plan.sel && document.querySelector(plan.sel));
    if (!target) { coachHide(); return; }
    // cache key changes whenever the chosen target changes (step + selector/dir + tab)
    var rkey = step + '|' + (plan.sel || 'node') + '|' + plan.dir + '|' + currentTab;
    var r = stableRect(target, rkey);
    if (!r) { coachHide(); return; }
    // money balance is always visible during the whole tutorial; Phase B also glows it.
    liftCashBox(true);
    hudGoalGlow(!!plan.hudGlow);
    var c = buildCoach();
    setClass(c.root, 'coach-light', !!plan.light);
    var vw = window.innerWidth, vh = window.innerHeight;
    // spotlight: a rounded ring exactly over the target; CSS box-shadow dims the rest.
    // Item 11 (alignment): build the padded box SYMMETRICALLY around the target and snap
    // every edge to whole pixels, so the ring stays centered on its button at 390 and
    // never drifts. Earlier the left/top were clamped to 0 WITHOUT shrinking width, which
    // pushed the ring off-center near a screen edge, and sub-pixel left/top made it read
    // crooked. We round the target box first, then expand by pad on every side, then clamp
    // to the viewport while preserving the centered geometry.
    var pad = 8;
    var rl = Math.round(r.left), rt = Math.round(r.top);
    var rw = Math.round(r.width), rh = Math.round(r.height);
    var sx = rl - pad, sy = rt - pad, sw = rw + pad * 2, sh = rh + pad * 2;
    // clamp to viewport while keeping the box hugging the target (shrink, don't shift off)
    if (sx < 0) { sw += sx; sx = 0; }
    if (sy < 0) { sh += sy; sy = 0; }
    if (sx + sw > vw) sw = vw - sx;
    var cxv = rl + rw / 2;
    // Decide which side the card sits on by where the target lives. Targets in the
    // lower 45% of the frame (nav bar, low cards) → card ABOVE, arrow points DOWN.
    // Targets higher up → card BELOW, arrow points UP. This keeps the arrow on-screen
    // and always pointing INTO the target regardless of the plan's nominal dir.
    var below = (r.top + r.height / 2) > vh * 0.55;
    setClass(c.root, 'hidden', false);
    setClass(c.root, 'coach-up', !below);
    setClass(c.root, 'coach-down', below);
    c.spot.style.left = sx + 'px'; c.spot.style.top = sy + 'px';
    c.spot.style.width = sw + 'px'; c.spot.style.height = sh + 'px';
    // Item 11b: the highlight ring must HUG the target's shape, not be a fixed rounded
    // rectangle. A round orb got a square-ish ring (read as crooked); a button got a ring
    // with the wrong corner radius. Mirror the target's own border-radius (circle → circle).
    var _br = '', _rpx = 0;
    try { _br = window.getComputedStyle(target).borderRadius || ''; _rpx = parseFloat(_br) || 0; } catch (e) {}
    var _circular = _br.indexOf('50%') >= 0 || (_rpx > 0 && _rpx >= Math.min(rw, rh) / 2 - 1);
    c.spot.style.borderRadius = _circular ? '50%' : (Math.min(_rpx, 24) + pad) + 'px';
    // content first (so the card can be measured for height)
    c.ic.innerHTML = ic(plan.icon || 'ic_insight');
    setText(c.title, t(plan.title, plan.vars));
    setText(c.body, t(plan.body, plan.vars));
    setText(c.hint, t(plan.hint, plan.vars));
    // Make the guidance PERFORM the highlighted action on tap. Two modes:
    //  • FULL-DIM steps (buy/nav, a single forced action; plan.light is falsy): 4+ blind
    //    testers tapped the highlighted CTA, landed in the dark DEAD dim between the card and
    //    the spotlight, and the action "felt broken". Make the WHOLE overlay capture taps so
    //    ANY tap performs the one allowed action. Safe — these steps are single-tap, and a
    //    forced step wants every tap funnelled to that action anyway.
    //  • LIGHT steps (orb click / click-upgrade): keep the overlay click-THROUGH so the orb's
    //    fast pointerdown path still fires for rapid tapping; only the instruction card is the
    //    tappable shortcut (the original v101 behaviour).
    var doAction = function () { try { if (target && typeof target.click === 'function') target.click(); } catch (e) {} };
    if (!plan.light) {
      c.root.style.pointerEvents = 'auto';
      c.root.onclick = doAction;
      setClass(c.card, 'ftue-actionable', false);   // root captures every tap → avoid double-fire
      c.card.onclick = null;
    } else {
      c.root.style.pointerEvents = '';              // revert to CSS default (none) → orb stays directly tappable
      c.root.onclick = null;
      setClass(c.card, 'ftue-actionable', true);
      c.card.onclick = doAction;
    }
    var cw = Math.min(360, vw - 28);
    c.card.style.width = cw + 'px';
    var clx = Math.min(Math.max(14, cxv - cw / 2), vw - cw - 14);
    c.card.style.left = Math.round(clx) + 'px';
    c.card.style.top = ''; c.card.style.bottom = '';
    var aw = 46, ah = 46;
    c.arrow.style.left = Math.round(cxv - aw / 2) + 'px';
    if (below) {
      // card ABOVE target, arrow between them pointing DOWN
      c.arrow.innerHTML = ic('ic_arrow_down');
      var arrowTop = Math.max(8, sy - ah - 4);
      c.arrow.style.top = Math.round(arrowTop) + 'px';
      c.card.style.bottom = Math.round(vh - (arrowTop - 8)) + 'px';
    } else {
      // card BELOW target, arrow between them pointing UP
      c.arrow.innerHTML = ic('ic_arrow_up');
      var arrowTop2 = Math.min(vh - ah - 8, sy + sh + 4);
      c.arrow.style.top = Math.round(arrowTop2) + 'px';
      c.card.style.top = Math.round(arrowTop2 + ah + 8) + 'px';
    }
  }

  // ============================== TAP ==============================
  function bindTap() {
    var tapBtn = $('tapBtn');
    function doTap(x, y) {
      var st = s();
      if (st.over) return;
      if (!tutAllows('click')) { tutDeny(); return; }
      if (!st.boughtLaptop) { if (st.sound) A.error(); toast(t('tap_hint_buy_laptop'), '', { routine: true }); return; }
      _lastTapMs = (window.performance && performance.now) ? performance.now() : +new Date();   // mark tap activity so teach modals hold off until the burst settles
      var v = G.click();
      if (v <= 0) return;
      if (st.sound) A.tap(Math.max(st.heat || 0, st.training ? 0.4 : 0));
      // Overclock REDLINE payoff: the tap that first drives heat to max gets a distinct sparkle
      // + a firmer buzz — the AUDIO half of the orb's heat glow (v108), so hitting full разгон
      // feels earned. Fires ONCE per climb; re-arms only after the combo cools well below max
      // (so a sustained redline doesn't spam). Activates the premium-but-unused A.insight cue.
      if ((st.heat || 0) >= 0.985) { if (!_redlined) { _redlined = true; if (st.sound && A.insight) A.insight(); buzz(18); } }
      else if ((st.heat || 0) < 0.6) { _redlined = false; }
      if (x == null) { var r = tapBtn.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
      floatText(x, y, '+' + money(v), st.training ? 'big' : 'crit');
      FX.tapBurst(x, y, st.heat || 0); FX.ripple(x, y, 130);
      buzz(6);
      tapBtn.classList.remove('squash'); void tapBtn.offsetWidth; tapBtn.classList.add('squash');
      // Deferred onboarding teach: explain WHAT a click represents AFTER the player has tapped
      // a few times — spread across actions instead of stacked on ftue.start (blind review).
      if (st.tutorial === 'click' && st.ftue.start && !st.ftue.clickwhy && (st.clicks - (_clickStepBase || 0)) >= 3) {
        st.ftue.clickwhy = 1; G.save();
        // Defer the lore modal until the tap-burst SETTLES — firing it mid-burst made the
        // player's momentum taps land on the modal backdrop and get eaten (blind-test ×2:
        // "~12 rapid taps lost to the popup"). Re-armed below on every tap, so it only
        // surfaces ~0.6s after the LAST click — never interrupting an active burst.
        _clickwhyTimer = setTimeout(showClickWhy, 600);
      } else if (_clickwhyTimer) {
        // still tapping → push the teach later so it waits for a pause
        clearTimeout(_clickwhyTimer); _clickwhyTimer = setTimeout(showClickWhy, 600);
      }
    }
    // MOBILE MULTI-TOUCH (item 1): register EVERY tap on `pointerdown` instead of
    // `click`. `click` carries the legacy ~300ms touch delay AND is suppressed when a
    // second finger lands mid-gesture (multi-touch cancels the click), so two-hand
    // rapid tapping felt laggy / dropped taps. pointerdown fires immediately and once
    // per pointer, so each finger counts and разгон/heat builds at full speed.
    // `touch-action: none` on #tapBtn (CSS, additive) kills the delay + scroll-intent.
    // Guard: a pointerdown is followed by a synthetic `click` on the same tap — we set
    // _tapPdHandled so that click does NOT double-count. Keyboard (Space/Enter) fires a
    // click with detail===0 and no preceding pointerdown, so it still works.
    var _tapPdHandled = false, _tapPdClear = null;
    tapBtn.addEventListener('pointerdown', function (e) {
      // primary button only for mouse; touch/pen always have button 0
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      _tapPdHandled = true;
      // self-heal: if the trailing synthetic click never arrives (released off-target,
      // multi-touch swallow), drop the guard so a later keyboard click still registers.
      if (_tapPdClear) clearTimeout(_tapPdClear);
      _tapPdClear = setTimeout(function () { _tapPdHandled = false; }, 700);
      doTap(e.clientX, e.clientY);
    });
    tapBtn.addEventListener('click', function (e) {
      // Keyboard-activation (Space/Enter on the focused orb) fires a synthetic click
      // with detail===0 and clientX/Y===0. Pass null,null so doTap() falls back to the
      // orb center — otherwise "+$X" would float from the screen corner (0,0).
      if (e.detail === 0 || (e.clientX === 0 && e.clientY === 0)) { doTap(null, null); return; }
      // pointer-driven tap already handled by pointerdown above — swallow the trailing
      // click so the same physical tap isn't counted twice.
      if (_tapPdHandled) { _tapPdHandled = false; return; }
      doTap(e.clientX, e.clientY);
    });

    // ADDITIVE polish: idle breathing. After ~2s with no interaction the orb does a
    // very subtle breathing pulse (CSS) so it feels alive. It is removed the instant
    // the player touches it (pointerdown) — BEFORE :active/.squash engage — so it never
    // fights the existing click burst / ripple / squash / разгон combo.
    var idleTimer = null;
    function stopBreathe() { tapBtn.classList.remove('idle-breathe'); }
    function armBreathe() {
      if (idleTimer) clearTimeout(idleTimer);
      stopBreathe();
      idleTimer = setTimeout(function () {
        var st = s();
        // only breathe when the orb is actually live + interactable
        if (st.boughtLaptop && !st.over && currentTab === 'company') tapBtn.classList.add('idle-breathe');
      }, 2000);
    }
    tapBtn.addEventListener('pointerdown', function () { stopBreathe(); if (idleTimer) clearTimeout(idleTimer); });
    tapBtn.addEventListener('click', armBreathe);
    armBreathe();
  }

  // click-upgrade button (engine had upgradeTap() but no UI exposed it)
  function bindTapUpgrade() {
    var btn = $('tapUpgradeBtn'); if (!btn) return;
    btn.addEventListener('click', function (e) {
      var st = s();
      // tutorial gate: only allowed on the 'upgrade' step (or when tutorial done)
      if (!tutAllows('upgradeTap')) { tutDeny(); return; }
      if (G.upgradeTap()) {
        if (st.sound) A.buy(); buzz(12);
        var r = btn.getBoundingClientRect();
        FX.buyBurst(e.clientX || (r.left + r.width / 2), e.clientY || (r.top + r.height / 2));
        tutOnUpgraded();
        update();
      } else { toast(t('decision_cant_afford'), 'bad', { routine: true }); if (st.sound) A.error(); }
    });
  }
  // refresh the click-upgrade button's labels + state each render
  function syncTapUpgrade() {
    var st = s(), btn = $('tapUpgradeBtn'); if (!btn) return;
    // visible once the laptop is bought (forced-clicking phase onward)
    var show = st.boughtLaptop && !st.over;
    // FTUE focus (items 2–7): during a HARD-LOCK coach step, only the CURRENT target
    // control is on screen — sibling action buttons are HIDDEN (not just dimmed) so
    // nothing peeks behind the coach card. The click-upgrade button is part of the
    // 'upgrade' step ONLY; on 'click' / 'server' / 'laptop' it must not show behind the
    // coach (owner saw it at ~$22 during the click step). Free play / soft steps: normal.
    var step = G.tutorialStep();
    if (step && G.tutorialHardLock() && step !== 'upgrade') {
      // EXCEPT the 'server' EARN phase: the click-upgrade is a real, already-PERMITTED
      // intermediate action there (tutAllows('upgradeTap') is true while cash < the server
      // price) — buying the $12/$24 upgrades lets the player click toward the $40 server
      // FASTER instead of dead-grinding. Every blind tester flagged this $6→$40 stretch as a
      // dead zone; surfacing the (logically allowed) button removes it. Once they can afford
      // the server, tutAllows flips false → the button hides again so the buy stays in focus.
      if (!(step === 'server' && tutAllows('upgradeTap'))) show = false;
    }
    setClass(btn, 'hidden', !show);
    if (!show) return;
    var maxed = st.tapLevel >= C.TAP.upgrade.maxLevel;
    if (maxed) {
      // BASE value (no разгон heat) so the button digits never fluctuate as the combo heats
      setHTML(btn, esc(t('tap_up_max', { cur: fmt(G.baseTapValue()) })));
      btn.disabled = true; setClass(btn, 'cant-afford', false);
    } else {
      var cur = G.baseTapValue(), next = cur * C.TAP.upgrade.gain, cost = G.tapUpgradeCost();
      setHTML(btn,
        esc(t('tap_up_btn', { cur: fmt(cur), next: fmt(next) })) +
        '<span class="tu-sub">' + esc(t('tap_up_cost', { c: fmt(cost) })) + '</span>');
      btn.disabled = false; setClass(btn, 'cant-afford', !G.canUpgradeTap());   // clickable when unaffordable → tap answers (toast) instead of nothing
    }
    // tutorial highlight only during the 'upgrade' step
    setClass(btn, 'tut-glow', st.tutorial === 'upgrade');
  }

  // ============================== REFRESH ==============================
  function rebuildActive() { if (currentTab === 'research') buildModelTab(); else if (currentTab === 'world') buildWorldTab(); else if (currentTab === 'upgrades') { buildHardware(); syncHardware(); } }
  // VISUAL FACILITY VIEW — render the premises diorama at the top of the Company
  // screen. The module caches a signature and only rebuilds when the relevant
  // counts / premise / version / language change, so calling it each frame is cheap.
  function syncFacility() {
    try {
      if (currentTab !== 'company') return;
      if (!window.GAME_FACILITY) return;
      var host = $('facilityHero');
      if (host) window.GAME_FACILITY.render(host);
    } catch (e) {}
  }
  var _lastMusicI = null;
  // Drive the procedural ambient's intensity from game state (vision: ambient builds with
  // ERA and TENSION). era = version progress toward Singularity; danger = an overdue bill or
  // a dangerously low risk meter. Throttled so the music only re-voices on meaningful change.
  // Audio-only and a no-op when music is off — cannot affect gameplay/layout.
  function syncMusicIntensity() {
    var st = s();
    var era = Math.min(1, (st.version || 0) / C.AGI_VERSION);
    var danger = 0;
    if (st.overdue) danger += 0.30;
    var minMeter = Math.min(st.safety, st.approval, st.legality) / 100;
    if (minMeter < 0.5) danger += (0.5 - minMeter) * 0.8;
    var target = Math.max(0, Math.min(1, 0.15 + era * 0.6 + danger));
    if (_lastMusicI === null || Math.abs(target - _lastMusicI) > 0.04) {
      _lastMusicI = target;
      // Drive the ERA-REACTIVE ambient BACKGROUND (the #app blobs + grid read var(--intensity)).
      // This was dormant — nothing set --intensity, so the atmosphere never built toward the
      // Singularity. Set it regardless of sound (it's purely visual); music follows if enabled.
      try { document.documentElement.style.setProperty('--intensity', target.toFixed(3)); } catch (e) {}
      if (M && st.music) { try { M.setIntensity(target); } catch (e) {} }
    }
  }
  function update() {
    syncHud();
    syncMusicIntensity();
    syncFacility();
    if (currentTab === 'company') syncLab();
    else if (currentTab === 'upgrades') syncHardware();
    else if (currentTab === 'research') syncModelTab();
    else if (currentTab === 'world') syncWorldTab();
    else if (currentTab === 'settings') syncSettingsState();
    // STORY: the $40 servers cutscene — fires once when cash first reaches the
    // mini-server cost during the 'server' step (garage backstory + rentable gear).
    try { maybeServersCut(); } catch (e) {}
    // STORY: branching cinematic dilemmas — one at a time, when the screen is free.
    try { checkStoryDecisions(); } catch (e) {}
    // SOFT release step: a single gentle, non-blocking nudge the moment Power is finally
    // enough to ship v1 — instead of a persistent coach nagging the whole time.
    try {
      if (G.tutorialStep() === 'release' && !s().ftue.powerReady && G.availablePower() >= G.powerReq()) {
        s().ftue.powerReady = 1; G.save();
        toast(t('ftue_power_ready'), 'good');
      }
    } catch (e) {}
    // cinematic guided onboarding coachmark — runs on every tab so it can point at
    // the Hardware nav (wrong tab) or the laptop/server card / orb / upgrade (right tab)
    try { syncFtueCoach(); } catch (e) {}
  }

  // STORY: when cash first reaches the mini-server cost during the 'server' tutorial
  // step, auto-play the servers cutscene ONCE. Guarded so it never stacks on another
  // cutscene, never replays (seenServersCut persists), and never breaks the forced
  // tutorial — when it ends the 'server' coach resumes pointing at the orb/Hardware.
  function maybeServersCut() {
    var st = s();
    if (!window.GAME_CUTSCENE) return;
    if (st.over || st.seenServersCut) return;
    if (G.tutorialStep() !== 'server') return;
    if (st.cash < G.hwCost('miniserver')) return;
    if (window.GAME_CUTSCENE.isActive()) return;
    st.seenServersCut = true; G.save();
    window.GAME_CUTSCENE.servers(function () { try { update(); } catch (e) {} });
  }

  // STORY: play the premise-move chapter ONCE per destination tier, right after a
  // successful purchase. Guarded by state.seenPremiseMove (persisted map) so a
  // returning save never replays — and never double-fires. Never fires during the
  // forced tutorial hard-lock (premises can't be bought there), game-over, or while
  // another cutscene is active. update() already ran before this, so the purchase
  // stands regardless of whether the cutscene plays.
  function maybePremiseMove(id) {
    try {
      var st = s();
      if (!window.GAME_CUTSCENE) return;
      if (st.over) return;
      if (G.tutorialHardLock && G.tutorialHardLock()) return;
      if (window.GAME_CUTSCENE.isActive()) return;
      st.seenPremiseMove = st.seenPremiseMove || {};
      if (st.seenPremiseMove[id]) return;
      st.seenPremiseMove[id] = 1; G.save();
      window.GAME_CUTSCENE.premiseMove(id, function () { try { update(); } catch (e) {} });
    } catch (e) {}
  }

  // ============================== STORY DECISIONS ==============================
  // Trigger engine: when the screen is FREE (no pending decision, no cutscene, no
  // open modal, not the forced tutorial hard-lock, not game-over), find the first
  // unseen DECISION whose when() is true, mark it seen and present it. One at a
  // time; if busy this tick, it just tries again next tick.
  function storyBusy() {
    var st = s();
    if (st.over) return true;
    if (st.pendingDecision) return true;
    if (window.GAME_CUTSCENE && window.GAME_CUTSCENE.isActive()) return true;
    if (modalOpen) return true;
    if (!$('modalRoot').classList.contains('hidden')) return true;
    if (G.tutorialHardLock && G.tutorialHardLock()) return true;
    return false;
  }
  function checkStoryDecisions() {
    if (!window.GAME_STORY) return;
    if (storyBusy()) return;
    var st = s();
    var d = window.GAME_STORY.findPending(st);
    if (!d) return;
    window.GAME_STORY.markSeen(st, d.id);   // fire-once + sets pendingDecision lock
    G.save();
    // CINEMATIC FRAMING: the first four decisions get a bespoke 1-beat SETUP
    // cutscene that plays BEFORE the modal (Detroit-style). Its Next button
    // opens the choice. The lock (pendingDecision) is already set, so the
    // trigger won't re-fire while the cutscene plays. Guarded: if the cutscene
    // engine is missing/unwired or throws, the modal opens immediately so the
    // decision can never soft-lock.
    var C = window.GAME_CUTSCENE;
    if (C && C.hasDecisionSetup && C.hasDecisionSetup(d.id) && C.decisionSetup && !(C.isActive && C.isActive())) {
      try {
        C.decisionSetup(d.id, function () { try { showDecisionModal(d); } catch (e) {} });
        return;
      } catch (e) { /* fall through to the bare modal */ }
    }
    showDecisionModal(d);
  }

  // The premium decision card: icon + title + situation body + 2–3 choice buttons,
  // each showing its label and a one-line consequence hint. Choosing applies the
  // effects, closes, fires a confirmation toast and (optionally) a single
  // consequence cutscene beat.
  // The exact cash COST of a choice (a positive number) or 0 if the choice has no
  // cash cost (free / a cash gain). Read straight from the choice's effects bag so
  // the price shown is always the real number, never hardcoded.
  function decisionCost(c) {
    var eff = c && c.effects;
    if (eff && typeof eff.cash === 'number' && eff.cash < 0) return -eff.cash;
    return 0;
  }
  function showDecisionModal(d) {
    queueModal(function () {
      var st = s();
      var btns = '';
      for (var i = 0; i < d.choices.length; i++) {
        var c = d.choices[i];
        var cost = decisionCost(c);
        var unaffordable = cost > 0 && st.cash < cost;
        // append the exact $ amount to the label so "expensive" reads as a real number
        var price = cost > 0 ? '<span class="decision-opt-price"> · −' + esc(money(cost)) + '</span>' : '';
        btns +=
          '<button class="decision-opt' + (unaffordable ? ' cant' : '') + '" data-choice="' + esc(c.id) + '"' +
            (unaffordable ? ' disabled aria-disabled="true"' : '') + '>' +
          '<span class="decision-opt-label">' + esc(t(c.label)) + price + '</span>' +
          '<span class="decision-opt-hint">' + esc(t(c.hint)) + '</span>' +
          (unaffordable ? '<span class="decision-opt-cant">' + esc(t('decision_cant_afford')) + '</span>' : '') +
          '</button>';
      }
      showModal(
        '<div class="decision">' +
        '<div class="decision-tag">' + esc(t('decision_eyebrow')) + '</div>' +
        '<div class="decision-icon">' + ic(d.icon) + '</div>' +
        '<h3>' + esc(t(d.title)) + '</h3>' +
        '<p class="decision-body">' + esc(t(d.body)) + '</p>' +
        '<div class="decision-opts">' + btns + '</div>' +
        '</div>'
      );
      var nodes = document.querySelectorAll('#modalRoot .decision-opt');
      for (var j = 0; j < nodes.length; j++) {
        (function (node) {
          node.onclick = function () {
            // a disabled (unaffordable) choice must never apply — hard guard.
            if (node.disabled || node.classList.contains('cant')) { var stx = s(); if (stx.sound) A.error(); return; }
            var st = s();
            if (st.sound) A.buy();
            var choice = window.GAME_STORY.applyChoice(st, d.id, node.getAttribute('data-choice'));
            hideModal();
            G.save();
            renderStatic();
            update();
            if (choice) {
              toast(t('decision_made'), 'good');
              var C = window.GAME_CUTSCENE;
              var choiceId = node.getAttribute('data-choice');
              // CINEMATIC FALLOUT: the first four decisions get a bespoke
              // CONSEQUENCE cutscene reflecting the path taken (replacing the
              // generic reused beat for these). The other six keep their
              // lightweight single beat. All guarded so a failure can't lock.
              if (C && C.hasDecisionConsequence && C.hasDecisionConsequence(d.id, choiceId) &&
                  C.decisionConsequence && !(C.isActive && C.isActive())) {
                try {
                  C.decisionConsequence(d.id, choiceId, function () { try { update(); } catch (e) {} });
                } catch (e) { try { update(); } catch (e2) {} }
              } else if (choice.beat && C && C.play && !C.isActive()) {
                C.play({
                  kind: 'decision',
                  lastLabel: 'cut_continue',
                  beats: [{ scene: choice.beat.scene, title: choice.beat.title, body: choice.beat.body }],
                  onDone: function () { try { update(); } catch (e) {} }
                });
              }
            }
          };
        })(nodes[j]);
      }
    });
  }

  // ============================== PUBLIC ==============================
  function init(offline) {
    document.documentElement.lang = I.getLang();
    renderStatic();
    wireSettings();
    wireGameEvents();
    bindTap();
    // train button
    $('trainBtn').onclick = function () { var st = s(); if (G.tutorialHardLock()) { tutDeny(); return; } if (st.training) return; if (G.startTraining()) { if (st.sound) A.breakthrough(); update(); } else if (st.sound) A.error(); };
    // premises (primary card on the Hardware tab)
    $('premBuyBtn').onclick = function (e) { if (G.tutorialHardLock()) { tutDeny(); return; } var np = G.nextPremise(); if (np && G.buyPremise(np.id)) { if (s().sound) A.funding(); var pc = $('premCard'); FX.cardFlash(pc); var b = $('premBuyBtn'), br = b.getBoundingClientRect(); FX.buyBurst((e && e.clientX) || (br.left + br.width / 2), (e && e.clientY) || (br.top + br.height / 2)); update(); maybePremiseMove(np.id); } else { toast(t('decision_cant_afford'), 'bad', { routine: true }); if (s().sound) A.error(); } };
    bindTapUpgrade();
    // nav
    var nav = $('tabbar').children;
    for (var i = 0; i < nav.length; i++) (function (btn) {
      btn.onclick = function () { var ok = btn.dataset.more ? switchTab('settings') : switchTab(btn.dataset.tab); if (ok && s().sound) A.buy(); };   // only chime on a real switch; a blocked tap already played tutDeny's error sfx
    })(nav[i]);
    // first-run naming
    if (!s().companyName) { showNaming(); }
    // initial tab
    var h = (location.hash || '').replace('#', '');
    if (TABS.indexOf(h) >= 0) currentTab = h;
    switchTab(currentTab);
    syncTicker(99);
    if (offline && offline.earned > 0) { G.applyOffline(offline.earned, offline); teachModal({ icon: ic('ic_cash'), title: t('offline_title'), body: '+' + money(offline.earned) + ' · ' + FMT.fmtTime(offline.t) }); }
    try { if (M && s().music) M.start(); } catch (e) {}
    // Web Audio autoplay unlock: contexts created during load start SUSPENDED until a user
    // gesture, so the procedural soundtrack + SFX were inaudible until the player toggled a
    // setting. Resume BOTH engines on the first real interaction (one-shot), then detach.
    var _audioUnlocked = false;
    function _unlockAudio() {
      if (_audioUnlocked) return; _audioUnlocked = true;
      try { if (A && A.resume) A.resume(); } catch (e) {}
      try { if (M && M.resume) M.resume(); } catch (e) {}
      ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(function (ev) { document.removeEventListener(ev, _unlockAudio, true); });
    }
    ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(function (ev) { document.addEventListener(ev, _unlockAudio, true); });
  }
  function showNaming() {
    showModal(
      '<div class="ob ob-name">' +
      '<div class="ob-icon">' + ic('ic_insight') + '</div>' +
      '<h3>' + t('name_lab_title') + '</h3>' +
      '<p>' + t('name_lab_body') + '</p>' +
      '<input id="labNameInput" class="name-input" type="text" maxlength="24" autocomplete="off" spellcheck="false" placeholder="Singularity Inc." />' +
      '<div class="row"><button class="primary" id="labNameOk">' + t('name_lab_confirm') + '</button></div></div>'
    );
    // The suggested name lives in the greyed PLACEHOLDER, not in value — so the first
    // keystroke types a fresh name instead of inserting mid-string into "Singularity Inc."
    // (tapping a prefilled value drops the caret wherever you tap → "SingulaNexus AIrity Inc.").
    // Empty confirm still defaults to "Singularity Inc." below. Re-naming keeps the real name editable.
    var inp = $('labNameInput');
    var existing = s().companyName;
    if (existing && existing !== 'Singularity Inc.') inp.value = existing;
    function confirm() {
      var v = (inp.value || '').trim().slice(0, 24); s().companyName = v || 'Singularity Inc.'; G.save(); hideModal(); renderStatic(); update();
      // STORY: play the INTRO cutscene once, right after naming and BEFORE the forced
      // tutorial. seenIntro persists so it never replays (incl. reload mid-tutorial).
      if (!s().seenIntro && window.GAME_CUTSCENE) {
        s().seenIntro = true; G.save();
        setTimeout(function () { window.GAME_CUTSCENE.intro(function () { s().seenIntro = true; G.save(); update(); }); }, 80);
      }
    }
    $('labNameOk').onclick = confirm;
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); confirm(); } });
    setTimeout(function () { try { inp.focus(); inp.select(); } catch (e) {} }, 50);
  }

  var lastFrame = 0;
  function frameUpdate() {
    var now = performance.now(), dt = lastFrame ? (now - lastFrame) / 1000 : 0; lastFrame = now;
    checkRace();
    checkMilestones();
    update();
    syncTicker(dt);
  }

  window.GAME_UI = {
    init: init,
    update: frameUpdate,
    back: function () { if (modalOpen) return false; if (currentTab !== 'company') { switchTab('company'); return true; } return false; },
    isPaused: function () { return modalOpen; }
  };
})();
