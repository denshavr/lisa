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

    // === СОСТОЯНИЕ ===
    let allData = {}; // из planner_data.json

    // === API CALLS ===
    async function loadData() {
        try {
            const res = await fetch('/api/planner/data');
            if (res.ok) allData = await res.json();
        } catch (e) {
            console.error('Ошибка загрузки', e);
        }
        updateDateDisplay();
    }

    async function saveCurrentDayData() {
        const dateKey = formatDateKey(currentDate);
        const dayData = allData[dateKey] || getEmptyDayData();
        try {
            await fetch('/api/planner/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: dateKey, blocks: dayData })
            });
        } catch (e) {
            console.error('Ошибка сохранения данных', e);
        }
    }

    function getEmptyDayData() {
        return {
            sleepStart: "",
            sleepEnd: "",
            weightStart: "",
            weightEnd: "",
            meals: { breakfast: { text: "", done: false }, lunch: { text: "", done: false }, dinner: { text: "", done: false } },
            workout: { startTime: "", endTime: "", desc: "" },
            study: [],
            todos: [],
            customBlocks: [] // Кастомные блоки ТОЛЬКО для этого дня
        };
    }

    function getDayData() {
        const dateKey = formatDateKey(currentDate);
        if (!allData[dateKey]) {
            allData[dateKey] = getEmptyDayData();
        }
        // Защита от старых данных без customBlocks
        if (!allData[dateKey].customBlocks) {
            allData[dateKey].customBlocks = [];
        }
        return allData[dateKey];
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
                <div style="display:flex; align-items:center; gap:10px; color:#fff; font-weight:600; margin-bottom:10px;">
                    <span>С</span>
                    <input type="time" class="widget-input autosave" style="width: 110px;" data-field="sleepStart" value="${escapeHtml(data.sleepStart || "")}">
                    <span>До</span>
                    <input type="time" class="widget-input autosave" style="width: 110px;" data-field="sleepEnd" value="${escapeHtml(data.sleepEnd || "")}">
                </div>
                <div id="sleep-duration-display" style="font-size: 0.95rem; color: rgba(255,255,255,0.75); font-weight: 700;"></div>
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
                <div class="widget-header">
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
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <div style="display:flex; align-items:center; gap:8px; color:#fff; font-weight:600;">
                        <span>С</span>
                        <input type="time" class="widget-input autosave" style="width: 110px;" data-field="workout.startTime" value="${escapeHtml(data.workout?.startTime || data.workout?.time || "")}">
                        <span>До</span>
                        <input type="time" class="widget-input autosave" style="width: 110px;" data-field="workout.endTime" value="${escapeHtml(data.workout?.endTime || "")}">
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
                <div class="widget-header">
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
                <div class="widget-header">
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

        // Чекбоксы простых полей (Питание)
        document.querySelectorAll('input[type="checkbox"][data-field]').forEach(el => {
            el.addEventListener('change', (e) => {
                const keys = e.target.getAttribute('data-field').split('.');
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
    loadData();
});
