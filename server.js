const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
// На Amvera нет переменной PORT, а трафик идёт на 80.
// Локально bat-файл сам задаёт PORT=3000.
const PORT = process.env.PORT || 80;

app.use(cors());
app.use(express.json());

// Отдаем все статические файлы из текущей директории
app.use(express.static(__dirname));

// На Amvera данные хранятся в /data (persistent volume), локально — рядом с проектом
const DATA_DIR = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const MEETINGS_FILE = path.join(DATA_DIR, 'meetings.json');

// Чтение встреч
app.get('/api/meetings', (req, res) => {
    fs.readFile(MEETINGS_FILE, 'utf8', (err, data) => {
        if (err) {
            console.error('Ошибка чтения файла встреч:', err);
            return res.status(500).json({ error: 'Не удалось прочитать встречи' });
        }
        try {
            const meetings = JSON.parse(data || '[]');
            res.json(meetings);
        } catch (e) {
            res.json([]);
        }
    });
});

// Добавление новой встречи
app.post('/api/meetings', (req, res) => {
    const newMeeting = req.body;
    
    // Добавляем время сохранения на сервере
    newMeeting.timestamp = new Date().toISOString();

    fs.readFile(MEETINGS_FILE, 'utf8', (err, data) => {
        let meetings = [];
        if (!err && data) {
            try {
                meetings = JSON.parse(data);
            } catch (e) {
                meetings = [];
            }
        }
        
        meetings.push(newMeeting);
        
        fs.writeFile(MEETINGS_FILE, JSON.stringify(meetings, null, 2), (err) => {
            if (err) {
                console.error('Ошибка сохранения файла встреч:', err);
                return res.status(500).json({ error: 'Не удалось сохранить встречу' });
            }
            res.status(201).json({ success: true, meeting: newMeeting });
        });
    });
});

const PLANNER_DATA_FILE = path.join(DATA_DIR, 'planner_data.json');

// --- PLANNER DATA API ---
app.get('/api/planner/data', (req, res) => {
    fs.readFile(PLANNER_DATA_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Ошибка чтения данных' });
        try {
            res.json(JSON.parse(data || '{}'));
        } catch (e) {
            res.json({});
        }
    });
});

app.post('/api/planner/data', (req, res) => {
    // Ожидаем { date: "YYYY-MM-DD", blocks: [...] }
    const { date, blocks } = req.body;
    
    fs.readFile(PLANNER_DATA_FILE, 'utf8', (err, data) => {
        let allData = {};
        if (!err && data) {
            try { allData = JSON.parse(data); } catch(e) {}
        }
        
        allData[date] = blocks;
        
        fs.writeFile(PLANNER_DATA_FILE, JSON.stringify(allData, null, 2), (err) => {
            if (err) return res.status(500).json({ error: 'Ошибка сохранения данных' });
            res.status(200).json({ success: true });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
