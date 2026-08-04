(function () {
    'use strict';

    const isCapacitor = window.hasOwnProperty('Capacitor') && window.Capacitor.Plugins.NativeAudio;
    const NativeAudio = isCapacitor ? window.Capacitor.Plugins.NativeAudio : null;

    // Стейт плеера
    const AUDIO_STATE = {
        isGreetingPlaying: false,
        targetVolume: 1.0,
        isMuted: false,
        bgAudio: null, // HTML5
        greetingAudio: null // HTML5
    };

    // Хелпер для плавного изменения громкости (HTML5 fallback)
    function fadeHTML5Audio(audio, startVol, endVol, duration, callback) {
        const startTime = performance.now();
        function step(now) {
            const progress = (now - startTime) / duration;
            if (progress < 1) {
                audio.volume = startVol + (endVol - startVol) * progress;
                requestAnimationFrame(step);
            } else {
                audio.volume = endVol;
                if (callback) callback();
            }
        }
        requestAnimationFrame(step);
    }

    // Хелпер для плавного изменения громкости (NativeAudio)
    async function fadeNativeAudio(assetId, startVol, endVol, duration, callback) {
        const steps = 10;
        const intervalTime = duration / steps;
        const volStep = (endVol - startVol) / steps;
        let currentStep = 0;

        const interval = setInterval(async () => {
            currentStep++;
            let vol = startVol + volStep * currentStep;
            vol = Math.max(0, Math.min(1, vol));
            try {
                await NativeAudio.setVolume({ assetId, volume: vol });
            } catch (e) {}

            if (currentStep >= steps) {
                clearInterval(interval);
                try {
                    await NativeAudio.setVolume({ assetId, volume: endVol });
                } catch (e) {}
                if (callback) callback();
            }
        }, intervalTime);
    }

    const SharedAudio = {
        async init() {
            // Читаем сохраненную громкость
            const savedVol = localStorage.getItem('lisa_music_volume');
            AUDIO_STATE.targetVolume = savedVol !== null ? parseFloat(savedVol) : 1;

            if (isCapacitor) {
                try {
                    // Preload if not preloaded (we catch error if already preloaded)
                    try {
                        await NativeAudio.preload({
                            assetId: 'bg_music',
                            assetPath: 'music/videoplayback (1).m4a',
                            audioChannelNum: 1,
                            isUrl: false
                        });
                    } catch (e) {}

                    try {
                        await NativeAudio.preload({
                            assetId: 'greeting_music',
                            assetPath: 'music/izvinite-za-opozdanie-privet.mp3',
                            audioChannelNum: 1,
                            isUrl: false
                        });
                    } catch (e) {}

                    // Синхронизируем стейт воспроизведения
                    const bgPlaying = await NativeAudio.isPlaying({ assetId: 'bg_music' });
                    const greetingPlaying = await NativeAudio.isPlaying({ assetId: 'greeting_music' });
                    AUDIO_STATE.isGreetingPlaying = greetingPlaying.isPlaying;
                    
                    // Если проигрывается музыка, ставим громкость
                    if (bgPlaying.isPlaying) {
                        await NativeAudio.setVolume({ assetId: 'bg_music', volume: AUDIO_STATE.targetVolume });
                    }
                    if (greetingPlaying.isPlaying) {
                        await NativeAudio.setVolume({ assetId: 'greeting_music', volume: AUDIO_STATE.targetVolume });
                    }

                    // Подписываемся на завершение приветственной песни
                    NativeAudio.addListener('complete', async (result) => {
                        if (result.assetId === 'greeting_music') {
                            AUDIO_STATE.isGreetingPlaying = false;
                            // Нативная музыка закончилась, переключаем на фон
                            await NativeAudio.stop({ assetId: 'greeting_music' });
                            await NativeAudio.setVolume({ assetId: 'bg_music', volume: 0 });
                            await NativeAudio.loop({ assetId: 'bg_music' });
                            fadeNativeAudio('bg_music', 0, AUDIO_STATE.targetVolume, 500);
                            
                            const btn = document.getElementById('audio-toggle');
                            if (btn && AUDIO_STATE.targetVolume > 0) btn.textContent = '🔊';
                        }
                    });

                } catch (err) {
                    console.error('SharedAudio NativeAudio init error:', err);
                }
            } else {
                // HTML5 Audio fallback
                AUDIO_STATE.bgAudio = new Audio('music/videoplayback (1).m4a');
                AUDIO_STATE.bgAudio.loop = true;
                AUDIO_STATE.bgAudio.volume = AUDIO_STATE.targetVolume;

                AUDIO_STATE.greetingAudio = new Audio('music/izvinite-za-opozdanie-privet.mp3');
                AUDIO_STATE.greetingAudio.volume = AUDIO_STATE.targetVolume;

                AUDIO_STATE.greetingAudio.addEventListener('ended', () => {
                    AUDIO_STATE.isGreetingPlaying = false;
                    fadeHTML5Audio(AUDIO_STATE.greetingAudio, AUDIO_STATE.greetingAudio.volume, 0, 500, () => {
                        AUDIO_STATE.greetingAudio.pause();
                        AUDIO_STATE.bgAudio.currentTime = 0;
                        AUDIO_STATE.bgAudio.volume = 0;
                        AUDIO_STATE.bgAudio.play().then(() => {
                            fadeHTML5Audio(AUDIO_STATE.bgAudio, 0, AUDIO_STATE.targetVolume, 500);
                            const btn = document.getElementById('audio-toggle');
                            if (btn && AUDIO_STATE.targetVolume > 0) btn.textContent = '🔊';
                        }).catch(() => {});
                    });
                });
            }

            // Инициализация DOM-элементов управления
            this.initDOMControls();
        },

        initDOMControls() {
            const btn = document.getElementById('audio-toggle');
            const slider = document.getElementById('volume-slider');
            const container = document.getElementById('volume-control-container');

            if (slider) {
                slider.value = AUDIO_STATE.targetVolume;
                if (AUDIO_STATE.targetVolume === 0 && btn) {
                    btn.textContent = '🔇';
                }

                slider.addEventListener('input', async (e) => {
                    const vol = parseFloat(e.target.value);
                    AUDIO_STATE.targetVolume = vol;
                    localStorage.setItem('lisa_music_volume', vol);

                    if (isCapacitor) {
                        try {
                            if (!AUDIO_STATE.isGreetingPlaying) {
                                await NativeAudio.setVolume({ assetId: 'bg_music', volume: vol });
                            } else {
                                await NativeAudio.setVolume({ assetId: 'greeting_music', volume: vol });
                            }
                        } catch (e) {}
                    } else {
                        AUDIO_STATE.bgAudio.volume = vol;
                        AUDIO_STATE.greetingAudio.volume = vol;
                    }

                    if (vol === 0 && btn) {
                        btn.textContent = '🔇';
                    } else if (btn) {
                        // Проверяем, играет ли что-то
                        let playing = false;
                        if (isCapacitor) {
                            const bg = await NativeAudio.isPlaying({ assetId: 'bg_music' });
                            const gr = await NativeAudio.isPlaying({ assetId: 'greeting_music' });
                            playing = bg.isPlaying || gr.isPlaying;
                        } else {
                            playing = !AUDIO_STATE.bgAudio.paused || !AUDIO_STATE.greetingAudio.paused;
                        }
                        if (playing) btn.textContent = '🔊';
                    }
                });
            }

            if (btn) {
                // Обновляем иконку при загрузке страницы
                this.updateButtonIcon(btn);

                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const isMobile = window.innerWidth <= 600;
                    if (isMobile && slider) {
                        if (!slider.classList.contains('expanded')) {
                            slider.classList.add('expanded');
                            return;
                        }
                    }

                    if (isCapacitor) {
                        const activeId = AUDIO_STATE.isGreetingPlaying ? 'greeting_music' : 'bg_music';
                        const status = await NativeAudio.isPlaying({ assetId: activeId });
                        if (status.isPlaying) {
                            await NativeAudio.stop({ assetId: activeId });
                            btn.textContent = '🔇';
                        } else {
                            if (activeId === 'bg_music') {
                                await NativeAudio.loop({ assetId: 'bg_music' });
                            } else {
                                await NativeAudio.play({ assetId: 'greeting_music' });
                            }
                            await NativeAudio.setVolume({ assetId: activeId, volume: AUDIO_STATE.targetVolume });
                            btn.textContent = AUDIO_STATE.targetVolume > 0 ? '🔊' : '🔇';
                        }
                    } else {
                        const activeAudio = AUDIO_STATE.isGreetingPlaying ? AUDIO_STATE.greetingAudio : AUDIO_STATE.bgAudio;
                        if (activeAudio.paused) {
                            activeAudio.play().then(() => {
                                btn.textContent = AUDIO_STATE.targetVolume > 0 ? '🔊' : '🔇';
                            }).catch(() => {});
                        } else {
                            activeAudio.pause();
                            btn.textContent = '🔇';
                        }
                    }
                });
            }

            // Закрытие слайдера на телефоне при клике вне зоны регулировки
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#volume-control-container') && window.innerWidth <= 600) {
                    if (slider) slider.classList.remove('expanded');
                }
            });
        },

        async updateButtonIcon(btn) {
            let playing = false;
            if (isCapacitor) {
                try {
                    const bg = await NativeAudio.isPlaying({ assetId: 'bg_music' });
                    const gr = await NativeAudio.isPlaying({ assetId: 'greeting_music' });
                    playing = bg.isPlaying || gr.isPlaying;
                } catch (e) {}
            } else {
                playing = !AUDIO_STATE.bgAudio.paused || !AUDIO_STATE.greetingAudio.paused;
            }
            if (playing && AUDIO_STATE.targetVolume > 0) {
                btn.textContent = '🔊';
            } else {
                btn.textContent = '🔇';
            }
        },

        // Запуск фоновой музыки
        async startBackgroundMusic() {
            if (isCapacitor) {
                try {
                    const bg = await NativeAudio.isPlaying({ assetId: 'bg_music' });
                    const gr = await NativeAudio.isPlaying({ assetId: 'greeting_music' });
                    if (!bg.isPlaying && !gr.isPlaying) {
                        await NativeAudio.loop({ assetId: 'bg_music' });
                        await NativeAudio.setVolume({ assetId: 'bg_music', volume: AUDIO_STATE.targetVolume });
                        
                        const btn = document.getElementById('audio-toggle');
                        if (btn) btn.textContent = AUDIO_STATE.targetVolume > 0 ? '🔊' : '🔇';
                    }
                } catch (e) {}
            } else {
                if (AUDIO_STATE.bgAudio.paused && !AUDIO_STATE.isGreetingPlaying) {
                    AUDIO_STATE.bgAudio.play().then(() => {
                        const btn = document.getElementById('audio-toggle');
                        if (btn) btn.textContent = AUDIO_STATE.targetVolume > 0 ? '🔊' : '🔇';
                    }).catch(() => {});
                }
            }
        },

        // Переключение на приветственную песню
        async playGreetingMusic() {
            AUDIO_STATE.isGreetingPlaying = true;
            if (isCapacitor) {
                try {
                    // Затухание фона
                    fadeNativeAudio('bg_music', AUDIO_STATE.targetVolume, 0, 500, async () => {
                        await NativeAudio.stop({ assetId: 'bg_music' });
                        
                        // Запуск и появление приветственной
                        await NativeAudio.setVolume({ assetId: 'greeting_music', volume: 0 });
                        await NativeAudio.play({ assetId: 'greeting_music' });
                        fadeNativeAudio('greeting_music', 0, AUDIO_STATE.targetVolume, 500);
                        
                        const btn = document.getElementById('audio-toggle');
                        if (btn && AUDIO_STATE.targetVolume > 0) btn.textContent = '🔊';
                    });
                } catch (e) {}
            } else {
                if (!AUDIO_STATE.bgAudio.paused) {
                    fadeHTML5Audio(AUDIO_STATE.bgAudio, AUDIO_STATE.bgAudio.volume, 0, 500, () => {
                        AUDIO_STATE.bgAudio.pause();
                        AUDIO_STATE.greetingAudio.currentTime = 0;
                        AUDIO_STATE.greetingAudio.volume = 0;
                        AUDIO_STATE.greetingAudio.play().then(() => {
                            fadeHTML5Audio(AUDIO_STATE.greetingAudio, 0, AUDIO_STATE.targetVolume, 500);
                            const btn = document.getElementById('audio-toggle');
                            if (btn && AUDIO_STATE.targetVolume > 0) btn.textContent = '🔊';
                        }).catch(() => {});
                    });
                } else {
                    AUDIO_STATE.greetingAudio.currentTime = 0;
                    AUDIO_STATE.greetingAudio.volume = 0;
                    AUDIO_STATE.greetingAudio.play().then(() => {
                        fadeHTML5Audio(AUDIO_STATE.greetingAudio, 0, AUDIO_STATE.targetVolume, 500);
                        const btn = document.getElementById('audio-toggle');
                        if (btn && AUDIO_STATE.targetVolume > 0) btn.textContent = '🔊';
                    }).catch(() => {});
                }
            }
        }
    };

    window.SharedAudio = SharedAudio;
})();
