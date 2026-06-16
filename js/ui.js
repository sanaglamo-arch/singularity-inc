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
  var SW = ' fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
  var EXTRA = {
    ic_check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    ic_tech: '<svg viewBox="0 0 24 24"' + SW + '><circle cx="12" cy="5" r="2.2"/><circle cx="5.5" cy="18" r="2.2"/><circle cx="18.5" cy="18" r="2.2"/><path d="M12 7.2v3.3M12 10.5 6.4 16M12 10.5 17.6 16"/></svg>',
    ic_artifact: '<svg viewBox="0 0 24 24"' + SW + '><path d="M6 3h12l3 5-9 13L3 8z"/><path d="M3 8h18M9 3 7.5 8 12 21 16.5 8 15 3"/></svg>',
    ic_core: '<svg viewBox="0 0 24 24"' + SW + '><circle cx="12" cy="12" r="2.4" fill="currentColor"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/></svg>',
    nav_singularity: '<svg viewBox="0 0 24 24"' + SW + '><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 3a9 9 0 1 1-7 3.3"/><path d="M12 3a9 9 0 0 1 7 3.3" opacity="0.5"/></svg>'
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
    // nav icons (replace emoji with inline SVG)
    var navIcons = { company: 'nav_company', upgrades: 'nav_upgrades', research: 'nav_research', singularity: 'nav_singularity', alignment: 'nav_alignment', stats: 'nav_stats', achievements: 'nav_achievements', settings: 'nav_settings' };
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
    $('nav_singularity').textContent = t('tab_singularity');
    // research-tab extras
    $('artifactsTitle').textContent = t('artifacts_title');
    $('techTitle').textContent = t('tech_title');
    // singularity tab
    $('singTitle').textContent = t('singularity_title');
    $('singDesc').textContent = t('singularity_desc', { p: Math.round(C.SINGULARITY.CORE_BONUS * 100) });
    $('metaTitle').textContent = t('meta_title');
    buildArtifacts(); buildTech(); buildMeta();
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
    $('alignTip').innerHTML = '<span class="ticon">' + ic('ic_insight') + '</span><span>' + t('tip_insight') + '</span>';
    $('researchTip').innerHTML = '<span class="ticon">' + ic('ic_bolt') + '</span><span>' + t('tip_overclock') + '</span>';
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
    C.GENERATORS.forEach(function (g, gi) {
      var card = el('div', 'card locked');
      card.style.animationDelay = (Math.min(gi, 12) * 32) + 'ms';
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

  // ---------- tech tree ----------
  function techDesc(tk) { return t('tech_cat_' + tk.cat) + ' ×' + tk.mult; }
  function buildTech() {
    var list = $('techList'); list.innerHTML = '';
    C.TECH.forEach(function (tk) {
      var card = el('div', 'card locked'); card.dataset.tid = tk.id;
      card.innerHTML =
        '<div class="iconwrap">' + ic('ic_tech') + '</div>' +
        '<div class="info"><div class="name">' + t(tk.id) + '</div><div class="desc">' + techDesc(tk) + '</div><div class="sub req"></div></div>' +
        '<div class="right"><button class="minibtn">' + t('rp_cost', { n: tk.cost }) + '</button></div>';
      card.querySelector('button').addEventListener('click', function () { if (G.buyTech(tk.id)) window.GAME_AUDIO.buy(); });
      list.appendChild(card);
    });
  }
  function updateTech() {
    var s = G.state, nodes = $('techList').children;
    for (var i = 0; i < nodes.length; i++) {
      var tk = C.TECH[i], card = nodes[i], btn = card.querySelector('button'), req = card.querySelector('.req');
      if (s.tech[tk.id]) { card.classList.add('owned-tech'); card.classList.remove('locked'); btn.textContent = '✓ ' + t('bought'); btn.disabled = true; req.textContent = ''; continue; }
      var ok = G.techReqMet(tk);
      if (!ok) {
        card.classList.add('locked'); btn.disabled = true; btn.textContent = t('rp_cost', { n: tk.cost });
        if (tk.req.tech) req.textContent = t('tech_locked_tech', { name: t(tk.req.tech) });
        else if (tk.req.gen) req.textContent = t('tech_locked_gen', { n: tk.req.count, name: t('g_' + tk.req.gen) });
      } else {
        req.textContent = '';
        var afford = s.rp >= tk.cost;
        card.classList.toggle('locked', !afford); card.classList.toggle('affordable', afford);
        btn.disabled = !afford; btn.textContent = t('rp_cost', { n: tk.cost });
      }
    }
  }

  // ---------- artifacts ----------
  function artDesc(a) { return a.effect.type === 'gamble' ? t('art_gamble') : (t('art_' + a.effect.type) + ' ×' + a.effect.value); }
  function buildArtifacts() {
    var list = $('artifactList'); list.innerHTML = '';
    C.ARTIFACTS.forEach(function (a) {
      var card = el('div', 'card'); card.dataset.arid = a.id;
      var tags = a.tags.map(function (tg) { return '<span class="tagchip">' + t('tag_' + tg) + '</span>'; }).join('');
      card.innerHTML =
        '<div class="iconwrap">' + ic('ic_artifact') + '</div>' +
        '<div class="info"><div class="name">' + t(a.id) + '</div><div class="desc">' + artDesc(a) + '</div><div class="tags">' + tags + '</div></div>' +
        '<div class="right"><button class="minibtn"></button></div>';
      card.querySelector('button').addEventListener('click', function () {
        if (G.state.artifactsEquipped.indexOf(a.id) >= 0) G.unequipArtifact(a.id);
        else if (G.equipArtifact(a.id)) window.GAME_AUDIO.buy();
        else window.GAME_AUDIO.buy();
      });
      list.appendChild(card);
    });
  }
  function updateArtifacts() {
    var s = G.state, nodes = $('artifactList').children, anyOwned = false;
    for (var i = 0; i < nodes.length; i++) {
      var a = C.ARTIFACTS[i], card = nodes[i], btn = card.querySelector('button');
      var owned = !!s.artifactsOwned[a.id];
      card.classList.toggle('hidden', !owned);
      if (owned) anyOwned = true;
      var eq = s.artifactsEquipped.indexOf(a.id) >= 0;
      card.classList.toggle('equipped', eq);
      card.classList.toggle('affordable', eq);
      btn.textContent = eq ? t('unequip') : t('equip');
      btn.disabled = !eq && s.artifactsEquipped.length >= C.ARTIFACT_SLOTS;
    }
    $('artSynergy').textContent = anyOwned
      ? t('equipped_label', { n: s.artifactsEquipped.length, m: C.ARTIFACT_SLOTS }) + '  ·  ' + t('synergy_label') + ' ×' + G.artifactSynergyMult().toFixed(2)
      : t('artifacts_empty');
  }

  // ---------- core (meta) upgrades ----------
  var META_KEY = { globalMult: 'meta_global', rpGain: 'meta_rp', tapMult: 'meta_tap', riskMult: 'meta_risk', offlineCap: 'meta_offline', coreGain: 'meta_core' };
  function metaDesc(mu) {
    var lbl = t(META_KEY[mu.type] || 'meta_global');
    if (mu.type === 'offlineCap') return lbl + ' +' + mu.value + 'h';
    return lbl + ' ×' + mu.value;
  }
  function buildMeta() {
    var list = $('metaList'); list.innerHTML = '';
    C.SINGULARITY.meta.forEach(function (mu) {
      var card = el('div', 'pcard'); card.dataset.mid = mu.id;
      card.innerHTML =
        '<div class="picon">' + ic('ic_core') + '</div>' +
        '<div class="info"><div class="name">' + t(mu.id) + '</div><div class="desc">' + metaDesc(mu) + '</div></div>' +
        '<button>' + t('cores_cost', { n: mu.cost }) + '</button>';
      card.querySelector('button').addEventListener('click', function () { if (G.buyMeta(mu.id)) window.GAME_AUDIO.prestige(); });
      list.appendChild(card);
    });
  }
  function updateMeta() {
    var s = G.state, nodes = $('metaList').children;
    for (var i = 0; i < nodes.length; i++) {
      var mu = C.SINGULARITY.meta[i], card = nodes[i], btn = card.querySelector('button');
      if (s.meta[mu.id]) { card.classList.add('owned'); btn.textContent = '✓ ' + t('bought'); btn.disabled = true; }
      else { card.classList.remove('owned'); btn.textContent = t('cores_cost', { n: mu.cost }); btn.disabled = s.cores < mu.cost; }
    }
  }
  function updateSingularity() {
    var s = G.state;
    var gain = G.coresGain();
    var btn = $('singBtn'); btn.textContent = t('singularity_btn');
    if (!G.singUnlocked()) {
      $('singGain').textContent = t('singularity_locked', { n: C.SINGULARITY.UNLOCK_RP });
      btn.disabled = true;
    } else {
      $('singGain').textContent = G.canSingularity() ? t('singularity_gain', { n: gain }) : t('singularity_locked', { n: C.SINGULARITY.UNLOCK_RP });
      btn.disabled = !G.canSingularity();
    }
    $('coresHave').textContent = t('cores_have', { n: s.cores });
    $('coresBonus').textContent = t('cores_bonus', { p: Math.round(s.cores * C.SINGULARITY.CORE_BONUS * 100) });
    updateMeta();
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
    // secondary mini-stats panel (fills desktop space, adds at-a-glance info)
    function mini(label, val) { return '<div class="minicard"><div class="mlabel">' + label + '</div><div class="mval">' + val + '</div></div>'; }
    $('alignMini').innerHTML =
      mini(t('mini_cps'), fmt(G.cps())) +
      mini(t('mini_output'), '×' + fmt(G.globalMult())) +
      mini(t('mini_risk'), G.riskGainRate().toFixed(2)) +
      mini(t('mini_suppress'), G.alignSuppress().toFixed(2));
    // mini bar on company tab
    var mfill = $('riskMiniFill');
    if (mfill) { mfill.style.width = pct + '%'; mfill.style.background = col; }
    var mpct = $('riskMiniPct');
    if (mpct) mpct.textContent = Math.floor(s.risk) + '%';
  }

  // ---------- top bar / boost ----------
  function updateTop() {
    var s = G.state;
    setOdometer($('cashVal'), s.cash);
    $('cpsVal').textContent = t('per_sec', { v: fmt(G.cps()) });
    $('tapValue').textContent = '+' + fmt(G.tapValue());

    // atmosphere intensity rises with output toward AGI
    var inten = Math.max(0, Math.min(1, (Math.log10(G.cps() + 10) - 1) / 9));
    document.documentElement.style.setProperty('--intensity', inten.toFixed(3));
    // discrete evolving backdrop stage (highest hardware tier + singularity)
    var hi = -1;
    for (var gx = 0; gx < C.GENERATORS.length; gx++) if (s.gens[C.GENERATORS[gx].id] > 0) hi = gx;
    var stage = Math.min(4, Math.floor((hi + 1) / 2.6));
    if (s.singularities > 0) stage = 5;
    if (document.documentElement.getAttribute('data-stage') !== String(stage)) document.documentElement.setAttribute('data-stage', String(stage));

    // overclock heat -> combo bar + button glow
    var heat = s.comboHeat || 0;
    $('tapBtn').style.setProperty('--heat', heat.toFixed(3));
    var cw = $('comboWrap');
    if (heat > 0.02) {
      cw.classList.add('on');
      $('comboName').textContent = t('combo_label');
      $('comboMult').textContent = '×' + (1 + G.comboBonus()).toFixed(1);
      $('comboFill').style.width = (heat * 100) + '%';
    } else { cw.classList.remove('on'); }

    // breakthrough button
    var btn = $('breakthroughBtn');
    btn.classList.remove('hidden');
    if (G.breakthroughActive()) {
      btn.disabled = true;
      btn.textContent = t('breakthrough_active', { t: FMT.fmtTime((s.breakthroughEndsAt - Date.now()) / 1000) });
      btn.classList.add('bt-active');
    } else if (G.breakthroughReady()) {
      btn.disabled = false;
      btn.textContent = t('breakthrough_btn') + ' · ' + t('breakthrough_ready');
      btn.classList.remove('bt-active');
    } else {
      btn.disabled = true;
      btn.textContent = t('breakthrough_btn') + ' · ' + FMT.fmtTime(G.breakthroughCooldownLeft());
      btn.classList.remove('bt-active');
    }

    // buff badge (priority: breakthrough > frenzy > clickFrenzy > ad boost)
    var bb = $('boostBadge');
    if (G.breakthroughActive()) {
      bb.classList.remove('hidden');
      bb.textContent = t('buff_breakthrough', { m: s.breakthroughMult, t: FMT.fmtTime((s.breakthroughEndsAt - Date.now()) / 1000) });
    } else if (G.frenzyActive()) {
      bb.classList.remove('hidden');
      bb.textContent = t('buff_frenzy', { m: s.frenzyMult, t: FMT.fmtTime((s.frenzyEndsAt - Date.now()) / 1000) });
    } else if (G.clickFrenzyActive()) {
      bb.classList.remove('hidden');
      bb.textContent = t('buff_click', { m: s.clickFrenzyMult, t: FMT.fmtTime((s.clickFrenzyEndsAt - Date.now()) / 1000) });
    } else if (G.boostActive()) {
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
    else if (currentTab === 'research') { updateResearch(); updateArtifacts(); updateTech(); }
    else if (currentTab === 'singularity') updateSingularity();
    else if (currentTab === 'alignment') updateAlignment();
    else if (currentTab === 'stats') updateStats();
    else if (currentTab === 'achievements') updateAchievements();
    // risk mini always (company tab) + settings seg states
    if (currentTab === 'company') updateAlignment();
    // reveal Singularity nav once unlocked
    var nsb = $('navSingBtn');
    if (nsb) nsb.classList.toggle('hidden', !G.singUnlocked());
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
        window.GAME_AUDIO.achievement();
        window.GAME_FX.insightBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
        toast(t('insight_' + res.reward, res.vars), 'gold');
      }
    }
    e.addEventListener('click', claim);
    e.addEventListener('touchstart', claim, { passive: false });
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
      var cls = G.clickFrenzyActive() ? 'crit' : (G.state.comboHeat > 0.6 ? 'big' : '');
      floatText(clientX, clientY, '+' + fmt(v), cls);
      window.GAME_FX.tapBurst(clientX, clientY);
      window.GAME_FX.ripple(clientX, clientY, 130);
      tapBtn.classList.remove('squash'); void tapBtn.offsetWidth; tapBtn.classList.add('squash');
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
          window.GAME_FX.ritual({ kind: 'prestige', title: t('ritual_model'), subtitle: f });
          // interstitial on prestige (graceful)
          window.GAME_ADS.showInterstitial({});
        }
      };
    });

    // singularity (second prestige)
    $('singBtn').addEventListener('click', function () {
      if (!G.canSingularity()) return;
      var gain = G.coresGain();
      showModal(
        '<h3>' + t('singularity_title') + '</h3>' +
        '<p>' + t('singularity_confirm', { n: gain }) + '</p>' +
        '<div class="row"><button class="secondary" id="sCancel">✕</button>' +
        '<button class="primary" id="sOk">' + t('singularity_btn') + '</button></div>'
      );
      $('sCancel').onclick = hideModal;
      $('sOk').onclick = function () {
        hideModal();
        if (G.doSingularity()) {
          window.GAME_FX.ritual({ kind: 'singularity', title: t('ritual_singularity'), subtitle: t('sing_flavor') });
          window.GAME_AUDIO.prestige();
          switchTab('company');
        }
      };
    });
    // (singularity flavor shown in the ritual cinematic subtitle)

    // alignment buy
    $('buyAlignBtn').addEventListener('click', function () { if (G.buyAlignment()) window.GAME_AUDIO.buy(); });

    // breakthrough ability
    $('breakthroughBtn').addEventListener('click', function () {
      if (G.activateBreakthrough()) {
        window.GAME_AUDIO.prestige();
        var cx = window.innerWidth / 2, cy = window.innerHeight * 0.42;
        window.GAME_FX.milestoneBurst(cx, cy);
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
      var major = d.milestone >= 25;
      if (major && window.GAME_AUDIO.milestone) window.GAME_AUDIO.milestone(); else window.GAME_AUDIO.achievement();
      var r = genRefs[d.id];
      var b = r && r.el ? r.el.getBoundingClientRect() : null;
      var x = b ? b.left + b.width / 2 : window.innerWidth / 2;
      var y = b ? b.top + b.height / 2 : window.innerHeight / 2;
      if (major) {
        // real celebration at 25/50/100/...
        window.GAME_FX.celebrate(window.innerWidth / 2, window.innerHeight * 0.4, '×2  ' + d.milestone + '!');
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
    window.GAME_AUDIO.setEnabled(G.state.sound);
    updateBuyModeBar();
    // deep-linkable tab via URL hash (e.g. #stats)
    var validTabs = { company: 1, upgrades: 1, research: 1, singularity: 1, alignment: 1, stats: 1, achievements: 1, settings: 1 };
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
