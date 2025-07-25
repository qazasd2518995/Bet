import db from './db/config.js';

async function checkDrawResultFormat() {
    try {
        // 檢查最近的開獎結果格式
        const results = await db.any(`
            SELECT period, result 
            FROM result_history 
            ORDER BY period DESC 
            LIMIT 5
        `);
        
        console.log('最近5期開獎結果格式:');
        results.forEach(row => {
            console.log(`期數: ${row.period}`);
            console.log(`原始結果: ${row.result}`);
            console.log(`類型: ${typeof row.result}`);
            
            // 嘗試解析
            try {
                if (typeof row.result === 'string') {
                    const parsed = JSON.parse(row.result);
                    console.log('解析成功:', parsed);
                } else if (Array.isArray(row.result)) {
                    console.log('已經是陣列:', row.result);
                } else {
                    console.log('未知格式');
                }
            } catch (e) {
                console.log('解析失敗:', e.message);
            }
            console.log('---');
        });
        
        // 檢查 bet_history 表中的 draw_result
        const bets = await db.any(`
            SELECT bh.period, rh.result 
            FROM bet_history bh
            LEFT JOIN result_history rh ON bh.period = rh.period
            WHERE rh.result IS NOT NULL
            ORDER BY bh.id DESC 
            LIMIT 5
        `);
        
        console.log('\n最近的下注記錄中的開獎結果:');
        bets.forEach(bet => {
            console.log(`期數: ${bet.period}, 結果類型: ${typeof bet.result}`);
        });
        
    } catch (error) {
        console.error('檢查失敗:', error);
    } finally {
        await db.$pool.end();
    }
}

checkDrawResultFormat();