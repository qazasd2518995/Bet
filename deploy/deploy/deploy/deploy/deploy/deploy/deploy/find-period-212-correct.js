// 查找期號包含 212 的記錄
import db from './db/config.js';

async function findPeriod212() {
    console.log('🔍 查找期號包含 212 的記錄\n');

    try {
        // 1. 查詢包含 212 的期號
        console.log('📌 步驟1：查詢包含 212 的期號...');
        const periods = await db.manyOrNone(`
            SELECT DISTINCT period::text as period
            FROM bet_history
            WHERE period::text LIKE '%212'
            AND username = 'justin111'
            ORDER BY period DESC
            LIMIT 10
        `);

        if (periods.length > 0) {
            console.log(`找到 ${periods.length} 個包含 212 的期號：`);
            periods.forEach(p => console.log(`- ${p.period}`));
        }

        // 2. 查詢 justin111 第10名投注號碼5且顯示中獎的記錄
        console.log('\n📌 步驟2：查詢第10名投注號碼5且中獎的記錄...');
        const winningBets = await db.manyOrNone(`
            SELECT 
                bh.id,
                bh.period,
                bh.bet_type,
                bh.bet_value,
                bh.position,
                bh.amount,
                bh.odds,
                bh.win,
                bh.win_amount,
                rh.position_10 as actual_position_10,
                rh.result
            FROM bet_history bh
            LEFT JOIN result_history rh ON bh.period = rh.period
            WHERE bh.username = 'justin111'
            AND bh.position = '10'
            AND bh.bet_value = '5'
            AND bh.win = true
            AND bh.bet_type = 'number'
            ORDER BY bh.created_at DESC
            LIMIT 20
        `);

        if (winningBets.length > 0) {
            console.log(`\n找到 ${winningBets.length} 筆第10名投注號碼5且中獎的記錄：`);
            winningBets.forEach((bet, index) => {
                console.log(`\n${index + 1}. 期號：${bet.period}`);
                console.log(`   投注：第${bet.position}名 號碼${bet.bet_value}`);
                console.log(`   實際開獎：第10名 = ${bet.actual_position_10}`);
                console.log(`   中獎金額：${bet.win_amount}`);
                console.log(`   賠率：${bet.odds}`);
                
                if (bet.actual_position_10 && parseInt(bet.bet_value) !== bet.actual_position_10) {
                    console.log(`   ❌ 錯誤：投注號碼${bet.bet_value}，但開出號碼${bet.actual_position_10}，不應該中獎！`);
                }
            });
        }

        // 3. 特別查找可能是 412 期的記錄
        console.log('\n📌 步驟3：查詢期號 20250717412...');
        const period412 = await db.oneOrNone(`
            SELECT 
                period,
                result,
                position_10,
                draw_time
            FROM result_history
            WHERE period = '20250717412'
        `);

        if (period412) {
            console.log('\n找到期號 20250717412：');
            console.log(`開獎時間：${new Date(period412.draw_time).toLocaleString()}`);
            console.log(`第10名開獎號碼：${period412.position_10}`);
            console.log(`完整結果：${JSON.stringify(period412.result)}`);
            
            // 查詢這期的投注
            const bets412 = await db.manyOrNone(`
                SELECT 
                    bet_type,
                    bet_value,
                    position,
                    win,
                    win_amount
                FROM bet_history
                WHERE period = '20250717412'
                AND username = 'justin111'
                AND position = '10'
            `);
            
            if (bets412.length > 0) {
                console.log('\n該期第10名的投注：');
                bets412.forEach(bet => {
                    console.log(`- 投注號碼${bet.bet_value}：${bet.win ? '中獎' : '未中獎'} (中獎金額：${bet.win_amount || 0})`);
                });
            }
        }

    } catch (error) {
        console.error('查詢失敗：', error);
    }
}

// 執行查詢
findPeriod212().then(() => {
    console.log('\n✅ 查詢完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 錯誤：', error);
    process.exit(1);
});