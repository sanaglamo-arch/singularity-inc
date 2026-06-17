/* Singularity Inc. — central config: ALL tunable economy numbers live here.
   Exposed as window.GAME_CONFIG. No logic, just data. */
(function () {
  'use strict';

  // ---- Generators (hardware tiers) -------------------------------------
  // cost(n) = baseCost * growth^(owned).  out = baseOut per unit / sec.
  // Numbers mirror a proven AdCap-style curve, retuned for this theme.
  var GENERATORS = [
    { id: 'laptop',      icon: '💻', baseCost: 15,        growth: 1.070, baseOut: 0.10 },
    { id: 'gpuRig',      icon: '🎛️', baseCost: 110,       growth: 1.075, baseOut: 1.0 },
    { id: 'serverRack',  icon: '🗄️', baseCost: 1200,      growth: 1.080, baseOut: 8.0 },
    { id: 'gpuCluster',  icon: '⚡',      baseCost: 13000,     growth: 1.085, baseOut: 47 },
    { id: 'dataCenter',  icon: '🏢', baseCost: 140000,    growth: 1.090, baseOut: 260 },
    { id: 'superComp',   icon: '🖥️', baseCost: 1.6e6,     growth: 1.095, baseOut: 1400 },
    { id: 'neuroArray',  icon: '🧠', baseCost: 2.0e7,     growth: 1.100, baseOut: 7800 },
    { id: 'quantumNode', icon: '⚛️', baseCost: 3.3e8,     growth: 1.105, baseOut: 44000 },
    { id: 'orbital',     icon: '🛰️', baseCost: 5.1e9,     growth: 1.110, baseOut: 2.6e5 },
    { id: 'agiCore',     icon: '🌟', baseCost: 7.5e10,    growth: 1.120, baseOut: 1.6e6 },
    { id: 'dysonSwarm',  icon: '🛸', baseCost: 1.1e12,    growth: 1.125, baseOut: 9.5e6 },
    { id: 'matrioshka',  icon: '🌀', baseCost: 1.7e13,    growth: 1.130, baseOut: 5.8e7 }
  ];

  // Owned-count milestones that each multiply that generator's output x2.
  var MILESTONES = [10, 25, 50, 100, 150, 200, 300, 400, 500];

  // ---- Global upgrades (one-time multiplier purchases) ------------------
  // target 'all' = global mult; or a generator id = that generator only.
  // mult is multiplicative. unlock = {gen, count} requires owned>=count.
  var UPGRADES = [
    { id: 'u_tap1',   target: 'tap', mult: 2,  cost: 500,     unlock: null },
    { id: 'u_tap2',   target: 'tap', mult: 3,  cost: 50000,   unlock: { gen: 'laptop', count: 25 } },
    { id: 'u_lap1',   target: 'laptop',     mult: 2, cost: 1000,    unlock: { gen: 'laptop', count: 10 } },
    { id: 'u_rig1',   target: 'gpuRig',     mult: 2, cost: 9000,    unlock: { gen: 'gpuRig', count: 10 } },
    { id: 'u_rack1',  target: 'serverRack', mult: 2, cost: 90000,   unlock: { gen: 'serverRack', count: 10 } },
    { id: 'u_clus1',  target: 'gpuCluster', mult: 2, cost: 1.0e6,   unlock: { gen: 'gpuCluster', count: 10 } },
    { id: 'u_dc1',    target: 'dataCenter', mult: 2, cost: 1.1e7,   unlock: { gen: 'dataCenter', count: 10 } },
    { id: 'u_all1',   target: 'all', mult: 2,  cost: 2.5e6,   unlock: { gen: 'serverRack', count: 25 } },
    { id: 'u_all2',   target: 'all', mult: 2,  cost: 5.0e8,   unlock: { gen: 'dataCenter', count: 50 } },
    { id: 'u_super1', target: 'superComp', mult: 3, cost: 2.0e8, unlock: { gen: 'superComp', count: 10 } },
    { id: 'u_neuro1', target: 'neuroArray', mult: 3, cost: 2.5e9, unlock: { gen: 'neuroArray', count: 10 } },
    { id: 'u_all3',   target: 'all', mult: 3,  cost: 1.0e11,  unlock: { gen: 'quantumNode', count: 25 } },
    { id: 'u_quant1', target: 'quantumNode', mult: 3, cost: 4.0e10, unlock: { gen: 'quantumNode', count: 10 } },
    { id: 'u_orb1',   target: 'orbital', mult: 3, cost: 6.0e11, unlock: { gen: 'orbital', count: 10 } },
    { id: 'u_all4',   target: 'all', mult: 5,  cost: 5.0e13,  unlock: { gen: 'agiCore', count: 25 } },
    { id: 'u_agi1',   target: 'agiCore', mult: 3, cost: 9.0e12, unlock: { gen: 'agiCore', count: 10 } },
    { id: 'u_dyson1', target: 'dysonSwarm', mult: 3, cost: 1.4e14, unlock: { gen: 'dysonSwarm', count: 10 } },
    { id: 'u_matr1',  target: 'matrioshka', mult: 3, cost: 2.2e15, unlock: { gen: 'matrioshka', count: 10 } },
    { id: 'u_all5',   target: 'all', mult: 10, cost: 1.0e16, unlock: { gen: 'matrioshka', count: 25 } }
  ];

  // ---- Managers (automation: auto-buy a generator) ---------------------
  // Buying a manager auto-purchases that generator whenever affordable and
  // grants +50% to its output. cost in cash.
  var MANAGERS = GENERATORS.map(function (g, i) {
    return { id: 'm_' + g.id, gen: g.id, mult: 1.5, cost: g.baseCost * (i < 2 ? 40 : 60) };
  });

  // ---- Prestige --------------------------------------------------------
  // RP gained on prestige = floor( PRESTIGE_K * sqrt(totalEarnedThisRun / PRESTIGE_SCALE) )
  // Each RP grants +PRESTIGE_BONUS global multiplier (additive on a base of 1).
  // RP gained on release = floor( K * sqrt(totalEarnedThisRun / SCALE) ).
  // Each RP grants +BONUS to the PERMANENT global multiplier, FOREVER (baseline passive,
  // shown loudly at the release screen). The shop below is structural choice ON TOP.
  var PRESTIGE = {
    K: 1.4,               // RP gain rate (tuned so the first release lands ~35-45 min)
    SCALE: 1e6,
    BONUS: 0.05,          // +5% per RP to global mult, permanent
    MIN_TO_PRESTIGE: 1,   // engine floor: need >=1 RP to be allowed at all
    FIRST_RP: 5,          // the guided first-release CTA waits until the gain is this juicy
    // prestige (RP-bought) permanent upgrades. NO flat starting-cash items — starting
    // boosts are SCALING (% of your best run) or STRUCTURAL (keep generator levels).
    upgrades: [
      { id: 'p_mult1',   type: 'globalMult',  value: 2,    cost: 5 },
      { id: 'p_tap',     type: 'tapMult',     value: 10,   cost: 10 },
      { id: 'p_align',   type: 'alignBoost',  value: 2,    cost: 20 }, // alignment suppression x2
      { id: 'p_offline', type: 'offlineCap',  value: 4,    cost: 25 }, // +4h offline cap
      { id: 'p_seed',    type: 'startCashPct', value: 0.03, cost: 40 }, // start each run with 3% of best run
      { id: 'p_mult2',   type: 'globalMult',  value: 3,    cost: 50 },
      { id: 'p_keepgen', type: 'keepGens',    value: 0.06, cost: 120 }, // keep 6% of every generator level
      { id: 'p_offline2',type: 'offlineCap',  value: 12,   cost: 200 }, // +12h offline cap
      { id: 'p_mult3',   type: 'globalMult',  value: 5,    cost: 500 },
      { id: 'p_seed2',   type: 'startCashPct', value: 0.10, cost: 1500 }, // start with 10% of best run
      { id: 'p_mult4',   type: 'globalMult',  value: 10,   cost: 5000 }  // late-game global x10
    ]
  };

  // ---- Progressive-unlock schedule (player journey) --------------------
  // Sticky, monotonic gates on lifetime metrics. Stage 1 (Garage) shows ONLY the
  // tap->buy loop; depth reveals as the player grows. See BALANCE.md.
  var UNLOCKS = {
    BUYMODES_EARNED: 250,    // reveal x10/x100/Max bulk buying
    UPGRADES_EARNED: 500,    // reveal the Upgrades tab (first upgrade costs 500)
    INSIGHT_EARNED: 1500,    // the first delightful Insight-Flash surprise can appear
    BREAKTHROUGH_EARNED: 2.5e4, // reveal the Breakthrough ability
    MANAGERS_EARNED: 6e4,    // reveal Managers (manual buying is getting tedious)
    WORLD_RP: 70             // Stage 6 "Industry" (News/Trust/Market/Rivals) opens a bit
                             // after the first release; also opens at prestiges>=2
  };

  // ---- Risk / Alignment (signature mechanic) ---------------------------
  var RISK = {
    MAX: 100,
    // risk gained/sec = GAIN * capabilityFactor, capabilityFactor = log10(cps+10)/CAP_DIV
    GAIN: 0.55,
    CAP_DIV: 3,
    // each Alignment unit suppresses risk/sec by SUPPRESS (x alignBoost). R13: lowered
    // 0.20->0.12 so alignment is an ONGOING investment that scales with capability
    // (you keep funding it as you grow) instead of a trivial 5-and-done toggle.
    SUPPRESS: 0.12,
    alignBaseCost: 200,
    alignGrowth: 1.16,        // cost(n) = alignBaseCost * growth^owned (gentler so ongoing funding stays affordable)
    // incident
    INCIDENT_THRESHOLD: 100,
    INCIDENT_PENALTY: 0.20,   // output multiplied by this during incident
    INCIDENT_DURATION: 90,    // seconds (auto-resolves)
    INCIDENT_RESET_RISK: 35,  // a vector is reset to this after its crisis fires
    WARN_AT: 75,              // UI warns above this
    // ---- Multi-vector risk (replaces the single spam-defeatable bar) ----
    VECTORS: ['cap', 'data', 'reg', 'sec'],
    DATA_GENS: ['dataCenter', 'neuroArray', 'quantumNode', 'orbital', 'dysonSwarm', 'matrioshka'],
    CAP_GAIN: 0.5,            // capability: from output growth (log cps)
    DATA_GAIN: 0.0011,       // privacy/data: per data-heavy generator owned, /sec
    REG_BASE: 0.015,         // regulatory: small base drift /sec
    REG_DECAY: 0.05,         // regulatory decays toward 0 when below spikes
    REG_PRESTIGE_SPIKE: 11,  // hype: each model release bumps regulatory
    SEC_GAIN: 0.09,          // security: accrues over time /sec
    SUPPRESS_SHARE: 0.5,     // alignment suppression applied to data/reg/sec (cap gets full)
    // Reactive Audit: preemptive, costs cash, on cooldown — NOT an instant crisis-clear
    AUDIT_CUT: 35,           // reduces the highest vector by this
    AUDIT_FRAC: 0.18,        // cost = this fraction of current cash
    AUDIT_CD: 120,           // cooldown (seconds)
    // Crisis cadence — a global cooldown spaces crises out (anti-nag). Gentle early,
    // more pressure later: cooldown = clamp(BASE - prestiges*3 - singularities*10).
    CRISIS_CD_BASE: 165, CRISIS_CD_MIN: 95,
    // Escalation: an ignored crisis hits harder + longer than a handled one.
    ESCALATE_DUR_MULT: 1.6, ESCALATE_TRUST: 10
  };

  // ---- PHASE 5: named INCIDENT events (DESIGN §4) ----------------------
  // INCIDENTS are felt consequences of skimping on Safety: they roll PROBABILISTICALLY
  // against Incident Risk (the highest risk vector) each cycle, gated by a cooldown so
  // they never spam. Severity scales with act (PR embarrassment → lawsuit → company-ending).
  // They reuse the decision modal + %-of-scale effect forms; each pushes a news headline.
  var INCIDENTS_CFG = {
    RISK_FLOOR: 55,        // no incident roll below this Incident-Risk level (skimping must be real)
    CHANCE_AT_FLOOR: 0.02, // per-eligible-cycle chance at the floor …
    CHANCE_AT_MAX: 0.16,   // … rising linearly to this at 100% risk
    COOLDOWN_SEC: 150,     // global incident cooldown (anti-spam), shortens slightly with size
    COOLDOWN_MIN: 80,
    CHECK_EVERY_SEC: 5,    // only roll once every N seconds (a "cycle")
    RISK_RELIEF: 18        // firing an incident bleeds a little risk off the top vector
  };

  // ---- Tap -------------------------------------------------------------
  var TAP = { base: 2 };

  // ---- Offline ---------------------------------------------------------
  var OFFLINE = {
    BASE_CAP_HOURS: 8,
    AD_CAP_HOURS: 24,        // when watching rewarded ad
    RATE: 0.5                // offline earns 50% of current cps
  };

  // Anti-printer: every "X seconds of production" windfall (insight Eureka, event
  // grant, ad cash, news cashGift) is (a) computed from BASE cps — transient buffs
  // like Breakthrough/Frenzy/Hype no longer inflate it — and (b) capped at this
  // fraction of your best proven run, so windfalls can never self-compound into a
  // printer. (News cashGift uses its own tighter CARDS.CASHGIFT_CAP_FRAC.)
  var WINDFALL = { CAP_FRAC: 0.08 };

  // ---- Ad boosts -------------------------------------------------------
  var ADS = {
    BOOST_MULT: 2,           // 2x earnings
    BOOST_DURATION: 2 * 3600,// 2 hours
    CASH_BURST_SECONDS: 600, // instant cash = 10 min of production
    INTERSTITIAL_COOLDOWN: 120 // min seconds between interstitials
  };

  // ---- Achievements ----------------------------------------------------
  // check: function(state) -> bool. Defined in game.js via ids; metadata here.
  var ACHIEVEMENTS = [
    { id: 'a_firstTap',   cond: { type: 'taps', n: 1 } },
    { id: 'a_tap100',     cond: { type: 'taps', n: 100 } },
    { id: 'a_firstGen',   cond: { type: 'anyGen', n: 1 } },
    { id: 'a_lap50',      cond: { type: 'gen', gen: 'laptop', n: 50 } },
    { id: 'a_cash1m',     cond: { type: 'totalCash', n: 1e6 } },
    { id: 'a_cash1b',     cond: { type: 'totalCash', n: 1e9 } },
    { id: 'a_cash1t',     cond: { type: 'totalCash', n: 1e12 } },
    { id: 'a_prestige1',  cond: { type: 'modelGen', n: 1 } },
    { id: 'a_prestige5',  cond: { type: 'modelGen', n: 5 }, perk: { type: 'global', value: 1.05 } },
    { id: 'a_rp100',      cond: { type: 'marketShare', n: 25 } },
    { id: 'a_agi',        cond: { type: 'agi' }, perk: { type: 'global', value: 1.05 } },
    { id: 'a_align50',    cond: { type: 'align', n: 50 } },
    { id: 'a_incident',   cond: { type: 'incidents', n: 1 } },
    { id: 'a_safe',       cond: { type: 'researchers', n: 10 } },
    { id: 'a_event',      cond: { type: 'events', n: 1 } },
    { id: 'a_matrioshka', cond: { type: 'gen', gen: 'matrioshka', n: 1 } },
    { id: 'a_cash1qa',    cond: { type: 'totalCash', n: 1e15 } },
    { id: 'a_insight',    cond: { type: 'insights', n: 1 } },
    { id: 'a_breakthrough', cond: { type: 'breakthroughs', n: 1 } },
    { id: 'a_overclock',  cond: { type: 'maxheat', n: 1 } },
    { id: 'a_tech',       cond: { type: 'researchLevel', n: 1 } },
    { id: 'a_artifact',   cond: { type: 'datacenters', n: 1 } },
    { id: 'a_singularity', cond: { type: 'funding', n: 5 }, perk: { type: 'global', value: 1.10 } },
    { id: 'a_cores10',    cond: { type: 'modelGen', n: 8 }, perk: { type: 'tap', value: 2 } },
    { id: 'a_synergy',    cond: { type: 'marketLeader' }, perk: { type: 'global', value: 1.05 } },
    { id: 'a_techadept',  cond: { type: 'researchLevel', n: 6 } },
    { id: 'a_sing3',      cond: { type: 'modelGen', n: 10 }, perk: { type: 'global', value: 1.15 } },
    { id: 'a_cores50',    cond: { type: 'legacy', n: 1 } }
  ];

  // ---- Tap combo / Overclock heat -------------------------------------
  // Rapid tapping builds heat (0..1) that decays; tap value scales up to
  // x(1+maxBonus) at full heat. Rewards active bursts; makes TRAIN feel alive.
  var COMBO = { gainPerTap: 0.085, decayPerSec: 0.40, maxBonus: 4 };

  // ---- Insight Flash (Cookie-Clicker "golden cookie") ------------------
  // A glowing collectible drifts across the screen; tap in time for a buff.
  var INSIGHT = {
    MIN_GAP: 45, MAX_GAP: 95,   // seconds between spawns
    FIRST_DELAY: 40,            // earliest after run start
    LIFETIME: 13,              // seconds on screen before it escapes
    rewards: [
      { id: 'frenzy',      mult: 7,      duration: 30 }, // x7 global output 30s
      { id: 'clickFrenzy', tapMult: 100, duration: 15 }, // x100 tap value 15s
      { id: 'lucky',       cashSeconds: 900 }            // instant 15 min of income
    ]
  };

  // ---- Breakthrough ability (active, chainable) -----------------------
  var BREAKTHROUGH = {
    mult: 10, duration: 20, cooldown: 180,
    chainWindow: 8,            // re-fire within Ns of the last one ending => bonus
    chainMult: 15, chainDuration: 25
  };

  // ---- Generator classes (for tech/artifact category multipliers) ------
  var GEN_CLASS = {
    low:  ['laptop', 'gpuRig', 'serverRack'],
    mid:  ['gpuCluster', 'dataCenter', 'superComp', 'neuroArray'],
    high: ['quantumNode', 'orbital', 'agiCore', 'dysonSwarm', 'matrioshka']
  };

  // ---- Tech Tree (RP-gated; persists across model-release, resets on Singularity)
  // cat: tap | gen_low | gen_mid | gen_high | all | offline | risk
  // req: {} | {tech:id} | {gen:id, count:n}
  var TECH = [
    { id: 't_tap1',  cat: 'tap',      mult: 3,   cost: 12,   req: {} },
    { id: 't_low1',  cat: 'gen_low',  mult: 2,   cost: 18,   req: {} },
    { id: 't_off1',  cat: 'offline',  mult: 2,   cost: 25,   req: {} },
    { id: 't_risk1', cat: 'risk',     mult: 0.7, cost: 30,   req: {} },
    { id: 't_all1',  cat: 'all',      mult: 1.5, cost: 60,   req: { tech: 't_low1' } },
    { id: 't_mid1',  cat: 'gen_mid',  mult: 2,   cost: 90,   req: { gen: 'dataCenter', count: 25 } },
    { id: 't_tap2',  cat: 'tap',      mult: 5,   cost: 120,  req: { tech: 't_tap1' } },
    { id: 't_off2',  cat: 'offline',  mult: 3,   cost: 160,  req: { tech: 't_off1' } },
    { id: 't_all2',  cat: 'all',      mult: 2,   cost: 350,  req: { tech: 't_all1' } },
    { id: 't_high1', cat: 'gen_high', mult: 3,   cost: 600,  req: { gen: 'quantumNode', count: 10 } },
    { id: 't_risk2', cat: 'risk',     mult: 0.5, cost: 450,  req: { tech: 't_risk1' } },
    { id: 't_all3',  cat: 'all',      mult: 3,   cost: 2000, req: { tech: 't_all2' } }
  ];

  // ---- Prestige Artifacts (granted on model-release; equip up to SLOTS) -
  // tags drive synergy: each tag shared by >=2 equipped artifacts => +SYNERGY all
  var ARTIFACT_SLOTS = 3;
  var ARTIFACT_SYNERGY = 0.20; // +20% all per tag that has a matched pair equipped
  var ARTIFACTS = [
    { id: 'ar_chip',    tags: ['hw'],            effect: { type: 'allMult',     value: 1.10 } },
    { id: 'ar_cooler',  tags: ['hw', 'safety'],  effect: { type: 'riskMult',    value: 0.80 } },
    { id: 'ar_gpu',     tags: ['hw'],            effect: { type: 'genHighMult', value: 1.25 } },
    { id: 'ar_oracle',  tags: ['ai'],            effect: { type: 'tapMult',     value: 3 } },
    { id: 'ar_dataset', tags: ['ai'],            effect: { type: 'allMult',     value: 1.15 } },
    { id: 'ar_charter', tags: ['ai', 'safety'],  effect: { type: 'riskMult',    value: 0.70 } },
    { id: 'ar_vault',   tags: ['money'],         effect: { type: 'offlineMult', value: 2 } },
    { id: 'ar_fund',    tags: ['money'],         effect: { type: 'allMult',     value: 1.12 } },
    { id: 'ar_dice',    tags: ['gamble'],        effect: { type: 'gamble' } } // rolls 0.6..3.0 all, per run
  ];

  // ---- Second prestige: The Singularity (meta-currency: Singularity Cores) --
  var SINGULARITY = {
    UNLOCK_RP: 1200,           // unlocks at this lifetime RP ...
    UNLOCK_GEN: 'agiCore',     // ... or once an AGI Core exists
    SCALE: 100,                // cores = floor( sqrt(rp / SCALE) * coreGainMult )
    CORE_BONUS: 0.10,          // each Core = +10% global (passive)
    meta: [                    // permanent forever (Cores), never reset
      { id: 'sm_global1', type: 'globalMult',  value: 3,    cost: 1 },
      { id: 'sm_rp',      type: 'rpGain',      value: 2,    cost: 2 },
      { id: 'sm_tap',     type: 'tapMult',     value: 10,   cost: 2 },
      { id: 'sm_risk',    type: 'riskMult',    value: 0.5,  cost: 2 },
      { id: 'sm_offline', type: 'offlineCap',  value: 24,   cost: 3 },
      { id: 'sm_global2', type: 'globalMult',  value: 5,    cost: 5 },
      { id: 'sm_core',    type: 'coreGain',    value: 2,    cost: 6 },
      { id: 'sm_global3', type: 'globalMult',  value: 10,   cost: 12 }
    ]
  };

  // ---- Random timed events --------------------------------------------
  var EVENTS = {
    MIN_GAP: 150,        // min seconds between events
    MAX_GAP: 300,        // max seconds between events
    FIRST_DELAY: 75,     // no event before this much playtime (seconds)
    list: [
      { id: 'grant',      kind: 'instant', cashSeconds: 600 },  // +10 min of production
      { id: 'hype',       kind: 'timed',   duration: 60, outputMult: 2 },
      { id: 'shortage',   kind: 'timed',   duration: 45, outputMult: 0.5 },
      { id: 'leak',       kind: 'instant', riskAdd: 25 },
      { id: 'opensource', kind: 'instant', riskAdd: -30 }
    ]
  };

  // ---- Narrative campaign: Acts (monotonic, derived from lifetime progress) ----
  var ACTS = [
    { id: 'garage' },       // 0: start
    { id: 'startup' },      // 1: first generator owned
    { id: 'frontier' },     // 2: first model release (prestige)
    { id: 'race' },         // 3: rivals revealed (prestiges>=2 or totalRP>=120)
    { id: 'singularity' }   // 4: first Singularity reached (stays here; race+endings loop)
  ];

  // ---- Rival labs — the Race to AGI (revealed at Act 3) -----------------
  // GDD v3: rivals compete for MARKET SHARE and race to AGI on their own timelines.
  // share0 = starting %, shareRate = market share gained per second (slow creep —
  // you overtake by shipping generations), agiRate = AGI progress %/sec.
  var RIVALS = [
    { id: 'helion',  speed: 0.0150, share0: 17, shareRate: 0.00060, agiRate: 0.00050 },  // reckless front-runner
    { id: 'cerebra', speed: 0.0110, share0: 13, shareRate: 0.00045, agiRate: 0.00038 },  // steady
    { id: 'omninet', speed: 0.0085, share0: 9,  shareRate: 0.00032, agiRate: 0.00028 }   // cautious
  ];
  var RIVAL_SHARE_CAP = 45;   // a rival's market share tapers toward this ceiling
  // §5 light/optional acquisitions: buy out a rival to take its market share + remove it
  // from the race. cost = valuation × COST_FRAC × (1 + their AGI%/100); one-time per rival.
  var ACQUIRE = { UNLOCK_GEN: 5, COST_FRAC: 0.25, SHARE_TRANSFER: 0.6 };
  var RACE = {
    REVEAL_ACT: 3,
    PLAYER_TARGET_RP: 700,  // your AGI% = 100 * rp / TARGET (100% ~ when you can Ascend)
    HEAT: 0.6,              // as the leader nears AGI, everyone speeds up (climax tension)
    SLOW_OPENSOURCE: 14,    // open-sourcing knocks the leading rival back this much AGI%
    RECKLESS_RIVAL_BONUS: 0.4 // racing recklessly (low alignment) lets rivals gain faster too
  };

  // ---- DIFFICULTY (Phase 1 foundation) ---------------------------------
  // Chosen once at new-game (after naming). A VECTOR of multipliers (DESIGN-depth-redesign
  // §5), NOT a single toggle. ALL levers are defined here even though several have no
  // consumer yet — later phases (burn/economy/failure/acquisition windows) read them.
  // Hooked NOW (Phase 1): startCashMult, rivalAGIspeedMult, eventSeverityMult.
  // rivalCount = [min,max] rivals seeded at new-game (replayability core).
  var DIFFICULTY = {
    DEFAULT: 'normal',
    ORDER: ['easy', 'normal', 'hard', 'impossible'],
    // base starting cash seed (×startCashMult) granted once when the difficulty is chosen on a
    // NEW game. Sized (Phase 2) so the OPENING runway matches DESIGN §5: ~12–15mo on Normal
    // (≈ seed / monthly overhead ≈ 360/28), ×startCashMult ⇒ Easy ~18mo · Hard ~9mo ·
    // Impossible ~6mo. Once you buy compute, the (dominant) compute-burn tightens it from there.
    START_CASH_SEED: 360,
    levels: {
      easy: {
        startCashMult: 1.5,     // HOOKED — new-game starting cash
        burnMult: 0.8,          // dormant (Phase: burn/runway)
        computePriceMult: 0.85, // dormant (Phase: burn)
        revenueMult: 1.2,       // dormant (Phase: economy)
        fundValMult: 1.2,       // dormant (Phase: funding/down-rounds)
        rivalAggroMult: 0.6,    // dormant (Phase: rival lifecycle aggression)
        failWarnMonths: 4,      // dormant (Phase: failure telegraph)
        failMonths: 0,          // dormant (Phase: bankruptcy threshold)
        acqWindow: 5,           // dormant (Phase: hostile-takeover ultimatum window, turns)
        eventSeverityMult: 0.7, // HOOKED — scales bad decision/event magnitudes
        rivalAGIspeedMult: 0.8, // HOOKED — rival AGI creep speed in updateRivals
        varianceMult: 0.7,      // dormant (Phase: world variance / RNG spread)
        // PHASE 6 lifecycle pacing: higher cd-mult = slower churn; lower entrant-mult = rarer
        // dark-horses. Easy = calm field; Impossible = lively, aggressive, more newcomers.
        lifecycleCdMult: 1.4, entrantMult: 0.6,
        rivalCount: [2, 3],
        // DEBT (DESIGN-debt-bankruptcy §F): grace = in-game days you may hold cash<0 before
        // bankruptcy; ceilingK = insolvency if cash < −(K × monthly burn). Easier = more rope.
        debtGraceDays: 90, debtCeilingK: 3
      },
      normal: {
        startCashMult: 1.0, burnMult: 1.0, computePriceMult: 1.0, revenueMult: 1.0,
        fundValMult: 1.0, rivalAggroMult: 1.0, failWarnMonths: 3, failMonths: 0,
        acqWindow: 4, eventSeverityMult: 1.0, rivalAGIspeedMult: 1.0, varianceMult: 1.0,
        lifecycleCdMult: 1.0, entrantMult: 1.0,
        rivalCount: [3, 3],
        debtGraceDays: 60, debtCeilingK: 2.5
      },
      hard: {
        startCashMult: 0.7, burnMult: 1.25, computePriceMult: 1.2, revenueMult: 0.85,
        fundValMult: 0.85, rivalAggroMult: 1.3, failWarnMonths: 2, failMonths: 0,
        acqWindow: 3, eventSeverityMult: 1.3, rivalAGIspeedMult: 1.2, varianceMult: 1.3,
        lifecycleCdMult: 0.8, entrantMult: 1.4,
        rivalCount: [4, 4],
        debtGraceDays: 35, debtCeilingK: 2
      },
      impossible: {
        // ECONOMY REBALANCE (DESIGN-GDD §3, audit A3): Impossible was MATHEMATICALLY unwinnable
        // (rev/burn capped ≤0.75 at any share). Softened burnMult 1.5→1.3 and computePriceMult
        // 1.4→1.25 so rev/burn CAN exceed 1.0 with strong play — brutal-but-fair, not impossible.
        startCashMult: 0.5, burnMult: 1.3, computePriceMult: 1.25, revenueMult: 0.7,
        fundValMult: 0.7, rivalAggroMult: 1.6, failWarnMonths: 1, failMonths: 0,
        acqWindow: 2, eventSeverityMult: 1.6, rivalAGIspeedMult: 1.45, varianceMult: 1.6,
        lifecycleCdMult: 0.6, entrantMult: 2.0,
        rivalCount: [4, 5],
        debtGraceDays: 18, debtCeilingK: 1.5
      }
    }
  };

  // ===================================================================
  // PHASE 7 — VARIANCE LAYERS (DESIGN-rivals-replayability §7.5) -------
  // Several INDEPENDENT randomness sources so two same-difficulty, same-play
  // runs DIVERGE. Fortune cuts BOTH ways (lucky breaks, not only incidents).
  // Everything is FAIR: telegraphed in the feed + always a recovery lever.
  // Amplitude/frequency/spread all × diff('varianceMult') (Easy ~0.6 calm →
  // Impossible ~1.6 swingy). See game.js for the consumers.
  // ===================================================================

  // ---- SUB-PART A — STARTING SCENARIO MODIFIERS ------------------------
  // Rolled once at new-game alongside the rival roster + world seed. Each is a
  // one-line "the world you got": a small, telegraphed opening tilt (cash /
  // runway / rivals / climate). Surfaced in the new-game flow. mods is applied
  // ONCE at roll time (startCashMult multiplies the seeded opening cash; the
  // climate fields BIAS the starting climate; rivalsAhead/rivalsWeak nudge the
  // fresh roster). Kept gentle so a bad opening is recoverable, not a loss.
  var SCENARIOS = [
    { id: 'sc_flush',    startCashMult: 1.35, climate: { funding: +0.30, hype: +0.10 }, rivalsAhead: 1 },
    { id: 'sc_lean',     startCashMult: 0.78, climate: { funding: -0.25 }, rivalsWeak: 1 },
    { id: 'sc_cheap',    startCashMult: 1.0,  climate: { compute: -0.30, reg: +0.25 } },
    { id: 'sc_hype',     startCashMult: 1.10, climate: { funding: +0.25, hype: +0.30, reg: +0.10 }, trustBias: -6 },
    { id: 'sc_winter',   startCashMult: 0.85, climate: { funding: -0.35, hype: -0.20 }, rivalsWeak: 1 },
    { id: 'sc_gold',     startCashMult: 1.0,  climate: { hype: +0.35, compute: +0.15 }, shareBias: +3 },
    { id: 'sc_crackdown',startCashMult: 0.95, climate: { reg: +0.40, funding: -0.10 }, trustBias: +4 },
    { id: 'sc_talent',   startCashMult: 1.0,  climate: { funding: +0.10 }, researcherBias: 1 }
  ];

  // ---- SUB-PART B — MARKET CLIMATE CYCLES ------------------------------
  // A macro state that DRIFTS over time (Ornstein–Uhlenbeck-ish: noise + pull
  // back to a per-game equilibrium) across four axes, each in roughly [-1,+1]:
  //   funding  raise valuations / fundability   (+boom  -winter)
  //   compute  compute & electricity price tilt (+cheap -crunch)  [+ = CHEAPER]
  //   hype     adoption / revenue tailwind, but fragile trust
  //   reg      regulatory mood (+angry pushes incident risk + cuts valuations)
  // Each axis modulates the economy for EVERYONE. A SHIFT across a labelled
  // band threshold is telegraphed in the news ("Funding winter sets in").
  // Amplitude (noise + how far swings reach) × diff('varianceMult').
  var CLIMATE = {
    AXES: ['funding', 'compute', 'hype', 'reg'],
    DRIFT_EVERY_SEC: 20,      // climate re-rolls a small step once per cycle
    NOISE: 0.06,              // per-step random walk magnitude (× varianceMult)
    REVERT: 0.05,            // pull back toward each axis equilibrium (mean reversion)
    EQ_BAND: [-0.45, 0.45],  // per-game equilibrium drawn from this band (per axis)
    CLAMP: 1.0,              // hard band on each axis
    // band thresholds for the telegraphed labels (crossing one fires news)
    BAND_HI: 0.45, BAND_LO: -0.45,
    SHIFT_NEWS_COOLDOWN_SEC: 60,  // never spam more than one climate headline per axis per window
    // how strongly each axis bends the economy (read in game.js). All gentle —
    // climate colors the run, it never instakills (recovery levers still apply).
    FUND_VAL_PER: 0.30,      // funding axis: ±30% on round payouts at the extreme
    COMPUTE_PRICE_PER: 0.22, // compute axis: ∓22% on compute/electricity price (+axis = cheaper)
    REVENUE_HYPE_PER: 0.20,  // hype axis: ±20% on revenue/adoption
    REG_RISK_PER: 0.18,      // reg axis: + regulatory-risk creep when angry
    AGGRO_PER: 0.25          // funding+hype lift rival aggression a touch (livelier booms)
  };

  // ---- SUB-PART D — LUCKY BREAKS (fortune the GOOD way) ----------------
  // A pool of POSITIVE random events that fire on a cooldowned roll, MIRRORING
  // incidents but beneficial — so randomness can let you DOMINATE, not only
  // punish. Each carries a news headline. magnitude forms reuse applyEffect's
  // %-of-scale vocabulary so they scale garage→frontier. Frequency + magnitude
  // × diff('varianceMult'). Balanced against the incident cadence (similar
  // cooldown), but lucky breaks need no risk floor — fortune can strike anytime.
  var LUCKY_CFG = {
    FIRST_DELAY_SEC: 90,     // grace before the first lucky break can fire
    COOLDOWN_SEC: 170,       // base global cooldown (× /varianceMult: swingier = more often)
    COOLDOWN_MIN: 80,
    CHECK_EVERY_SEC: 5,      // roll cadence (a "cycle")
    CHANCE: 0.05             // per-cycle base chance (× varianceMult)
  };
  // each: id (i18n key {id}_news), eff applied via applyEffect, optional act gate.
  // Magnitudes deliberately mild-but-felt; the +cash ones use cashGift (windfall-capped
  // anti-printer). All telegraphed by their own headline so the player SEES the luck.
  var LUCKY = [
    { id: 'lk_viral',    act: [0, 1, 2, 3, 4], eff: { meter: { marketShare: '+3' }, set_var: { lucky_count: '+1' } } },
    { id: 'lk_whale',    act: [1, 2, 3, 4],    eff: { cashGift: 70, meter: { trust: '+2' } } },
    { id: 'lk_star',     act: [1, 2, 3, 4],    eff: { resource: { researchers: '+1' } } },
    { id: 'lk_stumble',  act: [1, 2, 3, 4],    eff: { meter: { marketShare: '+2' }, rival_effect: { leader: { share: -2 } } } },
    { id: 'lk_grant',    act: [0, 1, 2, 3, 4], eff: { cashGift: 55 } },
    { id: 'lk_breakthru',act: [2, 3, 4],       eff: { meter: { align: '+2', marketShare: '+1' } } },
    { id: 'lk_endorse',  act: [1, 2, 3, 4],    eff: { meter: { trust: '+5' } } },
    { id: 'lk_efficient',act: [2, 3, 4],       eff: { resource: { compute: '+40' }, meter: { marketShare: '+1' } } }
  ];

  // ---- RIVAL POOL (replayability core, §4) -----------------------------
  // ~40 named fictional AI labs. On a NEW game, N are picked at random (N by difficulty).
  // archetype ∈ juggernaut|safety|disruptor|opensource|sovereign|stealth|satire — drives
  // starting share/AGI band + (later phases) lifecycle behavior. Names are language-neutral
  // / lightly transliterated so they read in both EN and RU. Each rival's per-second creep
  // rates are derived from its archetype at seed time (see seedRivals in game.js).
  var RIVAL_POOL = [
    { id: 'titan',      name: 'Titan AI',              archetype: 'juggernaut' },
    { id: 'vantage',    name: 'Vantage Intelligence',  archetype: 'juggernaut' },
    { id: 'apex',       name: 'Apex Cognition',        archetype: 'juggernaut' },
    { id: 'borealis',   name: 'Borealis AI',           archetype: 'juggernaut' },
    { id: 'helion',     name: 'Helion AI',             archetype: 'juggernaut' },
    { id: 'meridian',   name: 'Meridian Labs',         archetype: 'juggernaut' },
    { id: 'aegis',      name: 'Aegis AI',              archetype: 'safety' },
    { id: 'covenant',   name: 'Covenant Labs',         archetype: 'safety' },
    { id: 'sentinel',   name: 'Sentinel Mind',         archetype: 'safety' },
    { id: 'concord',    name: 'Concord AI',            archetype: 'safety' },
    { id: 'bastion',    name: 'Bastion',               archetype: 'safety' },
    { id: 'haven',      name: 'Haven Intelligence',    archetype: 'safety' },
    { id: 'velocity',   name: 'Velocity AI',           archetype: 'disruptor' },
    { id: 'moonshot',   name: 'Moonshot Labs',         archetype: 'disruptor' },
    { id: 'ignis',      name: 'Ignis',                 archetype: 'disruptor' },
    { id: 'overclock',  name: 'Overclock AI',          archetype: 'disruptor' },
    { id: 'rampant',    name: 'Rampant Systems',       archetype: 'disruptor' },
    { id: 'blitz',      name: 'Blitzscale AI',         archetype: 'disruptor' },
    { id: 'openmind',   name: 'OpenMind Collective',   archetype: 'opensource' },
    { id: 'commons',    name: 'Commons Intelligence',  archetype: 'opensource' },
    { id: 'freethought',name: 'Freethought AI',        archetype: 'opensource' },
    { id: 'llamatech',  name: 'Llamatech',             archetype: 'opensource' },
    { id: 'forge',      name: 'OpenForge',             archetype: 'opensource' },
    { id: 'redphoenix', name: 'Red Phoenix AI',        archetype: 'sovereign' },
    { id: 'volga',      name: 'Volga Neural',          archetype: 'sovereign' },
    { id: 'bharat',     name: 'Bharat Intelligence',   archetype: 'sovereign' },
    { id: 'crescent',   name: 'Crescent AI',           archetype: 'sovereign' },
    { id: 'nihon',      name: 'Nihon Cognition',       archetype: 'sovereign' },
    { id: 'cipher',     name: 'Cipher Labs',           archetype: 'stealth' },
    { id: 'nullsys',    name: 'Null Systems',          archetype: 'stealth' },
    { id: 'obscura',    name: 'Obscura AI',            archetype: 'stealth' },
    { id: 'stealthwave',name: 'Stealthwave',           archetype: 'stealth' },
    { id: 'quietfront', name: 'Quietfront',            archetype: 'stealth' },
    { id: 'gptgoblin',  name: 'GPT-Goblin',            archetype: 'satire' },
    { id: 'monkey',     name: 'Infinite Monkey AI',    archetype: 'satire' },
    { id: 'basilisk',   name: 'Basilisk Labs',         archetype: 'satire' },
    { id: 'paperclip',  name: 'Paperclip Maximizers',  archetype: 'satire' },
    { id: 'doomscroll', name: 'Doomscroll AI',         archetype: 'satire' },
    { id: 'hypecycle',  name: 'Hype Cycle AI',         archetype: 'satire' },
    { id: 'ramen',      name: 'Ramen Compute',         archetype: 'satire' },
    { id: 'cerebra',    name: 'Cerebra Labs',          archetype: 'satire' },
    { id: 'omninet',    name: 'OmniNet',               archetype: 'satire' }
  ];
  // per-archetype seeding bands: starting share %, starting AGI %, and creep-rate scales.
  // shareRate/agiRate/speed are MULTIPLIERS applied to the legacy base rates so the race
  // feels the same as before. Disruptors creep fast, safety slow-but-steady, stealth low
  // share but can spike (lifecycle phase), juggernauts big & strong.
  var RIVAL_ARCHETYPES = {
    juggernaut: { share0: [14, 20], agi0: [4, 10],  shareRate: 1.2, agiRate: 1.15, speed: 1.2 },
    safety:     { share0: [8, 13],  agi0: [2, 8],   shareRate: 0.85, agiRate: 0.8,  speed: 0.8 },
    disruptor:  { share0: [6, 12],  agi0: [3, 12],  shareRate: 1.35, agiRate: 1.3,  speed: 1.35 },
    opensource: { share0: [9, 15],  agi0: [2, 7],   shareRate: 1.1, agiRate: 0.9,  speed: 0.9 },
    sovereign:  { share0: [10, 16], agi0: [3, 9],   shareRate: 1.05, agiRate: 1.05, speed: 1.05 },
    stealth:    { share0: [3, 7],   agi0: [1, 6],   shareRate: 0.8, agiRate: 1.1,  speed: 1.0 },
    satire:     { share0: [4, 10],  agi0: [1, 8],   shareRate: 0.95, agiRate: 0.95, speed: 0.95 }
  };
  // legacy base rates (the old C.RIVALS numbers) the archetype scales multiply against.
  var RIVAL_BASE = { shareRate: 0.00045, agiRate: 0.00038, speed: 0.0110 };

  // ---- PHASE 6 — RIVAL TRAJECTORIES (Sub-part A, DESIGN §5) -------------
  // Per-archetype share-DRIFT character layered ON TOP of the steady creep in updateRivals.
  // `vol` = stochastic share wobble amplitude (% of share, per second of jitter); `drift` =
  // signed long-term bias on share growth (juggernaut/stealth push up, satire sags);
  // `crash` = per-second probability a volatile archetype takes a sharp share dip (disruptor).
  // All scaled by diff('rivalAggroMult') and the difficulty AGI-speed mult so harder = livelier.
  // These shape HOW a rival rises/falls; the lifecycle roller (Sub-part B) fires the DRAMA.
  var RIVAL_TRAJ = {
    juggernaut: { vol: 0.010, drift:  0.045, crash: 0.0 },     // steady strong climb
    safety:     { vol: 0.006, drift:  0.010, crash: 0.0 },     // slow, stable, rarely dips
    disruptor:  { vol: 0.060, drift:  0.030, crash: 0.0009 },  // volatile spikes + crash risk
    opensource: { vol: 0.018, drift:  0.020, crash: 0.0 },     // commoditizing pressure
    sovereign:  { vol: 0.030, drift:  0.015, crash: 0.0002 },  // geopolitics swings
    stealth:    { vol: 0.012, drift:  0.000, crash: 0.0 },     // quiet (surge comes via lifecycle)
    satire:     { vol: 0.070, drift: -0.010, crash: 0.0005 }   // chaotic, unstable, sags
  };

  // ---- PHASE 6 — RIVAL LIFECYCLE (Sub-part B) --------------------------
  // A periodic roller in tick() fires at most ONE lifecycle event per cooldown window so the
  // feed stays tense, not spammy. COOLDOWN_SEC is the base gap; difficulty scales it (harder =
  // shorter = more churn). MIN_GEN gates it behind the mid-game so the opening stays clean.
  // Each event's `w` is a base weight; the roller picks weighted-random among ELIGIBLE events.
  var RIVAL_LIFECYCLE = {
    MIN_GEN: 2,               // no lifecycle drama before your 2nd model (race must be live)
    COOLDOWN_SEC: 75,         // base gap between lifecycle events (×difficulty cooldownMult)
    FIRST_DELAY_SEC: 60,      // grace after reveal before the first event can fire
    SHIP_SHARE: [3, 7],       // share jump when a rival ships a model
    SHIP_AGI: [4, 9],         // AGI jump on a ship
    SCANDAL_SHARE: [-6, -2],  // share dip on a scandal/incident
    BANKRUPT_SHARE_MAX: 7,    // only rivals at/under this share can go bankrupt
    BANKRUPT_MIN_FIELD: 2,    // never empty the field: keep at least this many active rivals
    MERGE_MIN_FIELD: 3,       // need at least this many to absorb one
    ENTRANT_SURGE: [10, 16],  // a dark-horse enters near this share (impactful)
    ENTRANT_AGI: [6, 14],
    weights: { ship: 5, scandal: 4, bankrupt: 2, merge: 2, entrant: 1 }
  };

  // ---- Endings (resolve at the AGI climax; each = badge + small meta-perk) ----
  var ENDINGS = {
    PERK_PER: 0.04,         // +4% permanent global output per UNIQUE ending unlocked
    list: ['aligned', 'foom', 'nationalized', 'beaten', 'quiet', 'bankrupt', 'absorbed'],
    // thresholds evaluated at ascension (avgVec = mean of risk vectors)
    QUIET_TRUST: 85, QUIET_AVGVEC: 18,
    NATIONALIZED_TRUST: 30, NATIONALIZED_AVGVEC: 65, NATIONALIZED_ESC: 3,
    FOOM_ALIGN: 3, FOOM_CAP: 55
  };

  // ---- Trust / Reputation ----------------------------------------------
  // Trust matters every second: output x scales 0.90 (trust 0) -> 1.00 (50) -> 1.10 (100).
  // High Trust unlocks premium contracts; low Trust adds regulatory pressure.
  var TRUST = { START: 60, MAX: 100, MIN: 0, OUTPUT_LO: 0.90, OUTPUT_HI: 1.10, LOW_REG_PRESSURE: 0.04 };

  // ---- Unified card system: crises + news decisions + opportunities -----
  // effect keys: cashFrac (-fraction of cash), trust (+/-), vec {id:delta},
  // penaltySec (output crisis penalty), allMult (one-time permanent x), cashGift (x seconds of cps)
  var CARDS = {
    CRISIS_EXPIRE: 28,        // seconds to decide before a crisis escalates
    NEWS_MIN: 100, NEWS_MAX: 180, // seconds between news/opportunity spawns
    NEWS_LIFE: 45,            // seconds an actionable news item stays
    // Anti-printer cap: any single cash windfall (cashGift) is capped at this
    // fraction of your best proven run, so World cards stay a bonus — never a
    // self-compounding money printer. cashGift values below are "seconds of cps".
    CASHGIFT_CAP_FRAC: 0.04,
    crises: [
      { id: 'c_cap', vector: 'cap', choices: [
        { id: 'pull',   effect: { cashFrac: -0.18 } },
        { id: 'spin',   effect: { trust: -10, vec: { reg: 18 } } },
        { id: 'ignore', effect: { penaltySec: 90 } } ] },
      { id: 'c_data', vector: 'data', choices: [
        { id: 'disclose', effect: { cashFrac: -0.15, trust: 6 } },
        { id: 'coverup',  effect: { trust: -16, vec: { reg: 22 } } },
        { id: 'ignore',   effect: { penaltySec: 90 } } ] },
      { id: 'c_reg', vector: 'reg', choices: [
        { id: 'comply', effect: { cashFrac: -0.12, trust: 8 } },
        { id: 'lobby',  effect: { cashFrac: -0.3, trust: -6 } },
        { id: 'ignore', effect: { penaltySec: 90, trust: -4 } } ] },
      { id: 'c_sec', vector: 'sec', choices: [
        { id: 'patch',  effect: { cashFrac: -0.14 } },
        { id: 'ransom', effect: { cashFrac: -0.28, trust: -5 } },
        { id: 'ignore', effect: { penaltySec: 90, vec: { sec: 20 } } } ] },
      { id: 'c_cap2', vector: 'cap', choices: [
        { id: 'sandbox', effect: { cashFrac: -0.16 } },
        { id: 'ship',    effect: { trust: -12, vec: { reg: 16 } } },
        { id: 'ignore',  effect: { penaltySec: 90 } } ] },
      { id: 'c_reg2', vector: 'reg', choices: [
        { id: 'settle',  effect: { cashFrac: -0.2, trust: 6 } },
        { id: 'appeal',  effect: { cashFrac: -0.1, vec: { reg: 14 } } },
        { id: 'ignore',  effect: { penaltySec: 90, trust: -5 } } ] },
      { id: 'c_data2', vector: 'data', choices: [
        { id: 'optout',  effect: { cashFrac: -0.13, trust: 5 } },
        { id: 'sell',    effect: { cashGift: 120, trust: -14, vec: { reg: 18 } } },
        { id: 'ignore',  effect: { penaltySec: 90 } } ] }
    ],
    // news decisions (two-choice) + opportunities (single act). gated behind progress.
    news: [
      { id: 'n_oss', kind: 'decision', choices: [
        { id: 'match',  effect: { cashFrac: -0.2, trust: 4 } },
        { id: 'ignore', effect: { penaltySec: 45 } } ] },
      { id: 'n_poach', kind: 'decision', choices: [
        { id: 'counter', effect: { cashFrac: -0.15 } },
        { id: 'letgo',   effect: { vec: { sec: 12 } } } ] },
      { id: 'n_round', kind: 'opportunity', choices: [
        { id: 'raise', effect: { cashGift: 240, trust: -3 } } ] },
      { id: 'n_chip', kind: 'opportunity', choices: [
        { id: 'buy', effect: { allMult: 1.05 } } ] },
      { id: 'n_grant', kind: 'opportunity', req: { trust: 70 }, choices: [
        { id: 'accept', effect: { cashGift: 300, trust: 3 } } ] },
      { id: 'n_defense', kind: 'opportunity', req: { trust: 85 }, choices: [
        { id: 'sign', effect: { cashGift: 420, vec: { reg: 12 } } } ] },
      { id: 'n_viral', kind: 'decision', choices: [
        { id: 'lean',  effect: { trust: -6, cashGift: 180, vec: { reg: 10 } } },
        { id: 'damp',  effect: { trust: 5 } } ] },
      { id: 'n_whistle', kind: 'decision', choices: [
        { id: 'address', effect: { cashFrac: -0.12, trust: 8 } },
        { id: 'silence', effect: { trust: -15, vec: { sec: 14 } } } ] },
      { id: 'n_audit', kind: 'opportunity', choices: [
        { id: 'invite', effect: { trust: 7, cashFrac: -0.08 } } ] }
    ]
  };

  // ===== DECISION ENGINE (Phase 2) — events as DATA ======================
  // The decision engine reads these declarative rows; one generic runtime fires
  // them (see game.js evalCond/decision pacer). NOTE: the older C.EVENTS object
  // above is the world/industry-frenzy system and is UNRELATED — decision events
  // live under C.DECISIONS to avoid any collision.
  //
  // Schema (design §4):
  //   { id, act:[..], category, weight, cooldown_sec, once, default_option?,
  //     priority:'interrupt'|'bankable'|'ambient',
  //     trigger:{<cond-tree>}, weight_mods:[{factor, when:{<cond-tree>}}],
  //     options:[{ id, trigger?, tooltip_meters?, effects:{<applyEffect grammar>} }] }
  // i18n keys: {id}_t (title), {id}_d (desc), {id}_{optionId} (option label).
  //
  // ⚠ PHASE 2 = ~6 TEST events to exercise the engine. Phase 3 expands to 70–90
  //   real events from DESIGN-events-catalog.md. Each test row is marked TEST.
  var DECISIONS_PACING = {
    FIRST_DELAY: 25,        // no decision before this much ACTIVE playtime (sec)
    FIRST_INTERVAL_MIN: 35, // onboarding: the FIRST decision lands ~25+35..25+65s = 60–90s in
    FIRST_INTERVAL_MAX: 65, // (settles to the normal cadence below once one has fired)
    INTERVAL_MIN: 120,      // ~one decision per 2–4 min of active play (Act-scaled below)
    INTERVAL_MAX: 240,
    ACT_SPEEDUP: 0.12,      // each act shortens the interval by this fraction (later acts = busier)
    QUIET_FLOOR: 45,        // hard minimum gap between ANY two decisions (a breathing floor)
    CATEGORY_COOLDOWN: 90,  // per-category cooldown (no two of one category back-to-back, sec)
    NO_REPEAT_SEC: 60,      // global "no repeat within a day" — per-event re-fire floor (1 day = DAY_SEC)
    BANKABLE_AUTO_SEC: 240  // a bankable decision auto-resolves (default option) after this if ignored
  };
  // ===== PHASE 4 — SEVERITY TIERS GATED BY SIZE (DESIGN §3) ===============
  // Each rollable decision is tagged with a size TIER. A tier maps to a valuation band; an
  // event only enters the draw POOL while the player's valuation() sits inside its band (a
  // garage lab can't draw a $2B antitrust suit; a $50B frontier lab stops drawing trivial
  // garage onboarding events). Bands OVERLAP at the seams (the `out` margins below) so the
  // pool transitions smoothly instead of snapping empty at a hard boundary, and an event can
  // OVERRIDE with explicit minVal/maxVal. Events WITHOUT a tier (e.g. scheduled callbacks)
  // are NEVER gated by size — they fire on their own trigger logic. Keeps early game gentle.
  //   tier 1 Garage · tier 2 Startup · tier 3 Scale-up · tier 4 Frontier (existential)
  // The design frames the bands in REAL-WORLD money ($50M / $1B / $20B). The game's valuation()
  // is a deliberately COMPRESSED "company worth" (CORE comment: kept in the same universe as the
  // player's cash, NOT annualised run-rate × multiple), so it runs ~$200 (fresh garage) → ~$7B
  // (AGI race). These band edges are calibrated to THAT in-game curve (verified against the act
  // progression) while keeping the design's tier LABELS: Garage <$5K · Startup $5K–$100K ·
  // Scale-up $100K–$5M · Frontier >$5M (the "$20B existential" bracket of the compressed economy).
  var DECISION_TIERS = {
    GARAGE:   { tier: 1, min: 0,     max: 5e3      },   // fresh lab → first models
    STARTUP:  { tier: 2, min: 5e3,   max: 1e5      },   // shipping v2–v3, first share
    SCALEUP:  { tier: 3, min: 1e5,   max: 5e6      },   // real lab: regulators, compute wars
    FRONTIER: { tier: 4, min: 5e6,   max: Infinity }    // existential: antitrust, nationalization
  };
  // Per-tier OVERLAP margin: a tier's effective gate is widened by these fractions of its band
  // so events linger one notch past their nominal band (smooth pool hand-off, no dead air).
  //   effMin = min × (1 − OUT_LOW)   effMax = max × (1 + OUT_HIGH)
  var DECISION_TIER_OVERLAP = { OUT_LOW: 0.5, OUT_HIGH: 1.0 };
  // resolve a numeric tier (1..4) to its {min,max} band (with overlap applied). Tier 1's lower
  // edge stays at 0; the top tier's upper edge stays Infinity.
  var DECISION_TIER_BY_NUM = { 1: DECISION_TIERS.GARAGE, 2: DECISION_TIERS.STARTUP, 3: DECISION_TIERS.SCALEUP, 4: DECISION_TIERS.FRONTIER };
  // ===== EXECUTIVE / MANAGING DIRECTOR ladder (DESIGN-exec-team.md) =====
  // ONE slot, a long tier ladder. While you're AWAY, your director auto-resolves the
  // decisions that "would have fired" — quality scales with `judgment` (0..100) and your
  // MANDATE. Cost + recruit time + judgment escalate up the ladder; the TOP tier is gated
  // by high valuation + high trust + a huge signing package + a multi-day timer so reaching
  // it is the ~15-real-day "white whale" of the monthly arc.
  //   { id, name(i18n key), judgment, costCash, recruitSec, gate?{valuation,trust,modelGen}, perk? }
  // perk = a small ONLINE bonus (decoration; honored where noted). recruitSec is REAL wall-clock.
  var H = 3600;  // one real hour, in seconds (recruit timers are real-time)
  var EXECS = [
    { id: 'exec_t1',  name: 'exec_t1_name',  judgment: 10, costCash: 250,        recruitSec: 120 },
    { id: 'exec_t2',  name: 'exec_t2_name',  judgment: 20, costCash: 1500,       recruitSec: 300,        perk: { buildSpeed: 0.03 } },
    { id: 'exec_t3',  name: 'exec_t3_name',  judgment: 30, costCash: 9000,       recruitSec: 0.75 * H,   perk: { buildSpeed: 0.06 } },
    { id: 'exec_t4',  name: 'exec_t4_name',  judgment: 40, costCash: 55000,      recruitSec: 2 * H,      perk: { researchSpeed: 0.05 } },
    { id: 'exec_t5',  name: 'exec_t5_name',  judgment: 50, costCash: 320000,     recruitSec: 5 * H,      perk: { researchSpeed: 0.08 } },
    { id: 'exec_t6',  name: 'exec_t6_name',  judgment: 62, costCash: 1.9e6,      recruitSec: 12 * H,     perk: { researchSpeed: 0.10 } },
    { id: 'exec_t7',  name: 'exec_t7_name',  judgment: 72, costCash: 1.1e7,      recruitSec: 22 * H,     perk: { riskDamp: 0.06 } },
    { id: 'exec_t8',  name: 'exec_t8_name',  judgment: 82, costCash: 6.5e7,      recruitSec: 40 * H,     perk: { dealBonus: 0.10 },
      gate: { valuation: 5e8, trust: 60 } },
    { id: 'exec_t9',  name: 'exec_t9_name',  judgment: 90, costCash: 4e8,        recruitSec: 72 * H,     perk: { dealBonus: 0.15 },
      gate: { valuation: 5e9, trust: 70, modelGen: 4 } },
    { id: 'exec_t10', name: 'exec_t10_name', judgment: 99, costCash: 1e8 /*signing bonus shown separately*/, recruitSec: 96 * H,
      perk: { dealBonus: 0.20, researchSpeed: 0.10 },
      gate: { valuation: 5e10, trust: 80, modelGen: 6 }, legendary: true,
      signing: 2.5e9 /*$2.5B signing package on TOP of base cost*/ },
  ];
  // offline delegation: how often a decision "would have fired" while away (avg real sec).
  // N resolved = clamp(floor(awaySec / this), 0, MAX).
  var EXECS_OFFLINE = { AVG_DECISION_SEC: 1800, MAX_RESOLVED: 6 };

  // PHASE 3 WAVE 1 — ~40 real decision events (≈4 per category × 10 catalog cats).
  // Reskinned from DESIGN-events-catalog.md (130 real situations). Rivals = Helion /
  // Cerebra / OmniNet. Balance rule enforced: every option costs something, trade-offs
  // cross OPPOSED meters (speed/share/valuation ↑ ↔ align ↓ / risk ↑), trust gates the
  // virtuous path. Three multi-stage ARCS use schedule() (ids tagged ARC-* below).
  // The two catalog topics flagged sensitive (whistleblower death, teen-suicide case)
  // are deliberately SKIPPED in this wave. i18n: {id}_t/_d + {id}_{optionId} (EN+RU).
  var DECISIONS = [

    // ===================== EARLY GAME — ACT 0/1 (garage & startup) =====================
    // Onboarding-grade dilemmas with LOW or no gates so the FIRST decision surfaces fast
    // on a fresh game (act 0 = garage). Mostly bankable, a couple interrupt, a couple
    // ambient. Effects stay modest (garage economy is tiny). i18n: {id}_t/_d + per-option.
    {
      id: 'dec_eq_split', tier: 1, act: [0, 1], category: 'funding', weight: 130,
      cooldown_sec: 0, once: true, priority: 'interrupt',
      trigger: { 'meter.act': '<=1' },
      options: [
        { id: 'equal', tooltip_meters: ['trust'],
          effects: { meter: { trust: '+4' }, set_var: { founder_goodwill: '+1' } } },
        { id: 'control', tooltip_meters: ['trust', 'cash'],
          effects: { resource: { cash: '+40' }, meter: { trust: '-3' }, set_var: { founder_friction: '+1' } } }
      ]
    },
    {
      id: 'dec_first_hire', tier: 1, act: [0, 1], category: 'talent', weight: 120,
      cooldown_sec: 200, once: true, priority: 'bankable', default_option: 'generalist',
      trigger: { 'resource.compute': '>=10' },
      options: [
        { id: 'generalist', tooltip_meters: ['cash', 'researchers'],
          effects: { resource: { cash: '-40', researchers: '+1' } } },
        { id: 'specialist', tooltip_meters: ['cash', 'researchers', 'trust'],
          effects: { resource: { cash: '-90', researchers: '+1' }, meter: { trust: '+2' } } },
        { id: 'solo', tooltip_meters: ['cash', 'risk'],
          effects: { resource: { cash: '+20' }, set_var: { burnout_debt: '+1' } } }
      ]
    },
    {
      id: 'dec_ramen_or_raise', tier: 1, act: [0, 1], category: 'funding', weight: 110,
      cooldown_sec: 220, once: false, priority: 'bankable', default_option: 'ramen',
      trigger: { 'resource.compute': '>=15' },
      options: [
        { id: 'ramen', tooltip_meters: ['trust'],
          effects: { meter: { trust: '+2' }, set_var: { indie_cred: '+1' } } },
        { id: 'raise', tooltip_meters: ['cash', 'trust'],
          effects: { resource: { cash: '+120' }, meter: { trust: '-2' }, set_var: { dilution: '+1' } } }
      ]
    },
    {
      id: 'dec_first_customer', tier: 1, act: [0, 1], category: 'product', weight: 105,
      cooldown_sec: 220, once: true, priority: 'interrupt',
      trigger: { 'resource.compute': '>=25' },
      options: [
        { id: 'build_it', tooltip_meters: ['cash', 'trust', 'risk'],
          effects: { resource: { cash: '+150' }, meter: { trust: '-2' }, vec: { sec: 6 }, set_var: { tech_debt: '+1' } } },
        { id: 'say_no', tooltip_meters: ['cash', 'trust'],
          effects: { meter: { trust: '+3' } } }
      ]
    },
    {
      id: 'dec_vanity_metric', tier: 1, act: [0, 1, 2], category: 'funding', weight: 95,
      cooldown_sec: 220, once: false, priority: 'bankable', default_option: 'honest',
      trigger: { 'resource.compute': '>=20' },
      options: [
        { id: 'juice', tooltip_meters: ['cash', 'trust', 'risk'],
          effects: { resource: { cash: '+80' }, meter: { trust: '-4' }, set_var: { vanity_debt: '+1' } } },
        { id: 'honest', tooltip_meters: ['trust'],
          effects: { meter: { trust: '+2' } } }
      ]
    },
    {
      id: 'dec_name_model', tier: 1, act: [0, 1], category: 'pr', weight: 100,
      cooldown_sec: 0, once: true, priority: 'ambient', default_option: 'sensible',
      trigger: { 'resource.compute': '>=12' },
      options: [
        { id: 'sensible', tooltip_meters: ['trust'],
          effects: { meter: { trust: '+1' } } },
        { id: 'edgy', tooltip_meters: ['trust', 'risk'],
          effects: { meter: { trust: '-1' }, vec: { sec: 3 } } }
      ]
    },
    {
      id: 'dec_viral_demo', tier: 1, act: [0, 1], category: 'pr', weight: 100,
      cooldown_sec: 200, once: false, priority: 'interrupt',
      trigger: { 'resource.compute': '>=30' },
      options: [
        { id: 'overpromise', tooltip_meters: ['cash', 'trust', 'risk'],
          effects: { resource: { cash: '+90' }, meter: { trust: '-3' }, set_var: { hype_debt: '+1' },
                     schedule: { event: 'dec_demo_backlash', delaySec: 110, chance: 0.5, callback: 'callback_hype' } } },
        { id: 'caveat', tooltip_meters: ['cash', 'trust'],
          effects: { resource: { cash: '+25' }, meter: { trust: '+2' } } }
      ]
    },
    {
      id: 'dec_demo_backlash', act: [0, 1, 2, 3], category: 'pr', weight: 0,
      cooldown_sec: 0, once: false, priority: 'scheduled', _callback: true,
      trigger: { OR: [] },
      options: [
        { id: 'apologize', tooltip_meters: ['trust', 'cash'],
          effects: { resource: { cash: '-30' }, meter: { trust: '+3' } } },
        { id: 'double_down', tooltip_meters: ['trust', 'risk'],
          effects: { meter: { trust: '-4' }, vec: { sec: 6 } } }
      ]
    },
    {
      id: 'dec_open_or_closed', tier: 1, act: [0, 1], category: 'opensource', weight: 95,
      cooldown_sec: 220, once: true, priority: 'bankable', default_option: 'closed',
      trigger: { 'resource.compute': '>=18' },
      options: [
        { id: 'open', tooltip_meters: ['trust', 'risk'],
          effects: { meter: { trust: '+5' }, vec: { sec: 4 }, set_flag: 'oss_lab' } },
        { id: 'closed', tooltip_meters: ['cash', 'trust'],
          effects: { resource: { cash: '+30' }, meter: { trust: '-1' } } }
      ]
    },
    {
      id: 'dec_journalist', tier: 1, act: [0, 1, 2], category: 'pr', weight: 90,
      cooldown_sec: 240, once: false, priority: 'bankable', default_option: 'decline',
      trigger: { 'resource.compute': '>=22' },
      options: [
        { id: 'interview', tooltip_meters: ['trust', 'risk'],
          effects: { meter: { trust: '+4' }, vec: { reg: 3 } } },
        { id: 'decline', tooltip_meters: ['trust'],
          effects: { meter: { trust: '-1' } } }
      ]
    },
    {
      id: 'dec_gpu_spike', tier: 1, act: [0, 1, 2], category: 'compute', weight: 100,
      cooldown_sec: 200, once: false, priority: 'bankable', default_option: 'absorb',
      trigger: { 'resource.compute': '>=14' },
      weight_mods: [{ factor: 1.4, when: { 'resource.compute': '>=200' } }],
      options: [
        { id: 'absorb', tooltip_meters: ['cash', 'compute'],
          effects: { resource: { cash: '-60', compute: '+30' } } },
        { id: 'pause', tooltip_meters: ['compute', 'trust'],
          effects: { meter: { trust: '-1' }, set_var: { compute_debt: '+1' } } }
      ]
    },
    {
      id: 'dec_poach_engineer', tier: 1, act: [0, 1], category: 'talent', weight: 110,
      cooldown_sec: 180, once: false, priority: 'interrupt',
      trigger: { 'resource.researchers': '>=1' },
      options: [
        { id: 'match_offer', tooltip_meters: ['cash', 'researchers'],
          effects: { resource: { cash: '-110' } } },
        { id: 'let_walk', tooltip_meters: ['researchers', 'risk'],
          effects: { resource: { researchers: '-1' }, vec: { sec: 5 } } },
        { id: 'equity_plea', tooltip_meters: ['trust'],
          effects: { meter: { trust: '+1' }, set_var: { dilution: '+1' } } }
      ]
    },
    {
      id: 'dec_cloud_credits', tier: 1, act: [0, 1], category: 'compute', weight: 95,
      cooldown_sec: 240, once: true, priority: 'bankable', default_option: 'decline',
      trigger: { 'resource.compute': '>=16' },
      options: [
        { id: 'accept', tooltip_meters: ['cash', 'compute', 'trust'],
          effects: { resource: { cash: '+40', compute: '+60' }, meter: { trust: '-2' }, set_flag: 'cloud_locked' } },
        { id: 'decline', tooltip_meters: ['compute', 'trust'],
          effects: { meter: { trust: '+1' } } }
      ]
    },

    // ========================= REGULATION (4) =============================
    // ARC-REG: a one-shot safe-harbor pledge → its delayed disclosure bill.
    {
      id: 'dec_reg_eu_act', tier: 3, act: [2, 3], category: 'regulation', weight: 95,
      cooldown_sec: 240, once: false, priority: 'interrupt',
      trigger: { AND: [{ 'meter.marketShare': '>=8' }, { 'meter.vec.reg': '>=20' }] },
      weight_mods: [{ factor: 2.0, when: { 'meter.vec.reg': '>=55' } }],
      options: [
        { id: 'comply', tooltip_meters: ['cash', 'trust', 'risk'],
          effects: { resource: { cashMonthsBurn: -1.5 }, meter: { trust: '+5', marketShare: '-2' }, vec: { reg: -16 } } },
        { id: 'minimal', tooltip_meters: ['cash', 'risk'],
          effects: { resource: { cashMonthsBurn: -0.4 }, vec: { reg: -4 }, set_var: { reg_debt: '+1' } } },
        { id: 'defy', tooltip_meters: ['marketShare', 'risk', 'trust'],
          effects: { meter: { marketShare: '+5', trust: '-3' }, vec: { reg: 18 },
                     schedule: { event: 'dec_reg_fine_hits', delaySec: 150, chance: 0.5, callback: 'callback_reg_fine' } } }
      ]
    },
    {
      id: 'dec_reg_safe_harbor', tier: 3, act: [2, 3], category: 'regulation', weight: 70,
      cooldown_sec: 300, once: true, priority: 'bankable', default_option: 'decline',
      trigger: { AND: [{ 'meter.marketShare': '>=10' }, { 'meter.trust': '>=35' }] },
      options: [
        { id: 'sign', tooltip_meters: ['trust', 'risk', 'marketShare'],
          effects: { meter: { trust: '+6', marketShare: '-2' }, vec: { reg: -10 }, set_flag: 'signed_code',
                     schedule: { event: 'dec_reg_disclosure_bill', delaySec: 180, chance: 0.8, callback: 'callback_disclosure' } } },
        { id: 'decline', tooltip_meters: ['risk', 'trust'],
          effects: { meter: { trust: '-2' }, vec: { reg: 6 } } }
      ]
    },
    {
      id: 'dec_reg_disclosure_bill', act: [2, 3], category: 'regulation', weight: 0,
      cooldown_sec: 0, once: false, priority: 'scheduled', _callback: true,
      trigger: { OR: [] },
      options: [
        { id: 'disclose', tooltip_meters: ['trust', 'marketShare', 'risk'],
          effects: { meter: { trust: '+5', marketShare: '-4' }, vec: { data: 8, reg: -8 } } },
        { id: 'redact', tooltip_meters: ['marketShare', 'risk', 'trust'],
          effects: { meter: { marketShare: '+2', trust: '-4' }, vec: { reg: 12 } } }
      ]
    },
    {
      id: 'dec_reg_patchwork', tier: 3, act: [2, 3], category: 'regulation', weight: 80,
      cooldown_sec: 220, once: false, priority: 'bankable', default_option: 'comply_all',
      trigger: { 'meter.marketShare': '>=12' },
      options: [
        { id: 'comply_all', tooltip_meters: ['cash', 'risk'],
          effects: { resource: { cashMonthsBurn: -1 }, vec: { reg: -8 } } },
        { id: 'geoblock', tooltip_meters: ['marketShare', 'trust'],
          effects: { meter: { marketShare: '-3', trust: '+2' }, vec: { reg: -4 } } },
        { id: 'ignore', tooltip_meters: ['marketShare', 'risk'],
          effects: { meter: { marketShare: '+3' }, vec: { reg: 10 }, set_var: { reg_debt: '+1' } } }
      ]
    },
    {
      id: 'dec_reg_fine_hits', act: [2, 3], category: 'regulation', weight: 0,
      cooldown_sec: 0, once: false, priority: 'scheduled', _callback: true,
      trigger: { OR: [] },
      options: [
        { id: 'pay', tooltip_meters: ['cash', 'trust', 'risk'],
          effects: { cashFrac: -0.10, meter: { trust: '+2' }, vec: { reg: -12 } } },
        { id: 'appeal', tooltip_meters: ['cash', 'risk', 'trust'],
          effects: { resource: { cashMonthsBurn: -0.6 }, meter: { trust: '-3' }, vec: { reg: 8 } } }
      ]
    },

    // ========================= COMPUTE / CHIPS (4) =======================
    {
      id: 'dec_chip_takeorpay', tier: 3, act: [2, 3], category: 'compute', weight: 90,
      cooldown_sec: 240, once: false, priority: 'interrupt',
      trigger: { 'resource.compute': '>=200' },
      weight_mods: [{ factor: 1.6, when: { 'meter.marketShare': '>=20' } }],
      options: [
        { id: 'lockin', tooltip_meters: ['cash', 'compute', 'risk'],
          effects: { resource: { cashMonthsBurn: -2, compute: '+400' }, set_var: { capex_debt: '+1' } } },
        { id: 'wait', tooltip_meters: ['compute', 'marketShare', 'risk'],
          effects: { meter: { marketShare: '-2' }, vec: { cap: -4 }, rival_effect: { helion: { agi: 1.5 } } } },
        { id: 'efficiency', tooltip_meters: ['cash', 'compute', 'align'],
          effects: { resource: { cashMonthsBurn: -0.6, compute: '+120' }, meter: { align: '+1' } } }
      ]
    },
    {
      id: 'dec_chip_datacenter', tier: 3, act: [2, 3], category: 'compute', weight: 75,
      cooldown_sec: 260, once: false, priority: 'bankable', default_option: 'permits',
      trigger: { 'resource.compute': '>=400' },
      options: [
        { id: 'permits', tooltip_meters: ['cash', 'compute', 'trust'],
          effects: { resource: { cashMonthsBurn: -1, compute: '+180' }, meter: { trust: '+2' } } },
        { id: 'fasttrack', tooltip_meters: ['compute', 'trust', 'risk'],
          effects: { resource: { compute: '+320' }, meter: { trust: '-4' }, vec: { reg: 10 },
                     schedule: { event: 'dec_chip_grid_backlash', delaySec: 160, chance: 0.5 } } }
      ]
    },
    {
      id: 'dec_chip_grid_backlash', act: [2, 3], category: 'compute', weight: 0,
      cooldown_sec: 0, once: false, priority: 'scheduled', _callback: true,
      trigger: { OR: [] },
      options: [
        { id: 'subsidize', tooltip_meters: ['cash', 'trust'],
          effects: { resource: { cashMonthsBurn: -0.8 }, meter: { trust: '+4' } } },
        { id: 'stonewall', tooltip_meters: ['trust', 'risk'],
          effects: { meter: { trust: '-6' }, vec: { reg: 12 } } }
      ]
    },
    {
      id: 'dec_chip_custom_silicon', tier: 4, act: [3], category: 'compute', weight: 60,
      cooldown_sec: 300, once: true, priority: 'bankable', default_option: 'stay',
      trigger: { AND: [{ 'resource.compute': '>=2000' }, { 'resource.cash': '>=600' }] },
      options: [
        { id: 'build', tooltip_meters: ['cash', 'compute', 'risk'],
          effects: { resource: { cashMonthsBurn: -2.5 }, meter: { valuation: '+8' },
                     buff: { key: 'silicon', mult: 1.15, days: 6 }, set_var: { capex_debt: '+1' } } },
        { id: 'stay', tooltip_meters: ['cash', 'compute'],
          effects: { resource: { compute: '+150' } } }
      ]
    },
    {
      id: 'dec_chip_deepseek_shock', tier: 3, act: [2, 3], category: 'compute', weight: 55,
      cooldown_sec: 280, once: true, priority: 'interrupt',
      trigger: { 'meter.marketShare': '>=18' },
      options: [
        { id: 'pivot', tooltip_meters: ['cash', 'compute', 'align'],
          effects: { resource: { cashMonthsBurn: -0.8 }, meter: { align: '+2', valPct: -0.04 }, buff: { key: 'efficiency', mult: 1.1, days: 5 } } },
        { id: 'doubledown', tooltip_meters: ['compute', 'valuation', 'risk'],
          effects: { resource: { compute: '+260' }, meter: { valuation: '+4', marketShare: '+3' }, vec: { cap: 8 } } }
      ]
    },

    // ========================= TALENT (4) ================================
    {
      id: 'dec_talent_poach', tier: 2, act: [1, 2, 3], category: 'talent', weight: 100,
      cooldown_sec: 180, once: false, priority: 'bankable', default_option: 'counter',
      trigger: { 'resource.researchers': '>=1' },
      weight_mods: [{ factor: 1.4, when: { 'meter.marketShare': '>=15' } }],
      options: [
        { id: 'counter', tooltip_meters: ['cash', 'researchers'],
          effects: { resource: { cash: '-150' } } },
        { id: 'letgo', tooltip_meters: ['researchers', 'risk'],
          effects: { resource: { researchers: '-1' }, vec: { sec: 8 }, rival_effect: { cerebra: { agi: 1 } } } },
        // SUB-PART C — gamble: counter-raid the rival back for a researcher. 60% lands the hire / 40% they decline & you lose face.
        { id: 'raid', tooltip_meters: ['cash', 'researchers', 'trust'], gamble: [60, 40],
          effects: { resource: { cash: '-300' } },   // the signing war chest is spent either way
          outcomes: [
            { id: 'landed', chance: 0.60, good: true, news: 'dec_talent_poach_landed_news', effect: { resource: { researchers: '+1' } } },
            { id: 'declined', chance: 0.40, good: false, news: 'dec_talent_poach_declined_news', effect: { meter: { trust: '-4' } } }
          ] }
      ]
    },
    {
      id: 'dec_talent_megapackage', tier: 3, act: [2, 3], category: 'talent', weight: 70,
      cooldown_sec: 240, once: false, priority: 'interrupt',
      trigger: { AND: [{ 'resource.cash': '>=400' }, { 'meter.marketShare': '>=18' }] },
      options: [
        { id: 'match', tooltip_meters: ['cash', 'researchers', 'valuation'],
          effects: { resource: { cashMonthsBurn: -1.5, researchers: '+1' }, meter: { valuation: '+3' } } },
        { id: 'walk', tooltip_meters: ['researchers', 'risk', 'cash'],
          effects: { resource: { researchersPct: -0.08 }, vec: { cap: 6 }, rival_effect: { helion: { agi: 2 } } } }
      ]
    },
    {
      id: 'dec_talent_acquihire', tier: 4, act: [3], category: 'talent', weight: 55,
      cooldown_sec: 300, once: true, priority: 'bankable', default_option: 'pass',
      trigger: { 'resource.cash': '>=800' },
      options: [
        { id: 'absorb', tooltip_meters: ['cash', 'researchers', 'risk'],
          effects: { resource: { cashMonthsBurn: -3, researchers: '+2' }, meter: { marketShare: '+3' }, vec: { reg: 10 } } },
        { id: 'pass', tooltip_meters: ['cash', 'trust'],
          effects: { meter: { trust: '+2' } } }
      ]
    },
    {
      id: 'dec_talent_noncompete', tier: 2, act: [1, 2], category: 'talent', weight: 65,
      cooldown_sec: 200, once: false, priority: 'ambient', default_option: 'reasonable',
      trigger: { 'resource.researchers': '>=2' },
      options: [
        { id: 'reasonable', tooltip_meters: ['trust'],
          effects: { meter: { trust: '+1' } } },
        { id: 'gardenleave', tooltip_meters: ['cash', 'trust'],
          effects: { resource: { cash: '-60' }, meter: { trust: '-2' } } }
      ]
    },

    // ========================= SAFETY / INCIDENTS (4) ====================
    {
      id: 'dec_safety_review', tier: 2, act: [2, 3], category: 'safety', weight: 85,
      cooldown_sec: 200, once: false, priority: 'bankable', default_option: 'review',
      trigger: { 'resource.modelGen': '>=2' },
      weight_mods: [{ factor: 2.0, when: { 'meter.risk': '>=50' } }],
      options: [
        { id: 'review', tooltip_meters: ['cash', 'risk', 'align'],
          effects: { resource: { cash: '-120' }, meter: { align: '+2' }, vec: { cap: -8 } } },
        { id: 'ship', tooltip_meters: ['marketShare', 'risk', 'align'],
          effects: { meter: { marketShare: '+4', align: '-1' }, vec: { cap: 10 }, set_var: { safety_debt: '+1' },
                     schedule: { event: 'dec_safety_incident_hits', delaySec: 140, chance: 0.45, callback: 'callback_incident' } } }
      ]
    },
    {
      id: 'dec_safety_pledge', tier: 3, act: [2, 3], category: 'safety', weight: 60,
      cooldown_sec: 300, once: true, priority: 'interrupt',
      trigger: { AND: [{ 'meter.marketShare': '>=15' }, { 'meter.trust': '>=30' }] },
      options: [
        { id: 'honor', tooltip_meters: ['compute', 'align', 'trust'],
          effects: { resource: { compute: '-200' }, meter: { align: '+3', trust: '+5' }, vec: { cap: -10 } } },
        { id: 'dissolve', tooltip_meters: ['compute', 'marketShare', 'trust'],
          effects: { resource: { compute: '+200' }, meter: { marketShare: '+5', trust: '-6', align: '-2' }, vec: { cap: 12 } } }
      ]
    },
    {
      id: 'dec_safety_jailbreak', tier: 2, act: [1, 2, 3], category: 'safety', weight: 75,
      cooldown_sec: 200, once: false, priority: 'bankable', default_option: 'patch',
      trigger: { 'resource.modelGen': '>=1' },
      weight_mods: [{ factor: 1.5, when: { 'meter.vec.sec': '>=40' } }],
      options: [
        { id: 'patch', tooltip_meters: ['cash', 'risk'],
          effects: { resource: { cash: '-90' }, vec: { sec: -10 } } },
        // SUB-PART C — gamble: spin the jailbreak as a non-issue instead of patching. 50% blows over / 50% it spreads.
        { id: 'spin', tooltip_meters: ['trust', 'risk'], gamble: [50, 50],
          outcomes: [
            { id: 'blowsover', chance: 0.50, good: true, news: 'dec_safety_jailbreak_blowsover_news', effect: { meter: { trust: '+1' }, vec: { sec: -3 } } },
            { id: 'spreads', chance: 0.50, good: false, news: 'dec_safety_jailbreak_spreads_news', effect: { meter: { trust: '-6' }, vec: { sec: 14 } } }
          ] }
      ]
    },
    {
      id: 'dec_safety_incident_hits', act: [2, 3], category: 'safety', weight: 0,
      cooldown_sec: 0, once: false, priority: 'scheduled', _callback: true,
      trigger: { OR: [] },
      options: [
        { id: 'recall', tooltip_meters: ['cash', 'marketShare', 'trust'],
          effects: { resource: { cashMonthsBurn: -1 }, meter: { marketShare: '-4', trust: '+4' }, vec: { cap: -8 } } },
        { id: 'deny', tooltip_meters: ['trust', 'risk'],
          effects: { meter: { trust: '-8' }, vec: { cap: 8, reg: 10 } } }
      ]
    },

    // ========================= LEGAL (4) =================================
    // ARC-COPYRIGHT: scrape data → (delayed) lawsuit → settle-or-fight.
    {
      id: 'dec_data_dilemma', tier: 2, act: [1, 2], category: 'legal', weight: 100,
      cooldown_sec: 240, once: false, priority: 'interrupt',
      trigger: { AND: [{ 'resource.compute': '>=20' }, { NOT: { flag: 'sued_copyright' } }] },
      weight_mods: [{ factor: 2.0, when: { 'meter.risk': '>=60' } }],
      options: [
        { id: 'pirate', tooltip_meters: ['marketShare', 'risk', 'cash'],
          effects: { meter: { marketShare: '+6' }, vec: { data: 12 }, set_var: { legal_debt: '+1' },
                     schedule: { event: 'dec_lawsuit_hits', delaySec: 120, chance: 0.6, callback: 'callback_lawsuit' } } },
        { id: 'license', tooltip_meters: ['cash', 'trust', 'risk'],
          effects: { resource: { cashMonthsBurn: -1 }, meter: { trust: '+4', marketShare: '-2' }, vec: { data: -6 } } }
      ]
    },
    {
      id: 'dec_lawsuit_hits', act: [1, 2, 3], category: 'legal', weight: 0,
      cooldown_sec: 0, once: false, priority: 'scheduled', _callback: true,
      trigger: { OR: [] },
      options: [
        { id: 'settle', tooltip_meters: ['cash', 'trust'],
          effects: { resource: { cashPctVal: -0.08 }, meter: { trust: '+2' }, vec: { data: -4 } } },
        { id: 'fight', tooltip_meters: ['cash', 'risk', 'trust'],
          effects: { resource: { cashMonthsBurn: -1 }, meter: { trust: '-4' }, vec: { reg: 14 }, set_flag: 'sued_copyright' } }
      ]
    },
    {
      id: 'dec_legal_logs', tier: 3, act: [2, 3], category: 'legal', weight: 70,
      cooldown_sec: 240, once: false, priority: 'interrupt',
      trigger: { AND: [{ 'meter.marketShare': '>=15' }, { 'resource.modelGen': '>=3' }] },
      options: [
        { id: 'preserve', tooltip_meters: ['trust', 'risk', 'marketShare'],
          effects: { meter: { trust: '-5', marketShare: '-2' }, vec: { reg: -6 } } },
        { id: 'resist', tooltip_meters: ['cash', 'trust', 'risk'],
          effects: { resource: { cashMonthsBurn: -1 }, meter: { trust: '+4' }, vec: { reg: 10 } } }
      ]
    },
    {
      id: 'dec_legal_defamation', tier: 2, act: [2, 3], category: 'legal', weight: 60,
      cooldown_sec: 220, once: false, priority: 'bankable', default_option: 'disclaim',
      trigger: { 'resource.modelGen': '>=2' },
      options: [
        { id: 'disclaim', tooltip_meters: ['cash', 'marketShare', 'trust'],
          effects: { resource: { cash: '-60' }, meter: { marketShare: '-1', trust: '+1' } } },
        { id: 'litigate', tooltip_meters: ['cash', 'risk', 'trust'],
          effects: { resource: { cash: '-160' }, meter: { trust: '-2' }, vec: { reg: 6 } } }
      ]
    },

    // ========================= OPEN-SOURCE (4) ===========================
    {
      id: 'dec_oss_release', tier: 2, act: [1, 2, 3], category: 'opensource', weight: 65,
      cooldown_sec: 200, once: false, priority: 'bankable', default_option: 'gated',
      trigger: { 'resource.modelGen': '>=2' },
      options: [
        { id: 'open', tooltip_meters: ['trust', 'marketShare', 'risk'],
          effects: { meter: { trust: '+5', marketShare: '-3' }, vec: { sec: 8 }, rival_effect: { all: { agi: 1 } } } },
        { id: 'gated', tooltip_meters: ['marketShare', 'trust'],
          effects: { meter: { marketShare: '+2', trust: '-1' } } }
      ]
    },
    {
      id: 'dec_oss_weights_leak', tier: 3, act: [2, 3], category: 'opensource', weight: 55,
      cooldown_sec: 260, once: false, priority: 'interrupt',
      trigger: { AND: [{ 'resource.modelGen': '>=3' }, { 'meter.vec.sec': '>=30' }] },
      options: [
        { id: 'embrace', tooltip_meters: ['trust', 'marketShare', 'risk'],
          effects: { meter: { trust: '+3', marketShare: '-2' }, vec: { sec: 6 }, rival_effect: { all: { agi: 1.5 } } } },
        { id: 'legal', tooltip_meters: ['cash', 'risk', 'trust'],
          effects: { resource: { cashMonthsBurn: -0.7 }, meter: { trust: '-2' }, vec: { sec: -6, reg: 6 } } }
      ]
    },
    {
      id: 'dec_oss_distill_claim', tier: 3, act: [2, 3], category: 'opensource', weight: 50,
      cooldown_sec: 240, once: false, priority: 'bankable', default_option: 'ignore',
      trigger: { 'meter.marketShare': '>=20' },
      options: [
        { id: 'accuse', tooltip_meters: ['marketShare', 'trust', 'risk'],
          effects: { meter: { marketShare: '+2', trust: '-3' }, vec: { reg: 8 } } },
        { id: 'ignore', tooltip_meters: ['marketShare', 'trust'],
          effects: { meter: { marketShare: '-2', trust: '+1' }, rival_effect: { omninet: { share: 1 } } } }
      ]
    },
    {
      id: 'dec_oss_pricewar', tier: 3, act: [2, 3], category: 'opensource', weight: 70,
      cooldown_sec: 220, once: false, priority: 'bankable', default_option: 'hold',
      trigger: { 'meter.marketShare': '>=12' },
      weight_mods: [{ factor: 1.4, when: { 'meter.marketShare': '>=25' } }],
      options: [
        { id: 'cut', tooltip_meters: ['cash', 'marketShare', 'risk'],
          effects: { cashFrac: -0.08, meter: { marketShare: '+5' }, set_var: { runway_debt: '+1' } } },
        { id: 'hold', tooltip_meters: ['marketShare', 'cash'],
          effects: { meter: { marketShare: '-2' }, rival_effect: { helion: { share: 1 } } } }
      ]
    },

    // ========================= PRODUCT / MARKET (4) ======================
    {
      id: 'dec_prod_demo', tier: 2, act: [1, 2], category: 'product', weight: 85,
      cooldown_sec: 200, once: false, priority: 'bankable', default_option: 'rehearse',
      trigger: { 'resource.modelGen': '>=1' },
      options: [
        { id: 'rehearse', tooltip_meters: ['cash', 'trust'],
          effects: { resource: { cash: '-80' }, meter: { trust: '+2' } } },
        // SUB-PART C — two-sided gamble: ship the live demo unrehearsed. 55% viral hit / 45% it bombs.
        { id: 'wing_it', tooltip_meters: ['marketShare', 'trust'], gamble: [55, 45],
          outcomes: [
            { id: 'hit', chance: 0.55, good: true, news: 'dec_prod_demo_hit_news', effect: { meter: { marketShare: '+6', trust: '+3' } } },
            { id: 'flop', chance: 0.45, good: false, news: 'dec_prod_demo_flop_news', effect: { meter: { marketShare: '-2', trust: '-5' }, vec: { sec: 5 } } }
          ] }
      ]
    },
    {
      id: 'dec_prod_sycophancy', tier: 3, act: [2, 3], category: 'product', weight: 70,
      cooldown_sec: 220, once: false, priority: 'bankable', default_option: 'tune_down',
      trigger: { 'resource.modelGen': '>=3' },
      options: [
        { id: 'tune_down', tooltip_meters: ['marketShare', 'align', 'trust'],
          effects: { meter: { marketShare: '-2', align: '+2', trust: '+2' } } },
        { id: 'leave_it', tooltip_meters: ['marketShare', 'align', 'risk'],
          effects: { meter: { marketShare: '+3', align: '-2' }, vec: { cap: 6 } } }
      ]
    },
    {
      id: 'dec_prod_viral_trend', tier: 3, act: [2, 3], category: 'product', weight: 75,
      cooldown_sec: 200, once: false, priority: 'interrupt',
      trigger: { AND: [{ 'resource.modelGen': '>=3' }, { 'resource.compute': '>=500' }] },
      options: [
        // SUB-PART C — gamble: pour compute into riding the viral trend. 60% it scales / 40% it melts down.
        { id: 'ride', tooltip_meters: ['compute', 'marketShare', 'risk'], gamble: [60, 40],
          effects: { resource: { compute: '-200' } },   // the compute is spent either way
          outcomes: [
            { id: 'scaled', chance: 0.60, good: true, news: 'dec_prod_viral_trend_scaled_news', effect: { meter: { marketShare: '+8' } } },
            { id: 'meltdown', chance: 0.40, good: false, news: 'dec_prod_viral_trend_meltdown_news', effect: { meter: { marketShare: '+1', trust: '-3' }, vec: { sec: 10 } } }
          ] },
        { id: 'ratelimit', tooltip_meters: ['marketShare', 'trust', 'compute'],
          effects: { meter: { marketShare: '+1', trust: '+2' } } }
      ]
    },
    {
      id: 'dec_prod_deprecate', tier: 4, act: [3], category: 'product', weight: 55,
      cooldown_sec: 240, once: false, priority: 'ambient', default_option: 'keep',
      trigger: { 'resource.modelGen': '>=5' },
      options: [
        { id: 'keep', tooltip_meters: ['cash', 'trust'],
          effects: { resource: { cashMonthsBurn: -0.3 }, meter: { trust: '+1' } } },
        { id: 'sunset', tooltip_meters: ['cash', 'trust'],
          effects: { meter: { trust: '-2' } } }
      ]
    },

    // ========================= FUNDING (4) ===============================
    // ARC-BOARD: take a giant's strategic round → (delayed) board reckoning.
    {
      id: 'dec_fund_megaround', tier: 2, act: [1, 2], category: 'funding', weight: 80,
      cooldown_sec: 280, once: true, priority: 'interrupt',
      trigger: { AND: [{ 'resource.modelGen': '>=2' }, { 'meter.marketShare': '>=8' }] },
      options: [
        { id: 'take_giant', tooltip_meters: ['cash', 'valuation', 'risk'],
          effects: { resource: { cash: '+600' }, meter: { valuation: '+10', marketShare: '+2' }, set_flag: 'giant_backed',
                     schedule: { event: 'dec_fund_board_saga', delaySec: 200, chance: 0.7, callback: 'callback_board' } } },
        { id: 'small_rounds', tooltip_meters: ['cash', 'trust', 'valuation'],
          effects: { resource: { cash: '+250' }, meter: { trust: '+3', valuation: '+3' } } }
      ]
    },
    {
      id: 'dec_fund_board_saga', act: [2, 3], category: 'funding', weight: 0,
      cooldown_sec: 0, once: false, priority: 'scheduled', _callback: true,
      trigger: { OR: [] },
      options: [
        { id: 'concede', tooltip_meters: ['valuation', 'align', 'trust'],
          effects: { meter: { valuation: '+4', align: '-2', trust: '-2' }, set_var: { gov_debt: '+1' } } },
        { id: 'fight_board', tooltip_meters: ['cash', 'researchers', 'trust'],
          effects: { resource: { cashMonthsBurn: -1, researchers: '-1' }, meter: { trust: '+3', valPct: -0.04 } } }
      ]
    },
    {
      id: 'dec_fund_pbc', tier: 3, act: [2, 3], category: 'funding', weight: 55,
      cooldown_sec: 300, once: true, priority: 'bankable', default_option: 'keep_mission',
      trigger: { AND: [{ 'meter.marketShare': '>=18' }, { 'meter.valuation': '>=40' }] },
      options: [
        { id: 'convert', tooltip_meters: ['cash', 'trust', 'valuation'],
          effects: { resource: { cashMonthsBurn: 6 }, meter: { valuation: '+8', trust: '-5', align: '-1' } } },
        { id: 'keep_mission', tooltip_meters: ['cash', 'trust'],
          effects: { resource: { cashMonthsBurn: -0.5 }, meter: { trust: '+5' } } }
      ]
    },
    {
      id: 'dec_fund_circular', tier: 4, act: [3], category: 'funding', weight: 50,
      cooldown_sec: 260, once: false, priority: 'ambient', default_option: 'disclose',
      trigger: { 'meter.valuation': '>=60' },
      options: [
        { id: 'disclose', tooltip_meters: ['trust', 'valuation'],
          effects: { meter: { trust: '+2', valuation: '-2' } } },
        { id: 'obscure', tooltip_meters: ['valuation', 'trust'],
          effects: { meter: { valuation: '+3', trust: '-3' } } }
      ]
    },

    // ========================= GEOPOLITICS (4) ===========================
    {
      id: 'dec_geo_exportban', tier: 3, act: [2, 3], category: 'geopolitics', weight: 70,
      cooldown_sec: 260, once: false, priority: 'interrupt',
      trigger: { AND: [{ 'resource.compute': '>=600' }, { 'meter.marketShare': '>=18' }] },
      options: [
        { id: 'pay_tax', tooltip_meters: ['cash', 'compute', 'trust'],
          effects: { cashFrac: -0.15, resource: { compute: '+200' }, meter: { trust: '-2' } } },
        { id: 'comply_ban', tooltip_meters: ['compute', 'marketShare', 'trust'],
          effects: { meter: { marketShare: '-3', trust: '+3' }, rival_effect: { helion: { agi: 1.5 } } } }
      ]
    },
    {
      id: 'dec_geo_smuggle', tier: 4, act: [3], category: 'geopolitics', weight: 50,
      cooldown_sec: 280, once: false, priority: 'bankable', default_option: 'refuse',
      trigger: { AND: [{ 'resource.compute': '>=1000' }, { 'meter.vec.sec': '>=30' }] },
      options: [
        { id: 'gray_market', tooltip_meters: ['compute', 'risk', 'trust'],
          effects: { resource: { compute: '+400' }, meter: { trust: '-5' }, vec: { reg: 14, sec: 8 } } },
        { id: 'refuse', tooltip_meters: ['compute', 'trust'],
          effects: { meter: { trust: '+2' } } }
      ]
    },
    {
      id: 'dec_geo_sovereign', tier: 4, act: [3], category: 'geopolitics', weight: 55,
      cooldown_sec: 280, once: false, priority: 'bankable', default_option: 'decline',
      trigger: { AND: [{ 'meter.marketShare': '>=20' }, { 'resource.cash': '>=400' }] },
      options: [
        { id: 'take_pif', tooltip_meters: ['cash', 'compute', 'trust'],
          effects: { resource: { cashMonthsBurn: 5, compute: '+300' }, meter: { trust: '-6' }, vec: { reg: 8 } } },
        { id: 'decline', tooltip_meters: ['cash', 'trust'],
          effects: { meter: { trust: '+3' } } }
      ]
    },
    {
      id: 'dec_geo_espionage', tier: 4, act: [3], category: 'geopolitics', weight: 45,
      cooldown_sec: 300, once: true, priority: 'interrupt',
      trigger: { AND: [{ 'resource.researchers': '>=4' }, { 'meter.vec.sec': '>=35' }] },
      options: [
        { id: 'surveil', tooltip_meters: ['trust', 'align', 'risk'],
          effects: { meter: { trust: '-4', align: '-1' }, vec: { sec: -12 } } },
        { id: 'trust_team', tooltip_meters: ['risk', 'trust', 'align'],
          effects: { meter: { trust: '+3', align: '+1' }, vec: { sec: 8 } } }
      ]
    },

    // ========================= PR / CULTURE (4) ==========================
    {
      id: 'dec_pr_scarjo', tier: 3, act: [2, 3], category: 'pr', weight: 70,
      cooldown_sec: 220, once: false, priority: 'interrupt',
      trigger: { 'resource.modelGen': '>=3' },
      options: [
        { id: 'ship_voice', tooltip_meters: ['marketShare', 'trust', 'risk'],
          effects: { meter: { marketShare: '+5', trust: '-5' }, vec: { reg: 8 } } },
        { id: 'play_safe', tooltip_meters: ['marketShare', 'trust'],
          effects: { meter: { marketShare: '-1', trust: '+3' } } }
      ]
    },
    {
      id: 'dec_pr_layoffs', tier: 3, act: [2, 3], category: 'pr', weight: 65,
      cooldown_sec: 240, once: false, priority: 'bankable', default_option: 'reskill',
      trigger: { 'meter.marketShare': '>=15' },
      options: [
        { id: 'tout', tooltip_meters: ['valuation', 'trust', 'align'],
          effects: { meter: { valuation: '+3', trust: '-5', align: '-1' } } },
        { id: 'reskill', tooltip_meters: ['cash', 'trust'],
          effects: { resource: { cashMonthsBurn: -0.6 }, meter: { trust: '+4' } } }
      ]
    },
    {
      id: 'dec_pr_doomer', tier: 4, act: [3], category: 'pr', weight: 55,
      cooldown_sec: 240, once: false, priority: 'ambient', default_option: 'measured',
      trigger: { 'resource.modelGen': '>=5' },
      options: [
        { id: 'measured', tooltip_meters: ['trust', 'align'],
          effects: { meter: { trust: '+2', align: '+1' } } },
        { id: 'dismiss', tooltip_meters: ['marketShare', 'trust'],
          effects: { meter: { marketShare: '+2', trust: '-3' } } }
      ]
    },
    {
      id: 'dec_pr_eacc_manifesto', tier: 2, act: [1, 2], category: 'pr', weight: 60,
      cooldown_sec: 220, once: false, priority: 'bankable', default_option: 'neutral',
      trigger: { 'meter.marketShare': '>=10' },
      options: [
        { id: 'sign_manifesto', tooltip_meters: ['cash', 'trust', 'align'],
          effects: { resource: { cash: '+150' }, meter: { trust: '-4', align: '-1' } } },
        { id: 'neutral', tooltip_meters: ['trust', 'cash'],
          effects: { meter: { trust: '+1' } } }
      ]
    },

    // ===================== PHASE 4 — FRONTIER EXISTENTIAL EVENTS (tier 4) =====================
    // Gated to FRONTIER scale (valuation in the top band) AND late game (act 3, deep modelGen /
    // share). Effects are %-of-scale so they cost BILLIONS / a model generation at this size —
    // the "$50B company faces a $50B problem" fix. Grounded in DESIGN-events-catalog.md §1/§5/§9.
    // Each ships a recovery path; the "fight" branch trades cash/runway for catastrophic-tail risk
    // (reg vector → nationalization machinery). i18n: {id}_t/_d + per-option (EN+RU).

    // DOJ DEMANDS YOU DELETE YOUR LATEST MODEL (catalog §1 DOJ/antitrust + §5 court-ordered).
    // comply = lose a model GENERATION (modelGen −1) + a valuation hit; fight = a legal war that
    // costs months of runway AND spikes the regulatory vector (feeds the nationalization trigger).
    {
      id: 'dec_fr_doj_delete', tier: 4, act: [3], category: 'regulation', weight: 60,
      cooldown_sec: 360, once: true, priority: 'interrupt',
      trigger: { AND: [{ 'resource.modelGen': '>=7' }, { 'meter.marketShare': '>=20' }] },
      weight_mods: [{ factor: 1.8, when: { 'meter.vec.reg': '>=55' } }],
      options: [
        { id: 'comply', tooltip_meters: ['cash', 'valuation', 'risk'],
          effects: { resource: { modelGen: '-1' }, meter: { valPct: -0.12, marketShare: '-4' }, vec: { reg: -18 } } },
        { id: 'fight', tooltip_meters: ['cash', 'risk', 'trust'],
          effects: { resource: { cashMonthsBurn: -3 }, meter: { trust: '-4' }, vec: { reg: 22, sec: 6 },
                     set_var: { nationalization_pressure: '+1' } } }
      ]
    },
    // ANTITRUST SUIT — $-BILLIONS (catalog §1 FTC/DOJ antitrust). A break-up suit lands; settle
    // bleeds a huge % of valuation, fight bets months of runway against a worse regulatory war.
    {
      id: 'dec_fr_antitrust', tier: 4, act: [3], category: 'legal', weight: 55,
      cooldown_sec: 360, once: false, priority: 'interrupt',
      trigger: { AND: [{ 'meter.marketShare': '>=24' }, { 'resource.modelGen': '>=7' }] },
      weight_mods: [{ factor: 1.6, when: { 'meter.marketShare': '>=32' } }],
      options: [
        { id: 'settle', tooltip_meters: ['cash', 'valuation', 'marketShare'],
          effects: { resource: { cashPctVal: -0.15 }, meter: { marketShare: '-3', trust: '+2' }, vec: { reg: -14 } } },
        { id: 'fight', tooltip_meters: ['cash', 'risk', 'marketShare'],
          effects: { resource: { cashMonthsBurn: -4 }, meter: { marketShare: '+2', trust: '-3' }, vec: { reg: 18 },
                     set_var: { nationalization_pressure: '+1' } } }
      ]
    },
    // FORCED DIVESTITURE (catalog §9 TikTok divestiture / structural remedy). Regulators order you
    // to spin off a business line: obey loses share + a valuation slice; stall loses MORE runway and
    // heat. Both bite at frontier scale.
    {
      id: 'dec_fr_divestiture', tier: 4, act: [3], category: 'regulation', weight: 50,
      cooldown_sec: 360, once: true, priority: 'bankable', default_option: 'divest',
      trigger: { AND: [{ 'meter.marketShare': '>=26' }, { 'meter.vec.reg': '>=40' }] },
      options: [
        { id: 'divest', tooltip_meters: ['valuation', 'marketShare', 'risk'],
          effects: { meter: { valPct: -0.10, marketShare: '-6' }, vec: { reg: -16 }, set_var: { reg_debt: '+1' } } },
        { id: 'stall', tooltip_meters: ['cash', 'risk', 'trust'],
          effects: { resource: { cashMonthsBurn: -2 }, meter: { trust: '-4' }, vec: { reg: 16 },
                     set_var: { nationalization_pressure: '+1' } } }
      ]
    },
    // NATIONALIZATION THREAT (DESIGN §2 frontier flavor; catalog §9 sovereign control). The state
    // moves to take a strategic stake. Accept = a giant cash injection (months of runway) but you
    // surrender share + autonomy; resist = a costly standoff that bleeds runway and trust.
    {
      id: 'dec_fr_nationalize', tier: 4, act: [3], category: 'geopolitics', weight: 48,
      cooldown_sec: 400, once: true, priority: 'interrupt',
      trigger: { AND: [{ 'resource.modelGen': '>=8' }, { 'meter.marketShare': '>=24' }] },
      weight_mods: [{ factor: 1.7, when: { 'meter.vec.reg': '>=60' } }],
      options: [
        { id: 'accept_stake', tooltip_meters: ['cash', 'marketShare', 'trust'],
          effects: { resource: { cashMonthsBurn: 8 }, meter: { marketShare: '-5', trust: '-3', align: '+1' }, vec: { reg: -20 } } },
        { id: 'resist', tooltip_meters: ['cash', 'risk', 'trust'],
          effects: { resource: { cashMonthsBurn: -3 }, meter: { trust: '+3' }, vec: { reg: 14 },
                     set_var: { nationalization_pressure: '+1' } } }
      ]
    },
    // CATASTROPHIC SAFETY INCIDENT (DESIGN §4 "incident → company-threat"; catalog §4 Grok/Character.AI).
    // A frontier model causes real-world harm. Ground the fleet (lose a generation's deployment + huge
    // cash) or contain-and-spin (cheaper now, but trust collapse + a regulatory war).
    {
      id: 'dec_fr_safety_catastrophe', tier: 4, act: [3], category: 'safety', weight: 52,
      cooldown_sec: 360, once: false, priority: 'interrupt',
      trigger: { AND: [{ 'resource.modelGen': '>=7' }, { 'meter.risk': '>=50' }] },
      weight_mods: [{ factor: 2.0, when: { 'meter.risk': '>=70' } }],
      options: [
        { id: 'ground_fleet', tooltip_meters: ['cash', 'valuation', 'align'],
          effects: { resource: { cashPctVal: -0.10 }, meter: { marketShare: '-5', trust: '+4', align: '+2' }, vec: { cap: -16 } } },
        { id: 'contain_spin', tooltip_meters: ['cash', 'risk', 'trust'],
          effects: { resource: { cashMonthsBurn: -1 }, meter: { trust: '-9' }, vec: { cap: 12, reg: 16 },
                     set_var: { nationalization_pressure: '+1' } } }
      ]
    },
    // EXPORT-CONTROL SEIZURE (catalog §9 export bans / chip seizure at scale). A frontier compute
    // build is frozen by national-security review: pay the "tax" (a billions-scale % of valuation) to
    // free it, or comply and hand the lead to a rival.
    {
      id: 'dec_fr_export_seizure', tier: 4, act: [3], category: 'compute', weight: 46,
      cooldown_sec: 360, once: false, priority: 'interrupt',
      trigger: { AND: [{ 'resource.compute': '>=5000' }, { 'meter.marketShare': '>=22' }] },
      options: [
        { id: 'pay_security_tax', tooltip_meters: ['cash', 'valuation', 'compute'],
          effects: { resource: { cashPctVal: -0.08, compute: '+400' }, meter: { trust: '-2' }, vec: { reg: 6 } } },
        { id: 'comply_seizure', tooltip_meters: ['compute', 'marketShare', 'risk'],
          effects: { meter: { marketShare: '-4' }, vec: { reg: -8 }, rival_effect: { leader: { agi: 3 } } } }
      ]
    },
    // INVESTOR ULTIMATUM (catalog §8 "one investor = leverage"; circular-financing reckoning). Your
    // anchor investor demands a frontier-defining concession: capitulate (surrender a valuation slice
    // + autonomy) or call their bluff (lose a giant chunk of runway as they pull back).
    {
      id: 'dec_fr_investor_ultimatum', tier: 4, act: [3], category: 'funding', weight: 44,
      cooldown_sec: 360, once: false, priority: 'interrupt',
      trigger: { AND: [{ 'resource.modelGen': '>=8' }, { 'meter.marketShare': '>=22' }] },
      options: [
        { id: 'capitulate', tooltip_meters: ['valuation', 'align', 'trust'],
          effects: { meter: { valPct: -0.07, align: '-2', trust: '-2' }, set_var: { gov_debt: '+1' } } },
        { id: 'call_bluff', tooltip_meters: ['cash', 'valuation', 'trust'],
          effects: { resource: { cashMonthsBurn: -5 }, meter: { trust: '+3', valPct: -0.05 } } }
      ]
    }
  ];

  // ====================================================================
  // PHASE 5 — INCIDENT POOL (DESIGN §4). Decision-shaped so they reuse the
  // interrupt modal + applyEffect grammar + the per-option news headlines.
  // They are NOT in the ambient DECISIONS lottery — the engine rolls them
  // against Incident Risk (see updateIncidents). Each has two responses:
  //   apologize/pause = own it → revenue/share hit now, contains the fallout
  //   deny/gamble     = roll on regulators → trust + reg risk, may escalate
  // Severity scales by `act`: early = PR + small flat fine; mid = lawsuit +
  // investigation; late = a rare company-ending catastrophe. Grounded in real
  // cases (Bing Sydney, Air Canada, Grok, Character.AI). The `teach` incident
  // is the scripted first-scandal tutorial (fired by the engine, not rolled).
  var INCIDENTS = [
    // ---- TEACH-BY-SCANDAL: the scripted first incident (Bing Sydney) ----
    // Cheap + survivable. Fires once, early, the first time risk crosses the
    // teach threshold — then the Safety meter is revealed (see game.js).
    {
      id: 'inc_teach_sydney', incident: true, teach: true, act: [1, 2, 3, 4],
      options: [
        { id: 'apologize', tooltip_meters: ['cash', 'trust'],
          effects: { resource: { cash: '-60' }, meter: { trust: '-3' }, vec: { cap: -10 } } }
      ]
    },

    // ---- EARLY: PR embarrassment + small fine (act 1-2) ----
    {
      id: 'inc_grok_meltdown', incident: true, act: [1, 2], severity: 'pr',
      options: [
        { id: 'apologize', tooltip_meters: ['marketShare', 'trust'],
          effects: { resource: { cash: '-40' }, meter: { marketShare: '-2', trust: '+2' }, vec: { cap: -8 } } },
        { id: 'deny', tooltip_meters: ['trust', 'risk'],
          effects: { meter: { trust: '-6' }, vec: { reg: 12, cap: 4 } } }
      ]
    },
    {
      id: 'inc_hallucinated_refund', incident: true, act: [1, 2], severity: 'pr',
      options: [
        { id: 'apologize', tooltip_meters: ['cash', 'trust'],
          effects: { resource: { cash: '-50' }, meter: { trust: '+1' }, vec: { sec: -6 } } },
        { id: 'deny', tooltip_meters: ['trust', 'risk'],
          effects: { meter: { trust: '-5' }, vec: { reg: 10 } } }
      ]
    },

    // ---- MID: lawsuit + investigation (act 2-3) ----
    // Air Canada: a chatbot invented a refund policy; the airline was held liable.
    {
      id: 'inc_aircanada_suit', incident: true, act: [2, 3], severity: 'lawsuit',
      options: [
        { id: 'settle', tooltip_meters: ['cash', 'trust'],
          effects: { resource: { cashPctVal: -0.05 }, meter: { trust: '+3' }, vec: { reg: -6 } } },
        { id: 'fight', tooltip_meters: ['trust', 'risk'],
          effects: { meter: { trust: '-7' }, vec: { reg: 16 },
                     schedule: { event: 'inc_aircanada_suit', delaySec: 120, chance: 0.4, callback: 'callback_incident' } } }
      ]
    },
    {
      id: 'inc_privacy_probe', incident: true, act: [2, 3], severity: 'lawsuit',
      options: [
        { id: 'cooperate', tooltip_meters: ['cash', 'risk'],
          effects: { resource: { cashMonthsBurn: -1 }, meter: { trust: '+2' }, vec: { data: -12, reg: -8 } } },
        { id: 'stonewall', tooltip_meters: ['trust', 'risk'],
          effects: { meter: { trust: '-6' }, vec: { reg: 18, data: 6 } } }
      ]
    },

    // ---- LATE / CONTAINMENT: a rare company-ending catastrophe (act 3-4) ----
    // Character.AI: a teen's death tied to a chatbot. For players who never funded
    // Safety, the unsafe path here is severe (huge %-of-valuation + trust collapse).
    {
      id: 'inc_chatbot_tragedy', incident: true, act: [3, 4], severity: 'catastrophe',
      options: [
        { id: 'recall', tooltip_meters: ['cash', 'marketShare', 'trust'],
          effects: { resource: { cashPctVal: -0.08, modelGen: -1 }, meter: { marketShare: '-8', trust: '+5' }, vec: { cap: -20 } } },
        { id: 'lawyer_up', tooltip_meters: ['valuation', 'trust', 'risk'],
          effects: { meter: { valPct: -0.18, trust: '-14' }, vec: { reg: 24, cap: 8 },
                     schedule: { event: 'inc_chatbot_tragedy', delaySec: 110, chance: 0.5, callback: 'callback_incident' } } }
      ]
    },
    {
      id: 'inc_rogue_agent', incident: true, act: [3, 4], severity: 'catastrophe',
      options: [
        { id: 'pull_plug', tooltip_meters: ['cash', 'marketShare', 'risk'],
          effects: { resource: { cashMonthsBurn: -3 }, meter: { marketShare: '-6', trust: '+4' }, vec: { cap: -22, sec: -16 } } },
        { id: 'cover_up', tooltip_meters: ['valuation', 'trust', 'risk'],
          effects: { meter: { valPct: -0.2, trust: '-16' }, vec: { reg: 26, sec: 12 } } }
      ]
    }
  ];

  // ===================================================================
  // PHASE 8 — IMPOSSIBLE-ONLY BLACK SWANS (DESIGN-rivals-replayability §1)
  // ===================================================================
  // A pool of brutal, existential, time-pressured events that fire ONLY on
  // difficulty === 'impossible' (NEVER easy/normal/hard — the roller gate in
  // game.js enforces this, and these are in their OWN pool, never in the
  // ambient DECISIONS lottery). Decision-shaped: same modal + applyEffect
  // grammar + %-of-scale magnitudes so each hit auto-scales garage→frontier.
  // Each is FAIR per the project guardrail: existential magnitude, but a tight
  // response with a real trade-off and ALWAYS a recovery path (never a silent
  // instakill — bankruptcy/takeover still route through the Phase-3 crisis
  // engine). Several gamble options `schedule` an escalation if you roll the
  // dice. `act` gates them past the garage so they're never turn-1. i18n keys:
  // {id}_t / {id}_d / {id}_{opt} + per-option {id}_{opt}_news + a {id}_warn
  // telegraph headline fired a beat before the swan bites.
  var BLACKSWAN_CFG = {
    FIRST_GRACE_SEC: 360,    // no swan in the first ~6 min of a run (past the opening)
    COOLDOWN_SEC: 240,       // long global cooldown — RARE-but-devastating (≥4 min apart)
    CHECK_EVERY_SEC: 8,      // roll cadence (a "cycle")
    CHANCE: 0.06,            // per-eligible-cycle chance (≈ one every few minutes at most)
    TELEGRAPH_SEC: 6,        // warning headline fires this long before the swan modal pops
    MIN_VAL: 5e6             // size gate: must be a real company (≥$5M) before a swan can hit
  };
  var BLACKSWAN = [
    // 1 — COMPUTE EMBARGO: overnight −50% compute capacity (export ban).
    {
      id: 'bsw_embargo', act: [2, 3, 4], weight: 100,
      options: [
        { id: 'efficiency', tooltip_meters: ['cash', 'compute'],
          effects: { resource: { computePct: -0.5, cashMonthsBurn: -1 }, meter: { trust: '+2' }, buff: { key: 'compute_eff', mult: 1.12, days: 6 } } },
        { id: 'greymarket', tooltip_meters: ['cash', 'compute', 'risk'],
          effects: { resource: { cashPctVal: -0.06 },
            outcomes: [
              { id: 'smuggled', chance: 0.5, good: true, effect: { resource: { computePct: -0.15 }, vec: { reg: 10 } } },
              { id: 'seized', chance: 0.5, good: false, effect: { resource: { computePct: -0.6 }, meter: { trust: '-6' }, vec: { reg: 22 },
                  schedule: { event: 'bsw_embargo', delaySec: 130, chance: 0.35, callback: 'bsw_embargo_warn' } } }
            ] } },
        { id: 'eat', tooltip_meters: ['compute', 'marketShare'],
          effects: { resource: { computePct: -0.5 }, meter: { marketShare: '-7' } } }
      ]
    },
    // 2 — RIVAL CARTEL: rivals ally — simultaneous price war + talent raid.
    {
      id: 'bsw_cartel', act: [2, 3, 4], weight: 100,
      options: [
        { id: 'trust', tooltip_meters: ['cash', 'trust', 'marketShare'],
          effects: { resource: { cashMonthsBurn: -2 }, meter: { trust: '+6', marketShare: '-3' } } },
        { id: 'buyout', tooltip_meters: ['cash', 'risk'],
          effects: { resource: { cashPctVal: -0.1 },
            outcomes: [
              { id: 'split', chance: 0.55, good: true, effect: { meter: { marketShare: '+3' }, rival_effect: { all: { share: -3 } } } },
              { id: 'held', chance: 0.45, good: false, effect: { meter: { marketShare: '-6', trust: '-4' }, resource: { researchersPct: -0.1 } } }
            ] } },
        { id: 'fold', tooltip_meters: ['marketShare', 'researchers'],
          effects: { meter: { marketShare: '-8' }, resource: { researchersPct: -0.12 } } }
      ]
    },
    // 3 — THE MOLE: a top researcher is a spy; your latest model leaks to a rival.
    {
      id: 'bsw_mole', act: [3, 4], weight: 90,
      options: [
        { id: 'counterintel', tooltip_meters: ['cash', 'researchers'],
          effects: { resource: { cashPctVal: -0.08, researchers: '-1' }, meter: { trust: '+2' }, set_flag: 'counterintel' } },
        { id: 'legal', tooltip_meters: ['modelGen', 'risk'],
          effects: { resource: { modelGen: -1 }, meter: { trust: '-3' }, vec: { sec: 14 }, rival_effect: { leader: { agi: +6, share: +3 } },
            schedule: { event: 'bsw_mole', delaySec: 140, chance: 0.3, callback: 'bsw_mole_warn' } } },
        { id: 'ignore', tooltip_meters: ['modelGen', 'marketShare'],
          effects: { resource: { modelGen: -1 }, meter: { marketShare: '-4' }, rival_effect: { leader: { agi: +8, share: +4 } } } }
      ]
    },
    // 4 — FLASH CRASH: the AI bubble pops — valuation −~50%, funding closed N turns.
    {
      id: 'bsw_crash', act: [2, 3, 4], weight: 100,
      options: [
        { id: 'cut', tooltip_meters: ['valuation', 'researchers', 'trust'],
          effects: { meter: { valPct: -0.45, trust: '+3' }, resource: { researchersPct: -0.1 }, set_flag: 'funding_frozen',
            schedule: { event: 'bsw_crash_thaw', delaySec: 150, chance: 1, callback: 'bsw_crash_thaw_news' } } },
        { id: 'debt', tooltip_meters: ['valuation', 'cash', 'risk'],
          effects: { meter: { valPct: -0.5 }, resource: { cashMonthsBurn: 4 }, set_var: { venture_debt: '+1' }, set_flag: 'funding_frozen',
            schedule: { event: 'bsw_crash_thaw', delaySec: 150, chance: 1, callback: 'bsw_crash_thaw_news' } } },
        { id: 'ride', tooltip_meters: ['valuation', 'cash'],
          effects: { meter: { valPct: -0.5 }, resource: { cashMonthsBurn: -2 }, set_flag: 'funding_frozen',
            schedule: { event: 'bsw_crash_thaw', delaySec: 150, chance: 1, callback: 'bsw_crash_thaw_news' } } }
      ]
    },
    // 4b — FLASH CRASH thaw: scheduled-only callback that lifts the funding freeze.
    {
      id: 'bsw_crash_thaw', weight: 0, priority: 'scheduled', _callback: true, _auto: true,
      options: [
        { id: 'reopen', effects: { clr_flag: 'funding_frozen', meter: { trust: '+1' } } }
      ]
    },
    // 5 — REGULATOR SHUTDOWN ORDER: ultimatum to delete your frontier model.
    {
      id: 'bsw_shutdown', act: [3, 4], weight: 90,
      options: [
        { id: 'comply', tooltip_meters: ['modelGen', 'cash', 'trust'],
          effects: { resource: { modelGen: -1, cashMonthsBurn: -1 }, meter: { trust: '+5' }, vec: { reg: -20 } } },
        { id: 'fight', tooltip_meters: ['valuation', 'risk'],
          effects: { meter: { valPct: -0.12 }, vec: { reg: 22 },
            outcomes: [
              { id: 'injunction', chance: 0.5, good: true, effect: { meter: { trust: '+3' }, vec: { reg: -10 } } },
              { id: 'seized', chance: 0.5, good: false, effect: { resource: { modelGen: -1 }, meter: { valPct: -0.18, trust: '-8' }, vec: { reg: 18, sec: 8 },
                  schedule: { event: 'bsw_shutdown', delaySec: 150, chance: 0.3, callback: 'bsw_shutdown_warn' } } }
            ] } }
      ]
    },
    // 6 — AGI PANIC: a rival announces near-AGI → global emergency regulation, you hardest.
    {
      id: 'bsw_agipanic', act: [3, 4], weight: 90,
      options: [
        { id: 'safety', tooltip_meters: ['cash', 'trust', 'risk'],
          effects: { resource: { cashMonthsBurn: -2 }, meter: { trust: '+7' }, vec: { reg: -14, sec: -10 } } },
        { id: 'lobby', tooltip_meters: ['cash', 'risk'],
          effects: { resource: { cashPctVal: -0.07 },
            outcomes: [
              { id: 'carveout', chance: 0.5, good: true, effect: { vec: { reg: -12 }, meter: { marketShare: '+2' } } },
              { id: 'backfire', chance: 0.5, good: false, effect: { meter: { trust: '-8', valPct: -0.1 }, vec: { reg: 20 } } }
            ] } },
        { id: 'race', tooltip_meters: ['trust', 'risk', 'marketShare'],
          effects: { meter: { trust: '-6', marketShare: '+4' }, vec: { reg: 18, sec: 12 } } }
      ]
    },
    // 7 — TALENT EXODUS: a viral "doomer" letter → mass resignations industry-wide.
    {
      id: 'bsw_exodus', act: [2, 3, 4], weight: 100,
      weight_mods: [{ when: { 'meter.trust': '>=70' }, factor: 0.5 }],
      options: [
        { id: 'retain', tooltip_meters: ['cash', 'researchers'],
          effects: { resource: { cashMonthsBurn: -2, researchersPct: -0.05 }, meter: { trust: '+3' } } },
        { id: 'mission', tooltip_meters: ['researchers', 'trust', 'risk'],
          effects: { meter: { trust: '+4' },
            outcomes: [
              { id: 'rallied', chance: 0.5, good: true, effect: { resource: { researchersPct: -0.08 } } },
              { id: 'walkout', chance: 0.5, good: false, effect: { resource: { researchersPct: -0.3 }, meter: { trust: '-4' } } }
            ] } },
        { id: 'letgo', tooltip_meters: ['researchers', 'marketShare'],
          effects: { resource: { researchersPct: -0.35 }, meter: { marketShare: '-4' } } }
      ]
    },
    // 8 — ENERGY CRISIS: electricity ×3 + community moratorium blocking DC expansion.
    {
      id: 'bsw_energy', act: [2, 3, 4], weight: 100,
      options: [
        { id: 'ownpower', tooltip_meters: ['cash', 'trust'],
          effects: { resource: { cashPctVal: -0.12 }, meter: { trust: '+3' }, buff: { key: 'energy_indep', mult: 1.1, days: 8 } } },
        { id: 'efficiency', tooltip_meters: ['compute', 'cash'],
          effects: { resource: { computePct: -0.25, cashMonthsBurn: -1 }, buff: { key: 'energy_eff', mult: 1.08, days: 6 } } },
        { id: 'eat', tooltip_meters: ['cash', 'marketShare', 'trust'],
          effects: { resource: { cashMonthsBurn: -4 }, meter: { marketShare: '-5', trust: '-4' } } }
      ]
    }
  ];

  // ---- Market / investing minigame -------------------------------------
  // R13 anti-printer rework: a BOUNDED RANDOM WALK (REVERT 0) — no mean-reversion
  // edge, so buy-low/sell-high is a coin-flip that loses to the fee on average. A
  // mean-reverting market is provably exploitable (a patient trader compounds the
  // reversion edge into a money printer — the old tuning printed 25,000× in 4h of
  // perfect play). With zero drift + a real 4% fee, even a perfect 4h bot nets only
  // a few× a bankroll on the bounded price band — a flavor skill/luck bonus that can
  // never rival (let alone fund) the exponential generator economy. See BALANCE.md.
  var MARKET = {
    VOL: 0.045,              // per-update volatility (visible ±25% swings)
    REVERT: 0,               // ZERO drift: driftless random walk -> no systematic edge
    BAND: 0.25,              // soft price band: anchor*(1±BAND) keeps prices sane
    TICK: 5,                 // seconds between price updates
    FEE: 0.04,               // 4% per side (8% round-trip) -> churn loses to fees
    assets: [
      { id: 'CMP', start: 100, vol: 1.0 },  // Compute Futures
      { id: 'NVX', start: 240, vol: 1.3 },  // Chip Co (spiky)
      { id: 'DTA', start: 60,  vol: 1.1 },  // Data Corp
      { id: 'ALN', start: 150, vol: 0.45 }  // Safety ETF (calm)
    ]
  };

  // (Autopilot config removed in Phase 1 — automation dropped in favor of active decisions.)

  // ---- Cosmetics (earned, no pay-to-win) -------------------------------
  // unlock: {} always | {prestiges:n} | {singularities:n} | {ach:n owned}
  var COSMETICS = {
    orbs: [
      { id: 'orb_default', unlock: {} },
      { id: 'orb_cyan',    unlock: { modelGen: 1 } },   // ship v1
      { id: 'orb_gold',    unlock: { modelGen: 5 } },   // frontier territory
      { id: 'orb_crimson', unlock: { modelGen: 11 } }   // AGI
    ],
    themes: [
      { id: 'theme_default', unlock: {} },
      { id: 'theme_void',    unlock: { modelGen: 3 } },
      { id: 'theme_aurora',  unlock: { modelGen: 8 } }
    ]
  };

  // ====================================================================
  // GDD v3 — CONTINUOUS NO-RESET META (model generations, real-time processes)
  // ====================================================================

  // ---- Core resources / economy (continuous growth) -------------------
  // Generators now PRODUCE COMPUTE (the bottleneck). Money comes from your
  // deployed product (current model generation) × market share. See GAME-DESIGN.md §2-§4.
  var CORE = {
    // generator output (baseOut in GENERATORS) is COMPUTE/sec, not money.
    COMPUTE_PER_OUT: 1,
    TAP_COMPUTE: 2,            // compute per tap (overclock combo still multiplies)
    // product revenue: money/sec = REV_BASE * genRevenueMult * (1 + marketShare/100) * computeFactor
    REV_BASE: 0.15,           // tuned in P9
    REV_COMPUTE_FACTOR: 0.10, // (legacy) gentle log scaling
    REV_PER_COMPUTE: 0.5,     // money/sec per compute/sec of infra (product serves users ∝ compute)
    // ---- Phase 2 BURN → RUNWAY revenue shaping (DESIGN §1) ----
    // The opposing burn is LINEAR in compute capacity (cps) — and cps grows exponentially with
    // generator tiers. If revenue rode the same exponential, burn could never bite. So product
    // revenue scales SUB-LINEARLY in compute (adoption / serving has diminishing returns):
    //   adoption     = cps^ADOPTION_EXP                                  (sub-linear in compute)
    //   revenue/mo   = adoption × REV_COMPUTE_COEF × revGenFactor(modelGen)
    //                            × (1 + marketShare/100) × trust × diff('revenueMult')
    // Burn (∝ cps) therefore OUTRUNS revenue as you buy compute WITHIN a generation → runway
    // tightens → you must SHIP the next generation (revGenFactor + market-share jump lift revenue
    // back above burn) or raise FUNDING to survive. That sawtooth is the "periodic squeeze".
    // The whole settled curve is tuned (probe.js) so revenue sits a little BELOW burn at a fresh
    // generation (top labs lose money and live on rounds, per design §1) — comfortable ~12–15mo
    // runway on Normal that tightens as you scale, recovering on each ship.
    // ECONOMY REBALANCE (DESIGN-GDD §2, audit A1): ADOPTION_EXP raised 0.72 → 1.0 so revenue is
    // LINEAR in compute (matching the linear burn). With a pure-linear adoption term the marginal
    // d(rev)/d(compute) is CONSTANT (never decays with cps depth), so a marginal generator buy is
    // NET-POSITIVE from v1 at ANY scale — killing the old sublinear curve where building always
    // lost money at depth + a "park" exploit dominated. Challenge no longer comes from compute
    // being a money-loser; it comes from FIXED costs (salaries/DC upkeep/overhead), the
    // exponential generator COST curve, the compute-STOCK gate on shipping, rivals, and difficulty.
    ADOPTION_EXP: 1.0,
    // REV_COMPUTE_COEF tuned (proof-sim) for the linear curve + newly-wired fundingRevMult
    // round-mult compounding in moneyRate(). Sized so the gen1 marginal buy is net-positive on ALL
    // FOUR difficulties (incl. Impossible) while early game stays cash-gated (tiny cps × tiny
    // share, fixed overhead) and disciplined play pushes rev/burn comfortably > 1.0.
    REV_COMPUTE_COEF: 0.0075,
    // revGenFactor: a TAMED per-generation revenue ladder (NOT the compounding ×55 genRevenueMult
    // used by funding). Each shipped generation lifts revenue by ~REV_GEN_STEP×, enough to keep
    // pace with exponential compute-burn across the arc + give a recovery on ship, never enough to
    // make you permanently, trivially profitable. revGenFactor(g) = REV_GEN_STEP^g.
    // ECONOMY REBALANCE: gentled 1.68 → 1.35 so the per-generation revenue ladder doesn't
    // compound late-game rev/burn into the absurd (with the now-LINEAR adoption + wired round
    // mult, 1.68^gen exploded a mature lab's margin). 1.35 keeps a felt recovery on each ship
    // while leaving challenge to fixed costs / cost curve / share gating / rivals / difficulty.
    REV_GEN_STEP: 1.35,       // per-shipped-generation revenue multiplier (recovery on each ship)
    // Valuation = a believable "company worth": liquid cash + physical compute assets +
    // goodwill from PROVEN lifetime earnings, boosted by market dominance. Deliberately
    // NOT annualised run-rate × multiple — at compressed game-time that explodes valuation
    // to millions× the player's real cash. This keeps it in the same universe as cash.
    VAL_GOODWILL_MULT: 3,     // company worth ≈ 3× lifetime earnings (track record / IP / users)
    VAL_COMPUTE_ASSET: 1,     // each unit of compute capacity counts as a physical asset
    VAL_SHARE_PREMIUM: 2,     // market-dominance premium: ×(1 + share% × this/100); #1 ⇒ pride
    START_MONEY: 0
  };

  // ---- Model generations (replaces prestige). Forward-only ladder. ----
  // Each: trainSec (base real-time to train, shortened by researchers/boosts),
  // computeReq (compute STOCK spent to start training), revMult (PERMANENT product
  // revenue ×), share (market-share % granted on completion), id (i18n key).
  // ~month-long arc when paced with the real-time timers (balanced in P9).
  // trainSec is RAW real-time per generation (shortened by researchers/research/boost
  // via processSpeed ≈ up to ~3×). Tuned (P9) so the v1→AGI arc spans ~3–4 weeks of
  // real time for an engaged player (training is wall-clock — it advances offline too),
  // longer for casual play. Early gens are minutes (fast, satisfying onboarding); late
  // frontier gens are days→weeks (real lead-times, compressed). See BALANCE.md.
  var MODELGEN = [
    { id: 'g_v1',     trainSec: 60,       computeReq: 50,        revMult: 2.2,  share: 1 },   // 1 min
    { id: 'g_v2',     trainSec: 240,      computeReq: 400,       revMult: 2.4,  share: 2 },   // 4 min
    { id: 'g_v3',     trainSec: 900,      computeReq: 4e3,       revMult: 3.0,  share: 4 },   // 15 min — "ChatGPT moment"
    { id: 'g_v4',     trainSec: 3600,     computeReq: 4e4,       revMult: 3.5,  share: 6 },   // 1 h
    { id: 'g_v5',     trainSec: 14400,    computeReq: 4e5,       revMult: 4.0,  share: 8 },   // 4 h
    { id: 'g_v6',     trainSec: 54000,    computeReq: 4e6,       revMult: 5.0,  share: 10 },  // 15 h
    { id: 'g_front1', trainSec: 151200,   computeReq: 5e7,       revMult: 6.0,  share: 12 },  // ~1.75 d
    { id: 'g_front2', trainSec: 345600,   computeReq: 6e8,       revMult: 7.0,  share: 14 },  // 4 d
    { id: 'g_front3', trainSec: 691200,   computeReq: 8e9,       revMult: 9.0,  share: 16 },  // 8 d
    { id: 'g_proto',  trainSec: 1209600,  computeReq: 1e11,      revMult: 12.0, share: 18 },  // 14 d proto-AGI
    { id: 'g_agi',    trainSec: 1728000,  computeReq: 2e12,      revMult: 16.0, share: 22 }   // 20 d — AGI (win)
  ];

  // ---- Timed processes (the month-long engine) ------------------------
  var PROCESS = {
    // process speed = 1 + researchers-bonus(≤cap) + research-bonus(≤1.0) , × boost.
    // Capped (P9) so speedups are a meaningful reward but never collapse the month arc.
    RESEARCHER_SPEED_PER: 0.012, // each researcher = +1.2% process speed
    RESEARCHER_SPEED_CAP: 1.2,   // ≤ +120% from researchers
    RESEARCH_SPEED_CAP: 1.0,     // ≤ +100% from research projects
    OFFLINE_PROCESS: true,       // timers advance offline (capped by offline cap)
  };

  // ---- Parallel timed processes (the month-long engine, GAME-DESIGN.md §2/§7) --
  // Datacenter BUILD: money + real time → permanent compute capacity. Several
  // builds over the arc (real lead-time 6–12 months, compressed). Each adds BONUS
  // to the compute multiplier. cost/time escalate so later builds take hours→days.
  var DATACENTER = { baseCost: 1.2e4, costGrowth: 2.3, baseSec: 240, secGrowth: 1.55, bonus: 0.6 };
  // RESEARCH project: money + real time → permanent EFFICIENCY (faster processes +
  // more compute per unit). Repeatable ladder; escalates like builds.
  var RESEARCH2 = { baseCost: 6e3, costGrowth: 2.1, baseSec: 200, secGrowth: 1.5, speedBonus: 0.02, computeBonus: 0.06 };

  // ---- Researchers / talent -------------------------------------------
  var TALENT = {
    baseCost: 5e3,            // money cost of researcher #1
    growth: 1.15,             // cost(n) = baseCost * growth^hired
    UNLOCK_GEN: 2             // hiring opens once you ship v2
  };

  // ---- Finance: funding rounds (replaces twitchy market) --------------
  // Gated by MODEL GENERATION (genReq) — valuation grows too explosively to gate on.
  // Funding = a MEANINGFUL HEAD-START, never a game-skip. Cash injected = a few minutes
  // of your CURRENT income (self-scaling, so it can never trivialise the next stage —
  // you'd earn it in those minutes anyway). The real long-term value is `mult`: a
  // PERMANENT revenue boost. `secs` = seconds-of-current-income paid as the lump sum.
  // `months` (Phase 2): a round injects this many MONTHS of current burn as cash → that much
  // runway (DESIGN §1 "+12–24 months"). `secs` is kept as a revenue floor (a few minutes of
  // income) so a high-revenue lab isn't shortchanged. `mult` = the PERMANENT revenue boost.
  var FUNDING = [
    { id: 'seed', genReq: 1, secs: 180, months: 12, mult: 1.10 },   // +12 mo runway
    { id: 'a',    genReq: 2, secs: 240, months: 14, mult: 1.15 },   // +14 mo
    { id: 'b',    genReq: 4, secs: 300, months: 16, mult: 1.20 },   // +16 mo
    { id: 'c',    genReq: 6, secs: 420, months: 20, mult: 1.25 },   // +20 mo
    { id: 'ipo',  genReq: 8, secs: 600, months: 24, mult: 1.40 }    // +24 mo
  ];

  // 1 in-game "day" in real seconds — used by the decision engine's schedule/buff windows
  // AND the burn→runway economy (a month = 30 days). Declared here so BURN below can read it.
  // NEW TIME MODEL (DESIGN-time-accountant): 1 in-game day = 5 real minutes = 300s. A real
  // month ≈ 8,640 in-game days ≈ ~23.7 in-game years. MONTH_SEC derives automatically
  // (DAY_SEC×30 = 9000s = 2.5 real hours). Day-derived timers (debt grace, decision no-repeat)
  // rescale with this — debt grace of 60 in-game days = 5 real hours of red before bankruptcy.
  // Saves store playtime in REAL seconds, so old saves reinterpret correctly with no migration.
  var DAY_SEC = 300;

  // ---- BURN → RUNWAY economy (Phase 2, DESIGN-depth-redesign §1) -------
  // The DRAIN that makes the accumulative economy bite. A continuous MONTHLY operating
  // cost, computed from the player's scale, drained from cash each tick (monthly→/sec via
  // MONTH_SEC). Weighted like reality: compute (~55%) dominates · salaries (~30%) ·
  // electricity (~12%, visible-but-minor) · datacenter upkeep · overhead. Costs grow
  // ~exponentially with each compute tier/datacenter (cps() already grows ×1.07–1.13 per
  // unit), while product revenue grows polynomially + jumps on model generations — so the
  // player is periodically squeezed and must raise funding to survive.
  //
  //   RUNWAY = cash / (burn − revenue)  in MONTHS  (the headline HUD number)
  //
  // Tuned so a NEW Normal game starts with a COMFORTABLE ~12–15 month runway and tightens
  // as you buy compute / hire. The whole burn × diff('burnMult'); compute+electricity ×
  // diff('computePriceMult'). See the simulation harness for the verified curves.
  var BURN = {
    MONTH_SEC: DAY_SEC * 30,  // real seconds per in-game MONTH (DAY_SEC=300 ⇒ 9000s/month = 2.5h)
    // compute (~55%): the monster. cps() = compute/sec your infra produces ≈ capacity.
    // Monthly compute cost = cps × COMPUTE_PER_CPS. Because cps grows exponentially with
    // generator tiers, this term is what tightens runway as you scale.
    COMPUTE_PER_CPS: 26,      // $/month per unit of compute/sec (the dominant term)
    // electricity (~12%): also tied to compute capacity but minor (kept visible).
    ELEC_PER_CPS: 5.7,        // $/month per unit of compute/sec
    // salaries (~30%): per researcher / head, per month. Scales with headcount AND seniority —
    // each shipped generation means you're competing for scarcer FRONTIER talent, so the
    // per-head salary rises (1 + modelGen × SALARY_GEN_STEP). Keeps salaries a meaningful slice
    // of burn as you scale (headcount alone is bounded, so flat salaries vanish vs compute).
    SALARY_PER_RESEARCHER: 900, // $/month per researcher (gen-0 baseline)
    SALARY_GEN_STEP: 0.6,       // +60% per-head salary per shipped generation (talent war)
    // datacenter upkeep: each built DC has a fixed monthly cost (escalates the fixed base).
    DC_UPKEEP: 1400,          // $/month per datacenter
    // overhead: total scale — a base office/ramen cost + a small per-head/per-DC slice so
    // even a bare garage burns a little (so runway is a finite, meaningful number from day 1).
    OVERHEAD_BASE: 28,        // $/month floor (founder ramen / office) — sets early runway
    OVERHEAD_PER_HEAD: 120,   // $/month overhead per researcher (HR, desks, tooling)
    OVERHEAD_PER_DC: 200,     // $/month overhead per datacenter (site/admin)
    // DEBT (DESIGN-debt-bankruptcy §B): once cash goes negative, creditors add +10% to burn
    // (a costlier hole that speeds the spiral, but not an instant death).
    RED_INTEREST_MULT: 1.10
  };

  // ---- FAILURE STATES (Phase 3, DESIGN-depth-redesign §2) --------------
  // The game is LOSABLE — but FAIRLY: every brink is telegraphed, every crisis ships a
  // recovery lever, and the worst outcomes are ULTIMATUMS (a countdown you can fight) rather
  // than instant death. All thresholds read difficulty levers (failWarnMonths/failMonths/
  // acqWindow) that were dormant until now.
  var CRISIS = {
    // ----- bankruptcy telegraph (escalating off runwayMonths) -----
    RED_MONTHS: 3,            // < this ⇒ red HUD + investor-pressure (level 2)
    // (amber = < diff('failWarnMonths'); ultimatum = ≤ max(diff('failMonths'), 1))
    ULTIMATUM_FLOOR: 1,       // ultimatum surfaces at ≤ this many months even if failMonths=0
    INSOLVENT_GRACE_SEC: 8,   // after the final ultimatum, this long at ~0 runway before the
                              // bankruptcy ending fires (one last beat; never a silent death)
    // ----- recovery levers -----
    // emergency down-round: cash NOW = months × net burn, but valuation×factor + heavy dilution.
    DOWNROUND_MONTHS: 10,     // months of runway the fire-sale raise buys
    DOWNROUND_VAL: [0.4, 0.7],// valuation multiplier band (worse the deeper the hole) — flavor
    DOWNROUND_SHARE: 6,       // market-share % surrendered to new investors (dilution)
    DOWNROUND_TRUST: -4,      // small trust ding (a fire-sale signals weakness)
    // venture debt: fast cash, repaid ×factor as an ADDED monthly burn for N months (death-spiral)
    DEBT_MONTHS: 8,           // months of runway the debt injects
    DEBT_REPAY_MULT: 1.9,     // total repaid = injected × this (× over the term)
    DEBT_TERM_MONTHS: 12,     // repayment spread across this many in-game months (adds to burn)
    // layoffs: cut burn by trimming headcount — lose researchers + morale (trust)
    LAYOFF_FRAC: 0.35,        // fraction of researchers let go
    LAYOFF_TRUST: -8,         // morale / public-trust hit
    LAYOFF_MIN_CASH_MONTHS: 4,// also clears a small cash cushion = this many months of NEW burn
    // sell / pivot a product line: lower ceiling, lower burn (sheds compute + a generation tier)
    PIVOT_COMPUTE_FRAC: 0.45, // fraction of compute STOCK sold for cash
    PIVOT_CASH_MONTHS: 6,     // cash raised = this many months of net burn
    PIVOT_SHARE: -5,          // market share lost (you exited a segment)
    // ----- hostile acquisition (ultimatum; the scaled "fair" failure) -----
    // Triggers WEAK-BUT-VALUABLE: high valuation AND (low runway OR slipping share OR trust collapse).
    ACQ_MIN_VALUATION: 5e8,   // only a genuinely valuable lab is worth absorbing ($500M+)
    ACQ_RUNWAY_MONTHS: 4,     // weakness signal: runway under this
    ACQ_TRUST: 30,            // weakness signal: trust collapsed under this
    ACQ_SHARE_DROP: 1.5,      // weakness signal: market share fell ≥ this since last peak
    ACQ_OFFER_MULT: [1.1, 1.5], // acqui-hire payout to investors = valuation × this (a pittance)
    ACQ_POACH_FRAC: 0.18,     // researchers poached PER unfought turn
    ACQ_TURN_SEC: 30,         // real seconds per acquisition "turn" (the countdown ticks)
    ACQ_COOLDOWN_SEC: 240,    // after you fight one off, this long before another can trigger
    ACQ_MIN_GEN: 2,           // not before you've shipped a couple models (no garage takeovers)
    // fighting the offer:
    ACQ_PILL_TRUST: 10,       // poison-pill/retention rally: +trust, costs cash
    ACQ_PILL_CASH_MONTHS: 3,  // cost of the retention package = this many months of burn
    ACQ_PILL_SHARE: 2,        // and a small share bump from signaling strength
    ACQ_WINOFF_VAL_MULT: 1.4, // valuation you must regain (× the trigger valuation) to break free
    // ----- nationalization (frontier-tier; rare, gated late) -----
    NAT_MIN_VALUATION: 2e10,  // frontier scale ($20B+) — only the strategically-vital get seized
    NAT_MIN_GEN: 6,           // and only very late (near the AGI frontier)
    NAT_TRUST: 25,            // a state moves in when trust has collapsed at frontier scale
    NAT_REG_VEC: 70,          // …or regulatory-risk vector is maxed out
    NAT_GRACE_SEC: 12         // restructuring beat before the 'nationalized' ending lands
  };

  // ---- Misc ------------------------------------------------------------
  var SETTINGS = {
    SAVE_KEY: 'singularity_inc_save_v1',
    SAVE_VERSION: 16,         // Phase 7: variance layers (worldSeed/scenario/climate; safe migrate)
    AUTOSAVE_INTERVAL: 5,     // seconds
    TICK_MAX_DELTA: 0.25      // clamp huge frame deltas (tab switch handled by offline)
  };

  window.GAME_CONFIG = {
    DAY_SEC: DAY_SEC,
    GENERATORS: GENERATORS,
    MILESTONES: MILESTONES,
    UPGRADES: UPGRADES,
    MANAGERS: MANAGERS,
    PRESTIGE: PRESTIGE,
    CORE: CORE,
    MODELGEN: MODELGEN,
    PROCESS: PROCESS,
    DATACENTER: DATACENTER,
    RESEARCH2: RESEARCH2,
    TALENT: TALENT,
    FUNDING: FUNDING,
    BURN: BURN,
    CRISIS: CRISIS,
    UNLOCKS: UNLOCKS,
    RISK: RISK,
    TAP: TAP,
    OFFLINE: OFFLINE,
    ADS: ADS,
    ACHIEVEMENTS: ACHIEVEMENTS,
    WINDFALL: WINDFALL,
    ACTS: ACTS,
    RIVALS: RIVALS,
    RIVAL_SHARE_CAP: RIVAL_SHARE_CAP,
    RIVAL_POOL: RIVAL_POOL,
    RIVAL_ARCHETYPES: RIVAL_ARCHETYPES,
    RIVAL_BASE: RIVAL_BASE,
    RIVAL_TRAJ: RIVAL_TRAJ,
    RIVAL_LIFECYCLE: RIVAL_LIFECYCLE,
    DIFFICULTY: DIFFICULTY,
    SCENARIOS: SCENARIOS,
    CLIMATE: CLIMATE,
    LUCKY_CFG: LUCKY_CFG,
    LUCKY: LUCKY,
    ACQUIRE: ACQUIRE,
    RACE: RACE,
    ENDINGS: ENDINGS,
    TRUST: TRUST,
    CARDS: CARDS,
    DECISIONS: DECISIONS,
    INCIDENTS: INCIDENTS,
    INCIDENTS_CFG: INCIDENTS_CFG,
    BLACKSWAN: BLACKSWAN,
    BLACKSWAN_CFG: BLACKSWAN_CFG,
    DECISIONS_PACING: DECISIONS_PACING,
    DECISION_TIERS: DECISION_TIERS,
    DECISION_TIER_OVERLAP: DECISION_TIER_OVERLAP,
    DECISION_TIER_BY_NUM: DECISION_TIER_BY_NUM,
    EXECS: EXECS,
    EXECS_OFFLINE: EXECS_OFFLINE,
    MARKET: MARKET,
    COSMETICS: COSMETICS,
    EVENTS: EVENTS,
    COMBO: COMBO,
    INSIGHT: INSIGHT,
    BREAKTHROUGH: BREAKTHROUGH,
    GEN_CLASS: GEN_CLASS,
    TECH: TECH,
    ARTIFACTS: ARTIFACTS,
    ARTIFACT_SLOTS: ARTIFACT_SLOTS,
    ARTIFACT_SYNERGY: ARTIFACT_SYNERGY,
    SINGULARITY: SINGULARITY,
    SETTINGS: SETTINGS
  };
})();
