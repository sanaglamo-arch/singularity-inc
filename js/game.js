/* Core game engine -> window.GAME. State, economy math, tick, save/load,
   offline earnings, prestige, risk/alignment, achievements. No DOM here. */
(function () {
  'use strict';

  var C = window.GAME_CONFIG;
  var GEN = C.GENERATORS;
  var GENBYID = {};
  GEN.forEach(function (g) { GENBYID[g.id] = g; });

  // ---- listeners (ui subscribes) --------------------------------------
  var listeners = { change: [], toast: [], achievement: [], incident: [], prestige: [] };
  function on(ev, cb) { if (listeners[ev]) listeners[ev].push(cb); }
  function emit(ev, data) { (listeners[ev] || []).forEach(function (cb) { try { cb(data); } catch (e) {} }); }

  // ---- fresh state -----------------------------------------------------
  function newState() {
    var gens = {}, ups = {}, mgrs = {}, pups = {}, achs = {};
    GEN.forEach(function (g) { gens[g.id] = 0; });
    return {
      version: C.SETTINGS.SAVE_VERSION,
      cash: 0,
      totalEarnedThisRun: 0,
      totalEarnedAllTime: 0,
      gens: gens,
      upgrades: ups,
      managers: mgrs,
      rp: 0,
      totalRP: 0,
      prestiges: 0,
      prestigeUpgrades: pups,
      align: 0,
      risk: 0,
      incidentEndsAt: 0,     // ms; >0 means active
      incidentsThisRun: 0,
      incidentsTotal: 0,
      taps: 0,
      boostUntil: 0,         // ms
      achievements: achs,
      playtime: 0,           // seconds
      sound: false,
      lang: window.GAME_I18N.getLang(),
      buyMode: 1,            // 1 | 10 | 100 | 'max'
      lastSeen: Date.now(),
      createdAt: Date.now()
    };
  }

  var state = newState();

  // ---- prestige upgrade helpers ---------------------------------------
  function hasPU(id) { return !!state.prestigeUpgrades[id]; }
  function puValue(type, def) {
    var v = def;
    C.PRESTIGE.upgrades.forEach(function (p) {
      if (p.type === type && hasPU(p.id)) {
        if (type === 'globalMult') v *= p.value;
        else if (type === 'tapMult') v *= p.value;
        else if (type === 'offlineCap') v += p.value;
        else if (type === 'alignBoost') v *= p.value;
        else if (type === 'startCash') v = Math.max(v, p.value);
      }
    });
    return v;
  }

  // ---- multipliers -----------------------------------------------------
  function milestoneMult(count) {
    var m = 1;
    for (var i = 0; i < C.MILESTONES.length; i++) if (count >= C.MILESTONES[i]) m *= 2;
    return m;
  }
  function nextMilestone(count) {
    for (var i = 0; i < C.MILESTONES.length; i++) if (count < C.MILESTONES[i]) return C.MILESTONES[i];
    return null;
  }
  function perGenUpgradeMult(id) {
    var m = 1;
    C.UPGRADES.forEach(function (u) {
      if (u.target === id && state.upgrades[u.id]) m *= u.mult;
    });
    return m;
  }
  function managerMult(id) { return state.managers['m_' + id] ? 1.5 : 1; }

  function rpMult() { return 1 + state.rp * C.PRESTIGE.BONUS; }
  function allUpgradeMult() {
    var m = 1;
    C.UPGRADES.forEach(function (u) { if (u.target === 'all' && state.upgrades[u.id]) m *= u.mult; });
    return m;
  }
  function boostActive() { return state.boostUntil > Date.now(); }
  function incidentActive() { return state.incidentEndsAt > Date.now(); }

  function globalMult() {
    var m = rpMult() * puValue('globalMult', 1) * allUpgradeMult();
    if (boostActive()) m *= C.ADS.BOOST_MULT;
    if (incidentActive()) m *= C.RISK.INCIDENT_PENALTY;
    return m;
  }
  function tapMult() {
    var m = 1;
    C.UPGRADES.forEach(function (u) { if (u.target === 'tap' && state.upgrades[u.id]) m *= u.mult; });
    return m * puValue('tapMult', 1);
  }

  // ---- production ------------------------------------------------------
  function genOutput(id) {
    var g = GENBYID[id];
    var count = state.gens[id];
    if (!count) return 0;
    return g.baseOut * count * milestoneMult(count) * perGenUpgradeMult(id) * managerMult(id);
  }
  function cps() {
    var sum = 0;
    for (var i = 0; i < GEN.length; i++) sum += genOutput(GEN[i].id);
    return sum * globalMult();
  }
  function tapValue() { return C.TAP.base * tapMult() * globalMult(); }

  // ---- costs -----------------------------------------------------------
  function genCostCumulative(id, qty) {
    var g = GENBYID[id], owned = state.gens[id], r = g.growth;
    return g.baseCost * Math.pow(r, owned) * (Math.pow(r, qty) - 1) / (r - 1);
  }
  function genMaxAffordable(id) {
    var g = GENBYID[id], owned = state.gens[id], r = g.growth;
    var base = g.baseCost * Math.pow(r, owned);
    var v = state.cash * (r - 1) / base + 1;
    if (v <= 1) return 0;
    return Math.floor(Math.log(v) / Math.log(r));
  }
  function buyQty(id) {
    if (state.buyMode === 'max') return Math.max(1, genMaxAffordable(id));
    return state.buyMode;
  }
  function alignCost() {
    return C.RISK.alignBaseCost * Math.pow(C.RISK.alignGrowth, state.align);
  }

  // ---- actions ---------------------------------------------------------
  function addCash(v) { state.cash += v; state.totalEarnedThisRun += v; state.totalEarnedAllTime += v; }

  function tap() {
    var v = tapValue();
    addCash(v);
    state.taps++;
    checkAchievements();
    emit('change');
    return v;
  }

  function buyGen(id) {
    var qty = state.buyMode === 'max' ? genMaxAffordable(id) : state.buyMode;
    if (qty < 1) return false;
    var cost = genCostCumulative(id, qty);
    if (state.cash < cost) {
      // for fixed modes, allow partial? No — require full. Try max instead.
      if (state.buyMode !== 'max') return false;
    }
    if (state.cash < cost) return false;
    state.cash -= cost;
    state.gens[id] += qty;
    checkAchievements();
    emit('change');
    return true;
  }

  function buyUpgrade(id) {
    if (state.upgrades[id]) return false;
    var u = null;
    for (var i = 0; i < C.UPGRADES.length; i++) if (C.UPGRADES[i].id === id) u = C.UPGRADES[i];
    if (!u) return false;
    if (u.unlock && state.gens[u.unlock.gen] < u.unlock.count) return false;
    if (state.cash < u.cost) return false;
    state.cash -= u.cost;
    state.upgrades[id] = true;
    emit('change');
    return true;
  }

  function buyManager(id) {
    if (state.managers[id]) return false;
    var m = null;
    for (var i = 0; i < C.MANAGERS.length; i++) if (C.MANAGERS[i].id === id) m = C.MANAGERS[i];
    if (!m) return false;
    if (state.gens[m.gen] < 1) return false;
    if (state.cash < m.cost) return false;
    state.cash -= m.cost;
    state.managers[id] = true;
    emit('change');
    return true;
  }

  function buyAlignment() {
    var n = (state.buyMode === 'max') ? 1 : state.buyMode; // alignment buys one batch at a time for clarity
    var bought = 0;
    for (var i = 0; i < n; i++) {
      var c = alignCost();
      if (state.cash < c) break;
      state.cash -= c;
      state.align++;
      bought++;
    }
    if (bought > 0) { checkAchievements(); emit('change'); }
    return bought > 0;
  }

  // alignment suppression per second
  function alignSuppress() {
    return state.align * C.RISK.SUPPRESS * puValue('alignBoost', 1);
  }
  function riskGainRate() {
    var rate = cps();
    var capFactor = Math.log10(rate + 10) / C.RISK.CAP_DIV;
    return C.RISK.GAIN * capFactor;
  }

  function containIncident() {
    if (!incidentActive()) return false;
    var cost = state.cash * C.RISK.CONTAIN_COST_FRAC;
    if (state.cash < cost || cost <= 0) return false;
    state.cash -= cost;
    state.incidentEndsAt = 0;
    state.risk = C.RISK.INCIDENT_RESET_RISK;
    emit('toast', { key: 'incident_resolved' });
    emit('change');
    return true;
  }

  // ---- prestige --------------------------------------------------------
  function prestigeGain() {
    var raw = C.PRESTIGE.K * Math.sqrt(state.totalEarnedThisRun / C.PRESTIGE.SCALE);
    return Math.floor(raw);
  }
  function canPrestige() { return prestigeGain() >= C.PRESTIGE.MIN_TO_PRESTIGE; }

  function doPrestige() {
    if (!canPrestige()) return false;
    var gain = prestigeGain();
    var cleanRun = state.incidentsThisRun === 0;
    state.rp += gain;
    state.totalRP += gain;
    state.prestiges++;
    if (cleanRun) state._lastRunClean = true; else state._lastRunClean = false;

    // reset run-scoped progress
    var keepRP = state.rp, keepTotalRP = state.totalRP, keepPrest = state.prestiges;
    var keepPU = state.prestigeUpgrades, keepAch = state.achievements;
    var keepPlay = state.playtime, keepSound = state.sound, keepLang = state.lang;
    var keepBuy = state.buyMode, keepIncTotal = state.incidentsTotal, keepCreated = state.createdAt;
    var fresh = newState();
    fresh.rp = keepRP; fresh.totalRP = keepTotalRP; fresh.prestiges = keepPrest;
    fresh.prestigeUpgrades = keepPU; fresh.achievements = keepAch;
    fresh.playtime = keepPlay; fresh.sound = keepSound; fresh.lang = keepLang;
    fresh.buyMode = keepBuy; fresh.incidentsTotal = keepIncTotal; fresh.createdAt = keepCreated;
    // war chest
    fresh.cash = puValue('startCash', 0);
    state = fresh;

    checkAchievements();
    if (cleanRun) { state.achievements['a_safe'] = state.achievements['a_safe']; checkAchievements(); }
    emit('prestige', { gain: gain, clean: cleanRun });
    emit('change');
    return true;
  }

  function buyPrestigeUpgrade(id) {
    if (state.prestigeUpgrades[id]) return false;
    var p = null;
    for (var i = 0; i < C.PRESTIGE.upgrades.length; i++) if (C.PRESTIGE.upgrades[i].id === id) p = C.PRESTIGE.upgrades[i];
    if (!p) return false;
    if (state.rp < p.cost) return false;
    state.rp -= p.cost;
    state.prestigeUpgrades[id] = true;
    checkAchievements();
    emit('change');
    return true;
  }

  // ---- ad rewards ------------------------------------------------------
  function applyBoost() {
    var base = boostActive() ? state.boostUntil : Date.now();
    state.boostUntil = base + C.ADS.BOOST_DURATION * 1000;
    emit('toast', { key: 'ad_boost_started' });
    emit('change');
  }
  function addCashBurst() {
    var v = cps() * C.ADS.CASH_BURST_SECONDS;
    if (v <= 0) v = tapValue() * 50;
    addCash(v);
    emit('toast', { key: 'ad_reward_cash', vars: { v: window.GAME_FMT.fmt(v) } });
    emit('change');
    return v;
  }

  // ---- achievements ----------------------------------------------------
  function condMet(c) {
    switch (c.type) {
      case 'taps': return state.taps >= c.n;
      case 'anyGen': { var t = 0; GEN.forEach(function (g) { t += state.gens[g.id]; }); return t >= c.n; }
      case 'gen': return state.gens[c.gen] >= c.n;
      case 'totalCash': return state.totalEarnedAllTime >= c.n;
      case 'prestiges': return state.prestiges >= c.n;
      case 'totalRP': return state.totalRP >= c.n;
      case 'align': return state.align >= c.n;
      case 'incidents': return state.incidentsTotal >= c.n;
      case 'cleanRun': return !!state._lastRunClean && state.prestiges >= 1;
      default: return false;
    }
  }
  function checkAchievements() {
    C.ACHIEVEMENTS.forEach(function (a) {
      if (!state.achievements[a.id] && condMet(a.cond)) {
        state.achievements[a.id] = true;
        emit('achievement', { id: a.id });
      }
    });
  }

  // ---- tick ------------------------------------------------------------
  function tick(dt) {
    if (dt <= 0) return;
    // managers auto-buy their generator when affordable (one step per tick)
    C.MANAGERS.forEach(function (m) {
      if (state.managers[m.id]) {
        var c = genCostCumulative(m.gen, 1);
        if (state.cash >= c) { state.cash -= c; state.gens[m.gen] += 1; }
      }
    });

    var rate = cps();
    addCash(rate * dt);

    // risk dynamics
    var prevIncident = incidentActive();
    var dRisk = (riskGainRate() - alignSuppress()) * dt;
    state.risk = Math.max(0, Math.min(C.RISK.MAX, state.risk + dRisk));
    if (!prevIncident && state.risk >= C.RISK.INCIDENT_THRESHOLD) {
      // trigger incident
      state.incidentEndsAt = Date.now() + C.RISK.INCIDENT_DURATION * 1000;
      state.incidentsThisRun++;
      state.incidentsTotal++;
      checkAchievements();
      emit('incident', { active: true });
    } else if (prevIncident && !incidentActive()) {
      // resolved by time
      state.risk = C.RISK.INCIDENT_RESET_RISK;
      emit('incident', { active: false });
      emit('toast', { key: 'incident_resolved' });
    }

    state.playtime += dt;
    checkAchievements();
  }

  // ---- offline ---------------------------------------------------------
  function computeOffline(elapsedSec, doubled) {
    var capHours = C.OFFLINE.BASE_CAP_HOURS + (puValue('offlineCap', 0));
    var cap = capHours * 3600;
    var eff = Math.min(elapsedSec, cap);
    var rate = cps();
    var earned = rate * eff * C.OFFLINE.RATE * (doubled ? 2 : 1);
    return { earned: earned, effSec: eff, cappedSec: Math.min(elapsedSec, cap), elapsed: elapsedSec, cap: cap };
  }
  function applyOffline(earned) { addCash(earned); emit('change'); }

  // ---- save / load -----------------------------------------------------
  function save() {
    state.lastSeen = Date.now();
    state.lang = window.GAME_I18N.getLang();
    try {
      localStorage.setItem(C.SETTINGS.SAVE_KEY, JSON.stringify(state));
    } catch (e) {}
    // best-effort SDK persistence
    if (window.GAME_SDK && window.GAME_SDK.savePlayerData) {
      window.GAME_SDK.savePlayerData({ save: state }).catch(function () {});
    }
  }

  function migrate(s) {
    // ensure all keys exist (forward-compatible)
    var base = newState();
    for (var k in base) if (!(k in s)) s[k] = base[k];
    GEN.forEach(function (g) { if (s.gens[g.id] === undefined) s.gens[g.id] = 0; });
    s.version = C.SETTINGS.SAVE_VERSION;
    return s;
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(C.SETTINGS.SAVE_KEY); } catch (e) {}
    if (!raw) return null;
    try {
      var s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return null;
      return migrate(s);
    } catch (e) { return null; }
  }

  function reset() {
    try { localStorage.removeItem(C.SETTINGS.SAVE_KEY); } catch (e) {}
    state = newState();
    emit('change');
  }

  function init() {
    var loaded = load();
    var offline = null;
    if (loaded) {
      state = loaded;
      if (state.lang) window.GAME_I18N.setLang(state.lang);
      var elapsed = Math.max(0, (Date.now() - (state.lastSeen || Date.now())) / 1000);
      if (elapsed > 30) offline = computeOffline(elapsed, false);
    }
    return offline;
  }

  // ---- setters ---------------------------------------------------------
  function setBuyMode(m) { state.buyMode = m; emit('change'); }
  function setSound(b) { state.sound = !!b; emit('change'); }
  function setLang(l) { window.GAME_I18N.setLang(l); state.lang = l; emit('change'); }

  window.GAME = {
    // state access
    get state() { return state; },
    GENBYID: GENBYID,
    on: on, emit: emit,
    // computed
    cps: cps, tapValue: tapValue, genOutput: genOutput,
    genCostCumulative: genCostCumulative, genMaxAffordable: genMaxAffordable, buyQty: buyQty,
    milestoneMult: milestoneMult, nextMilestone: nextMilestone,
    perGenUpgradeMult: perGenUpgradeMult, managerMult: managerMult,
    globalMult: globalMult, tapMult: tapMult, rpMult: rpMult,
    alignCost: alignCost, alignSuppress: alignSuppress, riskGainRate: riskGainRate,
    boostActive: boostActive, incidentActive: incidentActive,
    // actions
    tap: tap, buyGen: buyGen, buyUpgrade: buyUpgrade, buyManager: buyManager,
    buyAlignment: buyAlignment, containIncident: containIncident,
    prestigeGain: prestigeGain, canPrestige: canPrestige, doPrestige: doPrestige,
    buyPrestigeUpgrade: buyPrestigeUpgrade,
    applyBoost: applyBoost, addCashBurst: addCashBurst,
    // achievements
    checkAchievements: checkAchievements,
    // tick / offline
    tick: tick, computeOffline: computeOffline, applyOffline: applyOffline,
    // persistence
    save: save, load: load, reset: reset, init: init,
    // setters
    setBuyMode: setBuyMode, setSound: setSound, setLang: setLang,
    newState: newState
  };
})();
