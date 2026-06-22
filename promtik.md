# 🎛 FootyCompare — запуск дирижёра (шпаргалка)

Проект и ТЗ на машине в `/root/footycompare/` (`SPEC.md`, `PLAN.md`, `AGENTS.md`, `LOOP_PROMPT.md`).
Репозиторий: **https://github.com/sanaglamo-arch/stats**

---

## 🔄 ПЕРЕЗАПУСК (продолжить — подхватить недокоммиченный визуальный овёрхол)

Предыдущий прогон умер во время визуального овёрхола; изменения лежат на диске некоммитнутыми.
Этот промт заточен на **продолжение**, а не старт с нуля.

**1. Создай окно:** `Ctrl+B`, затем `c`
**2. Перейди в проект:**
```
cd /root/footycompare
```
**3. Запусти Claude:**
```
claude --dangerously-skip-permissions
```
**4. Набери `/loop` и вставь:**

```
/loop Ты продолжаешь как дирижёр FootyCompare в /root/footycompare (ТЗ: SPEC.md, PLAN.md, AGENTS.md, LOOP_PROMPT.md — прочитай их). ВАЖНО: предыдущий прогон умер во время ВИЗУАЛЬНОГО ОВЁРХОЛА — в рабочем дереве лежат НЕкоммитнутые изменения (page.tsx, studio.tsx, новый studio-controls.tsx, player-controls.tsx, globals.css, motion.tsx, словари + новые скриншоты в preview/). Сначала сделай git status и разберись с этим овёрхолом: доведи его до ума — КАРТОЧКА герой экрана (крупно, по центру, как эталон SPEC §4), god-tier glassmorphism+неон, premium-вид, мобайл = карточка во весь экран. Обязательно через скилл ui-ux-pro-max. Прогони ВСЕ гейты (typecheck/lint/test/build/e2e); тяжёлый build/Playwright запускай с ОТКЛЮЧЁННЫМ sandbox (иначе SIGKILL). Перегенери и сними скриншоты главной (desktop 1366 + mobile 390) в preview/. ТОЛЬКО при зелёных гейтах закоммить+запушь в sanaglamo-arch/stats. Потом продолжай по PLAN.md, делегируя субагентам (отдельные Tester+Reviewer), коммит+пуш после каждой задачи. Работай автономно до конца.
```

---

## 🆕 ЧИСТЫЙ СТАРТ (если нужно с нуля)

Шаги те же (окно → `cd /root/footycompare` → `claude --dangerously-skip-permissions` → `/loop` +):

```
/loop Действуй как автономный инженер-дирижёр проекта FootyCompare строго по инструкции из /root/footycompare/LOOP_PROMPT.md (блок «ПРОМТ ДЛЯ ВСТАВКИ») и источникам правды /root/footycompare/SPEC.md, PLAN.md, AGENTS.md. Сначала ШАГ 0 (тулчейн node20+pnpm, надёжная настройка git-push в sanaglamo-arch/stats), потом фазы по PLAN.md — делегируй субагентам, отдельные Tester и Reviewer, коммит+пуш после каждой задачи. Любой визуал — через скилл ui-ux-pro-max. Работай автономно подряд до конца, до «BUILD COMPLETE».
```

---

## Навигация / утро
- Окна tmux: `Ctrl+B` + номер. Если дирижёр умер — его окно закрывается; перезапусти по инструкции выше.
- Если процессы внезапно киляются (exit 137/143/144) — это песочница/память; тяжёлые команды гонять с отключённым sandbox.
- Артефакты на сверку: `BUILD_REPORT.md`, `DATA_REPORT.md`, превью в `preview/`.
- Локально: `cd /root/footycompare && pnpm install && pnpm dev`.
- Перед публикацией проверь сам: красоту карточки и правдивость цифр (`DATA_REPORT.md`).
