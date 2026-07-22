/* Mess Scheduler — app logic */

const DATA_SOURCES = {
  62: "https://raw.githubusercontent.com/life2harsh2/data/main/mess_menu.json",
  128: "https://raw.githubusercontent.com/life2harsh2/data/main/mess_128_menu.json",
};

const MEALS = ["breakfast", "lunch", "dinner"];

const KNOWN_SPECIALS = [
  "Paneer Makhani", "Gulab Jamun", "Chowmien", "Veg Manchurian",
  "Rajma", "Malai Kofta", "Sabji - Poori", "Matar Paneer",
  "Kashmiri Dum Aloo", "Veg Biryani", "Chole", "Kadai Paneer",
  "Dal Makhani", "White Matar", "Poori", "Palak Paneer",
  "Chilli Paneer", "Custard",
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const state = {
  campus: localStorage.getItem("campus") || "62",
  menus: {},         // campus -> menu object
  selectedDay: 0,    // weekday index in the strip: 0 = Monday … 6 = Sunday
  stale: false,
};

/* ————— meal schedule (Sunday runs longer) ————— */

function scheduleFor(date) {
  const sunday = date.getDay() === 0;
  return {
    breakfast: sunday
      ? { start: 420, end: 570, display: "7:00 – 9:30 am" }
      : { start: 420, end: 540, display: "7:00 – 9:00 am" },
    lunch: sunday
      ? { start: 720, end: 870, display: "12:00 – 2:30 pm" }
      : { start: 720, end: 840, display: "12:00 – 2:00 pm" },
    dinner: { start: 1170, end: 1290, display: "7:30 – 9:30 pm" },
  };
}

function minutesNow() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/* ————— data ————— */

/* The OCR feed's shape has drifted over time — keys have been both
   "01.12.25" and "Monday 20.07.26", meal fields both lower- and capitalized.
   Normalize everything to { "DD.MM.YY": { day, breakfast, lunch, dinner } }. */
function normalizeMenu(raw) {
  const out = {};
  for (const [key, val] of Object.entries(raw || {})) {
    if (!val || typeof val !== "object") continue;
    const dateMatch = key.match(/\d{2}\.\d{2}\.\d{2}/);
    const nameMatch = key.match(/[A-Za-z]+/);
    out[dateMatch ? dateMatch[0] : key] = {
      day: val.day || (nameMatch ? nameMatch[0] : ""),
      breakfast: val.breakfast ?? val.Breakfast ?? "",
      lunch: val.lunch ?? val.Lunch ?? "",
      dinner: val.dinner ?? val.Dinner ?? "",
    };
  }
  return out;
}

async function fetchMenu(campus) {
  const url = DATA_SOURCES[campus];
  const cacheKey = `menu-${campus}`;
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(res.statusText);
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (_) {
      return {}; // feed exists but nothing posted yet (128 ships "-" as a placeholder)
    }
    if (!json.menu || typeof json.menu !== "object") return {};
    localStorage.setItem(cacheKey, text);
    return normalizeMenu(json.menu);
  } catch (err) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try { return normalizeMenu(JSON.parse(cached).menu); } catch (_) { /* fall through */ }
    }
    return null;
  }
}

