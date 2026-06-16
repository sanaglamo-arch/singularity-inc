# Singularity Inc.

A satirical idle/incremental ("clicker") game about bootstrapping an AI startup
into a frontier lab. Tap to **TRAIN**, buy hardware that auto-earns, research
permanent multipliers by **releasing frontier models** (prestige), and manage the
signature **Risk ↔ Alignment** tension before a misalignment incident slashes your
output. Vanilla JS + HTML + CSS, no build step, fully self-contained, RU + EN.

Built for the **Yandex Games** platform.

---

## 1. What's in this folder

```
singularity-inc/
├── index.html              ← game entry (ZIP ROOT)
├── styles.css              cinematic-dark + glass + neon design system
├── fonts.css               @font-face for the two bundled fonts (local)
├── assets/fonts/           Orbitron + JetBrains Mono woff2 (bundled, no fetch)
├── js/
│   ├── config.js           all tunable economy numbers
│   ├── format.js           number formatting (K/M/B/T/Qa…/scientific)
│   ├── i18n.js             RU + EN dictionaries + t()
│   ├── sdk.js              Yandex SDK abstraction (loads ONLY on Yandex)
│   ├── ads.js              rewarded / interstitial / sticky (graceful no-op)
│   ├── game.js             economy engine, tick, save/load, prestige, risk
│   ├── audio.js            procedural WebAudio SFX (off by default)
│   ├── fx.js               particle bursts, ripples, shake, vignette (juice)
│   ├── icons.js            29 inline-SVG icons (no emoji anywhere)
│   ├── ui.js               DOM rendering + interaction
│   └── main.js             bootstrap, RAF loop, anti-hijack guards
├── icon-512.png            512×512 RGB (no alpha) store icon
├── cover-800x470.png       800×470 store cover/banner
├── screenshots/            mobile (1350×2400) + desktop (1920×1080) per screen
├── assets/                 icon/cover SVG build sources (not shipped)
├── dist/
│   ├── singularity-inc.zip          ← UPLOAD THIS to Yandex (game build)
│   └── store-assets-bundle.zip      icon + cover + screenshots bundle
├── BALANCE.md              final economy tuning + numbers
└── README.md
```

`dist/singularity-inc.zip` has **index.html at the archive root** (Yandex
requirement) and contains only the runtime files (index.html, styles.css, js/).

---

## 2. Run locally

No build step. Serve the folder over HTTP (localStorage needs a real origin):

```bash
cd singularity-inc
python3 -m http.server 8099
# open http://localhost:8099/index.html
```

Opening `index.html` via `file://` also works but localStorage is more reliable
over HTTP. With no Yandex SDK present the game runs fully — ads simply show an
"unavailable" toast and player data falls back to localStorage.

---

## 3. Upload to Yandex Games — step by step

1. Go to the **Yandex Games Console** → **Developer dashboard** → *Create game*
   (or open your draft).
2. **Game build:** upload **`dist/singularity-inc.zip`**.
   - The console unpacks it and must find **`index.html` at the root** — it does.
   - Draft will be served inside Yandex's iframe; the SDK loads automatically
     there (it is deliberately NOT loaded when run anywhere else).
3. **Localization / locales:** add **two** locales: **Russian (ru)** and
   **English (en)**. The game auto-detects the player's language and also has an
   in-game EN/RU toggle (Settings tab).
   - Title (both locales): **Singularity Inc.**
   - Short description (EN): *"Scale compute, release frontier models, and keep
     your AI aligned in this satirical idle tycoon."*
   - Short description (RU): *"Наращивай вычисления, выпускай передовые модели и
     удерживай ИИ под контролем в сатирическом idle-тайкуне."*
4. **Icon:** upload **`icon-512.png`** (512×512, RGB, no alpha, illustration).
5. **Cover / banner:** upload **`cover-800x470.png`** (800×470 illustration).
6. **Screenshots:** upload from `screenshots/`. Recommended set:
   - Mobile (1350×2400, 9:16): `mobile_company.png`, `mobile_upgrades.png`,
     `mobile_research.png`, `mobile_alignment_incident.png`, `mobile_stats.png`,
     `mobile_achievements.png`, `mobile_settings.png`, `mobile_onboarding.png`.
   - Desktop (1920×1080, 16:9): `hero.png` (= `desktop_company.png`),
     `desktop_upgrades.png`, `desktop_research.png`, `desktop_alignment.png`,
     `desktop_stats.png`, `desktop_achievements.png`.
   - `mobile_company_ru.png` showcases the Russian localization.
