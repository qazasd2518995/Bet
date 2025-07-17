import pkg from 'pg';
const { Pool } = pkg;
import dbConfig from './db/config.js';

const pool = new Pool(dbConfig);

async function checkGameState() {
    try {
        console.log('檢查遊戲狀態...\n');
        
        // 查詢當前遊戲狀態
        const result = await pool.query('SELECT * FROM game_state ORDER BY id DESC LIMIT 1');
        
        if (result.rows.length > 0) {
            const state = result.rows[0];
            console.log('當前遊戲狀態：');
            console.log(`- ID: ${state.id}`);
            console.log(`- 期數: ${state.current_period}`);
            console.log(`- 狀態: ${state.status}`);
            console.log(`- 倒計時: ${state.countdown_seconds} 秒`);
            console.log(`- 最後結果: ${state.last_result}`);
            console.log(`- 更新時間: ${state.updated_at}`);
            
            // 計算時間差
            const now = new Date();
            const lastUpdate = new Date(state.updated_at);
            const timeDiff = Math.floor((now - lastUpdate) / 1000);
            console.log(`\n距離上次更新已過: ${timeDiff} 秒`);
            
            if (timeDiff > 5) {
                console.log('\n⚠️  警告：遊戲狀態超過5秒未更新，可能循環已停止！');
            }
            
            if (state.status === 'drawing' && state.countdown_seconds === 0) {
                console.log('\n❌ 問題：遊戲卡在 drawing 狀態且倒計時為 0！');
                console.log('這就是為什麼一直顯示"開獎中"的原因。');
            }
        } else {
            console.log('找不到遊戲狀態記錄');
        }
        
        // 查詢最近的結果歷史
        console.log('\n\n最近5筆開獎記錄：');
        const results = await pool.query('SELECT period, result, created_at FROM result_history ORDER BY period DESC LIMIT 5');
        
        results.rows.forEach(row => {
            console.log(`期數 ${row.period}: ${row.result} (${new Date(row.created_at).toLocaleString()})`);
        });
        
    } catch (error) {
        console.error('查詢失敗:', error.message);
    } finally {
        await pool.end();
    }
}

checkGameState();