/* keys are DD.MM.YY */
function parseKey(key) {
  const m = key.match(/(\d{2})\.(\d{2})\.(\d{2})/);
  if (!m) return null;
  return new Date(2000 + Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

/* Find the menu entry for a date: exact date first, weekday name as fallback
   (the OCR feed sometimes lags a week — day-name matching keeps the app useful). */
function entryFor(menu, date) {
  if (!menu) return { entry: null, stale: false };
  const hasMeals = (e) => MEALS.some((m) => e[m]);
  for (const key of Object.keys(menu)) {
    const kd = parseKey(key);
    if (kd && sameDate(kd, date) && hasMeals(menu[key])) {
      return { entry: menu[key], stale: false };
    }
  }
  const dayName = DAY_NAMES[date.getDay()].toLowerCase();
  for (const key of Object.keys(menu)) {
    const e = menu[key];
    if ((e.day || "").toLowerCase() === dayName && hasMeals(e)) {
      /* only a date-keyed entry can be from a previous week; a bare
         day-name key (the 128 feed's format) is simply this week's */
      return { entry: e, stale: Boolean(parseKey(key)) };
    }
  }
  return { entry: null, stale: false };
}

function splitDishes(mealString) {
  return (mealString || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isSpecial(dish) {
  const d = dish.toLowerCase();
  return KNOWN_SPECIALS.some((sp) => d.includes(sp.toLowerCase()));
}

/* ————— voting (degrades gracefully if the API is absent) ————— */

function clientId() {
  let id = localStorage.getItem("clientId");
  if (!id) {
    id = "c_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("clientId", id);
  }
  return id;
}

function voteKey(meal) {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}:${meal}:${state.campus}`;
}

async function loadVotes(meal) {
  try {
    const res = await fetch(`/api/votes?key=${encodeURIComponent(voteKey(meal))}`);
    if (!res.ok) return null;
    return await res.json(); // { up, down }
  } catch (_) {
    return null;
  }
}

async function sendVote(meal, vote) {
  try {
    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: voteKey(meal), vote, client: clientId() }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

function ratePercent(v) {
  const total = (v.up || 0) + (v.down || 0);
  if (!total) return null;
  return { pct: Math.round((v.up / total) * 100), total };
}

async function mountRating(container, meal) {
  const votes = await loadVotes(meal);
  if (!votes) return; // no backend — row never appears

  const row = document.createElement("div");
  row.className = "rate-row";
  const myVote = localStorage.getItem("voted:" + voteKey(meal));

  const render = (v) => {
    const r = ratePercent(v);
    row.innerHTML = "";
    for (const [label, kind] of [["👍", "up"], ["👎", "down"]]) {
      const btn = document.createElement("button");
      btn.className = "rate-btn" + (myVote === kind ? " chosen" : "");
      btn.textContent = label;
      btn.disabled = Boolean(myVote);
      btn.setAttribute("aria-label", kind === "up" ? "Rate good" : "Rate bad");
      btn.addEventListener("click", async () => {
        localStorage.setItem("voted:" + voteKey(meal), kind);
        const updated = await sendVote(meal, kind);
        row.replaceWith(await buildRatingRow(meal, updated || v));
      });
      row.appendChild(btn);
    }
    const count = document.createElement("span");
    count.textContent = r ? `${r.total} rated` : "Be the first to rate";
    row.appendChild(count);
    if (r) {
      const pct = document.createElement("span");
      pct.className = "rate-pct";
      pct.textContent = `${r.pct}% liked`;
      row.appendChild(pct);
    }
  };

  render(votes);
  container.appendChild(row);
}

async function buildRatingRow(meal, votes) {
  const holder = document.createElement("div");
  await mountRating(holder, meal);
  return holder.firstChild || document.createTextNode("");
}

/* ————— rendering ————— */

const $ = (id) => document.getElementById(id);

/* the strip is a fixed Monday→Sunday week */
function todayIndex() {
  return (new Date().getDay() + 6) % 7; // Mon = 0 … Sun = 6
}

function weekDate(index) {
  const d = new Date();
  d.setDate(d.getDate() - todayIndex() + index);
  return d;
}


function renderHeaderDate() {
  const now = new Date();
  $("headerDate").textContent = now.toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function renderDayStrip() {
  const strip = $("dayStrip");
  strip.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const d = weekDate(i);
    const chip = document.createElement("button");
    chip.className = "day-chip" +
      (i === todayIndex() ? " today" : "") +
      (i === state.selectedDay ? " selected" : "");
    chip.innerHTML = `${DAY_NAMES[d.getDay()][0]}<b>${d.getDate()}</b>`;
    chip.setAttribute("aria-label", DAY_NAMES[d.getDay()]);
    chip.addEventListener("click", () => {
      state.selectedDay = i;
      renderDayStrip();
      renderMenu();
    });
    strip.appendChild(chip);
  }
}

function dishPills(mealString) {
  const wrap = document.createElement("div");
  wrap.className = "dishes";
  for (const dish of splitDishes(mealString)) {
    const pill = document.createElement("span");
    const special = isSpecial(dish);
    pill.className = "dish" + (special ? " special" : "");
    pill.textContent = special ? `✦ ${dish}` : dish;
    wrap.appendChild(pill);
  }
  return wrap;
}

function fmtDur(mins) {
  const h = Math.floor(mins / 60);
  return `${h ? h + "h " : ""}${mins % 60}m`;
}

/* one uniform, fully-expanded card per meal; the nearest one glows */
function mealCard({ meal, entry, time, live, label }) {
  const card = document.createElement("article");
  card.className = "meal-card rise" + (live ? " live" : "");

  if (label) {
    const nowLine = document.createElement("div");
    nowLine.className = "now-line" + (live ? "" : " upcoming");
    if (live) {
      const dot = document.createElement("span");
      dot.className = "now-dot";
      nowLine.appendChild(dot);
    }
    nowLine.appendChild(document.createTextNode(label));
    card.appendChild(nowLine);
  }

  const name = document.createElement("h2");
  name.className = "meal-name";
  name.textContent = meal[0].toUpperCase() + meal.slice(1);

  const timeEl = document.createElement("p");
  timeEl.className = "meal-time";
  timeEl.textContent = time;

  card.append(name, timeEl, dishPills(entry[meal]));

  if (live) mountRating(card, meal); // async; appends when/if the API answers
  return card;
}

function emptyCard(title, sub) {
  const card = document.createElement("div");
  card.className = "empty-card rise";
  card.innerHTML = `<p class="title"></p><p class="sub"></p>`;
  card.querySelector(".title").textContent = title;
  card.querySelector(".sub").textContent = sub;
  return card;
}

function renderMenu() {
  const container = $("hero");
  container.innerHTML = "";

  const menu = state.menus[state.campus];
  const date = weekDate(state.selectedDay);
  const { entry, stale } = entryFor(menu, date);
  $("stale").classList.toggle("hidden", !stale);

  if (!menu) {
    container.appendChild(emptyCard(
      "Couldn’t load the menu",
      "Check your connection and pull to refresh — the last saved menu appears automatically when available."
    ));
    return;
  }

  if (!entry) {
    container.appendChild(emptyCard(
      state.campus === "128" ? "Campus 128 menu isn’t posted yet" : "No menu for this day yet",
      "It shows up here as soon as the weekly menu is published."
    ));
    return;
  }

  const sched = scheduleFor(date);
  const isToday = state.selectedDay === todayIndex();
  const mins = minutesNow();

  /* nearest = the first meal whose window hasn't ended yet */
  let nearest = null;
  if (isToday) {
    for (const meal of MEALS) {
      if (entry[meal] && mins < sched[meal].end) { nearest = meal; break; }
    }
  }

  let i = 0;
  for (const meal of MEALS) {
    if (!entry[meal]) continue;
    const w = sched[meal];
    if (isToday && mins >= w.end) continue; // finished meals drop off the page
    let live = false, label = "";
    if (isToday) {
      if (meal === nearest) {
        live = true;
        label = mins >= w.start
          ? `Serving now · ${fmtDur(w.end - mins)} left`
          : `Up next · in ${fmtDur(w.start - mins)}`;
      } else {
        label = "Later today";
      }
    }
    const card = mealCard({ meal, entry, time: w.display, live, label });
    card.style.animationDelay = `${i++ * 40}ms`;
    container.appendChild(card);
  }

  /* after dinner everything has dropped off — say so instead of a blank page */
  if (isToday && !container.children.length) {
    container.appendChild(emptyCard(
      "All meals served for today",
      "Tomorrow’s menu is one tap away on the day strip above."
    ));
  }
}

/* ————— campus toggle ————— */

function bindCampusToggle() {
  for (const campus of ["62", "128"]) {
    $(`campus${campus}`).addEventListener("click", () => {
      state.campus = campus;
      localStorage.setItem("campus", campus);
      $("campus62").setAttribute("aria-selected", String(campus === "62"));
      $("campus128").setAttribute("aria-selected", String(campus === "128"));
      renderMenu();
    });
  }
  $("campus62").setAttribute("aria-selected", String(state.campus === "62"));
  $("campus128").setAttribute("aria-selected", String(state.campus === "128"));
}

/* ————— boot ————— */

function showSkeleton() {
  $("hero").innerHTML =
    `<div class="skeleton hero-size"></div>`.repeat(3);
}

async function boot() {
  state.selectedDay = todayIndex();
  renderHeaderDate();
  renderDayStrip();
  bindCampusToggle();
  showSkeleton();

  const [m62, m128] = await Promise.all([fetchMenu("62"), fetchMenu("128")]);
  state.menus["62"] = m62;
  state.menus["128"] = m128;
  renderMenu();

  /* re-evaluate the hero when a meal window opens/closes */
  setInterval(() => {
    if (state.selectedDay === todayIndex()) renderMenu();
  }, 60 * 1000);
}

boot();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
