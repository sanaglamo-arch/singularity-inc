/* Core game engine -> window.GAME. State, economy math, tick, save/load,
   offline earnings, prestige, risk/alignment, achievements. No DOM here. */
(function () {
  'use strict';

  var C = window.GAME_CONFIG;
  var GEN = C.GENERATORS;
  var GENBYID = {};
  GEN.forEach(function (g) { GENBYID[g.id] = g; });

  // ---- listeners (ui subscribes) --------------------------------------
  var listeners = { change: [], toast: [], achievement: [], incident: [], prestige: [], gameevent: [], milestone: [], insight: [], breakthrough: [], singularity: [], card: [], act: [], ending: [], generation: [], funding: [], process: [], acquire: [], trainprogress: [], longtrain: [], rivalagi: [], scheduled: [], decision: [], newsline: [] };
  var LONG_TRAIN_SEC = 3600;   // ~1h: the threshold where a training run "feels long" (v4→v5 cliff)
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
      bestRunEarned: 0,      // best single-run total earned (drives % start-cash boosts)
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
      haptics: true,         // vibration feedback (mobile)
      orb: 'orb_default',    // cosmetic: TRAIN orb skin
      theme: 'theme_default',// cosmetic: backdrop theme
      // R7 management-sim layer
      trust: 60,
      cards: [],             // active actionable cards (crisis / decision / opportunity)
      cardAllMult: 1,        // permanent multiplier from one-time opportunities (chip drops)
      // ===== Decision-engine groundwork (Phase 1) — populated by applyEffect() =====
      flags: {},             // boolean store: set_flag / clr_flag (e.g. "regulator_watching")
      vars: {},              // numeric accumulators: set_var (e.g. alignment_debt)
      scheduled: [],         // queued future events: { event, fireAt(ms), chance } — fired in tick()
      buffs: [],             // timed multipliers: { key, mult, endsAt(ms) } — expired in tick()
      // ===== Decision engine (Phase 2) =====
      eventCooldowns: {},    // event id -> last-fired epoch ms (cooldown_sec + no-repeat floor)
      eventsFired: {},       // event id -> true (for `once` events)
      categoryCooldowns: {}, // category -> last-fired epoch ms (anti-clustering)
      eventBag: {},          // category -> shuffle-bag of remaining event ids (anti-repeat)
      inbox: [],             // pending `bankable` decisions: { uid, id, addedAt, autoAt }
      // ===== Executive / Managing Director (DESIGN-exec-team.md) =====
      exec: -1,              // owned tier INDEX into C.EXECS (-1 = none hired yet)
      execRecruit: { active: false, toTier: -1, startedAt: 0, endsAt: 0 }, // active recruit timer
      mandate: 'balance',    // offline strategy: 'growth' | 'balance' | 'safety' | 'share'
      nextDecisionAt: 0,     // epoch ms of the next pacing roll
      lastCrisisAt: 0,       // crisis cooldown anchor (ms)
      nextNewsAt: 0,
      newsReact: {},         // world-reaction throttle: flag -> last-fired state (no spam)
      newsLog: [],           // recent headline objects {line,type,at} for the News feed
      market: null,          // {price:{id:n}, hold:{id:shares}, hist:{id:[...]}, nextAt}
      crisesResolved: 0,
      crisesEscalated: 0,
      seen: {},              // one-time unlock hints shown
      // R9 narrative campaign + race to AGI
      act: 0,                // current narrative act (monotonic)
      rivals: [],            // §4 data-driven roster: [{id,name,archetype,share,agi,acquired,agiToasted,shareRate,agiRate,speed}] — seeded at new-game
      raceStance: null,      // story choice at Act 3
      endings: {},           // unlocked ending ids (persist forever)
      // ===== GDD v3 — continuous no-reset meta =====
      compute: 0,            // 🖥 compute STOCK (generators produce it; spent to train models)
      researchers: 0,        // 👥 hired researchers (speed up timed processes)
      modelGen: 0,           // # of model generations COMPLETED (0 = none yet); next = MODELGEN[modelGen]
      marketShare: 0,        // your market share % (derived scoreboard, climbs on generation advance)
      training: { active: false, gen: -1, startedAt: 0, endsAt: 0 }, // active timed training process
      trainToastPct: 0,      // highest 25/50/75 milestone toasted for the CURRENT run (resets on start)
      seenLongTrain: false,  // one-time teaching beat shown the first time a run exceeds ~1h
      datacenters: 0,        // completed datacenter builds (each = +compute multiplier)
      build: { active: false, startedAt: 0, endsAt: 0 },             // active datacenter-build timer
      researchLevel: 0,      // completed research projects (efficiency)
      research2: { active: false, startedAt: 0, endsAt: 0 },         // active research timer
      funding: {},           // funding round id -> true (Seed→A→B→C→IPO)
      boostTokens: 0,        // earned boosts (speed all timers) — from daily/achievements/idle
      lastDailyDay: 0,       // last day index a daily reward was claimed
      dailyStreak: 0,        // consecutive-day login streak (forgiving)
      gameOver: false,       // AGI finale fired (win or beaten)
      ending: null,          // chosen ending id (aligned/foom/nationalized/beaten)
      won: false,            // reached AGI first
      legacyCount: 0,        // Founder's Legacy replays completed (optional, non-forced)
      legacyMult: 1,         // permanent multiplier kept across Founder's Legacy
      unicorn: false,        // §9 shareable milestone: valuation first crossed $1B
      decacorn: false,       // §9 shareable milestone: valuation first crossed $10B
      lang: window.GAME_I18N.getLang(),
      buyMode: 1,            // 1 | 10 | 100 | 'max'
      _lastRunClean: false,  // was the most recently prestiged run incident-free
      onboarded: false,      // first-run tour shown
      difficulty: 'normal',  // chosen at new-game (easy|normal|hard|impossible) — multiplier vector (C.DIFFICULTY)
      companyName: 'Singularity Inc.', // player-chosen AI-lab name (item 2; shown as topbar brand)
      companyNamed: false,   // has the player confirmed a name yet (false => show the naming step)
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
        else if (type === 'startCashPct') v = Math.max(v, p.value);
        else if (type === 'keepGens') v = Math.max(v, p.value);
      }
    });
    return v;
  }

  // ---- difficulty accessor --------------------------------------------
  // diff(key) -> the chosen difficulty's lever value (falls back to 'normal', then to a
  // neutral 1 / undefined). All call sites read levers through here so an unknown/missing
  // difficulty can never crash. Some levers are dormant (no consumer yet) — see C.DIFFICULTY.
  function diffLevel() {
    var L = C.DIFFICULTY.levels;
    return L[state.difficulty] || L[C.DIFFICULTY.DEFAULT];
  }
  function diff(key) {
    var lv = diffLevel();
    var v = lv ? lv[key] : undefined;
    if (v === undefined) { var n = C.DIFFICULTY.levels[C.DIFFICULTY.DEFAULT]; v = n ? n[key] : undefined; }
    return v;
  }

  // ---- rival roster (data-driven, §4 replayability core) ---------------
  // state.rivals is an array of live rival objects seeded at new-game from C.RIVAL_POOL.
  // Each: { id, name, archetype, share, agi, acquired, agiToasted, shareRate, agiRate, speed }.
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rivalById(id) {
    var rs = state.rivals || [];
    for (var i = 0; i < rs.length; i++) if (rs[i].id === id) return rs[i];
    return null;
  }
  // build ONE live rival object from a pool entry (rolls its starting band + creep rates).
  function makeRival(pool) {
    var A = C.RIVAL_ARCHETYPES[pool.archetype] || C.RIVAL_ARCHETYPES.satire;
    var B = C.RIVAL_BASE;
    return {
      id: pool.id, name: pool.name, archetype: pool.archetype,
      share: Math.round(rnd(A.share0[0], A.share0[1]) * 10) / 10,
      agi: Math.round(rnd(A.agi0[0], A.agi0[1]) * 10) / 10,
      acquired: false, agiToasted: 0,
      // small per-rival jitter on rates so two runs with the same archetype still differ
      shareRate: B.shareRate * A.shareRate * rnd(0.85, 1.15),
      agiRate: B.agiRate * A.agiRate * rnd(0.85, 1.15),
      speed: B.speed * A.speed * rnd(0.85, 1.15)
    };
  }
  // pick N distinct rivals at random (N from the difficulty's rivalCount band) and assign to
  // target.rivals. Pure helper so it works on the live state OR a save object during migrate.
  function seedRivalsInto(target, difficulty) {
    var lv = C.DIFFICULTY.levels[difficulty] || C.DIFFICULTY.levels[C.DIFFICULTY.DEFAULT];
    var band = (lv && lv.rivalCount) || [3, 3];
    var n = Math.floor(rnd(band[0], band[1] + 1));
    n = Math.max(band[0], Math.min(band[1], n));
    var pool = C.RIVAL_POOL.slice();
    // Fisher–Yates partial shuffle
    for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    var picked = pool.slice(0, Math.min(n, pool.length));
    target.rivals = picked.map(makeRival);
    return target.rivals;
  }
  function seedRivals(difficulty) { return seedRivalsInto(state, difficulty); }
  // active (not-yet-acquired) rivals — the live field
  function activeRivals() { return (state.rivals || []).filter(function (r) { return !r.acquired; }); }
  // localized display name for a rival id (live roster name first; falls back to i18n/id)
  function rivalName(id) {
    var r = rivalById(id);
    if (r && r.name) return r.name;
    var key = 'rival_' + id;
    var s = t_safe(key);
    return (s && s !== key) ? s : id;
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
  // product of TRANSIENT output multipliers currently active (boost/event/frenzy/
  // breakthrough/incident). baseCps strips these so "X seconds of production"
  // windfalls can't be inflated by claiming during a stacked buff.
  function transientMult() {
    var m = 1;
    if (boostActive()) m *= C.ADS.BOOST_MULT;
    if (incidentActive()) m *= C.RISK.INCIDENT_PENALTY;
    m *= eventOutputMult();
    if (frenzyActive()) m *= state.frenzyMult;
    if (breakthroughActive()) m *= state.breakthroughMult;
    return m;
  }
  function baseCps() { var tm = transientMult(); return tm > 0 ? cps() / tm : cps(); }
  // a capped cash windfall = `seconds` of BASE production, never more than `frac`
  // of the best proven run (no self-compounding printer). first run: no cap yet.
  function windfallCash(seconds, frac, fallbackTapMult) {
    var v = baseCps() * seconds;
    if (v <= 0) v = tapValue() * (fallbackTapMult || 100);
    if (state.bestRunEarned > 0) v = Math.min(v, state.bestRunEarned * frac);
    return v;
  }
  function tapValue() {
    var v = C.TAP.base * tapMult() * globalMult();
    v *= (1 + comboBonus());                       // overclock heat
    if (clickFrenzyActive()) v *= state.clickFrenzyMult;
    return v;
  }

  // ===================================================================
  // GDD v3 — CONTINUOUS META engine (compute / money / generations /
  // training / researchers / funding). Additive; wired into tick + UI in
  // later increments. See GAME-DESIGN.md + REWRITE-PROGRESS.md.
  // ===================================================================
  // generic output multipliers that apply to COMPUTE production (NOT the removed
  // prestige passives like rpMult/cores/trust — those get re-homed/removed).
  function genericMult() {
    var m = allUpgradeMult() * techMult('all') * artifactMult('allMult') * artifactSynergyMult();
    m *= achPerkMult('global') * (state.cardAllMult || 1) * transientMult() * (state.legacyMult || 1);
    return m;
  }
  // 🖥 compute produced per second by all generators (generators = compute infra),
  // scaled by built datacenters and research efficiency (the parallel processes).
  function computeRate() {
    var sum = 0;
    for (var i = 0; i < GEN.length; i++) sum += genOutput(GEN[i].id);
    return sum * C.CORE.COMPUTE_PER_OUT * genericMult() * datacenterMult() * researchEfficiencyMult();
  }
  // combined speed multiplier for ALL timed processes (researchers + research perks + boost)
  function processSpeed() {
    var s = 1 + Math.min(C.PROCESS.RESEARCHER_SPEED_CAP, state.researchers * C.PROCESS.RESEARCHER_SPEED_PER)
              + Math.min(C.PROCESS.RESEARCH_SPEED_CAP, (state.researchLevel || 0) * C.RESEARCH2.speedBonus);
    return s * (boostActive() ? C.ADS.BOOST_MULT : 1);
  }
  // ---- datacenter build process (money + time -> permanent compute capacity) ----
  function datacenterMult() { return 1 + (state.datacenters || 0) * C.DATACENTER.bonus; }
  function buildCost() { return Math.floor(C.DATACENTER.baseCost * Math.pow(C.DATACENTER.costGrowth, state.datacenters || 0)); }
  function buildSec() { return C.DATACENTER.baseSec * Math.pow(C.DATACENTER.secGrowth, state.datacenters || 0) / processSpeed(); }
  function buildActive() { return !!(state.build && state.build.active); }
  function canStartBuild() { return !buildActive() && state.cash >= buildCost(); }
  function startBuild() { if (!canStartBuild()) return false; state.cash -= buildCost(); var d = buildSec(); state.build = { active: true, startedAt: Date.now(), endsAt: Date.now() + d * 1000 }; emit('change'); return true; }
  function buildProgress() { if (!buildActive()) return 0; var b = state.build, tot = b.endsAt - b.startedAt; return tot <= 0 ? 1 : Math.max(0, Math.min(1, (Date.now() - b.startedAt) / tot)); }
  function buildTimeLeft() { return buildActive() ? Math.max(0, (state.build.endsAt - Date.now()) / 1000) : 0; }
  function finishBuild() { if (!buildActive()) return false; state.datacenters++; state.build = { active: false, startedAt: 0, endsAt: 0 }; checkAchievements(); emit('process', { kind: 'build', n: state.datacenters }); emit('change'); return true; }
  // ---- research project process (money + time -> permanent efficiency) ----
  function researchEfficiencyMult() { return 1 + (state.researchLevel || 0) * C.RESEARCH2.computeBonus; }
  function researchProjCost() { return Math.floor(C.RESEARCH2.baseCost * Math.pow(C.RESEARCH2.costGrowth, state.researchLevel || 0)); }
  function researchProjSec() { return C.RESEARCH2.baseSec * Math.pow(C.RESEARCH2.secGrowth, state.researchLevel || 0) / processSpeed(); }
  function researchActive() { return !!(state.research2 && state.research2.active); }
  function canStartResearch() { return !researchActive() && state.cash >= researchProjCost(); }
  function startResearch() { if (!canStartResearch()) return false; state.cash -= researchProjCost(); var d = researchProjSec(); state.research2 = { active: true, startedAt: Date.now(), endsAt: Date.now() + d * 1000 }; emit('change'); return true; }
  function researchProgress() { if (!researchActive()) return 0; var b = state.research2, tot = b.endsAt - b.startedAt; return tot <= 0 ? 1 : Math.max(0, Math.min(1, (Date.now() - b.startedAt) / tot)); }
  function researchTimeLeft() { return researchActive() ? Math.max(0, (state.research2.endsAt - Date.now()) / 1000) : 0; }
  function finishResearch() { if (!researchActive()) return false; state.researchLevel++; state.research2 = { active: false, startedAt: 0, endsAt: 0 }; checkAchievements(); emit('process', { kind: 'research', n: state.researchLevel }); emit('change'); return true; }
  function tapCompute() {
    var v = C.CORE.TAP_COMPUTE * (1 + comboBonus()) * genericMult();
    if (clickFrenzyActive()) v *= state.clickFrenzyMult;
    return v;
  }
  // permanent product-revenue multiplier from shipped model generations + funding rounds
  function genRevenueMult() {
    var m = 1;
    for (var i = 0; i < state.modelGen && i < C.MODELGEN.length; i++) m *= C.MODELGEN[i].revMult;
    for (var f = 0; f < C.FUNDING.length; f++) if (state.funding[C.FUNDING[f].id]) m *= C.FUNDING[f].mult;
    return m;
  }
  // 💵 money produced per second by your deployed product. Scales with your infra
  // (compute rate ≈ users served) × shipped generation × market share. 0 until v1
  // ships (garage = tap-for-cash bootstrap). See GAME-DESIGN.md §3-§4.
  // tamed per-generation revenue ladder (recovery on each ship) — NOT the compounding
  // genRevenueMult used by funding. revGenFactor(g) = REV_GEN_STEP^modelGen.
  function revGenFactor() { return Math.pow(C.CORE.REV_GEN_STEP, state.modelGen); }
  function moneyRate() {
    if (state.modelGen <= 0) return 0;            // no product yet → tap bootstrap only
    var trust = worldUnlocked() ? trustMult() : 1; // reputation moves product revenue (±10%)
    // Phase 2: revenue = product capability (revGenFactor) × adoption (compute^ADOPTION_EXP,
    // sub-linear so burn — linear in compute — outruns it WITHIN a generation) × market share ×
    // trust. The sub-linear compute term makes the burn squeeze recur; the generation ladder +
    // share jumps provide the recovery on each ship. Difficulty's revenueMult is applied in
    // revenuePerSec() (the burn-economy wrapper) so it bites alongside burnMult.
    var adoption = Math.pow(Math.max(0, computeRate()), C.CORE.ADOPTION_EXP) * C.CORE.REV_COMPUTE_COEF;
    return adoption * revGenFactor() * (1 + state.marketShare / 100) * trust;
  }
  // Company worth in the SAME universe as the player's cash: liquid cash + physical
  // compute assets + goodwill from proven lifetime earnings, × a market-dominance premium.
  // Grows impressively but plausibly (~tens× cash), never the old millions× ARR explosion.
  function valuation() {
    var assets = state.cash
      + state.compute * C.CORE.VAL_COMPUTE_ASSET
      + (state.totalEarnedAllTime || 0) * C.CORE.VAL_GOODWILL_MULT;
    return assets * (1 + (state.marketShare || 0) / 100 * C.CORE.VAL_SHARE_PREMIUM);
  }

  // ===================================================================
  // BURN → RUNWAY economy (Phase 2, DESIGN-depth-redesign §1) ----------
  // A continuous MONTHLY operating cost, computed from the player's scale, drained from
  // cash each tick. Weighted like reality: compute(~55%) + salaries(~30%) + electricity
  // (~12%) + datacenter upkeep + overhead, the whole thing × diff('burnMult'). cps() (the
  // compute/sec your infra produces) is the dominant capacity proxy — and because it grows
  // exponentially with generator tiers, burn tightens as you scale. Revenue (moneyRate) is
  // the opposing force; runway = cash / netBurn, in MONTHS, is the headline.
  // ===================================================================
  function diffBurnMult() { var m = diff('burnMult'); return (typeof m === 'number' && isFinite(m) && m > 0) ? m : 1; }
  function diffComputePriceMult() { var m = diff('computePriceMult'); return (typeof m === 'number' && isFinite(m) && m > 0) ? m : 1; }
  // a compute-capacity proxy = compute/sec your generators produce (the same number the
  // valuation/asset universe uses). Exponential in generator tiers ⇒ exponential burn.
  function computeCapacity() { return cps(); }
  // ---- monthly burn breakdown (for the HUD + Stats) ----
  // returns { compute, electricity, salaries, upkeep, overhead, total } — all $/MONTH.
  function burnBreakdown() {
    var B = C.BURN;
    var cap = computeCapacity();
    var cpm = diffComputePriceMult();
    var dm = diffBurnMult();
    var compute     = cap * B.COMPUTE_PER_CPS * cpm;        // ~55% — the monster
    var electricity = cap * B.ELEC_PER_CPS * cpm;           // ~12% — visible but minor
    var salaryPerHead = B.SALARY_PER_RESEARCHER * (1 + (state.modelGen || 0) * B.SALARY_GEN_STEP); // seniority
    var salaries    = (state.researchers || 0) * salaryPerHead;           // ~30%
    var upkeep      = (state.datacenters || 0) * B.DC_UPKEEP;
    var overhead    = B.OVERHEAD_BASE
                    + (state.researchers || 0) * B.OVERHEAD_PER_HEAD
                    + (state.datacenters || 0) * B.OVERHEAD_PER_DC;
    // the whole burn scales with difficulty's burnMult (Easy 0.8 … Impossible 1.5)
    compute *= dm; electricity *= dm; salaries *= dm; upkeep *= dm; overhead *= dm;
    var total = compute + electricity + salaries + upkeep + overhead;
    return { compute: compute, electricity: electricity, salaries: salaries, upkeep: upkeep, overhead: overhead, total: total };
  }
  // total MONTHLY burn (the opposing drain to revenue).
  function monthlyBurn() { return burnBreakdown().total; }
  // MONTHLY product revenue (the existing per-second income, reframed monthly so it sits in
  // the same units as burn). moneyRate already weaves product capability (genRevenueMult) ×
  // marketShare × trust; here we also apply diff('revenueMult') so the difficulty lever bites.
  function diffRevenueMult() { var m = diff('revenueMult'); return (typeof m === 'number' && isFinite(m) && m > 0) ? m : 1; }
  function revenuePerSec() { return moneyRate() * diffRevenueMult(); }
  function monthlyRevenue() { return revenuePerSec() * C.BURN.MONTH_SEC; }
  // per-second cash drain from burn (monthly → per-second).
  function burnPerSec() { return monthlyBurn() / C.BURN.MONTH_SEC; }
  // net cash rate ($/sec): revenue minus burn. >0 ⇒ profitable.
  function netCashRate() { return revenuePerSec() - burnPerSec(); }
  // net MONTHLY burn: burn − revenue. <=0 ⇒ profitable (runway = Infinity).
  function netMonthlyBurn() { return monthlyBurn() - monthlyRevenue(); }
  // RUNWAY in MONTHS = cash / netBurn. Infinity when profitable (netBurn ≤ 0).
  function runwayMonths() {
    var nb = netMonthlyBurn();
    if (nb <= 0) return Infinity;
    return (state.cash || 0) / nb;
  }
  function isProfitable() { return netMonthlyBurn() <= 0; }

  // ---- researchers / talent ----
  function researcherSpeed() { return 1 + Math.min(C.PROCESS.RESEARCHER_SPEED_CAP, state.researchers * C.PROCESS.RESEARCHER_SPEED_PER); }
  function researcherCost() { return Math.floor(C.TALENT.baseCost * Math.pow(C.TALENT.growth, state.researchers)); }
  function talentUnlocked() { return state.modelGen >= C.TALENT.UNLOCK_GEN; }
  function hireResearcher() {
    var c = researcherCost();
    if (state.cash < c) return false;
    state.cash -= c; state.researchers++;
    checkAchievements(); emit('change');
    return true;
  }

  // ---- model generations (forward-only; TIMED training) ----
  function nextGen() { return state.modelGen < C.MODELGEN.length ? C.MODELGEN[state.modelGen] : null; }
  function isAGI() { return state.modelGen >= C.MODELGEN.length; }
  function trainingActive() { return !!(state.training && state.training.active); }
  // real-time duration for the next generation, shortened by researchers + boosts
  function trainDuration() {
    var g = nextGen(); if (!g) return 0;
    return g.trainSec / processSpeed();   // researchers + research perks + boost all shorten it
  }
  function canStartTraining() {
    var g = nextGen();
    return !!g && !trainingActive() && state.compute >= g.computeReq;
  }
  function startTraining() {
    var g = nextGen();
    if (!canStartTraining()) return false;
    state.compute -= g.computeReq;                // spend compute stock to kick off the run
    var dur = trainDuration();
    state.training = { active: true, gen: state.modelGen, startedAt: Date.now(), endsAt: Date.now() + dur * 1000 };
    state.trainToastPct = 0;                       // fresh progress-toast tracker for this run
    // first time a run crosses ~1h (the v4→v5 momentum cliff), surface a one-time teaching
    // beat: long trains are the pacing gate — work in parallel (researchers/datacenters) to
    // shorten them, never just wait.
    if (!state.seenLongTrain && dur >= LONG_TRAIN_SEC) { state.seenLongTrain = true; emit('longtrain', { secs: dur }); }
    emit('change');
    return true;
  }
  function trainingProgress() {
    if (!trainingActive()) return 0;
    var tr = state.training, total = tr.endsAt - tr.startedAt;
    if (total <= 0) return 1;
    return Math.max(0, Math.min(1, (Date.now() - tr.startedAt) / total));
  }
  function trainingTimeLeft() { return trainingActive() ? Math.max(0, (state.training.endsAt - Date.now()) / 1000) : 0; }
  // Subtle 25/50/75% progress pings — ONLY on runs long enough to feel a wait (so the
  // ~1min early generations don't spam). Each milestone fires at most once per run.
  function emitTrainProgress() {
    var tr = state.training, total = (tr.endsAt - tr.startedAt) / 1000;
    if (total < 600) return;   // < 10 min: short enough that progress pings would be noise
    var pct = Math.floor(trainingProgress() * 100);
    var next = state.trainToastPct < 25 ? 25 : state.trainToastPct < 50 ? 50 : state.trainToastPct < 75 ? 75 : 100;
    if (next <= 75 && pct >= next) {
      state.trainToastPct = next;
      emit('trainprogress', { pct: next, left: trainingTimeLeft(), gen: tr.gen + 1 });
    }
  }
  // complete the current training: PERMANENT leap, KEEP all infrastructure (no reset)
  function finishTraining() {
    if (!trainingActive()) return false;
    var g = C.MODELGEN[state.training.gen];
    state.modelGen = state.training.gen + 1;
    state.marketShare = Math.min(100, state.marketShare + (g ? g.share : 0));
    state.training = { active: false, gen: -1, startedAt: 0, endsAt: 0 };
    checkAchievements();
    emitNews('milestone', ['nh_gen_1', 'nh_gen_2'], { name: g ? t_safe(g.id) : '', n: state.modelGen });
    emit('generation', { gen: state.modelGen, id: g ? g.id : null });
    if (state.modelGen >= C.MODELGEN.length) triggerFinale(determineEnding(), true); // AGI — you won
    emit('change');
    return true;
  }

  // ---- funding rounds ----
  function nextFundingRound() {
    for (var i = 0; i < C.FUNDING.length; i++) if (!state.funding[C.FUNDING[i].id]) return C.FUNDING[i];
    return null;
  }
  function canTakeFunding() { var r = nextFundingRound(); return !!r && state.modelGen >= r.genReq; }
  // Phase 2: a round buys RUNWAY. Cash injected = the round's `months` × current MONTHLY BURN
  // (so it adds that many months of runway, scaling with your real costs — DESIGN §1 "+12–24
  // months"), × diff('fundValMult') (Easy 1.2 raises rounds; Impossible 0.7 cuts them — the
  // lever is now consumed). Floored so a barely-bootstrapped lab still gets a usable seed even
  // when its burn is tiny; also kept ≥ a few minutes of revenue (legacy behaviour) so a
  // high-revenue lab isn't shortchanged. `months` lives on each FUNDING entry.
  function fundingPayout(r) {
    if (!r) return 0;
    var months = (typeof r.months === 'number') ? r.months : 12;
    var byBurn = monthlyBurn() * months * (diff('fundValMult') || 1);
    var byRev = moneyRate() * r.secs;        // legacy floor: a few minutes of revenue
    var floor = GEN[0].baseCost * 40;        // ~a handful of starter generators (cold-start)
    return Math.max(byBurn, byRev, floor);
  }
  function takeFunding() {
    var r = nextFundingRound();
    if (!r || state.modelGen < r.genReq) return false;
    state.funding[r.id] = true;
    addCash(fundingPayout(r));
    checkAchievements();
    emitNews('milestone', ['nh_fund_1', 'nh_fund_2'], { round: t_safe('fund_' + r.id) });
    emit('funding', { id: r.id });
    emit('change');
    return true;
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
  // output a SINGLE unit produces right now (current milestone tier + all bonuses + global)
  function genPerUnitOutput(id) {
    var g = GENBYID[id];
    var count = state.gens[id] || 0;
    var classM = 1, cl = GEN_OF_CLASS[id];
    if (cl) classM *= techMult('gen_' + cl);
    if (cl === 'high') classM *= artifactMult('genHighMult');
    return g.baseOut * milestoneMult(count) * perGenUpgradeMult(id) * managerMult(id) * classM * globalMult();
  }
  // everything the buy card needs for the SELECTED mode: count, cost, per-unit & marginal /sec
  function genBuyPreview(id) {
    var maxAff = genMaxAffordable(id);
    var qty = buyQty(id);
    var cost = genCostCumulative(id, qty);
    // marginal cps added by buying qty (accounts for milestone crossings within the batch)
    var before = genOutput(id);
    var saved = state.gens[id];
    state.gens[id] += qty;
    var after = genOutput(id);
    state.gens[id] = saved;
    return {
      qty: qty,
      cost: cost,
      addCps: (after - before) * globalMult(),
      perUnit: genPerUnitOutput(id),
      affordable: state.cash >= cost && qty >= 1,
      maxAffordable: maxAff
    };
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
    state.compute += tapCompute();   // GDD v3: a tap also generates compute (the bottleneck)
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

  // (Autopilot was removed in Phase 1 — the game is built around ACTIVE decisions, not
  //  automation. Old saves with a `state.autopilot` field load fine; it is simply dropped.)

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
  // start-cash boost = a % of your best run's total earnings (scales forever).
  function startCashBoost() { return Math.floor(state.bestRunEarned * puValue('startCashPct', 0)); }
  function keepGenFrac() { return puValue('keepGens', 0); }

  function resetRun(clearTechAndRp) {
    // Structural carry-over (model release only): keep a fraction of each generator level.
    var keep = clearTechAndRp ? 0 : keepGenFrac();
    C.GENERATORS.forEach(function (g) { state.gens[g.id] = keep > 0 ? Math.floor(state.gens[g.id] * keep) : 0; });
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
    // scaling start-cash boost (model release only; the deep Singularity reset starts dry)
    state.cash = clearTechAndRp ? 0 : startCashBoost();
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
    // GDD v3: NO MORE RESETS. Progress is forward-only via model generations.
    // This legacy path is permanently disabled (kept as a guarded no-op so any
    // stale UI reference can never reset a returning player).
    return false;
    /* eslint-disable no-unreachable */
    if (!canPrestige()) return false;
    var gain = prestigeGain();
    var cleanRun = state.incidentsThisRun === 0;
    state.rp += gain;
    state.totalRP += gain;
    state.prestiges++;
    state._lastRunClean = cleanRun;
    state.bestRunEarned = Math.max(state.bestRunEarned || 0, state.totalEarnedThisRun); // for % start-cash
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
    seedRivals(state.difficulty || C.DIFFICULTY.DEFAULT); // fresh rival field for the new race
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
  // Speed up any IN-PROGRESS timer when a boost starts, so the player SEES the bars
  // surge (timers lock endsAt at start, so without this a mid-run boost would feel inert).
  // Bounded by the boost window: work done at N× over B wall-clock = B×N, saving the rest.
  function reaccelTimers(boostWindowMs) {
    var now = Date.now(), N = C.ADS.BOOST_MULT;
    [state.training, state.build, state.research2].forEach(function (tm) {
      if (!tm || !tm.active) return;
      var R = tm.endsAt - now; if (R <= 0) return;
      var newR = (boostWindowMs * N >= R) ? R / N : R - boostWindowMs * (N - 1);
      tm.endsAt = now + Math.max(0, newR);
    });
  }
  function applyBoost() {
    var base = boostActive() ? state.boostUntil : Date.now();
    state.boostUntil = base + C.ADS.BOOST_DURATION * 1000;
    reaccelTimers(C.ADS.BOOST_DURATION * 1000);   // make the active timers visibly jump
    emit('toast', { key: 'ad_boost_started' });
    emit('change');
  }

  // ---- GDD v3 retention: earned-boost economy + daily login ----
  // A boost speeds ALL timers (×BOOST_MULT via processSpeed/transientMult). Boosts
  // are EARNED (~80%): daily login, achievements, returning after idle.
  function grantBoostToken(n) { state.boostTokens = (state.boostTokens || 0) + (n || 1); emit('change'); }
  function activateBoostToken() {
    if ((state.boostTokens || 0) < 1 || boostActive()) return false;
    state.boostTokens--; applyBoost();
    return true;
  }
  function dayIndex() { return Math.floor(Date.now() / 86400000); }
  function dailyAvailable() { return dayIndex() > (state.lastDailyDay || 0); }
  function claimDaily() {
    if (!dailyAvailable()) return null;
    var today = dayIndex(), gap = today - (state.lastDailyDay || 0);
    if (state.lastDailyDay === 0) state.dailyStreak = 1;
    else if (gap === 1) state.dailyStreak = (state.dailyStreak || 0) + 1;
    else if (gap === 2) state.dailyStreak = (state.dailyStreak || 1);   // forgiving: 1 missed day doesn't break it
    else state.dailyStreak = 1;
    state.lastDailyDay = today;
    var tokens = 1 + Math.min(3, Math.floor((state.dailyStreak - 1) / 2)); // streak gives up to +3 bonus tokens
    grantBoostToken(tokens);
    var cash = windfallCash(C.ADS.CASH_BURST_SECONDS, C.WINDFALL.CAP_FRAC, 50);
    addCash(cash);
    emit('change');
    return { tokens: tokens, cash: cash, streak: state.dailyStreak };
  }
  function addCashBurst() {
    var v = windfallCash(C.ADS.CASH_BURST_SECONDS, C.WINDFALL.CAP_FRAC, 50);
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
  // ===== Progressive unlock schedule (one deliberate system) ============
  // All gates are monotonic on lifetime metrics, so once revealed a feature never
  // re-hides (even across a model release). See config UNLOCKS + BALANCE.md.
  function anyUpgradeOwned() { for (var k in state.upgrades) if (state.upgrades[k]) return true; return false; }
  var U = C.UNLOCKS;
  function buyModesUnlocked()    { return state.prestiges > 0 || state.totalEarnedAllTime >= U.BUYMODES_EARNED; }
  function upgradesUnlocked()    { return state.prestiges > 0 || anyUpgradeOwned() || state.totalEarnedAllTime >= U.UPGRADES_EARNED; }
  function insightUnlocked()     { return state.prestiges > 0 || state.insightsClaimed > 0 || state.totalEarnedAllTime >= U.INSIGHT_EARNED; }
  function breakthroughUnlocked(){ return state.prestiges > 0 || state.breakthroughsUsed > 0 || state.totalEarnedAllTime >= U.BREAKTHROUGH_EARNED; }
  function managersUnlocked()    { return state.prestiges > 0 || state.totalEarnedAllTime >= U.MANAGERS_EARNED; }
  function researchUnlocked()    { return state.modelGen >= C.TALENT.UNLOCK_GEN || state.prestiges >= 1 || state.singularities > 0; } // GDD v3: Team(hiring) opens @v2
  function riskUnlocked()        { return state.modelGen >= 3 || state.prestiges >= 1 || state.singularities > 0; } // safety enters mid-game (v3+)
  function statsUnlocked()       { return upgradesUnlocked(); }
  function awardsUnlocked()      { return achCount() > 0; }
  // first-release CTA: only nag once it's clearly worth it (juicy, in-window)
  function firstPrestigeReady()  { return false; } // GDD v3: no prestige reset — forward-only generations
  // Loud projection for the release screen: gain + permanent % + how much faster next run is.
  function prestigeProjection() {
    var gain = prestigeGain();
    var rpAfter = state.rp + gain;
    var multNow = 1 + state.rp * C.PRESTIGE.BONUS;
    var multAfter = 1 + rpAfter * C.PRESTIGE.BONUS;
    return {
      gain: gain, rpAfter: rpAfter,
      pctNow: Math.round((multNow - 1) * 100),
      pctAfter: Math.round((multAfter - 1) * 100),
      pctGain: Math.round((multAfter - multNow) * 100),
      speedup: multAfter / multNow            // passive-only speedup of the next run
    };
  }

  // ===== R7 World: Trust, cards (crises + news), market, gating =====
  // Stage 6 "Industry": opens a bit AFTER the first release (risk comes first).
  function worldUnlocked() { return state.modelGen >= 1 || state.prestiges >= 2 || state.totalRP >= C.UNLOCKS.WORLD_RP || state.singularities > 0; } // GDD v3: the Race view opens once you ship v1
  function crisisCooldown() { return Math.max(C.RISK.CRISIS_CD_MIN, C.RISK.CRISIS_CD_BASE - state.prestiges * 3 - state.singularities * 10); }
  function crisisCdLeft() { return Math.max(0, (state.lastCrisisAt + crisisCooldown() * 1000 - Date.now()) / 1000); }
  function trustMult() { return C.TRUST.OUTPUT_LO + (C.TRUST.OUTPUT_HI - C.TRUST.OUTPUT_LO) * ((state.trust || 0) / 100); }
  function marketUnlocked() { return worldUnlocked(); }
  function clampTrust(v) { return Math.max(C.TRUST.MIN, Math.min(C.TRUST.MAX, v)); }
  function hasCrisisCard() { for (var i = 0; i < state.cards.length; i++) if (state.cards[i].kind === 'crisis') return true; return false; }
  var _uid = 1;

  // applyEffect — the shared vocabulary for crisis/news card choices AND (Phase 1
  // groundwork) the decision engine. The original keys below are UNCHANGED; the new
  // keys are purely additive so existing content keeps working byte-for-byte.
  // parse an effect delta that may be a number (4, -200) OR a schema string ("+4","-200","6").
  // returns undefined when absent/unparseable so callers can skip cleanly.
  function numDelta(v) {
    if (typeof v === 'number') return isFinite(v) ? v : undefined;
    if (typeof v === 'string') { var n = parseFloat(v); return isFinite(n) ? n : undefined; }
    return undefined;
  }
  // HOOK (difficulty): event-severity multiplier. Scales only the HARMFUL direction of a
  // delta (more risk / lost cash / lost trust) — beneficial outcomes are never amplified or
  // dampened. `bad` = which sign counts as harm (+1: positive is bad, e.g. risk; -1: negative
  // is bad, e.g. losing cash). Returns the (possibly) scaled delta.
  function evSev() { var m = diff('eventSeverityMult'); return (typeof m === 'number' && isFinite(m) && m > 0) ? m : 1; }
  function scaleHarm(delta, badSign) {
    if (typeof delta !== 'number' || !isFinite(delta) || delta === 0) return delta;
    var m = evSev();
    if (m === 1) return delta;
    if (badSign > 0 ? delta > 0 : delta < 0) return delta * m;   // only the harmful direction
    return delta;
  }
  function applyEffect(eff) {
    if (!eff) return;
    // ---- existing card-effect keys (unchanged) ----
    if (eff.cashFrac) state.cash = Math.max(0, state.cash + state.cash * scaleHarm(eff.cashFrac, -1));
    if (eff.cashGift) addCash(windfallCash(eff.cashGift, C.CARDS.CASHGIFT_CAP_FRAC, 100));
    if (eff.trust) state.trust = clampTrust(state.trust + scaleHarm(eff.trust, -1));
    if (eff.vec) for (var k in eff.vec) state.vec[k] = Math.max(0, Math.min(C.RISK.MAX, state.vec[k] + scaleHarm(eff.vec[k], +1)));
    if (eff.penaltySec) state.incidentEndsAt = Date.now() + eff.penaltySec * 1000;
    if (eff.allMult) state.cardAllMult = (state.cardAllMult || 1) * eff.allMult;

    // ---- decision-engine vocabulary (Phase 1 groundwork; additive) ----
    // resource: flat deltas. cash clamps at 0 unless allowDebt; compute/researchers clamp at 0.
    if (eff.resource) {
      var r = eff.resource;
      var dCash = numDelta(r.cash);
      if (dCash !== undefined) {
        dCash = scaleHarm(dCash, -1);                                 // HOOK: losses scale with severity
        var nc = state.cash + dCash;
        if (dCash > 0) addCash(dCash);                                // earnings count toward totals
        else state.cash = (eff.allowDebt || r.allowDebt) ? nc : Math.max(0, nc);
      }
      var dCompute = numDelta(r.compute); if (dCompute !== undefined) state.compute = Math.max(0, state.compute + dCompute);
      var dRes = numDelta(r.researchers); if (dRes !== undefined) state.researchers = Math.max(0, Math.floor(state.researchers + dRes));
    }
    // meter: clamped deltas to derived scoreboards. marketShare/trust 0..100; align via state.align.
    if (eff.meter) {
      var m = eff.meter;
      var dShare = numDelta(m.marketShare); if (dShare !== undefined) state.marketShare = Math.max(0, Math.min(100, state.marketShare + scaleHarm(dShare, -1)));
      var dTrust = numDelta(m.trust); if (dTrust !== undefined) state.trust = clampTrust(state.trust + scaleHarm(dTrust, -1));
      var dAlign = numDelta(m.align); if (dAlign !== undefined) state.align = Math.max(0, state.align + dAlign);
      // valuation is a DERIVED figure (no stored field) — record the adjustment as an
      // accumulator now; later phases may fold it into valuation().
      var dVal = numDelta(m.valuation); if (dVal !== undefined) state.vars.valuation_adj = (state.vars.valuation_adj || 0) + dVal;
    }
    // flags: boolean store
    if (eff.set_flag) state.flags[eff.set_flag] = true;
    if (eff.clr_flag) delete state.flags[eff.clr_flag];
    // vars: numeric accumulators (accept number or schema string delta)
    if (eff.set_var) for (var vk in eff.set_var) { var dv = numDelta(eff.set_var[vk]); if (dv !== undefined) state.vars[vk] = (state.vars[vk] || 0) + dv; }
    // schedule: queue a future event. delay_days (1 day = 1 in-game day) or delaySec.
    if (eff.schedule) {
      var sc = eff.schedule;
      var delaySec = (typeof sc.delaySec === 'number') ? sc.delaySec
                   : (typeof sc.delay_days === 'number') ? sc.delay_days * C.DAY_SEC : 0;
      // `callback` (optional) is an i18n key for the "they remembered" toast shown when
      // the delayed consequence comes due, referencing the original choice (Sub-part E).
      state.scheduled.push({ event: sc.event, fireAt: Date.now() + delaySec * 1000, chance: (typeof sc.chance === 'number') ? sc.chance : 1, callbackKey: sc.callback });
    }
    // rival_effect: nudge rival AGI progress / share. { all: {...} } hits the live roster.
    // A specific {id:{...}} resolves to a rival only if that id is in the current random
    // roster; 'leader'/'top' targets the AGI front-runner; otherwise it's skipped safely.
    if (eff.rival_effect) {
      ensureRivals();
      for (var rid in eff.rival_effect) {
        var d = eff.rival_effect[rid] || {};
        var targets;
        if (rid === 'all') targets = activeRivals();
        else if (rid === 'leader' || rid === 'top') { var lr = leadingRival(); var lrr = lr.id ? rivalById(lr.id) : null; targets = lrr ? [lrr] : []; }
        else { var one = rivalById(rid); targets = (one && !one.acquired) ? [one] : []; }
        targets.forEach(function (r) {
          if (typeof d.agi === 'number') r.agi = Math.max(0, Math.min(100, (r.agi || 0) + d.agi));
          if (typeof d.share === 'number') r.share = Math.max(0, Math.min(C.RIVAL_SHARE_CAP, (r.share || 0) + d.share));
        });
      }
    }
    // buff: timed multiplier stored + expired in tick. days|sec window.
    if (eff.buff) {
      var b = eff.buff;
      var sec = (typeof b.sec === 'number') ? b.sec : (typeof b.days === 'number') ? b.days * C.DAY_SEC : 0;
      if (b.key && sec > 0) state.buffs.push({ key: b.key, mult: (typeof b.mult === 'number') ? b.mult : 1, endsAt: Date.now() + sec * 1000 });
    }
  }
  // active product of all timed decision buffs (used where output is computed; minimal for now)
  function decisionBuffMult() {
    var now = Date.now(), m = 1;
    for (var i = 0; i < state.buffs.length; i++) if (state.buffs[i].endsAt > now) m *= (state.buffs[i].mult || 1);
    return m;
  }

  // ===== DECISION ENGINE — Phase 2 =====================================
  // Sub-part A: the trigger-DSL evaluator. Events are DATA; their `trigger`/option
  // `trigger` is a tiny declarative condition tree read by evalCond(). It maps the
  // schema's logical metric names (meter.* / resource.*) to the REAL state fields.

  // resolve a metric/resource path to a live numeric value, or undefined if unknown.
  function decisionMetric(path) {
    switch (path) {
      // meters (derived scoreboards)
      case 'meter.marketShare': return state.marketShare || 0;
      case 'meter.valuation':   return valuation();
      case 'meter.trust':       return state.trust || 0;
      case 'meter.align':       return state.align || 0;
      case 'meter.risk':        return highestVector().val;       // aggregate risk = worst vector
      case 'meter.act':         return currentAct();
      // raw risk vectors (so events can gate on a specific pressure)
      case 'meter.vec.cap':     return state.vec ? (state.vec.cap || 0) : 0;
      case 'meter.vec.data':    return state.vec ? (state.vec.data || 0) : 0;
      case 'meter.vec.reg':     return state.vec ? (state.vec.reg || 0) : 0;
      case 'meter.vec.sec':     return state.vec ? (state.vec.sec || 0) : 0;
      // resources (stocks)
      case 'resource.cash':        return state.cash || 0;
      case 'resource.compute':     return state.compute || 0;
      case 'resource.researchers': return state.researchers || 0;
      case 'resource.modelGen':    return state.modelGen || 0;
      default: return undefined;
    }
  }
  // numeric comparison given an operator-string like ">=40" / "==2" / "!=0".
  function cmpOp(actual, expr) {
    if (typeof actual !== 'number' || !isFinite(actual)) return false;
    var m = /^\s*(>=|<=|==|!=|>|<)?\s*(-?\d+(?:\.\d+)?)\s*$/.exec(String(expr));
    if (!m) return false;
    var op = m[1] || '==', rhs = parseFloat(m[2]);
    switch (op) {
      case '>=': return actual >= rhs;
      case '<=': return actual <= rhs;
      case '>':  return actual > rhs;
      case '<':  return actual < rhs;
      case '==': return actual === rhs;
      case '!=': return actual !== rhs;
      default:   return false;
    }
  }
  // evalCond(cond, st) — recursively evaluate a trigger tree. `st` defaults to live state.
  // Leaves: {"meter.risk":">=40"}, {"resource.compute":">=500"}, {"flag":"x"},
  //         {"var.y":">=2"}, {"act_in":[1,2]}. Combinators: AND / OR / NOT.
  // An empty/undefined condition is treated as always-true (no gate).
  function evalCond(cond, st) {
    st = st || state;
    if (cond === undefined || cond === null) return true;
    if (typeof cond !== 'object') return !!cond;
    var keys = Object.keys(cond);
    if (!keys.length) return true;
    // combinators take precedence and are evaluated as a unit
    if ('AND' in cond) { var a = cond.AND || []; for (var i = 0; i < a.length; i++) if (!evalCond(a[i], st)) return false; return true; }
    if ('OR' in cond)  { var o = cond.OR || [];  for (var j = 0; j < o.length; j++) if (evalCond(o[j], st)) return true; return o.length === 0; }
    if ('NOT' in cond) { return !evalCond(cond.NOT, st); }
    // a leaf object may carry several conditions — ALL must hold (implicit AND)
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k], val = cond[key];
      if (key === 'flag') { if (!(st.flags && st.flags[val])) return false; continue; }
      if (key === 'act_in') { var arr = Array.isArray(val) ? val : [val]; if (arr.indexOf(currentAct()) < 0) return false; continue; }
      if (key.indexOf('var.') === 0) { var vv = (st.vars && st.vars[key.slice(4)]) || 0; if (!cmpOp(vv, val)) return false; continue; }
      if (key.indexOf('meter.') === 0 || key.indexOf('resource.') === 0) {
        var mv = decisionMetric(key);
        if (mv === undefined || !cmpOp(mv, val)) return false;
        continue;
      }
      return false; // unknown leaf key → fail closed (never silently pass a bad gate)
    }
    return true;
  }

  // Lightweight self-test (Sub-part A). Runs once on load in non-production; the
  // results are surfaced via window.GAME._evalCondTest() so the build can verify
  // the DSL without a test runner. Pure (no side effects on real state).
  function _evalCondTest() {
    var st = { flags: { sued: true }, vars: { legal_debt: 2 }, cash: 600, compute: 500, marketShare: 40, trust: 80, align: 1, vec: { cap: 70, data: 0, reg: 10, sec: 0 } };
    // patch decisionMetric/currentAct to read `st` via a temporary swap of `state`
    var saved = state; state = st;
    var pass = 0, fail = 0, log = [];
    function ok(name, got, want) { if (got === want) pass++; else { fail++; log.push(name + ' got=' + got + ' want=' + want); } }
    try {
      ok('meter.compute>=500', evalCond({ 'resource.compute': '>=500' }), true);
      ok('meter.compute>500', evalCond({ 'resource.compute': '>500' }), false);
      ok('meter.risk>=40 (worst vec=70)', evalCond({ 'meter.risk': '>=40' }), true);
      ok('flag present', evalCond({ flag: 'sued' }), true);
      ok('flag absent', evalCond({ flag: 'nope' }), false);
      ok('var>=2', evalCond({ 'var.legal_debt': '>=2' }), true);
      ok('var==3', evalCond({ 'var.legal_debt': '==3' }), false);
      ok('var!=0', evalCond({ 'var.legal_debt': '!=0' }), true);
      ok('AND true', evalCond({ AND: [{ 'resource.cash': '>=500' }, { 'meter.trust': '>=50' }] }), true);
      ok('AND false', evalCond({ AND: [{ 'resource.cash': '>=500' }, { 'meter.trust': '>=99' }] }), false);
      ok('OR true', evalCond({ OR: [{ 'meter.trust': '>=99' }, { flag: 'sued' }] }), true);
      ok('OR false', evalCond({ OR: [{ 'meter.trust': '>=99' }, { flag: 'nope' }] }), false);
      ok('NOT flag', evalCond({ NOT: { flag: 'sued' } }), false);
      ok('NOT(AND)', evalCond({ NOT: { AND: [{ flag: 'sued' }, { 'meter.trust': '>=99' }] } }), true);
      ok('empty cond = true', evalCond({}), true);
      ok('undefined cond = true', evalCond(undefined), true);
      ok('multi-leaf implicit AND', evalCond({ 'resource.cash': '>=500', 'meter.trust': '>=50' }), true);
      ok('unknown key fails', evalCond({ 'meter.bogus': '>=1' }), false);
    } finally { state = saved; }
    return { pass: pass, fail: fail, log: log };
  }

  // ----- Sub-part C: the pacing engine (a real-time decision lottery) -----
  function decisionById(id) {
    var D = C.DECISIONS || [];
    for (var i = 0; i < D.length; i++) if (D[i].id === id) return D[i];
    return null;
  }
  // effective weight = base × Π(matching weight_mods)
  function decisionWeight(ev) {
    var w = ev.weight || 0;
    if (ev.weight_mods) for (var i = 0; i < ev.weight_mods.length; i++) {
      var wm = ev.weight_mods[i];
      if (evalCond(wm.when)) w *= (typeof wm.factor === 'number' ? wm.factor : 1);
    }
    return w;
  }
  function decNoRepeatMs() { return (C.DECISIONS_PACING.NO_REPEAT_SEC || C.DAY_SEC) * 1000; }
  // is an event currently eligible to roll in the ambient pool?
  function decisionEligible(ev, now) {
    if (!ev || ev.priority === 'scheduled' || ev.weight <= 0) return false;  // scheduled-only / zero-weight never roll
    if (ev.once && state.eventsFired[ev.id]) return false;
    if (ev.act && ev.act.indexOf(currentAct()) < 0) return false;
    var last = state.eventCooldowns[ev.id] || 0;
    if (now - last < Math.max((ev.cooldown_sec || 0) * 1000, decNoRepeatMs())) return false; // per-event cooldown + no-repeat floor
    var catLast = state.categoryCooldowns[ev.category] || 0;
    if (now - catLast < (C.DECISIONS_PACING.CATEGORY_COOLDOWN || 0) * 1000) return false;     // anti-cluster
    if (!evalCond(ev.trigger)) return false;
    return true;
  }
  // weighted shuffle-bag draw across the eligible pool. The "bag" prevents the same
  // event clustering: once drawn an event is recorded in eventCooldowns (its re-fire
  // floor), so the weighted lottery naturally rotates without immediate repeats.
  function drawDecision(now) {
    var pool = (C.DECISIONS || []).filter(function (ev) { return decisionEligible(ev, now); });
    if (!pool.length) return null;
    var total = 0, weights = pool.map(function (ev) { var w = decisionWeight(ev); total += w; return w; });
    if (total <= 0) return null;
    var roll = Math.random() * total, acc = 0;
    for (var i = 0; i < pool.length; i++) { acc += weights[i]; if (roll <= acc) return pool[i]; }
    return pool[pool.length - 1];
  }
  // has ANY decision fired yet this save? (the eventCooldowns map records every fire)
  function anyDecisionFired() { for (var k in state.eventCooldowns) return true; return false; }
  // Act-scaled interval: later acts shorten the gap (busier endgame). The very FIRST
  // decision uses a short onboarding window so a fresh game surfaces one in ~60–90s.
  function decisionInterval() {
    var P = C.DECISIONS_PACING;
    if (!anyDecisionFired() && typeof P.FIRST_INTERVAL_MIN === 'number') {
      return P.FIRST_INTERVAL_MIN + Math.random() * ((P.FIRST_INTERVAL_MAX || P.FIRST_INTERVAL_MIN) - P.FIRST_INTERVAL_MIN);
    }
    var base = P.INTERVAL_MIN + Math.random() * (P.INTERVAL_MAX - P.INTERVAL_MIN);
    var speed = Math.max(0.4, 1 - currentAct() * (P.ACT_SPEEDUP || 0));   // never below 40% of base
    return Math.max(P.QUIET_FLOOR, base * speed);
  }
  // The pacer: rolls on its own cadence, draws one event, fires it by priority.
  // Wired into tick(). Returns true if a decision fired (for tests).
  function updateDecisions(now) {
    if (!C.DECISIONS || !C.DECISIONS.length) return false;
    now = now || Date.now();
    if (state.playtime < (C.DECISIONS_PACING.FIRST_DELAY || 0)) return false;
    if (!state.nextDecisionAt) { state.nextDecisionAt = now + decisionInterval() * 1000; return false; }
    if (now < state.nextDecisionAt) return false;
    state.nextDecisionAt = now + decisionInterval() * 1000;   // reschedule regardless (quiet rolls still pace)
    var ev = drawDecision(now);
    if (!ev) return false;                                     // empty pool → quiet beat
    fireDecision(ev, now);
    return true;
  }
  // Record a fire (cooldowns + once-flag), then surface by priority (Sub-part D).
  function fireDecision(ev, now) {
    now = now || Date.now();
    state.eventCooldowns[ev.id] = now;
    state.categoryCooldowns[ev.category] = now;
    if (ev.once) state.eventsFired[ev.id] = true;
    surfaceDecision(ev, now);
  }
  // Sub-part D: three priorities / surfacing.
  function surfaceDecision(ev, now, opts) {
    now = now || Date.now();
    opts = opts || {};
    if (ev.priority === 'ambient') {
      // auto-apply a small default effect; news ticker line only.
      var optA = pickDefaultOption(ev);
      if (optA) applyEffect(optA.effects);
      decisionNews(ev, optA ? optA.id : null);
      emit('decision', { kind: 'ambient', id: ev.id });
      checkAchievements(); emit('change');
      return;
    }
    if (ev.priority === 'bankable') {
      var autoMs = (C.DECISIONS_PACING.BANKABLE_AUTO_SEC || 240) * 1000;
      state.inbox.push({ uid: _uid++, id: ev.id, addedAt: now, autoAt: now + autoMs });
      emit('decision', { kind: 'bankable', id: ev.id });
      emit('change');
      return;
    }
    // interrupt (and scheduled callbacks): pop a modal immediately.
    emit('decision', { kind: 'interrupt', id: ev.id, callback: !!opts.callback, callbackKey: opts.callbackKey });
  }
  // default option = explicit default_option, else first option (least-risky by convention).
  function pickDefaultOption(ev) {
    if (!ev || !ev.options || !ev.options.length) return null;
    if (ev.default_option) for (var i = 0; i < ev.options.length; i++) if (ev.options[i].id === ev.default_option) return ev.options[i];
    return ev.options[0];
  }
  // resolve a decision option (interrupt modal click / inbox click / auto-resolve).
  // Reuses applyEffect. uid (when given) removes the matching inbox entry.
  function resolveDecision(eventId, optionId, uid) {
    var ev = decisionById(eventId); if (!ev) return false;
    var opt = null; for (var i = 0; i < ev.options.length; i++) if (ev.options[i].id === optionId) opt = ev.options[i];
    if (!opt) return false;
    applyEffect(opt.effects);
    if (uid != null) removeInbox(uid);
    decisionNews(ev, optionId);
    checkAchievements(); emit('change');
    return true;
  }
  // PART A — a resolved decision (by player, inbox, or auto) yields a news headline.
  // Prefer a per-outcome line ({id}_{opt}_news), else the decision title.
  function decisionNews(ev, optionId) {
    if (!ev) return;
    var keys = [];
    if (optionId) keys.push(ev.id + '_' + optionId + '_news');
    keys.push(ev.id + '_t');
    // dedupe to the first that actually resolves to a string
    for (var i = 0; i < keys.length; i++) {
      var s = t_safe(keys[i], coVars());
      if (s && s !== keys[i]) { pushNews(s, 'decision'); return; }
    }
  }
  function removeInbox(uid) {
    for (var i = state.inbox.length - 1; i >= 0; i--) if (state.inbox[i].uid === uid) { state.inbox.splice(i, 1); return true; }
    return false;
  }
  // auto-resolve overdue inbox items with their default option (Sub-part D soft timer).
  function updateInbox(now) {
    if (!state.inbox || !state.inbox.length) return;
    now = now || Date.now();
    for (var i = state.inbox.length - 1; i >= 0; i--) {
      var it = state.inbox[i];
      if (it.autoAt && now >= it.autoAt) {
        var ev = decisionById(it.id), opt = pickDefaultOption(ev);
        state.inbox.splice(i, 1);
        if (ev && opt) { applyEffect(opt.effects); decisionNews(ev, opt.id); emit('decision', { kind: 'auto', id: it.id, option: opt.id }); }
      }
    }
    checkAchievements();
  }
  // small helpers for surfacing
  function t_safe(key, vars) { try { return window.GAME_I18N.t(key, vars); } catch (e) { return key; } }
  // company-name token: every headline can carry {co}. Resolve it here so callers
  // (and i18n strings) never have to thread the name through manually.
  function coVars(extra) {
    var v = { co: state.companyName || t_safe('game_title') };
    if (extra) for (var k in extra) v[k] = extra[k];
    return v;
  }
  // Pick a localized headline from a list of candidate keys (round-robins via a tiny
  // rolling index so repeated event-types don't always read the same line).
  var _newsRot = {};
  function headlineKey(keys) {
    if (!keys || !keys.length) return null;
    if (keys.length === 1) return keys[0];
    var bucket = keys.join(',');
    var i = (_newsRot[bucket] = ((_newsRot[bucket] || 0) + 1)) % keys.length;
    return keys[i];
  }
  // PART A — LIVING NEWS: push a localized headline onto the feed for a REAL event.
  // `type` drives the per-headline icon in the news-feed UI; `keys` is one i18n key or
  // an array to round-robin; `vars` are extra tokens (rival name, model name, …).
  function emitNews(type, keys, vars) {
    var key = headlineKey(Array.isArray(keys) ? keys : [keys]);
    if (!key) return;
    pushNews(t_safe(key, coVars(vars)), type);
  }
  function pushNews(line, type) {
    if (!line) return;
    state.newsLog = state.newsLog || [];
    state.newsLog.unshift({ line: line, type: type || 'flavor', at: Date.now() });
    if (state.newsLog.length > 20) state.newsLog.pop();
    emit('newsline', { line: line, type: type || 'flavor' });
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
    // Stage 5: crises are decision cards as soon as risk exists. (The simple-incident
    // fallback remains only as a safety net if ever called before risk is unlocked.)
    if (riskUnlocked()) { if (!hasCrisisCard()) spawnCrisisCard(vector); }
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
  // GDD v3: acts track your model-generation stage (garage→startup→frontier→race→AGI)
  function currentAct() {
    if ((state.gameOver && state.won) || state.modelGen >= 9) return 4; // AGI / endgame
    if (state.modelGen >= 6) return 3;   // race to AGI
    if (state.modelGen >= 3) return 2;   // frontier lab
    if (state.modelGen >= 1) return 1;   // startup — only AFTER shipping v1 (not on first hardware buy)
    return 0;                            // garage: tap → buy hardware → work toward v1
  }
  function rivalsRevealed() { return currentAct() >= C.RACE.REVEAL_ACT; }
  // legacy no-ops kept as guards: rival progress now lives on state.rivals objects. If a
  // save somehow loaded without a roster (corruption), seed a default one so nothing crashes.
  function ensureRivals() { if (!Array.isArray(state.rivals) || !state.rivals.length) seedRivals(state.difficulty || C.DIFFICULTY.DEFAULT); }
  function ensureRivalShare() { ensureRivals(); }
  // GDD v3: AGI progress = how far up the model-generation ladder you are.
  function agiProgress() { return Math.max(0, Math.min(100, 100 * state.modelGen / C.MODELGEN.length)); }
  // ---- rival market-share race (the central scoreboard) ----
  function rivalsActive() { return state.modelGen >= 1; } // race begins once you have a product
  function updateRivals(dt) {
    if (!rivalsActive()) return;
    ensureRivals();
    var agiMult = diff('rivalAGIspeedMult');   // HOOK: difficulty scales rival AGI creep
    if (typeof agiMult !== 'number' || !isFinite(agiMult)) agiMult = 1;
    activeRivals().forEach(function (r) {
      // share creeps up, tapering toward the cap (so you can always overtake by shipping)
      var cur = isFinite(r.share) ? r.share : 0;
      var room = Math.max(0, (C.RIVAL_SHARE_CAP - cur) / C.RIVAL_SHARE_CAP);
      r.share = Math.min(C.RIVAL_SHARE_CAP, cur + r.shareRate * room * dt);
      // AGI progress climbs on each rival's own timeline (the deadline / pressure)
      var before = r.agi || 0;
      var after = Math.min(100, before + r.agiRate * agiMult * dt);
      r.agi = after;
      // late-game drama: fire a toast as a rival crosses 50/75/90% AGI (they're catching up).
      // Only once you can see the race (rivals revealed) and once per threshold per rival.
      if (rivalsRevealed()) {
        var last = r.agiToasted || 0;
        var ms = after >= 90 ? 90 : after >= 75 ? 75 : after >= 50 ? 50 : 0;
        if (ms > last) {
          r.agiToasted = ms;
          emitNews('rival', ms >= 90 ? ['nh_rival_agi90'] : ['nh_rival_agi', 'nh_rival_agi2'], { name: rivalName(r.id), pct: ms });
          emit('rivalagi', { id: r.id, pct: ms });
        }
      }
    });
  }
  // standings: you + rivals, sorted by market share desc (for the race panel)
  function finiteNum(v) { v = +v; return isFinite(v) ? v : 0; }   // NaN/undefined/string -> 0
  function standings() {
    ensureRivals();
    // Coerce EVERY share to a finite number before sorting. A NaN share (which passes
    // typeof==='number') would make the comparator return NaN and Array.sort leave the
    // array in insertion order — rivals would then display mis-ranked. (BUG 3 root cause.)
    // The player row carries `name` = companyName (item 2: standings by company name).
    var rows = [{ id: 'you', name: state.companyName || t_safe('game_title'), share: finiteNum(state.marketShare), agi: agiProgress(), you: true }];
    activeRivals().forEach(function (r) { rows.push({ id: r.id, name: rivalName(r.id), share: finiteNum(r.share), agi: r.agi || 0 }); });
    rows.sort(function (a, b) { return b.share - a.share; });
    return rows;
  }
  function playerRank() { var rows = standings(); for (var i = 0; i < rows.length; i++) if (rows[i].you) return i + 1; return rows.length; }
  function isMarketLeader() { return playerRank() === 1; }
  function leadingRivalAgi() { var m = 0; activeRivals().forEach(function (r) { m = Math.max(m, r.agi || 0); }); return m; }
  // Topbar race-status badge (item 3): show '#1' when you lead the market AND no rival is
  // closing in; otherwise surface the most threatening rival's AGI %. Null = nothing to show
  // yet (race not revealed). The threat takes priority once a rival passes ~40% AGI.
  // (uses the existing leadingRival() defined below, which returns {id, val}.)
  function raceStatus() {
    if (!rivalsRevealed() || !rivalsActive()) return null;
    var lr = leadingRival();
    var agi = lr && lr.id ? (lr.val || 0) : 0;
    var threat = lr && lr.id && agi >= 40;
    if (threat) return { kind: 'threat', id: lr.id, pct: Math.round(agi) };
    if (isMarketLeader()) return { kind: 'lead' };
    return (lr && lr.id) ? { kind: 'threat', id: lr.id, pct: Math.round(agi) } : null;
  }
  function rivalAcquired(id) { var r = rivalById(id); return !r || !!r.acquired; }
  // §5 acquisitions: buy out the strongest remaining rival (one-time each, post mid-game)
  function acquireTarget() {
    var best = null, bv = -1;
    activeRivals().forEach(function (r) { if ((r.share || 0) > bv) { bv = r.share || 0; best = r; } });
    return best;
  }
  function acquireCost(id) { var r = rivalById(id), agi = r ? (r.agi || 0) : 0; return Math.floor(valuation() * C.ACQUIRE.COST_FRAC * (1 + agi / 100)); }
  function acquireUnlocked() { return state.modelGen >= C.ACQUIRE.UNLOCK_GEN; }
  function canAcquire() { var r = acquireTarget(); return !!r && acquireUnlocked() && state.cash >= acquireCost(r.id); }
  function acquireRival() {
    var r = acquireTarget(); if (!r || !acquireUnlocked()) return false;
    var cost = acquireCost(r.id); if (state.cash < cost) return false;
    state.cash -= cost; r.acquired = true;
    state.marketShare = Math.min(100, state.marketShare + (r.share || 0) * C.ACQUIRE.SHARE_TRANSFER);
    r.share = 0; r.agi = 0;
    checkAchievements(); emit('acquire', { id: r.id }); emit('change');
    return true;
  }
  // rank in the AGI race (you vs rivals by AGI progress) — 1 = leading
  function agiRank() { var you = agiProgress(), rank = 1; activeRivals().forEach(function (r) { if ((r.agi || 0) > you) rank++; }); return rank; }
  function agiFieldSize() { return activeRivals().length + 1; }
  function leadingRival() { ensureRivals(); var id = null, v = -1; activeRivals().forEach(function (r) { if ((r.agi || 0) > v) { v = r.agi || 0; id = r.id; } }); return { id: id, val: v < 0 ? 0 : v }; }
  function maxRivalAgi() { return leadingRival().val; }
  function slowLeadingRival() { var l = leadingRival(); if (l.id) { var r = rivalById(l.id); if (r) r.agi = Math.max(0, (r.agi || 0) - C.RACE.SLOW_OPENSOURCE); } }
  function updateRace(dt) {
    // act advance + intro
    var a = currentAct();
    if (a > state.act) { state.act = a; emitNews('milestone', ['nh_act_' + a, 'nh_act_x'], { n: a + 1 }); emit('act', { act: a }); }
    if (!rivalsRevealed()) return;
    ensureRivals();
    var heat = Math.max(agiProgress(), maxRivalAgi()) / 100 * C.RACE.HEAT;
    var reckless = state.align < 2 ? C.RACE.RECKLESS_RIVAL_BONUS : 0;
    var agiMult = diff('rivalAGIspeedMult'); if (typeof agiMult !== 'number' || !isFinite(agiMult)) agiMult = 1;
    activeRivals().forEach(function (r) { r.agi = Math.min(100, (r.agi || 0) + r.speed * agiMult * (1 + heat + reckless) * dt); });
    if (maxRivalAgi() >= 100 && agiProgress() < 100 && !state.gameOver) { triggerFinale('beaten', false); } // a rival reached AGI first (backup path; doSingularity was a dead no-op)
  }
  function avgVec() { var s = 0; C.RISK.VECTORS.forEach(function (v) { s += state.vec[v]; }); return s / C.RISK.VECTORS.length; }
  // GDD v3: the ending you WIN AGI with, decided by your play style at the finale.
  function determineEnding() {
    var E = C.ENDINGS, av = avgVec();
    if (state.trust < E.NATIONALIZED_TRUST || state.vec.reg > E.NATIONALIZED_AVGVEC || state.crisesEscalated >= E.NATIONALIZED_ESC) return 'nationalized';
    if (state.align < E.FOOM_ALIGN || state.vec.cap > E.FOOM_CAP || av > 50) return 'foom'; // reckless
    if (state.trust >= E.QUIET_TRUST && av <= E.QUIET_AVGVEC) return 'quiet'; // pristine: max trust, minimal risk
    return 'aligned';
  }
  // fire the AGI finale exactly once (win = you reached AGI; beaten = a rival did)
  function triggerFinale(ending, won) {
    if (state.gameOver) return false;
    state.gameOver = true; state.ending = ending; state.won = !!won;
    state.endings[ending] = true;
    checkAchievements();
    emit('ending', { id: ending, won: !!won });
    return true;
  }
  function isGameOver() { return !!state.gameOver; }
  // ---- Founder's Legacy (optional, NON-forced replay) ----
  function legacyNextBonus() { return 0.25; } // +25% permanent compute/revenue per legacy
  function startLegacy() {
    if (!state.gameOver) return false;   // only offered after the finale
    state.legacyCount = (state.legacyCount || 0) + 1;
    state.legacyMult = (state.legacyMult || 1) * (1 + legacyNextBonus());
    // new company: reset the run, KEEP legacy bonus + endings + achievements + cosmetics + boosts
    GEN.forEach(function (g) { state.gens[g.id] = 0; });
    state.upgrades = {}; state.managers = {};
    state.cash = 0; state.compute = 0; state.researchers = 0;
    state.modelGen = 0; state.marketShare = 0;
    state.training = { active: false, gen: -1, startedAt: 0, endsAt: 0 };
    state.build = { active: false, startedAt: 0, endsAt: 0 }; state.datacenters = 0;
    state.research2 = { active: false, startedAt: 0, endsAt: 0 }; state.researchLevel = 0;
    state.funding = {};
    state.align = 0; state.vec = { cap: 0, data: 0, reg: 0, sec: 0 }; state.incidentEndsAt = 0;
    seedRivals(state.difficulty || C.DIFFICULTY.DEFAULT); // fresh rival field for the legacy run
    state.gameOver = false; state.ending = null; state.won = false;
    state.totalEarnedThisRun = 0;
    emit('change');
    return true;
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
      if (def.cashSeconds) addCash(windfallCash(def.cashSeconds, C.WINDFALL.CAP_FRAC, 100));
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
    else if (r.id === 'lucky') { var v = windfallCash(r.cashSeconds, C.WINDFALL.CAP_FRAC, 200); addCash(v); vars = { v: window.GAME_FMT.fmt(v) }; }
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
    // expire decision-engine timed buffs (Phase 1 groundwork)
    if (state.buffs && state.buffs.length) {
      for (var bi = state.buffs.length - 1; bi >= 0; bi--) if (state.buffs[bi].endsAt <= now) state.buffs.splice(bi, 1);
    }
  }
  // PART A — WORLD REACTION: the world visibly reacts to YOUR state. Fires only on
  // threshold CROSSINGS (a flag flips on entering a band, resets on leaving), never per
  // tick — so the feed reacts to what you do without spamming.
  function reactNews(flag, on, type, keys, vars) {
    var was = !!state.newsReact[flag];
    if (on && !was) { state.newsReact[flag] = 1; emitNews(type, keys, vars); }
    else if (!on && was) { state.newsReact[flag] = 0; }
  }
  function updateWorldNews() {
    // risk/regulatory scrutiny — only meaningful once risk exists (v3+)
    if (riskUnlocked()) {
      reactNews('react_risk_high', avgVec() >= 60, 'regulatory', ['nh_react_risk', 'nh_react_risk2']);
      reactNews('react_reg_heat', (state.vec && state.vec.reg >= 70), 'regulatory', ['nh_react_reg']);
    }
    // public trust craters → bad press (trust meter lives the whole game once you ship)
    if (state.modelGen >= 1) {
      reactNews('react_trust_low', state.trust <= 25, 'rival', ['nh_react_trust', 'nh_react_trust2']);
      reactNews('react_trust_hi', state.trust >= 80, 'milestone', ['nh_react_trust_hi']);
    }
    // you top the AGI race (lead the field AND no rival breathing down your neck)
    if (rivalsRevealed() && rivalsActive()) {
      reactNews('react_lead', isMarketLeader() && agiProgress() >= maxRivalAgi(), 'milestone', ['nh_react_lead', 'nh_react_lead2']);
    }
  }
  // Sub-part E: fire any due scheduled events — a delayed consequence SPAWNS its
  // target decision/effect with a "they remembered" callback toast referencing the
  // original choice ("The lawsuit you risked has arrived.").
  function updateScheduled() {
    if (!state.scheduled || !state.scheduled.length) return;
    var now = Date.now();
    for (var i = state.scheduled.length - 1; i >= 0; i--) {
      var s = state.scheduled[i];
      if (s.fireAt > now) continue;
      state.scheduled.splice(i, 1);
      if (Math.random() > (typeof s.chance === 'number' ? s.chance : 1)) continue;  // chance gate (save-scum guard)
      var ev = decisionById(s.event);
      if (ev) {
        // the callback toast tags the original gamble before the decision surfaces
        var cbKey = s.callbackKey || (ev.category === 'legal' ? 'callback_lawsuit' : 'scheduled_fired');
        emit('toast', { key: cbKey });
        // reuse the callback line as a news headline (the gamble "comes back")
        pushNews(t_safe(cbKey, coVars()), 'rival');
        // record the fire (so its own cooldowns apply) and surface as a callback
        state.eventCooldowns[ev.id] = now;
        if (ev.category) state.categoryCooldowns[ev.category] = now;
        surfaceDecision(ev, now, { callback: true, callbackKey: cbKey });
        emit('scheduled', { event: s.event, decision: true });
      } else {
        // legacy / unknown scheduled key: keep the Phase-1 behavior (no crash)
        emit('scheduled', { event: s.event });
        emit('toast', { key: 'scheduled_fired', vars: { event: s.event } });
      }
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
      // --- GDD v3 continuous-meta conditions ---
      case 'modelGen': return state.modelGen >= c.n;
      case 'agi': return state.modelGen >= C.MODELGEN.length;
      case 'marketShare': return state.marketShare >= c.n;
      case 'marketLeader': return playerRank() === 1;
      case 'researchers': return state.researchers >= c.n;
      case 'datacenters': return (state.datacenters || 0) >= c.n;
      case 'researchLevel': return (state.researchLevel || 0) >= c.n;
      case 'funding': { var fc = 0; for (var fk in state.funding) if (state.funding[fk]) fc++; return fc >= c.n; }
      case 'legacy': return (state.legacyCount || 0) >= c.n;
      default: return false;
    }
  }
  function checkAchievements() {
    C.ACHIEVEMENTS.forEach(function (a) {
      if (!state.achievements[a.id] && condMet(a.cond)) {
        state.achievements[a.id] = true;
        state.boostTokens = (state.boostTokens || 0) + 1;   // GDD v3: achievements grant earned boosts
        emit('achievement', { id: a.id });
      }
    });
  }

  // ---- tick ------------------------------------------------------------
  function tick(dt) {
    if (dt <= 0) return;

    // GDD v3 continuous meta: generators produce COMPUTE; your shipped product
    // produces MONEY (∝ infra × generation × share). No more cash-from-generators.
    state.compute += computeRate() * dt;
    // Phase 2 BURN → RUNWAY: revenue is the income, burn is the opposing operating drain.
    // Credit revenue through addCash (so lifetime/earned totals stay honest), then subtract
    // the burn from cash. Cash is FLOORED at 0 here — Phase 2 surfaces runway tension but must
    // never instakill; bankruptcy/game-over triggers off runway in Phase 3.
    addCash(revenuePerSec() * dt);
    state.cash = Math.max(0, state.cash - burnPerSec() * dt);
    if (trainingActive()) {
      if (Date.now() >= state.training.endsAt) finishTraining();
      else emitTrainProgress();   // subtle 25/50/75% progress pings on long runs
    }
    if (buildActive() && Date.now() >= state.build.endsAt) finishBuild();        // parallel timers
    if (researchActive() && Date.now() >= state.research2.endsAt) finishResearch();
    if (execRecruitActive() && Date.now() >= state.execRecruit.endsAt) finishExecRecruit(); // managing-director recruit

    updateRivals(dt);   // GDD v3: rivals creep on market share + AGI (the race)
    if (!state.gameOver && !isAGI() && leadingRivalAgi() >= 100) triggerFinale('beaten', false); // a rival reached AGI first
    if (!state.unicorn && state.modelGen >= 1 && valuation() >= 1e9) { state.unicorn = true; emit('toast', { key: 'milestone_unicorn' }); } // §9 shareable
    else if (state.unicorn && !state.decacorn && valuation() >= 1e10) { state.decacorn = true; emit('toast', { key: 'milestone_decacorn' }); }

    // multi-vector risk dynamics — ONLY after the first model release (Stage 5).
    // Before that, "risks of scale" simply do not exist (clean early game).
    if (riskUnlocked()) {
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
    }

    if (state.modelGen >= 2) updateEvents();  // world/industry events: after shipping a couple models
    if (insightUnlocked()) updateInsight();     // Insight Flash: an early delight (Stage 2)
    updateBuffs(dt);
    updateScheduled();   // decision-engine: fire due delayed consequences
    updateWorldNews();   // LIVING NEWS: world reacts to your state on threshold crossings
    updateDecisions();   // decision-engine: roll the pacing lottery (Sub-part C)
    updateInbox();       // decision-engine: auto-resolve ignored bankable items (Sub-part D)
    updateCards();
    updateMarket();
    updateRace(dt);

    state.playtime += dt;
    checkAchievements();
  }

  // ===== EXECUTIVE / MANAGING DIRECTOR (DESIGN-exec-team.md) ============
  // ONE slot, a long tier ladder. The hired director auto-resolves decisions while you're
  // away, with quality scaling on `judgment` + your MANDATE. Recruit timers are wall-clock.
  function execTier(i) { return (C.EXECS && i >= 0 && i < C.EXECS.length) ? C.EXECS[i] : null; }
  function currentExec() { return execTier(state.exec); }                 // null if none
  function nextExecTier() { return execTier((state.exec || -1) + 1); }    // null at top
  function execTopReached() { return state.exec >= (C.EXECS ? C.EXECS.length - 1 : 0); }
  // full cash price of a tier (base + any legendary signing package).
  function execCost(tier) { return tier ? (tier.costCash + (tier.signing || 0)) : 0; }
  // is a tier's gate satisfied right now? (valuation / trust / modelGen requirements)
  function execGateMet(tier) {
    if (!tier || !tier.gate) return true;
    var g = tier.gate;
    if (typeof g.valuation === 'number' && valuation() < g.valuation) return false;
    if (typeof g.trust === 'number' && (state.trust || 0) < g.trust) return false;
    if (typeof g.modelGen === 'number' && (state.modelGen || 0) < g.modelGen) return false;
    return true;
  }
  function execRecruitActive() { return !!(state.execRecruit && state.execRecruit.active); }
  function canRecruitExec() {
    if (execRecruitActive() || execTopReached()) return false;
    var nx = nextExecTier();
    return !!nx && execGateMet(nx) && state.cash >= execCost(nx);
  }
  function startExecRecruit() {
    if (!canRecruitExec()) return false;
    var nx = nextExecTier(), to = (state.exec || -1) + 1;
    state.cash -= execCost(nx);   // pay the signing package up front
    state.execRecruit = { active: true, toTier: to, startedAt: Date.now(), endsAt: Date.now() + nx.recruitSec * 1000 };
    emit('change');
    return true;
  }
  function execRecruitProgress() {
    if (!execRecruitActive()) return 0;
    var r = state.execRecruit, tot = r.endsAt - r.startedAt;
    return tot <= 0 ? 1 : Math.max(0, Math.min(1, (Date.now() - r.startedAt) / tot));
  }
  function execRecruitTimeLeft() { return execRecruitActive() ? Math.max(0, (state.execRecruit.endsAt - Date.now()) / 1000) : 0; }
  function finishExecRecruit() {
    if (!execRecruitActive()) return false;
    var to = state.execRecruit.toTier;
    state.exec = Math.max(state.exec, to);
    state.execRecruit = { active: false, toTier: -1, startedAt: 0, endsAt: 0 };
    var tier = currentExec();
    if (tier) emitNews('milestone', ['nh_exec_hired'], { name: t_safe(tier.name) });
    emit('execHired', { tier: state.exec, name: tier ? tier.name : '' });
    checkAchievements(); emit('change');
    return true;
  }
  function setMandate(m) {
    var ok = { growth: 1, balance: 1, safety: 1, share: 1 };
    if (!ok[m]) return false;
    state.mandate = m; emit('change'); return true;
  }

  // ---- offline DELEGATION scoring ----
  // Score one option's "value" under a mandate from its effects vocabulary. Higher = better
  // for the company under that posture. Pure read of opt.effects (no state mutation).
  function optionScore(opt, mandate) {
    var e = (opt && opt.effects) || {}, m = e.meter || {}, r = e.resource || {};
    function nd(v) { var n = numDelta(v); return n === undefined ? 0 : n; }
    var dShare = nd(m.marketShare), dVal = nd(m.valuation), dTrust = nd(m.trust), dAlign = nd(m.align);
    var dCash = nd(r.cash), dCompute = nd(r.compute), dRes = nd(r.researchers);
    // risk pressure: sum of positive vec deltas (rising risk is bad); debt vars are bad too.
    var risk = 0; if (e.vec) for (var k in e.vec) risk += (nd(e.vec[k]) > 0 ? nd(e.vec[k]) : nd(e.vec[k]) * 0.5);
    var debt = 0; if (e.set_var) for (var vk in e.set_var) { if (/debt|friction|dilution/.test(vk)) debt += nd(e.set_var[vk]); }
    // normalize money/compute to comparable scale with meters (they swing far larger)
    var cashU = dCash / 60, compU = dCompute / 60, resU = dRes * 3;
    var growth = dVal * 0.6 + dShare * 1.0 + cashU * 0.5 + compU * 0.4 + resU - risk * 0.3 - debt * 1.5;
    var safety = dTrust * 1.2 + dAlign * 1.4 - risk * 1.6 - debt * 2.5 + cashU * 0.2;
    var share  = dShare * 1.6 + dVal * 0.4 + cashU * 0.3 - risk * 0.2 - debt * 0.6;
    var bal    = dVal * 0.35 + dShare * 0.5 + dTrust * 0.5 + dAlign * 0.5 + cashU * 0.3 + compU * 0.25 + resU * 0.5 - risk * 0.9 - debt * 1.6;
    switch (mandate) {
      case 'growth': return growth;
      case 'safety': return safety;
      case 'share':  return share;
      default:       return bal;
    }
  }
  // The director picks an option for an event under the mandate. Quality rises with judgment:
  // low judgment → noisy (often the WORST/debt option); top judgment → near-optimal + an
  // occasional bonus. Returns the chosen option (never null for a valid event).
  function execChoose(ev, judgment, mandate) {
    var opts = (ev && ev.options) || [];
    if (!opts.length) return null;
    var scored = opts.map(function (o) { return { opt: o, score: optionScore(o, mandate) }; });
    var sorted = scored.slice().sort(function (a, b) { return b.score - a.score; });
    var best = sorted[0], worst = sorted[sorted.length - 1];
    var j = Math.max(0, Math.min(100, judgment)) / 100;
    // probability of taking the mandate-best option scales with judgment (0.15 → 0.97).
    var pBest = 0.15 + j * 0.82;
    var roll = Math.random();
    if (roll < pBest) {
      best.bonus = (j > 0.9 && Math.random() < (j - 0.9) * 4);   // legend occasionally squeezes a bonus
      return best;
    }
    // a miss: low judgment skews toward the WORST option; mid judgment picks a random other.
    if (Math.random() < (1 - j) * 0.7 && worst.opt !== best.opt) return worst;
    var others = sorted.slice(1);
    return others.length ? others[Math.floor(Math.random() * others.length)] : best;
  }
  // Run the director over the away window: resolve up to MAX decisions that "would have
  // fired", applying effects + a news headline each. Returns a report array for the modal.
  // Pure-eligible: draws from the SAME live pool drawDecision() uses, recording cooldowns so
  // it never resolves the same event twice in one batch.
  function execResolveOffline(awaySec) {
    var report = [];
    var tier = currentExec();
    if (!tier || awaySec <= 0) return report;
    var O = C.EXECS_OFFLINE || { AVG_DECISION_SEC: 1800, MAX_RESOLVED: 6 };
    var n = Math.max(0, Math.min(O.MAX_RESOLVED || 6, Math.floor(awaySec / (O.AVG_DECISION_SEC || 1800))));
    var now = Date.now();
    for (var i = 0; i < n; i++) {
      var ev = drawDecision(now);
      if (!ev) break;                                  // pool exhausted for this state
      // record the fire so the next draw can't repeat it (mirrors fireDecision bookkeeping)
      state.eventCooldowns[ev.id] = now;
      state.categoryCooldowns[ev.category] = now;
      if (ev.once) state.eventsFired[ev.id] = true;
      var pick = execChoose(ev, tier.judgment, state.mandate);
      if (!pick) continue;
      var opt = pick.opt;
      applyEffect(opt.effects);
      if (pick.bonus) applyEffect({ resource: { cash: '+' + Math.round(moneyRate() * 30 + 50) } }); // legend bonus
      decisionNews(ev, opt.id);
      // good/bad framing from the realized score sign under the active mandate
      var sc = optionScore(opt, state.mandate);
      report.push({
        evId: ev.id, optId: opt.id,
        title: t_safe(ev.id + '_t', coVars()),
        choice: t_safe(ev.id + '_' + opt.id, coVars()),
        good: sc >= 0, bonus: !!pick.bonus
      });
    }
    if (report.length) checkAchievements();
    return report;
  }

  // ---- offline ---------------------------------------------------------
  function computeOffline(elapsedSec, doubled) {
    var capHours = C.OFFLINE.BASE_CAP_HOURS + puValue('offlineCap', 0) + metaAdd('offlineCap');
    var cap = capHours * 3600;
    var eff = Math.min(elapsedSec, cap);
    var offMult = techMult('offline') * artifactMult('offlineMult');
    // GDD v3: offline advances the whole company — product revenue (money) AND
    // compute accrue at the offline rate; training is wall-clock so it just
    // completes on return (handled by tick).
    // Phase 2: offline advances revenue AND burn at the offline rate, so returning players
    // don't pocket a cost-free windfall. Net is floored at 0 (no offline bankruptcy — that
    // pressure belongs to active play / Phase 3). Compute keeps accruing regardless.
    var grossEarned = revenuePerSec() * eff * C.OFFLINE.RATE * offMult * (doubled ? 2 : 1);
    var offBurn = burnPerSec() * eff * C.OFFLINE.RATE * offMult;
    var earned = Math.max(0, grossEarned - offBurn);
    var computeGained = computeRate() * eff * C.OFFLINE.RATE * offMult;
    // GDD v3 "while you were away": which parallel timers finished during the gap
    var now = Date.now();
    var trainedGen = (trainingActive() && state.training.endsAt <= now) ? C.MODELGEN[state.training.gen] : null;
    return {
      earned: earned, compute: computeGained, effSec: eff,
      cappedSec: Math.min(elapsedSec, cap), elapsed: elapsedSec, cap: cap,
      trainedGenId: trainedGen ? trainedGen.id : null,
      builtDC: (buildActive() && state.build.endsAt <= now),
      didResearch: (researchActive() && state.research2.endsAt <= now)
    };
  }
  function applyOffline(earned, computeGained) { addCash(earned); if (computeGained) state.compute += computeGained; emit('change'); }

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
    // capture the ORIGINAL save version BEFORE we backfill defaults — version-gated
    // derivations below must read pre-rewrite fields, not the zeros the backfill seeds.
    var fromVer = (typeof s.version === 'number') ? s.version : 0;
    // item 2: a save that predates the company-name feature must NOT be re-prompted to
    // name its lab — grandfather it as already-named (keeps the default brand) before the
    // generic backfill below seeds companyNamed:false.
    var hadCompanyName = ('companyName' in s);
    // ensure all keys exist (forward-compatible)
    var base = newState();
    for (var k in base) if (!(k in s)) s[k] = base[k];
    if (!hadCompanyName) s.companyNamed = true;
    // sanitize a loaded name defensively (never trust storage)
    s.companyName = sanitizeCompanyName(s.companyName);
    GEN.forEach(function (g) { if (s.gens[g.id] === undefined) s.gens[g.id] = 0; });
    // LIVING NEWS migration: newsLog used to hold plain strings; normalize to {line,type,at}.
    if (Array.isArray(s.newsLog)) {
      s.newsLog = s.newsLog.map(function (n) { return (n && typeof n === 'object' && 'line' in n) ? n : { line: String(n), type: 'flavor', at: 0 }; });
    } else s.newsLog = [];
    if (!s.newsReact || typeof s.newsReact !== 'object') s.newsReact = {};
    // Autopilot was removed in Phase 1 — drop the field from any old save (never crash).
    if ('autopilot' in s) delete s.autopilot;
    // multi-vector risk migration: fold old single risk into capability
    if (!s.vec || typeof s.vec !== 'object') s.vec = { cap: (typeof s.risk === 'number' ? s.risk : 0), data: 0, reg: 0, sec: 0 };
    C.RISK.VECTORS.forEach(function (v) { if (typeof s.vec[v] !== 'number') s.vec[v] = 0; });
    if (typeof s.auditReadyAt !== 'number') s.auditReadyAt = 0;
    delete s.risk;
    // ---- v3: progression + prestige rework (SAFE: never break / never rob) ----
    // % start-cash needs a best-run baseline; seed it from the current run so returning
    // players aren't worse off than before.
    // (the generic copy above may have set this to base 0; take the max so we always
    // seed a sensible baseline without ever lowering an established one)
    s.bestRunEarned = Math.max(s.bestRunEarned || 0, s.totalEarnedThisRun || 0);
    if (!s.seen || typeof s.seen !== 'object') s.seen = {};
    // Grandfather the removed flat starting-cash items into the new SCALING ones, so
    // anyone who bought them keeps an (equal-or-better) starting boost instead of losing it.
    if (s.prestigeUpgrades && typeof s.prestigeUpgrades === 'object') {
      if (s.prestigeUpgrades.p_start)  { s.prestigeUpgrades.p_seed  = true; delete s.prestigeUpgrades.p_start; }
      if (s.prestigeUpgrades.p_start2) { s.prestigeUpgrades.p_seed2 = true; delete s.prestigeUpgrades.p_start2; }
    }
    // ---- v4: GDD v3 continuous no-reset meta (model generations) ----
    // Convert old prestige progress into the forward-only ladder; never rob the player.
    if (typeof s.compute !== 'number') s.compute = 0;
    if (typeof s.researchers !== 'number') s.researchers = 0;
    // pre-rewrite saves (fromVer < 4) carry no modelGen/marketShare — derive from old
    // prestige progress so a returning player keeps an equal-or-better standing.
    if (fromVer < 4) {
      // each old "prestige" (model release) ≈ one generation already shipped
      s.modelGen = Math.max(s.modelGen || 0, Math.min(C.MODELGEN.length, s.prestiges || 0));
      // seed a sensible standing from how far they'd progressed
      var seedShare = 0; for (var mg = 0; mg < s.modelGen; mg++) seedShare += (C.MODELGEN[mg] ? C.MODELGEN[mg].share : 0);
      s.marketShare = Math.max(s.marketShare || 0, Math.min(60, seedShare));
    }
    if (!s.training || typeof s.training !== 'object') s.training = { active: false, gen: -1, startedAt: 0, endsAt: 0 };
    if (!s.funding || typeof s.funding !== 'object') s.funding = {};
    // ---- v11: difficulty vector + data-driven rival roster ----
    // difficulty: any save predating this defaults to 'normal'.
    if (typeof s.difficulty !== 'string' || !C.DIFFICULTY.levels[s.difficulty]) s.difficulty = C.DIFFICULTY.DEFAULT;
    // rival roster: convert the OLD per-id maps (rivalShare/rivalAgi/acquired/rivalAgiToasted)
    // into the new state.rivals array, PRESERVING each rival's progress. If no usable old
    // data exists (brand-new or already-migrated save), seed a fresh random roster so the
    // game never crashes and two fresh games differ. Never lose a save.
    if (!Array.isArray(s.rivals) || !s.rivals.length) {
      var old = (s.rivalShare && typeof s.rivalShare === 'object') ? s.rivalShare : null;
      var oldIds = old ? Object.keys(old) : [];
      if (oldIds.length) {
        var poolById = {}; C.RIVAL_POOL.forEach(function (p) { poolById[p.id] = p; });
        var oldAgi = (s.rivalAgi && typeof s.rivalAgi === 'object') ? s.rivalAgi : {};
        var oldAcq = (s.acquired && typeof s.acquired === 'object') ? s.acquired : {};
        var oldToast = (s.rivalAgiToasted && typeof s.rivalAgiToasted === 'object') ? s.rivalAgiToasted : {};
        s.rivals = oldIds.map(function (id) {
          var pool = poolById[id] || { id: id, name: (window.GAME_I18N ? null : null) || id, archetype: 'satire' };
          var live = makeRival(pool);              // gives a name + sensible creep rates
          live.share = (typeof old[id] === 'number' && isFinite(old[id])) ? old[id] : live.share;
          live.agi = (typeof oldAgi[id] === 'number' && isFinite(oldAgi[id])) ? oldAgi[id] : live.agi;
          live.acquired = !!oldAcq[id];
          live.agiToasted = (typeof oldToast[id] === 'number') ? oldToast[id] : 0;
          return live;
        });
      } else {
        s.rivals = seedRivalsInto(s, s.difficulty);  // fresh random field for a new/empty save
      }
    }
    // drop the superseded per-id maps so they can't drift out of sync with state.rivals
    delete s.rivalShare; delete s.rivalAgi; delete s.acquired; delete s.rivalAgiToasted;
    // ---- v6: parallel build/research timers ----
    if (typeof s.datacenters !== 'number') s.datacenters = 0;
    if (!s.build || typeof s.build !== 'object') s.build = { active: false, startedAt: 0, endsAt: 0 };
    if (typeof s.researchLevel !== 'number') s.researchLevel = 0;
    if (!s.research2 || typeof s.research2 !== 'object') s.research2 = { active: false, startedAt: 0, endsAt: 0 };
    // ---- v7: earned-boost economy + daily login ----
    if (typeof s.trainToastPct !== 'number') s.trainToastPct = 0;
    if (typeof s.seenLongTrain !== 'boolean') s.seenLongTrain = false;
    if (typeof s.boostTokens !== 'number') s.boostTokens = 0;
    if (typeof s.lastDailyDay !== 'number') s.lastDailyDay = 0;
    if (typeof s.dailyStreak !== 'number') s.dailyStreak = 0;
    // ---- v8: AGI finale + endings + Founder's Legacy ----
    if (typeof s.gameOver !== 'boolean') s.gameOver = false;
    if (typeof s.ending === 'undefined') s.ending = null;
    if (typeof s.won !== 'boolean') s.won = false;
    if (typeof s.legacyCount !== 'number') s.legacyCount = 0;
    if (typeof s.legacyMult !== 'number') s.legacyMult = 1;
    if (typeof s.unicorn !== 'boolean') s.unicorn = false;
    if (typeof s.decacorn !== 'boolean') s.decacorn = false;
    // (v9 acquired / rivalAgiToasted maps were folded into state.rivals above in v11)
    // ---- Phase 1: decision-engine state (flags/vars/scheduled/buffs) ----
    if (!s.flags || typeof s.flags !== 'object' || Array.isArray(s.flags)) s.flags = {};
    if (!s.vars || typeof s.vars !== 'object' || Array.isArray(s.vars)) s.vars = {};
    if (!Array.isArray(s.scheduled)) s.scheduled = [];
    if (!Array.isArray(s.buffs)) s.buffs = [];
    // ---- Phase 2: decision pacing/inbox state (safe backfill for old saves) ----
    if (!s.eventCooldowns || typeof s.eventCooldowns !== 'object' || Array.isArray(s.eventCooldowns)) s.eventCooldowns = {};
    if (!s.eventsFired || typeof s.eventsFired !== 'object' || Array.isArray(s.eventsFired)) s.eventsFired = {};
    if (!s.categoryCooldowns || typeof s.categoryCooldowns !== 'object' || Array.isArray(s.categoryCooldowns)) s.categoryCooldowns = {};
    if (!s.eventBag || typeof s.eventBag !== 'object' || Array.isArray(s.eventBag)) s.eventBag = {};
    if (!Array.isArray(s.inbox)) s.inbox = [];
    if (typeof s.nextDecisionAt !== 'number') s.nextDecisionAt = 0;
    // ---- v10: executive / managing-director ladder (safe backfill for old saves) ----
    if (typeof s.exec !== 'number') s.exec = -1;
    s.exec = Math.floor(clean(s.exec, -1, -1, (C.EXECS ? C.EXECS.length : 1) - 1));
    if (!s.execRecruit || typeof s.execRecruit !== 'object' || Array.isArray(s.execRecruit)) s.execRecruit = { active: false, toTier: -1, startedAt: 0, endsAt: 0 };
    var VALID_MANDATES = { growth: 1, balance: 1, safety: 1, share: 1 };
    if (typeof s.mandate !== 'string' || !VALID_MANDATES[s.mandate]) s.mandate = 'balance';
    // ---- v12: BURN → RUNWAY economy. The new operating-cost drain must NOT suddenly
    // bankrupt an established save. Any save predating v12 was balanced under a no-burn
    // economy, so grandfather a healthy cash buffer: if the player's runway under the new
    // burn would be tighter than GRANDFATHER_MONTHS, top cash up to that many months of net
    // burn. Profitable / fresh / runway-already-comfy saves are untouched. We evaluate burn
    // against `s` via a temporary state swap (the burn fns read the live `state` global).
    if (fromVer < 12) {
      var GRANDFATHER_MONTHS = 12;   // returning players land with ≥1 comfortable year
      var _saved = state; state = s;
      try {
        var nb = netMonthlyBurn();                  // burn − revenue, $/month (uses s)
        if (nb > 0) {
          var needed = nb * GRANDFATHER_MONTHS;
          if ((s.cash || 0) < needed) s.cash = needed;   // top up; never lower an existing balance
        }
      } catch (e) { /* never let a balance calc break loading */ }
      finally { state = _saved; }
    }
    // ---- corruption hardening: coerce/clamp critical numerics so a malformed or
    // tampered save can never produce negative cash, NaN compute, or string maths.
    function clean(v, def, min, max) {
      var n = typeof v === 'number' ? v : parseFloat(v);
      if (!isFinite(n)) n = def;
      if (typeof min === 'number' && n < min) n = min;
      if (typeof max === 'number' && n > max) n = max;
      return n;
    }
    s.cash = clean(s.cash, 0, 0);
    s.compute = clean(s.compute, 0, 0);
    s.totalEarnedAllTime = clean(s.totalEarnedAllTime, 0, 0);
    s.totalEarnedThisRun = clean(s.totalEarnedThisRun, 0, 0);
    s.marketShare = clean(s.marketShare, 0, 0, 100);
    s.researchers = clean(s.researchers, 0, 0);
    s.datacenters = clean(s.datacenters, 0, 0);
    s.researchLevel = clean(s.researchLevel, 0, 0);
    s.modelGen = Math.floor(clean(s.modelGen, 0, 0, C.MODELGEN.length));
    s.trust = clean(s.trust, C.TRUST ? C.TRUST.START : 50, 0, 100);
    s.legacyMult = clean(s.legacyMult, 1, 0);
    s.taps = Math.floor(clean(s.taps, 0, 0));
    if (s.gens && typeof s.gens === 'object') {
      GEN.forEach(function (g) { s.gens[g.id] = Math.floor(clean(s.gens[g.id], 0, 0)); });
    }
    if (s.vec && typeof s.vec === 'object') {
      C.RISK.VECTORS.forEach(function (v) { s.vec[v] = clean(s.vec[v], 0, 0, C.RISK.MAX); });
    }
    // rival roster: every entry's share/AGI must be finite (a NaN share breaks standings
    // sort) — clamp share to 0..cap, agi to 0..100, and drop any malformed entry.
    if (Array.isArray(s.rivals)) {
      s.rivals = s.rivals.filter(function (r) { return r && typeof r === 'object' && r.id; }).map(function (r) {
        r.share = clean(r.share, 0, 0, C.RIVAL_SHARE_CAP);
        r.agi = clean(r.agi, 0, 0, 100);
        r.acquired = !!r.acquired;
        r.agiToasted = Math.floor(clean(r.agiToasted, 0, 0, 100));
        // rates may be missing on a hand-tampered save — backfill from archetype
        var A = C.RIVAL_ARCHETYPES[r.archetype] || C.RIVAL_ARCHETYPES.satire, B = C.RIVAL_BASE;
        if (typeof r.shareRate !== 'number' || !isFinite(r.shareRate)) r.shareRate = B.shareRate * A.shareRate;
        if (typeof r.agiRate !== 'number' || !isFinite(r.agiRate)) r.agiRate = B.agiRate * A.agiRate;
        if (typeof r.speed !== 'number' || !isFinite(r.speed)) r.speed = B.speed * A.speed;
        if (typeof r.name !== 'string' || !r.name) r.name = rivalName(r.id);
        return r;
      });
    }
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

  // On load, mark already-satisfied achievements & valuation milestones as earned
  // WITHOUT toasting, so a returning/migrated/loaded player isn't flooded re-announcing
  // past progress. Only genuinely NEW unlocks during active play toast afterward.
  function syncProgressSilently() {
    C.ACHIEVEMENTS.forEach(function (a) { if (!state.achievements[a.id] && condMet(a.cond)) state.achievements[a.id] = true; });
    if (state.modelGen >= 1 && valuation() >= 1e9) state.unicorn = true;
    if (valuation() >= 1e10) { state.unicorn = true; state.decacorn = true; }
  }
  function init() {
    var loaded = load();
    var offline = null;
    if (loaded) {
      state = loaded;
      syncProgressSilently();   // BUG 2: no re-toast of already-earned on load
      if (state.lang) window.GAME_I18N.setLang(state.lang);
      var elapsed = Math.max(0, (Date.now() - (state.lastSeen || Date.now())) / 1000);
      if (elapsed > 30) offline = computeOffline(elapsed, false);
      if (elapsed > 3600) { grantBoostToken(1); if (offline) offline.idleBoost = true; } // idle reward
      // Managing-director offline delegation: if a recruit completed while away, seat the new
      // director first; then (only if a director is hired) auto-resolve the decisions that
      // "would have fired" under the active mandate. No exec ⇒ no auto-resolve (current behavior).
      if (execRecruitActive() && Date.now() >= state.execRecruit.endsAt) finishExecRecruit();
      if (currentExec()) {
        var rep = execResolveOffline(elapsed);
        if (rep.length) {
          if (!offline) offline = computeOffline(elapsed, false);
          offline.execReport = rep;
          var ct = currentExec();
          offline.execName = ct ? ct.name : '';
          offline.mandate = state.mandate;
        }
      }
    }
    return offline;
  }

  // ---- setters ---------------------------------------------------------
  function setBuyMode(m) { state.buyMode = m; emit('change'); }
  function setSound(b) { state.sound = !!b; emit('change'); }
  function setMusic(b) { state.music = !!b; emit('change'); }
  function setHaptics(b) { state.haptics = !!b; emit('change'); }
  function setLang(l) { window.GAME_I18N.setLang(l); state.lang = l; emit('change'); }
  function setOnboarded(b) { state.onboarded = !!b; save(); }
  // item 2: sanitize a company name — strip tags/HTML, collapse whitespace, trim, cap to
  // 24 chars, and fall back to the default brand if the result is empty.
  var DEFAULT_COMPANY_NAME = 'Singularity Inc.';
  function sanitizeCompanyName(name) {
    if (typeof name !== 'string') return DEFAULT_COMPANY_NAME;
    var n = name.replace(/<[^>]*>/g, ' ')         // strip any HTML tags
                .replace(/[<>]/g, '')             // strip stray angle brackets
                .replace(/[\u0000-\u001f\u007f]/g, '') // strip control chars
                .replace(/\s+/g, ' ')             // collapse whitespace
                .trim();
    if (n.length > 24) n = n.slice(0, 24).trim();
    return n.length ? n : DEFAULT_COMPANY_NAME;
  }
  function setCompanyName(name) {
    state.companyName = sanitizeCompanyName(name);
    state.companyNamed = true;
    save();
    emit('change');
    return state.companyName;
  }
  // Difficulty chosen at the new-game step (after naming). Applies the immediate, safe hooks:
  // (1) seeds a starting-cash boost ×startCashMult, (2) seeds the random rival roster sized by
  // the level. Other levers (burn/funding/failure) are read live by their phases when built.
  // `seedNewGame` is true only the first time (the onboarding step); a later debug re-pick
  // won't re-grant cash or wipe an in-progress roster.
  function setDifficulty(level, seedNewGame) {
    if (!C.DIFFICULTY.levels[level]) level = C.DIFFICULTY.DEFAULT;
    state.difficulty = level;
    if (seedNewGame) {
      var seed = (C.DIFFICULTY.START_CASH_SEED || 0) * (diff('startCashMult') || 1);
      if (seed > 0 && state.cash < seed) state.cash = seed;   // grant once (don't lower an existing balance)
      seedRivals(level);                                       // fresh random field for this run
    } else { ensureRivals(); }
    save();
    emit('change');
    return state.difficulty;
  }
  function achCount() { var c = 0; for (var k in state.achievements) if (state.achievements[k]) c++; return c; }
  function cosmeticUnlocked(item) {
    var u = item.unlock || {};
    if (u.modelGen && state.modelGen < u.modelGen) return false;   // GDD v3: earned by shipping generations
    if (u.prestiges && state.prestiges < u.prestiges) return false; // (legacy — no longer reachable)
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
    genPerUnitOutput: genPerUnitOutput, genBuyPreview: genBuyPreview,
    // GDD v3 continuous meta
    computeRate: computeRate, tapCompute: tapCompute, moneyRate: moneyRate, valuation: valuation,
    // Phase 2 burn → runway economy
    burnBreakdown: burnBreakdown, monthlyBurn: monthlyBurn, monthlyRevenue: monthlyRevenue,
    revenuePerSec: revenuePerSec, burnPerSec: burnPerSec, netCashRate: netCashRate,
    netMonthlyBurn: netMonthlyBurn, runwayMonths: runwayMonths, isProfitable: isProfitable,
    genRevenueMult: genRevenueMult, nextGen: nextGen, isAGI: isAGI,
    trainingActive: trainingActive, canStartTraining: canStartTraining, startTraining: startTraining,
    trainingProgress: trainingProgress, trainingTimeLeft: trainingTimeLeft, finishTraining: finishTraining,
    trainDuration: trainDuration,
    researcherSpeed: researcherSpeed, researcherCost: researcherCost, hireResearcher: hireResearcher, talentUnlocked: talentUnlocked,
    nextFundingRound: nextFundingRound, canTakeFunding: canTakeFunding, takeFunding: takeFunding, fundingPayout: fundingPayout,
    rivalsActive: rivalsActive, standings: standings, playerRank: playerRank, isMarketLeader: isMarketLeader, leadingRivalAgi: leadingRivalAgi, raceStatus: raceStatus, agiRank: agiRank, agiFieldSize: agiFieldSize,
    acquireTarget: acquireTarget, acquireCost: acquireCost, acquireUnlocked: acquireUnlocked, canAcquire: canAcquire, acquireRival: acquireRival,
    datacenterMult: datacenterMult, buildCost: buildCost, buildActive: buildActive, canStartBuild: canStartBuild, startBuild: startBuild, buildProgress: buildProgress, buildTimeLeft: buildTimeLeft,
    researchEfficiencyMult: researchEfficiencyMult, researchProjCost: researchProjCost, researchActive: researchActive, canStartResearch: canStartResearch, startResearch: startResearch, researchProgress: researchProgress, researchTimeLeft: researchTimeLeft, processSpeed: processSpeed,
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
    grantBoostToken: grantBoostToken, activateBoostToken: activateBoostToken,
    dailyAvailable: dailyAvailable, claimDaily: claimDaily,
    // achievements
    checkAchievements: checkAchievements,
    // tick / offline
    tick: tick, computeOffline: computeOffline, applyOffline: applyOffline,
    // persistence
    save: save, load: load, reset: reset, init: init,
    // setters
    setBuyMode: setBuyMode, setSound: setSound, setMusic: setMusic, setHaptics: setHaptics, setLang: setLang, setOnboarded: setOnboarded,
    setCompanyName: setCompanyName, sanitizeCompanyName: sanitizeCompanyName,
    setDifficulty: setDifficulty, diff: diff, seedRivals: seedRivals,
    rivalName: rivalName, activeRivals: activeRivals, rivalById: rivalById,
    achCount: achCount, cosmeticUnlocked: cosmeticUnlocked, setOrb: setOrb, setTheme: setTheme,
    worldUnlocked: worldUnlocked, marketUnlocked: marketUnlocked, resolveCard: resolveCard,
    // progressive unlock schedule + release projection
    buyModesUnlocked: buyModesUnlocked, upgradesUnlocked: upgradesUnlocked, insightUnlocked: insightUnlocked,
    breakthroughUnlocked: breakthroughUnlocked, managersUnlocked: managersUnlocked, researchUnlocked: researchUnlocked,
    riskUnlocked: riskUnlocked, statsUnlocked: statsUnlocked, awardsUnlocked: awardsUnlocked,
    firstPrestigeReady: firstPrestigeReady, prestigeProjection: prestigeProjection,
    startCashBoost: startCashBoost, keepGenFrac: keepGenFrac,
    crisisCdLeft: crisisCdLeft, trustMult: trustMult,
    currentAct: currentAct, rivalsRevealed: rivalsRevealed, agiProgress: agiProgress,
    leadingRival: leadingRival, maxRivalAgi: maxRivalAgi, slowLeadingRival: slowLeadingRival,
    endingPerkMult: endingPerkMult, endingsUnlocked: endingsUnlocked, applyRaceStance: applyRaceStance,
    determineEnding: determineEnding, isGameOver: isGameOver, startLegacy: startLegacy, legacyNextBonus: legacyNextBonus,
    raceOpenSource: raceOpenSource, raceOpenReady: raceOpenReady,
    cardTemplate: cardTemplate, marketBuy: marketBuy, marketSell: marketSell, ensureMarket: ensureMarket,
    // decision engine (Phase 2)
    evalCond: evalCond, _evalCondTest: _evalCondTest,
    decisionById: decisionById, resolveDecision: resolveDecision, removeInbox: removeInbox,
    pickDefaultOption: pickDefaultOption, decisionWeight: decisionWeight,
    // executive / managing-director ladder
    execTier: execTier, currentExec: currentExec, nextExecTier: nextExecTier, execTopReached: execTopReached,
    execCost: execCost, execGateMet: execGateMet, canRecruitExec: canRecruitExec, startExecRecruit: startExecRecruit,
    execRecruitActive: execRecruitActive, execRecruitProgress: execRecruitProgress, execRecruitTimeLeft: execRecruitTimeLeft,
    finishExecRecruit: finishExecRecruit, setMandate: setMandate,
    execResolveOffline: execResolveOffline, optionScore: optionScore,
    // force-fire a decision NOW (manual testing / debug). Bypasses pacing + cooldowns.
    _forceDecision: function (id) { var ev = decisionById(id); if (!ev) return false; fireDecision(ev, Date.now()); return true; },
    newState: newState
  };
})();
