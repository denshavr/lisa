document.addEventListener('DOMContentLoaded', () => {
    // === УПРАВЛЕНИЕ ДАТАМИ ===
    let currentDate = new Date();

    function formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function updateDateDisplay() {
        const todayKey = formatDateKey(new Date());
        const selectedKey = formatDateKey(currentDate);

        const display = document.getElementById('current-date-display');
        if (todayKey === selectedKey) {
            display.textContent = 'Сегодня';
        } else {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (formatDateKey(yesterday) === selectedKey) {
                display.textContent = 'Вчера';
            } else {
                display.textContent = currentDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
            }
        }

        renderDashboard();
    }

    document.getElementById('prev-day').addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 1);
        updateDateDisplay();
    });

    document.getElementById('next-day').addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() + 1);
        updateDateDisplay();
    });

    // === СОСТОЯНИЕ И ПРОФИЛИ ===
    let allData = {};
    let currentProfile = localStorage.getItem('currentProfile') || 'girl';

    function getApiUrl(endpoint) {
        if (window.location.hostname === 'localhost' && window.location.port === '3000') {
            return endpoint;
        }
        const isCapacitor = window.location.hostname === 'localhost' && window.location.port === '' || 
                            window.location.origin.startsWith('capacitor://') || 
                            window.location.origin.startsWith('file://');
        if (isCapacitor) {
            let savedUrl = localStorage.getItem('amvera_server_url') || 'https://lisichka-danilshavarin.amvera.io';
            if (savedUrl.endsWith('/')) {
                savedUrl = savedUrl.slice(0, -1);
            }
            return savedUrl + endpoint;
        }
        return endpoint;
    }

    function updateProfileUI() {
        const toggleBtn = document.getElementById('profile-toggle-btn');
        if (!toggleBtn) return;
        if (currentProfile === 'girl') {
            toggleBtn.textContent = '👦';
            toggleBtn.title = 'Профиль Дани';
        } else {
            toggleBtn.textContent = '👧';
            toggleBtn.title = 'Профиль Леры';
        }
    }

    const profileToggleBtn = document.getElementById('profile-toggle-btn');
    if (profileToggleBtn) {
        profileToggleBtn.addEventListener('click', () => {
            currentProfile = (currentProfile === 'girl') ? 'boy' : 'girl';
            localStorage.setItem('currentProfile', currentProfile);
            updateProfileUI();
            showToast(currentProfile === 'boy' ? 'Профиль Дани 👦' : 'Профиль Леры 👧');
            renderDashboard();
        });
    }

    // === ОФЛАЙН ХРАНИЛИЩЕ И СИНХРОНИЗАЦИЯ ===
    const LOCAL_CACHE_KEY = 'lisichka_planner_local_v1';
    const PENDING_SYNC_KEY = 'lisichka_pending_sync_dates';

    function getPendingSyncDates() {
        try {
            return JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || '[]');
        } catch (e) {
            return [];
        }
    }

    function addPendingSyncDate(dateKey) {
        const set = new Set(getPendingSyncDates());
        set.add(dateKey);
        localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(Array.from(set)));
        updateNetworkBadge();
    }

    function removePendingSyncDate(dateKey) {
        const set = new Set(getPendingSyncDates());
        set.delete(dateKey);
        localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(Array.from(set)));
        updateNetworkBadge();
    }

    function saveLocalCache() {
        try {
            localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(allData));
        } catch (e) {
            console.error('Ошибка записи локального кэша', e);
        }
    }

    function loadLocalCache() {
        try {
            const raw = localStorage.getItem(LOCAL_CACHE_KEY);
            if (raw) allData = JSON.parse(raw);
        } catch (e) {
            console.error('Ошибка чтения локального кэша', e);
        }
    }

    function updateNetworkBadge() {
        const badge = document.getElementById('network-status-badge');
        if (!badge) return;
        const isOnline = navigator.onLine;
        const pendingCount = getPendingSyncDates().length;

        badge.style.cursor = 'pointer'; // Делаем иконку кликабельной
        if (!isOnline || pendingCount > 0) {
            badge.textContent = '⚡';
            badge.title = isOnline ? 'Есть несинхронизированные локальные данные (Клик для настройки сервера)' : 'Режим офлайн (Клик для настройки сервера)';
        } else {
            badge.textContent = '🌐';
            badge.title = 'Подключено и синхронизировано (Клик для настройки сервера)';
        }
    }

    // Добавляем обработчик клика на индикатор сети для настройки адреса сервера
    const netBadge = document.getElementById('network-status-badge');
    if (netBadge) {
        netBadge.addEventListener('click', () => {
            const currentUrl = localStorage.getItem('amvera_server_url') || 'https://lisichka-danilshavarin.amvera.io';
            const newUrl = prompt('Введите адрес сервера Amvera для синхронизации:', currentUrl);
            if (newUrl !== null) {
                const trimmed = newUrl.trim();
                if (trimmed) {
                    localStorage.setItem('amvera_server_url', trimmed);
                    showToast('Адрес сервера изменен! Синхронизирую...');
                    loadData();
                }
            }
        });
    }

    window.addEventListener('online', () => {
        updateNetworkBadge();
        syncPendingData();
    });

    window.addEventListener('offline', updateNetworkBadge);

    async function syncPendingData() {
        if (!navigator.onLine) return;
        const pendingDates = getPendingSyncDates();
        if (pendingDates.length === 0) return;

        for (const dateKey of pendingDates) {
            if (allData[dateKey]) {
                try {
                    const res = await fetch(getApiUrl('/api/planner/data'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ date: dateKey, blocks: allData[dateKey] })
                    });
                    if (res.ok) {
                        removePendingSyncDate(dateKey);
                    }
                } catch (e) {
                    console.error('Ошибка фоновой синхронизации даты', dateKey, e);
                }
            }
        }
        updateNetworkBadge();
    }

    // === API CALLS & СИНХРОНИЗАЦИЯ ===
    async function loadData() {
        loadLocalCache();
        updateProfileUI();
        updateDateDisplay();
        updateNetworkBadge();

        if (navigator.onLine) {
            try {
                const res = await fetch(getApiUrl('/api/planner/data'));
                if (res.ok) {
                    const serverData = await res.json();
                    for (const [dKey, dBlocks] of Object.entries(serverData)) {
                        if (dKey.startsWith('__')) continue;
                        // Всегда записываем серверные данные в allData[dKey]
                        allData[dKey] = dBlocks;
                        // Мигрируем старый плоский формат в { girl, boy }
                        ensureProfileStructure(dKey);
                    }
                    saveLocalCache();
                    renderDashboard();
                }
            } catch (e) {
                console.error('Ошибка загрузки с сервера', e);
            }
            syncPendingData();
        }
    }

    function ensureProfileStructure(dateKey) {
        if (!allData[dateKey]) {
            allData[dateKey] = {
                girl: getEmptyDayData(),
                boy: getEmptyDayData()
            };
            return;
        }

        // Если пришел старый единичный формат без ключей girl/boy
        if (!allData[dateKey].girl && !allData[dateKey].boy) {
            const oldData = { ...allData[dateKey] };
            if (!oldData.customBlocks) oldData.customBlocks = [];
            allData[dateKey] = {
                girl: oldData,
                boy: getEmptyDayData()
            };
        } else {
            if (!allData[dateKey].girl) allData[dateKey].girl = getEmptyDayData();
            if (!allData[dateKey].boy) allData[dateKey].boy = getEmptyDayData();
            if (!allData[dateKey].girl.customBlocks) allData[dateKey].girl.customBlocks = [];
            if (!allData[dateKey].boy.customBlocks) allData[dateKey].boy.customBlocks = [];
        }
    }

    async function saveCurrentDayData() {
        const dateKey = formatDateKey(currentDate);
        ensureProfileStructure(dateKey);
        saveLocalCache();

        if (navigator.onLine) {
            try {
                const res = await fetch(getApiUrl('/api/planner/data'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: dateKey, blocks: allData[dateKey] })
                });
                if (res.ok) {
                    removePendingSyncDate(dateKey);
                } else {
                    addPendingSyncDate(dateKey);
                }
            } catch (e) {
                console.error('Ошибка сохранения на сервер', e);
                addPendingSyncDate(dateKey);
            }
        } else {
            addPendingSyncDate(dateKey);
        }
        updateNetworkBadge();
    }

    function getEmptyDayData() {
        return {
            sleepStart: "",
            sleepEnd: "",
            weightStart: "",
            weightEnd: "",
            meals: { breakfast: { text: "", done: false }, lunch: { text: "", done: false }, dinner: { text: "", done: false } },
            workout: { startTime: "", endTime: "", desc: "", walking: false, running: false, load: false },
            study: [],
            todos: [],
            customBlocks: [] // Кастомные блоки ТОЛЬКО для этого дня
        };
    }

    function getDayData() {
        const dateKey = formatDateKey(currentDate);
        ensureProfileStructure(dateKey);
        return allData[dateKey][currentProfile];
    }

    // === КОМПОНЕНТЫ UI ===
    function createCheckboxHtml(id, isChecked, labelHtml, dataAttrs = "") {
        const checkedStr = isChecked ? "checked" : "";
        return `
            <label class="check-item" for="${id}">
                <div class="custom-checkbox">
                    <input type="checkbox" id="${id}" ${checkedStr} ${dataAttrs}>
                    <div class="checkbox-box">
                        <svg class="checkbox-tick" viewBox="0 0 14 10">
                            <path d="M1 5L5 9L13 1"></path>
                        </svg>
                    </div>
                </div>
                ${labelHtml}
            </label>
        `;
    }

    // === РЕНДЕР ===
    function renderDashboard() {
        const container = document.getElementById('widgets-container');
        container.innerHTML = '';
        const data = getDayData();

        // 1. Сон
        container.innerHTML += `
            <div class="widget-card">
                <div class="widget-header" style="margin-bottom:10px;">
                    <span class="widget-icon">💤</span>
                    <h3 class="widget-title">Сон</h3>
                </div>
                <div style="display:flex; align-items:center; justify-content:center; gap:10px; color:#fff; font-weight:600; margin-bottom:10px;">
                    <span>С</span>
                    <input type="time" class="widget-input autosave" style="width: 110px; text-align:center;" data-field="sleepStart" value="${escapeHtml(data.sleepStart || "")}">
                    <span>До</span>
                    <input type="time" class="widget-input autosave" style="width: 110px; text-align:center;" data-field="sleepEnd" value="${escapeHtml(data.sleepEnd || "")}">
                </div>
                <div id="sleep-duration-display" style="font-size: 0.95rem; color: rgba(255,255,255,0.75); font-weight: 700; text-align:center;"></div>
            </div>
        `;

        // 2. Вес
        container.innerHTML += `
            <div class="widget-card">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="widget-icon">⚖️</span>
                    <div style="flex: 0 1 auto;">
                        <h3 class="widget-title" style="margin: 0 0 2px 0; font-size: 1rem;">Вес</h3>
                        <span style="font-size: 0.8rem; color: rgba(255,255,255,0.5); font-weight: 500;">Утреннее измерение</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-left: 30px;">
                        <input type="text" inputmode="decimal" class="widget-input autosave" data-field="weightStart" placeholder="—" value="${escapeHtml(data.weightStart || "")}" style="width: 130px; text-align: center; font-size: 1.1rem; font-weight: 700;">
                        <span style="font-size: 0.9rem; color: rgba(255,255,255,0.5); font-weight: 600;">кг</span>
                    </div>
                </div>
            </div>
        `;

        // 3. Питание
        container.innerHTML += `
            <div class="widget-card">
                <div class="widget-header" style="margin-bottom:10px;">
                    <span class="widget-icon">🍽️</span>
                    <h3 class="widget-title">Питание</h3>
                </div>
                <div class="checklist">
                    ${createCheckboxHtml('meal_breakfast', data.meals?.breakfast?.done,
            `<span class="check-label-text" style="flex:0 0 65px; margin-top:2px;">Завтрак:</span>
                         <textarea class="autosave" data-field="meals.breakfast.text" placeholder="Что ела?" rows="1">${escapeHtml(data.meals?.breakfast?.text || "")}</textarea>`,
            `data-field="meals.breakfast.done"`
        )}
                    ${createCheckboxHtml('meal_lunch', data.meals?.lunch?.done,
            `<span class="check-label-text" style="flex:0 0 65px; margin-top:2px;">Обед:</span>
                         <textarea class="autosave" data-field="meals.lunch.text" placeholder="Что ела?" rows="1">${escapeHtml(data.meals?.lunch?.text || "")}</textarea>`,
            `data-field="meals.lunch.done"`
        )}
                    ${createCheckboxHtml('meal_dinner', data.meals?.dinner?.done,
            `<span class="check-label-text" style="flex:0 0 65px; margin-top:2px;">Ужин:</span>
                         <textarea class="autosave" data-field="meals.dinner.text" placeholder="Что ела?" rows="1">${escapeHtml(data.meals?.dinner?.text || "")}</textarea>`,
            `data-field="meals.dinner.done"`
        )}
                </div>
            </div>
        `;

        // 4. Тренировки
        container.innerHTML += `
            <div class="widget-card">
                <div class="widget-header" style="margin-bottom:10px;">
                    <span class="widget-icon">🏋️‍♀️</span>
                    <h3 class="widget-title">Тренировки</h3>
                </div>
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <div style="display:flex; align-items:center; justify-content:center; gap:10px; color:#fff; font-weight:600;">
                        <span>С</span>
                        <input type="time" class="widget-input autosave" style="width: 110px; text-align:center;" data-field="workout.startTime" value="${escapeHtml(data.workout?.startTime || data.workout?.time || "")}">
                        <span>До</span>
                        <input type="time" class="widget-input autosave" style="width: 110px; text-align:center;" data-field="workout.endTime" value="${escapeHtml(data.workout?.endTime || "")}">
                    </div>
                    <div style="display:flex; align-items:center; justify-content:space-evenly; gap:8px; flex-wrap:wrap; padding: 4px 0;">
                        ${createCheckboxHtml('workout_walking', data.workout?.walking, `<span style="color:#fff; font-weight:600; font-size:0.9rem; cursor:pointer;">🚶‍♀️ Ходьба</span>`, `data-field="workout.walking"`)}
                        ${createCheckboxHtml('workout_running', data.workout?.running, `<span style="color:#fff; font-weight:600; font-size:0.9rem; cursor:pointer;">🏃‍♀️ Бег</span>`, `data-field="workout.running"`)}
                        ${createCheckboxHtml('workout_load', data.workout?.load, `<span style="color:#fff; font-weight:600; font-size:0.9rem; cursor:pointer;">🏋️‍♀️ Нагрузка</span>`, `data-field="workout.load"`)}
                    </div>
                    <textarea class="autosave" data-field="workout.desc" placeholder="Описание (напр. Силовая, Йога)" rows="1" style="width:100%; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 12px 15px; color: #fff; font-family: inherit; font-size: 1rem; resize: none; overflow:hidden; outline:none;">${escapeHtml(data.workout?.desc || "")}</textarea>
                </div>
            </div>
        `;

        // 4. Учеба
        let studyHtml = (data.study || []).map((item, idx) => `
            <div style="display:flex; align-items:center; width:100%">
                ${createCheckboxHtml(`study_${idx}`, item.done,
            `<textarea class="autosave-arr" data-arr="study" data-idx="${idx}" data-key="task" placeholder="Задача..." rows="1">${escapeHtml(item.task || "")}</textarea>`,
            `data-arr="study" data-idx="${idx}" data-key="done"`
        )}
                <button class="delete-todo-btn" data-arr="study" data-idx="${idx}">×</button>
            </div>
        `).join('');

        container.innerHTML += `
            <div class="widget-card">
                <div class="widget-header" style="margin-bottom:10px;">
                    <span class="widget-icon">📚</span>
                    <h3 class="widget-title">Учеба</h3>
                </div>
                <div class="checklist" id="study-list">
                    ${studyHtml}
                </div>
                <button class="add-todo-btn" data-arr="study">+ Добавить задачу</button>
            </div>
        `;

        // 5. Планы на день
        let todosHtml = (data.todos || []).map((item, idx) => `
            <div style="display:flex; align-items:center; width:100%">
                ${createCheckboxHtml(`todo_${idx}`, item.done,
            `<textarea class="autosave-arr" data-arr="todos" data-idx="${idx}" data-key="task" placeholder="Задача..." rows="1">${escapeHtml(item.task || "")}</textarea>`,
            `data-arr="todos" data-idx="${idx}" data-key="done"`
        )}
                <button class="delete-todo-btn" data-arr="todos" data-idx="${idx}">×</button>
            </div>
        `).join('');

        container.innerHTML += `
            <div class="widget-card">
                <div class="widget-header" style="margin-bottom:10px;">
                    <span class="widget-icon">✨</span>
                    <h3 class="widget-title">Планы на день</h3>
                </div>
                <div class="checklist" id="todos-list">
                    ${todosHtml}
                </div>
                <button class="add-todo-btn" data-arr="todos">+ Добавить задачу</button>
            </div>
        `;

        // 6. СВОИ КАТЕГОРИИ (Привязанные только к текущему дню)
        data.customBlocks.forEach((block, idx) => {
            let catContent = "";
            const isChecked = block.done === true;

            if (block.type === 'text') {
                // Если тип Текст, делаем галочку и под ней большое поле для ввода
                catContent = `
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        ${createCheckboxHtml(`custom_done_${block.id}`, isChecked,
                    `<span class="check-label-text">Выполнено</span>`,
                    `class="autosave-custom-check" data-idx="${idx}"`
                )}
                        <textarea class="widget-input autosave-custom-text" data-idx="${idx}" placeholder="Пиши здесь..." style="min-height: 60px; resize: vertical;">${escapeHtml(block.text || "")}</textarea>
                    </div>
                `;
            } else if (block.type === 'checkbox') {
                // Простая галочка
                catContent = createCheckboxHtml(`custom_check_${block.id}`, isChecked,
                    `<span class="check-label-text">Выполнено</span>`,
                    `class="autosave-custom-check" data-idx="${idx}"`
                );
            }

            container.innerHTML += `
                <div class="widget-card">
                    <button class="delete-custom-btn" data-idx="${idx}" title="Удалить категорию">🗑️</button>
                    <div class="widget-header" style="margin-bottom:10px;">
                        <span class="widget-icon">📌</span>
                        <h3 class="widget-title">${escapeHtml(block.name || "")}</h3>
                    </div>
                    ${catContent}
                </div>
            `;
        });

        updateSleepDuration();
        attachEvents();
    }

    // === ОБРАБОТЧИКИ СОБЫТИЙ ===
    function attachEvents() {
        const data = getDayData();

        // Слушаем изменения времени сна для моментального подсчета
        document.querySelectorAll('input[data-field="sleepStart"], input[data-field="sleepEnd"]').forEach(el => {
            el.addEventListener('input', updateSleepDuration);
        });

        // Простые поля (Сон, Тренировка, Питание.text)
        document.querySelectorAll('.autosave').forEach(el => {
            if (el.tagName === 'TEXTAREA') {
                el.style.height = 'auto';
                el.style.height = el.scrollHeight + 'px';
                el.addEventListener('input', function () {
                    this.style.height = 'auto';
                    this.style.height = this.scrollHeight + 'px';
                });
            }

            el.addEventListener('blur', (e) => {
                const keys = e.target.getAttribute('data-field').split('.');
                if (keys.length === 1) data[keys[0]] = e.target.value;
                if (keys.length === 2) {
                    if (!data[keys[0]]) data[keys[0]] = {};
                    data[keys[0]][keys[1]] = e.target.value;
                }
                if (keys.length === 3) {
                    if (!data[keys[0]]) data[keys[0]] = {};
                    if (!data[keys[0]][keys[1]]) data[keys[0]][keys[1]] = {};
                    data[keys[0]][keys[1]][keys[2]] = e.target.value;
                }
                saveCurrentDayData();
            });
        });

        // Чекбоксы простых полей (Питание, Тренировки и т.д.)
        document.querySelectorAll('input[type="checkbox"][data-field]').forEach(el => {
            el.addEventListener('change', (e) => {
                const keys = e.target.getAttribute('data-field').split('.');
                if (keys.length === 1) data[keys[0]] = e.target.checked;
                if (keys.length === 2) {
                    if (!data[keys[0]]) data[keys[0]] = {};
                    data[keys[0]][keys[1]] = e.target.checked;
                }
                if (keys.length === 3) {
                    if (!data[keys[0]]) data[keys[0]] = {};
                    if (!data[keys[0]][keys[1]]) data[keys[0]][keys[1]] = {};
                    data[keys[0]][keys[1]][keys[2]] = e.target.checked;
                }
                if (e.target.checked) showToast('Отлично! ✅');
                saveCurrentDayData();
            });
        });

        // Массивы (Учеба, Планы)
        document.querySelectorAll('.add-todo-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const arrName = e.target.getAttribute('data-arr');
                if (!data[arrName]) data[arrName] = [];
                data[arrName].push({ task: "", done: false });
                renderDashboard();
                saveCurrentDayData();
            });
        });

        document.querySelectorAll('.delete-todo-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const arrName = e.target.getAttribute('data-arr');
                const idx = parseInt(e.target.getAttribute('data-idx'));
                data[arrName].splice(idx, 1);
                renderDashboard();
                saveCurrentDayData();
            });
        });

        document.querySelectorAll('.autosave-arr').forEach(el => {
            // Авто-высота под контент
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';

            el.addEventListener('input', function () {
                this.style.height = 'auto';
                this.style.height = this.scrollHeight + 'px';
            });

            el.addEventListener('blur', (e) => {
                const arrName = e.target.getAttribute('data-arr');
                const idx = parseInt(e.target.getAttribute('data-idx'));
                const key = e.target.getAttribute('data-key');
                data[arrName][idx][key] = e.target.value;
                saveCurrentDayData();
            });
        });

        document.querySelectorAll('input[type="checkbox"][data-arr]').forEach(el => {
            el.addEventListener('change', (e) => {
                const arrName = e.target.getAttribute('data-arr');
                const idx = parseInt(e.target.getAttribute('data-idx'));
                const key = e.target.getAttribute('data-key');
                data[arrName][idx][key] = e.target.checked;
                if (e.target.checked) showToast('Сделано! ✅');
                saveCurrentDayData();
            });
        });

        // --- Кастомные категории текущего дня ---
        document.querySelectorAll('.autosave-custom-check').forEach(el => {
            el.addEventListener('change', (e) => {
                const idx = parseInt(e.target.getAttribute('data-idx'));
                data.customBlocks[idx].done = e.target.checked;
                if (e.target.checked) showToast('Класс! ✅');
                saveCurrentDayData();
            });
        });

        document.querySelectorAll('.autosave-custom-text').forEach(el => {
            // Авто-высота под контент
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';

            el.addEventListener('input', function () {
                this.style.height = 'auto';
                this.style.height = this.scrollHeight + 'px';
            });

            el.addEventListener('blur', (e) => {
                const idx = parseInt(e.target.getAttribute('data-idx'));
                data.customBlocks[idx].text = e.target.value;
                saveCurrentDayData();
            });
        });

        document.querySelectorAll('.delete-custom-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-idx'));
                data.customBlocks.splice(idx, 1);
                renderDashboard();
                saveCurrentDayData();
            });
        });
    }

    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function updateSleepDuration() {
        const startInput = document.querySelector('input[data-field="sleepStart"]');
        const endInput = document.querySelector('input[data-field="sleepEnd"]');
        const display = document.getElementById('sleep-duration-display');
        if (!startInput || !endInput || !display) return;

        const startVal = startInput.value;
        const endVal = endInput.value;

        if (!startVal || !endVal) {
            display.textContent = "";
            return;
        }

        const [startH, startM] = startVal.split(':').map(Number);
        const [endH, endM] = endVal.split(':').map(Number);

        const startTotal = startH * 60 + startM;
        const endTotal = endH * 60 + endM;

        let diff = endTotal - startTotal;
        if (diff < 0) {
            diff += 24 * 60; // crossed midnight
        }

        const diffHours = Math.floor(diff / 60);
        const diffMins = diff % 60;

        let durationText = `Время сна: ${diffHours} ч.`;
        if (diffMins > 0) {
            durationText += ` ${diffMins} мин.`;
        }
        display.textContent = durationText;
    }

    // === МОДАЛКА СОЗДАНИЯ СВОЕЙ КАТЕГОРИИ ===
    const modal = document.getElementById('create-category-modal');
    const btnAdd = document.getElementById('btn-add-category');
    const btnCancel = document.getElementById('btn-cancel-category');
    const btnSave = document.getElementById('btn-save-category');
    const inputName = document.getElementById('category-name');
    const typeBtns = document.querySelectorAll('.type-btn');

    let selectedType = 'checkbox';

    btnAdd.addEventListener('click', () => {
        document.body.classList.add('modal-open');
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        inputName.value = '';
        inputName.focus();
    });

    btnCancel.addEventListener('click', () => {
        document.body.classList.remove('modal-open');
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    });

    typeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            typeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedType = btn.getAttribute('data-type');
        });
    });

    btnSave.addEventListener('click', () => {
        const name = inputName.value.trim();
        if (!name) {
            showToast('⚠️ Напиши название');
            return;
        }

        const data = getDayData();
        data.customBlocks.push({
            id: 'cat_' + Date.now(),
            name: name,
            type: selectedType,
            done: false,
            text: ""
        });

        saveCurrentDayData();
        renderDashboard();
        btnCancel.click();
        showToast('Категория добавлена на этот день! ✨');
    });

    // === TOAST NOTIFICATIONS ===
    function showToast(message) {
        const container = document.getElementById("toast-container");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = "toast";
        toast.textContent = message;
        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add("show");
        });

        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 400);
        }, 3000);
    }

    // Инициализация
    window.SharedAudio.init();
    loadData();
});
