const fs = require('fs');
const path = require('path');

function copyDirSync(src, dest) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Создаем папку www
if (!fs.existsSync('www')) {
    fs.mkdirSync('www');
}

// Список отдельных файлов для копирования
const files = [
    'index.html',
    'planner.html',
    'planner.js',
    'planner.css',
    'style.css',
    'script.js',
    'shared_audio.js',
    'movies.html',
    'movies.js',
    'movies.css',
    'icon-192.png',
    'icon-512.png',
    'site.webmanifest'
];

files.forEach(f => {
    if (fs.existsSync(f)) {
        fs.copyFileSync(f, path.join('www', f));
        console.log(`Скопирован файл: ${f}`);
    } else {
        console.warn(`Предупреждение: файл не найден: ${f}`);
    }
});

// Копируем папки с музыкой и фотографиями
copyDirSync('music', 'www/music');
console.log('Папка music успешно скопирована в www/music');

copyDirSync('photos', 'www/photos');
console.log('Папка photos успешно скопирована в www/photos');
