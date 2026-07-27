// Ждем полной загрузки DOM
document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // НАСТРОЙКИ И СОСТОЯНИЕ
    // ==========================================
    
    const STATE = {
        currentScreen: 'loader', // loader, question, time, final
        selectedHour: 19,
        selectedMinute: 30,
        noHoverCount: 0,
        mobileTapCount: 0,
        heartSpeedMultiplier: 1.0,
        easterEggTimers: []
    };

    // ==========================================
    // ФОТО-ФОН: БЕСШОВНАЯ СМЕНА ИЗОБРАЖЕНИЙ (2 СЛОЯ)
    // ==========================================

    const bgA = document.getElementById('bg-a');
    const bgB = document.getElementById('bg-b');

    // Актуальный список фото из папки photos/
    const photoList = [
        '2_gWBLFu2d81L31sVHw-GkND7yvTIgA0EAhbRLBxmOloALDffSUmX3X-pPKUkM9FSgQnyZSsnH60uH98Okzz2Vwx.jpg',
        '8Rbjhoc2X0_hi8DrIynRf8ATFKGc_UM1_rU-1Fz-lBHbUoXe7veqazv3kKCud3Ch6lcqiFxYVtUvUgZDk-Hx_StB.jpg',
        'F-iTQX_FtdZUCzOZSC0GsbqlNLCXn7WzP6fflsiszzlj6Vn-egg5yg_dScHzDDcgphkSXCJx_An_14ZEKqAhgXtT.jpg',
        'U_JPKR14z8J2dX_kwR4alstmb-3_OFobnnPOtQEOvRI3E8dG0Bg9i-9VGIHlKGDhlKRvhuaDiCcw5xQL5b2omYQz.jpg',
        '_Y_1RpFARWzzfqvd8UhnzjnqwW5EHcaaKL6M_LdDYyvt6hKxdliJZBGLzoKCGiR-nNComIXSWQTIPUInvU2KCq8O.jpg',
        'qPkIQBSteXcYCvfSXFbgwKPjGzq_ACCAwu7HumDWw0xRnSMBwkM9S0R1VPfNjO6k0GtZMH0f0Vw_QacBgPqtqLkN.jpg'
    ].map(f => `photos/${f}`);

    let currentPhotoIndex = 0;
    let activeBgLayer = 'a';

    async function initPhotoBackground() {
        if (photoList.length === 0) return;
        const shuffled = [...photoList].sort(() => Math.random() - 0.5);

        // Устанавливаем первое фото на слой A
        if (bgA) {
            bgA.style.backgroundImage = `url('${shuffled[0]}')`;
            bgA.style.opacity = '1';
        }
        if (bgB) {
            bgB.style.opacity = '0';
        }

        // Переключение через перекрёстный кроссфейд каждые 7 секунд
        if (shuffled.length > 1) {
            setInterval(() => {
                currentPhotoIndex = (currentPhotoIndex + 1) % shuffled.length;
                const nextPhoto = shuffled[currentPhotoIndex];

                if (activeBgLayer === 'a') {
                    if (bgB) {
                        bgB.style.backgroundImage = `url('${nextPhoto}')`;
                        bgB.style.opacity = '1';
                    }
                    if (bgA) bgA.style.opacity = '0';
                    activeBgLayer = 'b';
                } else {
                    if (bgA) {
                        bgA.style.backgroundImage = `url('${nextPhoto}')`;
                        bgA.style.opacity = '1';
                    }
                    if (bgB) bgB.style.opacity = '0';
                    activeBgLayer = 'a';
                }
            }, 7000);
        }
    }

    initPhotoBackground();

    // Варианты главного вопроса (случайный выбор при каждом запуске)
    const questionVariants = [
        "Ты готова провести сегодня время со мной?",
        "Может, сегодня встретимся? ❤️",
        "Хочешь провести время вместе сегодня?",
        "Ты свободна сегодня вечером? 🥺",
        "Пойдём гулять? ❤️",
        "Готова к небольшому свиданию?"
    ];
    const chosenQuestion = questionVariants[Math.floor(Math.random() * questionVariants.length)];


    // Списки текстов для кнопки "Нет" (десктоп)
    const noButtonTexts = [
        "Не-а",
        "Ты уверена?",
        "Подумай ещё 😄",
        "Не получится",
        "Промахнулась",
        "Ай-ай-ай",
        "Не сюда",
        "Хи-хи",
        "Ну пожалуйста 🥺"
    ];

    // Списки сообщений для Toasts (десктоп)
    const desktopToasts = [
        "😄 Хорошая попытка",
        "🙃 Нет-нет-нет",
        "👀 Почти получилось",
        "🏃 Я быстрее",
        "😂 Не поймаешь",
        "❤️ Кнопка сопротивляется",
        "😁 Не туда",
        "✨ Попробуй ещё",
        "🤭 Думаешь получится?",
        "🙈 Даже не мечтай"
    ];

    // Случайные финальные фразы
    const finalPhrases = [
        "😊 Уже начинаю радоваться.",
        "❤️ До встречи!",
        "🥹 Не заставляй долго ждать.",
        "☕ Надеюсь, будет вкусный кофе.",
        "✨ Сегодня будет хороший день.",
        "😁 Уже улыбаюсь.",
        "❤️ Спасибо, что сказала \"Да\".",
        "🌸 Ты сделала этот день лучше."
    ];

    // ==========================================
    // DOM ЭЛЕМЕНТЫ
    // ==========================================
    
    const card = document.getElementById("app-card");
    const screenLoader = document.getElementById("screen-loader");
    const screenQuestion = document.getElementById("screen-question");
    const screenTime = document.getElementById("screen-time");
    const screenFinal = document.getElementById("screen-final");
    
    const btnYes = document.getElementById("btn-yes");
    const btnNo = document.getElementById("btn-no");
    const btnConfirm = document.getElementById("btn-confirm");
    
    const hourVal = document.getElementById("hour-val");
    const minuteVal = document.getElementById("minute-val");
    const hourPlus = document.getElementById("hour-plus");
    const hourMinus = document.getElementById("hour-minus");
    const minutePlus = document.getElementById("minute-plus");
    const minuteMinus = document.getElementById("minute-minus");
    const timePreview = document.getElementById("time-preview");

    const toastContainer = document.getElementById("toast-container");
    
    const errorModal = document.getElementById("error-modal");
    const btnModalClose = document.getElementById("btn-modal-close");

    // ==========================================
    // ВСПЛЫВАЮЩИЕ УВЕДОМЛЕНИЯ (TOASTS)
    // ==========================================
    
    function showToast(message, isGolden = false) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        if (isGolden) {
            toast.style.borderColor = 'rgba(255, 75, 114, 0.5)';
            toast.style.background = 'rgba(80, 0, 40, 0.65)';
            toast.style.boxShadow = '0 8px 32px rgba(255, 75, 114, 0.25), inset 0 1px 0 rgba(255,255,255,0.1)';
        }
        toast.innerHTML = message;
        toastContainer.appendChild(toast);

        // После окончания анимации появления — фиксируем конечное состояние явно,
        // иначе при animation: none элемент вернётся к opacity: 0 из CSS
        toast.addEventListener('animationend', () => {
            toast.style.animation = 'none';
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0) scale(1)';
            toast.style.filter = 'none';
        }, { once: true });

        // Анимация появления ~0.55с + 2с видимости = 2550мс до начала fade-out
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 700);
        }, 2550);
    }

    // ==========================================
    // ЭФФЕКТ ПЕЧАТАЮЩЕГОСЯ ТЕКСТА (TYPEWRITER)
    // ==========================================
    
    function typeWriter(elementId, text, speed = 55, callback = null) {
        const element = document.getElementById(elementId);
        element.textContent = "";
        
        // Показываем курсор у текущего контейнера
        const cursor = element.nextElementSibling;
        if (cursor && cursor.classList.contains("cursor")) {
            cursor.style.display = "inline";
        }

        let index = 0;
        function type() {
            if (index < text.length) {
                element.textContent += text.charAt(index);
                index++;
                setTimeout(type, speed);
            } else {
                // Прячем курсор после завершения печати
                if (cursor && cursor.classList.contains("cursor")) {
                    cursor.style.display = "none";
                }
                if (callback) callback();
            }
        }
        type();
    }

    // ==========================================
    // ПЕРЕХОДЫ МЕЖДУ ЭКРАНАМИ
    // ==========================================
    
    function switchScreen(fromScreen, toScreen, callback = null) {
        fromScreen.classList.remove("active");
        
        // Даем время на анимацию скрытия
        setTimeout(() => {
            fromScreen.style.display = "none";
            toScreen.style.display = "flex";
            
            // Запускаем перерисовку для корректной анимации появления
            toScreen.offsetHeight; 
            
            toScreen.classList.add("active");
            
            if (callback) {
                setTimeout(callback, 300);
            }
        }, 500);
    }

    // ==========================================
    // ПАРАЛЛАКС ФОНА НА ДВИЖЕНИЕ МЫШИ
    // ==========================================
    
    const parallax = document.getElementById("parallax");
    document.addEventListener("mousemove", (e) => {
        if (!parallax) return;
        const x = (e.clientX - window.innerWidth / 2) * 0.02;
        const y = (e.clientY - window.innerHeight / 2) * 0.02;
        parallax.style.transform = `translate(${x}px, ${y}px)`;
    });

    // ==========================================
    // CANVAS: ЭМОДЗИ И КОНФЕТТИ
    // ==========================================
    
    const canvas = document.getElementById("background-canvas");
    const ctx = canvas.getContext("2d");
    
    let canvasWidth = (canvas.width = window.innerWidth);
    let canvasHeight = (canvas.height = window.innerHeight);

    window.addEventListener("resize", () => {
        canvasWidth = canvas.width = window.innerWidth;
        canvasHeight = canvas.height = window.innerHeight;
    });

    const emojiList = ["❤️", "💖", "💕", "✨", "🌸", "🥰", "😊", "🥺", "💗", "💘", "🌹", "💫", "🌺"];
    const floatingEmojis = [];
    const confetti = [];

    // Создаем начальные падающие смайлики
    const maxEmojiCount = 35;
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

    // Отрисовка смайлика на Canvas
    function drawEmojiParticle(ctx, x, y, size, emoji, opacity) {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(emoji, x, y);
        ctx.restore();
    }

    // Создание взрыва конфетти
    function createConfettiBurst() {
        const colors = ["#ff4b72", "#ff7b93", "#ffb3c6", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];
        const burstCount = 120;
        
        for (let i = 0; i < burstCount; i++) {
            confetti.push({
                x: canvasWidth / 2,
                y: canvasHeight / 2 - 50,
                size: Math.random() * 8 + 6,
                speedX: (Math.random() - 0.5) * 15,
                speedY: (Math.random() - 0.7) * 18 - 5,
                gravity: 0.35,
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 10,
                color: colors[Math.floor(Math.random() * colors.length)],
                opacity: 1
            });
        }
    }

    // Анимационный цикл
    function animate() {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        // Рисуем и обновляем смайлики
        floatingEmojis.forEach((p) => {
            drawEmojiParticle(ctx, p.x, p.y, p.size, p.emoji, p.opacity);
            
            // Движение
            p.y += p.speed * STATE.heartSpeedMultiplier;
            p.x += Math.sin(p.angle) * 0.5 + p.wind;
            p.angle += 0.01;

            // Сброс при выходе снизу
            if (p.y > canvasHeight + 20) {
                p.y = -20;
                p.x = Math.random() * canvasWidth;
                p.opacity = Math.random() * 0.5 + 0.3;
                p.emoji = emojiList[Math.floor(Math.random() * emojiList.length)];
            }
        });

        // Рисуем и обновляем конфетти
        for (let i = confetti.length - 1; i >= 0; i--) {
            const p = confetti[i];
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.opacity;
            
            // Рисуем прямоугольник конфетти
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();

            // Обновляем физику
            p.x += p.speedX;
            p.y += p.speedY;
            p.speedY += p.gravity;
            p.rotation += p.rotationSpeed;
            p.opacity -= 0.012;

            // Удаляем прозрачные частицы
            if (p.opacity <= 0 || p.y > canvasHeight) {
                confetti.splice(i, 1);
            }
        }

        requestAnimationFrame(animate);
    }
    
    // Запуск Canvas анимации
    animate();

    // ==========================================
    // ЛОГИКА ЭКРАНА 0 (ЗАГРУЗКА)
    // ==========================================
    
    // Имитируем загрузку 1.5 секунды
    setTimeout(() => {
        switchScreen(screenLoader, screenQuestion, () => {
            STATE.currentScreen = 'question';
            // Запускаем печать вопроса
            typeWriter("question-text", chosenQuestion, 55, () => {
                // Показываем кнопку Да
                btnYes.style.opacity = "1";
                // Показываем кнопку Нет позиционированной рядом с Нет
                showNoButton();
                
                // Запускаем пасхалки по времени
                startEasterEggs();
            });
        });
    }, 1500);

    // ==========================================
    // КНОПКА "НЕТ" — ЖИВЁТ В BODY, НИКОГДА НЕ ИСЧЕЗАЕТ
    // ==========================================

    const isTouchDevice = () =>
        ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    // Позиционировать кнопку рядом с якорем (рядом с кнопкой Да) и показать
    function showNoButton() {
        const anchor = document.getElementById('btn-no-anchor');
        if (!anchor) return;
        const rect = anchor.getBoundingClientRect();
        // Без анимации поставить в позицию
        btnNo.style.transition = 'none';
        btnNo.style.left = rect.left + 'px';
        btnNo.style.top  = rect.top  + 'px';
        // После reflow — включаем плавный transition обратно
        btnNo.offsetHeight;
        btnNo.style.transition = '';
        btnNo.classList.add('visible');
    }

    // Спрятать кнопку в случайную точку экрана
    function jumpNoButton() {
        const w = btnNo.offsetWidth  || 120;
        const h = btnNo.offsetHeight || 48;
        const pad = 20;

        const newX = Math.random() * (window.innerWidth  - w - pad * 2) + pad;
        const newY = Math.random() * (window.innerHeight - h - pad * 2) + pad;

        // Сбрасываем jumping для повторного срабатывания CSS-анимации
        btnNo.classList.remove('jumping');
        btnNo.offsetHeight; // reflow
        btnNo.classList.add('jumping');

        btnNo.style.left = newX + 'px';
        btnNo.style.top  = newY + 'px';
    }

    // Спрятать кнопку обратно к якорю и спрятать
    function hideNoButton() {
        btnNo.classList.remove('visible', 'jumping');
        // Сбрасываем счётчики для следующего показа
        STATE.noHoverCount = 0;
        STATE.mobileTapCount = 0;
        btnNo.querySelector('.btn-text').textContent = 'Нет 🙃';
    }

    // Десктоп: убегаем при наведении
    btnNo.addEventListener('mouseenter', () => {
        if (isTouchDevice()) return;
        STATE.noHoverCount++;

        jumpNoButton();

        // Меняем надпись
        const idx = (STATE.noHoverCount - 1) % noButtonTexts.length;
        btnNo.querySelector('.btn-text').textContent = noButtonTexts[idx];

        // Toast
        showToast(desktopToasts[Math.floor(Math.random() * desktopToasts.length)]);
    });

    // Мобильные: убегаем при тапе
    btnNo.addEventListener('touchstart', (e) => {
        e.preventDefault();
        STATE.mobileTapCount++;

        jumpNoButton();

        const msgs = [
            '', // 0 — не бывает
            'Попыток поймать кнопку: 1',
            'Попыток поймать: 2',
            'Ты очень настойчивая 😄',
            `Попыток: ${STATE.mobileTapCount}`,
            'Я начинаю переживать...',
            `Попыток: ${STATE.mobileTapCount}`,
            'Ладно, но нет 😅',
        ];
        const msg = msgs[STATE.mobileTapCount] ?? `Попыток: ${STATE.mobileTapCount}`;
        showToast(msg);
    });

    // Если каким-то чудом нажали — модальное окно ошибки
    btnNo.addEventListener('click', () => {
        card.classList.add('blurred');
        errorModal.classList.add('active');
        errorModal.setAttribute('aria-hidden', 'false');
        showToast('🏆 Охотник за кнопками', true);
    });

    // Закрытие модального окна
    btnModalClose.addEventListener('click', () => {
        card.classList.remove('blurred');
        errorModal.classList.remove('active');
        errorModal.setAttribute('aria-hidden', 'true');
        jumpNoButton();
    });

    // ==========================================
    // КНОПКА "ДА"
    // ==========================================
    
    // Эффект замедления сердечек при наведении
    btnYes.addEventListener("mouseenter", () => {
        STATE.heartSpeedMultiplier = 0.2;
    });

    btnYes.addEventListener("mouseleave", () => {
        STATE.heartSpeedMultiplier = 1.0;
    });

    // Клик на Да
    btnYes.addEventListener("click", () => {
        // Очищаем таймеры пасхалок
        STATE.easterEggTimers.forEach(timer => clearTimeout(timer));
        
        // Анимация Bounce на кнопке
        btnYes.classList.add("bounce-animation");
        
        // Взрыв конфетти
        createConfettiBurst();
        
        // Скрываем кнопку «Нет» и сбрасываем её состояние
        hideNoButton();

        // Переход на следующий экран выбора времени
        setTimeout(() => {
            btnYes.classList.remove("bounce-animation");
            switchScreen(screenQuestion, screenTime, () => {
                STATE.currentScreen = 'time';
            });
        }, 600);
    });

    // ==========================================
    // ВЫБОР ВРЕМЕНИ
    // ==========================================
    
    function updateTimeDisplay() {
        const hh = String(STATE.selectedHour).padStart(2, '0');
        const mm = String(STATE.selectedMinute).padStart(2, '0');
        
        hourVal.textContent = hh;
        minuteVal.textContent = mm;
        
        timePreview.textContent = `Сегодня в ${hh}:${mm} ❤️`;
    }

    // Часы [+] и [-]
    hourPlus.addEventListener("click", () => {
        STATE.selectedHour = (STATE.selectedHour + 1) % 24;
        updateTimeDisplay();
    });

    hourMinus.addEventListener("click", () => {
        STATE.selectedHour = (STATE.selectedHour - 1 + 24) % 24;
        updateTimeDisplay();
    });

    // Минуты [+] и [-]
    minutePlus.addEventListener("click", () => {
        STATE.selectedMinute = (STATE.selectedMinute + 1) % 60;
        updateTimeDisplay();
    });

    minuteMinus.addEventListener("click", () => {
        STATE.selectedMinute = (STATE.selectedMinute - 1 + 60) % 60;
        updateTimeDisplay();
    });

    // Подтверждение времени
    btnConfirm.addEventListener("click", () => {
        // Переход на финал
        switchScreen(screenTime, screenFinal, () => {
            STATE.currentScreen = 'final';
            
            // Дополнительные эффекты финала
            document.body.classList.add("final-blur");
            card.classList.add("expanded");
            
            // Взрыв конфетти
            createConfettiBurst();
            
            const hh = String(STATE.selectedHour).padStart(2, '0');
            const mm = String(STATE.selectedMinute).padStart(2, '0');

            // Запускаем поэтапный Typewriter
            typeWriter("final-title-text", "Спасибо ❤️", 55, () => {
                setTimeout(() => {
                    typeWriter("final-sub-text", `Буду ждать тебя сегодня в ${hh}:${mm} ❤️`, 45, () => {
                        setTimeout(() => {
                            // Выбираем случайную фразу
                            const randomPhrase = finalPhrases[Math.floor(Math.random() * finalPhrases.length)];
                            typeWriter("final-extra-text", randomPhrase, 45);
                        }, 1000);
                    });
                }, 1000);
            });
        });
    });

    // ==========================================
    // ПАСХАЛКИ ПО ТАЙМЕРУ
    // ==========================================
    
    function startEasterEggs() {
        // Пасхалка 40 секунд
        const egg1 = setTimeout(() => {
            showToast("⌛ Всё ещё думаю, что кнопка \"Да\" выглядит привлекательнее.", true);
        }, 40000);

        // Пасхалка 80 секунд
        const egg2 = setTimeout(() => {
            showToast("👀 Я всё ещё жду...", true);
        }, 80000);

        // Пасхалка 120 секунд (2 минуты)
        const egg3 = setTimeout(() => {
            showToast("😄 Ладно, признаюсь — кнопку \"Нет\" я специально тренировал убегать.", true);
        }, 120000);

        STATE.easterEggTimers.push(egg1, egg2, egg3);
    }
});
