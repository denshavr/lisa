const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
// На Amvera слушаем 80 порт (или из env), локально через bat-файл передаётся PORT=3000
const PORT = process.env.PORT || 80;

app.use(cors());
app.use(express.json());

// Отдаем все статические файлы из текущей директории
app.use(express.static(__dirname));

// На Amvera DATA_DIR=/data (persistent volume), локально — папка ./data рядом с проектом
const isAmvera = process.env.DATA_DIR === '/data';
const DATA_DIR = isAmvera ? '/data' : path.join(__dirname, 'data');
const dbDir = DATA_DIR;

if (!fs.existsSync(dbDir)) {
    try {
        fs.mkdirSync(dbDir, { recursive: true });
    } catch (err) {
        console.error('Ошибка создания папки БД:', err.message);
    }
}

const dbPath = path.join(dbDir, 'database.db');
const MEETINGS_FILE = path.join(__dirname, 'meetings.json');
const PLANNER_DATA_FILE = path.join(__dirname, 'planner_data.json');

// Подключаемся к базе данных
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Ошибка подключения к БД:', err.message);
    } else {
        console.log(`База данных подключена по пути: ${dbPath}`);
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Таблица для встреч
        db.run(`
            CREATE TABLE IF NOT EXISTS meetings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                time TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
        `, (err) => {
            if (err) console.error('Ошибка создания таблицы meetings:', err.message);
        });

        // Таблица для планера
        db.run(`
            CREATE TABLE IF NOT EXISTS planner_days (
                date TEXT PRIMARY KEY,
                blocks TEXT NOT NULL
            )
        `, (err) => {
            if (err) console.error('Ошибка создания таблицы planner_days:', err.message);
            else {
                // После того как таблицы созданы, запускаем миграцию
                runMigrations();
            }
        });
    });
}

function runMigrations() {
    // 1. Миграция встреч
    if (fs.existsSync(MEETINGS_FILE)) {
        console.log('Найден файл meetings.json, запускаем импорт...');
        fs.readFile(MEETINGS_FILE, 'utf8', (err, data) => {
            if (err) {
                console.error('Ошибка чтения meetings.json:', err.message);
                return;
            }
            try {
                const meetings = JSON.parse(data || '[]');
                if (Array.isArray(meetings) && meetings.length > 0) {
                    const stmt = db.prepare(`INSERT INTO meetings (time, timestamp) VALUES (?, ?)`);
                    meetings.forEach((m) => {
                        stmt.run(m.time, m.timestamp || new Date().toISOString(), (runErr) => {
                            if (runErr) console.error('Ошибка импорта встречи:', runErr.message);
                        });
                    });
                    stmt.finalize(() => {
                        console.log(`Успешно импортировано ${meetings.length} встреч в БД.`);
                        renameFile(MEETINGS_FILE);
                    });
                } else {
                    renameFile(MEETINGS_FILE);
                }
            } catch (e) {
                console.error('Ошибка парсинга meetings.json:', e.message);
            }
        });
    }

    // 2. Миграция планера
    if (fs.existsSync(PLANNER_DATA_FILE)) {
        console.log('Найден файл planner_data.json, запускаем импорт...');
        fs.readFile(PLANNER_DATA_FILE, 'utf8', (err, data) => {
            if (err) {
                console.error('Ошибка чтения planner_data.json:', err.message);
                return;
            }
            try {
                const plannerData = JSON.parse(data || '{}');
                const dates = Object.keys(plannerData);
                if (dates.length > 0) {
                    const stmt = db.prepare(`INSERT OR REPLACE INTO planner_days (date, blocks) VALUES (?, ?)`);
                    dates.forEach((date) => {
                        stmt.run(date, JSON.stringify(plannerData[date]), (runErr) => {
                            if (runErr) console.error(`Ошибка импорта дня ${date}:`, runErr.message);
                        });
                    });
                    stmt.finalize(() => {
                        console.log(`Успешно импортировано ${dates.length} дней планировщика в БД.`);
                        renameFile(PLANNER_DATA_FILE);
                    });
                } else {
                    renameFile(PLANNER_DATA_FILE);
                }
            } catch (e) {
                console.error('Ошибка парсинга planner_data.json:', e.message);
            }
        });
    }
}

function renameFile(filePath) {
    const backupPath = filePath + '.bak';
    fs.rename(filePath, backupPath, (err) => {
        if (err) console.error(`Не удалось переименовать файл ${filePath}:`, err.message);
        else console.log(`Файл ${filePath} переименован в ${backupPath}`);
    });
}

// --- MEETINGS API ---

// Чтение встреч
app.get('/api/meetings', (req, res) => {
    db.all(`SELECT time, timestamp FROM meetings ORDER BY timestamp ASC`, [], (err, rows) => {
        if (err) {
            console.error('Ошибка чтения встреч из БД:', err.message);
            return res.status(500).json({ error: 'Не удалось прочитать встречи' });
        }
        res.json(rows);
    });
});

// Добавление новой встречи
app.post('/api/meetings', (req, res) => {
    const { time } = req.body;
    if (!time) {
        return res.status(400).json({ error: 'Неверные данные (отсутствует time)' });
    }

    const timestamp = new Date().toISOString();
    db.run(
        `INSERT INTO meetings (time, timestamp) VALUES (?, ?)`,
        [time, timestamp],
        function (err) {
            if (err) {
                console.error('Ошибка сохранения встречи в БД:', err.message);
                return res.status(500).json({ error: 'Не удалось сохранить встречу' });
            }
            res.status(201).json({ success: true, meeting: { time, timestamp } });
        }
    );
});

// --- PLANNER DATA API ---

// Чтение данных планера
app.get('/api/planner/data', (req, res) => {
    db.all(`SELECT date, blocks FROM planner_days`, [], (err, rows) => {
        if (err) {
            console.error('Ошибка чтения планера из БД:', err.message);
            return res.status(500).json({ error: 'Ошибка чтения данных' });
        }

        const allData = {};
        rows.forEach((row) => {
            try {
                allData[row.date] = JSON.parse(row.blocks);
            } catch (e) {
                console.error(`Ошибка парсинга блоков для даты ${row.date}:`, e.message);
            }
        });
        res.json(allData);
    });
});

// Сохранение/обновление данных планера
app.post('/api/planner/data', (req, res) => {
    const { date, blocks } = req.body;
    if (!date || !blocks) {
        return res.status(400).json({ error: 'Неверные данные (отсутствует date или blocks)' });
    }

    db.run(
        `INSERT OR REPLACE INTO planner_days (date, blocks) VALUES (?, ?)`,
        [date, JSON.stringify(blocks)],
        function (err) {
            if (err) {
                console.error('Ошибка сохранения данных планера в БД:', err.message);
                return res.status(500).json({ error: 'Ошибка сохранения данных' });
            }
            res.status(200).json({ success: true });
        }
    );
});

// Отдаем index.html на любой другой запрос (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
