/* Singularity Inc. v2 — core logic (GROUND-UP rewrite). window.GAME.
   Core loop: click->money -> hardware(rent) + premises(m²) -> power -> release model
   -> price slider -> users(inertia) -> revenue -> build -> next version -> AGI. */
(function () {
  'use strict';
  var C = window.GAME_CONFIG;
  var FMT = window.GAME_FMT;

  // ---------- event bus ----------
  var listeners = {};
  function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }
  function emit(ev, a) { (listeners[ev] || []).forEach(function (fn) { try { fn(a); } catch (e) {} }); }

  // ---------- one-time onboarding gate ----------
  // The forced first-run tutorial (laptop->click->...->price) must run ONLY on the very
  // first playthrough. After a loss/restart it must NOT repeat (owner). Persist a flag in
  // its OWN localStorage key so it survives reset() (which wipes the save).
  var TUT_DONE_KEY = 'singularity_inc_tut_done';
  function tutorialEverDone() { try { return localStorage.getItem(TUT_DONE_KEY) === '1'; } catch (e) { return false; } }
  function markTutorialDone() { try { localStorage.setItem(TUT_DONE_KEY, '1'); } catch (e) {} }
  // The company name is real data (not a flag), but it must also survive a save loss / reset
  // so the naming prompt never re-appears for an experienced player. Mirror it into its own
  // persistent key (written on every save) and seed a fresh state from it.
  var NAME_KEY = 'singularity_inc_name';
  function storedName() { try { return localStorage.getItem(NAME_KEY) || null; } catch (e) { return null; } }
  function storeName(n) { try { if (n) localStorage.setItem(NAME_KEY, n); } catch (e) {} }

  // ---------- state ----------
  var state = null;

  function freshState() {
    var hw = {}; C.HARDWARE.forEach(function (h) { hw[h.id] = 0; });        // owned (idle, rentable)
    var committed = {}; C.HARDWARE.forEach(function (h) { committed[h.id] = 0; }); // committed to the model
    var staff = {}; C.STAFF.forEach(function (s) { staff[s.id] = 0; });
    return {
      v: C.SETTINGS.SAVE_VERSION,
      cash: C.START.cash,
      tapLevel: 0,
      // overclock / разгон combo (transient — resets on reload, that's fine)
      heat: 0,                      // 0..1 click "heat"; rapid clicks build it, idle decays it
      lastClickAt: -999,            // gameTime of the previous click (for the combo window)
      boughtLaptop: false,          // forced first action
      // forced hands-on tutorial step:
      //   'laptop'->'click'->'upgrade'->'server'->'release'->'price'->null(done)
      // laptop..server are HARD-LOCK steps (only the one action allowed);
      // release+price are SOFT (free play, the coach just keeps pointing — never traps).
      tutorial: tutorialEverDone() ? null : 'laptop',   // forced onboarding only on the FIRST run; restarts skip straight to free play
      hw: hw,
      committed: committed,
      premise: C.START.premise,
      version: 0,                   // 0 = pre-release; reaches AGI_VERSION on win
      users: 0,
      price: C.ECON.priceDefault,
      effPrice: C.ECON.priceDefault,  // price the MARKET has actually felt — eases toward `price` so income/share don't snap on a price change
      lastPriceSet: -999,             // gameTime of last APPLIED price change (price is rate-limited: once per real minute)
      // training
      training: false,
      trainElapsed: 0,
      // risk meters (high = healthy)
      safety: C.RISK.start,
      approval: C.RISK.start,
      legality: C.RISK.start,
      staff: staff,
      // time
      gameTime: 0,                  // seconds elapsed in-game
      // bills
      elecAccrued: 0,               // $ accrued since last bill cut
      billDue: 0,                   // $ amount of the current outstanding weekly bill
      billDueAt: 0,                 // gameTime by which it must be paid (deadline)
      lastBillCut: 0,               // gameTime of last weekly cut
      overdue: false,
      overdueSince: 0,              // gameTime when the current bill first went overdue (0 = not overdue)
      taxAccrued: 0,                // revenue accumulated this month (taxed at cut)
      lastTaxCut: 0,
      taxDue: 0,
      monthRevenue: 0,
      // bookkeeping
      lifetimeRevenue: 0,
      lifetimeRent: 0,
      clicks: 0,
      // FTUE: one-time teach popups already shown (progressive disclosure)
      ftue: {},                     // { rent:1, release:1, bill:1, meter:1, fire:1, lawsuit:1, board:1 }
      // event/consequence bookkeeping (telegraphed set-pieces — see GDD §7)
      boardActive: false,           // board of directors convened (after first funding round)
      lastFireWarn: 0,              // gameTime of last fire hazard warning (throttle)
      lastLawWarn: 0,
      lastFire: 0,                  // gameTime of last fire event (recovery cooldown)
      lastEventDay: 0,              // last in-game day events were rolled
      boardWarned: false,          // board issued its liquidity warning
      lastPriceChange: 0,          // gameTime the player last set a token price (nudge grace)
      lastPriceNudge: 0,           // gameTime of last "re-check your price" nudge (throttle)
      // outcome
      over: false,
      outcome: null,                // 'agi' | 'bankrupt' | 'approval' | 'safety' | 'legality' | 'beaten'
      // rivals snapshot (computed)
      lang: null,
      sound: true, music: true, sfxVol: 0.8, musicVol: 0.6, haptics: true,
      companyName: storedName(),    // restored from the survive-reset key so naming never re-prompts an experienced player
      // story cutscenes (one-time gates). Default to the persistent onboarding flag so an
      // experienced player whose save was lost/reset never replays the intro/tutorial set-pieces.
      seenIntro: tutorialEverDone(),       // INTRO cutscene shown (after naming, before tutorial)
      seenFirstModel: tutorialEverDone(),  // FIRST-MODEL story flourish shown (first v1 release)
      seenServersCut: tutorialEverDone(),  // SERVERS cutscene shown (first time cash reaches mini-server cost)
      seenPremiseMove: {},          // PREMISE-MOVE chapters shown: map premiseId -> 1 (once per tier)
      // milestone celebrations: map of crossed threshold keys -> 1 (fire once per run)
      milestones: {},
      // ---- STORY / DECISION system (window.GAME_STORY drives these) ----
      // accumulating named tallies set by branching choices (e.g. ruthless/careful/
      // responsible/hype/principled/open/closed/liberator/controller/symbiont). Counts/bools.
      storyFlags: {},
      // fire-once map of DECISION ids that have already been presented (id -> 1)
      seenDecisions: {},
      // the decision currently awaiting a choice (id) or null. While set, the trigger
      // engine holds off and the modal owns the screen (game already pauses under modals).
      pendingDecision: null
    };
  }

  // ---------- derived: hardware / power / capacity ----------
  function ownedM2() {
    var sum = 0;
    C.HARDWARE.forEach(function (h) {
      sum += (state.hw[h.id] + state.committed[h.id]) * h.m2;
    });
    return sum;
  }
  function capacityM2() { return C.PREMBYID[state.premise].m2; }
  function freeM2() { return capacityM2() - ownedM2(); }

  // power = Σ committed hardware power
  function power() {
    var p = 0;
    C.HARDWARE.forEach(function (h) { p += state.committed[h.id] * h.power; });
    return p;
  }
  // rent/s from idle (owned, uncommitted) hardware
  function rentPerSec() {
    var r = 0;
    C.HARDWARE.forEach(function (h) { r += state.hw[h.id] * h.rent; });
    return r;
  }
  // total committed power available toward next-version threshold (same as power())
  function totalKw() {
    var k = 0;
    C.HARDWARE.forEach(function (h) {
      k += (state.hw[h.id] + state.committed[h.id]) * h.kw;
    });
    return k;
  }

  // ---------- forced hands-on tutorial ----------
  // step order: 'laptop' -> 'click' -> 'upgrade' -> 'server' -> 'release' -> 'price' -> null
  // The first four are HARD-LOCK (gate everything but the one action). 'release' and
  // 'price' are SOFT guidance: the player plays freely (buy hardware, click, train, set
  // price) and the coach just keeps pointing — so it can never trap/soft-lock.
  function tutorialStep() { return state ? state.tutorial : null; }
  function tutorialActive() { return !!(state && state.tutorial); }
  // HARD-LOCK steps gate input + hide non-onboarding chrome; SOFT steps (release/price)
  // are free play with guidance only. UI uses this to decide what to lock/show.
  var TUT_HARD = { laptop: 1, click: 1, upgrade: 1, server: 1 };
  function tutorialHardLock() { return !!(state && state.tutorial && TUT_HARD[state.tutorial]); }
  function setTutorial(step) {
    if (!state || state.tutorial === step) return;
    if (!step && state.tutorial) markTutorialDone();   // onboarding just completed → never force it again on later runs
    state.tutorial = step;
    emit('tutorial', step);
    emit('change');
  }
  // re-evaluate auto-advance conditions (called after actions + each tick)
  function advanceTutorial() {
    if (!state || !state.tutorial) return;
    var step = state.tutorial;
    if (step === 'laptop') {
      if (state.boughtLaptop) setTutorial('click');
    } else if (step === 'click') {
      // ready to upgrade once they can afford the first click upgrade (~$10)
      if (state.cash >= tapUpgradeCost()) setTutorial('upgrade');
    } else if (step === 'release') {
      // SOFT step: shipping v1 advances it (also handled in finishTraining for immediacy)
      if (state.version >= 1) setTutorial('price');
    }
    // 'upgrade' -> 'server' is driven by upgradeTap(); 'server' -> 'release' by
    // buyHw('miniserver'); 'release' -> 'price' by finishTraining(); 'price' -> null by setPrice().
  }

  // ---------- click / tap ----------
  // current overclock multiplier (cold = 1.0, fully heated = 1 + comboBonus)
  function comboMult() {
    var h = state ? state.heat : 0;
    if (h < 0) h = 0; else if (h > 1) h = 1;
    return 1 + h * C.TAP.comboBonus;
  }
  // base click value WITHOUT the разгон heat multiplier — used for the STATIC
  // displayed numbers (orb "+$X" + click-upgrade button) so the digits stay still.
  function baseTapValue() {
    return C.TAP.base * Math.pow(C.TAP.upgrade.gain, state.tapLevel);
  }
  function tapValue() {
    return baseTapValue() * comboMult();
  }
  function tapUpgradeCost() {
    if (state.tapLevel >= C.TAP.upgrade.maxLevel) return Infinity;
    return C.TAP.upgrade.baseCost * Math.pow(C.TAP.upgrade.costMult, state.tapLevel);
  }
  function canUpgradeTap() {
    return state.tapLevel < C.TAP.upgrade.maxLevel && state.cash >= tapUpgradeCost();
  }
  function upgradeTap() {
    if (!canUpgradeTap()) return false;
    state.cash -= tapUpgradeCost();
    state.tapLevel++;
    if (state.tutorial === 'upgrade') setTutorial('server');
    emit('change');
    return true;
  }
  // a click: if laptop not bought yet, clicking does nothing (forced onboarding)
  function click() {
    if (state.over) return 0;
    if (!state.boughtLaptop) return 0;
    state.clicks++;
    // overclock / разгон: a click inside the combo window heats up (capped at 1);
    // the heat then decays in tick() once you slow down.
    if (state.gameTime - state.lastClickAt <= C.TAP.comboWindow) {
      state.heat = Math.min(1, state.heat + C.TAP.comboStep);
    }
    state.lastClickAt = state.gameTime;
    // if training, accelerate it; clicks during training also still earn
    if (state.training) {
      state.trainElapsed += C.TRAIN.clickAccel;
    }
    var v = tapValue();
    if (isFinite(v)) state.cash += v;   // never let a bad click value corrupt the balance
    // advance the forced tutorial when the player can afford the first click upgrade
    if (state.tutorial === 'click' && state.cash >= tapUpgradeCost()) setTutorial('upgrade');
    return v;
  }

  // ---------- hardware purchase ----------
  function hwCost(id) { return C.HWBYID[id].cost; }
  function canBuyHw(id) {
    var h = C.HWBYID[id];
    if (state.cash < h.cost) return false;
    if (freeM2() < h.m2) return false;
    return true;
  }
  function buyHw(id) {
    if (!canBuyHw(id)) return false;
    var h = C.HWBYID[id];
    state.cash -= h.cost;
    state.hw[id]++;
    if (id === 'laptop' && !state.boughtLaptop) state.boughtLaptop = true;
    // forced tutorial advances
    if (state.tutorial === 'laptop' && id === 'laptop') setTutorial('click');
    else if (state.tutorial === 'server' && id === 'miniserver') setTutorial('release'); // -> guide to first model
    emit('change');
    return true;
  }

  // ---------- premises ----------
  function premiseIndex() {
    for (var i = 0; i < C.PREMISES.length; i++) if (C.PREMISES[i].id === state.premise) return i;
    return 0;
  }
  function nextPremise() {
    var i = premiseIndex();
    return (i + 1 < C.PREMISES.length) ? C.PREMISES[i + 1] : null;
  }
  function canBuyPremise(id) {
    var p = C.PREMBYID[id];
    if (!p) return false;
    if (state.cash < p.cost) return false;
    // can only move forward
    var idx = -1; for (var i = 0; i < C.PREMISES.length; i++) if (C.PREMISES[i].id === id) idx = i;
    return idx > premiseIndex();
  }
  function buyPremise(id) {
    if (!canBuyPremise(id)) return false;
    var p = C.PREMBYID[id];
    state.cash -= p.cost;
    state.premise = id;
    emit('change');
    return true;
  }

  // ---------- training / release ----------
  function currentVersionDef() {
    // the version we are trying to release next (version+1)
    var target = state.version + 1;
    for (var i = 0; i < C.VERSIONS.length; i++) if (C.VERSIONS[i].v === target) return C.VERSIONS[i];
    return null;
  }
  function powerReq() {
    var d = currentVersionDef();
    return d ? d.powerReq : Infinity;
  }
  function trainDuration() {
    var nextV = state.version + 1;
    return C.TRAIN.baseDuration * Math.pow(C.TRAIN.durationGrowth, Math.max(0, nextV - 1));
  }
  // total power available to commit = committed (already) + all idle owned hardware power
  function availablePower() {
    var p = power();
    C.HARDWARE.forEach(function (h) { p += state.hw[h.id] * h.power; });
    return p;
  }
  function canStartTraining() {
    if (state.training || state.over) return false;
    if (!currentVersionDef()) return false;
    return availablePower() >= powerReq();
  }
  function startTraining() {
    if (!canStartTraining()) return false;
    state.training = true;
    state.trainElapsed = 0;
    emit('change');
    return true;
  }
  function trainingProgress() {
    if (!state.training) return 0;
    return Math.min(1, state.trainElapsed / trainDuration());
  }
  function trainingTimeLeft() {
    if (!state.training) return 0;
    return Math.max(0, trainDuration() - state.trainElapsed);
  }
  function finishTraining() {
    // commit ALL idle hardware to the model; rent stops, power flows to the model
    C.HARDWARE.forEach(function (h) {
      state.committed[h.id] += state.hw[h.id];
      state.hw[h.id] = 0;
    });
    state.version++;
    state.training = false;
    state.trainElapsed = 0;
    // set a sensible default price near the sweet spot on first release
    if (state.version === 1) state.price = sweetSpotPrice();
    // Seed users toward the new model's audience immediately so it EARNS from the first
    // second. The slow inertia ramp from 0 made income (and the finance NET) momentarily
    // read as $0 / negative right at the proud release moment — felt like the balance/income
    // "disappeared" (owner). Jump UP to the target (never down) so every release is an
    // instant, visible payoff and releasing always beats renting the same gear.
    state.users = Math.max(state.users, Math.round(usersTarget()));
    // SOFT tutorial: once the first model ships, guide the player to the price slider
    if (state.tutorial === 'release' && state.version >= 1) setTutorial('price');
    emit('release', state.version);
    emit('change');
    if (state.version >= C.AGI_VERSION) endGame('agi');
  }

  // ---------- demand / users / revenue (the heart) ----------
  function demand() {
    // demand = the model's MAX audience. Grows with progression (era), scaled to a real
    // headcount (userScale), and gated by market REACH — public approval is the lever on
    // how many people are willing to use your AI (reachMin..1.0).
    var base = (currentVersionDef() || C.VERSIONS[C.VERSIONS.length - 1]).demandBase;
    var ver = Math.max(1, state.version);
    var reach = C.ECON.reachMin + (1 - C.ECON.reachMin) * approvalNorm();
    return base * Math.pow(C.ECON.demandGrowth, ver) * C.ECON.userScale * reach;
  }
  function approvalNorm() { return Math.max(0, Math.min(1, state.approval / 100)); }

  function vOf(pw, price, approval) {
    if (pw <= 0 || price <= 0) return 0;
    return pw / Math.pow(price, C.ECON.priceExp) * (0.5 + 0.5 * approval);
  }
  function playerV(priceOverride) {
    if (state.version < 1) return 0;
    var price = (priceOverride != null) ? priceOverride : state.price;
    return vOf(power(), price, approvalNorm());
  }

  // rivals: scripted power vs game-days
  function rivalPower(r) {
    var days = state.gameTime / C.DAY_SEC;
    return r.power0 * Math.pow(2, days / C.RIVAL_CFG.doublingDays) * (r.growth / 2 + 0.5);
  }
  function rivalV(r) {
    return vOf(rivalPower(r), r.price, r.approval);
  }
  function sumRivalV() {
    var s = 0; C.RIVALS.forEach(function (r) { s += rivalV(r); }); return s;
  }
  function share(priceOverride) {
    var pv = playerV(priceOverride);
    var tot = pv + sumRivalV();
    if (tot <= 0) return 0;
    return pv / tot;
  }
  function usersTarget(priceOverride) {
    if (state.version < 1) return 0;
    return demand() * share(priceOverride);
  }
  // revenue/s preview at a given price (uses target users, for slider preview)
  function revenuePreview(price) {
    var u = usersTarget(price);
    return u * price * C.ECON.usage;
  }
  function revenuePerSec() {
    // uses the EASED price so income transitions smoothly after a price change
    return state.users * (state.effPrice != null ? state.effPrice : state.price) * C.ECON.usage;
  }
  // Projected revenue/s of the model you'd ship NEXT (its higher-era demand at the best
  // price), so the payoff of releasing is visible BEFORE you commit — and it's clear a
  // released model earns far more than renting the same gear (owner).
  function projectedReleaseIncomePerSec() {
    var nextVer = (state.version || 0) + 1;
    if (nextVer > C.AGI_VERSION) return 0;
    var def = C.VERSIONS[nextVer - 1];
    var base = (def && def.demandBase) || 40;
    var an = approvalNorm();
    var reach = C.ECON.reachMin + (1 - C.ECON.reachMin) * an;
    var dem = base * Math.pow(C.ECON.demandGrowth, nextVer) * C.ECON.userScale * reach;
    var pw = availablePower();   // releasing commits all idle gear → this becomes model power
    var bestRev = 0, riv = sumRivalV();
    for (var p = C.ECON.priceMin; p <= C.ECON.priceMax; p += 0.5) {
      var pv = vOf(pw, p, an); var tot = pv + riv;
      var rev = dem * (tot > 0 ? pv / tot : 0) * p * C.ECON.usage;
      if (rev > bestRev) bestRev = rev;
    }
    return bestRev;
  }
  // sweet spot: price that maximizes revenuePreview (numeric scan)
  function sweetSpotPrice() {
    var best = C.ECON.priceMin, bestRev = -1;
    for (var p = C.ECON.priceMin; p <= C.ECON.priceMax; p += 0.25) {
      var r = revenuePreview(p);
      if (r > bestRev) { bestRev = r; best = p; }
    }
    return Math.round(best * 100) / 100;
  }
  function setPrice(p, force) {
    p = Math.max(C.ECON.priceMin, Math.min(C.ECON.priceMax, Number(p)));
    if (isNaN(p)) return false;
    // Token price is a strategic COMMITMENT — rate-limited to once per real minute
    // (= 1 in-game day). BUT a free-edit window (priceGraceSec) right after a change lets the
    // player freely re-adjust (fix a fumble / learn the curve) before the lock kicks in.
    // Rejected (returns false) only when PAST the grace window and still within the cooldown;
    // the UI reverts the slider then. force=true bypasses (engine-driven defaults).
    if (!force && state.lastPriceSet >= 0) {
      var since = state.gameTime - state.lastPriceSet;
      if (since >= C.ECON.priceGraceSec && since < C.DAY_SEC) return false;
    }
    state.price = p;
    state.lastPriceChange = state.gameTime;   // grace the re-tune nudge after a manual change
    // Anchor a NEW cooldown window only when starting fresh (first change, or after the full
    // cooldown elapsed). Edits WITHIN the grace window keep the original anchor, so the whole
    // change→adjust→lock cycle stays ~1 real minute.
    if (force || state.lastPriceSet < 0 || (state.gameTime - state.lastPriceSet) >= C.DAY_SEC) {
      state.lastPriceSet = state.gameTime;
    }
    // SOFT tutorial finale: setting a token price completes onboarding (free play)
    if (state.tutorial === 'price') setTutorial(null);
    emit('change');
    return true;
  }
  function priceCooldownLeft() {
    if (!state || state.lastPriceSet < 0) return 0;
    var since = state.gameTime - state.lastPriceSet;
    if (since < C.ECON.priceGraceSec) return 0;   // still inside the free-edit window — not locked
    return Math.max(0, C.DAY_SEC - since);
  }
  // seconds left in the free-edit window (you may still re-adjust the price freely)
  function priceGraceLeft() {
    if (!state || state.lastPriceSet < 0) return 0;
    return Math.max(0, C.ECON.priceGraceSec - (state.gameTime - state.lastPriceSet));
  }
  // current REALISED market share (from the eased user count) — eases on a price change
  // instead of snapping; the price-card preview still shows the instant target share.
  function currentShare() {
    if (!state || state.version < 1) return 0;
    var dem = demand();
    return dem > 0 ? Math.max(0, Math.min(1, state.users / dem)) : 0;
  }

  // ---------- costs ----------
  function elecPerSec() { return totalKw() * C.BILLS.elecRateKwh / 3600; }
  function upkeepPerSec() { var pm = C.PREMBYID[state.premise]; return pm ? pm.upkeep : 0; }
  function salaryPerSec() { return 0; } // staff have no salary in the buy-once + level-up design
  function costPerSec() { return elecPerSec() + upkeepPerSec() + salaryPerSec(); }
  function effectiveTaxRate() {
    var red = Math.min(C.STAFF_CFG.taxMax, state.staff.economist * C.STAFF_CFG.taxPerLevel);
    return Math.max(0, C.BILLS.taxRate - red);
  }

  // output penalty if overdue
  function outputMult() { return state.overdue ? (1 - C.BILLS.overduePenalty) : 1; }

  // net cash rate shown to player (rent + revenue - continuous costs). bills are discrete.
  function incomePerSec() { return (rentPerSec() + revenuePerSec()) * outputMult(); }
  function netPerSec() { return incomePerSec() - costPerSec(); }

  // ---------- staff (buy once at lvl 1, then upgrade with one-time cash up to maxLevel) ----------
  function staffLevel(id) { return state.staff[id] || 0; }
  // meter bonus for a given level: 0 if not hired; lvl 1..10 → 4,6,9,11,13,16,18,20,23,25 (capped)
  function levelEffect(level) {
    if (level <= 0) return 0;
    var cfg = C.STAFF_CFG;
    var e = Math.round(cfg.effectBase + (level - 1) * (cfg.effectMax - cfg.effectBase) / (cfg.maxLevel - 1));
    return Math.min(cfg.effectMax, e);
  }
  function staffHireCost(id) {
    var lvl = state.staff[id] || 0;
    if (lvl >= C.STAFF_CFG.maxLevel) return Infinity;
    return Math.round(C.STAFF_CFG.hireBase * Math.pow(C.STAFF_CFG.hireGrowth, lvl));
  }
  function canHire(id) { return (state.staff[id] || 0) < C.STAFF_CFG.maxLevel && state.cash >= staffHireCost(id); }
  function hire(id) { // buy (lvl 0→1) or level up
    if (!canHire(id)) return false;
    state.cash -= staffHireCost(id);
    state.staff[id]++;
    emit('change');
    return true;
  }
  function staffBonus(effect) {
    // exactly one staffer per meter effect — return its level's bonus
    var found = null;
    C.STAFF.forEach(function (s) { if (s.effect === effect) found = s.id; });
    if (!found) return 0;
    return levelEffect(state.staff[found] || 0);
  }

  // ---------- risk meters ----------
  function updateMeters(dt) {
    var prem = C.PREMBYID[state.premise];
    // safety & legality drift toward premise class (+ staff buff)
    var safeTarget = Math.min(100, prem.safety * 100 + staffBonus('safety'));
    var legalTarget = Math.min(100, prem.legality * 100 + staffBonus('legality'));
    state.safety += (safeTarget - state.safety) * C.RISK.driftRate * dt;
    state.legality += (legalTarget - state.legality) * C.RISK.driftRate * dt;
    // approval: gouging hurts. compare price to sweet spot.
    if (state.version >= 1) {
      var sweet = sweetSpotPrice();
      var ratio = sweet > 0 ? state.price / sweet : 1;
      var marketBonus = staffBonus('approval');
      if (ratio > C.RISK.gougeStartRatio) {
        var sev = Math.min(1, (ratio - C.RISK.gougeStartRatio) / 1.5);
        state.approval -= C.RISK.approvalDrain * sev * dt;
      } else {
        var apTarget = Math.min(100, 60 + marketBonus);
        if (state.approval < apTarget) state.approval += C.RISK.approvalRecover * dt;
      }
      state.approval = Math.min(100, state.approval + marketBonus * 0.0 ); // bonus folded via target
    }
    state.safety = Math.max(0, Math.min(100, state.safety));
    state.approval = Math.max(0, Math.min(100, state.approval));
    state.legality = Math.max(0, Math.min(100, state.legality));
    // FTUE: first time any risk meter drifts meaningfully off its start value
    if (!state.ftue.meter && state.version >= 1) {
      var moved = Math.abs(state.safety - C.RISK.start) > 2 ||
                  Math.abs(state.approval - C.RISK.start) > 2 ||
                  Math.abs(state.legality - C.RISK.start) > 2;
      if (moved) {
        // which meter moved most + whether it's falling (the teachable case)
        var which = 'safety', md = Math.abs(state.safety - C.RISK.start);
        if (Math.abs(state.approval - C.RISK.start) > md) { which = 'approval'; md = Math.abs(state.approval - C.RISK.start); }
        if (Math.abs(state.legality - C.RISK.start) > md) { which = 'legality'; }
        emit('ftue', 'meter:' + which);
      }
    }
    // floor => lose
    if (!state.over) {
      if (state.approval <= C.RISK.floorLose) endGame('approval');
      else if (state.legality <= C.RISK.floorLose) endGame('legality');
      else if (state.safety <= C.RISK.floorLose) endGame('safety');
    }
  }

  // ---------- bills (discrete, weekly + monthly) ----------
  function nextBillDay() {
    return Math.ceil((state.lastBillCut + C.WEEK_DAYS * C.DAY_SEC) / C.DAY_SEC);
  }
  function nextBillIn() {
    return Math.max(0, (state.lastBillCut + C.WEEK_DAYS * C.DAY_SEC) - state.gameTime);
  }
  // forecast next weekly bill ~ current accrual + projected accrual to cut
  function billForecast() {
    var remain = nextBillIn();
    return state.elecAccrued + (elecPerSec() + upkeepPerSec() + salaryPerSec()) * remain;
  }
  function cutWeeklyBill() {
    var carried = state.billDue;            // unpaid balance rolls forward
    // Waive a trivially small electricity bill (e.g. only a laptop drawing pennies in the
    // first week) instead of dunning the player with a $0 plate. Only when nothing is owed.
    if (carried <= 0.01 && state.elecAccrued < C.BILLS.minBill) {
      state.elecAccrued = 0;
      state.lastBillCut = state.gameTime;
      return;
    }
    state.billDue = carried + state.elecAccrued;
    state.elecAccrued = 0;
    state.lastBillCut = state.gameTime;
    if (carried > 0.01) {
      // already in arrears — keep the overdue clock running; just refresh the headline
      if (!state.overdue) { state.overdue = true; if (!state.overdueSince) state.overdueSince = state.gameTime; }
    } else {
      state.billDueAt = state.gameTime + C.BILLS.payDeadlineDays * C.DAY_SEC;
      state.overdue = false;
      state.overdueSince = 0;
    }
    emit('bill', state.billDue);
    emit('change');
  }
  function payBill() {
    if (state.billDue <= 0) return false;
    if (state.cash < state.billDue) {
      // partial pay allowed: pay what you can, rest stays due
      var pay = Math.max(0, state.cash);
      state.cash -= pay;
      state.billDue -= pay;
      emit('change');
      return state.billDue <= 0.001;
    }
    state.cash -= state.billDue;
    state.billDue = 0;
    state.overdue = false;
    state.overdueSince = 0;
    emit('change');
    return true;
  }
  function cutMonthlyTax() {
    var tax = state.monthRevenue * effectiveTaxRate();
    state.taxDue = tax;
    state.monthRevenue = 0;
    state.lastTaxCut = state.gameTime;
    // tax just adds to outstanding bill due immediately (folded into cash on settle)
    state.billDue += tax;
    if (state.billDueAt <= state.gameTime) state.billDueAt = state.gameTime + C.BILLS.payDeadlineDays * C.DAY_SEC;
    emit('change');
  }

  // ---------- solvency signal ----------
  function billCovered() { return state.cash >= billForecast(); }

  // ---------- date/time HUD ----------
  function dayNumber() { return Math.floor(state.gameTime / C.DAY_SEC) + 1; }
  function timeOfDay() {
    var frac = (state.gameTime % C.DAY_SEC) / C.DAY_SEC;
    if (frac < 0.25) return 'morning';
    if (frac < 0.5) return 'day';
    if (frac < 0.75) return 'evening';
    return 'night';
  }
  function dateLabel() {
    // simple month/day from day number
    var d = dayNumber();
    var month = Math.floor((d - 1) / 30) + 1;
    var dom = ((d - 1) % 30) + 1;
    return { day: dom, month: month, tod: timeOfDay(), dayNum: d };
  }

  // ---------- rivals / race ----------
  function standings() {
    var rows = [];
    rows.push({ id: 'you', power: power(), v: playerV(), isPlayer: true });
    C.RIVALS.forEach(function (r) {
      rows.push({ id: r.id, power: rivalPower(r), v: rivalV(r), isPlayer: false });
    });
    rows.sort(function (a, b) { return b.power - a.power; });
    return rows;
  }
  function playerShare() { return share(); }
  function agiLeaderDays() {
    // estimate days until first rival hits AGI power (for race readout)
    var best = Infinity;
    C.RIVALS.forEach(function (r) {
      var pw = rivalPower(r);
      if (pw >= r.agiAt) { best = 0; return; }
      var days = C.RIVAL_CFG.doublingDays * Math.log2(r.agiAt / pw);
      if (days < best) best = days;
    });
    return best;
  }
  function rivalReachedAgi() {
    var hit = false;
    C.RIVALS.forEach(function (r) { if (rivalPower(r) >= r.agiAt) hit = true; });
    return hit;
  }

  // ---------- end game ----------
  function endGame(outcome) {
    if (state.over) return;
    state.over = true;
    state.outcome = outcome;
    state.training = false;
    emit('gameover', outcome);
    emit('change');
  }

  // ---------- events as consequences (telegraphed; never pure RNG) ----------
  // hardware currently AT this premises (everything — there's one premises at a time)
  function hardwareTotalUnits() {
    var n = 0;
    C.HARDWARE.forEach(function (h) { n += state.hw[h.id] + state.committed[h.id]; });
    return n;
  }
  // a FIRE: lose this premises' hardware (power + rent drop), drop back to the garage to recover
  function triggerFire() {
    // wipe all hardware (it was at the burned premises); keep version/model but power collapses
    var lostUnits = hardwareTotalUnits();
    var lostPower = power();
    C.HARDWARE.forEach(function (h) { state.hw[h.id] = 0; state.committed[h.id] = 0; });
    // fall back to the garage (free, safe-ish) so the player can rebuild
    state.premise = C.START.premise;
    state.lastFire = state.gameTime;
    emit('event', { type: 'fire', lostUnits: lostUnits, lostPower: lostPower });
    emit('change');
  }
  // a LAWSUIT: a fine (liquidity hit) + a legality drop
  function triggerLawsuit() {
    var cfg = C.EVENTS.lawsuit;
    var fine = Math.max(cfg.fineMin, state.cash * cfg.finePctCash);
    fine = Math.min(fine, Math.max(0, state.cash) + cfg.fineMin); // can push into the red a little
    state.cash -= fine;
    state.legality = Math.max(0, state.legality - cfg.legalityHit);
    emit('event', { type: 'lawsuit', fine: fine });
    emit('change');
    if (!state.over && state.legality <= C.RISK.floorLose) endGame('legality');
  }

  function updateEvents(dt) {
    if (state.over) return;
    var DAY = C.DAY_SEC;
    var fcfg = C.EVENTS.fire, lcfg = C.EVENTS.lawsuit, bcfg = C.EVENTS.board;

    // telegraph warnings (continuous, throttled) — fire only matters once you own hardware
    if (state.safety < fcfg.warnBelow && hardwareTotalUnits() > 0 &&
        state.gameTime - state.lastFireWarn >= fcfg.warnCooldownDays * DAY &&
        state.gameTime - state.lastFire >= fcfg.recoverCooldownDays * DAY) {
      state.lastFireWarn = state.gameTime;
      emit('event', { type: 'fireWarn', safety: state.safety });
    }
    if (state.legality < lcfg.warnBelow && state.version >= 1 &&
        state.gameTime - state.lastLawWarn >= lcfg.warnCooldownDays * DAY) {
      state.lastLawWarn = state.gameTime;
      emit('event', { type: 'lawWarn', legality: state.legality });
    }

    // BOARD convenes the first time the company has real money (proxy for a funding round)
    if (!state.boardActive && state.version >= 1 && state.cash >= bcfg.conveneCash) {
      state.boardActive = true;
      emit('event', { type: 'boardConvene' });
    }
    // board liquidity warning: overdue + board active, before bankruptcy grace expires
    if (state.boardActive && state.overdue && state.overdueSince > 0 && !state.boardWarned) {
      var overdueDays = (state.gameTime - state.overdueSince) / DAY;
      if (overdueDays >= (C.BILLS.bankruptGraceDays - bcfg.warnGraceDays)) {
        state.boardWarned = true;
        emit('event', { type: 'boardWarn' });
      }
    }
    if (!state.overdue) state.boardWarned = false; // reset once you recover

    // day-boundary dice for the actual set-pieces (so chances are per game-day, not per tick)
    var today = Math.floor(state.gameTime / DAY);
    if (today > state.lastEventDay) {
      state.lastEventDay = today;
      // FIRE: armed only when safety is dangerously low and you have hardware to lose
      if (state.safety < fcfg.armBelow && hardwareTotalUnits() > 0 &&
          state.gameTime - state.lastFire >= fcfg.recoverCooldownDays * DAY) {
        var fchance = Math.min(fcfg.chancePerDayMax,
          fcfg.chancePerDayMax * (fcfg.armBelow - state.safety) / fcfg.armBelow);
        if (Math.random() < fchance) triggerFire();
      }
      // LAWSUIT: armed when legality is low and you have a live (revenue-making) model
      if (!state.over && state.legality < lcfg.armBelow && state.version >= 1) {
        var lchance = Math.min(lcfg.chancePerDayMax,
          lcfg.chancePerDayMax * (lcfg.armBelow - state.legality) / lcfg.armBelow);
        if (Math.random() < lchance) triggerLawsuit();
      }
      // PRICE RE-TUNE NUDGE: the sweet spot drifts (rivals grow, you ship a bigger model).
      // Nudge once in a while when the set price has wandered well off it — but not right
      // after the player set a price, and not during onboarding (the price step guides that).
      if (!state.over && state.version >= 1 && !state.training && !state.tutorial) {
        var pn = C.PRICE_NUDGE;
        if (state.gameTime - state.lastPriceChange >= pn.graceDays * DAY &&
            state.gameTime - state.lastPriceNudge >= pn.cooldownDays * DAY) {
          var sweetP = sweetSpotPrice();
          if (sweetP > 0) {
            var pr = state.price / sweetP;
            if (pr < pn.lowRatio || pr > pn.highRatio) {
              state.lastPriceNudge = state.gameTime;
              emit('event', { type: 'priceNudge', high: pr > 1 });
            }
          }
        }
      }
    }
  }

  // ---------- main tick ----------
  function tick(dt) {
    if (!state || state.over) return;
    state.gameTime += dt;
    // overclock heat decays toward 0 whenever you stop clicking
    if (state.heat > 0) {
      state.heat -= C.TAP.comboDecay * dt;
      if (state.heat < 0) state.heat = 0;
    }
    if (state.tutorial) advanceTutorial();

    // ease the "felt" price toward the set price so income, market share and users
    // transition SMOOTHLY after a price change instead of snapping (owner). Converges in
    // ~25s — well inside the once-per-minute price cooldown.
    if (state.effPrice == null) state.effPrice = state.price;
    state.effPrice += (state.price - state.effPrice) * 0.12 * dt;
    if (Math.abs(state.price - state.effPrice) < 0.01) state.effPrice = state.price;

    // continuous income/costs
    var rev = revenuePerSec() * outputMult() * dt;
    var rent = rentPerSec() * outputMult() * dt;
    if (!isFinite(rev)) rev = 0;            // a bad delta must never corrupt the balance
    if (!isFinite(rent)) rent = 0;          // (owner: "balance sometimes just disappears")
    state.cash += rev + rent;
    if (!isFinite(state.cash)) state.cash = 0;
    var hadRent = state.lifetimeRent;
    state.lifetimeRevenue += rev;
    state.lifetimeRent += rent;
    state.monthRevenue += rev;
    // FTUE: first time idle hardware actually earns rent
    if (hadRent <= 0 && rent > 0 && !state.ftue.rent) emit('ftue', 'rent');

    // accrue bills (these are deferred, not subtracted from cash here)
    state.elecAccrued += costPerSec() * dt;

    // users move toward target with inertia (per-tick = per second basis; scale by dt).
    // Users are whole people: snap to the target once within 1 (no endless fractional
    // crawl) and keep the running count integer.
    if (state.version >= 1) {
      var target = Math.round(usersTarget());
      state.users += (target - state.users) * C.ECON.usersInertia * dt;
      if (Math.abs(target - state.users) < 1) state.users = target;
      state.users = Math.max(0, Math.round(state.users));
    }

    // training auto-progress
    if (state.training) {
      state.trainElapsed += dt;
      if (state.trainElapsed >= trainDuration()) finishTraining();
    }

    // meters
    updateMeters(dt);
    // events as consequences (fire / lawsuit / board) — telegraphed, day-boundary dice
    updateEvents(dt);

    // weekly bill cut
    if (state.gameTime - state.lastBillCut >= C.WEEK_DAYS * C.DAY_SEC) cutWeeklyBill();
    // overdue check + board grace timer
    if (state.billDue > 0 && state.gameTime > state.billDueAt) {
      if (!state.overdue) { state.overdue = true; state.overdueSince = state.gameTime; }
    } else if (state.billDue <= 0.01) {
      state.overdue = false; state.overdueSince = 0;
    }
    // monthly tax
    if (state.gameTime - state.lastTaxCut >= C.MONTH_DAYS * C.DAY_SEC) cutMonthlyTax();

    // BANKRUPTCY: the board pulls the plug if a bill stays overdue past the grace window
    // (long low liquidity → forced shutdown). Income is never shown negative; this is the lever.
    if (!state.over && state.overdue && state.overdueSince > 0) {
      if (state.gameTime - state.overdueSince >= C.BILLS.bankruptGraceDays * C.DAY_SEC) endGame('bankrupt');
    }
    // rival reaches AGI first => lose the race
    if (!state.over && rivalReachedAgi() && state.version < C.AGI_VERSION) endGame('beaten');
  }

  // ---------- offline ----------
  function computeOffline(elapsed, ad) {
    // cap offline
    var cap = 12 * 3600;
    var t = Math.min(elapsed, cap);
    var earned = incomePerSec() * t;
    var elecBill = costPerSec() * t;
    return { earned: earned, t: t, elecBill: elecBill, taxBill: 0 };
  }
  function applyOffline(earned, off) {
    if (earned > 0 && isFinite(earned)) state.cash += earned;
    if (off && off.t) {
      state.gameTime += off.t;
      state.elecAccrued += off.elecBill || 0;
    }
    emit('change');
  }

  // ---------- save / load ----------
  function save() {
    if (!state) return;
    try {
      var json = JSON.stringify(state);
      localStorage.setItem(C.SETTINGS.SAVE_KEY, json);
      localStorage.setItem(C.SETTINGS.SAVE_KEY + '_t', String(Date.now()));
      storeName(state.companyName);   // mirror the name so it survives a save loss / reset
      if (state.companyName) markTutorialDone();   // any saved named run counts as "onboarded" — never re-run onboarding after a save loss
      if (window.GAME_SDK && window.GAME_SDK.savePlayerData) {
        var p = window.GAME_SDK.savePlayerData(json);
        if (p && p.catch) p.catch(function () {});
      }
    } catch (e) {}
  }
  function load() {
    try {
      var raw = localStorage.getItem(C.SETTINGS.SAVE_KEY);
      if (!raw) return false;
      var s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return false;
      if (s.v !== C.SETTINGS.SAVE_VERSION) return false;   // no migration in phase 1
      // pre-existing saves (made before the tutorial shipped) skip onboarding:
      // if they already own a laptop, they're past the forced start.
      var hadTutorial = (s.tutorial !== undefined);
      // merge onto fresh to fill any missing fields
      var f = freshState();
      for (var k in f) if (s[k] === undefined) s[k] = f[k];
      if (!hadTutorial && s.boughtLaptop) s.tutorial = null;
      // ensure hw/committed/staff have all ids
      C.HARDWARE.forEach(function (h) { if (s.hw[h.id] == null) s.hw[h.id] = 0; if (s.committed[h.id] == null) s.committed[h.id] = 0; });
      C.STAFF.forEach(function (st) {
        if (s.staff[st.id] == null) s.staff[st.id] = 0;
        if (s.staff[st.id] > C.STAFF_CFG.maxLevel) s.staff[st.id] = C.STAFF_CFG.maxLevel; // clamp old count-saves to level<=10
      });
      // harden against a "vanished balance": never load a non-finite number
      if (typeof s.cash !== 'number' || !isFinite(s.cash)) s.cash = f.cash;
      if (typeof s.users !== 'number' || !isFinite(s.users)) s.users = 0;
      if (typeof s.price !== 'number' || !isFinite(s.price)) s.price = f.price;
      // sync the "felt" price to the saved price on load — the market is "settled" from the
      // player's view after a reload, so income shouldn't dip for ~25s.
      s.effPrice = s.price;
      state = s;
      return true;
    } catch (e) { return false; }
  }
  function reset() {
    try { localStorage.removeItem(C.SETTINGS.SAVE_KEY); } catch (e) {}
    state = freshState();
    emit('change');
  }

  // ---------- init ----------
  function init() {
    var loaded = load();
    if (!loaded) state = freshState();
    // Migrate existing experienced players: if the loaded save is clearly past onboarding,
    // record the one-time flag now so a later loss/restart never re-runs the forced tutorial.
    if (loaded && state && (state.boughtLaptop || (state.version || 0) >= 1 || state.tutorial == null)) markTutorialDone();
    // language from saved or i18n detect
    if (state.lang && window.GAME_I18N) window.GAME_I18N.setLang(state.lang);
    else if (window.GAME_I18N) state.lang = window.GAME_I18N.getLang();
    // audio prefs
    try {
      if (window.GAME_AUDIO) { window.GAME_AUDIO.setEnabled(state.sound); window.GAME_AUDIO.setVolume(state.sfxVol); }
    } catch (e) {}
    // offline credit
    var off = null;
    try {
      var lastSave = Number(localStorage.getItem(C.SETTINGS.SAVE_KEY + '_t')) || 0;
      if (lastSave) {
        var elapsed = (Date.now() - lastSave) / 1000;
        if (elapsed > 60) off = computeOffline(elapsed, false);
      }
    } catch (e) {}
    return off;
  }

  window.GAME = {
    get state() { return state; },
    on: on, emit: emit,
    init: init, save: save, load: load, reset: reset,
    tick: tick, computeOffline: computeOffline, applyOffline: applyOffline,
    // clicking
    tapValue: tapValue, baseTapValue: baseTapValue, click: click, comboMult: comboMult,
    tapUpgradeCost: tapUpgradeCost, canUpgradeTap: canUpgradeTap, upgradeTap: upgradeTap,
    // forced tutorial
    tutorialStep: tutorialStep, tutorialActive: tutorialActive, tutorialHardLock: tutorialHardLock, advanceTutorial: advanceTutorial,
    // hardware
    hwCost: hwCost, canBuyHw: canBuyHw, buyHw: buyHw,
    ownedM2: ownedM2, capacityM2: capacityM2, freeM2: freeM2,
    power: power, rentPerSec: rentPerSec, totalKw: totalKw, availablePower: availablePower,
    // premises
    premiseIndex: premiseIndex, nextPremise: nextPremise, canBuyPremise: canBuyPremise, buyPremise: buyPremise,
    // training / release
    currentVersionDef: currentVersionDef, powerReq: powerReq, trainDuration: trainDuration,
    canStartTraining: canStartTraining, startTraining: startTraining,
    trainingProgress: trainingProgress, trainingTimeLeft: trainingTimeLeft, finishTraining: finishTraining,
    // economy
    demand: demand, playerV: playerV, share: share, playerShare: playerShare,
    usersTarget: usersTarget, revenuePreview: revenuePreview, revenuePerSec: revenuePerSec,
    sweetSpotPrice: sweetSpotPrice, setPrice: setPrice, approvalNorm: approvalNorm,
    priceCooldownLeft: priceCooldownLeft, priceGraceLeft: priceGraceLeft, currentShare: currentShare,
    projectedReleaseIncomePerSec: projectedReleaseIncomePerSec,
    // costs
    elecPerSec: elecPerSec, upkeepPerSec: upkeepPerSec, salaryPerSec: salaryPerSec,
    costPerSec: costPerSec, incomePerSec: incomePerSec, netPerSec: netPerSec, effectiveTaxRate: effectiveTaxRate,
    // staff
    staffHireCost: staffHireCost, canHire: canHire, hire: hire, staffBonus: staffBonus,
    staffLevel: staffLevel, levelEffect: levelEffect,
    // bills
    billForecast: billForecast, nextBillIn: nextBillIn, nextBillDay: nextBillDay,
    payBill: payBill, billCovered: billCovered,
    // hud
    dayNumber: dayNumber, timeOfDay: timeOfDay, dateLabel: dateLabel,
    // rivals
    standings: standings, agiLeaderDays: agiLeaderDays, rivalReachedAgi: rivalReachedAgi,
    // events (consequences)
    triggerFire: triggerFire, triggerLawsuit: triggerLawsuit, hardwareTotalUnits: hardwareTotalUnits,
    // meta
    endGame: endGame
  };
})();
