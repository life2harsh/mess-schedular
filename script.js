    let fetchedMenuMain = null;
    let fetchedMenu128 = null;
    let extractedSpecialDishes = [];
    let currentMode = "both";
    let showFullWeek = false;

    const knownSpecials = [
      "Paneer Makhani", "Gulab Jamun", "Chowmien", "Veg Manchurian",
      "Rajma", "Malai Kofta", "Sabji - Poori", "Matar Paneer",
      "Kashmiri Dum Aloo", "Veg Biryani", "Chole", "Kadai Paneer", 
      "Dal Makhani", "White Matar", "Poori", "Palak Paneer", "Chilli Paneer", "Custard"
    ];

    const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const dayNameMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    function findKeyByDay(jsonObject, dayName) {
      if (!jsonObject) return null;
      const allKeys = Object.keys(jsonObject);
      return allKeys.find(k => k.toLowerCase().includes(dayName.toLowerCase())) || null;
    }

    function formatTime(hours, minutes) {
      const period = hours >= 12 ? 'PM' : 'AM';
      const adjusted = hours % 12 || 12;
      const minStr = minutes < 10 ? '0' + minutes : minutes;
      return `${adjusted}:${minStr} ${period}`;
    }

    function formatCurrentTime(date) {
      return date.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
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
          if (["Breakfast", "Lunch", "Dinner"].includes(nm)) {
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

    function getCurrentSchedule() {
      const now = new Date();
      const dayIndex = now.getDay();

      if (dayIndex === 0) {
        return {
          Breakfast: { start: 420, end: 570, display: "07:00 - 09:30" },
          Lunch: { start: 720, end: 870, display: "12:00 - 14:30" },
          Dinner: { start: 1170, end: 1290, display: "19:30 - 21:30" }
        };
      } else {
        return {
          Breakfast: { start: 420, end: 540, display: "07:00 - 09:00" },
          Lunch: { start: 720, end: 840, display: "12:00 - 14:00" },
          Dinner: { start: 1170, end: 1290, display: "19:30 - 21:30" }
        };
      }
    }

    function getCurrentMeal() {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const schedule = getCurrentSchedule();

      for (let mealName in schedule) {
        if (currentMinutes >= schedule[mealName].start && currentMinutes < schedule[mealName].end) {
          return mealName;
        }
      }
      return null;
    }

    function getTodayData(menu) {
      const now = new Date();
      const currentDayName = dayNameMap[now.getDay()];
      const dayKey = findKeyByDay(menu, currentDayName);
      return dayKey ? menu[dayKey] : null;
    }

    function updateCurrentTime() {
      document.getElementById('currentTime').textContent = formatCurrentTime(new Date());
    }

    function displaySpecialDishes() {
      const now = new Date();
      const currentDayName = dayNameMap[now.getDay()].toLowerCase();
      const todaysSpecials = extractedSpecialDishes.filter(s => 
        s.day.toLowerCase().includes(currentDayName)
      );
      const otherSpecials = extractedSpecialDishes.filter(s => 
        !s.day.toLowerCase().includes(currentDayName)
      );

      const todayContainer = document.getElementById('todaySpecials');
      const tickerContainer = document.getElementById('tickerContent');

      todayContainer.innerHTML = '';
      if (todaysSpecials.length > 0) {
        todaysSpecials.forEach(special => {
          const card = document.createElement('div');
          card.className = 'compact-special';
          card.innerHTML = `
            <span class="special-meal-compact">${special.meal}</span>
            <span class="special-dish-compact">${special.dish}</span>
          `;
          todayContainer.appendChild(card);
        });
      } else {
        const emptyCard = document.createElement('div');
        emptyCard.className = 'compact-special';
        emptyCard.innerHTML = `
          <span class="special-meal-compact">No specials</span>
          <span class="special-dish-compact">—</span>
        `;
        todayContainer.appendChild(emptyCard);
      }

      tickerContainer.innerHTML = '';
      if (otherSpecials.length > 0) {
        otherSpecials.forEach(special => {
          const item = document.createElement('span');
          item.className = 'ticker-item';
          item.textContent = `${special.day} · ${special.meal} · ${special.dish}`;
          tickerContainer.appendChild(item);
        });
      } else {
        const item = document.createElement('span');
        item.className = 'ticker-item';
        item.textContent = 'No other special dishes this week';
        tickerContainer.appendChild(item);
      }
    }

    function displayCampus62() {
      const schedule = getCurrentSchedule();
      const currentMeal = getCurrentMeal();
      const todayData = getTodayData(fetchedMenuMain);
      const container = document.getElementById('meals62');

      let dayMeals = { Breakfast: "", Lunch: "", Dinner: "" };
      if (todayData) {
        for (let mealKey in todayData) {
          const nk = normalizeMealKey(mealKey);
          if (["Breakfast", "Lunch", "Dinner"].includes(nk)) {
            dayMeals[nk] = todayData[mealKey];
          }
        }
      }

      container.innerHTML = '';
      Object.entries(schedule).forEach(([mealName, mealData]) => {
        const mealBlock = document.createElement('div');
        mealBlock.className = `meal-block${currentMeal === mealName ? ' active' : ''}`;
        mealBlock.innerHTML = `
          <div class="meal-header">
            <span class="meal-name">${mealName}</span>
            <span class="meal-time">${mealData.display}</span>
          </div>
          <div class="meal-dishes">${dayMeals[mealName] || '—'}</div>
        `;
        container.appendChild(mealBlock);
      });
    }

    function displayCampus128() {
      const todayData = getTodayData(fetchedMenu128);
      const container = document.getElementById('meals128');

      container.innerHTML = '';
      if (!todayData) {
        const block = document.createElement('div');
        block.className = 'meal-block';
        block.innerHTML = '<div class="meal-dishes no-data">—</div>';
        container.appendChild(block);
      } else if (todayData.all) {
        const block = document.createElement('div');
        block.className = 'meal-block';
        block.innerHTML = `<div class="meal-dishes">${todayData.all}</div>`;
        container.appendChild(block);
      } else {
        Object.keys(todayData).sort().forEach(key => {
          const block = document.createElement('div');
          block.className = 'meal-block';
          block.innerHTML = `<div class="meal-dishes">${todayData[key]}</div>`;
          container.appendChild(block);
        });
      }
    }

    function displayWeekView() {
      if (!fetchedMenuMain || !fetchedMenu128) return;

      const now = new Date();
      const currentDayName = dayNameMap[now.getDay()];
      const container = document.getElementById('weekGrid');

      container.innerHTML = '';
      dayOrder.forEach(day => {
        const isToday = day === currentDayName;
        const mainDayKey = findKeyByDay(fetchedMenuMain, day);
        const branchDayKey = findKeyByDay(fetchedMenu128, day);
        const mainData = mainDayKey ? fetchedMenuMain[mainDayKey] : null;
        const branchData = branchDayKey ? fetchedMenu128[branchDayKey] : null;

        const dayCard = document.createElement('div');
        dayCard.className = `day-card${isToday ? ' today' : ''}`;

        let dayContent = `
          <div class="day-header">
            ${isToday ? '<div class="dot"></div>' : ''}
            <span class="day-name">${day.toUpperCase()}${isToday ? ' · TODAY' : ''}</span>
          </div>
          <div class="day-content">
        `;

        if (currentMode === 'both' || currentMode === '62') {
          dayContent += `
            <div class="campus-data">
              <div class="campus-title">Campus 62</div>
              <div class="meal-list">
          `;

          if (!mainData) {
            dayContent += '<div class="no-data">—</div>';
          } else {
            ['Breakfast', 'Lunch', 'Dinner'].forEach(mealType => {
              let mealString = '';
              for (let mk in mainData) {
                const nk = normalizeMealKey(mk);
                if (nk === mealType) {
                  mealString = mainData[mk];
                  break;
                }
              }
              dayContent += `
                <div class="meal-item">
                  <span class="meal-label">${mealType.slice(0,3).toUpperCase()}</span>
                  <span class="meal-content">${mealString || '—'}</span>
                </div>
              `;
            });
          }

          dayContent += '</div></div>';
        }

        if (currentMode === 'both' || currentMode === '128') {
          dayContent += `
            <div class="campus-data">
              <div class="campus-title">Campus 128</div>
              <div class="meal-list">
          `;

          if (!branchData) {
            dayContent += '<div class="no-data">—</div>';
          } else if (branchData.all) {
            dayContent += `<div class="meal-content">${branchData.all}</div>`;
          } else {
            Object.keys(branchData).sort().forEach(key => {
              dayContent += `<div class="meal-content">${branchData[key]}</div>`;
            });
          }

          dayContent += '</div></div>';
        }

        dayContent += '</div>';
        dayCard.innerHTML = dayContent;
        container.appendChild(dayCard);
      });
    }

    function updateModeVisibility() {
      const campus62 = document.getElementById('campus62');
      const campus128 = document.getElementById('campus128');
      const campusGrid = document.querySelector('.campus-grid');

      campus62.className = 'campus-section';
      campus128.className = 'campus-section';
      campusGrid.className = 'campus-grid';

      if (currentMode === '62') {
        campus62.classList.add('visible');
        campusGrid.classList.add('single-mode');
      } else if (currentMode === '128') {
        campus128.classList.add('visible');
        campusGrid.classList.add('single-mode');
      } else {
        campus62.classList.add('visible');
        campus128.classList.add('visible');
        campusGrid.classList.add('both-mode');
      }

      if (showFullWeek) {
        displayWeekView();
      }
    }

    function updateModeButtons() {
      document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
      if (currentMode === 'both') {
        document.getElementById('modeBothBtn').classList.add('active');
      } else if (currentMode === '62') {
        document.getElementById('mode62Btn').classList.add('active');
      } else if (currentMode === '128') {
        document.getElementById('mode128Btn').classList.add('active');
      }
    }

    function updateWeekToggle() {
      const btn = document.getElementById('toggleWeekBtn');
      const weekView = document.getElementById('weekView');

      if (showFullWeek) {
        btn.textContent = 'Hide Week';
        weekView.classList.add('visible');
        displayWeekView();
        setTimeout(() => {
          weekView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        btn.textContent = 'Show Week';
        weekView.classList.remove('visible');
      }
    }

    function handleScroll() {
      const scrollBtn = document.getElementById('scrollTopBtn');
      if (window.scrollY > 200) {
        scrollBtn.classList.add('visible');
      } else {
        scrollBtn.classList.remove('visible');
      }
    }

    function scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function fetchMenuData() {
      try {
        const [mainResponse, branch128Response] = await Promise.all([
          fetch('https://raw.githubusercontent.com/life2harsh/mess-schedular/main/mess_menu.json'),
          fetch('https://raw.githubusercontent.com/life2harsh/mess-schedular/main/mess_128_menu.json')
        ]);

        if (!mainResponse.ok) throw new Error("Failed to fetch main schedule");
        if (!branch128Response.ok) throw new Error("Failed to fetch 128 schedule");

        const [mainData, branch128Data] = await Promise.all([
          mainResponse.json(),
          branch128Response.json()
        ]);

        if (!mainData.menu) throw new Error("No 'menu' property in main JSON");
        if (!branch128Data.menu) throw new Error("No 'menu' property in 128 JSON");

        fetchedMenuMain = mainData.menu;
        fetchedMenu128 = branch128Data.menu;
        extractedSpecialDishes = parseSpecialDishes(mainData.menu);

        return true;
      } catch (err) {
        console.error("Error fetching menu data:", err);
        return false;
      }
    }

    function updateAllDisplays() {
      displaySpecialDishes();
      displayCampus62();
      displayCampus128();
      updateModeVisibility();
    }

    function setupEventListeners() {

      document.getElementById('modeBothBtn').addEventListener('click', () => {
        currentMode = 'both';
        updateModeButtons();
        updateModeVisibility();
      });

      document.getElementById('mode62Btn').addEventListener('click', () => {
        currentMode = '62';
        updateModeButtons();
        updateModeVisibility();
      });

      document.getElementById('mode128Btn').addEventListener('click', () => {
        currentMode = '128';
        updateModeButtons();
        updateModeVisibility();
      });

      document.getElementById('toggleWeekBtn').addEventListener('click', () => {
        showFullWeek = !showFullWeek;
        updateWeekToggle();
      });

      document.getElementById('scrollTopBtn').addEventListener('click', scrollToTop);

      window.addEventListener('scroll', handleScroll);
    }

    async function initializeApp() {

      updateCurrentTime();
      setInterval(updateCurrentTime, 1000);

      setupEventListeners();

      const success = await fetchMenuData();

      setTimeout(() => {
        document.getElementById('loader').style.opacity = '0';
        setTimeout(() => {
          document.getElementById('loader').style.display = 'none';
          document.getElementById('content').classList.remove('hidden');

          if (success) {
            updateAllDisplays();

            setInterval(() => {
              displayCampus62();
            }, 60000); 
          }
        }, 500);
      }, 800);
    }

    document.addEventListener('DOMContentLoaded', initializeApp);