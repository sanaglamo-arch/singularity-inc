/* Core game engine -> window.GAME. State, economy math, tick, save/load,
   offline earnings, prestige, risk/alignment, achievements. No DOM here. */
(function () {
  'use strict';

  var C = window.GAME_CONFIG;
  var GEN = C.GENERATORS;
  var GENBYID = {};
  GEN.forEach(function (g) { GENBYID[g.id] = g; });

  // ---- listeners (ui subscribes) --------------------------------------
  var listeners = { change: [], toast: [], achievement: [], incident: [], prestige: [], gameevent: [], milestone: [], insight: [], breakthrough: [], singularity: [], card: [], act: [], ending: [] };
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
      vec: { cap: 0, data: 0, reg: 0, sec: 0 }, // multi-vector risk
      auditReadyAt: 0,       // reactive-audit cooldown (ms)
      incidentEndsAt: 0,     // ms; >0 means a crisis output-penalty is active
      incidentsThisRun: 0,
      incidentsTotal: 0,
      taps: 0,
      boostUntil: 0,         // ms
      eventId: null,         // active timed event id (or null)
      eventEndsAt: 0,        // ms; >0 = timed event active
      eventOutputMult: 1,    // output multiplier from active timed event
      eventsSeen: 0,         // lifetime count of events triggered
      nextEventAt: 0,        // ms; when the next event may fire
      // tap combo / overclock heat
      comboHeat: 0,          // 0..1
      maxHeatHit: false,
      // insight flash buffs
      frenzyEndsAt: 0, frenzyMult: 1,
      clickFrenzyEndsAt: 0, clickFrenzyMult: 1,
      insightExpiresAt: 0,   // >0 = collectible currently on screen
      nextInsightAt: 0,
      insightsClaimed: 0,
      // breakthrough ability
      breakthroughEndsAt: 0, breakthroughMult: 1,
      breakthroughReadyAt: 0, lastBreakthroughEndAt: 0,
      breakthroughsUsed: 0,
      // endgame meta-progression
      tech: {},                // bought tech ids (RP); reset on Singularity
      artifactsOwned: {},      // id -> true (kept across both prestiges)
      artifactsEquipped: [],   // up to ARTIFACT_SLOTS ids
      gambleRoll: 1,           // rolled when a gamble artifact is equipped / on prestige
      cores: 0, coresTotal: 0, // Singularity Cores (meta-currency, never reset)
      meta: {},                // bought meta-upgrade ids (Cores); never reset
      singularities: 0,
      singUnlocked: false,
      achievements: achs,
      playtime: 0,           // seconds
      sound: false,
      music: false,
      orb: 'orb_default',    // cosmetic: TRAIN orb skin
      theme: 'theme_default',// cosmetic: backdrop theme
      // Smart Autopilot (decoupled from managers; never spends below reserve).
      // Default SAFE: off, no generators enabled, 50% reserve.
      autopilot: { on: false, reserve: 0.5, mode: 'roi', gens: {} },
      // R7 management-sim layer
      trust: 60,
      cards: [],             // active actionable cards (crisis / decision / opportunity)
      cardAllMult: 1,        // permanent multiplier from one-time opportunities (chip drops)
      lastCrisisAt: 0,       // crisis cooldown anchor (ms)
      nextNewsAt: 0,
      newsLog: [],           // recent headline strings for the News feed
      market: null,          // {price:{id:n}, hold:{id:shares}, hist:{id:[...]}, nextAt}
      crisesResolved: 0,
      crisesEscalated: 0,
      seen: {},              // one-time unlock hints shown
      // R9 narrative campaign + race to AGI
      act: 0,                // current narrative act (monotonic)
      rivalAgi: {},          // rival id -> AGI progress 0..100
      raceStance: null,      // story choice at Act 3
      endings: {},           // unlocked ending ids (persist forever)
      lang: window.GAME_I18N.getLang(),
      buyMode: 1,            // 1 | 10 | 100 | 'max'
      _lastRunClean: false,  // was the most recently prestiged run incident-free
      onboarded: false,      // first-run tour shown
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

  // ---- endgame multipliers (tech / artifacts / singularity) ------------
  var GEN_OF_CLASS = {};
  Object.keys(C.GEN_CLASS).forEach(function (cl) { C.GEN_CLASS[cl].forEach(function (id) { GEN_OF_CLASS[id] = cl; }); });

  function techMult(cat) {
    var m = 1;
    for (var i = 0; i < C.TECH.length; i++) { var tk = C.TECH[i]; if (state.tech[tk.id] && tk.cat === cat) m *= tk.mult; }
    return m;
  }
  function artifactById(id) { for (var i = 0; i < C.ARTIFACTS.length; i++) if (C.ARTIFACTS[i].id === id) return C.ARTIFACTS[i]; return null; }
  function equippedArtifacts() { return (state.artifactsEquipped || []).map(artifactById).filter(Boolean); }
  function artifactSynergyMult() {
    var tagCount = {};
    equippedArtifacts().forEach(function (a) { a.tags.forEach(function (tg) { tagCount[tg] = (tagCount[tg] || 0) + 1; }); });
    var pairs = 0;
    Object.keys(tagCount).forEach(function (tg) { if (tagCount[tg] >= 2) pairs++; });
    return 1 + pairs * C.ARTIFACT_SYNERGY;
  }
  function artifactMult(type) {
    var m = 1;
    equippedArtifacts().forEach(function (a) {
      if (a.effect.type === type) m *= a.effect.value;
      if (a.effect.type === 'gamble' && type === 'allMult') m *= (state.gambleRoll || 1);
    });
    return m;
  }
  function metaMul(type) {
    var v = 1;
    C.SINGULARITY.meta.forEach(function (mu) { if (state.meta[mu.id] && mu.type === type) v *= mu.value; });
    return v;
  }
  function metaAdd(type) {
    var v = 0;
    C.SINGULARITY.meta.forEach(function (mu) { if (state.meta[mu.id] && mu.type === type) v += mu.value; });
    return v;
  }
  function singCoreMult() { return 1 + (state.cores || 0) * C.SINGULARITY.CORE_BONUS; }
  function achPerkMult(kind) {
    var m = 1;
    for (var i = 0; i < C.ACHIEVEMENTS.length; i++) {
      var a = C.ACHIEVEMENTS[i];
      if (a.perk && a.perk.type === kind && state.achievements[a.id]) m *= a.perk.value;
    }
    return m;
  }

  function rpMult() { return 1 + state.rp * C.PRESTIGE.BONUS; }
  function allUpgradeMult() {
    var m = 1;
    C.UPGRADES.forEach(function (u) { if (u.target === 'all' && state.upgrades[u.id]) m *= u.mult; });
    return m;
  }
  function boostActive() { return state.boostUntil > Date.now(); }
  function incidentActive() { return state.incidentEndsAt > Date.now(); }
  function eventActive() { return state.eventEndsAt > Date.now(); }
  function eventOutputMult() { return eventActive() ? (state.eventOutputMult || 1) : 1; }
  function frenzyActive() { return state.frenzyEndsAt > Date.now(); }
  function clickFrenzyActive() { return state.clickFrenzyEndsAt > Date.now(); }
  function breakthroughActive() { return state.breakthroughEndsAt > Date.now(); }
  function comboBonus() { return state.comboHeat * C.COMBO.maxBonus; } // 0..maxBonus

  function globalMult() {
    var m = rpMult() * puValue('globalMult', 1) * allUpgradeMult();
    m *= techMult('all') * artifactMult('allMult') * artifactSynergyMult();
    m *= metaMul('globalMult') * singCoreMult() * achPerkMult('global') * (state.cardAllMult || 1) * trustMult() * endingPerkMult();
    if (boostActive()) m *= C.ADS.BOOST_MULT;
    if (incidentActive()) m *= C.RISK.INCIDENT_PENALTY;
    m *= eventOutputMult();
    if (frenzyActive()) m *= state.frenzyMult;
    if (breakthroughActive()) m *= state.breakthroughMult;
    return m;
  }
  function tapMult() {
    var m = 1;
    C.UPGRADES.forEach(function (u) { if (u.target === 'tap' && state.upgrades[u.id]) m *= u.mult; });
    return m * puValue('tapMult', 1) * techMult('tap') * artifactMult('tapMult') * metaMul('tapMult') * achPerkMult('tap');
  }

  // ---- production ------------------------------------------------------
  function genOutput(id) {
    var g = GENBYID[id];
    var count = state.gens[id];
    if (!count) return 0;
    var classM = 1, cl = GEN_OF_CLASS[id];
    if (cl) classM *= techMult('gen_' + cl);
    if (cl === 'high') classM *= artifactMult('genHighMult');
    return g.baseOut * count * milestoneMult(count) * perGenUpgradeMult(id) * managerMult(id) * classM;
  }
  function cps() {
    var sum = 0;
    for (var i = 0; i < GEN.length; i++) sum += genOutput(GEN[i].id);
    return sum * globalMult();
  }
  function tapValue() {
    var v = C.TAP.base * tapMult() * globalMult();
    v *= (1 + comboBonus());                       // overclock heat
    if (clickFrenzyActive()) v *= state.clickFrenzyMult;
    return v;
  }

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
    // build overclock heat first so this tap reflects the new heat
    state.comboHeat = Math.min(1, state.comboHeat + C.COMBO.gainPerTap);
    if (state.comboHeat >= 0.999) state.maxHeatHit = true;
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
    var before = state.gens[id];
    state.gens[id] += qty;
    var after = state.gens[id];
    // detect crossing a milestone threshold for juice
    var crossed = null;
    for (var mi = 0; mi < C.MILESTONES.length; mi++) {
      var m = C.MILESTONES[mi];
      if (before < m && after >= m) crossed = m;
    }
    if (crossed) emit('milestone', { id: id, milestone: crossed, count: after });
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

  // ---- Smart Autopilot (ROI-based, reserve-protected) ------------------
  function autopilotUnlocked() {
    return state.prestiges >= C.AUTOPILOT.UNLOCK_PRESTIGES || state.singularities > 0;
  }
  // marginal output/sec gained by buying one more of `id` (incl milestone jump + global)
  function genMarginalOutput(id) {
    var before = genOutput(id);
    state.gens[id]++;
    var after = genOutput(id);
    state.gens[id]--;
    return (after - before) * globalMult();
  }
  function apEligible(id) {
    var ap = state.autopilot;
    if (!ap.gens[id]) return false;
    if (ap.mode === 'milestone') {
      var nm = nextMilestone(state.gens[id]);
      if (nm === null) return false;                 // all milestones reached
      if (nm - state.gens[id] > C.AUTOPILOT.FILL_RANGE) return false; // too far -> pause (no endless drain)
    }
    return true;
  }
  function runAutopilot() {
    var ap = state.autopilot;
    if (!ap.on || !autopilotUnlocked()) { state._apStatus = { kind: ap.on ? 'locked' : 'off' }; return; }
    var spendable = state.cash * (1 - ap.reserve);
    if (spendable <= 0) { state._apStatus = { kind: 'reserve' }; return; }
    // choose the BEST-VALUE buy: lowest cost per +output/sec (never cheapest-blindly)
    var best = null, bestRatio = Infinity, bestCost = 0;
    for (var i = 0; i < GEN.length; i++) {
      var g = GEN[i];
      if (!apEligible(g.id)) continue;
      var cost = genCostCumulative(g.id, 1);
      if (cost > spendable) continue;
      var dOut = genMarginalOutput(g.id);
      if (dOut <= 0) continue;
      var ratio = cost / dOut;             // lower = better value
      if (ratio < bestRatio) { bestRatio = ratio; best = g; bestCost = cost; }
    }
    if (!best) { state._apStatus = { kind: 'idle' }; return; }
    // execute the single best purchase
    state.cash -= bestCost;
    var before = state.gens[best.id];
    state.gens[best.id]++;
    var after = state.gens[best.id];
    var crossed = null;
    for (var mi = 0; mi < C.MILESTONES.length; mi++) { var m = C.MILESTONES[mi]; if (before < m && after >= m) crossed = m; }
    if (crossed) emit('milestone', { id: best.id, milestone: crossed, count: after });
    state._apStatus = { kind: 'buy', id: best.id, mode: ap.mode };
  }
  function apStatus() { return state._apStatus || { kind: state.autopilot.on ? 'idle' : 'off' }; }
  function setAutopilotOn(b) { state.autopilot.on = !!b; emit('change'); }
  function setAutopilotReserve(r) { state.autopilot.reserve = Math.max(0, Math.min(0.95, r)); emit('change'); }
  function setAutopilotMode(mode) { if (mode === 'roi' || mode === 'milestone') { state.autopilot.mode = mode; emit('change'); } }
  function toggleAutopilotGen(id, on) { state.autopilot.gens[id] = !!on; emit('change'); }

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

  // alignment suppression per second (proactive investment — lowers ALL vectors)
  function alignSuppress() {
    return state.align * C.RISK.SUPPRESS * puValue('alignBoost', 1);
  }
  function riskReduce() { return techMult('risk') * artifactMult('riskMult') * metaMul('riskMult'); } // <=1

  // gross growth/sec per vector (before alignment suppression), each driven differently
  function vectorGross(id) {
    var r = riskReduce();
    if (id === 'cap') { var f = Math.log10(cps() + 10) / C.RISK.CAP_DIV; return C.RISK.CAP_GAIN * f * r; }
    if (id === 'data') { var n = 0; C.RISK.DATA_GENS.forEach(function (g) { n += state.gens[g] || 0; }); return C.RISK.DATA_GAIN * n * r; }
    if (id === 'reg') { var lowT = state.trust < 50 ? (50 - state.trust) / 50 * C.TRUST.LOW_REG_PRESSURE : 0; return (C.RISK.REG_BASE + lowT) * r; }
    if (id === 'sec') { return C.RISK.SEC_GAIN * r; }
    return 0;
  }
  // net growth/sec per vector (gross minus alignment suppression share); cap gets full suppression
  function vectorNet(id) {
    var supp = alignSuppress() * (id === 'cap' ? 1 : C.RISK.SUPPRESS_SHARE);
    var net = vectorGross(id) - supp;
    if (id === 'reg' && net < 0) net -= C.RISK.REG_DECAY; // regulatory cools faster when funded
    return net;
  }
  function highestVector() {
    var hi = 'cap', hv = -1;
    C.RISK.VECTORS.forEach(function (v) { if (state.vec[v] > hv) { hv = state.vec[v]; hi = v; } });
    return { id: hi, val: hv };
  }
  function riskLevel() { return highestVector().val; } // aggregate for HUD/nudge

  // Reactive AUDIT — preemptive, costs cash, on cooldown. Does NOT clear an active
  // crisis penalty (no instant-zero exploit); it only lowers the highest vector.
  function auditReady() { return Date.now() >= state.auditReadyAt; }
  function auditCooldownLeft() { return Math.max(0, (state.auditReadyAt - Date.now()) / 1000); }
  function auditCost() { return Math.floor(state.cash * C.RISK.AUDIT_FRAC); }
  function doAudit() {
    if (!auditReady()) return false;
    var hv = highestVector();
    if (hv.val < 1) return false;
    var cost = auditCost();
    if (cost <= 0 || state.cash < cost) return false;
    state.cash -= cost;
    state.vec[hv.id] = Math.max(0, state.vec[hv.id] - C.RISK.AUDIT_CUT);
    state.auditReadyAt = Date.now() + C.RISK.AUDIT_CD * 1000;
    emit('toast', { key: 'audit_done', vars: { v: t_vec(hv.id) } });
    emit('change');
    return true;
  }
  function t_vec(id) { return window.GAME_I18N.t('vec_' + id); }

  // ---- prestige --------------------------------------------------------
  function prestigeGain() {
    var raw = C.PRESTIGE.K * Math.sqrt(state.totalEarnedThisRun / C.PRESTIGE.SCALE);
    return Math.floor(raw * metaMul('rpGain'));
  }
  function canPrestige() { return prestigeGain() >= C.PRESTIGE.MIN_TO_PRESTIGE; }

  // in-place reset of everything that is scoped to one model-release run.
  // Tech/artifacts/meta/cores/rp persist; pass clearTechAndRp=true for Singularity.
  function resetRun(clearTechAndRp) {
    C.GENERATORS.forEach(function (g) { state.gens[g.id] = 0; });
    state.upgrades = {}; state.managers = {};
    state.align = 0; state.vec = { cap: 0, data: 0, reg: 0, sec: 0 }; state.incidentEndsAt = 0; state.incidentsThisRun = 0;
    state.totalEarnedThisRun = 0;
    // transient buffs / events
    state.comboHeat = 0; state.maxHeatHit = state.maxHeatHit;
    state.frenzyEndsAt = 0; state.frenzyMult = 1; state.clickFrenzyEndsAt = 0; state.clickFrenzyMult = 1;
    state.breakthroughEndsAt = 0; state.breakthroughMult = 1; state.breakthroughReadyAt = 0; state.lastBreakthroughEndAt = 0;
    state.eventEndsAt = 0; state.eventId = null; state.eventOutputMult = 1; state.nextEventAt = 0;
    state.insightExpiresAt = 0; state.nextInsightAt = 0;
    if (clearTechAndRp) { state.tech = {}; state.rp = 0; }
    state.cash = puValue('startCash', 0);
  }

  function grantArtifact() {
    var unowned = C.ARTIFACTS.filter(function (a) { return !state.artifactsOwned[a.id]; });
    if (!unowned.length) return null;
    var a = unowned[Math.floor(Math.random() * unowned.length)];
    state.artifactsOwned[a.id] = true;
    checkAchievements();
    return a.id;
  }
  function rollGamble() {
    var hasDice = equippedArtifacts().some(function (a) { return a.effect.type === 'gamble'; });
    state.gambleRoll = hasDice ? (0.6 + Math.random() * 2.4) : 1;
  }

  function doPrestige() {
    if (!canPrestige()) return false;
    var gain = prestigeGain();
    var cleanRun = state.incidentsThisRun === 0;
    state.rp += gain;
    state.totalRP += gain;
    state.prestiges++;
    state._lastRunClean = cleanRun;
    resetRun(false);
    state.vec.reg = Math.min(C.RISK.MAX, state.vec.reg + C.RISK.REG_PRESTIGE_SPIKE); // hype raises regulatory
    var artifact = grantArtifact();
    rollGamble();
    if (cleanRun) state.achievements['a_safe'] = true;
    checkAchievements();
    emit('prestige', { gain: gain, clean: cleanRun, artifact: artifact });
    emit('change');
    return true;
  }

  // ---- Second prestige: The Singularity --------------------------------
  function singUnlocked() {
    if (state.singUnlocked || state.singularities > 0) return true;
    if (state.totalRP >= C.SINGULARITY.UNLOCK_RP) { state.singUnlocked = true; return true; }
    if (state.gens[C.SINGULARITY.UNLOCK_GEN] >= 1) { state.singUnlocked = true; return true; }
    return false;
  }
  function coresGain() {
    return Math.floor(Math.sqrt(Math.max(0, state.rp) / C.SINGULARITY.SCALE) * metaMul('coreGain'));
  }
  function canSingularity() { return singUnlocked() && coresGain() >= 1; }
  // The AGI climax: resolves into an ENDING (forced='beaten' when a rival wins),
  // unlocks its badge + meta-perk, then performs the Singularity reset + new race.
  function doSingularity(forced) {
    if (!forced && !canSingularity()) return false;
    var ending = forced || determineEnding();
    state.endings[ending] = true;
    var gain = forced === 'beaten' ? Math.max(1, Math.floor(coresGain() / 2)) : Math.max(1, coresGain());
    state.cores += gain; state.coresTotal += gain; state.singularities++;
    state._endingFired = true;
    emit('ending', { id: ending, gain: gain });
    emit('singularity', { gain: gain });
    resetRun(true); // clears tech + RP
    C.RIVALS.forEach(function (r) { state.rivalAgi[r.id] = 0; }); // reset the race
    state.raceStance = null; state._endingFired = false;
    rollGamble();
    checkAchievements();
    emit('change');
    return true;
  }
  function buyMeta(id) {
    if (state.meta[id]) return false;
    var mu = null;
    for (var i = 0; i < C.SINGULARITY.meta.length; i++) if (C.SINGULARITY.meta[i].id === id) mu = C.SINGULARITY.meta[i];
    if (!mu || state.cores < mu.cost) return false;
    state.cores -= mu.cost; state.meta[id] = true;
    checkAchievements(); emit('change');
    return true;
  }

  // ---- Tech tree -------------------------------------------------------
  function techReqMet(tk) {
    if (!tk.req) return true;
    if (tk.req.tech && !state.tech[tk.req.tech]) return false;
    if (tk.req.gen && state.gens[tk.req.gen] < tk.req.count) return false;
    return true;
  }
  function techAvailable(id) {
    var tk = null;
    for (var i = 0; i < C.TECH.length; i++) if (C.TECH[i].id === id) tk = C.TECH[i];
    return tk && !state.tech[id] && techReqMet(tk);
  }
  function buyTech(id) {
    var tk = null;
    for (var i = 0; i < C.TECH.length; i++) if (C.TECH[i].id === id) tk = C.TECH[i];
    if (!tk || state.tech[id] || !techReqMet(tk) || state.rp < tk.cost) return false;
    state.rp -= tk.cost; state.tech[id] = true;
    checkAchievements(); emit('change');
    return true;
  }

  // ---- Artifacts -------------------------------------------------------
  function equipArtifact(id) {
    if (!state.artifactsOwned[id]) return false;
    if (state.artifactsEquipped.indexOf(id) >= 0) return false;
    if (state.artifactsEquipped.length >= C.ARTIFACT_SLOTS) return false;
    state.artifactsEquipped.push(id);
    rollGamble();
    checkAchievements(); emit('change');
    return true;
  }
  function unequipArtifact(id) {
    var i = state.artifactsEquipped.indexOf(id);
    if (i < 0) return false;
    state.artifactsEquipped.splice(i, 1);
    rollGamble();
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

  // ---- random timed events --------------------------------------------
  function scheduleNextEvent() {
    var E = C.EVENTS;
    var gap = E.MIN_GAP + Math.random() * (E.MAX_GAP - E.MIN_GAP);
    state.nextEventAt = Date.now() + gap * 1000;
  }
  // ===== R7 World: Trust, cards (crises + news), market, gating =====
  function worldUnlocked() { return state.prestiges >= 1 || state.singularities > 0; }
  function crisisCooldown() { return Math.max(C.RISK.CRISIS_CD_MIN, C.RISK.CRISIS_CD_BASE - state.prestiges * 3 - state.singularities * 10); }
  function crisisCdLeft() { return Math.max(0, (state.lastCrisisAt + crisisCooldown() * 1000 - Date.now()) / 1000); }
  function trustMult() { return C.TRUST.OUTPUT_LO + (C.TRUST.OUTPUT_HI - C.TRUST.OUTPUT_LO) * ((state.trust || 0) / 100); }
  function marketUnlocked() { return state.prestiges >= 1 || state.singularities > 0; }
  function clampTrust(v) { return Math.max(C.TRUST.MIN, Math.min(C.TRUST.MAX, v)); }
  function hasCrisisCard() { for (var i = 0; i < state.cards.length; i++) if (state.cards[i].kind === 'crisis') return true; return false; }
  var _uid = 1;

  function applyEffect(eff) {
    if (!eff) return;
    if (eff.cashFrac) state.cash = Math.max(0, state.cash + state.cash * eff.cashFrac);
    if (eff.cashGift) addCash(Math.max(tapValue() * 100, cps() * eff.cashGift));
    if (eff.trust) state.trust = clampTrust(state.trust + eff.trust);
    if (eff.vec) for (var k in eff.vec) state.vec[k] = Math.max(0, Math.min(C.RISK.MAX, state.vec[k] + eff.vec[k]));
    if (eff.penaltySec) state.incidentEndsAt = Date.now() + eff.penaltySec * 1000;
    if (eff.allMult) state.cardAllMult = (state.cardAllMult || 1) * eff.allMult;
  }
  function cardTemplate(card) {
    var arr = card.kind === 'crisis' ? C.CARDS.crises : C.CARDS.news;
    for (var i = 0; i < arr.length; i++) if (arr[i].id === card.id) return arr[i];
    return null;
  }
  function resolveCard(uid, choiceId) {
    var idx = -1; for (var i = 0; i < state.cards.length; i++) if (state.cards[i].uid === uid) idx = i;
    if (idx < 0) return false;
    var card = state.cards[idx], tpl = cardTemplate(card);
    if (!tpl) { state.cards.splice(idx, 1); return false; }
    var ch = null; for (var c = 0; c < tpl.choices.length; c++) if (tpl.choices[c].id === choiceId) ch = tpl.choices[c];
    if (!ch) return false;
    applyEffect(ch.effect);
    state.cards.splice(idx, 1);
    if (card.kind === 'crisis') state.crisesResolved++;
    checkAchievements(); emit('change');
    return true;
  }
  function spawnCrisisCard(vector) {
    var matches = C.CARDS.crises.filter(function (c) { return c.vector === vector; });
    if (!matches.length) return;
    var tpl = matches[Math.floor(Math.random() * matches.length)];
    state.cards.push({ uid: _uid++, kind: 'crisis', id: tpl.id, vector: vector, expiresAt: Date.now() + C.CARDS.CRISIS_EXPIRE * 1000 });
    state.incidentsThisRun++; state.incidentsTotal++;
    emit('card', { kind: 'crisis', id: tpl.id });
  }
  function spawnNews() {
    var pool = C.CARDS.news.filter(function (n) { return !n.req || !n.req.trust || state.trust >= n.req.trust; });
    if (!pool.length) return;
    var n = pool[Math.floor(Math.random() * pool.length)];
    state.cards.push({ uid: _uid++, kind: n.kind, id: n.id, expiresAt: Date.now() + C.CARDS.NEWS_LIFE * 1000 });
    emit('card', { kind: n.kind, id: n.id });
  }
  function triggerCrisis(vector) {
    if (worldUnlocked()) { if (!hasCrisisCard()) spawnCrisisCard(vector); }
    else { state.incidentEndsAt = Date.now() + C.RISK.INCIDENT_DURATION * 1000; state.incidentsThisRun++; state.incidentsTotal++; emit('incident', { active: true }); }
  }
  function updateCards() {
    var now = Date.now(), changed = false;
    for (var i = state.cards.length - 1; i >= 0; i--) {
      var card = state.cards[i];
      if (now >= card.expiresAt) {
        if (card.kind === 'crisis') { // escalate: HARDER penalty + bigger trust hit + vector re-raise
          state.incidentEndsAt = now + C.RISK.INCIDENT_DURATION * C.RISK.ESCALATE_DUR_MULT * 1000;
          state.trust = clampTrust(state.trust - C.RISK.ESCALATE_TRUST);
          if (card.vector) state.vec[card.vector] = Math.min(C.RISK.MAX, state.vec[card.vector] + 25);
          state.lastCrisisAt = now; state.crisesEscalated++;
          emit('card', { kind: 'escalate', vector: card.vector });
        }
        state.cards.splice(i, 1); changed = true;
      }
    }
    if (worldUnlocked()) {
      if (!state.nextNewsAt) state.nextNewsAt = now + (C.CARDS.NEWS_MIN + Math.random() * (C.CARDS.NEWS_MAX - C.CARDS.NEWS_MIN)) * 1000;
      else if (now >= state.nextNewsAt && !hasCrisisCard()) { spawnNews(); state.nextNewsAt = now + (C.CARDS.NEWS_MIN + Math.random() * (C.CARDS.NEWS_MAX - C.CARDS.NEWS_MIN)) * 1000; changed = true; }
    }
    if (changed) emit('change');
  }
  // ---- Market ----
  function ensureMarket() {
    if (state.market && state.market.price) return;
    var m = { price: {}, hold: {}, hist: {}, nextAt: 0 };
    C.MARKET.assets.forEach(function (a) { m.price[a.id] = a.start; m.hold[a.id] = 0; m.hist[a.id] = [a.start]; });
    state.market = m;
  }
  function updateMarket() {
    if (!marketUnlocked()) return;
    ensureMarket();
    var now = Date.now(), m = state.market;
    if (!m.nextAt) m.nextAt = now;
    if (now >= m.nextAt) {
      m.nextAt = now + C.MARKET.TICK * 1000;
      C.MARKET.assets.forEach(function (a) {
        var p = m.price[a.id], anchor = a.start, vol = C.MARKET.VOL * (a.vol || 1);
        var noise = (Math.random() * 2 - 1) * vol;
        var pull = (anchor - p) / anchor * C.MARKET.REVERT;  // mean reversion -> no runaway, no printer
        p = p * (1 + noise + pull);
        p = Math.max(anchor * (1 - C.MARKET.BAND), Math.min(anchor * (1 + C.MARKET.BAND), p)); // soft band
        m.price[a.id] = Math.max(1, p);
        m.hist[a.id].push(m.price[a.id]); if (m.hist[a.id].length > 40) m.hist[a.id].shift();
      });
      emit('change');
    }
  }
  function marketBuy(id, cashAmt) {
    ensureMarket(); var m = state.market;
    cashAmt = Math.min(cashAmt, state.cash); if (cashAmt <= 0) return false;
    m.hold[id] += (cashAmt * (1 - C.MARKET.FEE)) / m.price[id];
    state.cash -= cashAmt; emit('change'); return true;
  }
  function marketSell(id, frac) {
    ensureMarket(); var m = state.market;
    var sh = m.hold[id] * frac; if (sh <= 0) return false;
    state.cash += sh * m.price[id] * (1 - C.MARKET.FEE); m.hold[id] -= sh; emit('change'); return true;
  }

  // ===== R9: Acts, Race to AGI, Endings =====
  function currentAct() {
    if (state.singularities > 0) return 4;
    if (state.prestiges >= 2 || state.totalRP >= 120) return 3;
    if (state.prestiges >= 1) return 2;
    var owned = 0; GEN.forEach(function (g) { owned += state.gens[g.id]; });
    return owned > 0 ? 1 : 0;
  }
  function rivalsRevealed() { return currentAct() >= C.RACE.REVEAL_ACT; }
  function ensureRivals() { C.RIVALS.forEach(function (r) { if (typeof state.rivalAgi[r.id] !== 'number') state.rivalAgi[r.id] = 0; }); }
  function agiProgress() { var t = state.singularities > 0 ? 100 : C.SINGULARITY.UNLOCK_RP; var v = state.singularities > 0 ? state.rp : state.totalRP; return Math.max(0, Math.min(100, 100 * v / t)); }
  function leadingRival() { ensureRivals(); var id = null, v = -1; C.RIVALS.forEach(function (r) { if (state.rivalAgi[r.id] > v) { v = state.rivalAgi[r.id]; id = r.id; } }); return { id: id, val: v }; }
  function maxRivalAgi() { return leadingRival().val; }
  function slowLeadingRival() { var l = leadingRival(); if (l.id) state.rivalAgi[l.id] = Math.max(0, state.rivalAgi[l.id] - C.RACE.SLOW_OPENSOURCE); }
  function updateRace(dt) {
    // act advance + intro
    var a = currentAct();
    if (a > state.act) { state.act = a; emit('act', { act: a }); }
    if (!rivalsRevealed()) return;
    ensureRivals();
    var heat = Math.max(agiProgress(), maxRivalAgi()) / 100 * C.RACE.HEAT;
    var reckless = state.align < 2 ? C.RACE.RECKLESS_RIVAL_BONUS : 0;
    C.RIVALS.forEach(function (r) { state.rivalAgi[r.id] = Math.min(100, state.rivalAgi[r.id] + r.speed * (1 + heat + reckless) * dt); });
    if (maxRivalAgi() >= 100 && agiProgress() < 100 && !state._endingFired) { doSingularity('beaten'); }
  }
  function avgVec() { var s = 0; C.RISK.VECTORS.forEach(function (v) { s += state.vec[v]; }); return s / C.RISK.VECTORS.length; }
  function determineEnding() {
    var E = C.ENDINGS, av = avgVec();
    if (state.trust >= E.QUIET_TRUST && av < E.QUIET_AVGVEC) return 'quiet';
    if (state.trust < E.NATIONALIZED_TRUST || av > E.NATIONALIZED_AVGVEC || state.crisesEscalated >= E.NATIONALIZED_ESC) return 'nationalized';
    if (state.align < E.FOOM_ALIGN || state.vec.cap > E.FOOM_CAP) return 'foom';
    return 'aligned';
  }
  function endingPerkMult() { var n = 0; for (var k in state.endings) if (state.endings[k]) n++; return 1 + n * C.ENDINGS.PERK_PER; }
  function endingsUnlocked() { var n = 0; for (var k in state.endings) if (state.endings[k]) n++; return n; }
  function applyRaceStance(stance) {
    state.raceStance = stance;
    if (stance === 'safe') state.align += 2;
    else if (stance === 'open') { state.trust = clampTrust(state.trust + 10); slowLeadingRival(); }
    else if (stance === 'fast') { state.boostUntil = Date.now() + C.ADS.BOOST_DURATION * 1000; }
    emit('change');
  }

  function raceOpenReady() { return !state.raceOpenAt || Date.now() - state.raceOpenAt >= 90000; }
  function raceOpenSource() { // slow the leader: +Trust but a capability/progress dip; cooldown
    if (!rivalsRevealed() || !raceOpenReady()) return false;
    slowLeadingRival();
    state.trust = clampTrust(state.trust + 5);
    if (state.singularities > 0) state.rp = Math.max(0, state.rp * 0.92); else state.totalRP = Math.max(0, state.totalRP * 0.96);
    state.raceOpenAt = Date.now();
    emit('change');
    return true;
  }

  function triggerEvent() {
    var E = C.EVENTS;
    var def = E.list[Math.floor(Math.random() * E.list.length)];
    if (def.kind === 'timed') {
      state.eventId = def.id;
      state.eventEndsAt = Date.now() + def.duration * 1000;
      state.eventOutputMult = def.outputMult;
    } else { // instant
      if (def.cashSeconds) {
        var v = cps() * def.cashSeconds;
        if (v <= 0) v = tapValue() * 100;
        addCash(v);
      }
      if (def.riskAdd) {
        // map world-event risk onto vectors: leaks hit data+reg, good PR cools reg+sec
        var clamp = function (x) { return Math.max(0, Math.min(C.RISK.MAX, x)); };
        if (def.riskAdd > 0) { state.vec.data = clamp(state.vec.data + def.riskAdd); state.vec.reg = clamp(state.vec.reg + def.riskAdd * 0.6); }
        else { state.vec.reg = clamp(state.vec.reg + def.riskAdd); state.vec.sec = clamp(state.vec.sec + def.riskAdd * 0.5); }
      }
    }
    state.eventsSeen++;
    scheduleNextEvent();
    checkAchievements();
    emit('gameevent', { id: def.id, kind: def.kind });
    emit('change');
  }
  function updateEvents() {
    if (state.playtime < C.EVENTS.FIRST_DELAY) return;
    if (state.nextEventAt === 0) { scheduleNextEvent(); return; }
    // clear a finished timed event
    if (state.eventEndsAt > 0 && !eventActive()) {
      var ended = state.eventId;
      state.eventId = null; state.eventEndsAt = 0; state.eventOutputMult = 1;
      emit('gameevent', { id: ended, kind: 'end' });
    }
    // fire a new event when due (never overlap a timed one)
    if (Date.now() >= state.nextEventAt && !eventActive()) triggerEvent();
  }

  // ---- Insight Flash (golden-cookie collectible) ----------------------
  function scheduleNextInsight() {
    var I = C.INSIGHT;
    state.nextInsightAt = Date.now() + (I.MIN_GAP + Math.random() * (I.MAX_GAP - I.MIN_GAP)) * 1000;
  }
  function insightOnScreen() { return state.insightExpiresAt > Date.now(); }
  function updateInsight() {
    var I = C.INSIGHT;
    if (state.playtime < I.FIRST_DELAY) return;
    if (state.nextInsightAt === 0) { scheduleNextInsight(); return; }
    if (state.insightExpiresAt > 0 && !insightOnScreen()) { // escaped
      state.insightExpiresAt = 0; emit('insight', { kind: 'despawn' }); scheduleNextInsight();
    }
    if (Date.now() >= state.nextInsightAt && state.insightExpiresAt === 0) {
      state.insightExpiresAt = Date.now() + I.LIFETIME * 1000;
      emit('insight', { kind: 'spawn', lifetime: I.LIFETIME });
    }
  }
  function claimInsight() {
    if (!insightOnScreen()) return null;
    state.insightExpiresAt = 0;
    var I = C.INSIGHT;
    var r = I.rewards[Math.floor(Math.random() * I.rewards.length)];
    var vars = {};
    if (r.id === 'frenzy') { state.frenzyEndsAt = Date.now() + r.duration * 1000; state.frenzyMult = r.mult; vars = { m: r.mult, t: r.duration }; }
    else if (r.id === 'clickFrenzy') { state.clickFrenzyEndsAt = Date.now() + r.duration * 1000; state.clickFrenzyMult = r.tapMult; vars = { m: r.tapMult, t: r.duration }; }
    else if (r.id === 'lucky') { var v = cps() * r.cashSeconds; if (v <= 0) v = tapValue() * 200; addCash(v); vars = { v: window.GAME_FMT.fmt(v) }; }
    state.insightsClaimed++;
    scheduleNextInsight();
    checkAchievements();
    emit('insight', { kind: 'claim', reward: r.id, vars: vars });
    emit('change');
    return { reward: r.id, vars: vars };
  }

  // ---- Breakthrough ability (active, chainable) -----------------------
  function breakthroughReady() { return Date.now() >= state.breakthroughReadyAt && !breakthroughActive(); }
  function breakthroughCooldownLeft() { return Math.max(0, (state.breakthroughReadyAt - Date.now()) / 1000); }
  function activateBreakthrough() {
    if (!breakthroughReady()) return false;
    var B = C.BREAKTHROUGH;
    var chained = state.lastBreakthroughEndAt > 0 && (Date.now() - state.lastBreakthroughEndAt) <= B.chainWindow * 1000;
    var mult = chained ? B.chainMult : B.mult;
    var dur = chained ? B.chainDuration : B.duration;
    state.breakthroughMult = mult;
    state.breakthroughEndsAt = Date.now() + dur * 1000;
    state.breakthroughReadyAt = Date.now() + B.cooldown * 1000;
    state.breakthroughsUsed++;
    checkAchievements();
    emit('breakthrough', { chained: chained, mult: mult, duration: dur });
    emit('change');
    return true;
  }

  // expire timed buffs; called from tick
  function updateBuffs(dt) {
    if (state.comboHeat > 0) state.comboHeat = Math.max(0, state.comboHeat - C.COMBO.decayPerSec * dt);
    var now = Date.now();
    if (state.frenzyEndsAt && now >= state.frenzyEndsAt) { state.frenzyEndsAt = 0; state.frenzyMult = 1; }
    if (state.clickFrenzyEndsAt && now >= state.clickFrenzyEndsAt) { state.clickFrenzyEndsAt = 0; state.clickFrenzyMult = 1; }
    if (state.breakthroughEndsAt && now >= state.breakthroughEndsAt) {
      state.breakthroughEndsAt = 0; state.breakthroughMult = 1; state.lastBreakthroughEndAt = now;
    }
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
      case 'events': return state.eventsSeen >= c.n;
      case 'insights': return state.insightsClaimed >= c.n;
      case 'breakthroughs': return state.breakthroughsUsed >= c.n;
      case 'maxheat': return !!state.maxHeatHit;
      case 'tech': { var tc = 0; for (var k in state.tech) if (state.tech[k]) tc++; return tc >= c.n; }
      case 'artifacts': return (state.artifactsEquipped || []).length >= c.n;
      case 'singularities': return state.singularities >= c.n;
      case 'cores': return state.coresTotal >= c.n;
      case 'synergy': return artifactSynergyMult() >= 1 + C.ARTIFACT_SYNERGY * c.n - 0.0001;
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
    runAutopilot();    // smart, ROI-based, reserve-protected (replaces dumb manager auto-buy)

    var rate = cps();
    addCash(rate * dt);

    // multi-vector risk dynamics
    var prevIncident = incidentActive();
    for (var vi = 0; vi < C.RISK.VECTORS.length; vi++) {
      var vid = C.RISK.VECTORS[vi];
      state.vec[vid] = Math.max(0, Math.min(C.RISK.MAX, state.vec[vid] + vectorNet(vid) * dt));
    }
    // crisis: a maxed vector fires a crisis, but only once per (stage-scaled) cooldown
    // so they're tense, not spammy. On cooldown a maxed vector is pinned (visible danger).
    if (!prevIncident && !hasCrisisCard()) {
      var cdMs = crisisCooldown() * 1000, nowt = Date.now();
      for (var ci = 0; ci < C.RISK.VECTORS.length; ci++) {
        var cv = C.RISK.VECTORS[ci];
        if (state.vec[cv] >= C.RISK.INCIDENT_THRESHOLD) {
          if (nowt - state.lastCrisisAt < cdMs) { state.vec[cv] = Math.min(state.vec[cv], 96); }
          else { state.vec[cv] = C.RISK.INCIDENT_RESET_RISK; state.lastCrisisAt = nowt; checkAchievements(); triggerCrisis(cv); }
          break;
        }
      }
    } else if (prevIncident && !incidentActive()) {
      emit('incident', { active: false });
      emit('toast', { key: 'incident_resolved' });
    }

    updateEvents();
    updateInsight();
    updateBuffs(dt);
    updateCards();
    updateMarket();
    updateRace(dt);

    state.playtime += dt;
    checkAchievements();
  }

  // ---- offline ---------------------------------------------------------
  function computeOffline(elapsedSec, doubled) {
    var capHours = C.OFFLINE.BASE_CAP_HOURS + puValue('offlineCap', 0) + metaAdd('offlineCap');
    var cap = capHours * 3600;
    var eff = Math.min(elapsedSec, cap);
    var rate = cps();
    var offMult = techMult('offline') * artifactMult('offlineMult');
    var earned = rate * eff * C.OFFLINE.RATE * offMult * (doubled ? 2 : 1);
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
    // Autopilot migration — never auto-spend a returning player's bank on load:
    // ensure the object exists and force it OFF for any pre-Autopilot save.
    if (!s.autopilot || typeof s.autopilot !== 'object') s.autopilot = { on: false, reserve: 0.5, mode: 'roi', gens: {} };
    if (typeof s.autopilot.on !== 'boolean') s.autopilot.on = false;
    if (typeof s.autopilot.reserve !== 'number' || s.autopilot.reserve < 0 || s.autopilot.reserve > 0.95) s.autopilot.reserve = 0.5;
    if (s.autopilot.mode !== 'roi' && s.autopilot.mode !== 'milestone') s.autopilot.mode = 'roi';
    if (!s.autopilot.gens || typeof s.autopilot.gens !== 'object') s.autopilot.gens = {};
    if (s.version < 2) s.autopilot.on = false; // legacy saves: start safe (the old manager-autobuy is gone)
    // multi-vector risk migration: fold old single risk into capability
    if (!s.vec || typeof s.vec !== 'object') s.vec = { cap: (typeof s.risk === 'number' ? s.risk : 0), data: 0, reg: 0, sec: 0 };
    C.RISK.VECTORS.forEach(function (v) { if (typeof s.vec[v] !== 'number') s.vec[v] = 0; });
    if (typeof s.auditReadyAt !== 'number') s.auditReadyAt = 0;
    delete s.risk;
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
  function setMusic(b) { state.music = !!b; emit('change'); }
  function setLang(l) { window.GAME_I18N.setLang(l); state.lang = l; emit('change'); }
  function setOnboarded(b) { state.onboarded = !!b; save(); }
  function achCount() { var c = 0; for (var k in state.achievements) if (state.achievements[k]) c++; return c; }
  function cosmeticUnlocked(item) {
    var u = item.unlock || {};
    if (u.prestiges && state.prestiges < u.prestiges) return false;
    if (u.singularities && state.singularities < u.singularities) return false;
    if (u.ach && achCount() < u.ach) return false;
    return true;
  }
  function findCosmetic(id) {
    var all = C.COSMETICS.orbs.concat(C.COSMETICS.themes);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function setOrb(id) { var it = findCosmetic(id); if (it && cosmeticUnlocked(it)) { state.orb = id; emit('change'); return true; } return false; }
  function setTheme(id) { var it = findCosmetic(id); if (it && cosmeticUnlocked(it)) { state.theme = id; emit('change'); return true; } return false; }

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
    alignCost: alignCost, alignSuppress: alignSuppress,
    vectorGross: vectorGross, vectorNet: vectorNet, highestVector: highestVector, riskLevel: riskLevel,
    auditReady: auditReady, auditCooldownLeft: auditCooldownLeft, auditCost: auditCost, doAudit: doAudit,
    boostActive: boostActive, incidentActive: incidentActive,
    eventActive: eventActive, eventOutputMult: eventOutputMult,
    frenzyActive: frenzyActive, clickFrenzyActive: clickFrenzyActive,
    breakthroughActive: breakthroughActive, breakthroughReady: breakthroughReady,
    breakthroughCooldownLeft: breakthroughCooldownLeft, comboBonus: comboBonus,
    insightOnScreen: insightOnScreen, claimInsight: claimInsight,
    activateBreakthrough: activateBreakthrough,
    // actions
    tap: tap, buyGen: buyGen, buyUpgrade: buyUpgrade, buyManager: buyManager,
    buyAlignment: buyAlignment,
    prestigeGain: prestigeGain, canPrestige: canPrestige, doPrestige: doPrestige,
    buyPrestigeUpgrade: buyPrestigeUpgrade,
    // endgame
    techMult: techMult, techAvailable: techAvailable, techReqMet: techReqMet, buyTech: buyTech,
    artifactById: artifactById, equippedArtifacts: equippedArtifacts, artifactSynergyMult: artifactSynergyMult,
    equipArtifact: equipArtifact, unequipArtifact: unequipArtifact,
    singUnlocked: singUnlocked, coresGain: coresGain, canSingularity: canSingularity,
    doSingularity: doSingularity, buyMeta: buyMeta, singCoreMult: singCoreMult,
    applyBoost: applyBoost, addCashBurst: addCashBurst,
    // achievements
    checkAchievements: checkAchievements,
    // tick / offline
    tick: tick, computeOffline: computeOffline, applyOffline: applyOffline,
    // persistence
    save: save, load: load, reset: reset, init: init,
    // setters
    setBuyMode: setBuyMode, setSound: setSound, setMusic: setMusic, setLang: setLang, setOnboarded: setOnboarded,
    achCount: achCount, cosmeticUnlocked: cosmeticUnlocked, setOrb: setOrb, setTheme: setTheme,
    worldUnlocked: worldUnlocked, marketUnlocked: marketUnlocked, resolveCard: resolveCard,
    crisisCdLeft: crisisCdLeft, trustMult: trustMult,
    currentAct: currentAct, rivalsRevealed: rivalsRevealed, agiProgress: agiProgress,
    leadingRival: leadingRival, maxRivalAgi: maxRivalAgi, slowLeadingRival: slowLeadingRival,
    endingPerkMult: endingPerkMult, endingsUnlocked: endingsUnlocked, applyRaceStance: applyRaceStance,
    raceOpenSource: raceOpenSource, raceOpenReady: raceOpenReady,
    cardTemplate: cardTemplate, marketBuy: marketBuy, marketSell: marketSell, ensureMarket: ensureMarket,
    autopilotUnlocked: autopilotUnlocked, apStatus: apStatus,
    setAutopilotOn: setAutopilotOn, setAutopilotReserve: setAutopilotReserve,
    setAutopilotMode: setAutopilotMode, toggleAutopilotGen: toggleAutopilotGen,
    newState: newState
  };
})();
