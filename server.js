const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
// На Amvera нет переменной PORT, а трафик идёт на 80.
// Локально bat-файл сам задаёт PORT=3000.
const PORT = process.env.PORT || 80;

app.use(cors());
app.use(express.json());

// Отдаем все статические файлы из текущей директории
app.use(express.static(__dirname));

// На Amvera данные хранятся в /data (persistent volume), локально — в директории проекта
const DATA_DIR = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

// Инициализация базы данных SQLite
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных SQLite:', err.message);
    } else {
        console.log('Успешное подключение к SQLite базе данных:', DB_PATH);
        initDatabase();
    }
});

function initDatabase() {
    db.serialize(() => {
        // Таблица для данных планировщика (date - уникальная дата "YYYY-MM-DD")
        db.run(`CREATE TABLE IF NOT EXISTS planner_data (
            date TEXT PRIMARY KEY,
            blocks TEXT
        )`);

        // Таблица для встреч
        db.run(`CREATE TABLE IF NOT EXISTS meetings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT,
            timestamp TEXT
        )`);

        // Однократная автоматическая миграция со старых JSON файлов, если они есть
        migrateJsonData();
    });
}

function migrateJsonData() {
    const plannerJsonPath = fs.existsSync(path.join(DATA_DIR, 'planner_data.json'))
        ? path.join(DATA_DIR, 'planner_data.json')
        : path.join(__dirname, 'planner_data.json');

    const meetingsJsonPath = fs.existsSync(path.join(DATA_DIR, 'meetings.json'))
        ? path.join(DATA_DIR, 'meetings.json')
        : path.join(__dirname, 'meetings.json');

    // Миграция данных планировщика
    if (fs.existsSync(plannerJsonPath)) {
        try {
            const raw = fs.readFileSync(plannerJsonPath, 'utf8');
            const parsed = JSON.parse(raw || '{}');
            const stmt = db.prepare(`INSERT OR IGNORE INTO planner_data (date, blocks) VALUES (?, ?)`);
            for (const [dateKey, blocksVal] of Object.entries(parsed)) {
                stmt.run(dateKey, JSON.stringify(blocksVal));
            }
            stmt.finalize();
            console.log('Имеющиеся данные planner_data.json импортированы в SQLite.');
        } catch (e) {
            console.error('Ошибка чтения planner_data.json при миграции:', e);
        }
    }

    // Миграция встреч
    if (fs.existsSync(meetingsJsonPath)) {
        try {
            const raw = fs.readFileSync(meetingsJsonPath, 'utf8');
            const meetingsArr = JSON.parse(raw || '[]');
            if (Array.isArray(meetingsArr) && meetingsArr.length > 0) {
                db.get("SELECT COUNT(*) as count FROM meetings", (err, row) => {
                    if (!err && row.count === 0) {
                        const stmt = db.prepare(`INSERT INTO meetings (data, timestamp) VALUES (?, ?)`);
                        meetingsArr.forEach(m => {
                            stmt.run(JSON.stringify(m), m.timestamp || new Date().toISOString());
                        });
                        stmt.finalize();
                        console.log('Имеющиеся встречи из meetings.json импортированы в SQLite.');
                    }
                });
            }
        } catch (e) {
            console.error('Ошибка чтения meetings.json при миграции:', e);
        }
    }
}

// --- MEETINGS API ---
app.get('/api/meetings', (req, res) => {
    db.all("SELECT * FROM meetings ORDER BY id ASC", [], (err, rows) => {
        if (err) {
            console.error('Ошибка чтения встреч из БД:', err);
            return res.status(500).json({ error: 'Не удалось прочитать встречи' });
        }
        const meetings = (rows || []).map(r => {
            try {
                const parsed = JSON.parse(r.data);
                return { ...parsed, id: r.id, timestamp: r.timestamp };
            } catch (e) {
                return { id: r.id, timestamp: r.timestamp };
            }
        });
        res.json(meetings);
    });
});

app.post('/api/meetings', (req, res) => {
    const newMeeting = req.body;
    const timestamp = new Date().toISOString();
    newMeeting.timestamp = timestamp;
    const dataStr = JSON.stringify(newMeeting);

    db.run("INSERT INTO meetings (data, timestamp) VALUES (?, ?)", [dataStr, timestamp], function (err) {
        if (err) {
            console.error('Ошибка сохранения встречи в БД:', err);
            return res.status(500).json({ error: 'Не удалось сохранить встречу' });
        }
        res.status(201).json({ success: true, meeting: { ...newMeeting, id: this.lastID } });
    });
});

// --- PLANNER DATA API ---
app.get('/api/planner/data', (req, res) => {
    db.all("SELECT date, blocks FROM planner_data", [], (err, rows) => {
        if (err) {
            console.error('Ошибка чтения данных планера из БД:', err);
            return res.status(500).json({ error: 'Ошибка чтения данных' });
        }
        const result = {};
        (rows || []).forEach(r => {
            try {
                result[r.date] = JSON.parse(r.blocks);
            } catch (e) {
                result[r.date] = {};
            }
        });
        res.json(result);
    });
});

app.post('/api/planner/data', (req, res) => {
    const { date, blocks } = req.body;
    if (!date) return res.status(400).json({ error: 'Дата не указана' });

    const blocksStr = JSON.stringify(blocks || {});
    db.run(
        `INSERT INTO planner_data (date, blocks) VALUES (?, ?)
         ON CONFLICT(date) DO UPDATE SET blocks=excluded.blocks`,
        [date, blocksStr],
        (err) => {
            if (err) {
                console.error('Ошибка сохранения планера в БД:', err);
                return res.status(500).json({ error: 'Ошибка сохранения данных' });
            }
            res.status(200).json({ success: true });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