7. **Category:** Simulation / Strategy (Idle). **Monetization:** enable Rewarded
   Video, Interstitial, and Sticky banner — all are wired and degrade gracefully.
8. Save → **send for moderation**. The checklist below is already satisfied.

> The asset bundle `dist/store-assets-bundle.zip` contains the icon, cover, and
> all screenshots together for convenience.

---

## 4. Yandex moderation checklist — already satisfied

- ✅ **No page scroll / no pull-to-refresh:** `html,body { overflow:hidden;
  overscroll-behavior:none }`, `body { position:fixed; inset:0 }`; only inner
  panels scroll, with `overscroll-behavior:contain`.
- ✅ **No native UI hijacking:** `contextmenu`, `selectstart`, `dragstart`,
  `gesturestart`, `dblclick` and multi-touch `touchmove` are prevented;
  `user-select:none`, `touch-action:manipulation`.
- ✅ **Viewport:** `width=device-width, initial-scale=1, maximum-scale=1,
  user-scalable=no, viewport-fit=cover`; safe-area insets respected.
- ✅ **Localization:** complete **RU + EN** (272/272 keys each, verified parity),
  runtime toggle, no untranslated strings.
- ✅ **Icon:** 512×512, **RGB, no alpha**, square, an illustration.
- ✅ **Cover:** 800×470 illustration (not a screenshot).
- ✅ **Screenshots:** real gameplay, seeded with a realistic mid-game save.
- ✅ **Zero external requests at runtime** when not on Yandex (no CDNs, fonts,
  analytics, trackers). Both fonts (Orbitron, JetBrains Mono) are **bundled
  locally** as woff2 in `assets/fonts/`. The Yandex SDK is the *only* external
  script and is loaded **exclusively** when the game detects it is running inside
  Yandex (framed / yandex hostname). Everything else is bundled.
- ✅ **No emoji as icons** — all 29 icons are hand-authored inline SVG
  (`js/icons.js`), one consistent stroke family.
- ✅ **No real trademarks** — all names are generic (e.g. "H-class GPU",
  "Model v3"); the game is clearly satire and states it is unaffiliated.
- ✅ **SDK integration:** `YaGames.init()`, `LoadingAPI.ready()`,
  `GameplayAPI.start/stop`, rewarded + interstitial + sticky banner, player data
  via SDK with localStorage fallback — all optional-chained.

---

## 5. How to play

- **TRAIN** (tap the big button) for early cash bursts.
- Buy **hardware** (10 tiers, Laptop → AGI Core); each auto-generates revenue.
  Every 10/25/50/100… owned **doubles** that tier's output.
- Spend cash on **Upgrades** (global & per-tier multipliers) and **Automation**
  (managers auto-buy a tier and add +50% output).
- **Alignment Lab:** scaling raises **Risk**. Fund **Alignment** to suppress it.
  At 100% Risk a **misalignment incident** cuts output ×0.2 until it resolves or
  you pay to **contain** it.
- **Research tab → Release Model** (prestige): reset hardware & cash for
  **Research Points (RP)**; each RP grants **+5% permanent global output**, and RP
  buys permanent research upgrades.
- Earnings continue **offline** (cap 8h, +4h via research, doublable by ad).

**Active-play hooks (Round 3):**
- **Overclock** — tap fast to build heat for up to ×5 tap value.
- **Insight Flash** — a glowing collectible drifts by every ~45–95s; tap it for
  Frenzy (×7 output), Click Frenzy (×100 tap), or an instant cash windfall.
- **Breakthrough** — an ability (×10 output 20s, 180s cooldown); re-fire within
  8s of it ending to chain into ×15 for 25s.

See `BALANCE.md` for the full economy.

---

## 6. Saves & reset

Autosaves every 5s and on tab hide/close to a versioned localStorage key
(`singularity_inc_save_v1`). Manual save and **reset** are in Settings.
