const pgp = require('pg-promise')();
const { Pool } = require('pg');

// 直接使用 Render 配置
const dbConfig = {
    host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bet_game',
    user: 'bet_game_user',
    password: 'xwhBvNnqUgVLjqPWlKHclNZrNB5J3kLS',
    ssl: { rejectUnauthorized: false }
};

const db = pgp(dbConfig);

async function checkPeriodIssue() {
    try {
        console.log('=== 檢查期號顯示問題 ===\n');
        
        // 1. 檢查當前遊戲狀態
        const currentGame = await db.oneOrNone(`
            SELECT current_period, phase, phase_start_time 
            FROM game_state 
            WHERE id = 1
        `);
        console.log('1. 當前遊戲狀態:');
        console.log(`   - 當前期號: ${currentGame.current_period}`);
        console.log(`   - 遊戲階段: ${currentGame.phase}`);
        console.log(`   - 階段開始時間: ${currentGame.phase_start_time}`);
        
        // 2. 檢查 recent_draws 表
        console.log('\n2. Recent Draws 表內容:');
        const recentDraws = await db.any(`
            SELECT period, draw_time, 
                   position_1, position_2, position_3, position_4, position_5
            FROM recent_draws 
            ORDER BY draw_time DESC 
            LIMIT 5
        `);
        
        recentDraws.forEach((draw, index) => {
            console.log(`   ${index + 1}. 期號: ${draw.period}`);
            console.log(`      開獎時間: ${draw.draw_time}`);
            console.log(`      前5位: ${draw.position_1}, ${draw.position_2}, ${draw.position_3}, ${draw.position_4}, ${draw.position_5}`);
            
            // 分析期號格式
            const periodStr = draw.period.toString();
            if (periodStr.length >= 8) {
                const year = periodStr.substring(0, 4);
                const month = periodStr.substring(4, 6);
                const day = periodStr.substring(6, 8);
                const seq = periodStr.substring(8);
                console.log(`      解析: ${year}年${month}月${day}日 第${seq}期`);
            }
        });
        
        // 3. 檢查 result_history 表
        console.log('\n3. Result History 表內容:');
        const resultHistory = await db.any(`
            SELECT period, draw_time, 
                   position_1, position_2, position_3, position_4, position_5
            FROM result_history 
            WHERE draw_time IS NOT NULL
            ORDER BY draw_time DESC 
            LIMIT 5
        `);
        
        resultHistory.forEach((result, index) => {
            console.log(`   ${index + 1}. 期號: ${result.period}`);
            console.log(`      開獎時間: ${result.draw_time}`);
            console.log(`      前5位: ${result.position_1}, ${result.position_2}, ${result.position_3}, ${result.position_4}, ${result.position_5}`);
        });
        
        // 4. 檢查視圖 v_api_recent_draws
        console.log('\n4. API 視圖內容 (v_api_recent_draws):');
        const apiView = await db.any(`
            SELECT period, formatted_time, 
                   position_1, position_2, position_3
            FROM v_api_recent_draws 
            LIMIT 5
        `);
        
        apiView.forEach((view, index) => {
            console.log(`   ${index + 1}. 期號: ${view.period}`);
            console.log(`      格式化時間: ${view.formatted_time}`);
            console.log(`      前3位: ${view.position_1}, ${view.position_2}, ${view.position_3}`);
        });
        
        // 5. 檢查期號一致性
        console.log('\n5. 期號一致性檢查:');
        const currentPeriodNum = parseInt(currentGame.current_period.toString().substring(8));
        const latestDrawPeriodNum = recentDraws.length > 0 ? 
            parseInt(recentDraws[0].period.toString().substring(8)) : 0;
        
        console.log(`   - 當前期號序號: ${currentPeriodNum}`);
        console.log(`   - 最新開獎序號: ${latestDrawPeriodNum}`);
        console.log(`   - 差異: ${currentPeriodNum - latestDrawPeriodNum} 期`);
        
        if (currentPeriodNum - latestDrawPeriodNum > 10) {
            console.log(`   ⚠️ 警告: 期號差異過大，可能存在同步問題！`);
        }
        
    } catch (error) {
        console.error('檢查錯誤:', error);
    } finally {
        pgp.end();
    }
}

checkPeriodIssue();