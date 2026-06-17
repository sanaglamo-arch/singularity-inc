/* UI layer -> window.GAME_UI. Builds DOM, wires events, updates each frame.
   Pure presentation on top of window.GAME. */
(function () {
  'use strict';

  var G = window.GAME, C = window.GAME_CONFIG, FMT = window.GAME_FMT;
  var t = function (k, v) { return window.GAME_I18N.t(k, v); };
  // cached getElementById: stable ids are looked up once; the isConnected guard
  // auto-refreshes if a node was replaced (e.g. a list rebuilt via innerHTML).
  var _elc = {};
  var $ = function (id) { var e = _elc[id]; if (e && e.isConnected) return e; e = document.getElementById(id); if (e) _elc[id] = e; return e; };
  var fmt = FMT.fmt;
  // guarded DOM writes — only touch the DOM (and trigger style-recalc) when the
  // value actually CHANGED. This is the core 60fps lever: most per-frame writes
  // are no-ops, so we skip the recalc/layout they would otherwise force.
  function setText(el, v) { if (!el) return; if (el.__t !== v) { el.__t = v; el.textContent = v; } }
  function setStyleP(el, prop, v) { if (!el) return; var k = '__s_' + prop; if (el[k] !== v) { el[k] = v; el.style[prop] = v; } }
  function setClass(el, cls, on) { if (!el) return; var k = '__c_' + cls; on = !!on; if (el[k] !== on) { el[k] = on; el.classList.toggle(cls, on); } }
  function setHTML(el, v) { if (!el) return; if (el.__h !== v) { el.__h = v; el.innerHTML = v; } }

  var currentTab = 'company';
  var genRefs = {};      // id -> {el, cost, count, sub, mbar, qty}
  var built = false;
  var ICON = window.GAME_ICONS || {};
  function buzz(pattern) { try { if (G.state.haptics && navigator.vibrate) navigator.vibrate(pattern); } catch (e) {} }
  var INFO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11.5v5"/><circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none"/></svg>';
  function infoBtn(key) { return '<button class="info" data-tip="' + key + '" aria-label="info">' + INFO_SVG + '</button>'; }
  function showTip(btn) {
    var tip = document.getElementById('tooltip');
    if (!tip) { tip = el('div'); tip.id = 'tooltip'; tip.className = 'hidden'; document.body.appendChild(tip); }
    tip.textContent = t(btn.dataset.tip);
    tip.classList.remove('hidden');
    var r = btn.getBoundingClientRect(), w = Math.min(260, window.innerWidth - 24);
    tip.style.width = w + 'px';
    tip.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + 'px';
    tip.style.top = Math.min(window.innerHeight - tip.offsetHeight - 12, r.bottom + 8) + 'px';
  }
  function hideTip() { var tip = document.getElementById('tooltip'); if (tip) tip.classList.add('hidden'); }
  // dynamic tooltip (runtime values, e.g. the runway-strip burn/revenue detail)
  function showTipText(anchor, text) {
    var tip = document.getElementById('tooltip');
    if (!tip) { tip = el('div'); tip.id = 'tooltip'; tip.className = 'hidden'; document.body.appendChild(tip); }
    tip.textContent = text;
    tip.classList.remove('hidden');
    var r = anchor.getBoundingClientRect(), w = Math.min(260, window.innerWidth - 24);
    tip.style.width = w + 'px';
    tip.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + 'px';
    tip.style.top = Math.min(window.innerHeight - tip.offsetHeight - 12, r.bottom + 8) + 'px';
  }
  var SW = ' fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
  var EXTRA = {
    ic_check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    ic_tech: '<svg viewBox="0 0 24 24"' + SW + '><circle cx="12" cy="5" r="2.2"/><circle cx="5.5" cy="18" r="2.2"/><circle cx="18.5" cy="18" r="2.2"/><path d="M12 7.2v3.3M12 10.5 6.4 16M12 10.5 17.6 16"/></svg>',
    ic_artifact: '<svg viewBox="0 0 24 24"' + SW + '><path d="M6 3h12l3 5-9 13L3 8z"/><path d="M3 8h18M9 3 7.5 8 12 21 16.5 8 15 3"/></svg>',
    ic_core: '<svg viewBox="0 0 24 24"' + SW + '><circle cx="12" cy="12" r="2.4" fill="currentColor"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/></svg>',
    nav_singularity: '<svg viewBox="0 0 24 24"' + SW + '><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 3a9 9 0 1 1-7 3.3"/><path d="M12 3a9 9 0 0 1 7 3.3" opacity="0.5"/></svg>',
    ic_lock: '<svg viewBox="0 0 24 24"' + SW + '><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    ic_world: '<svg viewBox="0 0 24 24"' + SW + '><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.5 2.6 15.5 0 18M12 3c-2.6 2.5-2.6 15.5 0 18"/></svg>',
    ic_market: '<svg viewBox="0 0 24 24"' + SW + '><path d="M4 19V5M4 19h16"/><path d="M7 15l3-4 3 2 4-6"/></svg>',
    ic_trust: '<svg viewBox="0 0 24 24"' + SW + '><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    nav_more: '<svg viewBox="0 0 24 24"' + SW + '><rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/></svg>'
  };
  function ic(key) { return EXTRA[key] || ICON[key] || ''; }

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  // Toasts are QUEUED with a visible cap so a burst (many achievements/milestones at
  // once, e.g. a big offline jump or a save-load that retroactively awards) never stacks
  // and buries the UI. At most TOAST_MAX show together; the rest appear in sequence.
  //
  // FLOOD CONTROL (item 1): tapping hire/research/buy rapidly used to queue N identical
  // ROUTINE toasts and create a 15-20s backlog. Now:
  //  (a) COALESCE — an identical (msg+kind) toast that's already visible or queued is not
  //      re-added; instead its count bumps ("×4") and its timer refreshes.
  //  (b) CAP the queue small; when flooded, drop the OLDEST ROUTINE (buy/hire/build) toast
  //      so routine feedback can never back up.
  //  (c) IMPORTANT toasts (achievements/decisions/milestones/callbacks) are never dropped.
  var _toastQ = [];        // pending {msg,kind,routine,count}
  var _toastLive = [];     // visible {item, node, countEl, timer}
  var TOAST_MAX = 3, TOAST_MS = 3000, TOAST_Q_MAX = 4;
  function bumpCount(rec) {
    rec.item.count++;
    if (!rec.countEl) { rec.countEl = el('span', 'toast-x'); rec.node.appendChild(rec.countEl); }
    rec.countEl.textContent = '×' + rec.item.count;
    if (rec.timer) { clearTimeout(rec.timer); }
    rec.node.classList.remove('flash'); void rec.node.offsetWidth; rec.node.classList.add('flash');
    armToastTimer(rec);
  }
  function armToastTimer(rec) {
    rec.timer = setTimeout(function () {
      if (rec.node.parentNode) rec.node.parentNode.removeChild(rec.node);
      var i = _toastLive.indexOf(rec); if (i >= 0) _toastLive.splice(i, 1);
      pumpToasts();
    }, TOAST_MS);
  }
  function toast(msg, kind, opts) {
    kind = kind || '';
    var routine = !!(opts && opts.routine);
    // (a) coalesce against an already-visible identical toast
    for (var i = 0; i < _toastLive.length; i++) {
      var rec = _toastLive[i];
      if (rec.item.msg === msg && rec.item.kind === kind) { bumpCount(rec); return; }
    }
    // (a) coalesce against an already-queued identical toast
    for (var j = 0; j < _toastQ.length; j++) {
      if (_toastQ[j].msg === msg && _toastQ[j].kind === kind) { _toastQ[j].count++; pumpToasts(); return; }
    }
    _toastQ.push({ msg: msg, kind: kind, routine: routine, count: 1 });
    // (b) cap the queue; drop oldest ROUTINE first, then oldest of anything as a hard safety
    while (_toastQ.length > TOAST_Q_MAX) {
      var ri = -1;
      for (var k = 0; k < _toastQ.length; k++) { if (_toastQ[k].routine) { ri = k; break; } }
      _toastQ.splice(ri >= 0 ? ri : 0, 1);
    }
    pumpToasts();
  }
  function pumpToasts() {
    var root = $('toastRoot'); if (!root) return;
    while (_toastLive.length < TOAST_MAX && _toastQ.length) {
      var it = _toastQ.shift();
      var e = el('div', 'toast' + (it.kind ? ' ' + it.kind : ''));
      var label = el('span', 'toast-msg', it.msg); e.appendChild(label);
      root.appendChild(e);
      var rec = { item: it, node: e, countEl: null, timer: null };
      _toastLive.push(rec);
      if (it.count > 1) { e.appendChild(rec.countEl = el('span', 'toast-x')); rec.countEl.textContent = '×' + it.count; }
      armToastTimer(rec);
    }
  }
  function floatText(x, y, txt, cls) {
    var e = el('div', 'float' + (cls ? ' ' + cls : ''), txt);
    e.style.left = (x - 12) + 'px';
    e.style.top = (y - 20) + 'px';
    $('fxRoot').appendChild(e);
    setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 1100);
  }

  // ---------- odometer: eased rolling counter with pop on magnitude change ----
  var odoState = {};
  function setOdometer(el, target) {
    if (!el) return;
    var id = el.id || 'odo';
    var st = odoState[id] || (odoState[id] = { disp: target, lastLen: -1 });
    var d = st.disp + (target - st.disp) * 0.22;
    if (!isFinite(d)) d = target;
    if (Math.abs(target - d) < Math.abs(target) * 0.0015 + 0.5) d = target;
    st.disp = d;
    var str = fmt(d);
    el.textContent = str;
    if (str.length !== st.lastLen) {
      st.lastLen = str.length;
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    }
  }

  // ---------- static labels (i18n) ----------
  function renderStatic() {
    document.documentElement.lang = window.GAME_I18N.getLang();
    $('brandName').textContent = G.state.companyName || t('game_title'); // item 2: player-named lab
    $('brandIcon').innerHTML = ic('ic_insight');
    $('tapIcon').innerHTML = ic('ic_brain');
    $('tapLabel').textContent = t('tap_button');
    $('tapHint').textContent = t('tap_hint');
    $('tapBtn').setAttribute('aria-label', t('tap_button')); // localized accessible name
    // nav icons (replace emoji with inline SVG)
    var navIcons = { company: 'nav_company', upgrades: 'nav_upgrades', research: 'nav_research', singularity: 'nav_singularity', alignment: 'nav_alignment', world: 'ic_world', stats: 'nav_stats', achievements: 'nav_achievements', settings: 'nav_settings' };
    $('trustHud').querySelector('.thi').innerHTML = ic('ic_trust');
    var navBtns = $('tabbar').children;
    for (var ni = 0; ni < navBtns.length; ni++) {
      var tabKey = navBtns[ni].dataset.tab;
      var tiEl = navBtns[ni].querySelector('.ti');
      if (tiEl && navIcons[tabKey]) tiEl.innerHTML = ic(navIcons[tabKey]);
    }
    // "More" overflow button (icon + label)
    var moreTi = $('navMoreBtn').querySelector('.ti');
    if (moreTi) moreTi.innerHTML = ic('nav_more');
    $('nav_more').textContent = t('tab_more');
    // nav (primary tabs)
    $('nav_company').textContent = t('tab_company');
    $('nav_upgrades').textContent = t('tab_upgrades');
    $('nav_research').textContent = t('tab_team');   // GDD v3: Research tab repurposed as Team
    $('nav_world').textContent = t('tab_race');   // GDD v3: World tab repurposed as the Race view
    $('worldNewsTitle').innerHTML = t('world_news_title') + infoBtn('tip_news');
    if ($('worldMarketTitle')) $('worldMarketTitle').innerHTML = t('world_market_title') + infoBtn('tip_market');
    $('newsFlavorTitle').textContent = t('news_flavor_title');
    if ($('marketIntro')) $('marketIntro').textContent = t('market_intro');
    buildMarket();
    // (legacy prestige/singularity/artifacts/tech tabs were retired in GDD v3)
    // (Alignment / Stats / Awards / Settings labels live in the More sheet, built on open)
    // upgrades (autopilot panel removed in Phase 1 — active decisions, not automation)
    $('upgradesTitle').textContent = t('upgrades_title');
    $('managersTitle').textContent = t('managers_title');
    // GDD v3: Team (hiring) view — repurposed from the old Research tab
    if ($('teamTitle')) {
      $('teamTitle').innerHTML = t('team_title') + infoBtn('tip_team');
      $('teamDesc').textContent = t('team_desc');
      if ($('rndTitle')) $('rndTitle').innerHTML = t('rnd_title') + infoBtn('tip_research2');
    }
    // Managing Director panel (executive ladder) static labels + mandate segment captions
    if ($('execTitle')) {
      $('execTitle').innerHTML = t('exec_title') + infoBtn('tip_exec');
      $('mandateLabel').textContent = t('mandate_label');
      var mseg = $('mandateSeg').children;
      mseg[0].textContent = t('mandate_growth'); mseg[1].textContent = t('mandate_balance');
      mseg[2].textContent = t('mandate_safety'); mseg[3].textContent = t('mandate_share');
    }
    // alignment → Safety (label tier scales with act; updateAlignment() refreshes it live)
    var sfx = { s: G.safetyLabel() };
    $('alignTitle').innerHTML = t('alignment_title', sfx) + infoBtn('tip_align'); $('trustHud').setAttribute('data-tip','tip_trust');
    $('alignIntro').textContent = t('alignment_intro', sfx);
    $('alignLabel').textContent = t('alignment_label', sfx);
    if ($('alignTip')) $('alignTip').innerHTML = '<span class="ticon">' + ic('ic_insight') + '</span><span>' + t('tip_insight') + '</span>';
    if ($('researchTip')) $('researchTip').innerHTML = '<span class="ticon">' + ic('ic_bolt') + '</span><span>' + t('tip_overclock') + '</span>';
    // stats
    $('statsTitle').textContent = t('stats_title');
    $('achTitle').textContent = t('achievements_title');
    // settings
    $('settingsTitle').textContent = t('settings_title');
    $('companyNameLabel').textContent = t('company_name');
    $('companyNameSave').textContent = t('rename_save');
    var cni = $('companyNameInput'); if (cni && document.activeElement !== cni) cni.value = G.state.companyName || '';
    $('langLabel').textContent = t('language');
    $('soundLabel').textContent = t('sound');
    $('musicLabel').textContent = t('music');
    var msg = $('musicSeg').children; msg[0].textContent = t('on'); msg[1].textContent = t('off');
    $('hapticsLabel').textContent = t('haptics');
    var hpg = $('hapticsSeg').children; hpg[0].textContent = t('on'); hpg[1].textContent = t('off');
    $('adBoostLabel').textContent = t('ad_boost');
    $('adCashLabel').textContent = t('ad_cash');
    $('adBoostBtn').textContent = t('ad_boost');
    $('adCashBtn').textContent = t('ad_cash');
    $('cosmeticsTitle').textContent = t('cosmetics_title');
    $('cosOrbLabel').textContent = t('cosmetics_orb');
    $('cosThemeLabel').textContent = t('cosmetics_theme');
    buildCosmetics();
    $('saveBtn').textContent = t('save_now');
    $('resetBtn').textContent = t('reset_progress');
    $('creditsTxt').textContent = t('credits');
    $('versionTxt').textContent = t('version', { v: '1.0' });
    $('riskMiniLabel').innerHTML = '<span>' + t('risk_label') + '</span><span id="riskMiniPct"></span>';
    // GDD v3 model/training panel static labels (+ ⓘ tooltips)
    if ($('rlCompute')) {
      $('rlCompute').innerHTML = t('res_compute') + infoBtn('tip_compute');
      $('rlShare').innerHTML = t('res_share') + infoBtn('tip_share');
      $('rlVal').innerHTML = t('res_valuation') + infoBtn('tip_valuation');
      $('modelTitle').innerHTML = t('models_title') + infoBtn('tip_models');
    }
    if ($('standingsTitle')) {
      $('standingsTitle').innerHTML = t('standings_title') + infoBtn('tip_rivals');
      $('standingsStatus') && ($('standingsStatus').textContent = '');
      buildStandings();
    }
    // buy-mode bar: localize labels + ensure the explainer (ⓘ) tooltip is present
    var bmb = $('buyModeBar');
    if (bmb) {
      var modeBtns = bmb.querySelectorAll('button[data-mode]');
      for (var mbi = 0; mbi < modeBtns.length; mbi++) {
        var mode = modeBtns[mbi].dataset.mode;
        modeBtns[mbi].textContent = (mode === 'max') ? t('buy_max') : ('×' + mode);
      }
      if (!$('buyModeLabel')) {
        var bmLab = document.createElement('span');
        bmLab.id = 'buyModeLabel'; bmLab.className = 'bm-label';
        bmb.insertBefore(bmLab, bmb.firstChild);
      }
      $('buyModeLabel').textContent = t('buy');
      if (!bmb.querySelector('.info')) {
        var holder = document.createElement('div');
        holder.innerHTML = infoBtn('tip_buymodes');
        bmb.appendChild(holder.firstChild);
      }
    }
    // sound seg labels
    var ssg = $('soundSeg').children;
    ssg[0].textContent = t('on'); ssg[1].textContent = t('off');
    // rebuild dynamic lists that contain names
    buildGenerators();
    buildUpgrades();
    buildManagers();
    buildPrestigeUpgrades();
    buildAchievements();
  }

  // ---------- generators ----------
  function buildGenerators() {
    var list = $('genList');
    list.innerHTML = '';
    genRefs = {};
    var classOf = function (id) { for (var k in C.GEN_CLASS) if (C.GEN_CLASS[k].indexOf(id) >= 0) return k; return 'low'; };
    C.GENERATORS.forEach(function (g, gi) {
      var card = el('div', 'card locked');
      card.dataset.cls = classOf(g.id);
      card.style.animationDelay = (Math.min(gi, 12) * 32) + 'ms';
      card.innerHTML =
        '<div class="iconwrap">' + ic('gen_' + g.id) + '</div>' +
        '<div class="info">' +
          '<div class="name">' + t('g_' + g.id) + '</div>' +
          '<div class="desc">' + t('g_' + g.id + '_d') + '</div>' +
          '<div class="each"></div>' +
          '<div class="milestoneBar"><div></div></div>' +
        '</div>' +
        '<div class="right">' +
          '<div class="add"></div>' +
          '<div class="cost">0</div>' +
          '<div class="buylabel"></div>' +
        '</div>' +
        '<div class="ownedBadge hidden">0</div>';
      card.addEventListener('click', function (e) {
        var gm = G.globalMult(), before = G.genOutput(g.id) * gm;
        if (G.buyGen(g.id)) {
          window.GAME_AUDIO.buy(); buzz(12);
          window.GAME_FX.cardFlash(card);
          var r = card.getBoundingClientRect();
          window.GAME_FX.buyBurst(e.clientX || (r.left + r.width / 2), e.clientY || (r.top + r.height / 2));
          // small floating "+X/sec" over the card showing the compute/sec this buy added (item 5)
          var gain = G.genOutput(g.id) * G.globalMult() - before;
          if (isFinite(gain) && gain > 0) window.GAME_FX.popText(r.left + r.width / 2, r.top + 14, '+' + fmt(gain) + t('per_sec_suffix'), 'good');
        }
      });
      list.appendChild(card);
      genRefs[g.id] = {
        el: card,
        cost: card.querySelector('.cost'),
        each: card.querySelector('.each'),
        add: card.querySelector('.add'),
        mbar: card.querySelector('.milestoneBar > div'),
        buylabel: card.querySelector('.buylabel'),
        badge: card.querySelector('.ownedBadge')
      };
    });
  }

  function updateGenerators() {
    var s = G.state;
    C.GENERATORS.forEach(function (g) {
      var r = genRefs[g.id];
      if (!r) return;
      var owned = s.gens[g.id];
      // soft lock: a later generator stays hidden until it's within reach (≈half its
      // cost) OR the previous tier has hit its first milestone. Stage 1 = laptop only.
      var idx = C.GENERATORS.indexOf(g);
      var prevCount = idx > 0 ? s.gens[C.GENERATORS[idx - 1].id] : 99;
      if (idx > 0 && owned === 0 && s.cash < g.baseCost * 0.5 && prevCount < 10) {
        setClass(r.el, 'hidden', true);
        return;
      }
      setClass(r.el, 'hidden', false);
      var p = G.genBuyPreview(g.id);
      setClass(r.el, 'affordable', p.affordable);
      setClass(r.el, 'locked', !p.affordable);
      setText(r.cost, fmt(p.cost));
      setClass(r.cost, 'cant', !p.affordable);
      // headline per-unit value: what ONE of this generator produces, right now
      setText(r.each, t('gen_each', { v: fmt(p.perUnit) }));
      // what the CURRENT purchase (selected buy-mode) adds — hidden when buying just one (== "each")
      if (p.qty > 1) { setStyleP(r.add, 'display', ''); setText(r.add, t('gen_add', { v: fmt(p.addCps) })); }
      else { setStyleP(r.add, 'display', 'none'); }
      // buy-mode affordance: exact count for the selected mode
      setText(r.buylabel, (s.buyMode === 'max')
        ? t('buy_max_n', { n: p.maxAffordable })
        : t('buy_n', { n: s.buyMode }));
      setClass(r.badge, 'hidden', owned <= 0);
      if (owned > 0) setText(r.badge, owned);
      var msLevel = owned >= 200 ? 3 : owned >= 100 ? 2 : owned >= 25 ? 1 : 0;
      setClass(r.el, 'ms1', msLevel === 1);
      setClass(r.el, 'ms2', msLevel === 2);
      setClass(r.el, 'ms3', msLevel === 3);
      var nm = G.nextMilestone(owned);
      if (nm) { setStyleP(r.mbar, 'width', Math.min(100, (owned / nm) * 100).toFixed(1) + '%'); setStyleP(r.mbar.parentNode, 'display', ''); }
      else { setStyleP(r.mbar.parentNode, 'display', 'none'); }
    });
  }

  // ---------- GDD v3: model-generation training panel ----------
  // visible process-speed multiplier (researchers + research + boost) appended to live
  // timers, so the player SEES that hiring / boosting makes processes faster.
  function speedTag() { var s = G.processSpeed(); return s > 1.05 ? ' · ⚡×' + s.toFixed(1) : ''; }
  function updateModelPanel() {
    var s = G.state;
    setText($('computeVal'), fmt(s.compute));
    setText($('computeRate'), '+' + fmt(frameCompute) + '/s');
    // HOOK: before the first product ships, a screen-edge glow climbs with progress toward
    // the v1 compute threshold — a rising "you're almost there" pressure for the first dopamine.
    var gNext = C.MODELGEN[s.modelGen];
    var v1on = (s.modelGen < 1 && gNext) ? Math.max(0, Math.min(1, s.compute / gNext.computeReq)) : 0;
    var vq = Math.round(v1on * 20) / 20;
    if (vq !== _lastV1) { _lastV1 = vq; document.documentElement.style.setProperty('--v1', vq.toFixed(2)); }
    setText($('shareVal'), (Math.round(s.marketShare * 10) / 10) + '%');
    setText($('valVal'), '$' + fmt(G.valuation()));
    // Stage-1 garage cleanliness: market-share, valuation and datacenter builds only
    // appear once you've shipped your first product (modelGen ≥ 1).
    var preProduct = s.modelGen < 1, rc = $('resRow').children;
    setClass(rc[1], 'hidden', preProduct); setClass(rc[2], 'hidden', preProduct);
    setClass($('buildBox'), 'hidden', preProduct);
    setText($('modelProg'), t('model_progress', { n: s.modelGen, total: C.MODELGEN.length }));
    // funding round (P5): appears when valuation clears the next round's milestone
    var fb = $('fundingBtn'), round = G.nextFundingRound(), fn = $('fundNote');
    if (round && G.canTakeFunding()) {
      setClass(fb, 'hidden', false); fb.disabled = false;
      setText(fb, t('fund_btn', { name: t('fund_' + round.id), v: '$' + fmt(G.fundingPayout(round)) }));
      // explain WHERE the money comes from (anti-"откуда деньги?") + ⓘ for the full picture
      if (fn) { setHTML(fn, t('fund_explain', { name: t('fund_' + round.id), v: '$' + fmt(G.fundingPayout(round)), p: Math.round((round.mult - 1) * 100) }) + infoBtn('tip_funding')); setClass(fn, 'hidden', false); }
    } else { setClass(fb, 'hidden', true); if (fn) setClass(fn, 'hidden', true); }
    // earned-boost activation (speeds ALL timers ×2 for 2h)
    var bzb = $('boostBtn');
    if ((s.boostTokens || 0) > 0 && !G.boostActive()) {
      setClass(bzb, 'hidden', false);
      setText(bzb, t('boost_use', { n: s.boostTokens }));
    } else { setClass(bzb, 'hidden', true); }
    // datacenter build (parallel timer): money + time -> permanent compute capacity
    var bb = $('buildBtn'), bp = $('buildProg');
    if (G.buildActive()) {
      setClass(bb, 'hidden', true); setClass(bp, 'hidden', false);
      setStyleP($('buildFill'), 'width', (G.buildProgress() * 100).toFixed(1) + '%');
      setText($('buildTimer'), t('build_active', { t: FMT.fmtTime(G.buildTimeLeft()) }) + speedTag());
    } else {
      setClass(bp, 'hidden', true); setClass(bb, 'hidden', false);
      setText(bb, t('build_btn', { v: '$' + fmt(G.buildCost()), p: Math.round(C.DATACENTER.bonus * 100) }));
      bb.disabled = !G.canStartBuild();
    }
    var btn = $('trainBtn'), prog = $('trainProg'), hint = $('trainHint');
    if (G.isAGI()) {
      setClass(btn, 'hidden', true); setClass(prog, 'hidden', true);
      setText(hint, t('agi_title')); setClass(hint, 'agi', true);
      return;
    }
    var g = G.nextGen(), name = t(g.id);
    if (G.trainingActive()) {
      setClass(btn, 'hidden', true); setClass(prog, 'hidden', false);
      setStyleP($('trainFill'), 'width', (G.trainingProgress() * 100).toFixed(1) + '%');
      setText($('trainTimer'), t('train_active', { name: t(C.MODELGEN[s.training.gen].id) }) + ' · ' + t('train_left', { t: FMT.fmtTime(G.trainingTimeLeft()) }) + speedTag());
      setText(hint, '');
    } else {
      setClass(prog, 'hidden', true); setClass(btn, 'hidden', false);
      setText(btn, t('train_btn', { name: name }));
      var can = G.canStartTraining();
      btn.disabled = !can;
      setText(hint, can ? t('train_ready') : t('train_need', { v: fmt(g.computeReq) }));
    }
  }

  // ---------- GDD v3: Team (hiring researchers) ----------
  function updateTeam() {
    var s = G.state;
    var spd = Math.round((G.researcherSpeed() - 1) * 100);
    setHTML($('teamStats'),
      '<div class="tstat"><span class="tk">' + t('res_researchers') + '</span><span class="tv">' + s.researchers + '</span></div>' +
      '<div class="tstat"><span class="tk">' + t('team_speed') + '</span><span class="tv">+' + spd + '%</span></div>');
    var btn = $('hireBtn'), cost = G.researcherCost();
    setText(btn, t('hire_btn', { v: fmt(cost) }));
    btn.disabled = s.cash < cost;
    // team_desc (above) + the info tip already cover this; drop the redundant sub-line
    // research project (parallel timer): money + time -> permanent efficiency
    setHTML($('researchStats'),
      '<div class="tstat"><span class="tk">' + t('research_done') + '</span><span class="tv">' + s.researchLevel + '</span></div>' +
      '<div class="tstat"><span class="tk">' + t('research_eff') + '</span><span class="tv">+' + Math.round((G.researchEfficiencyMult() - 1) * 100) + '%</span></div>');
    var rb = $('researchBtn'), rp = $('researchProg2');
    if (G.researchActive()) {
      setClass(rb, 'hidden', true); setClass(rp, 'hidden', false);
      setStyleP($('researchFill'), 'width', (G.researchProgress() * 100).toFixed(1) + '%');
      setText($('researchTimer'), t('research_active', { t: FMT.fmtTime(G.researchTimeLeft()) }) + speedTag());
    } else {
      setClass(rp, 'hidden', true); setClass(rb, 'hidden', false);
      setText(rb, t('research_btn', { v: '$' + fmt(G.researchProjCost()) }));
      rb.disabled = !G.canStartResearch();
    }
  }

  // ---------- v17 BILLS view (electricity + taxes; pay-now online, no fee) ----------
  // A compact section on the Lab: accruing ⚡ electricity ("owed, settles in N days") + next
  // 🧾 tax ("~$Y in N days") + pay-now buttons (online ⇒ no fee). Telegraphs the −30% throttle
  // when a bill couldn't be paid. Gen-gated (appears once a product exists, like the runway).
  function fmtDays(n) { return t(n === 1 ? 'bills_day_one' : 'bills_days', { n: n }); }
  function billRow(icon, owed, days, payId, payLabel, payable, urgent) {
    var settle = days <= 0 ? t('bills_settling') : t('bills_in_days', { d: fmtDays(days) });
    var btn = payable
      ? '<button class="bills-pay" id="' + payId + '">' + payLabel + '</button>'
      : '<span class="bills-paid muted small">' + t('bills_clear') + '</span>';
    return '<div class="bills-row' + (urgent ? ' urgent' : '') + '">' +
      '<span class="bills-icon">' + icon + '</span>' +
      '<span class="bills-amt">$' + fmt(owed) + '</span>' +
      '<span class="bills-when muted small">' + settle + '</span>' +
      btn + '</div>';
  }
  function updateBills() {
    var panel = $('billsPanel'); if (!panel) return;
    var s = G.state;
    // gen-gate: bills matter once you have a product (revenue/taxes) OR are drawing power.
    var show = (s.modelGen || 0) >= 1 || G.electricityMonthly() > 0;
    setClass(panel, 'hidden', !show);
    if (!show) return;
    setText($('billsTitle'), t('bills_title'));
    // accountant status line (hired vs not) — never the word "free".
    setText($('billsAccountant'), s.accountant ? t('bills_accountant_on') : t('bills_accountant_off'));
    var elecOwed = G.elecForecast();      // current + projected-to-boundary
    var taxOwed  = G.taxForecast();
    var html = '';
    html += billRow('⚡', elecOwed, G.elecDaysLeft(), 'payElecBtn', t('bills_pay'), elecOwed > 0, G.elecDaysLeft() <= 1 && elecOwed > 0);
    html += billRow('🧾', taxOwed, G.taxDaysLeft(), 'payTaxBtn', t('bills_pay'), taxOwed > 0, G.taxDaysLeft() <= 1 && taxOwed > 0);
    if (s.powerShutoff) html += '<div class="bills-warn">' + t('bills_shutoff') + '</div>';
    setHTML($('billsList'), html);
    var eb = $('payElecBtn'); if (eb) eb.onclick = function () { var r = G.payElectricity(); toast(t('bills_paid_elec', { v: fmt(r.paid) }), r.short > 0 ? 'bad' : 'good'); buzz(14); update(); };
    var tb = $('payTaxBtn');  if (tb) tb.onclick = function () { var r = G.payTaxes();       toast(t('bills_paid_tax',  { v: fmt(r.paid) }), r.short > 0 ? 'bad' : 'good'); buzz(14); update(); };
  }

  // ---------- Managing Director (executive ladder) ----------
  // Day-aware time: long recruit timers (hours→days) read better than raw "96h 0m".
  function fmtLong(sec) {
    sec = Math.max(0, Math.floor(sec));
    if (sec >= 86400) { var d = Math.floor(sec / 86400), h = Math.round((sec % 86400) / 3600); return d + 'd' + (h ? ' ' + h + 'h' : ''); }
    return FMT.fmtTime(sec);
  }
  function updateExec() {
    if (!$('execPanel')) return;
    var s = G.state, cur = G.currentExec();
    // current director
    if (cur) {
      var perkTxt = execPerkText(cur);
      setHTML($('execCurrent'),
        '<div class="exec-cur"><span class="exec-role">' + t(cur.name) + '</span>' +
        '<span class="exec-badge">' + t('exec_judgment') + ' ' + cur.judgment + '</span></div>' +
        (perkTxt ? '<div class="exec-perk muted small">' + t('exec_perk') + ': ' + perkTxt + '</div>' : ''));
    } else {
      setHTML($('execCurrent'), '<div class="exec-none muted">' + t('exec_none') + '</div>');
    }
    // recruit timer / next-tier / top
    var rb = $('execRecruitBtn'), rp = $('execProg'), gate = $('execGate'), nextBox = $('execNext');
    if (G.execRecruitActive()) {
      setClass(rb, 'hidden', true); setClass(gate, 'hidden', true); setClass(rp, 'hidden', false);
      setStyleP($('execFill'), 'width', (G.execRecruitProgress() * 100).toFixed(1) + '%');
      var rt = G.nextExecTier();   // toTier is being recruited; show its name
      var rtName = rt ? t(rt.name) : '';
      setText($('execTimer'), t('exec_recruiting', { name: rtName, t: fmtLong(G.execRecruitTimeLeft()) }));
      setHTML(nextBox, '');
    } else if (G.execTopReached()) {
      setClass(rp, 'hidden', true); setClass(rb, 'hidden', true); setClass(gate, 'hidden', true);
      setHTML(nextBox, '<div class="exec-top">' + t('exec_top') + '</div>');
    } else {
      setClass(rp, 'hidden', true);
      var nx = G.nextExecTier();
      setHTML(nextBox,
        '<div class="exec-next-head muted small">' + t('exec_next') + '</div>' +
        '<div class="exec-next"><span class="exec-role">' + t(nx.name) + '</span>' +
        '<span class="exec-badge">' + t('exec_judgment') + ' ' + nx.judgment + '</span></div>' +
        '<div class="exec-meta muted small">' + t('exec_cost') + ': $' + fmt(G.execCost(nx)) + ' · ' + t('exec_time') + ': ' + fmtLong(nx.recruitSec) + '</div>');
      var met = G.execGateMet(nx);
      setClass(rb, 'hidden', false);
      setText(rb, t('exec_recruit_btn', { v: '$' + fmt(G.execCost(nx)) }));
      rb.disabled = !G.canRecruitExec();
      if (!met) { setClass(gate, 'hidden', false); setText(gate, t('exec_gate_locked', { req: gateReqText(nx.gate) })); }
      else setClass(gate, 'hidden', true);
    }
    // mandate segment + active description
    var mseg = $('mandateSeg').children, mandates = ['growth', 'balance', 'safety', 'share'];
    for (var i = 0; i < mseg.length; i++) mseg[i].classList.toggle('on', s.mandate === mandates[i]);
    setText($('mandateDesc'), t('mandate_' + s.mandate + '_d'));
  }
  function execPerkText(tier) {
    if (!tier || !tier.perk) return '';
    var p = tier.perk, parts = [];
    if (p.buildSpeed) parts.push('+' + Math.round(p.buildSpeed * 100) + '% ' + t('exec_time'));
    if (p.researchSpeed) parts.push('+' + Math.round(p.researchSpeed * 100) + '% ' + t('rnd_title'));
    if (p.riskDamp) parts.push('−' + Math.round(p.riskDamp * 100) + '% ' + t('risk_label'));
    if (p.dealBonus) parts.push('+' + Math.round(p.dealBonus * 100) + '% ' + t('exec_cost'));
    return parts.join(', ');
  }
  function gateReqText(gate) {
    if (!gate) return '';
    var parts = [];
    if (typeof gate.valuation === 'number') parts.push(t('exec_gate_val', { v: '$' + fmt(gate.valuation) }));
    if (typeof gate.trust === 'number') parts.push(t('exec_gate_trust', { v: gate.trust }));
    if (typeof gate.modelGen === 'number') parts.push(t('exec_gate_gen', { v: gate.modelGen }));
    return parts.join(' · ');
  }

  // ---------- GDD v3: rival market-share standings ----------
  var standRefs = null;
  // item 2 + §4: the player row shows companyName; each rival shows its live roster name
  // (the roster is randomized per game, so names come from state.rivals, not static i18n).
  function entityName(id) { return id === 'you' ? coName() : G.rivalName(id); }
  function buildStandings() {
    var box = $('standingsRows'); if (!box) return;
    box.innerHTML = ''; standRefs = {};
    // build one row per CURRENT standings entry (player + live rivals) — the roster size
    // varies by game now, so derive ids from G.standings() rather than a fixed config list.
    G.standings().forEach(function (e) {
      var id = e.id;
      var row = el('div', 'standrow' + (id === 'you' ? ' you' : ''));
      row.innerHTML = '<span class="srank"></span><span class="sname">' + entityName(id) + '</span>' +
        '<span class="sbarwrap"><span class="sbar"></span></span><span class="sshare"></span>';
      box.appendChild(row);
      standRefs[id] = { row: row, rank: row.querySelector('.srank'), name: row.querySelector('.sname'), bar: row.querySelector('.sbar'), share: row.querySelector('.sshare') };
    });
  }
  function updateStandings() {
    var rows = G.standings(), maxShare = 0, box = $('standingsRows');
    // rebuild if the roster set changed (different game / acquisition removed a rival)
    if (!standRefs || rows.some(function (r) { return !standRefs[r.id]; }) || rows.length !== Object.keys(standRefs).length) buildStandings();
    rows.forEach(function (r) { if (r.share > maxShare) maxShare = r.share; });
    maxShare = Math.max(maxShare, 1);
    // Reorder the REAL DOM nodes to the sorted order EVERY update so the shown rank,
    // the row position, and the displayed share are ALWAYS derived from the same fresh
    // sort — impossible to desync. (No sig-cache: it could skip a needed reorder after a
    // renderStatic rebuild left the DOM in build order. Only 4 rows; appendChild is cheap
    // and only runs while the World tab is visible.)
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], ref = standRefs[r.id]; if (!ref) continue;
      if (box) box.appendChild(ref.row);
      if (ref.name) setText(ref.name, entityName(r.id));   // re-localize each update (BUG 5: "You"->"Вы" on RU)
      setText(ref.rank, '#' + (i + 1));
      setText(ref.share, (Math.round(r.share * 10) / 10) + '%');
      setStyleP(ref.bar, 'width', (r.share / maxShare * 100).toFixed(1) + '%');
      setClass(ref.row, 'lead', i === 0);
    }
    var rank = G.playerRank(), total = rows.length;
    setText($('standingsStatus'), rank === 1 ? t('standings_leader', { co: coName() }) : t('standings_behind', { n: rank, total: total, co: coName() }));
    // §5 acquisition: buy out the strongest rival (post mid-game)
    var ab = $('acquireBtn'), tgt = G.acquireTarget();
    if (tgt && G.acquireUnlocked() && G.canAcquire()) {
      setClass(ab, 'hidden', false);
      setText(ab, t('acquire_btn', { name: G.rivalName(tgt.id), v: '$' + fmt(G.acquireCost(tgt.id)) }));
    } else setClass(ab, 'hidden', true);
    // §4 open-source action: repeatable, slows the leader (+Trust) on a cooldown
    var ob = $('raceOpenBtn');
    if (ob) {
      if (G.rivalsRevealed() && !G.isGameOver()) {
        setClass(ob, 'hidden', false);
        if (G.raceOpenReady()) { ob.disabled = false; setText(ob, t('race_opensource')); }
        else { ob.disabled = true; setText(ob, t('race_opensource_cd', { t: FMT.fmtTime(Math.max(0, 90 - (Date.now() - G.state.raceOpenAt) / 1000)) })); }
      } else setClass(ob, 'hidden', true);
    }
    setText($('agiRace'), t('agi_rank', { n: G.agiRank(), total: G.agiFieldSize() }) + ' · ' + t('agi_race_you', { p: Math.round(G.agiProgress()), co: coName() }) + ' · ' + t('agi_race_lead', { p: Math.round(G.leadingRivalAgi()) }));
  }

  // ---------- upgrades ----------
  var upBuilt = false;
  function buildUpgrades() {
    var list = $('upgradeList');
    list.innerHTML = '';
    C.UPGRADES.forEach(function (u) {
      var card = el('div', 'card locked');
      card.dataset.uid = u.id;
      card.innerHTML =
        '<div class="iconwrap">' + ic('ic_upgrade') + '</div>' +
        '<div class="info"><div class="name">' + t(u.id) + '</div>' +
        '<div class="desc">' + t(u.id + '_d') + '</div></div>' +
        '<div class="right"><div class="cost">' + fmt(u.cost) + '</div></div>';
      card.addEventListener('click', function () { if (G.buyUpgrade(u.id)) window.GAME_AUDIO.buy(); });
      list.appendChild(card);
    });
  }
  function updateUpgrades() {
    var s = G.state;
    var nodes = $('upgradeList').children;
    var anyVisible = false;
    for (var i = 0; i < nodes.length; i++) {
      var card = nodes[i];
      var u = C.UPGRADES[i];
      if (s.upgrades[u.id]) { card.classList.add('hidden'); continue; }
      var unlocked = !u.unlock || s.gens[u.unlock.gen] >= u.unlock.count;
      if (!unlocked) { card.classList.add('hidden'); continue; }
      card.classList.remove('hidden');
      anyVisible = true;
      var afford = s.cash >= u.cost;
      card.classList.toggle('affordable', afford);
      card.classList.toggle('locked', !afford);
      card.querySelector('.cost').classList.toggle('cant', !afford);
    }
    var ue = $('upgradeEmpty');
    if (ue) { ue.classList.toggle('hidden', anyVisible); if (!anyVisible) ue.innerHTML = '<div class="es-icon">' + ic('ic_upgrade') + '</div>' + t('no_upgrades'); }
  }

  // ---------- managers ----------
  function buildManagers() {
    var list = $('managerList');
    list.innerHTML = '';
    C.MANAGERS.forEach(function (m) {
      var card = el('div', 'card locked');
      card.dataset.mid = m.id;
      card.innerHTML =
        '<div class="iconwrap">' + ic('ic_manager') + '</div>' +
        '<div class="info"><div class="name">' + t(m.id) + '</div>' +
        '<div class="desc">' + t('manager_auto', { name: t('g_' + m.gen) }) + '</div></div>' +
        '<div class="right"><div class="cost">' + fmt(m.cost) + '</div></div>';
      card.addEventListener('click', function () { if (G.buyManager(m.id)) window.GAME_AUDIO.buy(); });
      list.appendChild(card);
    });
  }
  function updateManagers() {
    var s = G.state;
    // Stage 3 reveal: the whole Managers section stays hidden until automation matters
    var mgrOn = G.managersUnlocked();
    $('managersTitle').classList.toggle('hidden', !mgrOn);
    $('managerList').classList.toggle('hidden', !mgrOn);
    if (!mgrOn) { var me0 = $('managerEmpty'); if (me0) me0.classList.add('hidden'); return; }
    var nodes = $('managerList').children;
    var anyVis = false;
    for (var i = 0; i < nodes.length; i++) {
      var card = nodes[i];
      var m = C.MANAGERS[i];
      if (s.managers[m.id] || s.gens[m.gen] >= 1) anyVis = true;
      if (s.managers[m.id]) {
        card.classList.remove('locked', 'affordable');
        card.querySelector('.right').innerHTML = '<div class="bought">✓ ' + t('bought') + '</div>';
        card.onclick = null;
        continue;
      }
      var unlocked = s.gens[m.gen] >= 1;
      card.classList.toggle('hidden', !unlocked);
      var afford = s.cash >= m.cost;
      card.classList.toggle('affordable', afford);
      card.classList.toggle('locked', !afford);
    }
    var me = $('managerEmpty');
    if (me) { me.classList.toggle('hidden', anyVis); if (!anyVis) me.innerHTML = '<div class="es-icon">' + ic('ic_manager') + '</div>' + t('no_managers'); }
  }

  // ---------- prestige upgrades ----------
  function buildPrestigeUpgrades() {
    var list = $('prestigeUpList'); if (!list) return;
    list.innerHTML = '';
    C.PRESTIGE.upgrades.forEach(function (p) {
      var card = el('div', 'pcard');
      card.dataset.pid = p.id;
      var pctVars = (p.type === 'startCashPct' || p.type === 'keepGens') ? { v: Math.round(p.value * 100) } : undefined;
      var desc = t(p.id + '_d', pctVars);
      card.innerHTML =
        '<div class="picon">' + ic('ic_rp') + '</div>' +
        '<div class="info"><div class="name">' + t(p.id) + '</div><div class="desc">' + desc + '</div></div>' +
        '<button>' + t('rp_cost', { n: p.cost }) + '</button>';
      card.querySelector('button').addEventListener('click', function () {
        if (G.buyPrestigeUpgrade(p.id)) { window.GAME_AUDIO.buy(); }
      });
      list.appendChild(card);
    });
  }
  function updatePrestigeUpgrades() {
    var s = G.state;
    var nodes = $('prestigeUpList').children;
    for (var i = 0; i < nodes.length; i++) {
      var card = nodes[i];
      var p = C.PRESTIGE.upgrades[i];
      var btn = card.querySelector('button');
      if (s.prestigeUpgrades[p.id]) {
        card.classList.add('owned');
        btn.textContent = '✓ ' + t('bought');
        btn.disabled = true;
      } else {
        card.classList.remove('owned');
        btn.textContent = t('rp_cost', { n: p.cost });
        btn.disabled = s.rp < p.cost;
      }
    }
  }

  // (Autopilot UI removed in Phase 1 — the Upgrades tab is now Global Upgrades + Managers.)

  // ---------- cosmetics ----------
  var ORB_PREVIEW = {
    orb_default: 'radial-gradient(circle at 50% 35%, #b79bff, #5b27c4)',
    orb_cyan: 'radial-gradient(circle at 50% 35%, #a7f0ff, #0e7fa0)',
    orb_gold: 'radial-gradient(circle at 50% 35%, #fff0b8, #b6820c)',
    orb_crimson: 'radial-gradient(circle at 50% 35%, #ffb3c2, #a11733)'
  };
  var THEME_PREVIEW = {
    theme_default: 'linear-gradient(135deg, #8b5cf6, #22d3ee)',
    theme_void: 'linear-gradient(135deg, #1a1830, #050509)',
    theme_aurora: 'linear-gradient(135deg, #34d399, #22d3ee)'
  };
  function lockReq(u) {
    if (u.modelGen) return t('cos_locked_gen', { n: u.modelGen });
    if (u.prestiges) return t('cos_locked_prestiges', { n: u.prestiges });
    if (u.singularities) return t('cos_locked_singularities', { n: u.singularities });
    if (u.ach) return t('cos_locked_ach', { n: u.ach });
    return '';
  }
  function buildCosmetics() {
    [['cosOrbList', C.COSMETICS.orbs, ORB_PREVIEW, 'orb'], ['cosThemeList', C.COSMETICS.themes, THEME_PREVIEW, 'theme'], ['labOrbList', C.COSMETICS.orbs, ORB_PREVIEW, 'orb']].forEach(function (row) {
      var list = $(row[0]); if (!list) return; list.innerHTML = '';
      row[1].forEach(function (it) {
        var sw = el('div', 'cos-swatch'); sw.dataset.cid = it.id; sw.dataset.kind = row[3];
        sw.style.background = row[2][it.id] || '#333';
        sw.title = t(it.id);
        sw.innerHTML = '<div class="lockicon hidden">' + ic('ic_lock') + '</div>';
        sw.addEventListener('click', function () {
          var ok = row[3] === 'orb' ? G.setOrb(it.id) : G.setTheme(it.id);
          if (ok) { window.GAME_AUDIO.buy(); applyCosmetics(); }
        });
        list.appendChild(sw);
      });
    });
  }
  function updateSwatchList(listId, items, selId) {
    var list = $(listId); if (!list) return;
    for (var i = 0; i < list.children.length; i++) {
      var sw = list.children[i], it = items[i];
      var unlocked = G.cosmeticUnlocked(it);
      sw.classList.toggle('locked', !unlocked);
      sw.classList.toggle('sel', selId === it.id);
      var li = sw.querySelector('.lockicon');
      if (li) { li.classList.toggle('hidden', unlocked); if (!unlocked) li.innerHTML = ic('ic_lock'); }
      sw.title = unlocked ? t(it.id) : (t(it.id) + ' — ' + lockReq(it.unlock || {}));
    }
  }
  function updateCosmetics() {
    var s = G.state;
    updateSwatchList('cosOrbList', C.COSMETICS.orbs, s.orb);
    updateSwatchList('cosThemeList', C.COSMETICS.themes, s.theme);
  }
  // the Lab-tab orb swatch row: shown once the player owns >=1 cosmetic option worth
  // surfacing (i.e. once there's something to discover). Reuses the orb swatch list (item 6).
  function updateLabOrbs() {
    var row = $('labOrbRow'); if (!row) return;
    setClass(row, 'hidden', false);
    setText($('labOrbLabel'), t('cosmetics_orb'));
    updateSwatchList('labOrbList', C.COSMETICS.orbs, G.state.orb);
  }
  function applyCosmetics() {
    var s = G.state, de = document.documentElement;
    if (de.getAttribute('data-orb') !== s.orb) de.setAttribute('data-orb', s.orb);
    if (de.getAttribute('data-theme') !== s.theme) de.setAttribute('data-theme', s.theme);
  }

  // ---------- news ticker ----------
  var tickerIdx = -1, tickerTimer = null;
  function coName() { return G.state.companyName || t('game_title'); }
  // stage-flavor pool (never-empty filler), {co} resolved.
  function currentNews() {
    var lang = window.GAME_I18N.getLang();
    var arr = (window.GAME_I18N.DICTS[lang] && window.GAME_I18N.DICTS[lang].news) || window.GAME_I18N.DICTS.en.news || [];
    var stage = parseInt(document.documentElement.getAttribute('data-stage') || '0', 10) || 0;
    var pool = arr[Math.min(stage, arr.length - 1)] || arr[0] || [''];
    return pool.map(function (l) { return l.replace(/\{co\}/g, coName()); });
  }
  // SATIRE — the rival-lab one-liner pool ({co} resolved, shuffled per call so the
  // ticker doesn't repeat in the same order every cycle). This is the cheapest
  // identity/virality win — funny rivals scrolling past at all times.
  function rivalSatire() {
    var lang = window.GAME_I18N.getLang();
    var arr = (window.GAME_I18N.DICTS[lang] && window.GAME_I18N.DICTS[lang].rivalSatire)
      || window.GAME_I18N.DICTS.en.rivalSatire || [];
    return arr.map(function (l) { return l.replace(/\{co\}/g, coName()); });
  }
  // PART B — the LIVE ticker pool: real headlines first (recent → older), then stage
  // flavor + satirical rival headlines woven in so it's never empty AND always has identity.
  // Real events always take priority.
  function tickerPool() {
    var log = (G.state.newsLog || []).map(function (n) { return n.line; });
    // blend stage flavor with the satirical rival pool (the bulk of the "between events" feed)
    var filler = currentNews().concat(rivalSatire());
    if (!log.length) return filler;
    // interleave: every real headline, then one filler line, so the feed breathes.
    var out = [], fi = 0;
    for (var i = 0; i < log.length; i++) {
      out.push(log[i]);
      if (filler.length) { out.push(filler[fi % filler.length]); fi++; }
    }
    return out;
  }
  function setTickerText(line) {
    var el2 = $('tickerText');
    if (el2 && line != null) { el2.textContent = line; el2.style.animation = 'none'; void el2.offsetWidth; el2.style.animation = ''; }
  }
  function rotateTicker() {
    var pool = tickerPool(); if (!pool.length) return;
    tickerIdx = (tickerIdx + 1) % pool.length;
    setTickerText(pool[tickerIdx]);
  }
  function startTicker() { rotateTicker(); if (tickerTimer) clearInterval(tickerTimer); tickerTimer = setInterval(rotateTicker, 7000); }
  // PART B — per-type icon for a news headline (decision / rival / regulatory / milestone).
  var NEWS_ICON = { decision: 'ic_brain', rival: 'ic_risk', regulatory: 'ic_world', milestone: 'ic_breakthrough', flavor: 'ic_market', blackswan: 'ic_risk' };
  function newsRowHTML(n) {
    var type = n.type || 'flavor';
    return '<div class="nf-row nf-' + type + '"><span class="nf-ico">' + ic(NEWS_ICON[type] || 'ic_market') + '</span>' +
      '<span class="nf-line">' + esc(n.line) + '</span></div>';
  }
  // The live News-Feed panel (opened by tapping the ticker). Real headlines, newest first.
  function showNewsFeed() {
    var log = G.state.newsLog || [];
    var rows = log.length
      ? log.map(newsRowHTML).join('')
      : '<div class="nf-empty">' + t('news_feed_empty') + '</div>';
    showModal('<h3 class="nf-title">' + t('news_feed_title') + '<span class="nf-live-tag">LIVE</span></h3>' +
      '<div class="news-feed">' + rows + '</div>' +
      '<div class="row"><button class="primary" id="nfClose">✕</button></div>');
    if ($('nfClose')) $('nfClose').onclick = hideModal;
  }

  // ---------- achievements ----------
  function buildAchievements() {
    var list = $('achList');
    list.innerHTML = '';
    C.ACHIEVEMENTS.forEach(function (a) {
      var card = el('div', 'ach locked');
      card.dataset.aid = a.id;
      var perk = '';
      if (a.perk) {
        var pt = a.perk.type === 'global' ? t('perk_global', { p: Math.round((a.perk.value - 1) * 100) }) : t('perk_tap', { n: a.perk.value });
        perk = '<div class="aperk">' + t('perk_label') + ' · ' + pt + '</div>';
      }
      card.innerHTML =
        '<div class="aicon">' + ic('nav_achievements') + '</div>' +
        '<div><div class="aname">' + t(a.id) + '</div><div class="adesc">' + t(a.id + '_d') + '</div>' + perk + '</div>' +
        '<div class="check hidden">' + ic('ic_check') + '</div>';
      list.appendChild(card);
    });
  }
  function updateAchievements() {
    var s = G.state;
    var nodes = $('achList').children;
    var unlocked = 0;
    for (var i = 0; i < nodes.length; i++) {
      var a = C.ACHIEVEMENTS[i];
      var has = !!s.achievements[a.id];
      if (has) unlocked++;
      nodes[i].classList.toggle('locked', !has);
      nodes[i].querySelector('.check').classList.toggle('hidden', !has);
    }
    $('achProgress').textContent = t('ach_progress', { n: unlocked, m: C.ACHIEVEMENTS.length });
  }

  // ---------- stats ----------
  function updateStats() {
    var s = G.state;
    var totalGens = 0;
    C.GENERATORS.forEach(function (g) { totalGens += s.gens[g.id]; });
    var maxGen = C.MODELGEN.length;
    var genLabel = s.modelGen >= maxGen ? t('stat_modelgen_agi') : (s.modelGen + ' / ' + maxGen);
    // Phase 2 burn→runway readouts (only meaningful once a product exists)
    var runwayStr = s.modelGen >= 1
      ? (G.isProfitable() ? t('runway_profitable')
         : t('runway_days', { n: G.runwayDays() >= 9999 ? '999+' : Math.round(G.runwayDays()) }))
      : '—';
    var rows = [
      [t('stat_modelgen'), genLabel],
      [t('stat_compute'), fmt(s.compute)],
      [t('stat_compute_rate'), fmt(G.cps()) + '/s'],
      [t('stat_money_sec'), fmt(G.moneyRate()) + '/s'],
      [t('stat_burn'), '$' + fmt(G.monthlyBurn())],
      [t('stat_runway'), runwayStr],
      [t('stat_total_cash'), fmt(s.totalEarnedAllTime)],
      [t('stat_share'), (s.marketShare || 0).toFixed(1) + '%'],
      [t('stat_valuation'), fmt(G.valuation())],
      [t('stat_researchers'), s.researchers || 0],
      [t('stat_datacenters'), s.datacenters || 0],
      [t('stat_generators'), totalGens],
      [t('stat_taps'), s.taps],
      [t('stat_incidents'), s.incidentsTotal],
      [t('stat_playtime'), FMT.fmtTime(s.playtime)]
    ];
    var html = '';
    rows.forEach(function (r) { html += '<div class="statItem"><span>' + r[0] + '</span><span>' + r[1] + '</span></div>'; });
    $('statList').innerHTML = html;
    renderHallOfFame();
  }

  // ---------- PHASE 9: Hall of Fame (per-difficulty records) ----------
  // Renders one compact line per difficulty (Easy/Normal/Hard/Impossible) showing the
  // persistent records: best share · fastest AGI · wins. A 🏆 flourish for difficulties
  // where the player reached AGI / won. Difficulties never played show "—". EN+RU.
  function hofPlural(n, base) {
    // RU 3-form plural (one/few/many); EN 2-form (one/many). base = 'hof_wins'|'hof_games'.
    var lang = window.GAME_I18N.getLang(), key;
    if (lang === 'ru') {
      var m10 = n % 10, m100 = n % 100;
      if (m10 === 1 && m100 !== 11) key = base + '_one';
      else if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) key = base + '_few';
      else key = base + '_many';
    } else { key = base + (n === 1 ? '_one' : '_many'); }
    return t(key, { n: n });
  }
  function renderHallOfFame() {
    var rec = G.state.records || {};
    var order = (C.DIFFICULTY && C.DIFFICULTY.ORDER) || ['easy', 'normal', 'hard', 'impossible'];
    setText($('hofTitle'), t('hof_title'));
    var anyPlayed = false;
    var html = '';
    order.forEach(function (d) {
      var r = rec[d];
      var played = !!(r && (r.games || 0) > 0);
      if (played) anyPlayed = true;
      var won = !!(r && r.reachedAGI);
      var parts = [];
      if (played) {
        parts.push(t('hof_share', { p: (r.bestShare || 0).toFixed(0) }));
        if (won && (r.fastestAGIdays || 0) > 0) {
          var days = r.fastestAGIdays < 10 ? r.fastestAGIdays.toFixed(1) : Math.round(r.fastestAGIdays);
          parts.push(t('hof_agi', { n: days }));
        }
        if ((r.wins || 0) > 0) parts.push(hofPlural(r.wins, 'hof_wins'));
        else parts.push(hofPlural(r.games || 0, 'hof_games'));
      }
      var detail = parts.length ? parts.join(' · ') : t('hof_empty_cell');
      html += '<div class="hofItem' + (played ? '' : ' hofItem--empty') + '">' +
        '<span class="hofDiff">' + (won ? '🏆 ' : '') + t('diff_' + d) + '</span>' +
        '<span class="hofRec">' + detail + '</span></div>';
    });
    if (!anyPlayed) html = '<div class="hofNone muted small">' + t('hof_none') + '</div>' + html;
    $('hofList').innerHTML = html;
  }
  // standalone Hall-of-Fame modal (used by the game-over screen's "View Stats" button). Reuses
  // the same per-difficulty record rendering so there's one source of truth.
  function showHallOfFameModal() {
    var rec = G.state.records || {};
    var order = (C.DIFFICULTY && C.DIFFICULTY.ORDER) || ['easy', 'normal', 'hard', 'impossible'];
    var rows = '';
    order.forEach(function (d) {
      var r = rec[d];
      var played = !!(r && (r.games || 0) > 0);
      var won = !!(r && r.reachedAGI);
      var parts = [];
      if (played) {
        parts.push(t('hof_share', { p: (r.bestShare || 0).toFixed(0) }));
        if (won && (r.fastestAGIdays || 0) > 0) { var days = r.fastestAGIdays < 10 ? r.fastestAGIdays.toFixed(1) : Math.round(r.fastestAGIdays); parts.push(t('hof_agi', { n: days })); }
        if ((r.wins || 0) > 0) parts.push(hofPlural(r.wins, 'hof_wins')); else parts.push(hofPlural(r.games || 0, 'hof_games'));
      }
      var detail = parts.length ? parts.join(' · ') : t('hof_empty_cell');
      rows += '<div class="hofItem' + (played ? '' : ' hofItem--empty') + '">' +
        '<span class="hofDiff">' + (won ? '🏆 ' : '') + t('diff_' + d) + '</span>' +
        '<span class="hofRec">' + detail + '</span></div>';
    });
    showModal('<div class="ob"><h3>' + t('hof_title') + '</h3><div id="hofModalList">' + rows + '</div>' +
      '<div class="row"><button class="primary" id="hofModalOk">' + t('ob_done') + '</button></div></div>');
    if ($('hofModalOk')) $('hofModalOk').onclick = function () { window.GAME_AUDIO.buy(); hideModal(); };
  }

  // ---------- research / prestige ----------
  function updateResearch() {
    if (!$('prestigeBox')) return;   // GDD v3: legacy prestige UI removed
    var s = G.state;
    var pr = G.prestigeProjection();
    var btn = $('prestigeBtn');
    btn.textContent = t('prestige_button');
    btn.disabled = !G.canPrestige();
    if (!G.canPrestige()) {
      $('prestigeGain').textContent = t('prestige_locked');
      $('prestigeProj').textContent = '';
    } else {
      $('prestigeGain').textContent = t('prestige_gain', { n: pr.gain });
      // LOUD projection: permanent % gained + how much faster the next run is
      $('prestigeProj').textContent = t('prestige_proj', { p: pr.pctGain, tot: pr.pctAfter }) + ' · ' + t('prestige_speedup', { s: pr.speedup.toFixed(1) });
    }
    $('rpHave').textContent = t('rp_have', { n: s.rp });
    $('currentBonus').textContent = t('current_bonus', { p: Math.round(s.rp * C.PRESTIGE.BONUS * 100) });
  }

  // ---------- alignment (multi-vector) ----------
  function vecColor(v) { return v > C.RISK.WARN_AT ? 'linear-gradient(90deg, var(--warn), var(--bad))' : 'linear-gradient(90deg, var(--good), var(--warn))'; }
  // ---------- 4 RELATIONSHIP METERS strip (icon + colored bar each) ----------
  // band → solid color (green good / amber mid / red low) — colorblind ask: color is
  // the secondary channel; the numeric % is always shown beside the icon.
  var REL_META = {
    approval: { icon: '👥', tip: 'tip_m_approval' },
    gov:      { icon: '🏛', tip: 'tip_m_gov' },
    industry: { icon: '🤝', tip: 'tip_m_industry' },
    morale:   { icon: '🧑‍🔬', tip: 'tip_m_morale' }
  };
  function relColor(band) { return band === 'low' ? 'var(--rose)' : (band === 'mid' ? 'var(--gold)' : 'var(--green)'); }
  function updateRelMeters(wu) {
    var panel = $('relMetersPanel'); if (!panel) return;
    setClass(panel, 'hidden', !wu);
    if (!wu) return;
    setText($('relMetersTitle'), t('rel_meters_title'));
    var ms = G.relationshipMeters(), html = '';
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i], meta = REL_META[m.id] || { icon: '•', tip: '' }, col = relColor(m.band);
      html += '<div class="rel-row rel-' + m.band + '" data-tip="' + meta.tip + '">' +
        '<span class="rel-ic">' + meta.icon + '</span>' +
        '<span class="rel-name">' + t('meter_' + (m.id === 'approval' ? 'trust' : m.id)) + '</span>' +
        '<span class="rel-bar"><span class="rel-fill" style="width:' + m.val + '%;background:' + col + '"></span></span>' +
        '<span class="rel-val" style="color:' + col + '">' + m.val + '</span>' +
        '</div>';
    }
    $('relMeters').innerHTML = html;
  }
  // cheap: just the company-tab mini risk bar (no offscreen alignment-tab DOM)
  function updateRiskMini() {
    var hv = G.highestVector(), pct = hv.val;
    var mfill = $('riskMiniFill');
    if (mfill) { setStyleP(mfill, 'width', pct + '%'); setStyleP(mfill, 'background', vecColor(pct)); }
    setText($('riskMiniPct'), Math.floor(pct) + '%');
  }
  function updateAlignment() {
    updateRiskMini();
    if (currentTab !== 'alignment') return;   // heavy DOM only when the tab is visible
    var s = G.state;
    // vector bars
    var html = '';
    C.RISK.VECTORS.forEach(function (vid) {
      var val = s.vec[vid], net = G.vectorNet(vid);
      // rising risk = ▲ +rate (red/bad); falling = ▼ −rate (green/good). Arrow AND sign
      // agree so "risk rising" is unambiguous (was an unsigned value next to an arrow).
      var rising = net > 0.001, falling = net < -0.001;
      var arrow = rising ? '▲' : (falling ? '▼' : '–');
      var sign = rising ? '+' : (falling ? '−' : '');
      html += '<div class="vrow">' +
        '<div class="vhead"><span class="vname">' + t('vec_' + vid) + '</span><span class="vpct">' + Math.floor(val) + '%</span></div>' +
        '<div class="bar"><div class="vfill" style="width:' + val + '%;background:' + vecColor(val) + '"></div></div>' +
        '<div class="vmeta muted small">' + t('vec_' + vid + '_d') + ' · <span class="' + (rising ? 'vup' : 'vdn') + '">' + arrow + ' ' + sign + Math.abs(net).toFixed(2) + '/s</span></div>' +
        '</div>';
    });
    $('vectorBars').innerHTML = html;
    // refresh the Safety-tier label live (it renames Safety→Trust & Safety→Containment by act)
    var sfx = { s: G.safetyLabel() };
    $('alignTitle').innerHTML = t('alignment_title', sfx) + infoBtn('tip_align');
    $('alignIntro').textContent = t('alignment_intro', sfx);
    $('alignLabel').textContent = t('alignment_label', sfx);
    $('alignOwned').textContent = s.align;
    $('alignSuppressTxt').textContent = t('align_suppress', { v: G.alignSuppress().toFixed(2) });
    var ac = G.alignCost();
    var btn = $('buyAlignBtn');
    btn.textContent = t('buy_alignment', sfx) + ' (' + fmt(ac) + ')';
    btn.disabled = s.cash < ac;
    // reactive audit (cooldown, not an instant crisis-clear)
    var ab = $('auditBtn');
    if (G.auditReady()) { ab.disabled = G.auditCost() <= 0 || s.cash < G.auditCost() || G.riskLevel() < 1; ab.textContent = t('audit_btn', { v: fmt(G.auditCost()) }); ab.classList.remove('cooldown'); }
    else { ab.disabled = true; ab.textContent = t('audit_cd', { t: FMT.fmtTime(G.auditCooldownLeft()) }); ab.classList.add('cooldown'); }
    // crisis penalty box (no instant contain — invest in alignment to prevent)
    var ib = $('incidentBox');
    if (G.incidentActive()) {
      ib.classList.remove('hidden');
      var remain = Math.max(0, (s.incidentEndsAt - Date.now()) / 1000);
      ib.innerHTML =
        '<div class="ititle">' + t('incident_active', { p: C.RISK.INCIDENT_PENALTY }) + '</div>' +
        '<div class="idesc">' + t('crisis_penalty_desc', { t: FMT.fmtTime(remain), s: G.safetyLabel() }) + '</div>';
    } else { ib.classList.add('hidden'); }
    // mini-stats
    function mini(label, val) { return '<div class="minicard"><div class="mlabel">' + label + '</div><div class="mval">' + val + '</div></div>'; }
    var hv = G.highestVector();
    $('alignMini').innerHTML =
      mini(t('mini_cps'), fmt(frameCps)) +
      mini(t('mini_output'), '×' + fmt(frameGM)) +
      mini(t('mini_toprisk'), t('vec_' + hv.id) + ' ' + Math.floor(hv.val) + '%') +
      mini(t('mini_suppress'), G.alignSuppress().toFixed(2));
  }

  // ---------- top bar / boost ----------
  function updateTop() {
    var s = G.state;
    var cps = frameCps;                 // computed once per frame in update()
    setOdometer($('cashVal'), s.cash);
    // DESIGN §1/§2: the topbar shows the TRUE NET cash rate (revenue − burn), WITH its real sign —
    // not the gross income that used to read "+14/sec" while cash plummeted. Negative = red, the
    // burn is winning; positive = green, you're profitable. Garage (no product, no burn) reads $0.
    var net = G.netCashRate();
    var cv = $('cpsVal');
    if (!isFinite(net)) net = 0;
    var sign = net < -1e-9 ? '−' : (net > 1e-9 ? '+' : '');
    setText(cv, sign + '$' + fmt(Math.abs(net)) + t('per_sec_suffix'));
    setClass(cv, 'rate-neg', net < -1e-9);
    setClass(cv, 'rate-pos', net > 1e-9);
    setText($('tapValue'), '+' + fmt(G.tapValue()));

    // atmosphere intensity rises with output toward AGI — quantized so we only
    // write the (document-wide, recalc-forcing) custom property when it visibly moves.
    var inten = Math.max(0, Math.min(1, (Math.log10(cps + 10) - 1) / 9));
    var iq = Math.round(inten * 50) / 50;   // 0.02 steps
    if (iq !== _lastInten) {
      _lastInten = iq;
      document.documentElement.style.setProperty('--intensity', iq.toFixed(3));
      if (window.GAME_MUSIC) window.GAME_MUSIC.setIntensity(iq);
    }
    // discrete evolving backdrop stage (highest hardware tier + singularity)
    var hi = -1;
    for (var gx = 0; gx < C.GENERATORS.length; gx++) if (s.gens[C.GENERATORS[gx].id] > 0) hi = gx;
    var stage = Math.min(4, Math.floor((hi + 1) / 2.6));
    if (s.singularities > 0) stage = 5;
    if (document.documentElement.getAttribute('data-stage') !== String(stage)) document.documentElement.setAttribute('data-stage', String(stage));

    // overclock heat -> combo bar + button glow
    var heat = s.comboHeat || 0;
    var hq = Math.round(heat * 100) / 100;
    if (hq !== _lastHeat) { _lastHeat = hq; $('tapBtn').style.setProperty('--heat', hq.toFixed(2)); }
    var cw = $('comboWrap');
    if (heat > 0.02) {
      setClass(cw, 'on', true);
      setText($('comboName'), t('combo_label'));
      setText($('comboMult'), '×' + (1 + G.comboBonus()).toFixed(1));
      setStyleP($('comboFill'), 'width', (heat * 100).toFixed(1) + '%');
    } else { setClass(cw, 'on', false); }

    // breakthrough button (Stage 2 reveal)
    var btn = $('breakthroughBtn');
    if (!G.breakthroughUnlocked()) { setClass(btn, 'hidden', true); }
    else {
    setClass(btn, 'hidden', false);
    if (G.breakthroughActive()) {
      btn.disabled = true;
      setText(btn, t('breakthrough_active', { t: FMT.fmtTime((s.breakthroughEndsAt - Date.now()) / 1000) }));
      setClass(btn, 'bt-active', true);
    } else if (G.breakthroughReady()) {
      btn.disabled = false;
      setText(btn, t('breakthrough_btn') + ' · ' + t('breakthrough_ready'));
      setClass(btn, 'bt-active', false);
    } else {
      btn.disabled = true;
      setText(btn, t('breakthrough_btn') + ' · ' + FMT.fmtTime(G.breakthroughCooldownLeft()));
      setClass(btn, 'bt-active', false);
    }
    }

    // buff badge (priority: breakthrough > frenzy > clickFrenzy > ad boost)
    var bb = $('boostBadge');
    if (G.breakthroughActive()) {
      setClass(bb, 'hidden', false);
      setText(bb, t('buff_breakthrough', { m: s.breakthroughMult, t: FMT.fmtTime((s.breakthroughEndsAt - Date.now()) / 1000) }));
    } else if (G.frenzyActive()) {
      setClass(bb, 'hidden', false);
      setText(bb, t('buff_frenzy', { m: s.frenzyMult, t: FMT.fmtTime((s.frenzyEndsAt - Date.now()) / 1000) }));
    } else if (G.clickFrenzyActive()) {
      setClass(bb, 'hidden', false);
      setText(bb, t('buff_click', { m: s.clickFrenzyMult, t: FMT.fmtTime((s.clickFrenzyEndsAt - Date.now()) / 1000) }));
    } else if (G.boostActive()) {
      setClass(bb, 'hidden', false);
      setText(bb, t('boost_active', { t: FMT.fmtTime((s.boostUntil - Date.now()) / 1000) }));
    } else setClass(bb, 'hidden', true);
    var eb = $('eventBadge');
    if (G.eventActive() && s.eventId) {
      setClass(eb, 'hidden', false);
      setClass(eb, 'bad', s.eventId === 'shortage');
      setText(eb, t('ev_active', { name: t('ev_' + s.eventId), t: FMT.fmtTime((s.eventEndsAt - Date.now()) / 1000) }));
    } else setClass(eb, 'hidden', true);
    // persistent race-status badge (item 3): '#1 market share' when leading, switches to
    // 'Helion 78% AGI' as a rival closes in. Shown from mid-game (once rivals are revealed).
    var rb = $('raceBadge');
    if (rb) {
      var rs = G.raceStatus && G.raceStatus();
      if (rs && rs.kind === 'lead') {
        setClass(rb, 'hidden', false); setClass(rb, 'threat', false);
        setText(rb, t('race_lead_badge'));
      } else if (rs && rs.kind === 'threat') {
        setClass(rb, 'hidden', false); setClass(rb, 'threat', true);
        setText(rb, t('race_threat_badge', { name: G.rivalName(rs.id), p: rs.pct }));
      } else setClass(rb, 'hidden', true);
    }
    updateInboxBadge();   // decision inbox count (Phase 2)
  }

  // ---------- Runway HUD (Phase 2 burn→runway headline) ----------
  // "Runway: 14 mo" with green(>6mo)/amber(3-6mo)/red(<3mo) states (or "Profitable" when
  // net burn ≤ 0), plus a small "−$X/mo burn · +$Y/mo revenue" line. Hidden until v1 ships
  // (no burn pressure in the garage). Color thresholds match DESIGN §1 telegraphing.
  function updateRunway() {
    var bar = $('runwayBar'); if (!bar) return;
    var s = G.state;
    var burn = G.monthlyBurn(), rev = G.monthlyRevenue();
    // remember the latest burn/rev so a tap on the strip can surface the detail (folded out
    // of the always-on sub-line; the full breakdown also lives on the Stats tab).
    _runwayFlow = { burn: burn, rev: rev };
    // The strip carries the runway headline once a product exists; it also hosts the inline
    // boost/event/race chips, so keep it visible whenever any of those is active (e.g. an
    // early boost in the garage before v1 ships). The runway label itself is gen-gated.
    var hasProduct = s.modelGen >= 1;
    var anyChip = !$('boostBadge').classList.contains('hidden')
               || !$('eventBadge').classList.contains('hidden')
               || !$('raceBadge').classList.contains('hidden');
    if (!hasProduct && !anyChip) { setClass(bar, 'hidden', true); return; }
    setClass(bar, 'hidden', false);
    // runway headline (hidden in the garage; chips can still show)
    setClass($('runwayLabel'), 'hidden', !hasProduct);
    setClass($('runwayVal'), 'hidden', !hasProduct);
    var state = 'green';
    if (hasProduct) {
      setText($('runwayLabel'), t('runway_label'));
      var profitable = G.isProfitable();
      var months = G.runwayMonths();
      if (profitable) { setText($('runwayVal'), t('runway_profitable')); state = 'profit'; }
      else {
        // plain-language relabel: runway shown in DAYS (locked glossary)
        var days = G.runwayDays();
        var dispD = days >= 9999 ? '999+' : Math.round(days);
        setText($('runwayVal'), t('runway_days', { n: dispD }));
        state = months > 6 ? 'green' : (months >= 3 ? 'amber' : 'red');
      }
    }
    setClass(bar, 'amber', state === 'amber');
    setClass(bar, 'red', state === 'red');
    setClass(bar, 'profit', state === 'profit');
    // Phase 3: in-danger CTA re-opens the crisis panel any time (so a dismissed modal isn't lost)
    var cta = $('crisisCta');
    if (cta) {
      var acq = G.acquisitionActive();
      var danger = !G.isGameOver() && (acq || G.inBankruptcyDanger());
      setClass(cta, 'hidden', !danger);
      if (danger) setText(cta, acq ? t('crisis_acq_title') : t('crisis_title'));
    }
  }

  // ---------- Day counter + always-on finance line + pre-revenue hint + debt banner ----------
  // DESIGN §2 (owner's #1 complaint: "nowhere written what money is deducted for"): the finance
  // line is ALWAYS visible. DESIGN §5: "Day N" anchors time (the debt banner references it).
  // DESIGN §6: a pre-revenue hint explains "0 income" as a stage, not a bug. Tap the line for the
  // full per-line breakdown.
  var _financeFlow = null;   // latest breakdown for the tap-to-reveal tip
  function updateFinanceLine() {
    var s = G.state;
    // Day N — always shown.
    setText($('dayLabel'), t('day_counter', { n: G.dayNow() }));

    var bd = G.burnBreakdown();
    var rev = G.monthlyRevenue();
    // net monthly cash = revenue − burn (incl. debt interest). netMonthlyBurn() = burn − revenue,
    // so net = −netMonthlyBurn(). Negative = bleeding, positive = profitable.
    var netMonthly = -G.netMonthlyBurn();
    _financeFlow = { rev: rev, bd: bd, net: netMonthly, inRed: G.inRed() };

    var nsign = netMonthly < -1e-9 ? '−' : (netMonthly > 1e-9 ? '+' : '');
    // compact, always-on summary: income · costs(parts) · net · runway
    var dc = t('finance_dot');
    var runwayTxt;
    if (G.isProfitable()) runwayTxt = t('finance_runway_profit');
    else if (G.inRed()) runwayTxt = t('finance_runway_red');
    else { var dd = G.runwayDays(); var disp = dd >= 9999 ? '999+' : Math.round(dd); runwayTxt = t('finance_runway', { n: disp }); }
    var html =
      '<span class="fin-in">' + t('finance_income', { y: fmt(rev) }) + '</span>' + dc +
      '<span class="fin-out">' + t('finance_costs', { x: fmt(bd.total) }) +
      ' <span class="fin-parts">(' + t('finance_costs_parts') + ')</span></span>' + dc +
      '<span class="fin-net' + (netMonthly < -1e-9 ? ' neg' : (netMonthly > 1e-9 ? ' pos' : '')) + '">' +
        t('finance_net', { sign: nsign, z: fmt(Math.abs(netMonthly)) }) + '</span>' + dc +
      '<span class="fin-rw">' + runwayTxt + '</span>';
    setHTML($('financeLine'), html);

    // pre-revenue hint (DESIGN §6): before the first model ships, "0 income" is a STAGE.
    var preRev = (G.state.modelGen || 0) < 1 && rev <= 0;
    setClass($('preRevHint'), 'hidden', !preRev);
    if (preRev) setText($('preRevHint'), t('pre_revenue_hint'));

    // loud red debt banner (DESIGN §4) — only while in the red.
    var db = $('debtBanner');
    if (G.inRed() && !G.isGameOver()) {
      setClass(db, 'hidden', false);
      var bankDay = G.redBankruptDay();
      // how deep toward the instant-insolvency ceiling are we (for the urgent variant)?
      var ceiling = G.debtCeiling();   // negative
      var pct = ceiling < 0 ? Math.max(0, Math.min(100, Math.round(s.cash / ceiling * 100))) : 0;
      if (pct >= 70) setText($('debtBannerText'), t('debt_banner_near', { n: bankDay, pct: pct }));
      else setText($('debtBannerText'), t('debt_banner_grace', { n: bankDay }));
    } else setClass(db, 'hidden', true);
  }

  // ---------- GAME-OVER screen (DESIGN §4) ----------
  // A full-screen overlay shown the instant ANY finale fires. It BLOCKS all play (taps/buys are
  // gated on G.isGameOver() in the handlers; this overlay also sits on top capturing pointer
  // events). It shows the ending title + flavor (companyName), the run summary (final share,
  // days survived, valuation, generation, record flag), and two buttons: New Game (→ difficulty
  // select → fresh run) and View Stats.
  function endingTitleKey(eid, won) {
    return won ? 'go_title_win' : 'go_title_lose';
  }
  function updateGameOver() {
    var scr = $('gameOverScreen'); if (!scr) return;
    if (!G.isGameOver()) { setClass(scr, 'hidden', true); return; }
    if (!scr.classList.contains('hidden')) return;   // already shown — don't re-render every frame
    setClass(scr, 'hidden', false);
    var s = G.state;
    var eid = s.ending || 'aligned';
    var won = !!s.won;
    setText($('goTitle'), t(endingTitleKey(eid, won)));
    setText($('goEmblem'), won ? '✸' : '✕');
    setClass($('goCard'), 'win', won);
    setClass($('goCard'), 'lose', !won);
    setText($('goCompany'), s.companyName || 'Singularity Inc.');
    setText($('goFlavor'), t('ending_' + eid + '_t') + ' — ' + t('ending_' + eid + '_d', { co: s.companyName || 'Singularity Inc.' }));
    // run summary
    var days = Math.floor((s.playtime || 0) / (C.DAY_SEC || 60));
    var rows = [
      [t('go_sum_ending'), t('ending_' + eid + '_t')],
      [t('go_sum_days'), String(days)],
      [t('go_sum_share'), (Math.round((s.marketShare || 0) * 10) / 10) + '%'],
      [t('go_sum_val'), '$' + fmt(G.valuation())],
      [t('go_sum_gen'), 'v' + (s.modelGen || 0)]
    ];
    setHTML($('goSummary'), rows.map(function (r) {
      return '<div class="go-row"><span class="go-k">' + r[0] + '</span><span class="go-v">' + r[1] + '</span></div>';
    }).join(''));
    // record flag (Phase 9): set in recordGameEnd when this run beat a difficulty best.
    var rec = $('goRecord');
    if (s._lastRunRecord) { setClass(rec, 'hidden', false); setText(rec, t('go_record', { diff: t('diff_' + (s.difficulty || 'normal')) })); }
    else setClass(rec, 'hidden', true);
    setText($('goNewGame'), t('go_new_game'));
    setText($('goStats'), t('go_view_stats'));
  }

  // ---------- World: news cards, crises, market ----------
  function cardTag(kind) { return kind === 'crisis' ? t('tag_crisis') : kind === 'opportunity' ? t('tag_opportunity') : t('tag_decision'); }
  function cardChoiceLabel(cardId, choiceId) { return t(cardId + '_' + choiceId); }
  function renderCardHTML(card) {
    var tpl = G.cardTemplate(card); if (!tpl) return '';
    var remain = Math.max(0, (card.expiresAt - Date.now()) / 1000);
    var btns = tpl.choices.map(function (ch) {
      return '<button class="cardchoice" data-uid="' + card.uid + '" data-ch="' + ch.id + '">' + cardChoiceLabel(card.id, ch.id) + '</button>';
    }).join('');
    return '<div class="newscard ' + card.kind + '">' +
      '<div class="nc-tag">' + cardTag(card.kind) + '</div>' +
      '<div class="nc-title">' + t(card.id + '_t') + '</div>' +
      '<div class="nc-desc">' + t(card.id + '_d') + '</div>' +
      '<div class="nc-timer muted small">' + t('card_expires', { t: FMT.fmtTime(remain) }) + '</div>' +
      '<div class="nc-choices">' + btns + '</div></div>';
  }
  function wireCardButtons(container) {
    var bs = container.querySelectorAll('.cardchoice');
    for (var i = 0; i < bs.length; i++) {
      (function (b) {
        b.addEventListener('click', function () {
          if (G.resolveCard(parseInt(b.dataset.uid, 10), b.dataset.ch)) {
            window.GAME_AUDIO.buy(); window.GAME_FX.flash('rgba(34,211,238,0.2)'); hideModal(); updateWorld();
          }
        });
      })(bs[i]);
    }
  }
  function showCrisisModal() {
    var crisis = null; for (var i = 0; i < G.state.cards.length; i++) if (G.state.cards[i].kind === 'crisis') crisis = G.state.cards[i];
    if (!crisis) return;
    showModal('<div class="crisis-modal">' + renderCardHTML(crisis) + '</div>');
    wireCardButtons($('modalRoot'));
  }

  // ========== Phase 3 FAILURE STATES — crisis surfacing ================
  // One recovery-lever button per AVAILABLE lever (leverAvailable()). Each ships a label +
  // a one-line cost so the trade is legible. Reused by the red-pressure event AND the final
  // ultimatum; `mode` ('red'|'ultimatum') only changes the framing copy.
  var C_CR_UI = C.CRISIS;
  function recoveryLeverButtons() {
    var av = G.leverAvailable(), out = '';
    function row(id, label, desc, enabled) {
      return '<div class="cr-lever">' +
        '<button class="cardchoice cr-lever-btn" data-lever="' + id + '"' + (enabled ? '' : ' disabled') + '>' +
        '<span class="cr-lever-l">' + label + '</span>' +
        '<span class="cr-lever-d muted small">' + desc + '</span></button></div>';
    }
    if (av.raise)     out += row('raise', t('crisis_lever_raise'), t('crisis_lever_raise_d'), true);
    out += row('downround', t('crisis_lever_downround'), t('crisis_lever_downround_d'), true);
    if (av.debt)      out += row('debt', t('crisis_lever_debt'), t('crisis_lever_debt_d', { m: C_CR_UI.DEBT_REPAY_MULT }), true);
    if (av.layoffs)   out += row('layoffs', t('crisis_lever_layoffs'), t('crisis_lever_layoffs_d', { p: Math.round(C_CR_UI.LAYOFF_FRAC * 100) }), true);
    if (av.pivot)     out += row('pivot', t('crisis_lever_pivot'), t('crisis_lever_pivot_d'), true);
    return out;
  }
  function wireLeverButtons(container, onUse) {
    var bs = container.querySelectorAll('.cr-lever-btn');
    for (var i = 0; i < bs.length; i++) (function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        if (G.useRecoveryLever(b.dataset.lever)) {
          window.GAME_AUDIO.buy(); window.GAME_FX.flash('rgba(34,211,238,0.18)');
          if (onUse) onUse(b.dataset.lever);
        }
      });
    })(bs[i]);
  }
  // bankruptcy recovery modal (red pressure OR final ultimatum).
  var _crisisModalOpen = false;
  function showRecoveryModal(mode) {
    if (G.isGameOver()) return;
    var mr = $('modalRoot');
    if (mr && !mr.classList.contains('hidden') && !_crisisModalOpen) { setTimeout(function () { showRecoveryModal(mode); }, 700); return; }
    window.GAME_AUDIO.incident(); buzz([0, 40, 70, 40]);
    if (window.GAME_FX) window.GAME_FX.flash('rgba(251,92,120,0.28)');
    _crisisModalOpen = true;
    var ult = mode === 'ultimatum';
    var html = '<div class="crisis-modal cr-danger">' +
      '<div class="newscard crisis">' +
        '<div class="nc-tag">' + t(ult ? 'crisis_ultimatum_title' : 'crisis_title') + '</div>' +
        '<div class="nc-title">' + t(ult ? 'crisis_ultimatum_title' : 'crisis_runway_title') + '</div>' +
        '<div class="nc-desc">' + t(ult ? 'crisis_ultimatum_body' : 'crisis_red_body', { co: coName() }) + '</div>' +
        '<div class="cr-levers">' + recoveryLeverButtons() + '</div>' +
        '<div class="row"><button class="secondary" id="crClose">' + t('crisis_lever_done') + '</button></div>' +
      '</div></div>';
    showModal(html);
    wireLeverButtons($('modalRoot'), function () {
      _crisisModalOpen = false; hideModal(); updateRunway(); updateWorld();
      toast(t('crisis_survived_toast'), 'gold');
    });
    if ($('crClose')) $('crClose').onclick = function () { _crisisModalOpen = false; hideModal(); };
  }

  // hostile-acquisition ultimatum modal (Sub-part B). Fight options + the recovery levers.
  function showAcquisitionModal() {
    if (G.isGameOver() || !G.acquisitionActive()) return;
    var mr = $('modalRoot');
    if (mr && !mr.classList.contains('hidden') && !_crisisModalOpen) { setTimeout(showAcquisitionModal, 700); return; }
    window.GAME_AUDIO.incident(); buzz([0, 50, 80, 50]);
    if (window.GAME_FX) window.GAME_FX.flash('rgba(251,92,120,0.3)');
    _crisisModalOpen = true;
    var a = G.state.crisis.acq;
    var pillCost = C_CR_UI.ACQ_PILL_CASH_MONTHS;
    var canPill = G.state.cash >= G.monthlyBurn() * pillCost;
    var html = '<div class="crisis-modal cr-danger">' +
      '<div class="newscard crisis">' +
        '<div class="nc-tag">' + t('crisis_acq_title') + '</div>' +
        '<div class="nc-title">' + t('crisis_acq_body', { rival: a.name, co: coName(), v: fmt(a.offer), p: Math.round(C_CR_UI.ACQ_POACH_FRAC * 100) }) + '</div>' +
        '<div class="cr-countdown">' + t('crisis_acq_turns', { n: a.turnsLeft }) + '</div>' +
        '<div class="cr-section">' + t('crisis_acq_fight_title') + '</div>' +
        '<div class="cr-lever"><button class="cardchoice cr-lever-btn" data-fight="pill"' + (canPill ? '' : ' disabled') + '>' +
          '<span class="cr-lever-l">' + t('crisis_acq_pill') + '</span>' +
          '<span class="cr-lever-d muted small">' + t('crisis_acq_pill_d', { m: pillCost }) + '</span></button></div>' +
        '<div class="cr-section muted small">' + t('crisis_acq_levers_note') + '</div>' +
        '<div class="cr-levers">' + recoveryLeverButtons() + '</div>' +
        '<div class="row"><button class="danger-btn" id="crAccept">' + t('crisis_acq_accept') + '</button>' +
        '<button class="secondary" id="crClose">' + t('crisis_lever_done') + '</button></div>' +
      '</div></div>';
    showModal(html);
    function close() { _crisisModalOpen = false; hideModal(); updateRunway(); updateWorld(); }
    wireLeverButtons($('modalRoot'), function () { close(); });
    var pill = $('modalRoot').querySelector('[data-fight="pill"]');
    if (pill) pill.addEventListener('click', function () {
      if (pill.disabled) return;
      if (G.acqPoisonPill()) { window.GAME_AUDIO.buy(); window.GAME_FX.flash('rgba(34,211,238,0.18)'); close(); toast(t('crisis_survived_toast'), 'gold'); }
    });
    // accept the acqui-hire: a two-tap confirm inline (no native confirm() — Yandex moderation).
    if ($('crAccept')) $('crAccept').onclick = function () {
      var btn = $('crAccept');
      if (btn.dataset.armed !== '1') {
        btn.dataset.armed = '1';
        setText(btn, t('crisis_acq_accept_confirm', { rival: a.name }));
        return;
      }
      _crisisModalOpen = false; hideModal();
      G.acqAccept();   // fires the 'absorbed' ending (its cinematic takes over)
    };
    if ($('crClose')) $('crClose').onclick = function () { _crisisModalOpen = false; hideModal(); };
  }

  // nationalization warning modal (Sub-part C) — a rally-or-lose beat (no levers; play it out).
  function showNationalizeModal() {
    if (G.isGameOver()) return;
    var mr = $('modalRoot');
    if (mr && !mr.classList.contains('hidden') && !_crisisModalOpen) { setTimeout(showNationalizeModal, 700); return; }
    window.GAME_AUDIO.incident(); buzz([0, 60, 90, 60]);
    if (window.GAME_FX) window.GAME_FX.flash('rgba(251,92,120,0.3)');
    _crisisModalOpen = true;
    var html = '<div class="crisis-modal cr-danger">' +
      '<div class="newscard crisis">' +
        '<div class="nc-tag">' + t('crisis_nat_title') + '</div>' +
        '<div class="nc-title">' + t('crisis_nat_title') + '</div>' +
        '<div class="nc-desc">' + t('crisis_nat_body', { co: coName() }) + '</div>' +
        '<div class="row"><button class="primary" id="crClose">' + t('crisis_lever_done') + '</button></div>' +
      '</div></div>';
    showModal(html);
    if ($('crClose')) $('crClose').onclick = function () { _crisisModalOpen = false; hideModal(); };
  }

  // ---------- Decision engine surfacing (Phase 2, Sub-part D) ----------
  // render one decision event as a card. `cls` styles the tag (decision/bankable).
  function metersLine(opt) {
    if (!opt.tooltip_meters || !opt.tooltip_meters.length) return '';
    var names = opt.tooltip_meters.map(function (m) { return t('meter_' + m) || m; });
    return '<div class="nc-meters">' + t('decision_meters', { m: names.join(' · ') }) + '</div>';
  }
  function renderDecisionHTML(ev, cls, uid, incident, blackswan) {
    var btns = ev.options.map(function (op) {
      return metersLine(op) +
        '<button class="cardchoice" data-ev="' + ev.id + '" data-op="' + op.id + '"' + (uid != null ? ' data-uid="' + uid + '"' : '') + '>' +
        t(ev.id + '_' + op.id) + '</button>';
    }).join('');
    // PHASE 8: black swans wear a red "BLACK SWAN" tag and the crisis (red) card styling.
    var tag = blackswan ? t('tag_blackswan') : incident ? t('tag_incident') : t(cls === 'bankable' ? 'tag_bankable' : 'tag_interrupt');
    var cardCls = blackswan ? 'crisis nc-blackswan' : (incident ? 'crisis' : (cls || 'decision'));
    return '<div class="newscard ' + cardCls + '">' +
      '<div class="nc-tag">' + tag + '</div>' +
      '<div class="nc-title">' + t(ev.id + '_t') + '</div>' +
      '<div class="nc-desc">' + t(ev.id + '_d') + '</div>' +
      '<div class="nc-choices">' + btns + '</div></div>';
  }
  function wireDecisionButtons(container, onResolve) {
    var bs = container.querySelectorAll('.cardchoice[data-ev]');
    for (var i = 0; i < bs.length; i++) {
      (function (b) {
        b.addEventListener('click', function () {
          var uid = b.dataset.uid != null ? parseInt(b.dataset.uid, 10) : null;
          if (G.resolveDecision(b.dataset.ev, b.dataset.op, uid)) {
            window.GAME_AUDIO.buy(); window.GAME_FX.flash('rgba(139,92,246,0.20)');
            if (onResolve) onResolve();
          }
        });
      })(bs[i]);
    }
  }
  // INTERRUPT: pop a modal immediately (regardless of current tab).
  // While it's open we pause idle gain (a clean gate read by the main loop).
  var _interruptOpen = false;
  function showDecisionModal(ev, opts) {
    opts = opts || {};
    window.GAME_AUDIO.incident(); buzz(opts.blackswan ? [0, 60, 90, 60, 90] : [0, 30, 50, 30]);
    // incidents + black swans flash red (a felt consequence), regular decisions stay purple.
    // black swans flash harder (a deeper red) — the existential framing.
    window.GAME_FX.flash(opts.blackswan ? 'rgba(251,92,120,0.42)' : opts.incident ? 'rgba(251,92,120,0.28)' : 'rgba(139,92,246,0.25)');
    if ((opts.incident || opts.blackswan) && window.GAME_FX.incident) window.GAME_FX.incident();
    _interruptOpen = true;
    var wrap = (opts.incident || opts.blackswan) ? 'crisis-modal cr-danger' : 'crisis-modal';
    showModal('<div class="' + wrap + '">' + renderDecisionHTML(ev, 'decision', null, opts.incident, opts.blackswan) + '</div>');
    wireDecisionButtons($('modalRoot'), function () {
      _interruptOpen = false; hideModal(); updateInboxBadge(); updateWorld();
      // SUB-PART B: the first scandal IS the tutorial — reveal the Safety lab afterwards.
      if (opts.teach) showSafetyReveal();
    });
  }
  // teach-by-scandal reveal: one plain-language explainer (DESIGN §4), then open Safety.
  function showSafetyReveal() {
    _interruptOpen = true;
    var html = '<div class="crisis-modal">' +
      '<div class="newscard decision">' +
        '<div class="nc-tag">' + t('tab_alignment') + '</div>' +
        '<div class="nc-title">' + t('safety_reveal_t') + '</div>' +
        '<div class="nc-desc" style="white-space:pre-line">' + t('safety_reveal_d') + '</div>' +
        '<div class="nc-choices"><button class="cardchoice" id="safetyRevealOk">' + t('safety_reveal_ok') + '</button></div>' +
      '</div></div>';
    showModal(html);
    var ok = $('safetyRevealOk');
    if (ok) ok.onclick = function () {
      window.GAME_AUDIO.buy(); _interruptOpen = false; G.markSafetyRevealed(); hideModal();
      location.hash = '#alignment'; switchTab('alignment'); update();
    };
  }
  // paused only while the interrupt modal is genuinely on screen (robust against any
  // path that hides the modal without going through the resolve callback).
  function isPaused() {
    if (!_interruptOpen) return false;
    var m = $('modalRoot');
    if (!m || m.classList.contains('hidden')) { _interruptOpen = false; return false; }
    return true;
  }
  // INBOX badge (bankable count) — lives in the topbar.
  function updateInboxBadge() {
    var b = $('inboxBadge'); if (!b) return;
    var n = (G.state.inbox || []).length;
    setClass(b, 'hidden', n === 0);
    setText($('inboxCount'), n);
  }
  // INBOX list modal — each pending bankable decision is resolvable inline.
  function showInboxModal() {
    var inbox = G.state.inbox || [];
    var now = Date.now();
    var items = inbox.map(function (it) {
      var ev = G.decisionById(it.id); if (!ev) return '';
      var left = Math.max(0, (it.autoAt - now) / 1000);
      return '<div class="inbox-item" data-uid="' + it.uid + '">' +
        '<div class="ii-title">' + t(it.id + '_t') + '</div>' +
        '<div class="ii-auto">' + t('inbox_auto', { t: FMT.fmtTime(left) }) + '</div>' +
        renderDecisionHTML(ev, 'bankable', it.uid) +
        '</div>';
    }).join('');
    if (!items) items = '<div class="inbox-empty">' + t('inbox_empty') + '</div>';
    showModal('<h3>' + t('inbox_title') + '</h3><div class="inbox-list">' + items + '</div>' +
      '<div class="row"><button class="primary" id="inboxClose">✕</button></div>');
    wireDecisionButtons($('modalRoot'), function () {
      updateInboxBadge();
      if ((G.state.inbox || []).length) showInboxModal(); else { hideModal(); updateWorld(); }
    });
    if ($('inboxClose')) $('inboxClose').onclick = hideModal;
  }
  function sparkline(hist) {
    if (!hist || hist.length < 2) return '';
    var min = Math.min.apply(null, hist), max = Math.max.apply(null, hist), rng = (max - min) || 1;
    var n = hist.length, pts = hist.map(function (v, i) { return (i / (n - 1) * 60).toFixed(1) + ',' + (20 - (v - min) / rng * 18).toFixed(1); }).join(' ');
    var up = hist[n - 1] >= hist[0];
    return '<svg class="spark" viewBox="0 0 60 20" preserveAspectRatio="none"><polyline points="' + pts + '" fill="none" stroke="' + (up ? 'var(--green)' : 'var(--rose)') + '" stroke-width="1.5"/></svg>';
  }
  function buildMarket() {
    var list = $('marketList'); if (!list) return; list.innerHTML = '';
    C.MARKET.assets.forEach(function (a) {
      var row = el('div', 'mkrow'); row.dataset.aid = a.id;
      row.innerHTML =
        '<div class="mk-info"><div class="mk-name">' + t('mk_' + a.id) + ' <span class="mk-sym">' + a.id + '</span></div>' +
        '<div class="mk-hold muted small"></div></div>' +
        '<div class="mk-spark"></div>' +
        '<div class="mk-price"></div>' +
        '<div class="mk-act"><button class="mk-buy" data-aid="' + a.id + '">' + t('market_buy') + '</button>' +
        '<button class="mk-sell" data-aid="' + a.id + '">' + t('market_sell') + '</button></div>';
      list.appendChild(row);
      row.querySelector('.mk-buy').addEventListener('click', function () { if (G.marketBuy(a.id, G.state.cash * 0.1)) { window.GAME_AUDIO.buy(); updateWorld(); } });
      row.querySelector('.mk-sell').addEventListener('click', function () { if (G.marketSell(a.id, 1)) { window.GAME_AUDIO.buy(); updateWorld(); } });
    });
  }
  function updateWorld() {
    var unlocked = G.worldUnlocked();
    $('worldLocked').classList.toggle('hidden', unlocked);
    // worldNewsTitle/cardList visibility is owned by the decision-card logic below (so the
    // "Newsroom" band drops entirely when there are no decisions); only force them hidden
    // while the world layer is still locked.
    ['standingsPanel', 'newsFlavorTitle', 'newsFlavor'].forEach(function (id) { var e = $(id); if (e) setClass(e, 'hidden', !unlocked); });
    if (!unlocked) { setClass($('worldNewsTitle'), 'hidden', true); setClass($('cardList'), 'hidden', true); }
    if (!unlocked) { $('worldLocked').innerHTML = '<div class="es-icon">' + ic('ic_world') + '</div>' + t('world_locked'); return; }
    // AGI finale banner (win / beaten) + optional Founder's Legacy
    var fb = $('finaleBanner');
    if (fb) {
      if (G.isGameOver()) {
        setClass(fb, 'hidden', false);
        var won = G.state.won, eid = G.state.ending || 'aligned';
        // Phase 3: failure endings get their own "GAME OVER" headline (not "BEATEN TO AGI").
        var failEnding = eid === 'bankrupt' || eid === 'absorbed' || eid === 'nationalized';
        setText($('finaleTitle'), won ? t('agi_title') : (failEnding ? t('finale_failed') : t('finale_beaten')));
        setClass($('finaleTitle'), 'beaten', !won);
        setText($('finaleDesc'), t('ending_' + eid + '_t') + ' — ' + t('ending_' + eid + '_d'));
        // endings collection: progress + the +%/ending perk + a badge per ending
        var nEnd = G.endingsUnlocked(), mEnd = C.ENDINGS.list.length;
        setText($('finaleEndingsProgress'),
          t('endings_progress', { n: nEnd, m: mEnd }) + ' · ' + t('ending_perk_note', { p: Math.round(C.ENDINGS.PERK_PER * 100) }));
        var grid = $('finaleEndingsGrid');
        if (grid) {
          var gsig = 'fe' + nEnd;
          if (grid.dataset.sig !== gsig) {
            grid.dataset.sig = gsig;
            grid.innerHTML = C.ENDINGS.list.map(function (id) {
              var got = !!G.state.endings[id];
              return '<span class="end-badge' + (got ? ' got' : '') + '" data-tip="' +
                (got ? t('ending_' + id + '_d') : t('ending_locked')) + '">' +
                (got ? t('ending_' + id + '_t') : '???') + '</span>';
            }).join('');
          }
        }
        setText($('legacyBtn'), t('legacy_btn', { p: Math.round(G.legacyNextBonus() * 100) }));
        setText($('legacyNote'), t('legacy_note'));
      } else setClass(fb, 'hidden', true);
    }
    updateStandings();   // the race standings live here now (GDD v3)
    // active cards (skip crises here — they appear as a modal; but still list them).
    // Only REBUILD the list when the card set changes; tick the countdowns cheaply.
    var cl = $('cardList');
    var order = { crisis: 0, opportunity: 1, decision: 2 };
    var sorted = G.state.cards.slice().sort(function (a, b) { return (order[a.kind] || 9) - (order[b.kind] || 9); });
    var sig = sorted.map(function (c) { return c.uid + c.id; }).join('|');
    // No decisions on the table → drop the whole "Newsroom" band (heading + empty-state)
    // so the World tab breathes; the HEADLINES feed below still carries the narrative.
    var hasCards = sorted.length > 0;
    var wnt = $('worldNewsTitle'); if (wnt) setClass(wnt, 'hidden', !hasCards);
    setClass(cl, 'hidden', !hasCards);
    if (sig !== _lastCardSig) {
      _lastCardSig = sig;
      cl.innerHTML = sorted.map(renderCardHTML).join(''); wireCardButtons(cl);
    } else {
      // refresh only the countdown labels in place
      var timers = cl.querySelectorAll('.nc-timer');
      for (var ti = 0; ti < timers.length && ti < sorted.length; ti++) {
        setText(timers[ti], t('card_expires', { t: FMT.fmtTime(Math.max(0, (sorted[ti].expiresAt - Date.now()) / 1000)) }));
      }
    }
    // Newsroom — REAL feed (newest first) from the live newsLog; stage flavor only
    // fills in when no real headlines exist yet (so it's never empty).
    var log = G.state.newsLog || [];
    var nf = $('newsFlavor');
    if (log.length) {
      nf.innerHTML = log.slice(0, 14).map(newsRowHTML).join('');
    } else {
      nf.innerHTML = currentNews().map(function (h) { return '<div class="flavor-line">• ' + esc(h) + '</div>'; }).join('');
    }
  }

  // ---------- R9: acts, race, endings ----------
  function actId(i) { return C.ACTS[Math.max(0, Math.min(C.ACTS.length - 1, i))].id; }
  function updateActBar() {
    var a = G.state.act, bar = $('actBar');
    // always-visible current-act tag on the topbar so the narrative arc is legible (item 6)
    var tag = $('actTag');
    if (tag) {
      if (a < 1) setClass(tag, 'hidden', true);
      else { setClass(tag, 'hidden', false); setText(tag, t('act_topbar', { n: a + 1, name: t('act_' + actId(a) + '_short') })); }
    }
    if (a < 1) { setClass(bar, 'hidden', true); return; }
    setClass(bar, 'hidden', false);
    var prog = a >= 2 ? G.agiProgress() : (a * 20);
    setStyleP($('actFill'), 'width', prog.toFixed(1) + '%');
  }
  // Don't clobber an open modal — so the model-ship SUMMARY shows first, then the act
  // intro chains after it (they can fire in the same tick when v1 ships).
  function showActIntroDeferred(a) {
    var mr = $('modalRoot');
    if (mr && !mr.classList.contains('hidden')) { setTimeout(function () { showActIntroDeferred(a); }, 700); return; }
    showActIntro(a);
  }
  function showActIntro(a) {
    var id = actId(a);
    var body = '<div class="act-intro"><div class="act-num">' + t('act_label', { n: a + 1 }) + '</div>' +
      '<h3>' + t('act_' + id + '_t') + '</h3><p>' + t('act_' + id + '_intro') + '</p>' +
      '<p class="act-goal">▸ ' + t('act_' + id + '_goal') + '</p>';
    if (id === 'race') {
      body += '<div class="act-num" style="margin-top:14px">' + t('stance_title') + '</div><div class="nc-choices">' +
        ['safe', 'fast', 'open'].map(function (s) { return '<button class="cardchoice" data-stance="' + s + '"><b>' + t('stance_' + s) + '</b> — ' + t('stance_' + s + '_d') + '</button>'; }).join('') + '</div>';
    } else {
      body += '<div class="row"><button class="primary" id="actOk">' + t('act_continue') + '</button></div>';
    }
    body += '</div>';
    showModal(body);
    window.GAME_FX.flash('rgba(139,92,246,0.25)');
    if (id === 'race') {
      var bs = $('modalRoot').querySelectorAll('[data-stance]');
      for (var i = 0; i < bs.length; i++) (function (b) { b.addEventListener('click', function () { G.applyRaceStance(b.dataset.stance); window.GAME_AUDIO.buy(); hideModal(); }); })(bs[i]);
    } else { $('actOk').onclick = hideModal; }
  }
  // (the open-source race action now lives on the live World/Race standings panel
  // via updateStandings; the old duplicate racePanel on the singularity tab is gone)
  // (endings collection now lives on the World/Race finale banner; the old
  // singularity-tab list was unreachable and has been removed)
  function showEndingCinematic(d) {
    var won = d.won !== false && d.id !== 'beaten';
    window.GAME_FX.ritual({ kind: won ? 'singularity' : 'prestige', title: (won ? t('agi_title') + ' · ' : '') + t('ending_' + d.id + '_t'), subtitle: t('ending_' + d.id + '_d') });
    window.GAME_AUDIO.singularity(); buzz([0,60,80,60,80,120]);
    toast(t('ending_unlocked_toast', { name: t('ending_' + d.id + '_t') }), 'gold');
  }
  // Generation-advance summary: what shipping this model just gave you (the no-reset payoff).
  var GEN_UNLOCK = { 1: 'unlock_area_race', 2: 'unlock_area_team', 3: 'unlock_area_align', 5: 'unlock_area_acquire' };
  function fmtMult(m) { return m < 100 ? m.toFixed(1) : fmt(m); }
  function showGenSummary(genCount) {
    var g = C.MODELGEN[genCount - 1]; if (!g) return;
    var next = C.MODELGEN[genCount], unlockKey = GEN_UNLOCK[genCount];
    var html = '<h3>' + t('gen_summary_title', { name: t(g.id) }) + '</h3>' +
      '<div class="gs-kept">✓ ' + t('gen_summary_kept') + '</div>' +
      '<p>' + t('gen_summary_sub') + '</p>' +
      '<div class="gensum">' +
        '<div class="gs-row gs-up">▲ ' + t('gen_summary_output', { p: Math.round((g.revMult - 1) * 100), tot: fmtMult(G.genRevenueMult()) }) + '</div>' +
        '<div class="gs-row gs-up">▲ ' + t('gen_summary_share', { s: g.share, cur: Math.round((G.state.marketShare || 0) * 10) / 10 }) + '</div>' +
        (unlockKey ? '<div class="gs-row gs-unlock">🔓 ' + t('gen_summary_unlocked', { what: t(unlockKey) }) + '</div>' : '') +
        (next ? '<div class="gs-row gs-next muted">' + t('gen_summary_next', { name: t(next.id) }) + '</div>' : '') +
      '</div>' +
      '<div class="row"><button class="primary" id="gsOk">' + t('gen_summary_ok') + '</button></div>';
    showModal(html);
    if ($('gsOk')) $('gsOk').onclick = hideModal;
  }
  // One-time teaching beat the first time a training run crosses ~1h (the v4→v5 momentum
  // cliff). Light + skippable; surfaces the researcher/build CTAs so the player learns to
  // work in parallel instead of just waiting (item 2).
  function showLongTrainTeach() {
    var mr = $('modalRoot');
    if (mr && !mr.classList.contains('hidden')) { setTimeout(showLongTrainTeach, 800); return; }
    var teamUnlocked = G.researchUnlocked && G.researchUnlocked();
    var html = '<div class="ob-icon" style="color:var(--cyan)">' + ic('ic_brain') + '</div>' +
      '<h3>' + t('longtrain_title') + '</h3>' +
      '<p>' + t('longtrain_body') + '</p>' +
      '<div class="row">' +
        (teamUnlocked ? '<button class="secondary" id="ltHire">' + t('longtrain_cta_hire') + '</button>' : '') +
        '<button class="secondary" id="ltBuild">' + t('longtrain_cta_build') + '</button>' +
      '</div>' +
      '<div class="row"><button class="primary" id="ltOk">' + t('longtrain_got_it') + '</button></div>';
    showModal(html);
    if ($('ltOk')) $('ltOk').onclick = hideModal;
    if ($('ltHire')) $('ltHire').onclick = function () { window.GAME_AUDIO.buy(); hideModal(); switchTab('research'); };
    if ($('ltBuild')) $('ltBuild').onclick = function () { window.GAME_AUDIO.buy(); hideModal(); switchTab('company'); var bb = $('buildBtn'); if (bb) { bb.classList.remove('pulse'); void bb.offsetWidth; bb.classList.add('pulse'); } };
  }
  // Don't clobber an open modal (offline/daily on return): wait until it's dismissed.
  function showGenSummaryDeferred(genCount) {
    var mr = $('modalRoot');
    if (mr && !mr.classList.contains('hidden')) { setTimeout(function () { showGenSummaryDeferred(genCount); }, 700); return; }
    showGenSummary(genCount);
  }

  // ---------- next-goal nudge ----------
  function computeNudge() {
    var s = G.state;
    // urgent: safety crises (re-homed onto the new ladder)
    if (G.incidentActive()) return { key: 'nudge_incident', tone: 'urgent', icon: 'ic_risk' };
    if (G.riskUnlocked() && G.riskLevel() >= C.RISK.WARN_AT) return { key: 'nudge_risk', tone: 'urgent', icon: 'ic_risk' };
    // garage bootstrap
    var totalOwned = 0; C.GENERATORS.forEach(function (g) { totalOwned += s.gens[g.id]; });
    if (totalOwned === 0) {
      if (s.cash < C.GENERATORS[0].baseCost) return { key: 'nudge_tap', icon: 'ic_brain' };
      return { key: 'nudge_buyfirst', vars: { name: t('g_' + C.GENERATORS[0].id) }, icon: 'gen_' + C.GENERATORS[0].id };
    }
    // post-finale: AGI reached (or beaten) — point at Founder's Legacy / keep building
    if (G.isGameOver()) return { key: 'nudge_legacy', tone: 'go', icon: 'ic_core' };
    // the spine: ship the next model generation
    if (G.isAGI()) return { key: 'nudge_agi', tone: 'go', icon: 'ic_core' };
    var g = G.nextGen();
    if (!G.trainingActive()) {
      if (G.canStartTraining()) return { key: 'nudge_train', vars: { name: t(g.id) }, tone: 'go', icon: 'ic_brain' };
      return { key: 'nudge_train_need', vars: { name: t(g.id), v: fmt(g.computeReq) }, icon: 'ic_brain' };
    }
    // training is running → suggest the best PARALLEL action (no dead time)
    if (G.canTakeFunding()) { var r = G.nextFundingRound(); return { key: 'nudge_fund', vars: { name: t('fund_' + r.id) }, tone: 'go', icon: 'ic_market' }; }
    if (!G.buildActive() && G.canStartBuild()) return { key: 'nudge_build', icon: 'ic_world' };
    if (!G.researchActive() && G.canStartResearch()) return { key: 'nudge_research', icon: 'ic_tech' };
    if (G.talentUnlocked() && s.cash >= G.researcherCost()) return { key: 'nudge_hire', icon: 'ic_manager' };
    for (var i = 0; i < C.UPGRADES.length; i++) {
      var u = C.UPGRADES[i];
      if (!s.upgrades[u.id] && (!u.unlock || s.gens[u.unlock.gen] >= u.unlock.count) && s.cash >= u.cost)
        return { key: 'nudge_upgrade', vars: { name: t(u.id) }, icon: 'ic_upgrade' };
    }
    // buy hardware to grow compute (toward the next generation's requirement)
    for (var h = C.GENERATORS.length - 1; h >= 0; h--) {
      var hg = C.GENERATORS[h];
      if (s.gens[hg.id] === 0 && s.cash >= G.genCostCumulative(hg.id, 1)) return { key: 'nudge_buygen', vars: { name: t('g_' + hg.id) }, icon: 'gen_' + hg.id };
    }
    return { key: 'nudge_wait', icon: 'ic_brain' };
  }
  var _nudgeIcon = null;
  function updateNudge() {
    var n = computeNudge(), box = $('nudge');
    if (!n) { setClass(box, 'hidden', true); return; }
    setClass(box, 'hidden', false);
    setClass(box, 'urgent', n.tone === 'urgent');
    setClass(box, 'go', n.tone === 'go');
    if (n.icon !== _nudgeIcon) { _nudgeIcon = n.icon; box.querySelector('.nicon').innerHTML = ic(n.icon); }  // icon rarely changes
    setText($('nudgeText'), t(n.key, n.vars));
  }

  // ---------- share-change notifications (owner's request) ----------
  // Small dismissable cards when ANY company's market share moves ≥ SHARE_NOTI_DELTA.
  // Throttled: at most one card per company per SHARE_NOTI_COOLDOWN, max a few on screen,
  // and a global rate cap so a big swing doesn't spam. Auto-dismiss + explicit ✕ close.
  var SHARE_NOTI_DELTA = 1.5;          // % move that's "meaningful"
  var SHARE_NOTI_COOLDOWN = 22000;     // per-company throttle (ms)
  var SHARE_NOTI_MS = 6500;            // auto-dismiss
  var SHARE_NOTI_MAX = 3;              // max cards on screen at once
  var _shareBaseline = {};             // id -> last share value we notified from
  var _shareNotiAt = {};               // id -> last notify epoch
  var _shareNotiGlobalAt = 0;          // global rate-limit anchor
  var _shareNotisOn = false;           // armed only after v1 (no noise in the garage)

  function dismissShareNoti(node) {
    if (!node || node._closing) return;
    node._closing = true;
    if (node._timer) clearTimeout(node._timer);
    node.classList.add('out');
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 280);
  }
  function pushShareNoti(key, vars, up) {
    var root = $('shareNotis'); if (!root) return;
    // cap on-screen count: drop the oldest to make room
    while (root.children.length >= SHARE_NOTI_MAX) dismissShareNoti(root.firstChild);
    var card = el('div', 'share-noti ' + (up ? 'up' : 'down'));
    var txt = el('span', 'sn-txt', t(key, vars));
    var x = el('button', 'sn-x'); x.setAttribute('aria-label', '✕'); x.textContent = '✕';
    x.onclick = function () { dismissShareNoti(card); };
    card.appendChild(txt); card.appendChild(x);
    root.appendChild(card);
    card._timer = setTimeout(function () { dismissShareNoti(card); }, SHARE_NOTI_MS);
  }
  function updateShareNotis() {
    var s = G.state;
    // arm once a product exists (and the race is real); seed baselines so we don't fire on reveal
    if (!_shareNotisOn) {
      if (s.modelGen < 1) return;
      _shareNotisOn = true;
      _shareBaseline.you = s.marketShare || 0;
      (G.activeRivals() || []).forEach(function (r) { _shareBaseline[r.id] = r.share || 0; });
      return;
    }
    var now = Date.now();
    if (now - _shareNotiGlobalAt < 4000) return;   // global rate cap (don't spam in one tick)

    // gather candidates (you + each live rival) whose move clears the threshold + cooldown
    var cand = [];
    function consider(id, cur, isYou, name) {
      var base = _shareBaseline[id];
      if (base == null) { _shareBaseline[id] = cur; return; }
      var d = cur - base;
      if (Math.abs(d) < SHARE_NOTI_DELTA) return;
      if (now - (_shareNotiAt[id] || 0) < SHARE_NOTI_COOLDOWN) return;
      cand.push({ id: id, d: d, isYou: isYou, name: name, mag: Math.abs(d) });
    }
    consider('you', s.marketShare || 0, true, null);
    (G.activeRivals() || []).forEach(function (r) { consider(r.id, r.share || 0, false, G.rivalName(r.id)); });
    if (!cand.length) return;
    // fire only the single biggest mover this tick (keeps it informative, not spammy)
    cand.sort(function (a, b) { return b.mag - a.mag; });
    var c = cand[0];
    var up = c.d > 0, p = Math.abs(c.d) >= 10 ? Math.round(Math.abs(c.d)) : Math.abs(c.d).toFixed(1);
    var key = c.isYou ? (up ? 'share_noti_you_up' : 'share_noti_you_down')
                      : (up ? 'share_noti_rival_up' : 'share_noti_rival_down');
    pushShareNoti(key, c.isYou ? { p: p } : { name: c.name, p: p }, up);
    _shareNotiAt[c.id] = now;
    _shareBaseline[c.id] = (c.isYou ? s.marketShare : (G.rivalById(c.id) || {}).share) || 0;
    _shareNotiGlobalAt = now;
  }

  // ---------- main per-frame update ----------
  var frameCps = 0, frameGM = 1, frameCompute = 0, frameMoney = 0, _lastInten = -1, _lastHeat = -1, _lastV1 = -1, _lastCardSig = null;
  var _runwayFlow = { burn: 0, rev: 0 };   // latest burn/rev for the runway-strip tap detail
  function update() {
    frameCps = G.cps();           // compute the hottest values ONCE per frame
    frameGM = G.globalMult();
    frameCompute = G.computeRate();
    frameMoney = G.moneyRate();
    updateTop();
    updateRunway();
    updateFinanceLine();   // DESIGN §2/§5/§6: Day N + always-on finance line + pre-revenue hint + debt banner
    updateGameOver();      // DESIGN §4: full-screen blocking game-over overlay (when a finale has fired)
    updateShareNotis();    // owner's request: dismissable cards on meaningful market-share moves
    if (currentTab === 'company') { updateGenerators(); updateModelPanel(); updateBills(); updateLabOrbs(); }
    else if (currentTab === 'upgrades') { updateUpgrades(); updateManagers(); }
    else if (currentTab === 'research') { updateTeam(); updateExec(); }
    else if (currentTab === 'world') updateWorld();
    else if (currentTab === 'alignment') updateAlignment();
    else if (currentTab === 'stats') updateStats();
    else if (currentTab === 'achievements') updateAchievements();
    // risk mini always (company tab) + settings seg states
    if (currentTab === 'company') { if (G.riskUnlocked()) updateRiskMini(); updateNudge(); }
    // progressive nav: show ONLY unlocked tabs (early game = Lab + More)
    var wu = G.worldUnlocked();
    toggleNav('navUpgradesBtn', G.upgradesUnlocked());
    toggleNav('navResearchBtn', G.researchUnlocked());
    toggleNav('navWorldBtn', wu);
    // LIVE news ticker: reveal once the World layer unlocks OR the moment the feed has a
    // real headline (early-game decisions surface here before v1 ships, per owner ask).
    var tickerLive = wu || ((G.state.newsLog || []).length > 0);
    var tk = $('ticker'); if (tk) setClass(tk, 'hidden', !tickerLive);
    // Trust HUD rides with the World stage
    var th = $('trustHud');
    if (th) {
      setClass(th, 'hidden', !wu);
      if (wu) { var tr = G.state.trust; setText($('trustVal'), Math.round(tr)); setClass(th, 'low', tr < 35); setClass(th, 'high', tr >= 75); }
    }
    updateRelMeters(wu);   // 4 relationship meters strip (World tab)
    // risk mini bar only exists once risks of scale are unlocked (Stage 5)
    var rm = $('riskMini'); if (rm) setClass(rm, 'hidden', !G.riskUnlocked());
    // guided first model-release CTA (Stage 4)
    updatePrestigeCta();
    checkUnlocks();
    updateActBar();
    applyCosmetics();
    if (currentTab === 'settings') updateCosmetics();
    updateSettingsState();
  }

  function updateSettingsState() {
    var s = G.state;
    var lang = window.GAME_I18N.getLang();
    var lsg = $('langSeg').children;
    lsg[0].classList.toggle('on', lang === 'en');
    lsg[1].classList.toggle('on', lang === 'ru');
    var ssg = $('soundSeg').children;
    ssg[0].classList.toggle('on', s.sound);
    ssg[1].classList.toggle('on', !s.sound);
    var msg = $('musicSeg').children;
    msg[0].classList.toggle('on', s.music);
    msg[1].classList.toggle('on', !s.music);
    var hpg = $('hapticsSeg').children;
    hpg[0].classList.toggle('on', s.haptics);
    hpg[1].classList.toggle('on', !s.haptics);
  }

  // ---------- progressive unlock plumbing ----------
  function toggleNav(id, on) { setClass($(id), 'hidden', !on); }
  // is a destination reachable right now?
  function tabUnlocked(tab) {
    switch (tab) {
      case 'company': case 'settings': return true;
      case 'upgrades': return G.upgradesUnlocked();
      case 'research': return G.researchUnlocked();
      case 'world': return G.worldUnlocked();
      case 'alignment': return G.riskUnlocked();
      case 'stats': return G.statsUnlocked();
      case 'achievements': return G.awardsUnlocked();
      default: return true;
    }
  }
  // one-time, skippable reveal hints — fire once, in order, as features unlock
  var UNLOCK_HINTS = [
    { key: 'u_buymodes',     on: function () { return G.buyModesUnlocked(); },     hint: 'hint_buymodes' },
    { key: 'u_upgrades',     on: function () { return G.upgradesUnlocked(); },     hint: 'hint_upgrades' },
    { key: 'u_breakthrough', on: function () { return G.breakthroughUnlocked(); }, hint: 'hint_breakthrough' },
    { key: 'u_managers',     on: function () { return G.managersUnlocked(); },     hint: 'hint_managers' },
    { key: 'u_research',     on: function () { return G.researchUnlocked(); },     hint: 'hint_research' },
    { key: 'u_risk',         on: function () { return G.riskUnlocked(); },         hint: 'hint_risk' },
    { key: 'world',          on: function () { return G.worldUnlocked(); },        hint: 'hint_world' }
  ];
  function checkUnlocks() {
    for (var i = 0; i < UNLOCK_HINTS.length; i++) {
      var h = UNLOCK_HINTS[i];
      if (!G.state.seen[h.key] && h.on()) { G.state.seen[h.key] = true; toast(t(h.hint), 'gold'); buzz(18); G.save(); }
    }
  }
  // returning players: mark already-satisfied reveals as seen (no retroactive spam)
  function syncUnlockSeenSilently() {
    for (var i = 0; i < UNLOCK_HINTS.length; i++) { var h = UNLOCK_HINTS[i]; if (h.on()) G.state.seen[h.key] = true; }
    var hitMs = false; C.GENERATORS.forEach(function (g) { if (G.state.gens[g.id] >= C.MILESTONES[0]) hitMs = true; });
    if (hitMs) G.state.seen.u_milestone = true;
  }

  // ---------- tabs ----------
  // destinations that live behind the "More" overflow button (not in the bottom nav)
  var MORE_GROUP = { alignment: 1, stats: 1, achievements: 1, settings: 1 };
  function switchTab(tab) {
    if (!tabUnlocked(tab)) tab = 'company';  // never land on a locked tab
    currentTab = tab;
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i].dataset.tab === tab);
    var navs = $('tabbar').children;
    for (var j = 0; j < navs.length; j++) {
      var nb = navs[j];
      var on = nb.dataset.more ? !!MORE_GROUP[tab] : (nb.dataset.tab === tab);
      nb.classList.toggle('active', on);
    }
    var showBuyMode = (tab === 'company') && G.buyModesUnlocked();
    $('buyModeBar').classList.toggle('hidden', !showBuyMode);
    update();
  }

  // ---------- "More" overflow sheet (only unlocked destinations) ----------
  function openMoreSheet() {
    var items = [];
    // (legacy 'singularity'/2nd-prestige destination retired in GDD v3 — forward-only)
    if (G.riskUnlocked()) items.push({ tab: 'alignment', icon: 'nav_alignment' });
    if (G.statsUnlocked()) items.push({ tab: 'stats', icon: 'nav_stats' });
    if (G.awardsUnlocked()) items.push({ tab: 'achievements', icon: 'nav_achievements' });
    items.push({ tab: 'settings', icon: 'nav_settings' });
    var tabLabel = { alignment: 'tab_alignment', stats: 'tab_stats', achievements: 'tab_achievements', settings: 'tab_settings' };
    var html = '<div class="sheet"><h3>' + t('more_title') + '</h3><div class="sheet-grid">';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      html += '<button class="sheet-item' + (currentTab === it.tab ? ' cur' : '') + '" data-goto="' + it.tab + '">' +
        ic(it.icon) + '<span>' + t(tabLabel[it.tab]) + '</span></button>';
    }
    html += '</div><button class="secondary" id="sheetClose">' + t('more_close') + '</button></div>';
    showModal(html);
    var btns = document.querySelectorAll('.sheet-item');
    for (var k = 0; k < btns.length; k++) {
      (function (b) { b.addEventListener('click', function () { window.GAME_AUDIO.buy(); buzz(8); hideModal(); switchTab(b.dataset.goto); }); })(btns[k]);
    }
    $('sheetClose').addEventListener('click', hideModal);
  }

  // ---------- guided first model-release CTA + shared release flow ----------
  function updatePrestigeCta() {
    var cta = $('prestigeCta'); if (!cta) return;
    var show = G.firstPrestigeReady() && !G.researchUnlocked();
    cta.classList.toggle('hidden', !show);
    if (show) {
      var pr = G.prestigeProjection();
      cta.querySelector('.cta-title').textContent = t('cta_release');
      cta.querySelector('.cta-sub').textContent = t('cta_release_sub', { n: pr.gain, p: pr.pctAfter });
    }
  }
  // The single place a model release is confirmed — loud projection + first-time teaching.
  function openPrestigeFlow() {
    if (!G.canPrestige()) return;
    var first = G.state.prestiges === 0;
    var pr = G.prestigeProjection();
    var teach = first ? '<p class="teach">' + t('prestige_teach') + '</p>' : '';
    var proj =
      '<div class="proj">' +
        '<div class="proj-big">+' + pr.gain + ' RP</div>' +
        '<div class="proj-line">' + t('prestige_proj', { p: pr.pctGain, tot: pr.pctAfter }) + '</div>' +
        '<div class="proj-line accent">' + t('prestige_speedup', { s: pr.speedup.toFixed(1) }) + '</div>' +
      '</div>';
    showModal(
      '<h3>' + t(first ? 'cta_release' : 'research_title') + '</h3>' +
      teach + proj +
      '<div class="row"><button class="secondary" id="pCancel">✕</button>' +
      '<button class="primary" id="pOk">' + t('prestige_button') + '</button></div>'
    );
    $('pCancel').onclick = hideModal;
    $('pOk').onclick = function () {
      var wasFirst = G.state.prestiges === 0;
      hideModal();
      if (G.doPrestige()) {
        window.GAME_AUDIO.prestige(); buzz([0, 30, 40, 30]);
        var f = t('flavor_' + Math.floor((G.state.prestiges) % 5));
        window.GAME_FX.ritual({ kind: 'prestige', title: t('ritual_model'), subtitle: f });
        window.GAME_ADS.showInterstitial({});
        var pctNow = Math.round(G.state.rp * C.PRESTIGE.BONUS * 100);
        setTimeout(function () { toast(t('prestige_celebrate', { p: pctNow }), 'gold'); }, 700);
        if (wasFirst) switchTab('research'); // reveal the freshly-unlocked Research home
      }
    };
  }

  function updateBuyModeBar() {
    var btns = $('buyModeBar').children;
    for (var i = 0; i < btns.length; i++) {
      var m = btns[i].dataset.mode;
      if (!m) continue;  // skip the leading label + the ⓘ explainer
      var val = (m === 'max') ? 'max' : parseInt(m, 10);
      btns[i].classList.toggle('on', G.state.buyMode === val);
    }
  }

  // ---------- modal ----------
  function showModal(html) {
    var root = $('modalRoot');
    root.innerHTML = '<div class="modal">' + html + '</div>';
    root.classList.remove('hidden');
  }
  function hideModal() { $('modalRoot').classList.add('hidden'); $('modalRoot').innerHTML = ''; }

  // v17 — first-electricity-bill TEACH popup: explains WHAT it is, WHERE to pay (Bills view),
  // and the CONSEQUENCE of ignoring it (the −30% throttle). One-time; routes to pay-now.
  function showBillTeach(amount) {
    showModal(
      '<h3>⚡ ' + t('billteach_title') + '</h3>' +
      '<p>' + t('billteach_body', { v: fmt(amount) }) + '</p>' +
      '<div class="awlist"><div class="awrow"><span class="awk">' + t('billteach_owed') + '</span>' +
        '<span class="awv">$' + fmt(amount) + '</span></div></div>' +
      '<p class="muted small">' + t('billteach_consequence') + '</p>' +
      '<div class="row">' +
      '<button class="primary" id="billPayNow">' + t('billteach_pay') + '</button>' +
      '<button class="secondary" id="billLater">' + t('billteach_later') + '</button>' +
      '</div>'
    );
    window.GAME_FX.flash('rgba(245,200,66,0.16)');
    $('billPayNow').onclick = function () { var r = G.payElectricity(); toast(t('bills_paid_elec', { v: fmt(r.paid) }), r.short > 0 ? 'bad' : 'good'); buzz(16); hideModal(); update(); };
    $('billLater').onclick  = function () { hideModal(); switchTab('company'); update(); };
  }

  function showOffline(off) {
    // GDD v3 "while you were away" summary: revenue + compute + finished processes
    var lines = '';
    lines += '<div class="awrow"><span class="awk">' + t('res_compute') + '</span><span class="awv">+' + fmt(off.compute) + '</span></div>';
    if (off.trainedGenId) lines += '<div class="awrow done"><span class="awk">' + t('aw_trained') + '</span><span class="awv">' + t(off.trainedGenId) + '</span></div>';
    if (off.builtDC) lines += '<div class="awrow done"><span class="awk">' + t('aw_built') + '</span><span class="awv">✓</span></div>';
    if (off.didResearch) lines += '<div class="awrow done"><span class="awk">' + t('aw_research') + '</span><span class="awv">✓</span></div>';
    // v17 — bills the ACCOUNTANT settled while away (electricity + taxes) + its service fee.
    if ((off.elecBill || 0) > 0) lines += '<div class="awrow bill"><span class="awk">⚡ ' + t('aw_elec') + '</span><span class="awv neg">−$' + fmt(off.elecBill) + '</span></div>';
    if ((off.taxBill || 0) > 0)  lines += '<div class="awrow bill"><span class="awk">🧾 ' + t('aw_tax')  + '</span><span class="awv neg">−$' + fmt(off.taxBill)  + '</span></div>';
    var fee = (off.elecFee || 0) + (off.taxFee || 0);
    if (off.accountant && fee > 0) lines += '<div class="awrow bill"><span class="awk">🧮 ' + t('aw_fee') + '</span><span class="awv neg">−$' + fmt(fee) + '</span></div>';
    showModal(
      '<h3>' + t('offline_title') + '</h3>' +
      '<p>' + t('offline_away', { t: FMT.fmtTime(off.cappedSec) }) + '</p>' +
      '<div class="big">' + t('offline_earned', { v: fmt(off.earned) }) + '</div>' +
      '<div class="awlist">' + lines + '</div>' +
      '<div class="row">' +
      '<button class="primary" id="offCollect">' + t('offline_collect') + '</button>' +
      '<button class="reward" id="offDouble">' + t('offline_double') + '</button>' +
      '</div>'
    );
    // After collecting revenue, chain the director's "while you were away" report (if any),
    // otherwise go straight to the daily check-in.
    function afterCollect() {
      // v17: if the accountant couldn't cover a bill, it rolled into debt + the −30% throttle.
      if (off.billResult && off.billResult.shutoff) toast(t('bills_shutoff_toast'), 'bad');
      hideModal(); if (off.execReport && off.execReport.length) showAwayReport(off); else maybeShowDaily();
    }
    // v17: pass `off` so applyOffline settles the accrued electricity + taxes via the accountant.
    $('offCollect').onclick = function () { G.applyOffline(off.earned, off.compute, off); afterCollect(); };
    $('offDouble').onclick = function () {
      window.GAME_ADS.showRewarded({
        onReward: function () { G.applyOffline(off.earned * 2, off.compute * 2, off); afterCollect(); },
        onUnavailable: function () { G.applyOffline(off.earned, off.compute, off); toast(t('ad_unavailable'), 'bad'); afterCollect(); }
      });
    };
  }
  // "While you were away" — the Managing Director's delegation report. Reuses the offline
  // modal style (awlist rows). Each row = a resolved decision + the director's choice, with
  // good/bad framing. Effects were already applied by the engine on load (game.init).
  function showAwayReport(off) {
    var rep = off.execReport || [];
    var name = off.execName ? t(off.execName) : '';
    var mandate = t('mandate_' + (off.mandate || 'balance'));
    var rows = '';
    if (!rep.length) {
      rows = '<div class="awrow"><span class="awk">' + t('away_none') + '</span></div>';
    } else {
      for (var i = 0; i < rep.length; i++) {
        var r = rep[i];
        var tag = r.bonus ? '<span class="awtag bonus">' + t('away_bonus') + '</span>'
                : r.good ? '<span class="awtag good">' + t('away_good') + '</span>'
                          : '<span class="awtag bad">' + t('away_bad') + '</span>';
        rows += '<div class="awcard ' + (r.good ? 'good' : 'bad') + '">' +
          '<div class="awc-head"><span class="awc-title">' + r.title + '</span>' + tag + '</div>' +
          '<div class="awc-choice muted small">' + r.choice + '</div></div>';
      }
    }
    showModal(
      '<h3>' + t('away_title') + '</h3>' +
      '<p>' + t('away_intro', { name: name, mandate: mandate }) + '</p>' +
      '<div class="awlist awreport">' + rows + '</div>' +
      '<div class="row"><button class="primary" id="awClose">' + t('away_close') + '</button></div>'
    );
    window.GAME_FX.flash('rgba(139,92,246,0.16)');
    $('awClose').onclick = function () { hideModal(); maybeShowDaily(); };
  }
  // DEV/QA hook: render the away report from a supplied offline object (screenshots/tests).
  window.__showAwayTest = function (off) { showAwayReport(off); };
  // DEV/QA hooks: render the offline summary + first-bill teach popup for screenshots/tests.
  window.__showOfflineTest = function (off) { showOffline(off); };
  window.__showBillTeachTest = function (amt) { showBillTeach(amt); };
  // show the daily check-in once any offline modal has been dismissed (never clobber it)
  function maybeShowDaily() {
    if (G.dailyAvailable() && G.state.onboarded) setTimeout(showDaily, 250);
  }

  // ---------- insight flash collectible ----------
  function removeInsight() { var e = $('insightFlash'); if (e && e.parentNode) e.parentNode.removeChild(e); }
  function spawnInsight(lifetime) {
    removeInsight();
    var e = el('div'); e.id = 'insightFlash'; e.innerHTML = ic('ic_insight');
    e.setAttribute('role', 'button'); e.setAttribute('aria-label', t('insight_appear'));
    document.body.appendChild(e);
    var w = window.innerWidth, h = window.innerHeight;
    var x0 = 24 + Math.random() * Math.max(40, w - 130);
    var y0 = 100 + Math.random() * Math.max(40, h - 280);
    e.style.left = x0 + 'px'; e.style.top = y0 + 'px';
    e.style.transition = 'left ' + lifetime + 's linear, top ' + lifetime + 's linear, transform 0.12s';
    requestAnimationFrame(function () {
      var x1 = Math.max(24, Math.min(w - 90, x0 + (Math.random() * 220 - 110)));
      var y1 = Math.max(90, Math.min(h - 170, y0 + (Math.random() * 180 - 90)));
      e.style.left = x1 + 'px'; e.style.top = y1 + 'px';
    });
    function claim(ev) {
      ev.preventDefault(); ev.stopPropagation();
      var rect = e.getBoundingClientRect();
      var res = G.claimInsight();
      removeInsight();
      if (res) {
        var ix = rect.left + rect.width / 2, iy = rect.top + rect.height / 2;
        window.GAME_AUDIO.insight(); buzz([0,15,30,15]);
        window.GAME_FX.insightBurst(ix, iy);
        window.GAME_FX.flash('rgba(251,191,36,0.38)');
        window.GAME_FX.shockwave(ix, iy, 'rgba(251,191,36,0.85)', 560);
        toast(t('insight_' + res.reward, res.vars), 'gold');
      }
    }
    e.addEventListener('click', claim);
    e.addEventListener('touchstart', claim, { passive: false });
  }

  // ---------- naming step (item 2) ----------
  // Shown once, only for a genuinely new game (companyNamed===false). A simple text-input
  // modal with the default brand pre-filled; sanitized on confirm. Legacy saves are
  // grandfathered as already-named in migrate() and never reach this.
  function showNaming(done) {
    var def = G.state.companyName || 'Singularity Inc.';
    showModal(
      '<div class="ob ob-name">' +
      '<div class="ob-icon">' + ic('ic_insight') + '</div>' +
      '<h3>' + t('name_lab_title') + '</h3>' +
      '<p>' + t('name_lab_body') + '</p>' +
      '<input id="labNameInput" class="name-input" type="text" maxlength="24" autocomplete="off" spellcheck="false" />' +
      '<div class="row">' +
      '<button class="primary" id="labNameOk">' + t('name_lab_confirm') + '</button>' +
      '</div></div>'
    );
    var inp = $('labNameInput');
    inp.value = def;
    inp.setAttribute('aria-label', t('name_lab_title'));
    function confirm() {
      G.setCompanyName(inp.value);   // sanitizes + falls back to default if empty
      renderStatic(); update();
      done();
    }
    $('labNameOk').onclick = confirm;
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); confirm(); } });
    // focus + select so the player can immediately type over the default
    setTimeout(function () { try { inp.focus(); inp.select(); } catch (e) {} }, 50);
  }

  // ---------- difficulty-select step (new-game; after naming) ----------
  // Four levels with a one-line description each. The choice seeds starting cash + the
  // random rival roster (G.setDifficulty(level, true)). Shown once for a genuinely new game.
  function showDifficulty(done) {
    var levels = C.DIFFICULTY.ORDER;
    var sel = G.state.difficulty || C.DIFFICULTY.DEFAULT;
    function optsHtml() {
      return levels.map(function (lv) {
        return '<button class="diff-opt' + (lv === sel ? ' on' : '') + '" data-diff="' + lv + '">' +
          '<div class="dname">' + t('diff_' + lv) + '<span class="dtick">✓</span></div>' +
          '<div class="ddesc">' + t('diff_' + lv + '_d') + '</div></button>';
      }).join('');
    }
    showModal(
      '<div class="ob ob-diff">' +
      '<h3>' + t('diff_title') + '</h3>' +
      '<p>' + t('diff_body') + '</p>' +
      '<div class="diff-list" id="diffList">' + optsHtml() + '</div>' +
      '<div class="row">' +
      '<button class="primary" id="diffOk">' + t('diff_confirm') + '</button>' +
      '</div></div>'
    );
    var list = $('diffList');
    list.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.diff-opt') : null; if (!b) return;
      sel = b.getAttribute('data-diff');
      var kids = list.querySelectorAll('.diff-opt');
      for (var i = 0; i < kids.length; i++) setClass(kids[i], 'on', kids[i].getAttribute('data-diff') === sel);
    });
    $('diffOk').onclick = function () {
      G.setDifficulty(sel, true);   // seeds start-cash boost + random rival roster + world/scenario/climate
      renderStatic(); update();
      // DISMISS this modal before proceeding. The next step (scenario reveal / tour) opens its own
      // modal via showModal(); but the game-over→New Game path passes a done() that opens NOTHING,
      // so without an explicit hide the difficulty popup would hang center-screen. Hide first, always.
      hideModal();
      done();
    };
  }

  // ---------- starting-scenario reveal (Phase 7; after difficulty) ----------
  // One line telling the player "the world you got" — the seeded climate + modifier.
  // Shown once for a genuinely new game so the run feels handed-out, not generic.
  function showScenario(done) {
    var id = G.scenarioId && G.scenarioId();
    if (!id) { done(); return; }   // no scenario rolled (old save / safety) → skip cleanly
    var seed = (G.worldSeed && G.worldSeed()) || 0;
    showModal(
      '<div class="ob ob-scenario">' +
      '<div class="ob-icon">' + ic('ic_world') + '</div>' +
      '<h3>' + t('scenario_title') + '</h3>' +
      (seed ? '<div class="sc-seed">' + t('scenario_seed', { seed: seed }) + '</div>' : '') +
      '<p>' + t(id) + '</p>' +
      '<div class="row">' +
      '<button class="primary" id="scenarioOk">' + t('scenario_start') + '</button>' +
      '</div></div>'
    );
    $('scenarioOk').onclick = function () { window.GAME_AUDIO.buy(); done(); };
  }

  // ---------- onboarding tour ----------
  function showOnboarding() {
    // genuinely-new game: name your lab → choose difficulty → the tour
    if (!G.state.companyNamed) { showNaming(function () { showDifficulty(function () { showScenario(function () { showTour(); }); }); }); return; }
    showTour();
  }
  function showTour() {
    var steps = [
      { icon: ic('ic_brain'), title: 'ob_1_title', body: 'ob_1_body' },
      { icon: ic('gen_laptop'), title: 'ob_2_title', body: 'ob_2_body' },
      { icon: ic('ic_market'), title: 'ob_3_title', body: 'ob_3_body' }
    ];
    var i = 0;
    function finish() { G.setOnboarded(true); hideModal(); }
    function render() {
      var s = steps[i];
      var dots = '';
      for (var k = 0; k < steps.length; k++) dots += '<span class="dot' + (k === i ? ' on' : '') + '"></span>';
      var lastBtn = (i === steps.length - 1) ? t('ob_done') : t('ob_next');
      showModal(
        '<div class="ob">' +
        '<div class="ob-icon">' + s.icon + '</div>' +
        '<h3>' + t(s.title) + '</h3>' +
        '<p>' + t(s.body) + '</p>' +
        '<div class="ob-dots">' + dots + '</div>' +
        '<div class="row">' +
        '<button class="secondary" id="obSkip">' + t('ob_skip') + '</button>' +
        '<button class="primary" id="obNext">' + lastBtn + '</button>' +
        '</div></div>'
      );
      $('obSkip').onclick = finish;
      $('obNext').onclick = function () { if (i < steps.length - 1) { i++; render(); } else finish(); };
    }
    render();
  }

  // ---------- events ----------
  function bind() {
    document.addEventListener('click', function (e) {
      if (!e.target.closest) { hideTip(); return; }
      var b = e.target.closest('[data-tip]');
      if (b) { e.preventDefault(); e.stopPropagation(); showTip(b); return; }
      // dynamic tips (runtime values) — currently the runway strip's burn/revenue detail.
      // Don't hijack the crisis CTA / chips that have their own behavior.
      var d = e.target.closest('[data-tip-dyn]');
      if (d && !e.target.closest('#crisisCta')) {
        e.preventDefault(); e.stopPropagation();
        if (d.dataset.tipDyn === 'runway') {
          showTipText(d, t('runway_flow_tip', { burn: fmt(_runwayFlow.burn), rev: fmt(_runwayFlow.rev) }));
        } else if (d.dataset.tipDyn === 'finance' && _financeFlow) {
          // full per-line monthly breakdown (DESIGN §2/§C): every dollar of cost named.
          var f = _financeFlow, bd = f.bd;
          var nsign = f.net < -1e-9 ? '−' : (f.net > 1e-9 ? '+' : '');
          var txt = t('finance_tip', {
            rev: fmt(f.rev), sal: fmt(bd.salaries), elec: fmt(bd.electricity),
            comp: fmt(bd.compute), dc: fmt(bd.upkeep), oh: fmt(bd.overhead),
            sign: nsign, net: fmt(Math.abs(f.net))
          });
          if (f.inRed) txt += t('finance_tip_debt');
          showTipText(d, txt);
        }
        return;
      }
      hideTip();
    }, true);
    // keyboard: Escape closes an open tooltip or modal (desktop/keyboard a11y)
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' && e.keyCode !== 27) return;
      var tip = document.getElementById('tooltip');
      if (tip && !tip.classList.contains('hidden')) { hideTip(); return; }
      var m = $('modalRoot');
      if (m && !m.classList.contains('hidden')) { hideModal(); }
    });
    // tap
    var tapBtn = $('tapBtn');
    var _tapN = 0;   // throttle counter for hot-streak shockwaves
    function doTap(clientX, clientY) {
      var v = G.tap();
      var heat = G.state.comboHeat || 0;
      // HOOK (first 90s): the tap is a slot machine. Pitch rises with the overclock combo,
      // the burst grows hotter, and a hot streak fires shockwaves — all scaling with `heat`.
      window.GAME_AUDIO.tap(heat);
      var cls = G.clickFrenzyActive() ? 'crit' : (heat > 0.6 ? 'big' : '');
      floatText(clientX, clientY, '+' + fmt(v), cls);
      window.GAME_FX.tapBurst(clientX, clientY, heat);
      window.GAME_FX.ripple(clientX, clientY, 120 + heat * 90);
      // hot-streak shockwave ring — amber, intensifying. Throttled (every few hot taps)
      // so it punctuates the climb without flooding the FX root.
      if (heat > 0.5 && (_tapN = (_tapN + 1) % 3) === 0) {
        var amp = 0.45 + heat * 0.4;
        window.GAME_FX.shockwave(clientX, clientY, 'rgba(251,191,36,' + amp.toFixed(2) + ')', 220 + heat * 220);
      }
      buzz(6 + Math.round(heat * 10));
      tapBtn.classList.remove('squash'); void tapBtn.offsetWidth; tapBtn.classList.add('squash');
      // pop the live Power/sec counter so the climb is VISIBLE on every tap
      var crEl = $('computeRate');
      if (crEl) { crEl.classList.remove('pop'); void crEl.offsetWidth; crEl.classList.add('pop'); }
    }
    tapBtn.addEventListener('click', function (e) { doTap(e.clientX, e.clientY); });

    // tab nav (primary tabs switch; the More button opens the overflow sheet)
    var navs = $('tabbar').children;
    for (var i = 0; i < navs.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          if (btn.dataset.more) { window.GAME_AUDIO.buy(); buzz(8); openMoreSheet(); }
          else switchTab(btn.dataset.tab);
        });
      })(navs[i]);
    }

    // buy mode
    var bms = $('buyModeBar').children;
    for (var k = 0; k < bms.length; k++) {
      if (!bms[k].dataset.mode) continue;  // skip the leading label + the ⓘ explainer
      (function (btn) {
        btn.addEventListener('click', function () {
          var m = btn.dataset.mode;
          G.setBuyMode(m === 'max' ? 'max' : parseInt(m, 10));
          updateBuyModeBar();
        });
      })(bms[k]);
    }

    // prestige (legacy DOM removed in GDD v3 — guard so bind() never aborts midway)
    if ($('prestigeBtn')) $('prestigeBtn').addEventListener('click', openPrestigeFlow);
    if ($('prestigeCta')) $('prestigeCta').addEventListener('click', function () { window.GAME_AUDIO.buy(); openPrestigeFlow(); });

    // (autopilot controls removed in Phase 1)

    // (the singularity/2nd-prestige tab was retired in GDD v3; doSingularity
    //  remains in the engine only for the 'beaten' ending path)
    G.on('card', function (d) {
      if (d.kind === 'crisis') { window.GAME_AUDIO.incident(); buzz([0,40,60,40]); window.GAME_FX.flash('rgba(251,92,120,0.25)'); showCrisisModal(); }
      else if (d.kind === 'escalate') { window.GAME_AUDIO.incident(); toast(t('incident_active', { p: C.RISK.INCIDENT_PENALTY }), 'bad'); }
    });
    // v17 — ACCOUNTANT auto-hire (~2 real min): a teach toast (never the word "free").
    G.on('accountant', function () {
      window.GAME_AUDIO.achievement && window.GAME_AUDIO.achievement(); buzz(14);
      window.GAME_FX.flash('rgba(34,211,238,0.12)');
      toast(t('accountant_toast'), 'gold');
    });
    // v17 — FIRST electricity bill TEACHES via a popup (what / where to pay / consequences),
    // then routes the player to the Bills view to pay it themselves (online ⇒ no fee).
    G.on('billTeach', function (d) {
      if (!d || d.kind !== 'elec') return;
      window.GAME_AUDIO.buy && window.GAME_AUDIO.buy();
      showBillTeach(d.amount);
    });
    // ---------- Decision engine surfacing (Phase 2, Sub-part D) ----------
    G.on('decision', function (d) {
      if (d.kind === 'interrupt') {
        var ev = G.decisionById(d.id);
        if (ev) showDecisionModal(ev, { callback: d.callback, callbackKey: d.callbackKey, incident: d.incident, teach: d.teach, blackswan: d.blackswan });
      } else if (d.kind === 'bankable') {
        updateInboxBadge(); window.GAME_AUDIO.achievement && window.GAME_AUDIO.achievement(); buzz(12);
        toast(t(d.id + '_t'), 'gold');
      } else if (d.kind === 'ambient') {
        window.GAME_FX.flash('rgba(34,211,238,0.10)');
      } else if (d.kind === 'auto') {
        updateInboxBadge();
        // PHASE 7: an auto-resolved gamble surfaces which way the roll went.
        if (d.outcome && d.outcome.news) toast(t(d.outcome.news), d.outcome.good ? 'good' : 'bad');
        else toast(t(d.id + '_t'), '');
      } else if (d.kind === 'resolved' && d.outcome) {
        // PHASE 7: a player-resolved GAMBLE — flash + toast the rolled outcome (which way it went).
        if (d.outcome.good) { window.GAME_FX.flash('rgba(52,211,153,0.22)'); window.GAME_AUDIO.achievement && window.GAME_AUDIO.achievement(); }
        else { window.GAME_FX.flash('rgba(251,92,120,0.24)'); window.GAME_AUDIO.incident && window.GAME_AUDIO.incident(); buzz([0, 30, 50]); }
        if (d.outcome.news) toast(t(d.outcome.news), d.outcome.good ? 'good' : 'bad');
      }
    });
    // PHASE 8 — BLACK SWAN TELEGRAPH (Impossible-only): a warning beat before the swan
    // bites. Red flash + urgent toast; the warning headline also ticks via newsline.
    G.on('blackswan_warn', function (d) {
      if (!d) return;
      window.GAME_AUDIO.incident && window.GAME_AUDIO.incident(); buzz([0, 50, 80]);
      window.GAME_FX.flash('rgba(251,92,120,0.30)');
      toast(t((d.id || '') + '_warn', { co: G.state.companyName || '' }), 'bad');
    });
    // PHASE 7 — LUCKY BREAK: a celebratory flash + toast (the headline ticks via newsline).
    G.on('lucky', function (d) {
      if (!d) return;
      window.GAME_FX.flash('rgba(52,211,153,0.20)');
      window.GAME_AUDIO.achievement && window.GAME_AUDIO.achievement(); buzz(12);
      toast(t(d.id + '_news', { co: G.state.companyName || t('game_title') }), 'good');
      updateWorld();
    });
    // a new real headline jumps to the front of the ticker AND refreshes an open feed/World.
    G.on('newsline', function (d) {
      if (d && d.line) setTickerText(d.line);
      if (currentTab === 'world') updateWorld();
      var mr = $('modalRoot');
      if (mr && !mr.classList.contains('hidden') && mr.querySelector('.news-feed')) showNewsFeed();
    });
    // open the inbox from the topbar badge
    var inboxBadge = $('inboxBadge');
    if (inboxBadge) inboxBadge.addEventListener('click', function () { window.GAME_AUDIO.buy(); showInboxModal(); });
    // Phase 3: crisis CTA re-opens the correct recovery / ultimatum panel.
    var crisisCta = $('crisisCta');
    if (crisisCta) crisisCta.addEventListener('click', function () {
      window.GAME_AUDIO.buy();
      if (G.acquisitionActive()) showAcquisitionModal();
      else if (G.state.crisis && G.state.crisis.warnLevel >= 3) showRecoveryModal('ultimatum');
      else showRecoveryModal('red');
    });
    // DESIGN §4: tapping the red debt banner opens the recovery levers (raise / cut / pivot).
    var debtBanner = $('debtBanner');
    if (debtBanner) debtBanner.addEventListener('click', function () {
      window.GAME_AUDIO.buy();
      if (G.acquisitionActive()) showAcquisitionModal();
      else showRecoveryModal('red');
    });
    // GAME-OVER screen buttons: New Game → fresh run → difficulty select; View Stats → Stats tab.
    var goNew = $('goNewGame');
    if (goNew) goNew.addEventListener('click', function () {
      window.GAME_AUDIO.buy();
      setClass($('gameOverScreen'), 'hidden', true);
      G.newGame();                  // fresh run, KEEP records + language + name + meta
      renderStatic(); switchTab('company');
      // straight to difficulty select (language already set — do NOT re-ask). On confirm it rolls
      // a fresh seed/scenario/rival field + start cash, then we drop the player into the new run.
      showDifficulty(function () { renderStatic(); update(); });
    });
    var goStats = $('goStats');
    if (goStats) goStats.addEventListener('click', function () {
      window.GAME_AUDIO.buy();
      // View Stats: open the per-difficulty Hall of Fame as a modal ON TOP of the game-over screen
      // (the dead game stays blocked beneath; dismiss returns to the summary).
      showHallOfFameModal();
    });
    // PART B — tapping the LIVE ticker opens the news-feed panel
    var tkEl = $('ticker');
    if (tkEl) { tkEl.classList.add('tappable'); tkEl.addEventListener('click', function () { window.GAME_AUDIO.buy(); buzz(8); showNewsFeed(); }); }
    // R9: act intros + ending cinematics
    G.on('act', function (d) { showActIntroDeferred(d.act); });
    G.on('ending', function (d) { showEndingCinematic(d); });
    // Phase 3 FAILURE STATES — surface the right crisis modal on each escalation beat.
    G.on('crisis', function (d) {
      if (!d) return;
      if (d.kind === 'pressure') showRecoveryModal('red');
      else if (d.kind === 'ultimatum') showRecoveryModal('ultimatum');
      else if (d.kind === 'acquisition') showAcquisitionModal();
      else if (d.kind === 'nationalize') showNationalizeModal();
      else if (d.kind === 'acq_poach') { window.GAME_AUDIO.incident(); buzz([0, 30, 50]); toast(t('nh_acq_poach', { rival: d.rival || '', n: d.n, k: d.turnsLeft }), 'bad'); }
      else if (d.kind === 'acq_survived') { window.GAME_FX.flash('rgba(34,211,238,0.16)'); toast(t('crisis_survived_toast'), 'gold'); }
      if (currentTab === 'world') updateWorld();
    });
    if ($('raceOpenBtn')) $('raceOpenBtn').addEventListener('click', function () { if (G.raceOpenSource()) { window.GAME_AUDIO.buy(); window.GAME_FX.flash('rgba(34,211,238,0.2)'); toast(t('race_opensource_done'), 'good', { routine: true }); updateStandings(); } });

    // alignment buy + reactive audit
    $('buyAlignBtn').addEventListener('click', function () { if (G.buyAlignment()) window.GAME_AUDIO.buy(); });
    $('auditBtn').addEventListener('click', function () { if (G.doAudit()) { window.GAME_AUDIO.buy(); window.GAME_FX.flash('rgba(52,211,153,0.25)'); } });

    // breakthrough ability
    // GDD v3: start training the next model generation
    var trainBtn = $('trainBtn');
    if (trainBtn) trainBtn.addEventListener('click', function () {
      if (G.startTraining()) { window.GAME_AUDIO.buy(); buzz(12); window.GAME_FX.flash('rgba(34,211,238,0.18)'); updateModelPanel(); }
      else { window.GAME_AUDIO.error && window.GAME_AUDIO.error(); }
    });
    // §5: acquire a rival lab (Race tab)
    var acquireBtn = $('acquireBtn');
    if (acquireBtn) acquireBtn.addEventListener('click', function () {
      var tgt = G.acquireTarget(); if (!tgt) return;
      if (G.acquireRival()) { window.GAME_AUDIO.prestige(); buzz([0,25,40,25]); window.GAME_FX.flash('rgba(139,92,246,0.2)'); updateStandings(); }
    });
    G.on('acquire', function (d) { toast(t('acquire_done', { name: G.rivalName(d.id) }), 'gold'); });
    // GDD v3: Founder's Legacy (optional, non-forced replay after the finale)
    var legacyBtn = $('legacyBtn');
    if (legacyBtn) legacyBtn.addEventListener('click', function () {
      showModal('<h3>' + t('legacy_title') + '</h3><p>' + t('legacy_confirm', { p: Math.round(G.legacyNextBonus() * 100) }) + '</p>' +
        '<div class="row"><button class="secondary" id="lgCancel">✕</button><button class="primary" id="lgOk">' + t('legacy_btn_short') + '</button></div>');
      $('lgCancel').onclick = hideModal;
      $('lgOk').onclick = function () { if (G.startLegacy()) { hideModal(); window.GAME_AUDIO.prestige(); window.GAME_FX.ritual({ kind: 'singularity', title: t('legacy_title'), subtitle: t('legacy_started') }); switchTab('company'); } };
    });
    // GDD v3: activate an earned boost (speeds all timers)
    var boostBtn = $('boostBtn');
    if (boostBtn) boostBtn.addEventListener('click', function () {
      if (G.activateBoostToken()) { window.GAME_AUDIO.breakthrough && window.GAME_AUDIO.breakthrough(); buzz([0,20,30,20]); window.GAME_FX.flash('rgba(251,191,36,0.2)'); updateModelPanel(); }
    });
    // GDD v3: parallel timers — datacenter build + research project
    var buildBtn = $('buildBtn');
    if (buildBtn) buildBtn.addEventListener('click', function () {
      if (G.startBuild()) { window.GAME_AUDIO.buy(); buzz(10); window.GAME_FX.flash('rgba(34,211,238,0.15)'); updateModelPanel(); }
      else { window.GAME_AUDIO.error && window.GAME_AUDIO.error(); }
    });
    var researchBtn = $('researchBtn');
    if (researchBtn) researchBtn.addEventListener('click', function () {
      if (G.startResearch()) { window.GAME_AUDIO.buy(); buzz(10); updateTeam(); }
      else { window.GAME_AUDIO.error && window.GAME_AUDIO.error(); }
    });
    G.on('process', function (d) {
      // parallel-timer wins shouldn't be silent — give each completion a distinct audio cue,
      // a haptic pulse, and a clear quantified toast (item 4).
      if (d.kind === 'build') {
        window.GAME_AUDIO.buildDone && window.GAME_AUDIO.buildDone(); buzz([0, 18, 40, 26]);
        window.GAME_FX.flash('rgba(34,211,238,0.16)');
        toast(t('build_done_full', { n: d.n, p: Math.round((C.DATACENTER.bonus || 0) * 100) }), 'gold', { routine: true });
      } else if (d.kind === 'research') {
        window.GAME_AUDIO.researchDone && window.GAME_AUDIO.researchDone(); buzz([0, 14, 34, 22]);
        toast(t('research_done_full', { n: d.n, p: Math.round((C.RESEARCH2.computeBonus || 0) * 100) }), 'gold', { routine: true });
      }
    });
    // subtle 25/50/75% training-progress pings on long runs (item 2)
    G.on('trainprogress', function (d) {
      toast(t('train_prog_toast', { gen: d.gen, pct: d.pct, left: FMT.fmtTime(d.left) }));
    });
    // one-time teaching beat the first time a run crosses ~1h (the v4→v5 cliff) (item 2)
    G.on('longtrain', function () { showLongTrainTeach(); });
    // late-game drama: a rival crossed 50/75/90% AGI — they're catching up (item 3)
    G.on('rivalagi', function (d) {
      window.GAME_AUDIO.incident && window.GAME_AUDIO.incident(); buzz([0, 30, 50, 30]);
      toast(t('rival_agi_toast', { name: G.rivalName(d.id), p: d.pct }), 'bad');
    });
    // GDD v3: hire a researcher (speeds up training/research/builds)
    var hireBtn = $('hireBtn');
    if (hireBtn) hireBtn.addEventListener('click', function () {
      if (G.hireResearcher()) {
        // distinct welcoming cue + clear toast — hiring speeds every parallel timer (item 4)
        window.GAME_AUDIO.hireDone && window.GAME_AUDIO.hireDone(); buzz([0, 12, 28, 18]);
        toast(t('hire_done_toast', { p: (C.PROCESS.RESEARCHER_SPEED_PER * 100).toFixed(1) }), 'gold', { routine: true });
        updateTeam();
      } else { window.GAME_AUDIO.error && window.GAME_AUDIO.error(); }
    });
    // Managing Director: start a recruit (spends the signing package up front)
    var execRecruitBtn = $('execRecruitBtn');
    if (execRecruitBtn) execRecruitBtn.addEventListener('click', function () {
      if (G.startExecRecruit()) { window.GAME_AUDIO.buy(); buzz(10); window.GAME_FX.flash('rgba(139,92,246,0.15)'); updateExec(); }
      else { window.GAME_AUDIO.error && window.GAME_AUDIO.error(); }
    });
    // Mandate segment: pick the offline-decision posture
    var mseg = $('mandateSeg') ? $('mandateSeg').children : [];
    for (var mm = 0; mm < mseg.length; mm++) {
      (function (btn) {
        btn.addEventListener('click', function () { if (G.setMandate(btn.dataset.mandate)) { window.GAME_AUDIO.buy && window.GAME_AUDIO.buy(); buzz(8); updateExec(); } });
      })(mseg[mm]);
    }
    // Recruit completion: celebratory toast + FX (the headline is pushed by the engine)
    G.on('execHired', function (d) {
      var tier = G.execTier(d.tier);
      window.GAME_AUDIO.milestone && window.GAME_AUDIO.milestone(); buzz([0, 20, 50, 30]);
      window.GAME_FX.flash('rgba(139,92,246,0.22)');
      window.GAME_FX.confetti(34);
      toast(t('exec_hired_toast', { name: tier ? t(tier.name) : '' }), 'gold');
      if (currentTab === 'research') updateExec();
    });
    // GDD v3: raise a funding round
    var fundingBtn = $('fundingBtn');
    if (fundingBtn) fundingBtn.addEventListener('click', function () {
      var round = G.nextFundingRound(); if (!round) return;
      var before = G.state.cash;
      // funding gets its OWN distinct rising jingle + a soft GREEN 'good news' flash
      // (not the cyan/violet/rose used elsewhere) — money flowing in feels good (item 5).
      if (G.takeFunding()) { window.GAME_AUDIO.funding ? window.GAME_AUDIO.funding() : window.GAME_AUDIO.prestige(); buzz([0,25,40,25]); window.GAME_FX.flash('rgba(52,211,153,0.32)'); updateModelPanel(); }
    });
    G.on('funding', function (d) {
      var r = null; for (var i = 0; i < C.FUNDING.length; i++) if (C.FUNDING[i].id === d.id) r = C.FUNDING[i];
      toast(t('fund_done_toast', { name: t('fund_' + d.id), v: '$' + fmt(G.fundingPayout(r)), p: r ? Math.round((r.mult - 1) * 100) : 0 }), 'gold');
    });
    G.on('generation', function (d) {
      var g = (d.gen >= 1 && C.MODELGEN[d.gen - 1]) ? C.MODELGEN[d.gen - 1] : null;
      var name = g ? t(g.id) : '';
      window.GAME_AUDIO.prestige(); buzz([0,30,40,30]);
      var cx = window.innerWidth / 2, cy = window.innerHeight * 0.4;
      // v1 SPECTACLE — the first dopamine peak (~90s in). Full ritual cinematic (not just a
      // toast) + an "on the board" beat. The engine already pushed a rival's sneer to the ticker.
      if (d.first) {
        window.GAME_FX.ritual({ kind: 'prestige', title: t('v1_ritual_title'), subtitle: t('v1_ritual_sub') });
        window.GAME_FX.confetti(50);
        setTimeout(function () { toast(t('v1_board_toast', { co: coName() }), 'gold'); }, 900);
      } else {
        window.GAME_FX.celebrate(cx, cy, name, true);
      }
      // AGI finale has its own cinematic (the 'ending' event). For every other generation,
      // show a clear SUMMARY of what shipping it gave — the heart of the no-reset loop.
      // DEFER the modal ~1.2s so the celebratory shockwave + confetti play VISIBLY over the
      // main screen first (progress hits 100% → burst → THEN the summary slides in). This is
      // the run's climax (~11×/run) — let the dopamine land before the modal covers it.
      if (!G.isAGI() && g) { var dg = d.gen; setTimeout(function () { showGenSummaryDeferred(dg); }, 1200); }
    });

    $('breakthroughBtn').addEventListener('click', function () {
      if (G.activateBreakthrough()) {
        window.GAME_AUDIO.breakthrough(); buzz([0,30,40,30]);
        var bx = window.innerWidth / 2, by = window.innerHeight * 0.42;
        window.GAME_FX.flash('rgba(34,211,238,0.4)');
        window.GAME_FX.shockwave(bx, by, 'rgba(34,211,238,0.9)', 720);
        window.GAME_FX.milestoneBurst(bx, by);
        window.GAME_FX.confetti(30);
      }
    });
    G.on('breakthrough', function (d) {
      toast(t(d.chained ? 'breakthrough_chain' : 'breakthrough_fire', { m: d.mult }), 'gold');
    });

    // insight flash (drifting collectible)
    G.on('insight', function (d) {
      if (d.kind === 'spawn') { spawnInsight(d.lifetime); window.GAME_AUDIO.achievement(); toast(t('insight_appear'), 'gold'); }
      else if (d.kind === 'despawn') { removeInsight(); toast(t('insight_gone')); }
    });

    // language
    var lsg = $('langSeg').children;
    for (var a = 0; a < lsg.length; a++) {
      (function (btn) {
        btn.addEventListener('click', function () { G.setLang(btn.dataset.lang); renderStatic(); update(); });
      })(lsg[a]);
    }
    // sound
    var ssg = $('soundSeg').children;
    for (var b = 0; b < ssg.length; b++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var on = btn.dataset.sound === 'on';
          G.setSound(on); window.GAME_AUDIO.setEnabled(on);
          if (on) window.GAME_AUDIO.buy();
        });
      })(ssg[b]);
    }
    // music
    var msg = $('musicSeg').children;
    for (var mb = 0; mb < msg.length; mb++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var on = btn.dataset.music === 'on';
          G.setMusic(on);
          if (window.GAME_MUSIC) { window.GAME_MUSIC.setEnabled(on); if (on) window.GAME_MUSIC.start(); }
        });
      })(msg[mb]);
    }
    // haptics
    var hpg = $('hapticsSeg').children;
    for (var hb = 0; hb < hpg.length; hb++) {
      (function (btn) { btn.addEventListener('click', function () { var on = btn.dataset.haptics === 'on'; G.setHaptics(on); if (on) buzz(15); }); })(hpg[hb]);
    }
    // ad buttons
    $('adBoostBtn').addEventListener('click', function () {
      window.GAME_ADS.showRewarded({
        onReward: function () { G.applyBoost(); },
        onUnavailable: function () { toast(t('ad_unavailable'), 'bad'); }
      });
    });
    $('adCashBtn').addEventListener('click', function () {
      window.GAME_ADS.showRewarded({
        onReward: function () { G.addCashBurst(); },
        onUnavailable: function () { toast(t('ad_unavailable'), 'bad'); }
      });
    });
    // company rename (item 2): live — updates the topbar brand immediately
    var renameSave = $('companyNameSave'), renameInput = $('companyNameInput');
    if (renameSave && renameInput) {
      function applyRename() {
        var name = G.setCompanyName(renameInput.value); // sanitizes + falls back to default
        renameInput.value = name;
        renderStatic(); update();
        window.GAME_AUDIO.buy();
        toast(t('rename_done', { name: name }), 'good', { routine: true });
      }
      renameSave.addEventListener('click', applyRename);
      renameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); applyRename(); } });
    }
    // save / reset
    $('saveBtn').addEventListener('click', function () { G.save(); toast(t('saved_toast'), '', { routine: true }); });
    $('resetBtn').addEventListener('click', function () {
      showModal('<div class="ob-icon" style="color:var(--rose)">' + ic('ic_risk') + '</div><p>' + t('reset_confirm') + '</p>' +
        '<div class="row"><button class="secondary" id="rCancel">✕</button>' +
        '<button class="primary danger" id="rOk">' + t('reset_progress') + '</button></div>');
      $('rCancel').onclick = hideModal;
      $('rOk').onclick = function () { G.reset(); hideModal(); renderStatic(); update(); toast(t('reset_done')); };
    });

    // game events
    G.on('achievement', function (d) {
      window.GAME_AUDIO.achievement();
      toast(t('ach_unlocked', { name: t(d.id) }), 'gold');
    });
    G.on('toast', function (d) { toast(t(d.key, d.vars), d.key === 'incident_resolved' ? '' : ''); });
    G.on('incident', function (d) { if (d.active) { window.GAME_AUDIO.incident(); toast(t('incident_active', { p: C.RISK.INCIDENT_PENALTY }), 'bad'); if (window.GAME_FX) window.GAME_FX.incident(); } });
    G.on('gameevent', function (d) {
      if (d.kind === 'end') return;
      var bad = (d.id === 'shortage' || d.id === 'leak');
      window.GAME_AUDIO.achievement();
      toast(t('ev_' + d.id) + ' — ' + t('ev_' + d.id + '_d'), bad ? 'bad' : 'gold');
    });
    G.on('milestone', function (d) {
      if (!G.state.seen.u_milestone) { G.state.seen.u_milestone = true; toast(t('hint_milestone'), 'gold'); G.save(); }
      var major = d.milestone >= 25;
      if (major && window.GAME_AUDIO.milestone) window.GAME_AUDIO.milestone(); else window.GAME_AUDIO.achievement(); buzz(major?[0,20,40,25]:18);
      // x2 toast now shows the actual output DELTA the doubling just unlocked. At the moment
      // the milestone fires, genOutput already reflects the doubled state, so the gain = half
      // of the new contribution (compute/sec). (item 5)
      var gain = (G.genOutput(d.id) * G.globalMult()) / 2;
      if (isFinite(gain) && gain > 0) toast(t('milestone_delta', { v: fmt(gain) }), 'gold');
      var r = genRefs[d.id];
      var b = r && r.el ? r.el.getBoundingClientRect() : null;
      var x = b ? b.left + b.width / 2 : window.innerWidth / 2;
      var y = b ? b.top + b.height / 2 : window.innerHeight / 2;
      if (major) {
        // real celebration at 25/50/100/... (bigger at 100+)
        window.GAME_FX.celebrate(window.innerWidth / 2, window.innerHeight * 0.4, '×2  ' + d.milestone + '!', d.milestone >= 100);
        if (r && r.el) window.GAME_FX.cardFlash(r.el);
      } else {
        window.GAME_FX.milestoneBurst(x, y);
        window.GAME_FX.popText(x, y, '×2!', 'big');
        if (r && r.el) window.GAME_FX.cardFlash(r.el);
      }
    });
  }

  // ---------- init ----------
  function init(offline) {
    if (built) return;
    built = true;
    renderStatic();
    bind();
    // Returning players: don't replay reveal hints for features they already have.
    // A brand-new save (no progress) keeps them so the journey unfolds live.
    var st = G.state;
    if (st.prestiges > 0 || st.taps > 0 || st.totalEarnedAllTime > 0 || st.onboarded) syncUnlockSeenSilently();
    window.GAME_AUDIO.setEnabled(G.state.sound);
    if (window.GAME_MUSIC) { window.GAME_MUSIC.setEnabled(G.state.music); if (G.state.music) window.GAME_MUSIC.start(); }
    applyCosmetics();
    startTicker();
    updateBuyModeBar();
    // deep-linkable tab via URL hash (e.g. #stats)
    var validTabs = { company: 1, upgrades: 1, research: 1, alignment: 1, world: 1, stats: 1, achievements: 1, settings: 1 };
    var hash = (location.hash || '').replace('#', '');
    switchTab(validTabs[hash] ? hash : 'company');
    window.addEventListener('hashchange', function () {
      var h = (location.hash || '').replace('#', '');
      if (validTabs[h]) switchTab(h);
    });
    update();
    // replay the current act's intro beat (also lets the player revisit it)
    if (location.hash === '#__intro') { setTimeout(function () { showActIntro(Math.max(1, G.currentAct())); }, 60); }
    // v17: bills accrued while away are settled through the offline modal too, so it must show
    // when there are bills to report even if earnings were negligible.
    var hasBills = offline && ((offline.elecBill || 0) > 0 || (offline.taxBill || 0) > 0);
    var offlineShown = offline && (offline.earned > 0 || hasBills);
    var awayOnly = !offlineShown && offline && offline.execReport && offline.execReport.length;
    if (offlineShown) {
      showOffline(offline);   // chains the away report on collect (showAwayReport)
      if (!G.state.onboarded) G.setOnboarded(true); // returning player; skip tour
    } else if (awayOnly) {
      // director resolved decisions but revenue was negligible — show the report directly
      showAwayReport(offline);
      if (!G.state.onboarded) G.setOnboarded(true);
    } else if (!G.state.onboarded) {
      showOnboarding();
    }
    // GDD v3 daily check-in: only once a real day has rolled over. If the offline/away
    // modal is up, it chains the daily on dismiss (maybeShowDaily) so we never clobber
    // the un-collected summary; otherwise fire it now.
    if (!offlineShown && !awayOnly) { if (G.dailyAvailable() && G.state.onboarded) setTimeout(showDaily, 60); }
    // DEV/QA hook: ?newstest seeds sample headlines and opens the news feed for screenshots.
    if (/[?&]newstest/.test(location.search)) {
      window.__openNewsFeed = showNewsFeed;
      window.__seedNews = function () {
        var seeds = [
          ['nh_react_lead', 'milestone', {}], ['nh_react_risk', 'regulatory', {}],
          ['nh_rival_agi', 'rival', { name: (G.activeRivals()[0] ? G.activeRivals()[0].name : t('rival_helion')), pct: 75 }],
          ['dec_data_dilemma_t', 'decision', {}], ['nh_fund_1', 'milestone', { round: t('fund_b') }],
          ['callback_lawsuit', 'rival', {}], ['nh_react_trust', 'rival', {}],
          ['nh_gen_1', 'milestone', { name: t('g_v4') }]
        ];
        var co = G.state.companyName || t('game_title');
        var log = seeds.map(function (s) {
          var v = s[2]; v.co = co;
          return { line: t(s[0], v), type: s[1], at: Date.now() };
        });
        G.state.newsLog = log;
        if (/world/.test(location.search)) { switchTab('world'); updateWorld(); } else showNewsFeed();
      };
      setTimeout(window.__seedNews, 120);
    }
  }
  function showDaily() {
    if (!G.dailyAvailable()) return;
    var r = G.claimDaily(); if (!r) return;
    window.GAME_AUDIO.prestige && window.GAME_AUDIO.prestige(); window.GAME_FX.confetti && window.GAME_FX.confetti(30);
    showModal(
      '<h3>' + t('daily_title') + '</h3>' +
      '<div class="big">' + t('daily_streak', { n: r.streak }) + '</div>' +
      '<div class="awlist"><div class="awrow done"><span class="awk">' + t('boost_label') + '</span><span class="awv">+' + r.tokens + '</span></div>' +
      '<div class="awrow done"><span class="awk">' + t('cash') + '</span><span class="awv">+' + fmt(r.cash) + '</span></div></div>' +
      '<div class="row"><button class="primary" id="dailyOk">' + t('offline_collect') + '</button></div>'
    );
    $('dailyOk').onclick = function () {
      hideModal();
      // streak-milestone celebration with a flame badge at day 7/14/30 (item 5)
      if (r.streak === 7 || r.streak === 14 || r.streak === 30) {
        setTimeout(function () {
          window.GAME_FX.confetti && window.GAME_FX.confetti(40);
          window.GAME_AUDIO.milestone && window.GAME_AUDIO.milestone();
          toast('🔥 ' + t('streak_milestone', { n: r.streak }), 'gold');
        }, 250);
      }
    };
  }

  // Android hardware BACK: close a tooltip/modal, else return to Lab, else let the OS handle it.
  function back() {
    var tip = document.getElementById('tooltip');
    if (tip && !tip.classList.contains('hidden')) { hideTip(); return true; }
    var m = $('modalRoot');
    if (m && !m.classList.contains('hidden')) { hideModal(); return true; }
    if (currentTab !== 'company') { switchTab('company'); return true; }
    return false;
  }
  window.GAME_UI = { init: init, update: update, toast: toast, renderStatic: renderStatic, back: back, isPaused: isPaused,
    // Phase 3 crisis modals (also driven by the engine 'crisis' event + the runway-HUD CTA)
    showRecoveryModal: showRecoveryModal, showAcquisitionModal: showAcquisitionModal, showNationalizeModal: showNationalizeModal,
    // Phase 7 — scenario reveal (also part of the new-game flow); exposed for QA/render checks
    showScenario: showScenario };
})();
