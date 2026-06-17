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
    if (Math.abs(target - d) < target * 0.0015 + 0.5) d = target;
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
    $('brandName').textContent = t('game_title');
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
    // upgrades + autopilot
    $('upgradesTitle').textContent = t('upgrades_title');
    $('managersTitle').textContent = t('managers_title');
    $('autopilotHdr').innerHTML = t('autopilot_title') + infoBtn('tip_autopilot');
    $('apReserveLabel').innerHTML = t('ap_reserve') + infoBtn('tip_reserve');
    $('apModeLabel').textContent = t('ap_mode');
    $('apGensLabel').textContent = t('ap_gens');
    var apo = $('apOnSeg').children; apo[0].textContent = t('on'); apo[1].textContent = t('off');
    var apm = $('apModeSeg').children; apm[0].textContent = t('ap_mode_roi'); apm[1].textContent = t('ap_mode_milestone');
    buildAutopilot();
    // GDD v3: Team (hiring) view — repurposed from the old Research tab
    if ($('teamTitle')) {
      $('teamTitle').innerHTML = t('team_title') + infoBtn('tip_team');
      $('teamDesc').textContent = t('team_desc');
      if ($('rndTitle')) $('rndTitle').innerHTML = t('rnd_title') + infoBtn('tip_research2');
    }
    // alignment
    $('alignTitle').innerHTML = t('alignment_title') + infoBtn('tip_align'); $('trustHud').setAttribute('data-tip','tip_trust');
    $('alignIntro').textContent = t('alignment_intro');
    $('alignLabel').textContent = t('alignment_label');
    if ($('alignTip')) $('alignTip').innerHTML = '<span class="ticon">' + ic('ic_insight') + '</span><span>' + t('tip_insight') + '</span>';
    if ($('researchTip')) $('researchTip').innerHTML = '<span class="ticon">' + ic('ic_bolt') + '</span><span>' + t('tip_overclock') + '</span>';
    // stats
    $('statsTitle').textContent = t('stats_title');
    $('achTitle').textContent = t('achievements_title');
    // settings
    $('settingsTitle').textContent = t('settings_title');
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
        if (G.buyGen(g.id)) {
          window.GAME_AUDIO.buy(); buzz(12);
          window.GAME_FX.cardFlash(card);
          var r = card.getBoundingClientRect();
          window.GAME_FX.buyBurst(e.clientX || (r.left + r.width / 2), e.clientY || (r.top + r.height / 2));
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
  function updateModelPanel() {
    var s = G.state;
    setText($('computeVal'), fmt(s.compute));
    setText($('computeRate'), '+' + fmt(frameCompute) + '/s');
    setText($('shareVal'), (Math.round(s.marketShare * 10) / 10) + '%');
    setText($('valVal'), '$' + fmt(G.valuation()));
    // Stage-1 garage cleanliness: market-share, valuation and datacenter builds only
    // appear once you've shipped your first product (modelGen ≥ 1).
    var preProduct = s.modelGen < 1, rc = $('resRow').children;
    setClass(rc[1], 'hidden', preProduct); setClass(rc[2], 'hidden', preProduct);
    setClass($('buildBox'), 'hidden', preProduct);
    setText($('modelProg'), t('model_progress', { n: s.modelGen, total: C.MODELGEN.length }));
    // funding round (P5): appears when valuation clears the next round's milestone
    var fb = $('fundingBtn'), round = G.nextFundingRound();
    if (round && G.canTakeFunding()) {
      setClass(fb, 'hidden', false); fb.disabled = false;
      setText(fb, t('fund_btn', { name: t('fund_' + round.id), v: '$' + fmt(G.valuation() * round.cashFrac) }));
    } else { setClass(fb, 'hidden', true); }
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
      setText($('buildTimer'), t('build_active', { t: FMT.fmtTime(G.buildTimeLeft()) }));
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
      setText($('trainTimer'), t('train_active', { name: t(C.MODELGEN[s.training.gen].id) }) + ' · ' + t('train_left', { t: FMT.fmtTime(G.trainingTimeLeft()) }));
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
    setText($('hireHint'), t('team_hint'));
    // research project (parallel timer): money + time -> permanent efficiency
    setHTML($('researchStats'),
      '<div class="tstat"><span class="tk">' + t('research_done') + '</span><span class="tv">' + s.researchLevel + '</span></div>' +
      '<div class="tstat"><span class="tk">' + t('research_eff') + '</span><span class="tv">+' + Math.round((G.researchEfficiencyMult() - 1) * 100) + '%</span></div>');
    var rb = $('researchBtn'), rp = $('researchProg2');
    if (G.researchActive()) {
      setClass(rb, 'hidden', true); setClass(rp, 'hidden', false);
      setStyleP($('researchFill'), 'width', (G.researchProgress() * 100).toFixed(1) + '%');
      setText($('researchTimer'), t('research_active', { t: FMT.fmtTime(G.researchTimeLeft()) }));
    } else {
      setClass(rp, 'hidden', true); setClass(rb, 'hidden', false);
      setText(rb, t('research_btn', { v: '$' + fmt(G.researchProjCost()) }));
      rb.disabled = !G.canStartResearch();
    }
  }

  // ---------- GDD v3: rival market-share standings ----------
  var standRefs = null;
  function entityName(id) { return id === 'you' ? t('you_label') : t('rival_' + id); }
  function buildStandings() {
    var box = $('standingsRows'); if (!box) return;
    box.innerHTML = ''; standRefs = {};
    var ids = ['you']; C.RIVALS.forEach(function (r) { ids.push(r.id); });
    ids.forEach(function (id) {
      var row = el('div', 'standrow' + (id === 'you' ? ' you' : ''));
      row.innerHTML = '<span class="srank"></span><span class="sname">' + entityName(id) + '</span>' +
        '<span class="sbarwrap"><span class="sbar"></span></span><span class="sshare"></span>';
      box.appendChild(row);
      standRefs[id] = { row: row, rank: row.querySelector('.srank'), bar: row.querySelector('.sbar'), share: row.querySelector('.sshare') };
    });
  }
  function updateStandings() {
    if (!standRefs) buildStandings();
    var rows = G.standings(), maxShare = 0;
    rows.forEach(function (r) { if (r.share > maxShare) maxShare = r.share; });
    maxShare = Math.max(maxShare, 1);
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], ref = standRefs[r.id]; if (!ref) continue;
      setStyleP(ref.row, 'order', String(i));            // flex-order sort — no DOM reshuffle
      setText(ref.rank, '#' + (i + 1));
      setText(ref.share, (Math.round(r.share * 10) / 10) + '%');
      setStyleP(ref.bar, 'width', (r.share / maxShare * 100).toFixed(1) + '%');
      setClass(ref.row, 'lead', i === 0);
    }
    var rank = G.playerRank(), total = rows.length;
    setText($('standingsStatus'), rank === 1 ? t('standings_leader') : t('standings_behind', { n: rank, total: total }));
    // §5 acquisition: buy out the strongest rival (post mid-game)
    var ab = $('acquireBtn'), tgt = G.acquireTarget();
    if (tgt && G.acquireUnlocked() && G.canAcquire()) {
      setClass(ab, 'hidden', false);
      setText(ab, t('acquire_btn', { name: t('rival_' + tgt.id), v: '$' + fmt(G.acquireCost(tgt.id)) }));
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
    setText($('agiRace'), t('agi_rank', { n: G.agiRank(), total: G.agiFieldSize() }) + ' · ' + t('agi_race_you', { p: Math.round(G.agiProgress()) }) + ' · ' + t('agi_race_lead', { p: Math.round(G.leadingRivalAgi()) }));
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

  // ---------- autopilot ----------
  function buildAutopilot() {
    var list = $('apGenToggles'); if (!list) return; list.innerHTML = '';
    C.GENERATORS.forEach(function (g) {
      var chip = el('button', 'ap-chip'); chip.dataset.gid = g.id;
      chip.innerHTML = '<span class="api">' + ic('gen_' + g.id) + '</span><span class="apn">' + t('g_' + g.id) + '</span><span class="apdot"></span>';
      chip.addEventListener('click', function () {
        var on = !G.state.autopilot.gens[g.id];
        G.toggleAutopilotGen(g.id, on); window.GAME_AUDIO.buy(); updateAutopilot();
      });
      list.appendChild(chip);
    });
  }
  function apStatusText() {
    var s = G.state, st = G.apStatus();
    if (!s.autopilot.on) return t('ap_status_off');
    var anyGen = false; for (var k in s.autopilot.gens) if (s.autopilot.gens[k]) anyGen = true;
    if (!anyGen) return t('ap_status_nogens');
    if (st.kind === 'buy') return t('ap_status_buy', { name: t('g_' + st.id), mode: t(st.mode === 'milestone' ? 'ap_mode_milestone_short' : 'ap_mode_roi_short') });
    if (st.kind === 'reserve') return t('ap_status_reserve');
    return t('ap_status_idle');
  }
  function updateAutopilot() {
    var s = G.state, unlocked = G.autopilotUnlocked();
    $('autopilotLocked').classList.toggle('hidden', unlocked);
    $('autopilotPanel').classList.toggle('hidden', !unlocked);
    if (!unlocked) { $('autopilotLocked').innerHTML = '<div class="es-icon">' + ic('ic_bolt') + '</div>' + t('autopilot_locked'); return; }
    // on/off seg
    var onb = $('apOnSeg').children; onb[0].classList.toggle('on', s.autopilot.on); onb[1].classList.toggle('on', !s.autopilot.on);
    // status
    var stEl = $('apStatus'); stEl.textContent = apStatusText();
    stEl.classList.toggle('live', s.autopilot.on && G.apStatus().kind === 'buy');
    // reserve
    var pct = Math.round(s.autopilot.reserve * 100);
    if (document.activeElement !== $('apReserve')) $('apReserve').value = pct;
    $('apReserveKeeps').textContent = t('ap_reserve_keeps', { p: pct, v: fmt(s.cash * s.autopilot.reserve) });
    // mode seg
    var mb = $('apModeSeg').children; mb[0].classList.toggle('on', s.autopilot.mode === 'roi'); mb[1].classList.toggle('on', s.autopilot.mode === 'milestone');
    // gen toggles
    var chips = $('apGenToggles').children;
    for (var i = 0; i < chips.length; i++) {
      var gid = chips[i].dataset.gid;
      chips[i].classList.toggle('hidden', s.gens[gid] === 0);
      chips[i].classList.toggle('on', !!s.autopilot.gens[gid]);
    }
  }


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
    [['cosOrbList', C.COSMETICS.orbs, ORB_PREVIEW, 'orb'], ['cosThemeList', C.COSMETICS.themes, THEME_PREVIEW, 'theme']].forEach(function (row) {
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
  function updateCosmetics() {
    var s = G.state;
    [['cosOrbList', C.COSMETICS.orbs, s.orb], ['cosThemeList', C.COSMETICS.themes, s.theme]].forEach(function (row) {
      var list = $(row[0]); if (!list) return;
      for (var i = 0; i < list.children.length; i++) {
        var sw = list.children[i], it = row[1][i];
        var unlocked = G.cosmeticUnlocked(it);
        sw.classList.toggle('locked', !unlocked);
        sw.classList.toggle('sel', row[2] === it.id);
        var li = sw.querySelector('.lockicon');
        if (li) { li.classList.toggle('hidden', unlocked); if (!unlocked) li.innerHTML = ic('ic_lock'); }
        sw.title = unlocked ? t(it.id) : (t(it.id) + ' — ' + lockReq(it.unlock || {}));
      }
    });
  }
  function applyCosmetics() {
    var s = G.state, de = document.documentElement;
    if (de.getAttribute('data-orb') !== s.orb) de.setAttribute('data-orb', s.orb);
    if (de.getAttribute('data-theme') !== s.theme) de.setAttribute('data-theme', s.theme);
  }

  // ---------- news ticker ----------
  var tickerIdx = -1, tickerTimer = null;
  function currentNews() {
    var lang = window.GAME_I18N.getLang();
    var arr = (window.GAME_I18N.DICTS[lang] && window.GAME_I18N.DICTS[lang].news) || window.GAME_I18N.DICTS.en.news || [];
    var stage = parseInt(document.documentElement.getAttribute('data-stage') || '0', 10) || 0;
    return arr[Math.min(stage, arr.length - 1)] || arr[0] || [''];
  }
  function rotateTicker() {
    var pool = currentNews(); if (!pool.length) return;
    tickerIdx = (tickerIdx + 1) % pool.length;
    var el2 = $('tickerText');
    if (el2) { el2.textContent = pool[tickerIdx]; el2.style.animation = 'none'; void el2.offsetWidth; el2.style.animation = ''; }
  }
  function startTicker() { rotateTicker(); if (tickerTimer) clearInterval(tickerTimer); tickerTimer = setInterval(rotateTicker, 9000); }

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
    var rows = [
      [t('stat_modelgen'), genLabel],
      [t('stat_compute'), fmt(s.compute)],
      [t('stat_compute_rate'), fmt(G.cps()) + '/s'],
      [t('stat_money_sec'), fmt(G.moneyRate()) + '/s'],
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
      var arrow = net > 0.001 ? '▲' : (net < -0.001 ? '▼' : '–');
      html += '<div class="vrow">' +
        '<div class="vhead"><span class="vname">' + t('vec_' + vid) + '</span><span class="vpct">' + Math.floor(val) + '%</span></div>' +
        '<div class="bar"><div class="vfill" style="width:' + val + '%;background:' + vecColor(val) + '"></div></div>' +
        '<div class="vmeta muted small">' + t('vec_' + vid + '_d') + ' · <span class="' + (net > 0 ? 'vup' : 'vdn') + '">' + arrow + ' ' + Math.abs(net).toFixed(2) + '/s</span></div>' +
        '</div>';
    });
    $('vectorBars').innerHTML = html;
    $('alignOwned').textContent = s.align;
    $('alignSuppressTxt').textContent = t('align_suppress', { v: G.alignSuppress().toFixed(2) });
    var ac = G.alignCost();
    var btn = $('buyAlignBtn');
    btn.textContent = t('buy_alignment') + ' (' + fmt(ac) + ')';
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
        '<div class="idesc">' + t('crisis_penalty_desc', { t: FMT.fmtTime(remain) }) + '</div>';
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
    setText($('cpsVal'), t('per_sec', { v: fmt(frameMoney) }));   // product revenue/sec
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
    ['standingsPanel', 'worldNewsTitle', 'cardList', 'newsFlavorTitle', 'newsFlavor'].forEach(function (id) { var e = $(id); if (e) e.classList.toggle('hidden', !unlocked); });
    if (!unlocked) { $('worldLocked').innerHTML = '<div class="es-icon">' + ic('ic_world') + '</div>' + t('world_locked'); return; }
    // AGI finale banner (win / beaten) + optional Founder's Legacy
    var fb = $('finaleBanner');
    if (fb) {
      if (G.isGameOver()) {
        setClass(fb, 'hidden', false);
        var won = G.state.won, eid = G.state.ending || 'aligned';
        setText($('finaleTitle'), won ? t('agi_title') : t('finale_beaten'));
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
    if (sig !== _lastCardSig) {
      _lastCardSig = sig;
      var html = sorted.map(renderCardHTML).join('');
      if (!html) html = '<div class="empty-state">' + t('ap_status_idle') + '</div>';
      cl.innerHTML = html; wireCardButtons(cl);
    } else {
      // refresh only the countdown labels in place
      var timers = cl.querySelectorAll('.nc-timer');
      for (var ti = 0; ti < timers.length && ti < sorted.length; ti++) {
        setText(timers[ti], t('card_expires', { t: FMT.fmtTime(Math.max(0, (sorted[ti].expiresAt - Date.now()) / 1000)) }));
      }
    }
    // flavor headlines (stage-based)
    var pool = currentNews();
    $('newsFlavor').innerHTML = pool.map(function (h) { return '<div class="flavor-line">• ' + h + '</div>'; }).join('');
  }

  // ---------- R9: acts, race, endings ----------
  function actId(i) { return C.ACTS[Math.max(0, Math.min(C.ACTS.length - 1, i))].id; }
  function updateActBar() {
    var a = G.state.act, bar = $('actBar');
    if (a < 1) { setClass(bar, 'hidden', true); return; }
    setClass(bar, 'hidden', false);
    setText($('actLabel'), t('act_' + actId(a) + '_t'));
    var prog = a >= 2 ? G.agiProgress() : (a * 20);
    setStyleP($('actFill'), 'width', prog.toFixed(1) + '%');
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

  // ---------- main per-frame update ----------
  var frameCps = 0, frameGM = 1, frameCompute = 0, frameMoney = 0, _lastInten = -1, _lastHeat = -1, _lastCardSig = null;
  function update() {
    frameCps = G.cps();           // compute the hottest values ONCE per frame
    frameGM = G.globalMult();
    frameCompute = G.computeRate();
    frameMoney = G.moneyRate();
    updateTop();
    if (currentTab === 'company') { updateGenerators(); updateModelPanel(); }
    else if (currentTab === 'upgrades') { updateAutopilot(); updateUpgrades(); updateManagers(); }
    else if (currentTab === 'research') { updateTeam(); }
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
    // satirical news ticker is part of the World/News layer — hidden until it unlocks (Stage 6)
    var tk = $('ticker'); if (tk) setClass(tk, 'hidden', !wu);
    // Trust HUD rides with the World stage
    var th = $('trustHud');
    if (th) {
      setClass(th, 'hidden', !wu);
      if (wu) { var tr = G.state.trust; setText($('trustVal'), Math.round(tr)); setClass(th, 'low', tr < 35); setClass(th, 'high', tr >= 75); }
    }
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

  function showOffline(off) {
    // GDD v3 "while you were away" summary: revenue + compute + finished processes
    var lines = '';
    lines += '<div class="awrow"><span class="awk">' + t('res_compute') + '</span><span class="awv">+' + fmt(off.compute) + '</span></div>';
    if (off.trainedGenId) lines += '<div class="awrow done"><span class="awk">' + t('aw_trained') + '</span><span class="awv">' + t(off.trainedGenId) + '</span></div>';
    if (off.builtDC) lines += '<div class="awrow done"><span class="awk">' + t('aw_built') + '</span><span class="awv">✓</span></div>';
    if (off.didResearch) lines += '<div class="awrow done"><span class="awk">' + t('aw_research') + '</span><span class="awv">✓</span></div>';
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
    $('offCollect').onclick = function () { G.applyOffline(off.earned, off.compute); hideModal(); maybeShowDaily(); };
    $('offDouble').onclick = function () {
      window.GAME_ADS.showRewarded({
        onReward: function () { G.applyOffline(off.earned * 2, off.compute * 2); hideModal(); maybeShowDaily(); },
        onUnavailable: function () { G.applyOffline(off.earned, off.compute); hideModal(); toast(t('ad_unavailable'), 'bad'); maybeShowDaily(); }
      });
    };
  }
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

  // ---------- onboarding tour ----------
  function showOnboarding() {
    var steps = [
      { icon: ic('ic_brain'), title: 'ob_1_title', body: 'ob_1_body' },
      { icon: ic('gen_laptop'), title: 'ob_2_title', body: 'ob_2_body' },
      { icon: ic('nav_alignment'), title: 'ob_3_title', body: 'ob_3_body' }
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
    document.addEventListener('click', function (e) { var b = e.target.closest ? e.target.closest('[data-tip]') : null; if (b) { e.preventDefault(); e.stopPropagation(); showTip(b); } else hideTip(); }, true);
    // tap
    var tapBtn = $('tapBtn');
    function doTap(clientX, clientY) {
      var v = G.tap();
      window.GAME_AUDIO.tap();
      var cls = G.clickFrenzyActive() ? 'crit' : (G.state.comboHeat > 0.6 ? 'big' : '');
      floatText(clientX, clientY, '+' + fmt(v), cls);
      window.GAME_FX.tapBurst(clientX, clientY);
      window.GAME_FX.ripple(clientX, clientY, 130);
      buzz(8);
      tapBtn.classList.remove('squash'); void tapBtn.offsetWidth; tapBtn.classList.add('squash');
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

    // autopilot controls
    var apOn = $('apOnSeg').children;
    apOn[0].addEventListener('click', function () { G.setAutopilotOn(true); window.GAME_AUDIO.buy(); updateAutopilot(); });
    apOn[1].addEventListener('click', function () { G.setAutopilotOn(false); updateAutopilot(); });
    $('apReserve').addEventListener('input', function () { G.setAutopilotReserve(parseInt(this.value, 10) / 100); updateAutopilot(); });
    var apMode = $('apModeSeg').children;
    apMode[0].addEventListener('click', function () { G.setAutopilotMode('roi'); window.GAME_AUDIO.buy(); updateAutopilot(); });
    apMode[1].addEventListener('click', function () { G.setAutopilotMode('milestone'); window.GAME_AUDIO.buy(); updateAutopilot(); });

    // (the singularity/2nd-prestige tab was retired in GDD v3; doSingularity
    //  remains in the engine only for the 'beaten' ending path)
    G.on('card', function (d) {
      if (d.kind === 'crisis') { window.GAME_AUDIO.incident(); buzz([0,40,60,40]); window.GAME_FX.flash('rgba(251,92,120,0.25)'); showCrisisModal(); }
      else if (d.kind === 'escalate') { window.GAME_AUDIO.incident(); toast(t('incident_active', { p: C.RISK.INCIDENT_PENALTY }), 'bad'); }
    });
    // R9: act intros + ending cinematics
    G.on('act', function (d) { showActIntro(d.act); });
    G.on('ending', function (d) { showEndingCinematic(d); });
    if ($('raceOpenBtn')) $('raceOpenBtn').addEventListener('click', function () { if (G.raceOpenSource()) { window.GAME_AUDIO.buy(); window.GAME_FX.flash('rgba(34,211,238,0.2)'); toast(t('race_opensource_done'), 'good'); updateStandings(); } });

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
    G.on('acquire', function (d) { toast(t('acquire_done', { name: t('rival_' + d.id) }), 'gold'); });
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
      if (d.kind === 'build') toast(t('build_done_toast', { n: d.n }), 'gold');
      else if (d.kind === 'research') toast(t('research_done_toast', { n: d.n }), 'gold');
    });
    // GDD v3: hire a researcher (speeds up training/research/builds)
    var hireBtn = $('hireBtn');
    if (hireBtn) hireBtn.addEventListener('click', function () {
      if (G.hireResearcher()) { window.GAME_AUDIO.buy(); buzz(10); updateTeam(); }
      else { window.GAME_AUDIO.error && window.GAME_AUDIO.error(); }
    });
    // GDD v3: raise a funding round
    var fundingBtn = $('fundingBtn');
    if (fundingBtn) fundingBtn.addEventListener('click', function () {
      var round = G.nextFundingRound(); if (!round) return;
      var before = G.state.cash;
      if (G.takeFunding()) { window.GAME_AUDIO.prestige(); buzz([0,25,40,25]); window.GAME_FX.flash('rgba(251,191,36,0.22)'); updateModelPanel(); }
    });
    G.on('funding', function (d) {
      var r = null; for (var i = 0; i < C.FUNDING.length; i++) if (C.FUNDING[i].id === d.id) r = C.FUNDING[i];
      toast(t('fund_done_toast', { name: t('fund_' + d.id), v: '$' + fmt(G.valuation() * (r ? r.cashFrac : 0)), p: r ? Math.round((r.mult - 1) * 100) : 0 }), 'gold');
    });
    G.on('generation', function (d) {
      var g = (d.gen >= 1 && C.MODELGEN[d.gen - 1]) ? C.MODELGEN[d.gen - 1] : null;
      var name = g ? t(g.id) : '';
      window.GAME_AUDIO.prestige(); buzz([0,30,40,30]);
      var cx = window.innerWidth / 2, cy = window.innerHeight * 0.4;
      window.GAME_FX.celebrate(cx, cy, name, true);
      // (the AGI finale cinematic is fired by the 'ending' event, not here, to avoid double-firing)
      if (!G.isAGI() && g) toast(t('train_done_toast', { name: name, p: Math.round((g.revMult - 1) * 100), s: g.share }), 'gold');
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
    // save / reset
    $('saveBtn').addEventListener('click', function () { G.save(); toast(t('saved_toast')); });
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
    var offlineShown = offline && offline.earned > 0;
    if (offlineShown) {
      showOffline(offline);
      if (!G.state.onboarded) G.setOnboarded(true); // returning player; skip tour
    } else if (!G.state.onboarded) {
      showOnboarding();
    }
    // GDD v3 daily check-in: only once a real day has rolled over. If the offline
    // modal is up, it chains the daily on dismiss (maybeShowDaily) so we never
    // clobber the un-collected offline summary; otherwise fire it now.
    if (!offlineShown) { if (G.dailyAvailable() && G.state.onboarded) setTimeout(showDaily, 60); }
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
    $('dailyOk').onclick = hideModal;
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
  window.GAME_UI = { init: init, update: update, toast: toast, renderStatic: renderStatic, back: back };
})();
