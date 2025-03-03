
const knownSpecials = [
"Paneer Makhani", "Gulab Jamun", "Chowmien", "Veg Manchurian",
  "Rajma", "Malai Kofta", "Sabji - Poori", "Matar Paneer",
  "Kashmiri Dum Aloo", "Veg Biryani", "Chole", "Kadai Paneer", "Dal Makhani", "White Matar", "Poori", "Gulab Jamun"
];
let fetchedMenuMain = null;
let fetchedMenu128 = null;
let extractedSpecialDishes = [];
let currentMode = "both";
const dayOrder = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const dayNameMap = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function findKeyByDay(jsonObject, dayName) {
  if (!jsonObject) return null;
  const allKeys = Object.keys(jsonObject);
  return allKeys.find(k => k.toLowerCase().includes(dayName.toLowerCase())) || null;
}
document.addEventListener('mousemove', e => {
  const angle = 45 + (e.clientX / window.innerWidth) * 30 - 15;
  document.documentElement.style.setProperty('--angle', angle + 'deg');
});
function formatTime(hours, minutes) {
  const period = hours >= 12 ? 'PM' : 'AM';
  const adjusted = hours % 12 || 12;
  const minStr = minutes < 10 ? '0' + minutes : minutes;
  return adjusted + ':' + minStr + ' ' + period;
}
function normalizeMealKey(key) {
  const lower = key.toLowerCase();
  if (lower === "breakfast") return "Breakfast";
  if (lower === "lunch") return "Lunch";
  if (lower === "dinner") return "Dinner";
  return key;
}
function parseSpecialDishes(menu) {
  const specialArray = [];
  for (let dayKey in menu) {
    if (!menu.hasOwnProperty(dayKey)) continue;
    const dayData = menu[dayKey];
    for (let mealKey in dayData) {
      if (!dayData.hasOwnProperty(mealKey)) continue;
      const nm = normalizeMealKey(mealKey);
      if (["Breakfast","Lunch","Dinner"].includes(nm)) {
        const mealString = dayData[mealKey];
        if (!mealString) continue;
        knownSpecials.forEach(sp => {
          if (mealString.toLowerCase().includes(sp.toLowerCase())) {
            specialArray.push({ day: dayKey, meal: nm, dish: sp });
          }
        });
      }
    }
  }
  return specialArray;
}
function displaySpecialDishes() {
  const specialDishesRow = document.getElementById('specialDishesRow');
  specialDishesRow.innerHTML = '';
  const headerContainer = document.createElement('div');
  headerContainer.className = 'special-dishes-header';
  const heading = document.createElement('h2');
  heading.textContent = 'Special Dishes';
  headerContainer.appendChild(heading);
  const now = new Date();
  const currentDayName = dayNameMap[now.getDay()].toLowerCase();
  const todaysSpecials = extractedSpecialDishes.filter(s => s.day.toLowerCase().includes(currentDayName));
  const otherSpecials = extractedSpecialDishes.filter(s => !s.day.toLowerCase().includes(currentDayName));
  if (todaysSpecials.length > 0) {
    const todaySpecialsContainer = document.createElement('div');
    todaySpecialsContainer.className = 'today-specials-container';
    todaysSpecials.forEach(s => {
      const singleTodayCard = document.createElement('div');
      singleTodayCard.className = 'today-special-card';
      singleTodayCard.textContent = s.day + " – " + s.meal + ": " + s.dish;
      todaySpecialsContainer.appendChild(singleTodayCard);
    });
    headerContainer.appendChild(todaySpecialsContainer);
  }
  specialDishesRow.appendChild(headerContainer);
  const tickerContainer = document.createElement('div');
  tickerContainer.className = 'ticker-container';
  const tickerContent = document.createElement('div');
  tickerContent.className = 'ticker-content';
  const tickerItems = document.createElement('div');
  tickerItems.className = 'ticker-items';
  if (otherSpecials.length === 0) {
    const item = document.createElement('div');
    item.className = 'ticker-item';
    item.textContent = "No special dishes detected.";
    tickerItems.appendChild(item);
  } else {
    otherSpecials.forEach(s => {
      const item = document.createElement('div');
      item.className = 'ticker-item';
      item.textContent = s.day + " – " + s.meal + ": " + s.dish;
      tickerItems.appendChild(item);
    });
  }
  tickerContent.appendChild(tickerItems);
  const tickerItemsClone = tickerItems.cloneNode(true);
  tickerContent.appendChild(tickerItemsClone);
  tickerContainer.appendChild(tickerContent);
  specialDishesRow.appendChild(tickerContainer);
  const contentWidth = tickerItems.offsetWidth;
  const duration = Math.max(contentWidth / 50, 10);
  tickerContent.style.animationDuration = duration + 's';
}
function updateScheduleMain() {
  if (!fetchedMenuMain) return;
  const now = new Date();
  const dayIndex = now.getDay();
  const currentDayName = dayNameMap[dayIndex];
  const dateDisplay = document.getElementById('mainDateDisplay');
  dateDisplay.textContent = now.toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  let schedule = {};
  if (dayIndex === 0) {
    schedule = {
      Breakfast:{start:420,end:570,display:formatTime(7,0)+" - "+formatTime(9,30)},
      Lunch:{start:720,end:870,display:formatTime(12,0)+" - "+formatTime(14,30)},
      Dinner:{start:1170,end:1290,display:formatTime(19,30)+" - "+formatTime(21,30)}
    };
  } else {
    schedule = {
      Breakfast:{start:420,end:540,display:formatTime(7,0)+" - "+formatTime(9,0)},
      Lunch:{start:720,end:840,display:formatTime(12,0)+" - "+formatTime(14,0)},
      Dinner:{start:1170,end:1290,display:formatTime(19,30)+" - "+formatTime(21,30)}
    };
  }
  const dayKey = findKeyByDay(fetchedMenuMain, currentDayName);
  const todayData = dayKey ? fetchedMenuMain[dayKey] : null;
  if (!todayData) {
    document.getElementById('mainBreakfastTime').textContent = schedule.Breakfast.display;
    document.getElementById('mainLunchTime').textContent = schedule.Lunch.display;
    document.getElementById('mainDinnerTime').textContent = schedule.Dinner.display;
    document.getElementById('mainBreakfastDishes').textContent = "No data available";
    document.getElementById('mainLunchDishes').textContent = "No data available";
    document.getElementById('mainDinnerDishes').textContent = "No data available";
  } else {
    let dayMeals = {Breakfast:"",Lunch:"",Dinner:""};
    for (let mealKey in todayData) {
      const nk = normalizeMealKey(mealKey);
      if (["Breakfast","Lunch","Dinner"].includes(nk)) {
        dayMeals[nk] = todayData[mealKey];
      }
    }
    document.getElementById('mainBreakfastTime').textContent = schedule.Breakfast.display;
    document.getElementById('mainLunchTime').textContent = schedule.Lunch.display;
    document.getElementById('mainDinnerTime').textContent = schedule.Dinner.display;
    document.getElementById('mainBreakfastDishes').textContent = dayMeals["Breakfast"] || "No data available";
    document.getElementById('mainLunchDishes').textContent = dayMeals["Lunch"] || "No data available";
    document.getElementById('mainDinnerDishes').textContent = dayMeals["Dinner"] || "No data available";
  }
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  ['mainBreakfast','mainLunch','mainDinner'].forEach(id => {
    document.getElementById(id).classList.remove('active');
  });
  for (let mealName in schedule) {
    const id = 'main' + mealName;
    if (currentMinutes >= schedule[mealName].start && currentMinutes < schedule[mealName].end) {
      document.getElementById(id).classList.add('active');
    }
  }
}
function updateSchedule128() {
  if (!fetchedMenu128) return;
  const now = new Date();
  const dayIndex = now.getDay();
  const currentDayName = dayNameMap[now.getDay()];
  const dateDisplay = document.getElementById('branch128DateDisplay');
  const todayList = document.getElementById('branch128TodayList');
  dateDisplay.textContent = now.toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  todayList.innerHTML = '';
  const dayKey = findKeyByDay(fetchedMenu128, currentDayName);
  const dayData = dayKey ? fetchedMenu128[dayKey] : null;
  if (!dayData) {
    const noDataEl = document.createElement('div');
    noDataEl.className = 'dish-item';
    noDataEl.textContent = "No data available";
    todayList.appendChild(noDataEl);
    return;
  }
  if (dayData.all) {
    const allEl = document.createElement('div');
    allEl.className = 'dish-item';
    allEl.textContent = dayData.all;
    todayList.appendChild(allEl);
    return;
  }
  const keys = Object.keys(dayData).sort();
  if (keys.length === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'dish-item';
    emptyEl.textContent = "No data available";
    todayList.appendChild(emptyEl);
    return;
  }
  keys.forEach(k => {
    const dishEl = document.createElement('div');
    dishEl.className = 'dish-item';
    dishEl.textContent = dayData[k];
    todayList.appendChild(dishEl);
  });
}
function displayAllDaysBothCampuses() {
  if (!fetchedMenuMain || !fetchedMenu128) return;
  const allDaysStack = document.getElementById('allDaysStack');
  allDaysStack.innerHTML = '';
  const now = new Date();
  const currentDayName = dayNameMap[now.getDay()];
  dayOrder.forEach(day => {
    const dayCard = document.createElement('div');
    dayCard.className = 'day-card';
    const dayTitle = document.createElement('h3');
    dayTitle.textContent = (day === currentDayName) ? day + " (Today)" : day;
    dayCard.appendChild(dayTitle);
    const subcardsDay = document.createElement('div');
    subcardsDay.className = 'subcards-day';
    const mainSubcard = document.createElement('div');
    mainSubcard.className = 'subcard-day mainSubcard';
    const mainHeading = document.createElement('h4');
    mainHeading.textContent = 'Main Campus';
    mainSubcard.appendChild(mainHeading);
    const mainDayKey = findKeyByDay(fetchedMenuMain, day);
    const mainData = mainDayKey ? fetchedMenuMain[mainDayKey] : null;
    if (!mainData) {
      const noData = document.createElement('p');
      noData.className = 'no-data';
      noData.textContent = "No data available";
      mainSubcard.appendChild(noData);
    } else {
      const meals = {Breakfast:'',Lunch:'',Dinner:''};
      for (let mk in mainData) {
        const nk = normalizeMealKey(mk);
        if (['Breakfast','Lunch','Dinner'].includes(nk)) {
          meals[nk] = mainData[mk];
        }
      }
      function appendMealLine(label, mealString) {
        const line = document.createElement('p');
        line.innerHTML = '<span class="mealType">' + label + '</span>: ' + (mealString || 'No data available');
        mainSubcard.appendChild(line);
      }
      appendMealLine('Breakfast', meals.Breakfast);
      appendMealLine('Lunch', meals.Lunch);
      appendMealLine('Dinner', meals.Dinner);
    }
    subcardsDay.appendChild(mainSubcard);
    const branchSubcard = document.createElement('div');
    branchSubcard.className = 'subcard-day branchSubcard';
    const branchHeading = document.createElement('h4');
    branchHeading.textContent = '128 Campus';
    branchSubcard.appendChild(branchHeading);
    const branchDayKey = findKeyByDay(fetchedMenu128, day);
    const dayData128 = branchDayKey ? fetchedMenu128[branchDayKey] : null;
    if (!dayData128) {
      const noData = document.createElement('p');
      noData.className = 'no-data';
      noData.textContent = "No data available";
      branchSubcard.appendChild(noData);
    } else {
      if (dayData128.all) {
        const allP = document.createElement('p');
        allP.innerHTML = '<span class="mealType">All</span>: ' + dayData128.all;
        branchSubcard.appendChild(allP);
      } else {
        const keys = Object.keys(dayData128).sort();
        if (keys.length === 0) {
          const noData = document.createElement('p');
          noData.className = 'no-data';
          noData.textContent = "No data available";
          branchSubcard.appendChild(noData);
        } else {
          keys.forEach(k => {
            const dishP = document.createElement('p');
            dishP.textContent = dayData128[k];
            branchSubcard.appendChild(dishP);
          });
        }
      }
    }
    subcardsDay.appendChild(branchSubcard);
    dayCard.appendChild(subcardsDay);
    allDaysStack.appendChild(dayCard);
  });
  updateFullWeekMode();
}
const scrollTopBtn = document.getElementById('scrollTopBtn');
window.addEventListener('scroll', () => {
  if (window.scrollY > 300) {
    scrollTopBtn.style.display = 'block';
  } else {
    scrollTopBtn.style.display = 'none';
  }
});
scrollTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
function updateVisibilityMode() {
  const mainCampusCard = document.getElementById('mainCampusCard');
  const campus128Card = document.getElementById('campus128Card');
  if (currentMode === '62') {
    mainCampusCard.style.display = 'block';
    campus128Card.style.display = 'none';
  } else if (currentMode === '128') {
    mainCampusCard.style.display = 'none';
    campus128Card.style.display = 'block';
  } else {
    mainCampusCard.style.display = 'block';
    campus128Card.style.display = 'block';
  }
  updateFullWeekMode();
}
function updateFullWeekMode() {
  const mainSubcards = document.querySelectorAll('#allDaysStack .mainSubcard');
  const branchSubcards = document.querySelectorAll('#allDaysStack .branchSubcard');
  if (currentMode === '62') {
    mainSubcards.forEach(el => el.style.display = 'block');
    branchSubcards.forEach(el => el.style.display = 'none');
  } else if (currentMode === '128') {
    mainSubcards.forEach(el => el.style.display = 'none');
    branchSubcards.forEach(el => el.style.display = 'block');
  } else {
    mainSubcards.forEach(el => el.style.display = 'block');
    branchSubcards.forEach(el => el.style.display = 'block');
  }
}
function highlightActiveButton(selectedButton) {
  mode62Btn.classList.remove('active');
  mode128Btn.classList.remove('active');
  modeBothBtn.classList.remove('active');
  selectedButton.classList.add('active');
}
document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById('loader');
  const contentDiv = document.getElementById('content');
  const toggleAllDaysBtn = document.getElementById('toggleAllDaysBtn');
  const allDaysWrapper = document.getElementById('allDaysWrapper');
  const mode62Btn = document.getElementById('mode62Btn');
  const mode128Btn = document.getElementById('mode128Btn');
  const modeBothBtn = document.getElementById('modeBothBtn');
  fetch('https://raw.githubusercontent.com/life2harsh/mess-schedular/main/mess_menu.json')
    .then(response => {
      if (!response.ok) throw new Error("Failed to fetch main schedule");
      return response.json();
    })
    .then(data => {
      if (!data.menu) throw new Error("No 'menu' property in main JSON");
      fetchedMenuMain = data.menu;
      extractedSpecialDishes = parseSpecialDishes(fetchedMenuMain);
    })
    .catch(err => {
      console.error("Error fetching main campus data:", err);
    })
    .finally(() => {
      fetch('https://raw.githubusercontent.com/life2harsh/mess-schedular/main/mess_128_menu.json')
        .then(response => {
          if (!response.ok) throw new Error("Failed to fetch 128 schedule");
          return response.json();
        })
        .then(data128 => {
          if (!data128.menu) throw new Error("No 'menu' property in 128 JSON");
          fetchedMenu128 = data128.menu;
        })
        .catch(err => {
          console.error("Error fetching 128 campus data:", err);
        })
        .finally(() => {
          loader.style.display = 'none';
          contentDiv.style.display = 'block';
          displaySpecialDishes();
          updateScheduleMain();
          updateSchedule128();
          displayAllDaysBothCampuses();
          updateVisibilityMode();
          setInterval(() => {
            updateScheduleMain();
            updateSchedule128();
          }, 5000);
        });
    });
  toggleAllDaysBtn.addEventListener('click', () => {
    if (allDaysWrapper.style.display === 'none' || allDaysWrapper.style.display === '') {
      allDaysWrapper.style.display = 'block';
      toggleAllDaysBtn.textContent = 'Hide Full Week';
      allDaysWrapper.scrollIntoView({ behavior: 'smooth' });
    } else {
      allDaysWrapper.style.display = 'none';
      toggleAllDaysBtn.textContent = 'Show Full Week';
    }
  });
  mode62Btn.addEventListener('click', () => {
    currentMode = '62';
    updateVisibilityMode();
    highlightActiveButton(mode62Btn);
  });
  mode128Btn.addEventListener('click', () => {
    currentMode = '128';
    updateVisibilityMode();
    highlightActiveButton(mode128Btn);
  });
  modeBothBtn.addEventListener('click', () => {
    currentMode = 'both';
    updateVisibilityMode();
    highlightActiveButton(modeBothBtn);
  });
});
 if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => {
        console.log('Service Worker registered!', reg)
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })

      .catch(err => console.log('Service Worker registration failed:', err));
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

