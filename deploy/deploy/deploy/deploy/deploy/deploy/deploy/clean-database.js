#!/usr/bin/env node

import pgPromise from 'pg-promise';
import readline from 'readline';

const pgp = pgPromise();

// 數據庫配置 - 根據環境自動選擇
const isRender = process.env.NODE_ENV === 'production' || process.env.RENDER;
const dbConfig = isRender ? {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
} : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'bet_game',
    user: process.env.DB_USER || 'justin',
    password: process.env.DB_PASSWORD
};

const db = pgp(dbConfig);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function askQuestion(question) {
    return new Promise(resolve => {
        rl.question(question, resolve);
    });
}

async function cleanDatabase() {
    try {
        console.log('🔍 開始數據庫清理分析...\n');
        console.log(`📡 連接環境: ${isRender ? 'Render Production' : 'Local Development'}`);

        // 1. 分析當前數據狀況
        console.log('\n=== 數據分析 ===');
        
        const totalCount = await db.one('SELECT COUNT(*) as count FROM result_history');
        console.log(`📊 總開獎記錄數: ${totalCount.count}`);

        // 檢查異常期號
        console.log('\n🔍 檢查異常數據...');
        
        // 檢查期號長度異常的記錄
        const abnormalLength = await db.any(`
            SELECT period, LENGTH(period::text) as len, created_at 
            FROM result_history 
            WHERE LENGTH(period::text) NOT IN (11, 12)
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        if (abnormalLength.length > 0) {
            console.log(`❌ 發現 ${abnormalLength.length} 條期號長度異常的記錄:`);
            abnormalLength.forEach((r, i) => {
                console.log(`  ${i+1}. 期號: ${r.period} (長度: ${r.len}), 時間: ${r.created_at}`);
            });
        }

        // 檢查包含特殊字符的期號
        const specialChars = await db.any(`
            SELECT period, created_at 
            FROM result_history 
            WHERE period::text ~ '[^0-9]' OR period::text LIKE '%1111%'
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        if (specialChars.length > 0) {
            console.log(`❌ 發現 ${specialChars.length} 條包含異常字符的期號:`);
            specialChars.forEach((r, i) => {
                console.log(`  ${i+1}. 期號: ${r.period}, 時間: ${r.created_at}`);
            });
        }

        // 檢查舊格式期號（12位數字）
        const oldFormatCount = await db.one(`
            SELECT COUNT(*) as count 
            FROM result_history 
            WHERE LENGTH(period::text) = 12 AND period::text ~ '^202[0-9]{9}$'
        `);
        console.log(`🗓️ 舊格式期號數量: ${oldFormatCount.count} 條`);

        // 檢查新格式期號（11位數字，YYYYMMDDXXX）
        const newFormatCount = await db.one(`
            SELECT COUNT(*) as count 
            FROM result_history 
            WHERE LENGTH(period::text) = 11 AND period::text ~ '^202[0-9]{8}$'
        `);
        console.log(`📅 新格式期號數量: ${newFormatCount.count} 條`);

        // 檢查今日數據
        const today = new Date();
        const todayStr = `${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2,'0')}${today.getDate().toString().padStart(2,'0')}`;
        const todayCount = await db.one('SELECT COUNT(*) as count FROM result_history WHERE period::text LIKE $1', [`${todayStr}%`]);
        console.log(`📋 今日(${todayStr})數據: ${todayCount.count} 條`);

        console.log('\n=== 清理選項 ===');
        console.log('1. 刪除異常長度的期號記錄');
        console.log('2. 刪除包含特殊字符的期號記錄');
        console.log('3. 刪除舊格式期號記錄 (保留最近7天的新格式數據)');
        console.log('4. 只保留今日數據 (刪除所有歷史數據)');
        console.log('5. 全面清理 (選項1+2+3)');
        console.log('6. 重置所有數據 (刪除所有記錄，重新開始)');
        console.log('0. 取消操作');

        const choice = await askQuestion('\n請選擇清理選項 (0-6): ');

        switch (choice) {
            case '1':
                await cleanAbnormalLength();
                break;
            case '2':
                await cleanSpecialCharacters();
                break;
            case '3':
                await cleanOldFormat();
                break;
            case '4':
                await keepTodayOnly(todayStr);
                break;
            case '5':
                await fullCleanup();
                break;
            case '6':
                await resetAllData();
                break;
            case '0':
                console.log('❌ 操作已取消');
                break;
            default:
                console.log('❌ 無效選項');
        }

    } catch (error) {
        console.error('❌ 清理過程出錯:', error);
    } finally {
        rl.close();
        db.$pool.end();
    }
}

async function cleanAbnormalLength() {
    console.log('\n🧹 清理異常長度期號...');
    const result = await db.result(`
        DELETE FROM result_history 
        WHERE LENGTH(period::text) NOT IN (11, 12)
    `);
    console.log(`✅ 已刪除 ${result.rowCount} 條異常長度記錄`);
}

async function cleanSpecialCharacters() {
    console.log('\n🧹 清理特殊字符期號...');
    const result = await db.result(`
        DELETE FROM result_history 
        WHERE period::text ~ '[^0-9]' OR period::text LIKE '%1111%'
    `);
    console.log(`✅ 已刪除 ${result.rowCount} 條特殊字符記錄`);
}

async function cleanOldFormat() {
    console.log('\n🧹 清理舊格式期號（保留最近7天新格式數據）...');
    
    // 計算7天前的日期
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysStr = `${sevenDaysAgo.getFullYear()}${(sevenDaysAgo.getMonth()+1).toString().padStart(2,'0')}${sevenDaysAgo.getDate().toString().padStart(2,'0')}`;
    
    const result = await db.result(`
        DELETE FROM result_history 
        WHERE LENGTH(period::text) = 12 
        OR (LENGTH(period::text) = 11 AND period::text < $1)
    `, [`${sevenDaysStr}000`]);
    
    console.log(`✅ 已刪除 ${result.rowCount} 條舊格式記錄`);
}

async function keepTodayOnly(todayStr) {
    console.log(`\n🧹 只保留今日(${todayStr})數據...`);
    
    const confirm = await askQuestion('⚠️  這將刪除所有歷史數據，只保留今日數據。確定繼續嗎？(yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
        console.log('❌ 操作已取消');
        return;
    }
    
    const result = await db.result(`
        DELETE FROM result_history 
        WHERE NOT period::text LIKE $1
    `, [`${todayStr}%`]);
    
    console.log(`✅ 已刪除 ${result.rowCount} 條歷史記錄`);
}

async function fullCleanup() {
    console.log('\n🧹 執行全面清理...');
    
    // 先清理異常數據
    await cleanAbnormalLength();
    await cleanSpecialCharacters();
    await cleanOldFormat();
    
    console.log('✅ 全面清理完成');
}

async function resetAllData() {
    console.log('\n⚠️  重置所有數據');
    
    const confirm1 = await askQuestion('這將刪除所有開獎記錄，確定繼續嗎？(yes/no): ');
    if (confirm1.toLowerCase() !== 'yes') {
        console.log('❌ 操作已取消');
        return;
    }
    
    const confirm2 = await askQuestion('最後確認：真的要刪除所有數據嗎？(DELETE): ');
    if (confirm2 !== 'DELETE') {
        console.log('❌ 操作已取消');
        return;
    }
    
    const result = await db.result('DELETE FROM result_history');
    console.log(`✅ 已刪除所有 ${result.rowCount} 條記錄`);
    
    // 重置序列
    await db.none('ALTER SEQUENCE result_history_id_seq RESTART WITH 1');
    console.log('✅ 已重置ID序列');
}

// 執行清理
cleanDatabase().catch(console.error); 