# Singularity Inc.

A realistic idle/tycoon game about building an AI lab from a garage to AGI —
**with no resets** (your infrastructure persists forever; you only grow). Tap to
generate **compute**, buy hardware that produces more, **train a forward-only ladder
of model generations** (v1 → … → AGI) as real-time processes, earn revenue from your
shipped product, raise **funding rounds**, and race **rival labs** for market share
and AGI. Grounded in how real labs (OpenAI/Anthropic) actually grew, paced for a
**month+** of real play. Vanilla JS + HTML + CSS, no build step, self-contained, RU + EN.

> Design source of truth: **GAME-DESIGN.md** (GDD v3). This README describes the
> current GDD-v3 build (the earlier prestige/reset meta has been replaced).

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
│   ├── icons.js            inline-SVG icon set (no emoji anywhere)
│   ├── music.js            procedural ambient music (WebAudio, off by default)
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
- ✅ **Localization:** complete **RU + EN** (394/394 keys each, verified parity),
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

## 5. How to play (GDD v3 — no resets, continuous growth)

**Core loop — Lab tab:**
- **TRAIN** (tap the big button) generates **🖥 compute** (and a little seed cash to
  bootstrap the garage).
- Buy **hardware** (Laptop → Matrioshka); generators produce **compute/sec** (the
  bottleneck). Every 10/25/50/100… owned **doubles** that tier's compute.
- **Train model generations** (v1 → … → AGI): a **timed process** gated by compute.
  Each generation is a **permanent leap** — more product revenue + a market-share
  jump + new content — and you **keep all infrastructure** (no reset, ever).
- Your shipped product earns **💵 money** (scales with infra × generation × market
  share × trust). Money buys generators and funds expansion.
- **Datacenter builds** (Lab) and **research projects** (Team) are extra **parallel
  timers** — there's always something progressing while a model trains.

**Resources:** 💵 Money · 🖥 Compute · 👥 Researchers. Derived scoreboards:
**Valuation** and **Market share**.

**Other systems (unlock as you grow):**
- **Team:** hire **researchers** (speed up every timed process) and run **research
  projects** (permanent efficiency). The war for talent.
- **Finance:** raise **funding rounds** (Seed → A → B → C → IPO) as your valuation
  grows — big one-time cash + a permanent revenue boost. (Replaces day-trading.)
- **Race:** 3 rival labs grow market share & race to AGI on their own timelines.
  Become **#1**, then reach **AGI first**. Newsroom decisions move **Trust** (which
  moves revenue). Safety/risk vectors rise with capability — fund **Alignment** or a
  **crisis** cuts your compute ×0.2 (the speed-vs-safety tradeoff).

**Retention:** offline "while you were away" summary; **daily check-in** + forgiving
streak; **earned boosts** (⚡ ×2 all timers, from daily/achievements/idle); an
always-a-next-goal nudge. Shareable moments: 🦄 Unicorn ($1B), 🚀 Decacorn ($10B).

**Endgame:** reach **AGI** for a finale + an ending by play style (**Aligned /
Reckless / Nationalized**), or get **Beaten** if a rival reaches AGI first. Then,
optionally, start a **Founder's Legacy** — a new company keeping a permanent bonus
(never a forced reset).

See `BALANCE.md` for the full month-long arc, levers, and sim findings.

---

## 6. Saves & reset

Autosaves every 5s and on tab hide/close to a versioned localStorage key
(`singularity_inc_save_v1`). Manual save and **reset** are in Settings.
