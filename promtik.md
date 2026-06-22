# 🎛 FootyCompare — запуск дирижёра (шпаргалка)

Всё, что нужно скопировать, чтобы запустить ночную автономную сборку проекта.
Планы/ТЗ лежат на машине в `/root/footycompare/` (`SPEC.md`, `PLAN.md`, `AGENTS.md`, `LOOP_PROMPT.md`).

---

## Шаги запуска

**1. Создай новое окно tmux:**
нажми `Ctrl+B`, затем `c`

**2. Перейди в папку проекта:**
```
cd /root/footycompare
```

**3. Запусти Claude в автономном режиме:**
```
claude --dangerously-skip-permissions
```
*(или обычный `claude`, потом `Shift+Tab` — циклит режимы разрешений до «auto-accept»)*

**4. Запусти луп** — набери `/loop` и вставь промт ниже.

---

## 📋 Промт лупа (копировать целиком)

```
/loop Действуй как автономный инженер-дирижёр проекта FootyCompare строго по инструкции из /root/footycompare/LOOP_PROMPT.md (блок «ПРОМТ ДЛЯ ВСТАВКИ») и источникам правды /root/footycompare/SPEC.md, PLAN.md, AGENTS.md. Сначала ШАГ 0 (тулчейн node20+pnpm, надёжная настройка git-push в sanaglamo-arch/stats), потом фазы по PLAN.md — делегируй субагентам, отдельные Tester и Reviewer, коммит+пуш после каждой задачи. Любой визуал — через скилл ui-ux-pro-max. Работай автономно подряд до конца, до «BUILD COMPLETE».
```

---

## Навигация и утро

- Переключение окон tmux: `Ctrl+B` + номер (`0` singularity, `1` чат-обсуждение, `2`+ дирижёр).
- Репозиторий сборки: **https://github.com/sanaglamo-arch/stats**
- Утром смотри в `/root/footycompare/`: `BUILD_REPORT.md` (+ превью карточки) и `DATA_REPORT.md` (что выверить).
- Локальный запуск: `cd /root/footycompare && pnpm install && pnpm dev`
- Проверь сам две вещи, которые агент не гарантирует: **красоту карточки** (вкус) и **правдивость цифр** (по `DATA_REPORT.md`).
