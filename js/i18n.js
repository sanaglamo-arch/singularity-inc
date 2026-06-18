/* i18n -> window.GAME_I18N with t(key, vars), setLang, getLang.
   Singularity Inc. v2 — lean dict, full EN + RU parity. */
(function () {
  'use strict';

  var EN = {
    game_title: 'Singularity Inc.',
    tagline: 'From a garage script to an artificial god.',

    // tabs
    tab_company: 'Company',
    tab_hardware: 'Hardware',
    tab_model: 'Model',
    tab_world: 'World',
    tab_settings: 'Settings',

    // HUD
    cash: 'Cash',
    per_sec: '{v}/sec',
    net_per_sec: 'net {sign}{v}/s',
    date_morning: 'morning',
    date_day: 'midday',
    date_evening: 'evening',
    date_night: 'night',
    date_label: '{day} of month {month}, {tod}',
    power_label: 'Power',
    users_label: 'Users',
    share_label: 'Market share',
    version_label: 'Model',
    no_model: 'No model yet',

    // onboarding / click
    tap_train: 'CLICK',
    tap_hint_buy_laptop: 'First: buy a starter laptop below to enable clicking.',
    tap_hint_click: 'Click to earn money',
    tap_value: '+${v}',
    click_upgrade: 'Upgrade click → ${v} (cost ${c})',
    click_upgrade_max: 'Click maxed (${v})',
    onboard_laptop: 'Buy your first laptop to start. No rent — but it lets you click for money.',

    // hardware
    hw_title: 'Hardware',
    hw_intro: 'Idle hardware earns rent. On a model release it commits and produces Power instead.',
    hw_cost: 'Cost',
    hw_power: 'Power',
    hw_rent: 'Rent',
    hw_kw: 'kW',
    hw_m2: 'm²',
    hw_owned: 'idle ×{n}',
    hw_committed: 'in model ×{n}',
    hw_buy: 'Buy',
    hw_no_space: 'No space',
    hw_no_cash: 'Need ${c}',
    hw_name_laptop: 'Old Laptop',
    hw_name_miniserver: 'Mini-server',
    hw_name_workstation: 'Workstation',
    hw_name_gpuserver: 'GPU Server',
    hw_name_rack1u: '1U Rack',
    hw_name_rack42u: '42U Rack',
    hw_name_airack: 'AI Rack',
    hw_name_modulardc: 'Modular DC',
    hw_name_hyperscale: 'Hyperscale',

    // premises
    prem_title: 'Premises',
    prem_intro: 'Premises give m² — the cap on how much hardware fits.',
    prem_current: 'Current: {name}',
    prem_capacity: 'Space: {used} / {cap} m²',
    prem_upkeep: 'Upkeep ${v}/s',
    prem_legality: 'Legality {v}%',
    prem_safety: 'Safety {v}%',
    prem_upgrade: 'Move to {name} (${c})',
    prem_max: 'Top-tier premises',
    prem_name_garage: 'Garage',
    prem_name_basement: 'Cheap Basement',
    prem_name_office: 'Small Office',
    prem_name_bizpark: 'Business Park',
    prem_name_megacampus: 'Mega Campus',

    // model / training / release
    model_title: 'Model',
    model_dev: 'In development → {label}',
    model_live: 'Live: {label}',
    train_need_power: 'Need {req} Power to train {label} (have {have})',
    train_start: 'Train {label}',
    train_progress: 'Training {label}… {pct}%',
    train_click_faster: 'Click to train faster!',
    train_time_left: '{t} left',
    release_done: 'Released {label}! Hardware committed; rent stops, Power flows.',

    // pricing
    price_title: 'Token Price',
    price_intro: 'Lower price wins share; too high angers society. Tune to your sweet spot.',
    price_label: 'Price: ${v}',
    price_preview: 'At ${p}: share {share}% · {users} users · {sign}${profit}/s · approval {arrow}',
    price_sweet: 'Sweet spot ≈ ${v}',
    price_set_default: 'Set to sweet spot',
    approval_up: '↑',
    approval_down: '↓',
    approval_flat: '→',

    // bills
    bills_title: 'Bills',
    bill_next: 'Next bill in {d} days ≈ ${v}',
    bill_covered: 'covered ✓',
    bill_uncovered: 'short ⚠',
    bill_due: 'BILL DUE: ${v} — pay within 1 day',
    bill_pay: 'Pay ${v}',
    bill_overdue: 'OVERDUE — output −30% until paid',
    bill_pay_short: 'Pay bill',
    tax_rate: 'Tax {v}%',

    // meters
    meters_title: 'Risk',
    meter_safety: 'Safety',
    meter_approval: 'Public approval',
    meter_legality: 'State & law',

    // staff
    staff_title: 'Team',
    staff_intro: 'Staff nudge your meters and taxes. Salaries go into your bills.',
    staff_hire: 'Hire (${c})',
    staff_count: '×{n}',
    staff_name_lawyer: 'Lawyer',
    staff_name_security: 'Security',
    staff_name_marketer: 'Marketer',
    staff_name_economist: 'Economist',
    staff_desc_lawyer: '↑ State & law',
    staff_desc_security: '↑ Safety',
    staff_desc_marketer: '↑ Approval',
    staff_desc_economist: '↓ Taxes',

    // world / rivals
    world_title: 'AGI Race',
    world_intro: 'Race rivals to AGI (the final model). Your share is relative to theirs.',
    standings_title: 'Market standings',
    standings_you: 'YOU',
    race_title: 'AGI race',
    race_ahead: 'You are leading the race.',
    race_behind: 'A rival leads — push your Power.',
    race_close: 'Neck and neck.',
    rival_name_openmind: 'OpenMind',
    rival_name_deepcore: 'DeepCore',
    rival_name_nebula: 'Nebula',

    // game over
    go_win_title: 'AGI ACHIEVED',
    go_win_flavor: 'You released the final model first. Singularity reached.',
    go_bankrupt_title: 'BANKRUPT',
    go_bankrupt_flavor: 'The money ran out. The board pulls the plug.',
    go_approval_title: 'CANCELLED',
    go_approval_flavor: 'Public approval hit zero. Your model is cancelled.',
    go_legality_title: 'BANNED',
    go_legality_flavor: 'The state shut you down over legality.',
    go_safety_title: 'SHUT DOWN',
    go_safety_flavor: 'Safety collapsed. Regulators pulled the model.',
    go_beaten_title: 'BEATEN TO AGI',
    go_beaten_flavor: 'A rival reached AGI first.',
    go_new_game: 'New Game',
    go_summary: 'Day {day} · Model {ver} · ${cash}',

    // settings
    settings_title: 'Settings',
    lang_label: 'Language',
    sound_label: 'Sound',
    music_label: 'Music',
    on: 'On', off: 'Off',
    reset_label: 'Reset game',
    reset_confirm: 'Reset all progress?',
    credits: 'Singularity Inc. v2 — phase 1 base.',

    common_free: 'free',
    common_max: 'max'
  };

  var RU = {
    game_title: 'Singularity Inc.',
    tagline: 'От гаражного скрипта до искусственного бога.',

    tab_company: 'Компания',
    tab_hardware: 'Железо',
    tab_model: 'Модель',
    tab_world: 'Мир',
    tab_settings: 'Настройки',

    cash: 'Деньги',
    per_sec: '{v}/сек',
    net_per_sec: 'итог {sign}{v}/с',
    date_morning: 'утро',
    date_day: 'день',
    date_evening: 'вечер',
    date_night: 'ночь',
    date_label: '{day} число, {month} мес., {tod}',
    power_label: 'Мощность',
    users_label: 'Юзеры',
    share_label: 'Доля рынка',
    version_label: 'Модель',
    no_model: 'Модели ещё нет',

    tap_train: 'КЛИК',
    tap_hint_buy_laptop: 'Сначала купи стартовый ноут ниже — он включит клик.',
    tap_hint_click: 'Кликай, чтобы зарабатывать',
    tap_value: '+${v}',
    click_upgrade: 'Апгрейд клика → ${v} (цена ${c})',
    click_upgrade_max: 'Клик прокачан (${v})',
    onboard_laptop: 'Купи первый ноут, чтобы начать. Аренды нет — но он даёт клик за деньги.',

    hw_title: 'Железо',
    hw_intro: 'Простаивающее железо приносит аренду. На релизе модели оно переходит в продакшен и даёт Мощность.',
    hw_cost: 'Цена',
    hw_power: 'Мощность',
    hw_rent: 'Аренда',
    hw_kw: 'кВт',
    hw_m2: 'м²',
    hw_owned: 'аренда ×{n}',
    hw_committed: 'в модели ×{n}',
    hw_buy: 'Купить',
    hw_no_space: 'Нет места',
    hw_no_cash: 'Нужно ${c}',
    hw_name_laptop: 'Старый ноут',
    hw_name_miniserver: 'Мини-сервер',
    hw_name_workstation: 'Рабочая станция',
    hw_name_gpuserver: 'GPU-сервер',
    hw_name_rack1u: 'Стойка 1U',
    hw_name_rack42u: 'Стойка 42U',
    hw_name_airack: 'AI-стойка',
    hw_name_modulardc: 'Модульный ЦОД',
    hw_name_hyperscale: 'Гиперскейл',

    prem_title: 'Помещения',
    prem_intro: 'Помещения дают м² — потолок того, сколько железа влезет.',
    prem_current: 'Сейчас: {name}',
    prem_capacity: 'Место: {used} / {cap} м²',
    prem_upkeep: 'Обслуживание ${v}/с',
    prem_legality: 'Законность {v}%',
    prem_safety: 'Безопасность {v}%',
    prem_upgrade: 'Переехать в {name} (${c})',
    prem_max: 'Топовое помещение',
    prem_name_garage: 'Гараж',
    prem_name_basement: 'Дешёвый подвал',
    prem_name_office: 'Малый офис',
    prem_name_bizpark: 'Бизнес-парк',
    prem_name_megacampus: 'Мега-кампус',

    model_title: 'Модель',
    model_dev: 'В разработке → {label}',
    model_live: 'Активна: {label}',
    train_need_power: 'Нужно {req} Мощности для {label} (есть {have})',
    train_start: 'Тренировать {label}',
    train_progress: 'Тренировка {label}… {pct}%',
    train_click_faster: 'Кликай, чтобы тренировать быстрее!',
    train_time_left: 'осталось {t}',
    release_done: 'Выпущена {label}! Железо в продакшене; аренда остановлена, идёт Мощность.',

    price_title: 'Цена токенов',
    price_intro: 'Ниже цена — больше доля; слишком высокая злит общество. Найди сладкую точку.',
    price_label: 'Цена: ${v}',
    price_preview: 'При ${p}: доля {share}% · {users} юзеров · {sign}${profit}/с · одобрение {arrow}',
    price_sweet: 'Сладкая точка ≈ ${v}',
    price_set_default: 'Поставить на сладкую точку',
    approval_up: '↑',
    approval_down: '↓',
    approval_flat: '→',

    bills_title: 'Счета',
    bill_next: 'Следующий счёт через {d} дн. ≈ ${v}',
    bill_covered: 'покрываешь ✓',
    bill_uncovered: 'не хватает ⚠',
    bill_due: 'СЧЁТ К ОПЛАТЕ: ${v} — заплати за 1 день',
    bill_pay: 'Оплатить ${v}',
    bill_overdue: 'ПРОСРОЧКА — выработка −30% до оплаты',
    bill_pay_short: 'Оплатить счёт',
    tax_rate: 'Налог {v}%',

    meters_title: 'Риски',
    meter_safety: 'Безопасность',
    meter_approval: 'Одобрение общества',
    meter_legality: 'Государство и закон',

    staff_title: 'Команда',
    staff_intro: 'Сотрудники чуть двигают метрики и налоги. Зарплаты идут в счета.',
    staff_hire: 'Нанять (${c})',
    staff_count: '×{n}',
    staff_name_lawyer: 'Юрист',
    staff_name_security: 'Безопасник',
    staff_name_marketer: 'Маркетолог',
    staff_name_economist: 'Экономист',
    staff_desc_lawyer: '↑ Государство и закон',
    staff_desc_security: '↑ Безопасность',
    staff_desc_marketer: '↑ Одобрение',
    staff_desc_economist: '↓ Налоги',

    world_title: 'Гонка к AGI',
    world_intro: 'Гонись за AGI (финальной моделью) с ривалами. Твоя доля относительна их.',
    standings_title: 'Положение на рынке',
    standings_you: 'ТЫ',
    race_title: 'Гонка к AGI',
    race_ahead: 'Ты лидируешь в гонке.',
    race_behind: 'Ривал впереди — наращивай Мощность.',
    race_close: 'Ноздря в ноздрю.',
    rival_name_openmind: 'OpenMind',
    rival_name_deepcore: 'DeepCore',
    rival_name_nebula: 'Nebula',

    go_win_title: 'AGI ДОСТИГНУТ',
    go_win_flavor: 'Ты выпустил финальную модель первым. Сингулярность достигнута.',
    go_bankrupt_title: 'БАНКРОТСТВО',
    go_bankrupt_flavor: 'Деньги кончились. Совет директоров закрывает проект.',
    go_approval_title: 'ОТМЕНА',
    go_approval_flavor: 'Одобрение общества упало до нуля. Модель отменена.',
    go_legality_title: 'ЗАПРЕТ',
    go_legality_flavor: 'Государство закрыло тебя из-за законности.',
    go_safety_title: 'ОСТАНОВКА',
    go_safety_flavor: 'Безопасность рухнула. Регуляторы сняли модель.',
    go_beaten_title: 'ПРОИГРАНА ГОНКА',
    go_beaten_flavor: 'Ривал достиг AGI первым.',
    go_new_game: 'Новая игра',
    go_summary: 'День {day} · Модель {ver} · ${cash}',

    settings_title: 'Настройки',
    lang_label: 'Язык',
    sound_label: 'Звук',
    music_label: 'Музыка',
    on: 'Вкл', off: 'Выкл',
    reset_label: 'Сбросить игру',
    reset_confirm: 'Сбросить весь прогресс?',
    credits: 'Singularity Inc. v2 — база фазы 1.',

    common_free: 'бесплатно',
    common_max: 'макс'
  };

  var DICTS = { en: EN, ru: RU };
  var lang = 'en';

  function detect() {
    try {
      var saved = localStorage.getItem('singularity_inc_lang');
      if (saved && DICTS[saved]) return saved;
    } catch (e) {}
    var nav = (navigator.language || 'en').toLowerCase();
    return nav.indexOf('ru') === 0 ? 'ru' : 'en';
  }
  function setLang(l) {
    if (!DICTS[l]) return;
    lang = l;
    try { localStorage.setItem('singularity_inc_lang', l); } catch (e) {}
  }
  function getLang() { return lang; }
  function t(key, vars) {
    var d = DICTS[lang] || EN;
    var s = d[key];
    if (s === undefined) s = EN[key];
    if (s === undefined) return key;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) {
        return vars[k] !== undefined ? vars[k] : m;
      });
    }
    return s;
  }

  window.GAME_I18N = { t: t, setLang: setLang, getLang: getLang, DICTS: DICTS, detect: detect };
  lang = detect();
})();
