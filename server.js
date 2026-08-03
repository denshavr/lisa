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

// На Amvera данные хранятся в /data (persistent volume), локально — в директории проекта
const DATA_DIR = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

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

// Инициализация WebAssembly SQLite (работает везде без бинарных зависимостей)
initSqlJs().then((SQL) => {
    try {
        if (fs.existsSync(DB_PATH)) {
            const filebuffer = fs.readFileSync(DB_PATH);
            db = new SQL.Database(filebuffer);
            console.log('Успешно загружена база данных SQLite из файла:', DB_PATH);
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

    // Однократный импорт со старых JSON файлов при необходимости
    migrateJsonData();
    saveDb();
}

function migrateJsonData() {
    const plannerJsonPath = fs.existsSync(path.join(DATA_DIR, 'planner_data.json'))
        ? path.join(DATA_DIR, 'planner_data.json')
        : path.join(__dirname, 'planner_data.json');

    const meetingsJsonPath = fs.existsSync(path.join(DATA_DIR, 'meetings.json'))
        ? path.join(DATA_DIR, 'meetings.json')
        : path.join(__dirname, 'meetings.json');

    if (fs.existsSync(plannerJsonPath)) {
        try {
            const raw = fs.readFileSync(plannerJsonPath, 'utf8');
            const parsed = JSON.parse(raw || '{}');
            for (const [dateKey, blocksVal] of Object.entries(parsed)) {
                db.run(`INSERT OR IGNORE INTO planner_data (date, blocks) VALUES (?, ?)`, [dateKey, JSON.stringify(blocksVal)]);
            }
            console.log('Имеющиеся данные planner_data.json импортированы в SQLite.');
        } catch (e) {
            console.error('Ошибка миграции planner_data.json:', e);
        }
    }

    if (fs.existsSync(meetingsJsonPath)) {
        try {
            const raw = fs.readFileSync(meetingsJsonPath, 'utf8');
            const meetingsArr = JSON.parse(raw || '[]');
            if (Array.isArray(meetingsArr) && meetingsArr.length > 0) {
                const res = db.exec("SELECT COUNT(*) as count FROM meetings");
                const count = (res[0] && res[0].values[0] && res[0].values[0][0]) || 0;
                if (count === 0) {
                    meetingsArr.forEach(m => {
                        db.run(`INSERT INTO meetings (data, timestamp) VALUES (?, ?)`, [JSON.stringify(m), m.timestamp || new Date().toISOString()]);
                    });
                    console.log('Имеющиеся встречи из meetings.json импортированы в SQLite.');
                }
            }
        } catch (e) {
            console.error('Ошибка миграции meetings.json:', e);
        }
    }
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

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
