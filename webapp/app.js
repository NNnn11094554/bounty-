(() => {
  "use strict";

  const tg = window.Telegram?.WebApp;
  const CFG = Object.assign(
    { botUsername: "your_bot", useServer: false, channelUrl: "https://t.me/telegram", chatUrl: "https://t.me/telegram" },
    window.APP_CONFIG || {}
  );
  const STORAGE_KEY = "woof-kombat-v1";
  const OFFLINE_CAP_SEC = 3 * 3600;
  const ENERGY_REGEN = 3; // в секунду
  const FULL_ENERGY_PER_DAY = 6;

  // ---------- Игровые данные ----------

  const LEVELS = [
    { name: "Щенок", min: 0 },
    { name: "Дворняга", min: 5_000 },
    { name: "Сторожевой пёс", min: 25_000 },
    { name: "Овчарка", min: 100_000 },
    { name: "Хаски", min: 1_000_000 },
    { name: "Лабрадор", min: 2_000_000 },
    { name: "Доберман", min: 10_000_000 },
    { name: "Альфа", min: 50_000_000 },
    { name: "Вожак стаи", min: 100_000_000 },
    { name: "Легенда", min: 1_000_000_000 },
  ];

  const CATEGORIES = [
    { id: "home", name: "Будка" },
    { id: "walk", name: "Прогулки" },
    { id: "biz", name: "Бизнес" },
    { id: "special", name: "Особое" },
  ];

  // baseCost — цена 1-го уровня, baseProfit — доход/час за 1-й уровень
  const CARDS = [
    { id: "bowl", cat: "home", ic: "🥣", name: "Миска побольше", baseCost: 100, baseProfit: 10 },
    { id: "bed", cat: "home", ic: "🛏️", name: "Мягкая лежанка", baseCost: 250, baseProfit: 22 },
    { id: "toys", cat: "home", ic: "🧸", name: "Ящик игрушек", baseCost: 600, baseProfit: 50 },
    { id: "kennel", cat: "home", ic: "🏠", name: "Тёплая будка", baseCost: 1_500, baseProfit: 110, lvl: 2 },
    { id: "fence", cat: "home", ic: "🪵", name: "Свой двор", baseCost: 6_000, baseProfit: 400, lvl: 3 },
    { id: "leash", cat: "walk", ic: "🦮", name: "Новый поводок", baseCost: 200, baseProfit: 18 },
    { id: "park", cat: "walk", ic: "🌳", name: "Прогулка в парке", baseCost: 500, baseProfit: 40 },
    { id: "frisbee", cat: "walk", ic: "🥏", name: "Фрисби", baseCost: 1_200, baseProfit: 90 },
    { id: "beach", cat: "walk", ic: "🏖️", name: "Пляж для собак", baseCost: 4_000, baseProfit: 260, lvl: 2 },
    { id: "trip", cat: "walk", ic: "🏔️", name: "Поход в горы", baseCost: 15_000, baseProfit: 900, lvl: 4 },
    { id: "grooming", cat: "biz", ic: "✂️", name: "Груминг-салон", baseCost: 2_000, baseProfit: 150 },
    { id: "bakery", cat: "biz", ic: "🦴", name: "Пекарня косточек", baseCost: 5_000, baseProfit: 340, lvl: 2 },
    { id: "hotel", cat: "biz", ic: "🏨", name: "Отель для собак", baseCost: 12_000, baseProfit: 750, lvl: 3 },
    { id: "school", cat: "biz", ic: "🎓", name: "Школа дрессировки", baseCost: 30_000, baseProfit: 1_700, lvl: 4 },
    { id: "brand", cat: "biz", ic: "🏷️", name: "Свой бренд корма", baseCost: 90_000, baseProfit: 4_500, lvl: 5 },
    { id: "show", cat: "special", ic: "🏆", name: "Выставка собак", baseCost: 50_000, baseProfit: 3_000, lvl: 4 },
    { id: "influencer", cat: "special", ic: "📸", name: "Пёс-блогер", baseCost: 150_000, baseProfit: 8_000, lvl: 5 },
    { id: "moon", cat: "special", ic: "🚀", name: "Собака в космосе", baseCost: 1_000_000, baseProfit: 45_000, lvl: 7 },
  ];

  const DAILY_REWARDS = [500, 1_000, 2_500, 5_000, 15_000, 25_000, 100_000, 500_000, 1_000_000, 5_000_000];

  const TASKS = [
    { id: "channel", ic: "📢", title: "Подпишись на канал", reward: 5_000, url: CFG.channelUrl },
    { id: "chat", ic: "💬", title: "Вступи в чат стаи", reward: 5_000, url: CFG.chatUrl },
    { id: "friends3", ic: "🐕", title: "Пригласи 3 друзей", reward: 25_000, friends: 3 },
    { id: "taps1000", ic: "👆", title: "Сделай 1 000 тапов", reward: 10_000, taps: 1_000 },
  ];

  const cardCost = (c, lvl) => Math.round(c.baseCost * Math.pow(1.55, lvl));
  const cardProfitStep = (c, lvl) => Math.round(c.baseProfit * Math.pow(1.2, lvl));
  const cardProfitTotal = (c, lvl) => {
    let s = 0;
    for (let i = 0; i < lvl; i++) s += cardProfitStep(c, i);
    return s;
  };
  const multitapCost = (lvl) => Math.round(1_000 * Math.pow(2, lvl));
  const energyLimitCost = (lvl) => Math.round(1_000 * Math.pow(2, lvl));

  // ---------- Состояние ----------

  const today = () => new Date().toISOString().slice(0, 10);
  const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

  function defaultState() {
    return {
      coins: 0,
      totalEarned: 0,
      taps: 0,
      energy: 1000,
      multitap: 0,
      energyLimit: 0,
      upgrades: {},
      daily: { streak: 0, last: null },
      fullEnergy: { used: 0, day: null },
      tasks: {},
      lastSeen: Date.now(),
    };
  }

  let S = defaultState();
  let friends = [];
  let dirty = false;

  const maxEnergy = () => 1000 + 500 * S.energyLimit;
  const perTap = () => 1 + S.multitap;
  const profitPerHour = () => CARDS.reduce((sum, c) => sum + cardProfitTotal(c, S.upgrades[c.id] || 0), 0);
  function levelIndex() {
    let i = 0;
    while (i + 1 < LEVELS.length && S.totalEarned >= LEVELS[i + 1].min) i++;
    return i;
  }

  function addCoins(n) {
    S.coins += n;
    S.totalEarned += n;
    dirty = true;
  }

  function spend(n) {
    if (S.coins < n) return false;
    S.coins -= n;
    dirty = true;
    return true;
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function saveLocal() {
    S.lastSeen = Date.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); } catch {}
  }

  // ---------- Сервер ----------

  const initData = tg?.initData || "";
  const serverEnabled = CFG.useServer && !!initData;

  async function api(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, ...body }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function serverLoad() {
    if (!serverEnabled) return null;
    try { return await api("/api/load", {}); } catch (e) { console.warn("load failed", e); return null; }
  }

  async function serverSave() {
    if (!serverEnabled) return;
    try {
      const r = await api("/api/save", { state: S });
      if (r.friends) { friends = r.friends; renderFriends(); }
    } catch (e) { console.warn("save failed", e); }
  }

  function serverSaveBeacon() {
    if (!serverEnabled || !navigator.sendBeacon) return;
    const blob = new Blob([JSON.stringify({ initData, state: S })], { type: "application/json" });
    navigator.sendBeacon("/api/save", blob);
  }

  // ---------- Утилиты UI ----------

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const fmt = (n) => Math.floor(n).toLocaleString("ru-RU");
  function short(n) {
    n = Math.floor(n);
    if (n >= 1e9) return +(n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + "B";
    if (n >= 1e6) return +(n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M";
    if (n >= 1e3) return +(n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "K";
    return String(n);
  }
  const coinIc = '<svg class="ic"><use href="#coin"/></svg>';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function haptic(type = "light") {
    try {
      if (type === "success" || type === "error" || type === "warning") tg?.HapticFeedback?.notificationOccurred(type);
      else tg?.HapticFeedback?.impactOccurred(type);
    } catch {}
  }

  let toastTimer;
  function toast(text) {
    const el = $("#toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function openSheet(html, onReady) {
    $("#sheetBody").innerHTML = html;
    $("#sheet").classList.add("open");
    $("#sheetBackdrop").classList.add("open");
    onReady?.($("#sheetBody"));
  }
  function closeSheet() {
    $("#sheet").classList.remove("open");
    $("#sheetBackdrop").classList.remove("open");
  }
  $("#sheetClose").addEventListener("click", closeSheet);
  $("#sheetBackdrop").addEventListener("click", closeSheet);

  // ---------- Навигация ----------

  function go(tab) {
    $$(".screen").forEach((s) => s.classList.toggle("active", s.dataset.screen === tab));
    $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    if (tab === "home") tg?.BackButton?.hide(); else tg?.BackButton?.show();
    render();
  }
  $$(".nav-btn").forEach((b) => b.addEventListener("click", () => { haptic("light"); go(b.dataset.tab); }));
  $$("[data-goto]").forEach((b) => b.addEventListener("click", () => { haptic("light"); go(b.dataset.goto); }));
  tg?.BackButton?.onClick(() => {
    if ($("#sheet").classList.contains("open")) closeSheet(); else go("home");
  });

  // ---------- Тапы ----------

  const coinEl = $("#tapCoin");
  const floaters = $("#floaters");

  coinEl.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const gain = perTap();
    if (S.energy < gain) {
      haptic("warning");
      coinEl.animate([{ transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "none" }], { duration: 200 });
      toast("Собачка устала 😴 Подожди или возьми буст");
      return;
    }
    S.energy -= gain;
    S.taps++;
    addCoins(gain);
    haptic("light");

    // Наклон монеты в сторону тапа
    const r = coinEl.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    coinEl.style.transform = `perspective(600px) rotateX(${-dy * 14}deg) rotateY(${dx * 14}deg) scale(.96)`;
    clearTimeout(coinEl._t);
    coinEl._t = setTimeout(() => (coinEl.style.transform = ""), 110);

    const zone = floaters.getBoundingClientRect();
    const x = e.clientX - zone.left;
    const y = e.clientY - zone.top;
    const f = document.createElement("div");
    f.className = "floater";
    f.textContent = "+" + gain;
    f.style.left = x + "px";
    f.style.top = y + "px";
    floaters.appendChild(f);
    setTimeout(() => f.remove(), 900);

    for (let i = 0; i < 2; i++) {
      const p = document.createElement("div");
      p.className = "paw";
      p.textContent = "🐾";
      p.style.left = x + "px";
      p.style.top = y + "px";
      p.style.setProperty("--dx", (Math.random() * 120 - 60) + "px");
      p.style.setProperty("--dy", (Math.random() * 80 - 20) + "px");
      p.style.setProperty("--r", (Math.random() * 60 - 30) + "deg");
      floaters.appendChild(p);
      setTimeout(() => p.remove(), 700);
    }

    renderTop();
  });

  // ---------- Прокачка ----------

  let activeCat = CATEGORIES[0].id;

  function renderTabs() {
    $("#mineTabs").innerHTML = CATEGORIES.map(
      (c) => `<button class="tab ${c.id === activeCat ? "active" : ""}" data-cat="${c.id}">${c.name}</button>`
    ).join("");
    $$("#mineTabs .tab").forEach((t) => t.addEventListener("click", () => {
      activeCat = t.dataset.cat;
      haptic("light");
      renderMine();
    }));
  }

  function renderMine() {
    renderTabs();
    const lvlIdx = levelIndex();
    $("#cards").innerHTML = CARDS.filter((c) => c.cat === activeCat).map((c) => {
      const lvl = S.upgrades[c.id] || 0;
      const cost = cardCost(c, lvl);
      const locked = (c.lvl || 1) - 1 > lvlIdx;
      const poor = S.coins < cost;
      return `
        <button class="card ${locked ? "locked" : ""} ${poor ? "poor" : ""}" data-card="${c.id}">
          <div class="card-top">
            <div class="card-ic">${locked ? "🔒" : c.ic}</div>
            <div>
              <div class="card-name">${c.name}</div>
              <div class="card-profit">Доход в час<br><b>${coinIc}+${short(cardProfitTotal(c, lvl))}</b></div>
            </div>
          </div>
          <div class="card-bottom">
            <span class="card-lvl">ур ${lvl}</span>
            <span class="card-cost">${locked ? `Нужен ур. ${c.lvl}` : `${coinIc}${short(cost)}`}</span>
          </div>
        </button>`;
    }).join("");
    $$("#cards .card").forEach((el) => el.addEventListener("click", () => openCard(el.dataset.card)));
  }

  function openCard(id) {
    const c = CARDS.find((x) => x.id === id);
    const lvl = S.upgrades[c.id] || 0;
    const cost = cardCost(c, lvl);
    const locked = (c.lvl || 1) - 1 > levelIndex();
    haptic("light");
    openSheet(`
      <div class="sheet-ic">${c.ic}</div>
      <h3>${c.name}</h3>
      <p>Уровень ${lvl} → ${lvl + 1}</p>
      <div class="sheet-meta">Доход в час <b>${coinIc}+${fmt(cardProfitStep(c, lvl))}</b></div>
      <div class="sheet-price">${coinIc}${fmt(cost)}</div>
      <button class="btn primary full" id="buyBtn" ${locked || S.coins < cost ? "disabled" : ""}>
        ${locked ? `Откроется на уровне «${LEVELS[c.lvl - 1].name}»` : S.coins < cost ? "Не хватает косточек" : "Прокачать!"}
      </button>
    `, (root) => {
      root.querySelector("#buyBtn").addEventListener("click", () => {
        if (!spend(cost)) return;
        S.upgrades[c.id] = lvl + 1;
        haptic("success");
        toast(`${c.name}: уровень ${lvl + 1} 🎉`);
        closeSheet();
        render();
      });
    });
  }

  // ---------- Бусты ----------

  function resetDailyCounters() {
    if (S.fullEnergy.day !== today()) S.fullEnergy = { used: 0, day: today() };
  }

  function renderBoost() {
    resetDailyCounters();
    const left = FULL_ENERGY_PER_DAY - S.fullEnergy.used;
    $("#fullEnergySub").innerHTML = `Осталось <b>${left}/${FULL_ENERGY_PER_DAY}</b> на сегодня`;
    $("#multitapSub").innerHTML = `${coinIc}<b>${short(multitapCost(S.multitap))}</b> · ур ${S.multitap + 1}`;
    $("#energyLimitSub").innerHTML = `${coinIc}<b>${short(energyLimitCost(S.energyLimit))}</b> · ур ${S.energyLimit + 1}`;
  }

  $("#fullEnergyRow").addEventListener("click", () => {
    resetDailyCounters();
    const left = FULL_ENERGY_PER_DAY - S.fullEnergy.used;
    openSheet(`
      <div class="sheet-ic">⚡</div>
      <h3>Полная энергия</h3>
      <p>Мгновенно восстанавливает энергию собачки. Доступно ${left} из ${FULL_ENERGY_PER_DAY} сегодня.</p>
      <div class="sheet-price">Бесплатно</div>
      <button class="btn primary full" id="feBtn" ${left <= 0 ? "disabled" : ""}>${left > 0 ? "Зарядиться" : "Приходи завтра"}</button>
    `, (root) => root.querySelector("#feBtn").addEventListener("click", () => {
      S.fullEnergy.used++;
      S.energy = maxEnergy();
      dirty = true;
      haptic("success");
      closeSheet();
      go("home");
    }));
  });

  function upgradeSheet({ ic, title, desc, cost, onBuy }) {
    openSheet(`
      <div class="sheet-ic">${ic}</div>
      <h3>${title}</h3>
      <p>${desc}</p>
      <div class="sheet-price">${coinIc}${fmt(cost)}</div>
      <button class="btn primary full" id="upBtn" ${S.coins < cost ? "disabled" : ""}>${S.coins < cost ? "Не хватает косточек" : "Прокачать"}</button>
    `, (root) => root.querySelector("#upBtn").addEventListener("click", () => {
      if (!spend(cost)) return;
      onBuy();
      haptic("success");
      closeSheet();
      render();
    }));
  }

  $("#multitapRow").addEventListener("click", () => upgradeSheet({
    ic: "👆", title: "Мультитап",
    desc: `+1 косточка за тап. Сейчас: ${perTap()} за тап.`,
    cost: multitapCost(S.multitap),
    onBuy: () => { S.multitap++; },
  }));

  $("#energyLimitRow").addEventListener("click", () => upgradeSheet({
    ic: "🔋", title: "Запас энергии",
    desc: `+500 к максимуму энергии. Сейчас: ${fmt(maxEnergy())}.`,
    cost: energyLimitCost(S.energyLimit),
    onBuy: () => { S.energyLimit++; },
  }));

  // ---------- Награда дня ----------

  function dailyStatus() {
    const t = today();
    if (S.daily.last === t) return { canClaim: false, nextDay: S.daily.streak };
    const consecutive = S.daily.last && dayDiff(S.daily.last, t) === 1;
    const streak = consecutive ? S.daily.streak % DAILY_REWARDS.length : 0;
    return { canClaim: true, nextDay: streak, streakBefore: consecutive ? S.daily.streak : 0 };
  }

  function renderDaily() {
    const st = dailyStatus();
    $("#dailyDot").classList.toggle("on", st.canClaim);
    $("#earnDot").classList.toggle("on", st.canClaim);
    $("#dailySub").innerHTML = st.canClaim
      ? `Забери ${coinIc}<b>+${short(DAILY_REWARDS[st.nextDay])}</b>`
      : `Получено · день ${S.daily.streak}`;
    $("#dailyEnd").textContent = st.canClaim ? "›" : "✓";
    $("#dailyRow").classList.toggle("done", !st.canClaim);
  }

  $("#dailyRow").addEventListener("click", () => {
    const st = dailyStatus();
    const claimedCount = st.canClaim ? st.nextDay : S.daily.streak;
    const days = DAILY_REWARDS.map((r, i) => `
      <div class="day ${i < claimedCount ? "claimed" : ""} ${st.canClaim && i === st.nextDay ? "today" : ""}">
        <span>День ${i + 1}</span>${coinIc}<span>${short(r)}</span>
      </div>`).join("");
    openSheet(`
      <div class="sheet-ic">📅</div>
      <h3>Награда дня</h3>
      <p>Заходи каждый день, иначе серия сбросится.</p>
      <div class="days">${days}</div>
      <button class="btn primary full" id="claimDaily" ${st.canClaim ? "" : "disabled"}>${st.canClaim ? "Забрать" : "Возвращайся завтра"}</button>
    `, (root) => root.querySelector("#claimDaily").addEventListener("click", () => {
      const s = dailyStatus();
      if (!s.canClaim) return;
      addCoins(DAILY_REWARDS[s.nextDay]);
      S.daily = { streak: s.nextDay + 1, last: today() };
      haptic("success");
      toast(`+${fmt(DAILY_REWARDS[s.nextDay])} 🦴`);
      closeSheet();
      render();
    }));
  });

  // ---------- Задания ----------

  function taskState(t) {
    const st = S.tasks[t.id];
    if (st === "done") return "done";
    if (t.friends != null) return friends.length >= t.friends ? "ready" : "progress";
    if (t.taps != null) return S.taps >= t.taps ? "ready" : "progress";
    return st === "visited" ? "ready" : "new";
  }

  function renderTasks() {
    $("#tasksList").innerHTML = TASKS.map((t) => {
      const st = taskState(t);
      let progress = "";
      if (t.friends != null && st === "progress") progress = ` · ${friends.length}/${t.friends}`;
      if (t.taps != null && st === "progress") progress = ` · ${fmt(S.taps)}/${fmt(t.taps)}`;
      const end = st === "done" ? "✓" : st === "ready" ? "🎁" : "›";
      return `
        <button class="row clickable ${st === "done" ? "done" : ""}" data-task="${t.id}">
          <div class="row-ic">${t.ic}</div>
          <div class="row-body">
            <div class="row-title">${t.title}</div>
            <div class="row-sub">${coinIc}<b>+${short(t.reward)}</b>${progress}</div>
          </div>
          <div class="row-end">${end}</div>
        </button>`;
    }).join("");
    $$("#tasksList [data-task]").forEach((el) => el.addEventListener("click", () => doTask(el.dataset.task)));
  }

  function doTask(id) {
    const t = TASKS.find((x) => x.id === id);
    const st = taskState(t);
    if (st === "done") return;
    if (st === "ready") {
      S.tasks[t.id] = "done";
      addCoins(t.reward);
      haptic("success");
      toast(`Задание выполнено: +${fmt(t.reward)} 🦴`);
      render();
      return;
    }
    if (t.url) {
      if (t.url.startsWith("https://t.me/") && tg?.openTelegramLink) tg.openTelegramLink(t.url);
      else if (tg?.openLink) tg.openLink(t.url);
      else window.open(t.url, "_blank");
      // Проверить подписку можно только через бота (getChatMember), поэтому
      // для простоты награда становится доступна после перехода по ссылке.
      setTimeout(() => { S.tasks[t.id] = "visited"; dirty = true; renderTasks(); }, 5000);
      return;
    }
    if (t.friends != null) go("friends");
    else go("home");
  }

  // ---------- Друзья ----------

  const userId = tg?.initDataUnsafe?.user?.id;
  const inviteLink = () => `https://t.me/${CFG.botUsername}?start=ref_${userId || 0}`;

  function renderFriends() {
    $("#friendsCount").textContent = `(${friends.length})`;
    $("#friendsList").innerHTML = friends.length
      ? friends.map((f) => `
          <div class="row">
            <div class="row-ic">🐶</div>
            <div class="row-body">
              <div class="row-title">${esc(f.name || "Друг")}</div>
              <div class="row-sub">${esc(LEVELS[f.level || 0]?.name || "")} · ${coinIc}${short(f.coins || 0)}</div>
            </div>
            <div class="row-end" style="font-size:14px;color:var(--accent-2)">+${short(f.bonus || 5000)}</div>
          </div>`).join("")
      : `<div class="empty">Пока никого 🐾<br>Позови друзей — вместе веселее!</div>`;
  }

  $("#inviteBtn").addEventListener("click", () => {
    haptic("medium");
    const text = "Тапай собачку и собирай косточки вместе со мной! 🐶🦴 +5 000 на старт";
    const url = `https://t.me/share/url?url=${encodeURIComponent(inviteLink())}&text=${encodeURIComponent(text)}`;
    if (tg?.openTelegramLink) tg.openTelegramLink(url); else window.open(url, "_blank");
  });

  $("#copyBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(inviteLink());
      haptic("success");
      toast("Ссылка скопирована 📋");
    } catch {
      toast(inviteLink());
    }
  });

  // ---------- Рендер ----------

  function renderTop() {
    const bal = fmt(S.coins);
    $("#balance").textContent = bal;
    $$(".bal-mirror").forEach((el) => (el.textContent = bal));

    const li = levelIndex();
    const cur = LEVELS[li];
    const next = LEVELS[li + 1];
    const pct = next ? ((S.totalEarned - cur.min) / (next.min - cur.min)) * 100 : 100;
    $("#levelBar").style.width = Math.min(100, pct) + "%";
    $("#levelLabel").textContent = cur.name + " ›";
    $("#levelName").textContent = cur.name;
    $("#levelNum").textContent = `Уровень ${li + 1}/${LEVELS.length}`;

    const max = maxEnergy();
    $("#energyText").textContent = `${Math.floor(S.energy)} / ${max}`;
    $("#energyBar").style.width = (S.energy / max) * 100 + "%";
    coinEl.classList.toggle("disabled", S.energy < perTap());
    $("#pphValue").textContent = "+" + short(profitPerHour());
  }

  function render() {
    renderTop();
    renderDaily();
    const active = document.querySelector(".screen.active")?.dataset.screen;
    if (active === "mine") renderMine();
    if (active === "boost") renderBoost();
    if (active === "earn") renderTasks();
    if (active === "friends") renderFriends();
  }

  // ---------- Игровой цикл ----------

  let lastTick = Date.now();
  let passiveAcc = 0;
  setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;

    S.energy = Math.min(maxEnergy(), S.energy + ENERGY_REGEN * dt);
    passiveAcc += (profitPerHour() / 3600) * dt;
    if (passiveAcc >= 1) {
      const whole = Math.floor(passiveAcc);
      passiveAcc -= whole;
      addCoins(whole);
    }
    renderTop();
  }, 250);

  // Локальное сохранение — часто, серверное — реже
  setInterval(() => { if (dirty) saveLocal(); }, 2000);
  setInterval(() => { if (dirty) { dirty = false; saveLocal(); serverSave(); } }, 15000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      saveLocal();
      serverSaveBeacon();
    } else {
      applyOffline(false);
    }
  });

  function applyOffline(showModal) {
    const now = Date.now();
    const elapsed = Math.min(OFFLINE_CAP_SEC, Math.max(0, (now - (S.lastSeen || now)) / 1000));
    S.energy = Math.min(maxEnergy(), S.energy + ENERGY_REGEN * elapsed);
    const earned = Math.floor((profitPerHour() / 3600) * elapsed);
    S.lastSeen = now;
    lastTick = now;
    if (earned > 0) {
      addCoins(earned);
      if (showModal && elapsed > 60) {
        openSheet(`
          <div class="sheet-ic">🐶</div>
          <h3>Пока тебя не было…</h3>
          <p>Собачка не скучала и собрала для тебя косточки</p>
          <div class="sheet-price">${coinIc}+${fmt(earned)}</div>
          <button class="btn primary full" id="okBtn">Спасибо, пёсик! 🦴</button>
        `, (root) => root.querySelector("#okBtn").addEventListener("click", () => { haptic("success"); closeSheet(); }));
      }
    }
  }

  // ---------- Старт ----------

  async function init() {
    if (tg) {
      tg.ready();
      tg.expand();
      try { tg.setHeaderColor("#1b1640"); tg.setBackgroundColor("#120f2a"); } catch {}
      try { tg.disableVerticalSwipes?.(); } catch {}
      const u = tg.initDataUnsafe?.user;
      if (u) {
        $("#userName").textContent = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "Игрок";
        if (u.photo_url) $("#avatar").innerHTML = `<img src="${esc(u.photo_url)}" alt="">`;
      }
    }

    const local = loadLocal();
    if (local) S = Object.assign(defaultState(), local);

    const remote = await serverLoad();
    if (remote) {
      if (remote.state && (!local || (remote.state.lastSeen || 0) > (local.lastSeen || 0))) {
        S = Object.assign(defaultState(), remote.state);
      }
      friends = remote.friends || [];
      if (remote.bonus > 0) {
        addCoins(remote.bonus);
        toast(`Бонус за друзей: +${fmt(remote.bonus)} 🎁`);
      }
    }

    applyOffline(true);
    saveLocal();
    render();
    renderFriends();
  }

  init();
})();
