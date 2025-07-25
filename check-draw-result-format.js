import db from './db/config.js';

async function checkDrawResultFormat() {
    try {
        // 检查最近的开奖结果格式
        const results = await db.any(`
            SELECT period, result 
            FROM result_history 
            ORDER BY period DESC 
            LIMIT 5
        `);
        
        console.log('最近5期开奖结果格式:');
        results.forEach(row => {
            console.log(`期数: ${row.period}`);
            console.log(`原始结果: ${row.result}`);
            console.log(`类型: ${typeof row.result}`);
            
            // 尝试解析
            try {
                if (typeof row.result === 'string') {
                    const parsed = JSON.parse(row.result);
                    console.log('解析成功:', parsed);
                } else if (Array.isArray(row.result)) {
                    console.log('已经是阵列:', row.result);
                } else {
                    console.log('未知格式');
                }
            } catch (e) {
                console.log('解析失败:', e.message);
            }
            console.log('---');
        });
        
        // 检查 bet_history 表中的 draw_result
        const bets = await db.any(`
            SELECT bh.period, rh.result 
            FROM bet_history bh
            LEFT JOIN result_history rh ON bh.period = rh.period
            WHERE rh.result IS NOT NULL
            ORDER BY bh.id DESC 
            LIMIT 5
        `);
        
        console.log('\n最近的下注记录中的开奖结果:');
        bets.forEach(bet => {
            console.log(`期数: ${bet.period}, 结果类型: ${typeof bet.result}`);
        });
        
    } catch (error) {
        console.error('检查失败:', error);
    } finally {
        await db.$pool.end();
    }
}

checkDrawResultFormat();