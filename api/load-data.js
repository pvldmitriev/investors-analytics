const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Настройка PostgreSQL подключения к Render
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const client = await pool.connect();
        
        // Проверяем, есть ли данные
        const { rows } = await client.query('SELECT COUNT(*) FROM investors');
        console.log(`📊 Текущее количество записей в БД: ${rows[0].count}`);
        
        if (parseInt(rows[0].count) > 0) {
            client.release();
            return res.status(200).json({ success: true, message: 'Данные уже загружены', count: rows[0].count });
        }
        
        // Загружаем данные из файла
        const dataPath = path.join(process.cwd(), 'results', 'evaluated_profiles.ru_kz_by_full.json');
        console.log(`🔍 Проверяем файл данных: ${dataPath}`);
        
        if (!fs.existsSync(dataPath)) {
            client.release();
            return res.status(404).json({ success: false, error: 'Файл данных не найден' });
        }
        
        const rawData = fs.readFileSync(dataPath, 'utf8');
        const investors = JSON.parse(rawData);
        console.log(`📈 Найдено ${investors.length} инвесторов в файле`);

        let insertedCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < investors.length; i++) {
            const investor = investors[i];
            try {
                const name = `${investor['First Name'] || ''} ${investor['Last Name'] || ''}`.trim();
                const title = investor['Current Title'] || '';
                const company = investor['Current Company'] || '';
                const linkedin_url = investor['LinkedIn URL'] || '';
                const description = investor['Quotes'] || '';
                const rating = investor['investor_score'] || 0;

                const query = `
                    INSERT INTO investors (name, title, company, linkedin_url, description, rating)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (name) DO NOTHING
                `;
                
                const result = await client.query(query, [name, title, company, linkedin_url, description, rating]);
                
                if (result.rowCount > 0) {
                    insertedCount++;
                } else {
                    skippedCount++;
                }
            } catch (error) {
                console.error(`❌ Ошибка при обработке инвестора ${i + 1}:`, error);
            }
        }

        console.log(`✅ Загрузка завершена: ${insertedCount} добавлено, ${skippedCount} пропущено`);
        
        // Проверяем итоговое количество
        const { rows: finalRows } = await client.query('SELECT COUNT(*) FROM investors');
        console.log(`📊 Всего записей в БД: ${finalRows[0].count}`);
        
        client.release();
        res.status(200).json({ 
            success: true, 
            message: 'Данные загружены успешно',
            inserted: insertedCount,
            skipped: skippedCount,
            total: finalRows[0].count
        });
    } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}
