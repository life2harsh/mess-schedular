let fetchedMenuMain = null;
    let fetchedMenu128 = null;
    let extractedSpecialDishes = [];
    let currentMode = "both";
    let showFullWeek = false;
    let swRegistration = null;

    const VAPID_CONFIG = {
      publicKey: 'BANXwiYnbiMAGk99oWfHaMA3hgq3eTGrJAv3DlOvL-CWUnO_NxNedheCx9sdDJscfAcM1grqeX5AU0oxTaKgL8A',
      serverEndpoint: '',
      enabled: true
    };

    const SERVER_CONFIG = {
        apiEndpoint: '',
        wsEndpoint: '',
        local: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    };

    if (SERVER_CONFIG.local) {
        SERVER_CONFIG.apiEndpoint = 'http://localhost:8000/api';
        SERVER_CONFIG.wsEndpoint = 'ws://localhost:8000/ws';
        VAPID_CONFIG.serverEndpoint = 'http://localhost:8000/api';
    }

    let wsConnection = null;
    let currentVotes = { good: 0, bad: 0, skip: 0 };
    let clientId = null;

    function getClientId() {
        if (clientId) return clientId;

        let storedClientId = localStorage.getItem('messClientId');

        if (!storedClientId) {

            storedClientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('messClientId', storedClientId);
            console.log('Generated new client ID:', storedClientId);
        } else {
            console.log('Using existing client ID:', storedClientId);
        }

        clientId = storedClientId;
        return clientId;
    }

    async function connectToServer() {
        if (!SERVER_CONFIG.local && window.location.protocol === 'http:') {
            return;
        }

        try {
            wsConnection = new WebSocket(SERVER_CONFIG.wsEndpoint);

            wsConnection.onopen = () => {
                console.log('WebSocket connected successfully!');
                updateServerConnectionStatus(true);

                wsConnection.send(JSON.stringify({type: 'ping', message: 'Hello from client'}));
            };

            wsConnection.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleServerMessage(data);
                } catch (e) {

                }
            };

            wsConnection.onclose = () => {
                updateServerConnectionStatus(false);
                setTimeout(connectToServer, 5000);
            };

            wsConnection.onerror = (error) => {
                updateServerConnectionStatus(false);
            };

        } catch (error) {
            updateServerConnectionStatus(false);
        }
    }

    function handleServerMessage(data) {
        console.log('Received WebSocket message:', data);
        switch (data.type) {
            case 'vote_update':
                console.log('Vote update received:', data.votes);
                currentVotes = data.votes;
                updateVotingDisplay();
                break;
            case 'notification':
                showServerNotification(data.title, data.message);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    function updateServerConnectionStatus(connected) {
        console.log('WebSocket connection status:', connected ? 'Connected' : 'Disconnected');
    }

    async function submitVoteToServer(voteType) {
        try {
            const response = await fetch(`${SERVER_CONFIG.apiEndpoint}/vote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    vote: voteType,
                    client_id: getClientId(),
                    timestamp: new Date().toISOString()
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Vote submitted successfully:', result);
                currentVotes = result.votes;
                updateVotingDisplay();
                return true;
            } else {
                console.error('Failed to submit vote:', response.statusText);
                return false;
            }
        } catch (error) {
            console.error('Error submitting vote:', error);
            return false;
        }
    }

    async function getServerVotes() {
        try {
            const response = await fetch(`${SERVER_CONFIG.apiEndpoint}/votes`);
            if (response.ok) {
                const result = await response.json();
                currentVotes = result.votes;
                updateVotingDisplay();
            }
        } catch (error) {
            console.error('Error fetching votes:', error);
        }
    }

    async function subscribeToServerNotifications(subscription) {
        try {
            const response = await fetch(`${SERVER_CONFIG.apiEndpoint}/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(subscription)
            });

            if (response.ok) {

                return true;
            } else {
                console.error('Failed to subscribe to server:', response.statusText);
                return false;
            }
        } catch (error) {
            console.error('Error subscribing to server:', error);
            return false;
        }
    }

    function updateVotingDisplay() {
        console.log('updateVotingDisplay called with currentVotes:', currentVotes);

        const total = (currentVotes.good || 0) + (currentVotes.bad || 0) + (currentVotes.skip || 0);
        console.log('Total votes:', total);

        if (total === 0) {

            updateVoteUI();
            return;
        }

        updateVoteUI();

    }

    function updateVoteUI() {
        console.log('updateVoteUI called with currentVotes:', currentVotes);

        document.getElementById('goodCount').textContent = currentVotes.good || 0;
        document.getElementById('badCount').textContent = currentVotes.bad || 0;
        document.getElementById('skipCount').textContent = currentVotes.skip || 0;

        console.log('Updated count elements:', {
            good: document.getElementById('goodCount').textContent,
            bad: document.getElementById('badCount').textContent,
            skip: document.getElementById('skipCount').textContent
        });

        const total = (currentVotes.good || 0) + (currentVotes.bad || 0) + (currentVotes.skip || 0);

        if (total > 0) {

            const goodPercent = ((currentVotes.good || 0) / total) * 100;
            const badPercent = ((currentVotes.bad || 0) / total) * 100;
            const skipPercent = ((currentVotes.skip || 0) / total) * 100;

            document.getElementById('goodFill').style.width = `${goodPercent}%`;
            document.getElementById('badFill').style.width = `${badPercent}%`;
            document.getElementById('skipFill').style.width = `${skipPercent}%`;

            console.log('Updated progress bars:', { goodPercent, badPercent, skipPercent });

            document.getElementById('votingResults').style.display = 'block';
        } else {

            document.getElementById('goodFill').style.width = '0%';
            document.getElementById('badFill').style.width = '0%';
            document.getElementById('skipFill').style.width = '0%';
        }
    }

    function showServerNotification(title, message) {

        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                icon: '/icon.png',
                tag: 'server-notification'
            });
        }
    }

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
      } else if (todayData.VERTICAL) {
        const block = document.createElement('div');
        block.className = 'meal-block';
        block.innerHTML = `<div class="meal-dishes special-event">${todayData.VERTICAL}</div>`;
        container.appendChild(block);
      } else {
        const sortedKeys = Object.keys(todayData).sort((a, b) => {
          const numA = parseInt(a);
          const numB = parseInt(b);
          if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
          }
          return a.localeCompare(b);
        });

        sortedKeys.forEach(key => {
          const block = document.createElement('div');
          block.className = 'meal-block';
          const dishName = todayData[key];
          block.innerHTML = `<div class="meal-dishes">${dishName}</div>`;
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
          } else if (branchData.VERTICAL) {
            dayContent += `<div class="meal-content special-event">${branchData.VERTICAL}</div>`;
          } else {
            const sortedKeys = Object.keys(branchData).sort((a, b) => {
              const numA = parseInt(a);
              const numB = parseInt(b);
              if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
              }
              return a.localeCompare(b);
            });

            sortedKeys.forEach(key => {
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
        setTimeout(() => {
          document.getElementById('todayMeals').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
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

        const fetchWithTimeout = (url, timeout = 8000) => {
          return Promise.race([
            fetch(url),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('timeout')), timeout)
            )
          ]);
        };

        const [mainResponse, branch128Response] = await Promise.all([
          fetchWithTimeout('https://raw.githubusercontent.com/life2harsh2/data/main/mess_menu.json'),
          fetchWithTimeout('https://raw.githubusercontent.com/life2harsh2/data/main/mess_128_menu.json')
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
      updateVotingState();
    }

    let votingData = {
      good: 0,
      bad: 0,
      skip: 0
    };

    let userVote = null;
    let votingActive = false;
    let nextMealInfo = null;
    let notificationShown = false;
    let lastNotificationTime = 0;

    function initializeVotingSystem() {

        getClientId();

        const savedData = localStorage.getItem('messVotingData');
        const savedUserVote = localStorage.getItem('messUserVote');
        const savedDate = localStorage.getItem('messVotingDate');
        const today = new Date().toDateString();      
      if (savedDate !== today) {
        votingData = { good: 0, bad: 0, skip: 0 };
        userVote = null;
        notificationShown = false;
        lastNotificationTime = 0;
        localStorage.removeItem('messVotingData');
        localStorage.removeItem('messUserVote');
        localStorage.removeItem('messNotificationShown');
        localStorage.removeItem('messLastNotificationTime');
        localStorage.setItem('messVotingDate', today);
      } else {
        if (savedData) {
          votingData = JSON.parse(savedData);
        }
        if (savedUserVote) {
          userVote = savedUserVote;
        }
        notificationShown = localStorage.getItem('messNotificationShown') === 'true';
        lastNotificationTime = parseInt(localStorage.getItem('messLastNotificationTime') || '0');
      }

      updateVotingState();
      updateVotingDisplay();

      fetchCurrentVotes();

      setInterval(updateVotingState, 60000);

      setInterval(checkForNotifications, 30000);
    }

    async function fetchCurrentVotes() {
        try {
            console.log('Fetching current votes from:', `${SERVER_CONFIG.apiEndpoint}/votes`);
            const response = await fetch(`${SERVER_CONFIG.apiEndpoint}/votes`);
            if (response.ok) {
                const result = await response.json();
                console.log('Fetched votes from server:', result);
                currentVotes = result.votes || { good: 0, bad: 0, skip: 0 };
                console.log('Updated currentVotes to:', currentVotes);
                updateVotingDisplay();
            } else {
                console.error('Failed to fetch votes:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Error fetching current votes:', error);
        }
    }

    async function testNotificationSystem() {
        console.log('🔔 Testing notification system...');
        
        // Mobile-specific debugging
        console.log('📱 User Agent:', navigator.userAgent);
        console.log('🌐 Protocol:', window.location.protocol);
        console.log('🏠 Hostname:', window.location.hostname);

        if (!('Notification' in window)) {
            console.error('❌ This browser does not support notifications');
            alert('❌ Notifications not supported on this device');
            return;
        }
        
        console.log('✅ Notification API supported');

        if (Notification.permission === 'default') {
            console.log('📝 Requesting notification permission...');
            try {
                const permission = await Notification.requestPermission();
                console.log('🔐 Permission result:', permission);
                
                if (permission === 'denied') {
                    alert('❌ Notifications blocked. Please enable in browser settings.');
                    return;
                }
            } catch (error) {
                console.error('❌ Permission request failed:', error);
                alert('❌ Failed to request notification permission');
                return;
            }
        } else {
            console.log('🔐 Notification permission:', Notification.permission);
        }

        if (Notification.permission !== 'granted') {
            console.error('❌ Notification permission not granted:', Notification.permission);
            alert('❌ Notification permission not granted. Permission: ' + Notification.permission);
            return;
        }

        // Try service worker registration notification first (required for mobile)
        if ('serviceWorker' in navigator) {
            try {
                console.log('📱 Trying ServiceWorker notification...');
                const registration = await navigator.serviceWorker.ready;
                
                await registration.showNotification('🧪 Mobile Test Notification', {
                    body: 'This notification was sent using ServiceWorker.showNotification() for mobile compatibility!',
                    icon: './icon.png',
                    badge: './icon.png',
                    tag: 'mobile-sw-test',
                    requireInteraction: false,
                    silent: false,
                    actions: [],
                    data: { source: 'serviceWorker' }
                });
                
                console.log('✅ ServiceWorker notification sent successfully');
                return;
                
            } catch (error) {
                console.error('❌ ServiceWorker notification failed:', error);
                console.log('📱 Falling back to basic notification...');
            }
        }

        // Fallback to basic notification (for desktop/older browsers)
        try {
            console.log('📤 Trying basic notification...');
            const notification = new Notification('🧪 Basic Test Notification', {
                body: 'Fallback notification using basic Notification constructor',
                icon: './icon.png',
                tag: 'basic-test',
                requireInteraction: false,
                silent: false
            });
            
            notification.onclick = () => {
                console.log('🖱️ Notification clicked');
                notification.close();
            };
            
            // Auto-close after 5 seconds for testing
            setTimeout(() => {
                notification.close();
                console.log('🔕 Test notification auto-closed');
            }, 5000);
            
            console.log('✅ Basic notification created successfully');
        } catch (error) {
            console.error('❌ All notification methods failed:', error);
            alert('❌ All notification methods failed: ' + error.message);
        }
    }

    function updateVotingState() {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const schedule = getCurrentSchedule();
      const currentMeal = getCurrentMeal();

      const savedCurrentMeal = localStorage.getItem('messCurrentMeal');
      if (currentMeal && savedCurrentMeal !== currentMeal) {
        notificationShown = false;
        localStorage.setItem('messNotificationShown', 'false');
        localStorage.setItem('messCurrentMeal', currentMeal);
      } else if (!currentMeal) {
        localStorage.removeItem('messCurrentMeal');
      }

      if (currentMeal) {
        const mealSchedule = schedule[currentMeal];
        const mealStartMinutes = mealSchedule.start;
        const mealEndMinutes = mealSchedule.end;
        const votingStartTime = mealStartMinutes + 15; 

        if (currentMinutes >= votingStartTime && currentMinutes < mealEndMinutes) {
          votingActive = true;
          nextMealInfo = null;
        } else {
          votingActive = false;
          if (currentMinutes < votingStartTime) {

            const minutesUntilVoting = votingStartTime - currentMinutes;
            nextMealInfo = {
              type: 'voting',
              meal: currentMeal,
              timeLeft: minutesUntilVoting,
              message: `Voting opens in ${minutesUntilVoting} min`
            };
          }
        }
      } else {
        votingActive = false;
        nextMealInfo = getNextMealInfo();
      }

      updateVotingDisplay();
    }

    function getNextMealInfo() {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const schedule = getCurrentSchedule();
      const meals = ['Breakfast', 'Lunch', 'Dinner'];

      for (const meal of meals) {
        const mealStart = schedule[meal].start;
        if (currentMinutes < mealStart) {
          const minutesUntil = mealStart - currentMinutes;
          const hours = Math.floor(minutesUntil / 60);
          const mins = minutesUntil % 60;
          let timeString = '';
          if (hours > 0) {
            timeString = `${hours}h ${mins}m`;
          } else {
            timeString = `${mins} min`;
          }

          return {
            type: 'meal',
            meal: meal,
            timeLeft: minutesUntil,
            message: `${meal} in ${timeString}`
          };
        }
      }

      const tomorrowBreakfast = schedule.Breakfast.start + (24 * 60);
      const minutesUntil = tomorrowBreakfast - currentMinutes;
      const hours = Math.floor(minutesUntil / 60);

      return {
        type: 'meal',
        meal: 'Breakfast',
        timeLeft: minutesUntil,
        message: `Tomorrow's Breakfast in ${hours}h`
      };
    }

    function checkForNotifications() {
      if (!votingActive) return;

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const currentMeal = getCurrentMeal();

      if (!currentMeal) return;

      const schedule = getCurrentSchedule();
      const mealSchedule = schedule[currentMeal];
      const votingStartTime = mealSchedule.start + 15;

      if (currentMinutes >= votingStartTime && currentMinutes < votingStartTime + 1 && !notificationShown) {
        showVotingNotification();
        notificationShown = true;
        localStorage.setItem('messNotificationShown', 'true');
      }
    }

    function urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);

      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }

    async function subscribeToPushNotifications() {
      if (!VAPID_CONFIG.enabled) {

        return null;
      }

      if (!swRegistration) {
        console.error('Service worker not registered');
        return null;
      }

      try {
        const subscription = await swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_CONFIG.publicKey)
        });

        console.log('Push subscription created:', subscription);

        const success = await subscribeToServerNotifications(subscription);
        if (success) {
          console.log('Successfully registered for push notifications');
        } else {
          console.error('Failed to register push subscription with server');
        }

        return subscription;
      } catch (error) {
        console.error('Failed to subscribe to push notifications:', error);
        return null;
      }
    }

    async function unsubscribeFromPushNotifications() {
      if (!swRegistration) return;

      try {
        const subscription = await swRegistration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();

        }
      } catch (error) {
        console.error('Failed to unsubscribe from push notifications:', error);
      }
    }

    async function registerServiceWorkerIfNeeded() {
      if (!('serviceWorker' in navigator)) return null;

      try {

        const existingRegistrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of existingRegistrations) {

          await registration.unregister();
        }

        const registrationOptions = {
          scope: window.location.pathname || '/',
          updateViaCache: 'none'
        };

        swRegistration = await navigator.serviceWorker.register('./service-worker.js', registrationOptions);

        await navigator.serviceWorker.ready;

        if ('PushManager' in window) {

          if (VAPID_CONFIG.enabled) {

          } else {

          }
        } else {

        }

        swRegistration.addEventListener('updatefound', () => {
          const newWorker = swRegistration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {

              newWorker.postMessage({ type: 'SKIP_WAITING' });
              window.location.reload();
            }
          });
        });

        return swRegistration;
      } catch (error) {
        console.error('❌ Service worker registration failed:', error);
        return null;
      }
    }

    async function showVotingNotification() {
      if ('Notification' in window && Notification.permission === 'granted') {
        const currentMeal = getCurrentMeal();
        try {
          if (!swRegistration) {
            swRegistration = await registerServiceWorkerIfNeeded();
          }

          if (swRegistration) {
            await swRegistration.showNotification('🍽️ Rate Today\'s Food!', {
              body: `How was the ${currentMeal.toLowerCase()}? Help others decide by voting now.`,
              tag: 'mess-voting',
              requireInteraction: true,
              silent: false,
              icon: './icon.png',
              badge: './icon.png',
              actions: [
                { action: 'vote_good', title: '👍 Good' },
                { action: 'vote_bad', title: '👎 Bad' },
                { action: 'vote_skip', title: '⏭️ Skip' }
              ],
              data: {
                action: 'meal_notification',
                meal: currentMeal,
                url: '/?from=notification'
              }
            });
          } else {
            new Notification('🍽️ Rate Today\'s Food!', {
              body: `How was the ${currentMeal.toLowerCase()}? Help others decide by voting now.`,
              tag: 'mess-voting',
              requireInteraction: true,
              silent: false
            });
          }
        } catch (error) {
          console.error('Voting notification error:', error);
          try {
            new Notification('🍽️ Rate Today\'s Food!', {
              body: `How was the ${currentMeal.toLowerCase()}? Help others decide by voting now.`
            });
          } catch (fallbackError) {
            console.error('Fallback notification error:', fallbackError);
          }
        }
      } else if (Notification.permission !== 'denied' && 'Notification' in window) {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            showVotingNotification();
          }
        });
      }
    }

    async function showResultsNotification() {
      if ('Notification' in window && Notification.permission === 'granted') {
        const total = votingData.good + votingData.bad + votingData.skip;
        if (total > 0) {
          const goodPercent = Math.round((votingData.good / total) * 100);
          try {

            if ('serviceWorker' in navigator) {
              const registration = await navigator.serviceWorker.ready;
              await registration.showNotification('Food Rating Update', {
                body: `Current votes: ${goodPercent}% Good, ${total} total votes`,
                tag: 'mess-results',
                requireInteraction: false,
                silent: true,
                icon: './icon.png',
                badge: './icon.png'
              });
            } else {

              new Notification('Food Rating Update', {
                body: `Current votes: ${goodPercent}% Good, ${total} total votes`,
                tag: 'mess-results',
                requireInteraction: false,
                silent: true
              });
            }
          } catch (error) {

            try {
              if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                await registration.showNotification('Food Rating Update', {
                  body: `Current votes: ${goodPercent}% Good, ${total} total votes`,
                  icon: './icon.png'
                });
              } else {
                new Notification('Food Rating Update', {
                  body: `Current votes: ${goodPercent}% Good, ${total} total votes`
                });
              }
            } catch (fallbackError) {

            }
          }
        }
      }
    }

    function openSettingsModal() {
      const modal = document.getElementById('settingsModal');
      modal.classList.remove('hidden');
      document.body.classList.add('modal-open');
      updateNotificationStatus();
    }

    function closeSettingsModal() {
      const modal = document.getElementById('settingsModal');
      modal.classList.add('hidden');
      document.body.classList.remove('modal-open');
    }

    function updateNotificationStatus() {
      const statusElement = document.getElementById('notificationStatus');
      const buttonElement = document.getElementById('enableNotificationsBtn');
      const buttonText = document.getElementById('notificationBtnText');

      if ('Notification' in window) {
        const permission = Notification.permission;

        statusElement.className = `notification-status ${permission}`;

        switch (permission) {
          case 'granted':
            statusElement.textContent = '✅ Enabled';
            buttonElement.className = 'notification-permission-btn granted';
            buttonText.textContent = 'Notifications Enabled';
            buttonElement.disabled = true;
            break;
          case 'denied':
            statusElement.textContent = '❌ Blocked';
            buttonElement.className = 'notification-permission-btn denied';
            buttonText.textContent = 'Enable in Browser Settings';
            buttonElement.disabled = true;
            break;
          default:
            statusElement.textContent = '⏳ Not Set';
            buttonElement.className = 'notification-permission-btn';
            buttonText.textContent = 'Enable Notifications';
            buttonElement.disabled = false;
        }
      } else {
        statusElement.className = 'notification-status denied';
        statusElement.textContent = '❌ Not Supported';
        buttonElement.className = 'notification-permission-btn denied';
        buttonText.textContent = 'Not Supported';
        buttonElement.disabled = true;
      }
    }

    async function requestNotificationPermission() {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(async permission => {
          updateNotificationStatus();

          if (permission === 'granted') {

            try {

              if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                await registration.showNotification('🎉 Notifications Enabled!', {
                  body: 'You\'ll now receive voting reminders and results updates.',
                  tag: 'mess-welcome',
                  requireInteraction: true,
                  icon: './icon.png',
                  badge: './icon.png'
                });
              } else {

                new Notification('🎉 Notifications Enabled!', {
                  body: 'You\'ll now receive voting reminders and results updates.',
                  tag: 'mess-welcome',
                  requireInteraction: true
                });
              }
            } catch (error) {

              try {
                if ('serviceWorker' in navigator) {
                  const registration = await navigator.serviceWorker.ready;
                  await registration.showNotification('🎉 Notifications Enabled!', {
                    body: 'You\'ll now receive voting reminders and results updates.',
                    icon: './icon.png'
                  });
                } else {
                  new Notification('🎉 Notifications Enabled!', {
                    body: 'You\'ll now receive voting reminders and results updates.'
                  });
                }
              } catch (fallbackError) {

              }
            }
          }
        });
      }
    }

    function updateVotingDisplay() {
      const votingWidget = document.getElementById('votingWidget');
      const votingButtons = document.querySelector('.voting-buttons');
      const votingResults = document.getElementById('votingResults');

      if (votingActive) {

        votingWidget.innerHTML = `
          <div class="voting-question">
            <h4>Rate Today's Food Quality</h4>
            <p class="voting-subtitle">Help others decide</p>
          </div>
          <div class="voting-buttons">
            <button id="voteGoodBtn" class="vote-btn vote-good ${userVote === 'good' ? 'voted' : ''}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
              </svg>
              Good
            </button>
            <button id="voteBadBtn" class="vote-btn vote-bad ${userVote === 'bad' ? 'voted' : ''}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
              </svg>
              Bad
            </button>
            <button id="voteSkipBtn" class="vote-btn vote-skip ${userVote === 'skip' ? 'voted' : ''}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
              Skip
            </button>
          </div>
          <div id="votingResults" class="voting-results">
            <div class="result-item">
              <span class="result-label">Good</span>
              <div class="result-bar">
                <div class="result-fill good" id="goodFill"></div>
              </div>
              <span class="result-count" id="goodCount">${votingData.good}</span>
            </div>
            <div class="result-item">
              <span class="result-label">Bad</span>
              <div class="result-bar">
                <div class="result-fill bad" id="badFill"></div>
              </div>
              <span class="result-count" id="badCount">${votingData.bad}</span>
            </div>
            <div class="result-item">
              <span class="result-label">Skip</span>
              <div class="result-bar">
                <div class="result-fill skip" id="skipFill"></div>
              </div>
              <span class="result-count" id="skipCount">${votingData.skip}</span>
            </div>
          </div>
          <div id="votingStatus" class="voting-status hidden">
            <p class="vote-submitted">✓ Thank you for your feedback!</p>
          </div>
        `;

        document.getElementById('voteGoodBtn').addEventListener('click', () => vote('good'));
        document.getElementById('voteBadBtn').addEventListener('click', () => vote('bad'));
        document.getElementById('voteSkipBtn').addEventListener('click', () => vote('skip'));

        updateVotingResults();

      } else if (nextMealInfo) {

        const iconMap = {
          'Breakfast': '🌅',
          'Lunch': '☀️',
          'Dinner': '🌙'
        };

        votingWidget.innerHTML = `
          <div class="next-meal-info">
            <div class="next-meal-icon">${iconMap[nextMealInfo.meal] || '🍽️'}</div>
            <div class="next-meal-content">
              <h4>Next Up</h4>
              <p class="next-meal-name">${nextMealInfo.meal}</p>
              <p class="next-meal-time">${nextMealInfo.message}</p>
            </div>
          </div>
        `;
      }
    }

    async function vote(type) {
      if (!votingActive) return;

      const serverSuccess = await submitVoteToServer(type);

      if (serverSuccess) {

        if (userVote) {
          votingData[userVote]--;
        }
        votingData[type]++;
        userVote = type;
      } else {

        if (userVote) {
          votingData[userVote]--;
        }
        votingData[type]++;
        userVote = type;

        localStorage.setItem('messVotingData', JSON.stringify(votingData));
        localStorage.setItem('messUserVote', userVote);
      }

      updateVotingDisplay();
      showVotingThankYou();
    }

    function updateVotingResults() {
      const total = votingData.good + votingData.bad + votingData.skip;

      const goodPercent = total > 0 ? (votingData.good / total) * 100 : 0;
      const badPercent = total > 0 ? (votingData.bad / total) * 100 : 0;
      const skipPercent = total > 0 ? (votingData.skip / total) * 100 : 0;

      const goodFill = document.getElementById('goodFill');
      const badFill = document.getElementById('badFill');
      const skipFill = document.getElementById('skipFill');
      const goodCount = document.getElementById('goodCount');
      const badCount = document.getElementById('badCount');
      const skipCount = document.getElementById('skipCount');

      if (goodFill) goodFill.style.width = `${goodPercent}%`;
      if (badFill) badFill.style.width = `${badPercent}%`;
      if (skipFill) skipFill.style.width = `${skipPercent}%`;

      if (goodCount) goodCount.textContent = votingData.good;
      if (badCount) badCount.textContent = votingData.bad;
      if (skipCount) skipCount.textContent = votingData.skip;
    }

    function showVotingThankYou() {
      const statusElement = document.getElementById('votingStatus');
      if (statusElement) {
        statusElement.classList.remove('hidden');

        setTimeout(() => {
          statusElement.classList.add('hidden');
        }, 3000);
      }
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

      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', event => {
          if (event.data && event.data.type === 'notification-click') {
            const { action, voteType, data } = event.data;

            if (voteType && ['good', 'bad', 'skip'].includes(voteType)) {
              vote(voteType);
            }
          }
        });
      }

      document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
      document.getElementById('closeSettingsBtn').addEventListener('click', closeSettingsModal);
      document.getElementById('settingsModal').querySelector('.modal-overlay').addEventListener('click', closeSettingsModal);
      document.getElementById('enableNotificationsBtn').addEventListener('click', requestNotificationPermission);
    }

    async function initializeApp() {

      updateCurrentTime();
      setInterval(updateCurrentTime, 1000);

      setupEventListeners();

      if ('serviceWorker' in navigator) {
        try {
          swRegistration = await registerServiceWorkerIfNeeded();

        } catch (error) {
          console.error('Service worker initialization failed:', error);
        }
      }

      initializeVotingSystem();

      const forceLoad = setTimeout(() => {

        document.getElementById('loader').style.opacity = '0';
        setTimeout(() => {
          document.getElementById('loader').style.display = 'none';
          document.getElementById('content').classList.remove('hidden');

          if (!fetchedMenuMain) {
            document.getElementById('content').innerHTML = `
              <div style="text-align: center; padding: 2rem; color: #666;">
                <h2>Unable to load menu data</h2>
                <p>Please check your connection and refresh</p>
                <button onclick="location.reload()" style="padding: 0.5rem 1rem; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Refresh</button>
              </div>
            `;
          }
        }, 500);
      }, 5000);

      try {
        const success = await fetchMenuData();

        clearTimeout(forceLoad);

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
      } catch (err) {
        console.error("App initialization failed:", err);

      }
    }

    document.addEventListener('DOMContentLoaded', initializeApp);
