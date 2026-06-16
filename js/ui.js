/* UI layer -> window.GAME_UI. Builds DOM, wires events, updates each frame.
   Pure presentation on top of window.GAME. */
(function () {
  'use strict';

  var G = window.GAME, C = window.GAME_CONFIG, FMT = window.GAME_FMT;
  var t = function (k, v) { return window.GAME_I18N.t(k, v); };
  var $ = function (id) { return document.getElementById(id); };
  var fmt = FMT.fmt;

  var currentTab = 'company';
  var genRefs = {};      // id -> {el, cost, count, sub, mbar, qty}
  var built = false;
  var ICON = window.GAME_ICONS || {};
  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  function ic(key) { return key === 'ic_check' ? CHECK_SVG : (ICON[key] || ''); }

  // ---------- helpers ----------
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function toast(msg, kind) {
    var root = $('toastRoot');
    var e = el('div', 'toast' + (kind ? ' ' + kind : ''), msg);
    root.appendChild(e);
    setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 3000);
  }
  function floatText(x, y, txt) {
    var e = el('div', 'float', txt);
    e.style.left = (x - 12) + 'px';
    e.style.top = (y - 20) + 'px';
    $('fxRoot').appendChild(e);
    setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 900);
  }

  // ---------- static labels (i18n) ----------
  function renderStatic() {
    document.documentElement.lang = window.GAME_I18N.getLang();
    $('brandName').textContent = t('game_title');
    $('brandIcon').innerHTML = ic('ic_insight');
    $('tapIcon').innerHTML = ic('ic_brain');
    $('tapLabel').textContent = t('tap_button');
    $('tapHint').textContent = t('tap_hint');
    // nav icons (replace emoji with inline SVG)
    var navIcons = { company: 'nav_company', upgrades: 'nav_upgrades', research: 'nav_research', alignment: 'nav_alignment', stats: 'nav_stats', achievements: 'nav_achievements', settings: 'nav_settings' };
    var navBtns = $('tabbar').children;
    for (var ni = 0; ni < navBtns.length; ni++) {
      var tabKey = navBtns[ni].dataset.tab;
      var tiEl = navBtns[ni].querySelector('.ti');
      if (tiEl && navIcons[tabKey]) tiEl.innerHTML = ic(navIcons[tabKey]);
    }
    // nav
    $('nav_company').textContent = t('tab_company');
    $('nav_upgrades').textContent = t('tab_upgrades');
    $('nav_research').textContent = t('tab_research');
    $('nav_alignment').textContent = t('tab_alignment');
    $('nav_stats').textContent = t('tab_stats');
    $('nav_achievements').textContent = t('tab_achievements');
    $('nav_settings').textContent = t('tab_settings');
    // upgrades
    $('upgradesTitle').textContent = t('upgrades_title');
    $('managersTitle').textContent = t('managers_title');
    // research
    $('researchTitle').textContent = t('research_title');
    $('researchDesc').textContent = t('research_desc', { p: (C.PRESTIGE.BONUS * 100) });
    $('prestigeUpTitle').textContent = t('prestige_upgrades_title');
    // alignment
    $('alignTitle').textContent = t('alignment_title');
    $('alignIntro').textContent = t('alignment_intro');
    $('riskLabel').textContent = t('risk_label');
    $('alignLabel').textContent = t('alignment_label');
    // stats
    $('statsTitle').textContent = t('stats_title');
    $('achTitle').textContent = t('achievements_title');
    // settings
    $('settingsTitle').textContent = t('settings_title');
    $('langLabel').textContent = t('language');
    $('soundLabel').textContent = t('sound');
    $('adBoostLabel').textContent = t('ad_boost');
    $('adCashLabel').textContent = t('ad_cash');
    $('adBoostBtn').textContent = t('ad_boost');
    $('adCashBtn').textContent = t('ad_cash');
    $('saveBtn').textContent = t('save_now');
    $('resetBtn').textContent = t('reset_progress');
    $('creditsTxt').textContent = t('credits');
    $('versionTxt').textContent = t('version', { v: '1.0' });
    $('riskMiniLabel').innerHTML = '<span>' + t('risk_label') + '</span><span id="riskMiniPct"></span>';
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
    C.GENERATORS.forEach(function (g) {
      var card = el('div', 'card locked');
      card.innerHTML =
        '<div class="iconwrap">' + ic('gen_' + g.id) + '</div>' +
        '<div class="info">' +
          '<div class="name">' + t('g_' + g.id) + '</div>' +
          '<div class="desc">' + t('g_' + g.id + '_d') + '</div>' +
          '<div class="sub"></div>' +
          '<div class="milestoneBar"><div></div></div>' +
        '</div>' +
        '<div class="right">' +
          '<div class="cost">0</div>' +
          '<div class="count"></div>' +
          '<div class="qty"></div>' +
        '</div>' +
        '<div class="ownedBadge hidden">0</div>';
      card.addEventListener('click', function (e) {
        if (G.buyGen(g.id)) {
          window.GAME_AUDIO.buy();
          window.GAME_FX.cardFlash(card);
          var r = card.getBoundingClientRect();
          window.GAME_FX.buyBurst(e.clientX || (r.left + r.width / 2), e.clientY || (r.top + r.height / 2));
        }
      });
      list.appendChild(card);
      genRefs[g.id] = {
        el: card,
        cost: card.querySelector('.cost'),
        count: card.querySelector('.count'),
        sub: card.querySelector('.sub'),
        mbar: card.querySelector('.milestoneBar > div'),
        qty: card.querySelector('.qty'),
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
      var qty = G.buyQty(g.id);
      var cost = G.genCostCumulative(g.id, qty);
      var unlockedByPrev = true;
      // soft lock: show generator only if previous owned or it's the first or already owned
      var idx = C.GENERATORS.indexOf(g);
      if (idx > 0 && owned === 0 && s.gens[C.GENERATORS[idx - 1].id] === 0 && s.cash < g.baseCost * 0.5) {
        r.el.classList.add('hidden');
        return;
      }
      r.el.classList.remove('hidden');
      var afford = s.cash >= cost && qty >= 1;
      r.el.classList.toggle('affordable', afford);
      r.el.classList.toggle('locked', !afford);
      r.cost.textContent = fmt(cost);
      r.cost.classList.toggle('cant', !afford);
      r.count.textContent = owned;
      r.qty.textContent = owned > 0 ? ('+' + qty) : (s.buyMode === 'max' ? '' : 'x' + (s.buyMode));
      r.sub.textContent = owned > 0 ? (fmt(G.genOutput(g.id) * G.globalMult()) + '/sec') : t('produces', { v: fmt(g.baseOut * G.globalMult()) });
      if (owned > 0) { r.badge.classList.remove('hidden'); r.badge.textContent = owned; }
      else r.badge.classList.add('hidden');
      var msLevel = owned >= 200 ? 3 : owned >= 100 ? 2 : owned >= 25 ? 1 : 0;
      r.el.classList.toggle('ms1', msLevel === 1);
      r.el.classList.toggle('ms2', msLevel === 2);
      r.el.classList.toggle('ms3', msLevel === 3);
      var nm = G.nextMilestone(owned);
      if (nm) { r.mbar.style.width = Math.min(100, (owned / nm) * 100) + '%'; r.mbar.parentNode.style.display = ''; }
      else { r.mbar.parentNode.style.display = 'none'; }
    });
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
    // empty hint
    var hint = $('upgradeList').nextSibling;
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
    var nodes = $('managerList').children;
    for (var i = 0; i < nodes.length; i++) {
      var card = nodes[i];
      var m = C.MANAGERS[i];
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
  }

  // ---------- prestige upgrades ----------
  function buildPrestigeUpgrades() {
    var list = $('prestigeUpList');
    list.innerHTML = '';
    C.PRESTIGE.upgrades.forEach(function (p) {
      var card = el('div', 'pcard');
      card.dataset.pid = p.id;
      var desc = (p.type === 'startCash') ? t(p.id + '_d', { v: fmt(p.value) }) : t(p.id + '_d');
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

  // ---------- achievements ----------
  function buildAchievements() {
    var list = $('achList');
    list.innerHTML = '';
    C.ACHIEVEMENTS.forEach(function (a) {
      var card = el('div', 'ach locked');
      card.dataset.aid = a.id;
      card.innerHTML =
        '<div class="aicon">' + ic('nav_achievements') + '</div>' +
        '<div><div class="aname">' + t(a.id) + '</div><div class="adesc">' + t(a.id + '_d') + '</div></div>' +
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
    var rows = [
      [t('stat_total_cash'), fmt(s.totalEarnedAllTime)],
      [t('stat_this_run'), fmt(s.totalEarnedThisRun)],
      [t('stat_cps'), fmt(G.cps())],
      [t('stat_taps'), s.taps],
      [t('stat_generators'), totalGens],
      [t('stat_prestiges'), s.prestiges],
      [t('stat_rp'), s.rp],
      [t('stat_total_rp'), s.totalRP],
      [t('stat_incidents'), s.incidentsTotal],
      [t('stat_playtime'), FMT.fmtTime(s.playtime)]
    ];
    var html = '';
    rows.forEach(function (r) { html += '<div class="statItem"><span>' + r[0] + '</span><span>' + r[1] + '</span></div>'; });
    $('statList').innerHTML = html;
  }

  // ---------- research / prestige ----------
  function updateResearch() {
    var s = G.state;
    var gain = G.prestigeGain();
    $('prestigeGain').textContent = t('prestige_gain', { n: gain });
    var btn = $('prestigeBtn');
    btn.textContent = t('prestige_button');
    btn.disabled = !G.canPrestige();
    if (!G.canPrestige()) $('prestigeGain').textContent = t('prestige_locked');
    $('rpHave').textContent = t('rp_have', { n: s.rp });
    $('currentBonus').textContent = t('current_bonus', { p: Math.round(s.rp * C.PRESTIGE.BONUS * 100) });
  }

  // ---------- alignment ----------
  function updateAlignment() {
    var s = G.state;
    var pct = (s.risk / C.RISK.MAX) * 100;
    $('riskPct').textContent = Math.floor(s.risk) + '%';
    $('riskFill').style.width = pct + '%';
    var col = pct > C.RISK.WARN_AT ? 'linear-gradient(90deg, var(--warn), var(--bad))' :
              'linear-gradient(90deg, var(--good), var(--warn))';
    $('riskFill').style.background = col;
    $('riskGainTxt').textContent = t('risk_gain', { v: G.riskGainRate().toFixed(2) }) +
      (s.align > 0 ? ('  ·  ' + t('align_suppress', { v: G.alignSuppress().toFixed(2) })) : '');
    $('alignOwned').textContent = s.align;
    $('alignSuppressTxt').textContent = t('align_suppress', { v: G.alignSuppress().toFixed(2) });
    var ac = G.alignCost();
    var btn = $('buyAlignBtn');
    btn.textContent = t('buy_alignment') + ' (' + fmt(ac) + ')';
    btn.disabled = s.cash < ac;
    // incident box
    var ib = $('incidentBox');
    if (G.incidentActive()) {
      ib.classList.remove('hidden');
      var remain = Math.max(0, (s.incidentEndsAt - Date.now()) / 1000);
      var containCost = s.cash * C.RISK.CONTAIN_COST_FRAC;
      ib.innerHTML =
        '<div class="ititle">' + t('incident_active', { p: C.RISK.INCIDENT_PENALTY }) + '</div>' +
        '<div class="idesc">' + t('incident_desc', { t: FMT.fmtTime(remain) }) + '</div>' +
        '<button id="containBtn">' + t('contain_button', { v: fmt(containCost) }) + '</button>';
      $('containBtn').onclick = function () {
        if (!G.containIncident()) toast(t('contain_cant'), 'bad');
      };
    } else {
      ib.classList.add('hidden');
    }
    // mini bar on company tab
    var mfill = $('riskMiniFill');
    if (mfill) { mfill.style.width = pct + '%'; mfill.style.background = col; }
    var mpct = $('riskMiniPct');
    if (mpct) mpct.textContent = Math.floor(s.risk) + '%';
  }

  // ---------- top bar / boost ----------
  function updateTop() {
    var s = G.state;
    $('cashVal').textContent = fmt(s.cash);
    $('cpsVal').textContent = t('per_sec', { v: fmt(G.cps()) });
    $('tapValue').textContent = '+' + fmt(G.tapValue());
    var bb = $('boostBadge');
    if (G.boostActive()) {
      bb.classList.remove('hidden');
      bb.textContent = t('boost_active', { t: FMT.fmtTime((s.boostUntil - Date.now()) / 1000) });
    } else bb.classList.add('hidden');
    var eb = $('eventBadge');
    if (G.eventActive() && s.eventId) {
      eb.classList.remove('hidden');
      eb.classList.toggle('bad', s.eventId === 'shortage');
      eb.textContent = t('ev_active', { name: t('ev_' + s.eventId), t: FMT.fmtTime((s.eventEndsAt - Date.now()) / 1000) });
    } else eb.classList.add('hidden');
  }

  // ---------- main per-frame update ----------
  function update() {
    updateTop();
    if (currentTab === 'company') updateGenerators();
    else if (currentTab === 'upgrades') { updateUpgrades(); updateManagers(); }
    else if (currentTab === 'research') updateResearch();
    else if (currentTab === 'alignment') updateAlignment();
    else if (currentTab === 'stats') updateStats();
    else if (currentTab === 'achievements') updateAchievements();
    // risk mini always (company tab) + settings seg states
    if (currentTab === 'company') updateAlignment();
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
  }

  // ---------- tabs ----------
  function switchTab(tab) {
    currentTab = tab;
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i].dataset.tab === tab);
    var navs = $('tabbar').children;
    for (var j = 0; j < navs.length; j++) navs[j].classList.toggle('active', navs[j].dataset.tab === tab);
    var showBuyMode = (tab === 'company');
    $('buyModeBar').classList.toggle('hidden', !showBuyMode);
    update();
  }

  function updateBuyModeBar() {
    var btns = $('buyModeBar').children;
    for (var i = 0; i < btns.length; i++) {
      var m = btns[i].dataset.mode;
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

  function showOffline(off) {
    showModal(
      '<h3>' + t('offline_title') + '</h3>' +
      '<p>' + t('offline_away', { t: FMT.fmtTime(off.cappedSec) }) + '</p>' +
      '<div class="big">' + t('offline_earned', { v: fmt(off.earned) }) + '</div>' +
      '<div class="row">' +
      '<button class="primary" id="offCollect">' + t('offline_collect') + '</button>' +
      '<button class="reward" id="offDouble">' + t('offline_double') + '</button>' +
      '</div>'
    );
    $('offCollect').onclick = function () { G.applyOffline(off.earned); hideModal(); };
    $('offDouble').onclick = function () {
      window.GAME_ADS.showRewarded({
        onReward: function () { G.applyOffline(off.earned * 2); hideModal(); },
        onUnavailable: function () { G.applyOffline(off.earned); hideModal(); toast(t('ad_unavailable'), 'bad'); }
      });
    };
  }

  // ---------- onboarding tour ----------
  function showOnboarding() {
    var steps = [
      { icon: '🧠', title: 'ob_1_title', body: 'ob_1_body' },
      { icon: '💻', title: 'ob_2_title', body: 'ob_2_body' },
      { icon: '🛡️', title: 'ob_3_title', body: 'ob_3_body' }
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
    // tap
    var tapBtn = $('tapBtn');
    function doTap(clientX, clientY) {
      var v = G.tap();
      window.GAME_AUDIO.tap();
      floatText(clientX, clientY, '+' + fmt(v));
      window.GAME_FX.tapBurst(clientX, clientY);
    }
    tapBtn.addEventListener('click', function (e) { doTap(e.clientX, e.clientY); });

    // tab nav
    var navs = $('tabbar').children;
    for (var i = 0; i < navs.length; i++) {
      (function (btn) { btn.addEventListener('click', function () { switchTab(btn.dataset.tab); }); })(navs[i]);
    }

    // buy mode
    var bms = $('buyModeBar').children;
    for (var k = 0; k < bms.length; k++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var m = btn.dataset.mode;
          G.setBuyMode(m === 'max' ? 'max' : parseInt(m, 10));
          updateBuyModeBar();
        });
      })(bms[k]);
    }

    // prestige
    $('prestigeBtn').addEventListener('click', function () {
      var gain = G.prestigeGain();
      showModal(
        '<h3>' + t('research_title') + '</h3>' +
        '<p>' + t('prestige_confirm', { n: gain }) + '</p>' +
        '<div class="row"><button class="secondary" id="pCancel">✕</button>' +
        '<button class="primary" id="pOk">' + t('prestige_button') + '</button></div>'
      );
      $('pCancel').onclick = hideModal;
      $('pOk').onclick = function () {
        hideModal();
        if (G.doPrestige()) {
          window.GAME_AUDIO.prestige();
          var f = t('flavor_' + Math.floor((G.state.prestiges) % 5));
          toast(f, 'gold');
          var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
          window.GAME_FX.milestoneBurst(cx, cy);
          window.GAME_FX.popText(cx, cy, '+' + G.state.rp + ' RP', 'big');
          // interstitial on prestige (graceful)
          window.GAME_ADS.showInterstitial({});
        }
      };
    });

    // alignment buy
    $('buyAlignBtn').addEventListener('click', function () { if (G.buyAlignment()) window.GAME_AUDIO.buy(); });

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
    // save / reset
    $('saveBtn').addEventListener('click', function () { G.save(); toast(t('saved_toast')); });
    $('resetBtn').addEventListener('click', function () {
      showModal('<h3>⚠️</h3><p>' + t('reset_confirm') + '</p>' +
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
      window.GAME_AUDIO.achievement();
      var r = genRefs[d.id];
      if (r && r.el) {
        var b = r.el.getBoundingClientRect();
        var x = b.left + b.width / 2, y = b.top + b.height / 2;
        window.GAME_FX.milestoneBurst(x, y);
        window.GAME_FX.popText(x, y, '×2!', 'big');
        window.GAME_FX.cardFlash(r.el);
      }
    });
  }

  // ---------- init ----------
  function init(offline) {
    if (built) return;
    built = true;
    renderStatic();
    bind();
    window.GAME_AUDIO.setEnabled(G.state.sound);
    updateBuyModeBar();
    // deep-linkable tab via URL hash (e.g. #stats)
    var validTabs = { company: 1, upgrades: 1, research: 1, alignment: 1, stats: 1, achievements: 1, settings: 1 };
    var hash = (location.hash || '').replace('#', '');
    switchTab(validTabs[hash] ? hash : 'company');
    window.addEventListener('hashchange', function () {
      var h = (location.hash || '').replace('#', '');
      if (validTabs[h]) switchTab(h);
    });
    update();
    if (offline && offline.earned > 0) {
      showOffline(offline);
      if (!G.state.onboarded) G.setOnboarded(true); // returning player; skip tour
    } else if (!G.state.onboarded) {
      showOnboarding();
    }
  }

  window.GAME_UI = { init: init, update: update, toast: toast, renderStatic: renderStatic };
})();
