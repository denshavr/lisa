const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const app = express();
// На Amvera нет переменной PORT, а трафик идёт на 80.
// Локально bat-файл сам задаёт PORT=3000.
const PORT = process.env.PORT || 80;

app.use(cors());
app.use(express.json());

// Отдаем все статические файлы из текущей директории
app.use(express.static(__dirname));

// Автоматически определяем, находимся ли мы на Amvera
const isAmvera = process.env.AMVERA === '1' || fs.existsSync('/data');
const DATA_DIR = isAmvera ? '/data' : __dirname;
if (!fs.existsSync(DATA_DIR)) {
    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
        console.error('Не удалось создать директорию данных:', e);
    }
}

const DB_PATH = path.join(DATA_DIR, 'database.sqlite');
const LOCAL_SEED_DB = path.join(__dirname, 'database.sqlite');

// Если мы на Amvera (/data) и файл /data/database.sqlite еще не существует,
// копируем существующую базу данных database.sqlite из репозитория в /data/database.sqlite
if (isAmvera && !fs.existsSync(DB_PATH) && fs.existsSync(LOCAL_SEED_DB)) {
    try {
        fs.copyFileSync(LOCAL_SEED_DB, DB_PATH);
        console.log('Существующая база database.sqlite скопирована в постоянное хранилище /data/database.sqlite');
    } catch (e) {
        console.error('Ошибка копирования базы данных в /data:', e);
    }
}

let db;

// Функция автоматического сохранения снимка БД из памяти на диск
function saveDb() {
    if (!db) return;
    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    } catch (e) {
        console.error('Ошибка сохранения базы данных на диск:', e);
    }
}

// Инициализация WebAssembly SQLite
initSqlJs().then((SQL) => {
    try {
        if (fs.existsSync(DB_PATH)) {
            const filebuffer = fs.readFileSync(DB_PATH);
            db = new SQL.Database(filebuffer);
            console.log('Успешно загружена база данных SQLite из:', DB_PATH);
        } else {
            db = new SQL.Database();
            console.log('Создана новая база данных SQLite.');
        }
        initDatabase();
    } catch (err) {
        console.error('Ошибка открытия файла БД, создается новая:', err);
        db = new SQL.Database();
        initDatabase();
    }
}).catch((err) => {
    console.error('Ошибка инициализации sql.js (WASM):', err);
});

function initDatabase() {
    db.run(`CREATE TABLE IF NOT EXISTS planner_data (
        date TEXT PRIMARY KEY,
        blocks TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS meetings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT,
        timestamp TEXT
    )`);

    saveDb();
}

// Преобразование результата exec в массив объектов
function execToObjects(res, mappingFn) {
    if (!res || res.length === 0) return [];
    const columns = res[0].columns;
    const values = res[0].values;
    return values.map(row => {
        const obj = {};
        columns.forEach((col, idx) => {
            obj[col] = row[idx];
        });
        return mappingFn ? mappingFn(obj) : obj;
    });
}

// --- MEETINGS API ---
app.get('/api/meetings', (req, res) => {
    try {
        const queryRes = db.exec("SELECT * FROM meetings ORDER BY id ASC");
        const meetings = execToObjects(queryRes, r => {
            try {
                const parsed = JSON.parse(r.data);
                return { ...parsed, id: r.id, timestamp: r.timestamp };
            } catch (e) {
                return { id: r.id, timestamp: r.timestamp };
            }
        });
        res.json(meetings);
    } catch (err) {
        console.error('Ошибка чтения встреч из БД:', err);
        res.status(500).json({ error: 'Не удалось прочитать встречи' });
    }
});

app.post('/api/meetings', (req, res) => {
    try {
        const newMeeting = req.body;
        const timestamp = new Date().toISOString();
        newMeeting.timestamp = timestamp;
        const dataStr = JSON.stringify(newMeeting);

        db.run("INSERT INTO meetings (data, timestamp) VALUES (?, ?)", [dataStr, timestamp]);
        saveDb();

        const lastIdRes = db.exec("SELECT last_insert_rowid() as id");
        const lastId = (lastIdRes[0] && lastIdRes[0].values[0] && lastIdRes[0].values[0][0]) || Date.now();

        res.status(201).json({ success: true, meeting: { ...newMeeting, id: lastId } });
    } catch (err) {
        console.error('Ошибка сохранения встречи в БД:', err);
        res.status(500).json({ error: 'Не удалось сохранить встречу' });
    }
});

// --- PLANNER DATA API ---
app.get('/api/planner/data', (req, res) => {
    try {
        const queryRes = db.exec("SELECT date, blocks FROM planner_data");
        const result = {};
        const rows = execToObjects(queryRes);
        rows.forEach(r => {
            try {
                result[r.date] = JSON.parse(r.blocks);
            } catch (e) {
                result[r.date] = {};
            }
        });
        res.json(result);
    } catch (err) {
        console.error('Ошибка чтения данных планера из БД:', err);
        res.status(500).json({ error: 'Ошибка чтения данных' });
    }
});

app.post('/api/planner/data', (req, res) => {
    try {
        const { date, blocks } = req.body;
        if (!date) return res.status(400).json({ error: 'Дата не указана' });

        const blocksStr = JSON.stringify(blocks || {});
        db.run(
            `INSERT INTO planner_data (date, blocks) VALUES (?, ?)
             ON CONFLICT(date) DO UPDATE SET blocks=excluded.blocks`,
            [date, blocksStr]
        );
        saveDb();
        res.status(200).json({ success: true });
    } catch (err) {
        console.error('Ошибка сохранения планера в БД:', err);
        res.status(500).json({ error: 'Ошибка сохранения данных' });
    }
});

// --- METADATA PROXY API ---
app.get('/api/metadata/poster', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.json({ posterUrl: null });

    // 1. YouTube check
    const ytReg = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = videoUrl.match(ytReg);
    if (match && match[2].length === 11) {
        return res.json({ posterUrl: `https://img.youtube.com/vi/${match[2]}/hqdefault.jpg` });
    }

    // 2. Fetch page and find OpenGraph tag
    try {
        const response = await fetch(videoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(4000) // 4 seconds timeout
        });

        if (response.ok) {
            const html = await response.text();
            
            // Helper regex search for og:image or twitter:image
            const extractOgImage = (htmlContent) => {
                let m = htmlContent.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
                if (m) return m[1];
                m = htmlContent.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
                if (m) return m[1];
                m = htmlContent.match(/<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i);
                if (m) return m[1];
                m = htmlContent.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
                if (m) return m[1];
                return null;
            };

            let posterUrl = extractOgImage(html);
            if (posterUrl) {
                // Decode HTML entities if any
                posterUrl = posterUrl.replace(/&amp;/g, '&');
                return res.json({ posterUrl });
            }
        }
    } catch (e) {
        console.error('Failed to fetch og:image for url:', videoUrl, e.message);
    }

    res.json({ posterUrl: null });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
