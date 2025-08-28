const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(express.json());
app.use(express.static('.'));

// Инициализация базы данных
async function initDatabase() {
    try {
        const client = await pool.connect();
        
        // Создание таблиц
        const createTablesSQL = `
            -- Создание таблицы инвесторов
            CREATE TABLE IF NOT EXISTS investors (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                title TEXT,
                company TEXT,
                linkedin_url TEXT,
                email TEXT,
                phone TEXT,
                location TEXT,
                industry TEXT,
                investment_stage TEXT,
                investment_size TEXT,
                portfolio_companies JSONB,
                description TEXT,
                rating INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Создание таблицы прогресса по владельцам
            CREATE TABLE IF NOT EXISTS owner_progress (
                id SERIAL PRIMARY KEY,
                investor_id INTEGER REFERENCES investors(id) ON DELETE CASCADE,
                owner_name TEXT NOT NULL CHECK (owner_name IN ('Антон', 'Павел')),
                stage TEXT NOT NULL CHECK (stage IN ('INV', 'ACC', 'RESP-I', 'MSG', 'RESP-M', 'INT', 'CALL', 'NEXT')),
                is_active BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(investor_id, owner_name, stage)
            );

            -- Создание таблицы заметок
            CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                investor_id INTEGER REFERENCES investors(id) ON DELETE CASCADE,
                note_text TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Создание таблицы логов
            CREATE TABLE IF NOT EXISTS logs (
                id SERIAL PRIMARY KEY,
                action_type TEXT NOT NULL,
                action_data JSONB,
                user_agent TEXT,
                ip_address TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Создание индексов
            CREATE INDEX IF NOT EXISTS idx_investors_name ON investors(name);
            CREATE INDEX IF NOT EXISTS idx_investors_company ON investors(company);
            CREATE INDEX IF NOT EXISTS idx_owner_progress_investor ON owner_progress(investor_id);
            CREATE INDEX IF NOT EXISTS idx_owner_progress_owner ON owner_progress(owner_name);
            CREATE INDEX IF NOT EXISTS idx_notes_investor ON notes(investor_id);
            CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
        `;

        await client.query(createTablesSQL);
        console.log('✅ Таблицы созданы успешно');

        // Проверяем, есть ли данные в таблице investors
        const { rows } = await client.query('SELECT COUNT(*) FROM investors');
        if (parseInt(rows[0].count) === 0) {
            console.log('📊 Загружаем данные инвесторов...');
            await loadInvestorData(client);
        }

        client.release();
    } catch (error) {
        console.error('❌ Ошибка инициализации БД:', error);
    }
}

// Загрузка данных инвесторов
async function loadInvestorData(client) {
    try {
        const dataPath = path.join(__dirname, 'results', 'evaluated_profiles.ru_kz_by_full.json');
        if (!fs.existsSync(dataPath)) {
            console.log('⚠️ Файл данных не найден, пропускаем загрузку');
            return;
        }

        const rawData = fs.readFileSync(dataPath, 'utf8');
        const investors = JSON.parse(rawData);

        console.log(`📈 Загружаем ${investors.length} инвесторов...`);

        for (const investor of investors) {
            const query = `
                INSERT INTO investors (name, title, company, linkedin_url, description, rating)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (name) DO NOTHING
            `;
            
            await client.query(query, [
                `${investor['First Name'] || ''} ${investor['Last Name'] || ''}`.trim(),
                investor['Current Title'] || '',
                investor['Current Company'] || '',
                investor['LinkedIn URL'] || '',
                investor['Quotes'] || '',
                investor['investor_score'] || 0
            ]);
        }

        console.log('✅ Данные инвесторов загружены');
    } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
    }
}

// API Routes
app.get('/api/investors', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query(`
            SELECT i.*, 
                   op.owner_name, op.stage, op.is_active,
                   n.note_text
            FROM investors i
            LEFT JOIN owner_progress op ON i.id = op.investor_id
            LEFT JOIN notes n ON i.id = n.investor_id
            ORDER BY i.name
        `);
        client.release();
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Ошибка получения инвесторов:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/progress', async (req, res) => {
    try {
        const { investor_id, owner_name, stage, is_active } = req.body;
        const client = await pool.connect();
        
        // Удаляем существующий прогресс
        await client.query('DELETE FROM owner_progress WHERE investor_id = $1 AND owner_name = $2', [investor_id, owner_name]);
        
        if (is_active && stage) {
            // Добавляем новый прогресс
            await client.query(
                'INSERT INTO owner_progress (investor_id, owner_name, stage, is_active) VALUES ($1, $2, $3, $4)',
                [investor_id, owner_name, stage, true]
            );
            
            // Логируем действие
            await client.query(
                'INSERT INTO logs (action_type, action_data) VALUES ($1, $2)',
                ['PROGRESS_UPDATE', JSON.stringify({ investor_id, owner_name, stage, is_active })]
            );
        }
        
        client.release();
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка обновления прогресса:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/notes', async (req, res) => {
    try {
        const { investor_id, note_text } = req.body;
        const client = await pool.connect();
        
        // Удаляем существующую заметку
        await client.query('DELETE FROM notes WHERE investor_id = $1', [investor_id]);
        
        if (note_text && note_text.trim()) {
            // Добавляем новую заметку
            await client.query(
                'INSERT INTO notes (investor_id, note_text) VALUES ($1, $2)',
                [investor_id, note_text.trim()]
            );
            
            // Логируем действие
            await client.query(
                'INSERT INTO logs (action_type, action_data) VALUES ($1, $2)',
                ['NOTE_UPDATE', JSON.stringify({ investor_id, note_text: note_text.trim() })]
            );
        }
        
        client.release();
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка сохранения заметки:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/logs', async (req, res) => {
    try {
        const { action_type, limit = 100, offset = 0 } = req.query;
        const client = await pool.connect();
        
        let query = 'SELECT * FROM logs ORDER BY created_at DESC LIMIT $1 OFFSET $2';
        let params = [parseInt(limit), parseInt(offset)];
        
        if (action_type) {
            query = 'SELECT * FROM logs WHERE action_type = $3 ORDER BY created_at DESC LIMIT $1 OFFSET $2';
            params = [parseInt(limit), parseInt(offset), action_type];
        }
        
        const result = await client.query(query, params);
        client.release();
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Ошибка получения логов:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Запуск сервера
app.listen(PORT, async () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    await initDatabase();
});

module.exports = app;
