const pgp = require('pg-promise')();

// 從 db/config.js 獲取正確的配置
const dbModule = require('./db/config.js');
const db = dbModule.db;

async function checkPeriods() {
    try {
        console.log('=== 檢查資料庫期號問題 ===\n');
        
        // 1. 檢查 recent_draws 表
        console.log('1. recent_draws 表最新5筆:');
        const recentDraws = await db.any(`
            SELECT period, draw_time, position_1, position_2, position_3
            FROM recent_draws
            ORDER BY draw_time DESC
            LIMIT 5
        `);
        
        recentDraws.forEach((row, index) => {
            const periodStr = row.period.toString();
            console.log(`   ${index + 1}. 期號: ${row.period}`);
            if (periodStr.length >= 8) {
                const year = periodStr.substring(0, 4);
                const month = periodStr.substring(4, 6);
                const day = periodStr.substring(6, 8);
                const seq = periodStr.substring(8);
                console.log(`      解析: ${year}-${month}-${day} 第${seq}期`);
                console.log(`      顯示格式: ${month}/${day} ${seq}期`);
            }
            console.log(`      開獎時間: ${row.draw_time}`);
            console.log(`      前3位: ${row.position_1}, ${row.position_2}, ${row.position_3}\n`);
        });
        
        // 2. 檢查 game_state
        console.log('\n2. 當前遊戲狀態:');
        const gameState = await db.oneOrNone('SELECT current_period, phase FROM game_state WHERE id = 1');
        if (gameState) {
            const currentPeriod = gameState.current_period;
            console.log(`   當前期號: ${currentPeriod}`);
            console.log(`   遊戲階段: ${gameState.phase}`);
            
            // 解析當前期號
            const periodStr = currentPeriod.toString();
            if (periodStr.length >= 8) {
                const seq = periodStr.substring(8);
                console.log(`   當前期號序號: ${seq}`);
            }
        }
        
        // 3. 檢查視圖
        console.log('\n3. v_api_recent_draws 視圖:');
        const apiView = await db.any(`
            SELECT period, formatted_time
            FROM v_api_recent_draws
            LIMIT 3
        `);
        
        apiView.forEach((row, index) => {
            console.log(`   ${index + 1}. 期號: ${row.period}, 時間: ${row.formatted_time}`);
        });
        
    } catch (error) {
        console.error('錯誤:', error.message);
    } finally {
        pgp.end();
    }
}

checkPeriods();