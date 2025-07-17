// check-bet-table.js - 檢查下注表結構
import db from './db/config.js';

async function checkBetTable() {
    console.log('🔍 檢查 bet_history 表結構...\n');
    
    try {
        // 1. 檢查表結構
        const columns = await db.any(`
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = 'bet_history'
            ORDER BY ordinal_position
        `);
        
        console.log('📊 bet_history 表結構:');
        columns.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
        });
        
        // 2. 檢查最近的下注記錄
        console.log('\n📋 最近的下注記錄:');
        const recentBets = await db.any(`
            SELECT 
                id,
                username,
                bet_type,
                bet_value,
                position,
                amount,
                period,
                win,
                win_amount,
                settled,
                created_at
            FROM bet_history
            WHERE username = 'justin111'
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        if (recentBets.length > 0) {
            recentBets.forEach(bet => {
                console.log(`\nID: ${bet.id}`);
                console.log(`  期號: ${bet.period}`);
                console.log(`  類型: ${bet.bet_type}`);
                console.log(`  值: ${bet.bet_value}`);
                console.log(`  位置: ${bet.position}`);
                console.log(`  金額: ${bet.amount}`);
                console.log(`  結算: ${bet.settled ? '是' : '否'}`);
                console.log(`  中獎: ${bet.win ? '是' : '否'}`);
                console.log(`  中獎金額: ${bet.win_amount || 0}`);
            });
        } else {
            console.log('沒有找到下注記錄');
        }
        
        // 3. 檢查位置映射
        console.log('\n📍 位置映射檢查:');
        console.log('champion 應該對應 position = 1');
        console.log('runnerup 應該對應 position = 2');
        console.log('third 應該對應 position = 3');
        console.log('...');
        
    } catch (error) {
        console.error('❌ 檢查過程中發生錯誤:', error);
    }
}

// 執行
checkBetTable()
    .then(() => {
        console.log('\n檢查完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('執行失敗:', error);
        process.exit(1);
    });