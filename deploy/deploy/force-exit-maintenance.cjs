// 強制退出維護狀態並更新到今天的期號

const pgp = require('pg-promise')();

// 資料庫配置
const db = pgp({
    host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bet_game',
    user: 'bet_game_user',
    password: process.env.DB_PASSWORD || 'xwhBvNnqUgVLjqPWlKHclNZrNB5J3kLS',
    ssl: { rejectUnauthorized: false }
});

async function forceExitMaintenance() {
    try {
        console.log('=== 強制退出維護狀態 ===\n');
        
        // 獲取當前台北時間
        const taipeiTime = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
        console.log('當前台北時間:', taipeiTime);
        
        // 生成今天的第一個期號
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const newPeriod = `${year}${month}${day}001`;
        
        console.log('新期號:', newPeriod);
        
        // 更新遊戲狀態
        await db.none(`
            UPDATE game_state 
            SET current_period = $1,
                countdown_seconds = 60,
                status = 'betting',
                phase = 'betting',
                phase_start_time = CURRENT_TIMESTAMP
            WHERE id = 1
        `, [newPeriod]);
        
        console.log('✅ 遊戲狀態已更新');
        console.log('- 期號:', newPeriod);
        console.log('- 狀態: betting');
        console.log('- 倒計時: 60秒');
        
        // 驗證更新
        const gameState = await db.one('SELECT * FROM game_state WHERE id = 1');
        console.log('\n當前遊戲狀態:');
        console.log('- current_period:', gameState.current_period);
        console.log('- status:', gameState.status);
        console.log('- phase:', gameState.phase);
        console.log('- countdown_seconds:', gameState.countdown_seconds);
        
    } catch (error) {
        console.error('錯誤:', error);
    } finally {
        pgp.end();
    }
}

forceExitMaintenance();