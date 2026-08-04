(function () {
    'use strict';

    // ==========================================
    // API CONFIGURATION
    // ==========================================
    const isCapacitor = window.hasOwnProperty('Capacitor');

    function getApiUrl(endpoint) {
        if (isCapacitor) {
            let savedUrl = localStorage.getItem('amvera_server_url') || 'https://lisichka-danilshavarin.amvera.io';
            if (savedUrl.endsWith('/')) {
                savedUrl = savedUrl.slice(0, -1);
            }
            return savedUrl + endpoint;
        }
        return endpoint;
    }

    // ==========================================
    // STATE & CACHE
    // ==========================================
    const STATE = {
        currentProfile: localStorage.getItem('lisa_user_profile') || 'boy', // 'boy' or 'girl'
        currentTab: 'films', // 'films', 'series', 'anime'
        movies: [], // list of movie objects
        isOnline: navigator.onLine
    };

    // Load user profile and update button
    const profileToggleBtn = document.getElementById('profile-toggle-btn');
    function updateProfileUI() {
        if (profileToggleBtn) {
            profileToggleBtn.textContent = STATE.currentProfile === 'boy' ? '👦' : '👧';
            profileToggleBtn.title = STATE.currentProfile === 'boy' ? 'Профиль: Даня' : 'Профиль: Лера';
        }
        const addMovieTitle = document.getElementById('add-movie-title');
        if (addMovieTitle) {
            addMovieTitle.textContent = STATE.currentProfile === 'boy'
                ? 'Киношка от Дани 👦'
                : 'Киношка от Леры 👧';
        }
    }

    if (profileToggleBtn) {
        profileToggleBtn.addEventListener('click', () => {
            STATE.currentProfile = STATE.currentProfile === 'boy' ? 'girl' : 'boy';
            localStorage.setItem('lisa_user_profile', STATE.currentProfile);
            updateProfileUI();
            showToast(`Профиль изменен на: ${STATE.currentProfile === 'boy' ? 'Даня 👦' : 'Лера 👧'}`);
            renderMovies();
        });
    }
    updateProfileUI();

    // ==========================================
    // TOAST NOTIFICATIONS
    // ==========================================
    const toastContainer = document.getElementById('toast-container');
    function showToast(message, isGolden = false) {
        if (!toastContainer) return;
        while (toastContainer.children.length >= 2) {
            toastContainer.firstElementChild.remove();
        }
        const toast = document.createElement('div');
        toast.className = 'toast';
        if (isGolden) {
            toast.style.borderColor = 'rgba(255, 75, 114, 0.5)';
            toast.style.background = 'rgba(80, 0, 40, 0.65)';
            toast.style.boxShadow = '0 8px 32px rgba(255, 75, 114, 0.25), inset 0 1px 0 rgba(255,255,255,0.1)';
        }
        toast.innerHTML = message;
        toastContainer.appendChild(toast);

        toast.addEventListener('animationend', () => {
            toast.style.animation = 'none';
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0) scale(1)';
        }, { once: true });

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 700);
        }, 2550);
    }

    // ==========================================
    // NETWORK STATUS
    // ==========================================
    const networkStatusBadge = document.getElementById('network-status-badge');

    function updateNetworkBadge() {
        if (!networkStatusBadge) return;
        STATE.isOnline = navigator.onLine;
        if (STATE.isOnline) {
            networkStatusBadge.textContent = '🌐';
            networkStatusBadge.title = 'Онлайн. Синхронизация работает.';
            networkStatusBadge.style.color = '#10b981';
        } else {
            networkStatusBadge.textContent = '⚡';
            networkStatusBadge.title = 'Офлайн. Работаем локально.';
            networkStatusBadge.style.color = '#f59e0b';
        }
    }

    window.addEventListener('online', () => {
        updateNetworkBadge();
        syncWithServer();
    });
    window.addEventListener('offline', updateNetworkBadge);

    if (networkStatusBadge) {
        networkStatusBadge.addEventListener('click', () => {
            if (isCapacitor) {
                const currentServer = localStorage.getItem('amvera_server_url') || 'https://lisichka-danilshavarin.amvera.io';
                const newServer = prompt('Настройка адреса сервера синхронизации Amvera:', currentServer);
                if (newServer !== null && newServer.trim() !== '') {
                    localStorage.setItem('amvera_server_url', newServer.trim());
                    showToast('Адрес сервера сохранен!', true);
                    syncWithServer();
                }
            } else {
                showToast('Синхронизация активна 🌐');
            }
        });
    }
    updateNetworkBadge();

    // ==========================================
    // LOCAL DATA CONTROLLER
    // ==========================================
    function loadLocalCache() {
        const cached = localStorage.getItem('lisichka_movies_local_v1');
        if (cached) {
            try {
                STATE.movies = JSON.parse(cached);
            } catch (e) {
                STATE.movies = [];
            }
        }
    }

    function saveLocalCache() {
        localStorage.setItem('lisichka_movies_local_v1', JSON.stringify(STATE.movies));
    }

    // ==========================================
    // SYNC STATE
    // ==========================================
    async function syncWithServer() {
        if (!navigator.onLine) return;
        try {
            // 1. Получаем список с сервера
            const res = await fetch(getApiUrl('/api/planner/data'));
            if (res.ok) {
                const allData = await res.json();
                const serverMovies = allData['__movies__'] || [];

                // Простейшее слияние: если локально пусто, берем серверное, иначе оставляем локальное
                // (или можно мержить по уникальным ID)
                if (STATE.movies.length === 0 && serverMovies.length > 0) {
                    STATE.movies = serverMovies;
                    saveLocalCache();
                    renderMovies();
                } else {
                    // Отправляем локальные данные на сервер
                    await pushToServer();
                }
            }
        } catch (e) {
            console.error('Ошибка синхронизации киношки:', e);
        }
    }

    async function pushToServer() {
        if (!navigator.onLine) return;
        try {
            await fetch(getApiUrl('/api/planner/data'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: '__movies__',
                    blocks: STATE.movies
                })
            });
        } catch (e) {
            console.error('Не удалось сохранить киношку на сервере:', e);
        }
    }

    // ==========================================
    // RENDER CONTROLLER
    // ==========================================
    const listContainer = document.getElementById('movies-list-container');

    function createFallbackPoster(movie) {
        const fallback = document.createElement('div');
        fallback.className = 'movie-poster-fallback';
        
        const icon = document.createElement('div');
        icon.className = 'movie-poster-fallback-icon';
        icon.textContent = movie.category === 'films' ? '🎬' : (movie.category === 'series' ? '🍿' : '⛩️');
        fallback.appendChild(icon);

        const title = document.createElement('div');
        title.className = 'movie-poster-fallback-title';
        title.textContent = movie.title;
        fallback.appendChild(title);

        return fallback;
    }

    function addCardControls(cardEl, movie) {
        // Контролы вверху (Чекбокс + Удалить)
        const topControls = document.createElement('div');
        topControls.className = 'movie-card-top-controls';

        // Круглый чекбокс
        const checkbox = document.createElement('div');
        checkbox.className = `movie-card-checkbox ${movie.watched ? 'checked' : ''}`;
        checkbox.innerHTML = '✓';
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            movie.watched = !movie.watched;
            saveLocalCache();
            renderMovies();
            pushToServer();
        });
        topControls.appendChild(checkbox);

        // Кнопка удаления
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'movie-card-delete';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Удалить';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Удалить "${movie.title}" из списка?`)) {
                STATE.movies = STATE.movies.filter(m => m.id !== movie.id);
                saveLocalCache();
                renderMovies();
                pushToServer();
                showToast('Предложение удалено 💔');
            }
        });
        topControls.appendChild(deleteBtn);

        cardEl.appendChild(topControls);

        // Информационный оверлей внизу
        const info = document.createElement('div');
        info.className = 'movie-card-info';

        const titleContainer = document.createElement('div');
        titleContainer.className = 'movie-card-title-container';

        if (movie.link && movie.link.trim() !== '') {
            const link = document.createElement('a');
            link.href = movie.link;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'movie-card-title-text movie-card-title-link';
            link.textContent = movie.title;
            titleContainer.appendChild(link);
        } else {
            const text = document.createElement('span');
            text.className = 'movie-card-title-text';
            text.textContent = movie.title;
            titleContainer.appendChild(text);
        }
        info.appendChild(titleContainer);

        // Инициалы предложившего
        const author = document.createElement('span');
        author.className = `movie-card-author ${movie.addedBy}`;
        author.textContent = movie.addedBy === 'girl' ? 'Лера' : 'Даня';
        info.appendChild(author);

        cardEl.appendChild(info);
    }

    function renderMovies() {
        if (!listContainer) return;
        listContainer.innerHTML = '';

        // Фильтруем фильмы текущей вкладки
        const filtered = STATE.movies.filter(m => m.category === STATE.currentTab);

        if (filtered.length === 0) {
            listContainer.innerHTML = `<div class="empty-movies">Здесь пока ничего нет 🥺<br>Добавьте первый фильм!</div>`;
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'movies-grid';

        filtered.forEach(movie => {
            const cardEl = document.createElement('div');
            cardEl.className = `movie-card ${movie.watched ? 'watched' : ''}`;

            // Постер или его замена
            if (movie.poster && movie.poster.trim() !== '') {
                const img = document.createElement('img');
                img.className = 'movie-poster-img';
                img.src = movie.poster;
                img.alt = movie.title;
                img.loading = 'lazy';
                img.onerror = () => {
                    cardEl.innerHTML = '';
                    cardEl.appendChild(createFallbackPoster(movie));
                    addCardControls(cardEl, movie);
                };
                cardEl.appendChild(img);
            } else {
                cardEl.appendChild(createFallbackPoster(movie));
            }

            addCardControls(cardEl, movie);
            grid.appendChild(cardEl);
        });

        listContainer.appendChild(grid);
    }

    // ==========================================
    // ТАБЫ (ВКЛАДКИ)
    // ==========================================
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            STATE.currentTab = btn.getAttribute('data-tab');
            renderMovies();
        });
    });

    // ==========================================
    // ДОБАВЛЕНИЕ ФИЛЬМА
    // ==========================================
    const addBtn = document.getElementById('btn-add-movie');
    const titleInput = document.getElementById('movie-title');
    const linkInput = document.getElementById('movie-link');
    const categorySelect = document.getElementById('movie-category');

    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            const title = titleInput.value.trim();
            const link = linkInput.value.trim();
            const category = categorySelect.value;

            if (!title) {
                showToast('Пожалуйста, введите название фильма!');
                return;
            }

            addBtn.disabled = true;
            const originalText = addBtn.innerHTML;
            addBtn.innerHTML = 'Поиск...';

            let posterUrl = '';

            // 1. Пытаемся получить превью/постер автоматически через серверный парсер (VK Video, YouTube и др.)
            if (link) {
                try {
                    const metadataUrl = getApiUrl(`/api/metadata/poster?url=${encodeURIComponent(link)}`);
                    const metaResponse = await fetch(metadataUrl);
                    if (metaResponse.ok) {
                        const metaData = await metaResponse.json();
                        if (metaData && metaData.posterUrl) {
                            posterUrl = metaData.posterUrl;
                        }
                    }
                } catch (e) {
                    console.error('Ошибка получения обложки с сервера:', e);
                }
            }

            // 2. Если постер не найден по ссылке, выполняем поиск в iTunes API с обходом регионов
            if (!posterUrl) {
                try {
                    const searchQueries = [
                        `https://itunes.apple.com/search?term=${encodeURIComponent(title)}&entity=movie&limit=1&country=ru`,
                        `https://itunes.apple.com/search?term=${encodeURIComponent(title)}&entity=tvShow&limit=1&country=ru`,
                        `https://itunes.apple.com/search?term=${encodeURIComponent(title)}&entity=movie&limit=1&country=us`,
                        `https://itunes.apple.com/search?term=${encodeURIComponent(title)}&entity=tvShow&limit=1&country=us`
                    ];

                    for (const url of searchQueries) {
                        const response = await fetch(url);
                        if (response.ok) {
                            const data = await response.json();
                            if (data.results && data.results.length > 0) {
                                const rawUrl = data.results[0].artworkUrl100;
                                if (rawUrl) {
                                    posterUrl = rawUrl.replace('100x100bb.jpg', '600x600bb.jpg');
                                    break;
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('Ошибка при поиске постера:', e);
                }
            }

            const newMovie = {
                id: Date.now(),
                title,
                link,
                category,
                addedBy: STATE.currentProfile,
                watched: false,
                poster: posterUrl
            };

            STATE.movies.push(newMovie);
            saveLocalCache();
            renderMovies();
            pushToServer();

            addBtn.disabled = false;
            addBtn.innerHTML = originalText;
            titleInput.value = '';
            linkInput.value = '';

            showToast('Предложение успешно добавлено! ❤️', true);
        });
    }

    // ==========================================
    // CANVAS ANIMATION BACKGROUND
    // ==========================================
    const canvas = document.getElementById("background-canvas");
    if (canvas) {
        const ctx = canvas.getContext("2d");
        let canvasWidth = (canvas.width = window.innerWidth);
        let canvasHeight = (canvas.height = window.innerHeight);

        window.addEventListener("resize", () => {
            canvasWidth = canvas.width = window.innerWidth;
            canvasHeight = canvas.height = window.innerHeight;
        });

        const emojiList = ["❤️", "💖", "💕", "✨", "🌸", "🥰", "😊", "🍿", "🎬", "📺", "🍿", "🍡", "🌸"];
        const floatingEmojis = [];

        // Создаем начальные смайлики
        const maxEmojiCount = 25;
        for (let i = 0; i < maxEmojiCount; i++) {
            floatingEmojis.push({
                x: Math.random() * canvasWidth,
                y: Math.random() * canvasHeight - canvasHeight,
                size: Math.floor(Math.random() * 16 + 16),
                speed: Math.random() * 1.5 + 0.8,
                wind: Math.random() * 1 - 0.5,
                opacity: Math.random() * 0.5 + 0.3,
                emoji: emojiList[Math.floor(Math.random() * emojiList.length)],
                angle: Math.random() * Math.PI * 2
            });
        }

        function drawEmojiParticle(ctx, x, y, size, emoji, opacity) {
            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(emoji, x, y);
            ctx.restore();
        }

        function animate() {
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);

            // Восходящие/падающие смайлики
            for (let i = 0; i < floatingEmojis.length; i++) {
                const p = floatingEmojis[i];
                drawEmojiParticle(ctx, p.x, p.y, p.size, p.emoji, p.opacity);

                p.y += p.speed;
                p.x += Math.sin(p.angle) * 0.3 + p.wind * 0.2;
                p.angle += 0.02;

                if (p.y > canvasHeight) {
                    p.y = -p.size;
                    p.x = Math.random() * canvasWidth;
                    p.speed = Math.random() * 1.5 + 0.8;
                }
            }
            requestAnimationFrame(animate);
        }
        animate();
    }

    // ==========================================
    // AUDIO CONTROLLER (VIA SHAREDAUDIO)
    // ==========================================
    window.SharedAudio.init();



    // ==========================================
    // INITIALIZATION
    // ==========================================
    loadLocalCache();
    renderMovies();
    syncWithServer();

})();
