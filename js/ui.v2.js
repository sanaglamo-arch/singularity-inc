/* Singularity Inc. v2 — presentation layer. window.GAME_UI.
   Premium dark UI built on styles.css. Mobile-first (360px), RU default.
   Architecture: each screen has build() (structure, once on tab switch) +
   sync() (patch live values, ~30fps). HUD + nav synced every frame. */
(function () {
  'use strict';
  var G = window.GAME, C = window.GAME_CONFIG, FMT = window.GAME_FMT;
  var I = window.GAME_I18N, IC = window.GAME_ICONS, FX = window.GAME_FX, A = window.GAME_AUDIO, M = window.GAME_MUSIC;
  function t(k, v) { return I.t(k, v); }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function money(n) { return '$' + FMT.fmt(n); }
  function s() { return G.state; }

  var TABS = ['company', 'hardware', 'model', 'world', 'settings'];
  var activeTab = 'company';
  var screenEl, navBtns = {};
  var built = {};           // which tab's structure is currently in the DOM
  var modalQueue = [];      // pending FTUE/event modals
  var modalOpen = false;
  var tickerIdx = 0, tickerTimer = 0;
  var previewPrice = null;

  // ---------------------------------------------------------------- helpers
  function pct(x) { return Math.round(x * 100); }
  function dateText() {
    var d = G.dateLabel();
    return t('date_label', { day: d.day, month: d.month, tod: t('date_' + d.tod) });
  }
  function setText(id, txt) { var e = $(id); if (e && e.textContent !== txt) e.textContent = txt; }

  // ============================================================ HUD + NAV
  function syncHud() {
    var st = s();
    setText('hudMoney', money(st.cash));
    var net = G.netPerSec();
    var rate = $('hudRate');
    if (rate) {
      rate.textContent = (net >= 0 ? '+' : '−') + '$' + FMT.fmt(Math.abs(net)) + '/' + (I.getLang() === 'ru' ? 'с' : 's');
      rate.className = 'rate num' + (net < 0 ? ' neg' : '');
    }
    setText('hudDate', dateText());

    var sol = $('hudSolvency');
    if (sol) {
      var days = Math.ceil(G.nextBillIn() / C.DAY_SEC);
      var ok = G.billCovered();
      sol.textContent = t('bill_next', { d: days, v: FMT.fmt(G.billForecast()) }) + ' ' + (ok ? t('bill_covered') : t('bill_uncovered'));
      sol.className = 'solvency num' + (ok ? '' : ' warn');
    }
  }

  function syncTicker(dt) {
    tickerTimer += dt || 0;
    var list = I.DICTS[I.getLang()].news_ticker || [];
    if (!list.length) return;
    if (tickerTimer > 6 || $('tickerText').textContent === '') {
      tickerTimer = 0;
      tickerIdx = (tickerIdx + 1) % list.length;
      setText('tickerTag', t('ticker_live'));
      setText('tickerText', list[tickerIdx]);
    }
  }

  function buildNav() {
    var icoMap = { company: 'nav_company', hardware: 'nav_upgrades', model: 'nav_alignment', world: 'nav_stats', settings: 'nav_settings' };
    var lblMap = { company: 'tab_company', hardware: 'tab_hardware', model: 'tab_model', world: 'tab_world', settings: 'tab_settings' };
    var nav = $('nav');
    TABS.forEach(function (tab) {
      var ico = $('navIco-' + tab); if (ico) ico.innerHTML = IC[icoMap[tab]] || '';
      setText('navLbl-' + tab, t(lblMap[tab]));
      var btn = nav.querySelector('.nav-item[data-tab="' + tab + '"]');
      navBtns[tab] = btn;
      btn.onclick = function () { switchTab(tab); };
    });
  }

  function switchTab(tab) {
    if (TABS.indexOf(tab) < 0) tab = 'company';
    activeTab = tab;
    TABS.forEach(function (x) { if (navBtns[x]) navBtns[x].classList.toggle('active', x === tab); });
    try { if (location.hash !== '#' + tab) location.hash = '#' + tab; } catch (e) {}
    buildScreen(tab);
  }

  // ============================================================ SCREENS
  function buildScreen(tab) {
    screenEl.innerHTML = '';
    built = {};
    if (tab === 'company') buildCompany();
    else if (tab === 'hardware') buildHardware();
    else if (tab === 'model') buildModel();
    else if (tab === 'world') buildWorld();
    else if (tab === 'settings') buildSettings();
    built[tab] = true;
    syncScreen();
  }
  function syncScreen() {
    if (!built[activeTab]) return;
    if (activeTab === 'company') syncCompany();
    else if (activeTab === 'hardware') syncHardware();
    else if (activeTab === 'model') syncModel();
    else if (activeTab === 'world') syncWorld();
  }

  // ---------------------------------------------------------- COMPANY
  function buildCompany() {
    var orbWrap = el('div', 'orb-wrap');
    var orb = el('button', 'orb display', '<span>' + t('tap_train') + '</span>');
    orb.id = 'orb';
    orb.setAttribute('aria-label', 'click');
    orbWrap.appendChild(orb);
    var orbHint = el('div', 'muted');
    orbHint.id = 'orbHint';
    orbHint.style.cssText = 'font-size:12px;margin-top:var(--s3);text-align:center;min-height:18px';
    orbWrap.appendChild(orbHint);
    screenEl.appendChild(orbWrap);
    bindOrb(orb);

    var upBtn = el('button', 'btn', '');
    upBtn.id = 'clickUpBtn';
    upBtn.style.marginBottom = 'var(--s3)';
    upBtn.onclick = function () {
      if (G.upgradeTap()) { if (s().sound) A.buy(); refreshAll(); }
      else if (s().sound) A.error();
    };
    screenEl.appendChild(upBtn);

    var tc = el('div', 'card');
    tc.innerHTML =
      '<h3 class="card-title" id="trainTitle"></h3>' +
      '<div class="meter">' +
      '  <div class="meter-top"><span id="trainLabel"></span><span class="num" id="trainHaveNeed"></span></div>' +
      '  <div class="meter-bar"><div class="meter-fill" id="trainFill" style="background:linear-gradient(90deg,var(--violet),var(--violet-bright))"></div></div>' +
      '</div>' +
      '<div id="trainHint" class="muted" style="font-size:12px;margin-bottom:var(--s3)"></div>' +
      '<button class="btn btn-violet" id="trainBtn"></button>';
    screenEl.appendChild(tc);
    $('trainBtn').onclick = function () {
      var st = s();
      if (st.training) return;
      if (G.startTraining()) { if (st.sound) A.breakthrough(); refreshAll(); }
      else if (st.sound) A.error();
    };

    var pc = el('div', 'card');
    pc.innerHTML =
      '<h3 class="card-title">' + t('prem_title') + '</h3>' +
      '<div class="row" style="border:none;padding-top:0">' +
      '  <span class="row-ico" id="premIco"></span>' +
      '  <div class="row-main"><div class="row-name" id="premName"></div><div class="row-sub" id="premSub"></div></div>' +
      '</div>' +
      '<div class="meter" style="margin-top:var(--s2)">' +
      '  <div class="meter-top"><span>' + t('meter_safety') + '</span><span class="num" id="premSafetyV"></span></div>' +
      '  <div class="meter-bar"><div class="meter-fill" id="premSafetyBar" style="background:var(--m-safety)"></div></div>' +
      '</div>' +
      '<div class="meter">' +
      '  <div class="meter-top"><span>' + t('meter_legality') + '</span><span class="num" id="premLegalV"></span></div>' +
      '  <div class="meter-bar"><div class="meter-fill" id="premLegalBar" style="background:var(--m-law)"></div></div>' +
      '</div>' +
      '<button class="btn" id="premBtn"></button>';
    screenEl.appendChild(pc);
    $('premBtn').onclick = function () {
      var np = G.nextPremise();
      if (np && G.buyPremise(np.id)) { if (s().sound) A.funding(); refreshAll(); }
      else if (s().sound) A.error();
    };
  }

  function bindOrb(orb) {
    orb.addEventListener('pointerdown', function (e) {
      var st = s();
      if (st.over) return;
      if (!st.boughtLaptop) { if (st.sound) A.error(); return; }
      var v = G.click();
      if (v > 0) {
        if (st.sound) A.tap(0);
        var x = e.clientX, y = e.clientY;
        if (x == null) { var r = orb.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
        FX.ripple(x, y, 160);
        FX.tapBurst(x, y, 0);
        FX.popText(x, y, money(v), 'crit');
      }
    }, { passive: true });
  }

  function syncCompany() {
    var st = s();
    if (!st.boughtLaptop) setText('orbHint', t('tap_hint_buy_laptop'));
    else if (st.training) setText('orbHint', t('train_click_faster'));
    else setText('orbHint', t('tap_hint_click'));

    var upBtn = $('clickUpBtn');
    if (upBtn) {
      var cur = G.tapValue();
      if (G.tapUpgradeCost() === Infinity) {
        upBtn.textContent = t('click_upgrade_max', { v: FMT.fmt(cur) });
        upBtn.disabled = true;
      } else {
        upBtn.textContent = t('click_upgrade', { v: FMT.fmt(cur * C.TAP.upgrade.gain), c: FMT.fmt(G.tapUpgradeCost()) });
        upBtn.disabled = !G.canUpgradeTap();
      }
    }

    var def = G.currentVersionDef();
    var tt = $('trainTitle');
    if (def) {
      tt.textContent = t('model_dev', { label: def.label });
      var have = G.availablePower(), need = G.powerReq();
      setText('trainLabel', t('power_label'));
      setText('trainHaveNeed', FMT.fmt(have) + ' / ' + FMT.fmt(need));
      var fill = $('trainFill'), btn = $('trainBtn');
      if (st.training) {
        btn.textContent = t('train_progress', { label: def.label, pct: Math.round(G.trainingProgress() * 100) });
        btn.disabled = true;
        fill.style.width = (G.trainingProgress() * 100) + '%';
        fill.style.background = 'linear-gradient(90deg,var(--cyan-deep),var(--cyan))';
        setText('trainHint', t('train_time_left', { t: FMT.fmtTime(G.trainingTimeLeft()) }) + ' · ' + t('train_click_faster'));
      } else {
        btn.textContent = t('train_start', { label: def.label });
        btn.disabled = !G.canStartTraining();
        fill.style.width = Math.min(100, need > 0 ? (have / need) * 100 : 0) + '%';
        fill.style.background = 'linear-gradient(90deg,var(--violet),var(--violet-bright))';
        setText('trainHint', G.canStartTraining() ? '' : t('train_need_power', { req: FMT.fmt(need), label: def.label, have: FMT.fmt(have) }));
      }
    } else {
      tt.textContent = t('go_win_title');
      setText('trainHint', t('go_win_flavor'));
      $('trainBtn').disabled = true;
    }

    var prem = C.PREMBYID[st.premise];
    $('premIco').innerHTML = IC.nav_company;
    setText('premName', t('prem_name_' + st.premise));
    setText('premSub', t('prem_capacity', { used: FMT.fmt(G.ownedM2()), cap: FMT.fmt(G.capacityM2()) }) +
      (prem.upkeep > 0 ? ' · ' + t('prem_upkeep', { v: FMT.fmt(prem.upkeep) }) : ''));
    setText('premSafetyV', Math.round(st.safety) + '%');
    setText('premLegalV', Math.round(st.legality) + '%');
    $('premSafetyBar').style.width = st.safety + '%';
    $('premLegalBar').style.width = st.legality + '%';
    var np = G.nextPremise(), pb = $('premBtn');
    if (np) { pb.textContent = t('prem_upgrade', { name: t('prem_name_' + np.id), c: FMT.fmt(np.cost) }); pb.disabled = !G.canBuyPremise(np.id); }
    else { pb.textContent = t('prem_max'); pb.disabled = true; }
  }

  // ---------------------------------------------------------- HARDWARE
  var HW_ICONS = ['gen_laptop', 'gen_gpuRig', 'gen_serverRack', 'gen_gpuCluster', 'gen_dataCenter', 'gen_superComp', 'gen_neuroArray', 'gen_quantumNode', 'gen_orbital'];
  function buildHardware() {
    var cap = el('div', 'card');
    cap.innerHTML = '<h3 class="card-title">' + t('hw_title') + '</h3>' +
      '<div class="muted" style="font-size:11.5px;margin-bottom:var(--s3)">' + t('hw_intro') + '</div>' +
      '<div class="num" id="hwCapLine" style="font-size:12px;color:var(--cyan)"></div>';
    screenEl.appendChild(cap);

    var list = el('div', 'card');
    screenEl.appendChild(list);
    C.HARDWARE.forEach(function (h, i) {
      var row = el('div', 'row');
      row.id = 'hwrow-' + h.id;
      row.innerHTML =
        '<span class="row-ico">' + (IC[HW_ICONS[i]] || IC.gen_serverRack) + '</span>' +
        '<div class="row-main">' +
        '  <div class="row-name">' + t('hw_name_' + h.id) + '</div>' +
        '  <div class="row-sub" id="hwsub-' + h.id + '"></div>' +
        '  <div class="row-sub num" id="hwown-' + h.id + '" style="color:var(--text-faint)"></div>' +
        '</div>' +
        '<button class="btn btn-primary row-buy num" id="hwbuy-' + h.id + '"></button>';
      list.appendChild(row);
      $('hwbuy-' + h.id).onclick = (function (id) {
        return function (e) {
          if (G.buyHw(id)) { if (s().sound) A.buy(); FX.buyBurst(e.clientX || window.innerWidth / 2, e.clientY || 300); refreshAll(); }
          else if (s().sound) A.error();
        };
      })(h.id);
    });
  }
  function syncHardware() {
    var st = s();
    setText('hwCapLine', t('prem_capacity', { used: FMT.fmt(G.ownedM2()), cap: FMT.fmt(G.capacityM2()) }));
    C.HARDWARE.forEach(function (h) {
      var idle = st.hw[h.id], comm = st.committed[h.id];
      setText('hwsub-' + h.id, t('hw_power') + ' +' + FMT.fmt(h.power) +
        ' · ' + (h.rent > 0 ? t('hw_rent') + ' $' + FMT.fmt(h.rent) + '/' + (I.getLang() === 'ru' ? 'с' : 's') : t('common_free')) +
        ' · ⚡' + FMT.fmt(h.kw) + t('hw_kw') + ' · ' + FMT.fmt(h.m2) + t('hw_m2'));
      var own = [];
      if (idle > 0) own.push(t('hw_owned', { n: idle }));
      if (comm > 0) own.push(t('hw_committed', { n: comm }));
      setText('hwown-' + h.id, own.join(' · '));
      var buy = $('hwbuy-' + h.id);
      var afford = st.cash >= h.cost, space = G.freeM2() >= h.m2;
      buy.textContent = !space ? t('hw_no_space') : (t('hw_buy') + ' $' + FMT.fmt(h.cost));
      buy.disabled = !G.canBuyHw(h.id);
      var row = $('hwrow-' + h.id);
      if (row) row.style.opacity = (afford && space) ? '1' : (idle + comm > 0 ? '0.85' : '0.5');
    });
  }

  // ---------------------------------------------------------- MODEL (hero)
  function buildModel() {
    var st = s();
    if (st.version < 1) {
      var def = G.currentVersionDef();
      var pre = el('div', 'card');
      pre.innerHTML =
        '<h3 class="card-title">' + t('model_title') + '</h3>' +
        '<div class="pricebox" style="padding:var(--s5) 0">' +
        '  <div class="price-val" style="font-size:18px;color:var(--text-dim)">' + t('no_model') + '</div>' +
        '  <p class="muted" style="font-size:12.5px;margin-top:var(--s4)">' + t('price_intro') + '</p>' +
        '  <p class="muted num" style="font-size:12px;margin-top:var(--s3)">' + t('train_need_power', { req: FMT.fmt(G.powerReq()), label: def ? def.label : 'v1', have: FMT.fmt(G.availablePower()) }) + '</p>' +
        '</div>';
      screenEl.appendChild(pre);
      var go = el('button', 'btn btn-violet', t('train_start', { label: def ? def.label : 'v1' }));
      go.onclick = function () { switchTab('company'); };
      pre.appendChild(go);
      return;
    }

    var pb = el('div', 'card pricebox');
    pb.innerHTML =
      '<h3 class="card-title">' + t('price_title') + '</h3>' +
      '<div class="price-val num" id="priceVal"></div>' +
      '<input class="slider" id="priceSlider" type="range" min="' + C.ECON.priceMin + '" max="' + C.ECON.priceMax + '" step="0.25" />' +
      '<div class="preview">' +
      '  <div class="pv"><div class="pv-k">' + t('share_label') + '</div><div class="pv-v num" id="pv-share"></div></div>' +
      '  <div class="pv"><div class="pv-k">' + t('users_label') + '</div><div class="pv-v num" id="pv-users"></div></div>' +
      '  <div class="pv"><div class="pv-k">' + (I.getLang() === 'ru' ? 'Прибыль/с' : 'Profit/s') + '</div><div class="pv-v num" id="pv-profit"></div></div>' +
      '  <div class="pv"><div class="pv-k">' + t('meter_approval') + '</div><div class="pv-v num" id="pv-appr"></div></div>' +
      '</div>' +
      '<div class="muted num" id="sweetLine" style="font-size:12px;margin-top:var(--s3)"></div>' +
      '<button class="btn" id="sweetBtn" style="margin-top:var(--s2)"></button>';
    screenEl.appendChild(pb);

    var slider = $('priceSlider');
    slider.value = st.price;
    slider.addEventListener('input', function () { previewPrice = parseFloat(slider.value); syncPricePreview(); });
    slider.addEventListener('change', function () { G.setPrice(parseFloat(slider.value)); previewPrice = null; if (s().sound) A.buy(); syncPricePreview(); });
    $('sweetBtn').onclick = function () { var sw = G.sweetSpotPrice(); G.setPrice(sw); slider.value = sw; previewPrice = null; if (s().sound) A.buy(); syncPricePreview(); };

    var sc = el('div', 'card');
    sc.innerHTML =
      '<h3 class="card-title">' + t('model_title') + '</h3>' +
      '<div class="row" style="border:none;padding-top:0"><span class="row-ico">' + IC.ic_brain + '</span>' +
      '<div class="row-main"><div class="row-name" id="modelVer"></div><div class="row-sub num" id="modelStats"></div></div></div>';
    screenEl.appendChild(sc);
  }

  function syncPricePreview() {
    var st = s();
    if (st.version < 1 || !$('priceSlider')) return;
    var p = (previewPrice != null) ? previewPrice : st.price;
    setText('priceVal', '$' + p.toFixed(2));
    var net = G.revenuePreview(p) - G.costPerSec();
    setText('pv-share', pct(G.share(p)) + '%');
    setText('pv-users', FMT.fmt(G.usersTarget(p)));
    var pf = $('pv-profit');
    pf.textContent = (net >= 0 ? '+' : '−') + '$' + FMT.fmt(Math.abs(net));
    pf.style.color = net >= 0 ? 'var(--green)' : 'var(--rose)';
    var sweet = G.sweetSpotPrice();
    var ratio = sweet > 0 ? p / sweet : 1;
    var arrow, col;
    if (ratio > C.RISK.gougeStartRatio) { arrow = t('approval_down'); col = 'var(--rose)'; }
    else if (ratio < 0.9) { arrow = t('approval_up'); col = 'var(--green)'; }
    else { arrow = t('approval_flat'); col = 'var(--cyan)'; }
    var pa = $('pv-appr'); pa.textContent = arrow; pa.style.color = col;
    setText('sweetLine', t('price_sweet', { v: sweet.toFixed(2) }));
    setText('sweetBtn', t('price_set_default'));
  }

  function syncModel() {
    var st = s();
    if (st.version < 1 || !$('priceSlider')) return;
    var sl = $('priceSlider');
    if (previewPrice == null && document.activeElement !== sl) sl.value = st.price;
    syncPricePreview();
    var def = C.VERSIONS[st.version - 1];
    setText('modelVer', t('model_live', { label: def ? def.label : ('v' + st.version) }));
    setText('modelStats', t('power_label') + ' ' + FMT.fmt(G.power()) +
      ' · ' + t('users_label') + ' ' + FMT.fmt(st.users) +
      ' · ' + t('share_label') + ' ' + pct(G.playerShare()) + '%');
  }

  // ---------------------------------------------------------- WORLD
  function buildWorld() {
    var rc = el('div', 'card');
    rc.innerHTML = '<h3 class="card-title">' + t('standings_title') + '</h3><div id="standRows"></div>';
    screenEl.appendChild(rc);

    var raceCard = el('div', 'card');
    raceCard.innerHTML = '<h3 class="card-title">' + t('race_title') + '</h3><div id="raceStatus" style="font-size:13px"></div>';
    screenEl.appendChild(raceCard);

    var mc = el('div', 'card');
    mc.innerHTML = '<h3 class="card-title">' + t('meters_title') + '</h3>' +
      meterHtml('safety', t('meter_safety'), 'var(--m-safety)', '◆') +
      meterHtml('approval', t('meter_approval'), 'var(--m-approval)', '●') +
      meterHtml('legality', t('meter_legality'), 'var(--m-law)', '▲');
    screenEl.appendChild(mc);

    // TEAM: staff nudge the meters / taxes (game API exists; surfaced here next to the meters)
    var tc = el('div', 'card');
    var rowsHtml = C.STAFF.map(function (st2) {
      return '<div class="row">' +
        '<span class="row-ico">' + IC.ic_manager + '</span>' +
        '<div class="row-main"><div class="row-name">' + t('staff_name_' + st2.id) + '</div>' +
        '<div class="row-sub" id="staffdesc-' + st2.id + '"></div></div>' +
        '<button class="btn row-buy num" id="staffhire-' + st2.id + '"></button></div>';
    }).join('');
    tc.innerHTML = '<h3 class="card-title">' + t('staff_title') + '</h3>' +
      '<div class="muted" style="font-size:11.5px;margin-bottom:var(--s2)">' + t('staff_intro') + '</div>' + rowsHtml;
    screenEl.appendChild(tc);
    C.STAFF.forEach(function (st2) {
      $('staffhire-' + st2.id).onclick = (function (id) {
        return function () { if (G.hire(id)) { if (s().sound) A.hireDone(); refreshAll(); } else if (s().sound) A.error(); };
      })(st2.id);
    });
  }
  function meterHtml(id, label, color, glyph) {
    return '<div class="meter">' +
      '<div class="meter-top"><span>' + glyph + ' ' + label + '</span><span class="num" id="m-' + id + 'V"></span></div>' +
      '<div class="meter-bar"><div class="meter-fill" id="m-' + id + 'Bar" style="background:' + color + '"></div></div></div>';
  }
  function syncWorld() {
    var st = s();
    var rows = G.standings();
    var top = Math.max(1e-9, rows[0].power);
    var html = '';
    rows.forEach(function (r, i) {
      var name = r.isPlayer ? t('standings_you') : t('rival_name_' + r.id);
      var w = Math.max(2, Math.min(100, (r.power / top) * 100));
      var col = r.isPlayer ? 'var(--gold)' : 'var(--cyan-deep)';
      html += '<div class="row" style="' + (i === 0 ? 'border:none;padding-top:0' : '') + '">' +
        '<span class="row-ico" style="font-family:Orbitron;font-size:13px;color:' + (r.isPlayer ? 'var(--gold)' : 'var(--text-dim)') + '">' + (i + 1) + '</span>' +
        '<div class="row-main"><div class="row-name" style="' + (r.isPlayer ? 'color:var(--gold)' : '') + '">' + name + '</div>' +
        '<div class="meter-bar" style="margin-top:5px"><div class="meter-fill" style="width:' + w + '%;background:' + col + '"></div></div></div>' +
        '<span class="row-sub num" style="flex:none">' + FMT.fmt(r.power) + '</span></div>';
    });
    $('standRows').innerHTML = html;

    var youRank = 0;
    for (var i = 0; i < rows.length; i++) if (rows[i].isPlayer) { youRank = i; break; }
    var leaderDays = G.agiLeaderDays();
    var msg, rcol;
    if (youRank === 0) { msg = t('race_ahead'); rcol = 'var(--green)'; }
    else if (youRank === rows.length - 1) { msg = t('race_behind'); rcol = 'var(--rose)'; }
    else { msg = t('race_close'); rcol = 'var(--amber)'; }
    $('raceStatus').innerHTML = '<span style="color:' + rcol + '">' + msg + '</span>' +
      (isFinite(leaderDays) ? '<div class="muted num" style="font-size:11.5px;margin-top:4px">AGI ≈ ' + FMT.fmtTime(leaderDays * C.DAY_SEC) + '</div>' : '');

    [['safety', st.safety], ['approval', st.approval], ['legality', st.legality]].forEach(function (m) {
      setText('m-' + m[0] + 'V', Math.round(m[1]) + '%');
      var bar = $('m-' + m[0] + 'Bar'); if (bar) bar.style.width = m[1] + '%';
    });

    C.STAFF.forEach(function (st2) {
      var d = $('staffdesc-' + st2.id); if (!d) return;
      d.textContent = t('staff_desc_' + st2.id) + ' · ' + t('staff_count', { n: st.staff[st2.id] });
      var b = $('staffhire-' + st2.id);
      b.textContent = t('staff_hire', { c: FMT.fmt(G.staffHireCost(st2.id)) });
      b.disabled = !G.canHire(st2.id);
      b.classList.toggle('btn-violet', G.canHire(st2.id));
    });
  }

  // ---------------------------------------------------------- SETTINGS
  function buildSettings() {
    var c = el('div', 'card');
    c.innerHTML =
      '<h3 class="card-title">' + t('settings_title') + '</h3>' +
      segRow('lang', t('lang_label'), [['ru', 'RU'], ['en', 'EN']]) +
      segRow('sound', t('sound_label'), [['on', t('on')], ['off', t('off')]]) +
      segRow('music', t('music_label'), [['on', t('on')], ['off', t('off')]]);
    screenEl.appendChild(c);

    var c2 = el('div', 'card');
    c2.innerHTML = '<h3 class="card-title">' + t('reset_label') + '</h3>';
    var rb = el('button', 'btn', t('reset_label'));
    rb.style.cssText = 'border-color:var(--rose);color:var(--rose)';
    rb.onclick = function () {
      showModal({ title: t('reset_label'), body: t('reset_confirm'), ok: t('go_new_game'), onOk: function () { G.reset(); switchTab('company'); }, cancel: t('ftue_got_it') });
    };
    c2.appendChild(rb);
    screenEl.appendChild(c2);

    var cr = el('div', 'card');
    cr.innerHTML = '<p class="faint" style="font-size:11.5px;margin:0">' + t('credits') + '</p>';
    screenEl.appendChild(cr);
    wireSettings();
  }
  function segRow(group, label, opts) {
    var btns = opts.map(function (o) {
      return '<button class="btn" data-' + group + '="' + o[0] + '" style="width:auto;flex:1;min-height:44px">' + o[1] + '</button>';
    }).join('');
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--s3);margin-bottom:var(--s3)">' +
      '<span style="font-size:13px">' + label + '</span>' +
      '<div style="display:flex;gap:var(--s2);flex:1;max-width:170px">' + btns + '</div></div>';
  }
  function wireSettings() {
    var st = s();
    function paint(group, val) {
      screenEl.querySelectorAll('[data-' + group + ']').forEach(function (n) {
        var on = n.getAttribute('data-' + group) === val;
        n.classList.toggle('btn-violet', on);
        n.style.opacity = on ? '1' : '0.55';
      });
    }
    paint('lang', I.getLang());
    paint('sound', st.sound ? 'on' : 'off');
    paint('music', st.music ? 'on' : 'off');
    screenEl.querySelectorAll('[data-lang]').forEach(function (n) {
      n.onclick = function () { I.setLang(n.getAttribute('data-lang')); s().lang = I.getLang(); document.documentElement.lang = I.getLang(); G.save(); rebuildAll(); };
    });
    screenEl.querySelectorAll('[data-sound]').forEach(function (n) {
      n.onclick = function () { s().sound = n.getAttribute('data-sound') === 'on'; A.setEnabled(s().sound); if (s().sound) A.buy(); paint('sound', s().sound ? 'on' : 'off'); G.save(); };
    });
    screenEl.querySelectorAll('[data-music]').forEach(function (n) {
      n.onclick = function () { s().music = n.getAttribute('data-music') === 'on'; if (M) { M.setEnabled(s().music); if (s().music) M.start(); else M.stop(); } paint('music', s().music ? 'on' : 'off'); G.save(); };
    });
  }

  // ============================================================ MODALS
  function showModal(opts) {
    modalOpen = true;
    var root = $('modalRoot');
    var scrim = el('div', 'scrim');
    var m = el('div', 'modal');
    m.innerHTML = '<h3 class="display">' + (opts.title || '') + '</h3><p>' + (opts.body || '') + '</p>';
    var actions = el('div');
    actions.style.cssText = 'display:flex;flex-direction:column;gap:var(--s2)';
    var okBtn = el('button', 'btn btn-violet', opts.ok || t('ftue_got_it'));
    okBtn.onclick = function () { close(); if (opts.onOk) opts.onOk(); };
    actions.appendChild(okBtn);
    if (opts.cancel) {
      var cBtn = el('button', 'btn', opts.cancel);
      cBtn.onclick = function () { close(); if (opts.onCancel) opts.onCancel(); };
      actions.appendChild(cBtn);
    }
    m.appendChild(actions);
    scrim.appendChild(m);
    root.appendChild(scrim);
    function close() { if (scrim.parentNode) scrim.parentNode.removeChild(scrim); modalOpen = root.children.length > 0; drainQueue(); }
    return scrim;
  }
  function queueModal(opts) { modalQueue.push(opts); drainQueue(); }
  function drainQueue() { if (modalOpen || !modalQueue.length) return; showModal(modalQueue.shift()); }

  var FTUE = {
    rent: { title: 'ftue_rent_title', body: 'ftue_rent_body' },
    'meter:safety': { title: 'ftue_meter_title', body: 'ftue_meter_safety_body' },
    'meter:approval': { title: 'ftue_meter_title', body: 'ftue_meter_approval_body' },
    'meter:legality': { title: 'ftue_meter_title', body: 'ftue_meter_legality_body' }
  };
  function ftueKey(tag) { return tag.indexOf('meter:') === 0 ? 'meter' : tag; }

  function telegraph(text) {
    var root = $('telegraphRoot');
    var card = el('div', 'telegraph', text);
    root.appendChild(card);
    card.onclick = function () { if (card.parentNode) card.parentNode.removeChild(card); };
    setTimeout(function () { if (card.parentNode) card.parentNode.removeChild(card); }, 9000);
  }

  function pvTile(k, v) { return '<div class="pv"><div class="pv-k">' + k + '</div><div class="pv-v num">' + v + '</div></div>'; }
  function showEnding(outcome) {
    var st = s();
    var win = outcome === 'agi';
    var title = t('go_' + (win ? 'win' : outcome) + '_title');
    var flavor = t('go_' + (win ? 'win' : outcome) + '_flavor');
    var ver = win ? 'AGI' : ('v' + st.version);
    var punch = win
      ? t('go_punch_win', { day: G.dayNumber(), users: FMT.fmt(st.users), share: pct(G.playerShare()) })
      : t('go_punch_lose', { day: G.dayNumber(), ver: ver, users: FMT.fmt(st.users), share: pct(G.playerShare()) });
    var scrim = el('div', 'scrim');
    var m = el('div', 'modal');
    m.style.borderColor = win ? 'var(--gold)' : 'var(--rose)';
    m.innerHTML =
      '<h3 class="display" style="color:' + (win ? 'var(--gold)' : 'var(--rose)') + '">' + title + '</h3>' +
      '<p>' + flavor + '</p>' +
      '<div class="preview" style="margin-bottom:var(--s4)">' +
      pvTile(t('go_stat_version'), ver) + pvTile(t('go_stat_day'), String(G.dayNumber())) +
      pvTile(t('go_stat_users'), FMT.fmt(st.users)) + pvTile(t('go_stat_share'), pct(G.playerShare()) + '%') +
      '</div>' +
      '<p style="color:var(--text);font-size:13px">' + punch + '</p>' +
      '<p class="faint" style="font-size:11px">' + t('go_brag') + '</p>';
    var btn = el('button', 'btn btn-violet', t('go_new_game'));
    btn.onclick = function () { if (scrim.parentNode) scrim.parentNode.removeChild(scrim); modalOpen = $('modalRoot').children.length > 0; G.reset(); switchTab('company'); };
    m.appendChild(btn);
    scrim.appendChild(m);
    $('modalRoot').appendChild(scrim);
    modalOpen = true;
    if (win) { FX.ritual({ title: title, subtitle: flavor, kind: 'singularity' }); if (st.sound) A.singularity(); }
    else { FX.incident(); if (st.sound) A.incident(); }
  }

  // ============================================================ EVENT WIRING
  function wireGameEvents() {
    G.on('ftue', function (tag) {
      var f = FTUE[tag]; if (!f) return;
      var st = s(); var k = ftueKey(tag);
      if (st.ftue[k]) return; st.ftue[k] = 1;
      queueModal({ title: t(f.title), body: t(f.body), ok: t('ftue_got_it') });
    });
    G.on('release', function (v) {
      if (s().sound) A.release();
      var def = C.VERSIONS[v - 1];
      FX.celebrate(window.innerWidth / 2, window.innerHeight / 2, def ? def.label : ('v' + v), v >= 3);
      if (!s().ftue.release) { s().ftue.release = 1; queueModal({ title: t('ftue_release_title'), body: t('ftue_release_body'), ok: t('ftue_got_it'), onOk: function () { switchTab('model'); } }); }
      rebuildAll();
    });
    G.on('bill', function (amount) {
      if (amount > 0 && !s().ftue.bill) { s().ftue.bill = 1; queueModal({ title: t('ftue_bill_title'), body: t('ftue_bill_body'), ok: t('ftue_got_it') }); }
    });
    G.on('event', function (e) {
      if (!e) return;
      if (e.type === 'fireWarn') telegraph(t('ev_fire_warn', { v: Math.round(e.safety) }));
      else if (e.type === 'lawWarn') telegraph(t('ev_law_warn', { v: Math.round(e.legality) }));
      else if (e.type === 'boardWarn') telegraph(t('ev_board_warn'));
      else if (e.type === 'fire') queueModal({ title: t('ev_fire_title'), body: t('ev_fire_body', { n: e.lostUnits }), ok: t('ftue_got_it') });
      else if (e.type === 'lawsuit') queueModal({ title: t('ev_lawsuit_title'), body: t('ev_lawsuit_body', { v: FMT.fmt(e.fine) }), ok: t('ftue_got_it') });
      else if (e.type === 'boardConvene') queueModal({ title: t('ev_board_convene_title'), body: t('ev_board_convene_body'), ok: t('ftue_got_it') });
      if (e.type === 'fire' || e.type === 'lawsuit') { FX.incident(); if (s().sound) A.incident(); }
    });
    G.on('gameover', function (outcome) { showEnding(outcome); });
  }

  // ============================================================ REFRESH
  function refreshAll() { syncHud(); syncScreen(); }
  function rebuildAll() { buildNav(); buildScreen(activeTab); syncHud(); }

  // ============================================================ PUBLIC API
  function init(offline) {
    screenEl = $('screen');
    document.documentElement.lang = I.getLang();
    buildNav();
    wireGameEvents();
    var h = (location.hash || '').replace('#', '');
    if (TABS.indexOf(h) >= 0) activeTab = h;
    switchTab(activeTab);
    syncHud();
    syncTicker(99);
    if (offline && offline.earned > 0) {
      G.applyOffline(offline.earned, offline);
      queueModal({ title: t('game_title'), body: '+' + money(offline.earned) + ' · ' + FMT.fmtTime(offline.t), ok: t('ftue_got_it') });
    }
    try { if (M && s().music) M.start(); } catch (e) {}
  }

  var lastFrame = 0;
  function update() {
    var now = performance.now();
    var dt = lastFrame ? (now - lastFrame) / 1000 : 0; lastFrame = now;
    syncHud();
    syncScreen();
    syncTicker(dt);
  }

  window.GAME_UI = {
    init: init,
    update: update,
    back: function () { if (modalOpen) return false; if (activeTab !== 'company') { switchTab('company'); return true; } return false; },
    isPaused: function () { return modalOpen; }
  };
})();
