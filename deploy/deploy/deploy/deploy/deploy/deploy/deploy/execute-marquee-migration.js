import db from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function executeMigration() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'migrations/create_marquee_table.sql'), 'utf8');
        await db.none(sql);
        console.log('✅ 跑馬燈資料表創建成功');
    } catch (error) {
        if (error.message.includes('already exists')) {
            console.log('ℹ️ 跑馬燈資料表已存在');
        } else {
            console.error('❌ 創建跑馬燈資料表失敗:', error);
        }
    } finally {
        db.$pool.end();
    }
}

executeMigration();