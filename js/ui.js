/* Singularity Inc. v2 — views. window.GAME_UI. Mobile-first, no build step. */
(function () {
  'use strict';
  var C = window.GAME_CONFIG;
  var G = window.GAME;
  var I = window.GAME_I18N;
  var FMT = window.GAME_FMT;
  var FX = window.GAME_FX;
  var AU = window.GAME_AUDIO;

  function t(k, v) { return I.t(k, v); }
  function $(id) { return document.getElementById(id); }
  function fmt(n) { return FMT.fmt(n); }
  function money(n) { return '$' + fmt(n); }
  function pct(x) { return Math.round(x * 100); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  function show(el, b) { if (el) el.classList.toggle('hidden', !b); }
  function txt(id, str) { var e = $(id); if (e && e.textContent !== str) e.textContent = str; }

  var s; // state ref
  var activeTab = 'company';
  var rebuildHwList = true, rebuildStaffList = true;
  var hwRows = {}, staffRows = {};

  // ---------------- boot ----------------
  function init(offline) {
    s = G.state;
    bindStatic();
    applyLang();
    G.on('release', onRelease);
    G.on('gameover', showGameOver);
    if (offline && offline.earned > 0) { try { G.applyOffline(offline.earned, offline); } catch (e) {} }
    if (s.over) showGameOver(s.outcome);
    update();
  }

  function applyLang() {
    txt('nav_company', t('tab_company'));
    txt('nav_hardware', t('tab_hardware'));
    txt('nav_model', t('tab_model'));
    txt('nav_world', t('tab_world'));
    txt('nav_settings', t('tab_settings'));
    txt('brandName', t('game_title'));
    txt('hwTitle', t('hw_title'));
    txt('hwIntro', t('hw_intro'));
    txt('staffTitle', t('staff_title'));
    txt('staffIntro', t('staff_intro'));
    txt('worldTitle', t('world_title'));
    txt('worldIntro', t('world_intro'));
    txt('standingsTitle', t('standings_title'));
    txt('premTitle', t('prem_title'));
    txt('premIntro', t('prem_intro'));
    txt('priceTitle', t('price_title'));
    txt('priceIntro', t('price_intro'));
    txt('metersTitle', t('meters_title'));
    txt('mhPowerL', t('power_label'));
    txt('mhUsersL', t('users_label'));
    txt('mhShareL', t('share_label'));
    txt('mhVerL', t('version_label'));
    txt('priceSweetBtn', t('price_set_default'));
    txt('settingsTitle', t('settings_title'));
    txt('langLabel', t('lang_label'));
    txt('soundLabel', t('sound_label'));
    txt('musicLabel', t('music_label'));
    txt('resetBtn', t('reset_label'));
    txt('creditsTxt', t('credits'));
    txt('tapLabel', t('tap_train'));
    document.querySelectorAll('#soundSeg button').forEach(function (b) { b.textContent = t(b.dataset.sound === 'on' ? 'on' : 'off'); });
    document.querySelectorAll('#musicSeg button').forEach(function (b) { b.textContent = t(b.dataset.music === 'on' ? 'on' : 'off'); });
    syncSettingsSegs();
    rebuildHwList = true; rebuildStaffList = true;
  }

  function bindStatic() {
    document.querySelectorAll('#tabbar button').forEach(function (b) {
      on(b, 'click', function () { switchTab(b.dataset.tab); });
    });
    on($('tapBtn'), 'click', doClick);
    on($('clickUpBtn'), 'click', function () { if (G.upgradeTap()) { sfx('buy'); update(); } });
    on($('trainBtn'), 'click', function () { if (G.startTraining()) { sfx('milestone'); update(); } });
    on($('premBtn'), 'click', function () { var np = G.nextPremise(); if (np && G.buyPremise(np.id)) { sfx('buy'); rebuildHwList = true; update(); } });
    on($('billPayBtn'), 'click', function () { G.payBill(); sfx('buy'); update(); });
    on($('priceSlider'), 'input', function () { G.setPrice(this.value); updatePrice(); });
    on($('priceSweetBtn'), 'click', function () { var sw = G.sweetSpotPrice(); G.setPrice(sw); var sl = $('priceSlider'); if (sl) sl.value = sw; updatePrice(); });
    document.querySelectorAll('#langSeg button').forEach(function (b) {
      on(b, 'click', function () { I.setLang(b.dataset.lang); s.lang = b.dataset.lang; applyLang(); update(); });
    });
    document.querySelectorAll('#soundSeg button').forEach(function (b) {
      on(b, 'click', function () { s.sound = b.dataset.sound === 'on'; try { AU.setEnabled(s.sound); } catch (e) {} syncSettingsSegs(); });
    });
    document.querySelectorAll('#musicSeg button').forEach(function (b) {
      on(b, 'click', function () {
        s.music = b.dataset.music === 'on';
        try { if (window.GAME_MUSIC) { if (s.music) window.GAME_MUSIC.start(); else window.GAME_MUSIC.stop(); } } catch (e) {}
        syncSettingsSegs();
      });
    });
    on($('resetBtn'), 'click', function () {
      if (confirm(t('reset_confirm'))) { hideGameOver(); G.reset(); s = G.state; applyLang(); switchTab('company'); update(); }
    });
    on($('goNewGame'), 'click', function () { hideGameOver(); G.reset(); s = G.state; applyLang(); switchTab('company'); update(); });
  }

  function sfx(name) { try { if (AU && AU[name]) AU[name](); } catch (e) {} }

  function syncSettingsSegs() {
    document.querySelectorAll('#langSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.lang === I.getLang()); });
    document.querySelectorAll('#soundSeg button').forEach(function (b) { b.classList.toggle('on', (b.dataset.sound === 'on') === !!s.sound); });
    document.querySelectorAll('#musicSeg button').forEach(function (b) { b.classList.toggle('on', (b.dataset.music === 'on') === !!s.music); });
  }

  function switchTab(tab) {
    if (!tab) return;
    activeTab = tab;
    document.querySelectorAll('#content .tab').forEach(function (sec) { sec.classList.toggle('active', sec.dataset.tab === tab); });
    document.querySelectorAll('#tabbar button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
    update();
  }

  // ---------------- click ----------------
  function doClick() {
    var v = G.click();
    if (v > 0) {
      sfx('tap');
      try {
        var r = $('tapBtn').getBoundingClientRect();
        FX.tapBurst(r.left + r.width / 2, r.top + r.height / 2);
        FX.popText(r.left + r.width / 2, r.top + 8, '+' + money(v));
      } catch (e) {}
      update();
    } else if (!s.boughtLaptop) {
      sfx('error');
      switchTab('hardware');
    }
  }

  // ---------------- dynamic list builders ----------------
  function buildHwList() {
    var host = $('hwList'); if (!host) return;
    host.innerHTML = ''; hwRows = {};
    C.HARDWARE.forEach(function (h) {
      var row = document.createElement('div');
      row.className = 'gen-row';
      row.innerHTML = '<div class="gen-main"><div class="gen-name"></div><div class="gen-stats muted small"></div><div class="gen-owned muted small"></div></div><button class="gen-buy"></button>';
      host.appendChild(row);
      var btn = row.querySelector('.gen-buy');
      on(btn, 'click', function () { if (G.buyHw(h.id)) { sfx('buy'); update(); } });
      hwRows[h.id] = { row: row, name: row.querySelector('.gen-name'), stats: row.querySelector('.gen-stats'), owned: row.querySelector('.gen-owned'), btn: btn };
    });
    rebuildHwList = false;
  }

  function buildStaffList() {
    var host = $('staffList'); if (!host) return;
    host.innerHTML = ''; staffRows = {};
    C.STAFF.forEach(function (st) {
      var row = document.createElement('div');
      row.className = 'gen-row';
      row.innerHTML = '<div class="gen-main"><div class="gen-name"></div><div class="gen-stats muted small"></div></div><button class="gen-buy"></button>';
      host.appendChild(row);
      var btn = row.querySelector('.gen-buy');
      on(btn, 'click', function () { if (G.hire(st.id)) { sfx('hireDone'); update(); } });
      staffRows[st.id] = { name: row.querySelector('.gen-name'), stats: row.querySelector('.gen-stats'), btn: btn };
    });
    rebuildStaffList = false;
  }

  // ---------------- per-frame update ----------------
  function update() {
    if (!s) s = G.state;
    if (s.over) return;
    txt('cashVal', money(s.cash));
    var net = G.netPerSec();
    var ne = $('netVal');
    if (ne) { ne.textContent = (net >= 0 ? '+' : '−') + money(Math.abs(net)) + '/s'; ne.classList.toggle('neg', net < 0); }
    updateDateHud();
    updateModelHud();
    updateBillPlaque();
    if (activeTab === 'company') updateCompany();
    else if (activeTab === 'hardware') updateHardware();
    else if (activeTab === 'model') updateModel();
    else if (activeTab === 'world') updateWorld();
    else if (activeTab === 'settings') syncSettingsSegs();
  }

  function updateDateHud() {
    var d = G.dateLabel();
    txt('dateHud', t('date_label', { day: d.day, month: d.month, tod: t('date_' + d.tod) }));
    var billIn = Math.ceil(G.nextBillIn() / C.DAY_SEC);
    var covered = G.billCovered();
    txt('solvency', t('bill_next', { d: billIn, v: fmt(G.billForecast()) }) + ' · ' + (covered ? t('bill_covered') : t('bill_uncovered')));
    var sol = $('solvency'); if (sol) sol.classList.toggle('neg', !covered);
  }

  function updateModelHud() {
    var live = s.version >= 1;
    show($('modelHud'), live);
    if (!live) return;
    txt('mhPower', fmt(G.power()));
    txt('mhUsers', fmt(s.users));
    txt('mhShare', pct(G.playerShare()) + '%');
    txt('mhVer', 'v' + s.version);
  }

  function updateBillPlaque() {
    var due = s.billDue > 0.01;
    show($('billPlaque'), due);
    var pl = $('billPlaque'); if (pl) pl.classList.toggle('overdue', s.overdue);
    if (!due) return;
    txt('billText', s.overdue ? t('bill_overdue') : t('bill_due', { v: fmt(s.billDue) }));
    txt('billPayBtn', t('bill_pay', { v: fmt(Math.min(s.cash, s.billDue)) }));
  }

  // -------- company tab --------
  function updateCompany() {
    var canClick = s.boughtLaptop;
    txt('tapValue', canClick ? '+' + money(G.tapValue()) : '');
    txt('tapHint', canClick ? t('tap_hint_click') : t('tap_hint_buy_laptop'));
    var cub = $('clickUpBtn');
    if (s.boughtLaptop) {
      show(cub, true);
      if (s.tapLevel >= C.TAP.upgrade.maxLevel) { cub.textContent = t('click_upgrade_max', { v: fmt(G.tapValue()) }); cub.disabled = true; }
      else { cub.textContent = t('click_upgrade', { v: fmt(G.tapValue() * C.TAP.upgrade.gain), c: fmt(G.tapUpgradeCost()) }); cub.disabled = !G.canUpgradeTap(); }
    } else show(cub, false);
    updateTrain();
    show($('pricePanel'), s.version >= 1);
    if (s.version >= 1) updatePrice();
    show($('metersPanel'), s.version >= 1);
    if (s.version >= 1) updateMeters();
    updatePrem();
  }

  function updateTrain() {
    var def = G.currentVersionDef();
    if (!def) { txt('trainHead', t('model_live', { label: 'v' + s.version })); show($('trainBtn'), false); show($('trainProg'), false); txt('trainHint', ''); return; }
    var label = def.label;
    txt('trainHead', t('model_dev', { label: label }));
    if (s.training) {
      show($('trainBtn'), false); show($('trainProg'), true);
      $('trainFill').style.width = pct(G.trainingProgress()) + '%';
      txt('trainTimer', t('train_time_left', { t: FMT.fmtTime(G.trainingTimeLeft()) }));
      txt('trainHint', t('train_click_faster'));
    } else {
      show($('trainProg'), false);
      var btn = $('trainBtn'); show(btn, true);
      var have = G.availablePower();
      if (have >= def.powerReq) { btn.disabled = false; btn.textContent = t('train_start', { label: label }); txt('trainHint', ''); }
      else { btn.disabled = true; btn.textContent = t('train_need_power', { req: fmt(def.powerReq), label: label, have: fmt(have) }); txt('trainHint', ''); }
    }
  }

  function arrowFor() {
    if (s.version < 1) return t('approval_flat');
    var sweet = G.sweetSpotPrice();
    var ratio = sweet > 0 ? s.price / sweet : 1;
    return ratio > C.RISK.gougeStartRatio ? t('approval_down') : t('approval_up');
  }

  function updatePrice() {
    txt('priceLabel', t('price_label', { v: s.price.toFixed(2) }));
    var sl = $('priceSlider');
    if (sl && document.activeElement !== sl) sl.value = s.price;
    var p = s.price;
    var profit = G.revenuePreview(p) - G.costPerSec();
    txt('pricePreview', t('price_preview', {
      p: p.toFixed(2), share: pct(G.share(p)), users: fmt(G.usersTarget(p)),
      sign: profit >= 0 ? '+' : '−', profit: fmt(Math.abs(profit)), arrow: arrowFor()
    }));
    txt('priceSweet', t('price_sweet', { v: G.sweetSpotPrice().toFixed(2) }));
  }

  function updateMeters() {
    var host = $('metersList'); if (!host) return;
    var defs = [
      { id: 'safety', key: 'meter_safety', val: s.safety },
      { id: 'approval', key: 'meter_approval', val: s.approval },
      { id: 'legality', key: 'meter_legality', val: s.legality }
    ];
    if (host.children.length !== 3) {
      host.innerHTML = '';
      defs.forEach(function (d) {
        var row = document.createElement('div');
        row.className = 'meterRow';
        row.innerHTML = '<span class="meterLbl"></span><div class="bar"><div class="meterFill"></div></div><span class="meterVal"></span>';
        host.appendChild(row);
      });
    }
    var rows = host.children;
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      rows[i].querySelector('.meterLbl').textContent = t(d.key);
      var fill = rows[i].querySelector('.meterFill');
      fill.style.width = Math.round(d.val) + '%';
      fill.classList.toggle('low', d.val < 25);
      fill.classList.toggle('mid', d.val >= 25 && d.val < 50);
      rows[i].querySelector('.meterVal').textContent = Math.round(d.val);
    }
  }

  function premName(id) { return t('prem_name_' + id); }
  function updatePrem() {
    var cur = C.PREMBYID[s.premise];
    txt('premInfo',
      t('prem_current', { name: premName(s.premise) }) + ' · ' +
      t('prem_capacity', { used: G.ownedM2().toFixed(1), cap: fmt(cur.m2) }) + ' · ' +
      t('prem_legality', { v: pct(cur.legality) }) + ' · ' + t('prem_safety', { v: pct(cur.safety) }));
    var np = G.nextPremise();
    var btn = $('premBtn');
    if (!np) { btn.textContent = t('prem_max'); btn.disabled = true; return; }
    btn.textContent = t('prem_upgrade', { name: premName(np.id), c: fmt(np.cost) });
    btn.disabled = !G.canBuyPremise(np.id);
  }

  // -------- hardware tab --------
  function hwName(id) { return t('hw_name_' + id); }
  function updateHardware() {
    if (rebuildHwList) buildHwList();
    txt('hwCapacity', t('prem_capacity', { used: G.ownedM2().toFixed(1), cap: fmt(G.capacityM2()) }) + ' · ' + premName(s.premise));
    C.HARDWARE.forEach(function (h) {
      var r = hwRows[h.id]; if (!r) return;
      r.name.textContent = hwName(h.id);
      r.stats.textContent = t('hw_cost') + ' ' + money(h.cost) + ' · ' + t('hw_power') + ' ' + fmt(h.power) +
        (h.rent > 0 ? ' · ' + t('hw_rent') + ' ' + money(h.rent) + '/s' : '') +
        ' · ' + h.kw + t('hw_kw') + ' · ' + h.m2 + t('hw_m2');
      var ownedTxt = '';
      if (s.hw[h.id] > 0) ownedTxt += t('hw_owned', { n: s.hw[h.id] });
      if (s.committed[h.id] > 0) ownedTxt += (ownedTxt ? ' · ' : '') + t('hw_committed', { n: s.committed[h.id] });
      r.owned.textContent = ownedTxt;
      var can = G.canBuyHw(h.id);
      r.btn.disabled = !can;
      if (s.cash < h.cost) r.btn.textContent = t('hw_no_cash', { c: fmt(h.cost) });
      else if (G.freeM2() < h.m2) r.btn.textContent = t('hw_no_space');
      else r.btn.textContent = t('hw_buy') + ' ' + money(h.cost);
      r.row.classList.toggle('pulse', !s.boughtLaptop && h.id === 'laptop');
    });
  }

  // -------- model/team tab --------
  function staffName(id) { return t('staff_name_' + id); }
  function updateModel() {
    if (rebuildStaffList) buildStaffList();
    C.STAFF.forEach(function (st) {
      var r = staffRows[st.id]; if (!r) return;
      r.name.textContent = staffName(st.id) + ' ' + t('staff_count', { n: s.staff[st.id] });
      r.stats.textContent = t('staff_desc_' + st.id) + ' · ' + money(st.salary) + '/s';
      r.btn.disabled = !G.canHire(st.id);
      r.btn.textContent = t('staff_hire', { c: fmt(G.staffHireCost(st.id)) });
    });
  }

  // -------- world tab --------
  function rivalName(id) { return id === 'you' ? t('standings_you') : t('rival_name_' + id); }
  function updateWorld() {
    var st = G.standings();
    var leader = st[0];
    var msg;
    if (leader.isPlayer) msg = t('race_ahead');
    else { var youIdx = st.findIndex(function (r) { return r.isPlayer; }); msg = (youIdx <= 1) ? t('race_close') : t('race_behind'); }
    txt('raceStatus', msg);
    var host = $('standingsRows'); host.innerHTML = '';
    st.forEach(function (r, i) {
      var row = document.createElement('div');
      row.className = 'gen-row' + (r.isPlayer ? ' you' : '');
      row.innerHTML = '<div class="gen-main"><div class="gen-name">' + (i + 1) + '. ' + rivalName(r.id) + '</div>' +
        '<div class="gen-stats muted small">' + t('power_label') + ' ' + fmt(r.power) + '</div></div>';
      host.appendChild(row);
    });
  }

  // ---------------- events ----------------
  function onRelease(ver) {
    sfx('release');
    try { FX.celebrate(window.innerWidth / 2, window.innerHeight / 2); } catch (e) {}
    toast(t('release_done', { label: 'v' + ver }));
    var sl = $('priceSlider'); if (sl) sl.value = s.price;
    update();
  }

  function toast(msg) {
    var root = $('toastRoot'); if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () { el.classList.add('show'); }, 10);
    setTimeout(function () { el.classList.remove('show'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400); }, 3200);
  }

  // ---------------- game over ----------------
  function showGameOver(outcome) {
    var scr = $('gameOverScreen'); if (!scr) return;
    txt('goTitle', t('go_' + outcome + '_title'));
    txt('goFlavor', t('go_' + outcome + '_flavor'));
    txt('goSummary', t('go_summary', { day: G.dayNumber(), ver: 'v' + s.version, cash: fmt(Math.max(0, s.cash)) }));
    txt('goNewGame', t('go_new_game'));
    var gs = $('goStats'); if (gs) gs.style.display = 'none';
    scr.classList.remove('hidden');
    try { if (outcome === 'agi') AU.singularity(); else AU.incident(); } catch (e) {}
  }
  function hideGameOver() { var scr = $('gameOverScreen'); if (scr) scr.classList.add('hidden'); }

  window.GAME_UI = {
    init: init,
    update: update,
    back: function () { if (activeTab !== 'company') { switchTab('company'); return true; } return false; },
    isPaused: function () { return false; }
  };
})();
