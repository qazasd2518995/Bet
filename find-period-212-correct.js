// 查找期号包含 212 的记录
import db from './db/config.js';

async function findPeriod212() {
    console.log('🔍 查找期号包含 212 的记录\n');

    try {
        // 1. 查询包含 212 的期号
        console.log('📌 步骤1：查询包含 212 的期号...');
        const periods = await db.manyOrNone(`
            SELECT DISTINCT period::text as period
            FROM bet_history
            WHERE period::text LIKE '%212'
            AND username = 'justin111'
            ORDER BY period DESC
            LIMIT 10
        `);

        if (periods.length > 0) {
            console.log(`找到 ${periods.length} 个包含 212 的期号：`);
            periods.forEach(p => console.log(`- ${p.period}`));
        }

        // 2. 查询 justin111 第10名投注号码5且显示中奖的记录
        console.log('\n📌 步骤2：查询第10名投注号码5且中奖的记录...');
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
            console.log(`\n找到 ${winningBets.length} 笔第10名投注号码5且中奖的记录：`);
            winningBets.forEach((bet, index) => {
                console.log(`\n${index + 1}. 期号：${bet.period}`);
                console.log(`   投注：第${bet.position}名 号码${bet.bet_value}`);
                console.log(`   实际开奖：第10名 = ${bet.actual_position_10}`);
                console.log(`   中奖金额：${bet.win_amount}`);
                console.log(`   赔率：${bet.odds}`);
                
                if (bet.actual_position_10 && parseInt(bet.bet_value) !== bet.actual_position_10) {
                    console.log(`   ❌ 错误：投注号码${bet.bet_value}，但开出号码${bet.actual_position_10}，不应该中奖！`);
                }
            });
        }

        // 3. 特别查找可能是 412 期的记录
        console.log('\n📌 步骤3：查询期号 20250717412...');
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
            console.log('\n找到期号 20250717412：');
            console.log(`开奖时间：${new Date(period412.draw_time).toLocaleString()}`);
            console.log(`第10名开奖号码：${period412.position_10}`);
            console.log(`完整结果：${JSON.stringify(period412.result)}`);
            
            // 查询这期的投注
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
                console.log('\n该期第10名的投注：');
                bets412.forEach(bet => {
                    console.log(`- 投注号码${bet.bet_value}：${bet.win ? '中奖' : '未中奖'} (中奖金额：${bet.win_amount || 0})`);
                });
            }
        }

    } catch (error) {
        console.error('查询失败：', error);
    }
}

// 执行查询
findPeriod212().then(() => {
    console.log('\n✅ 查询完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 错误：', error);
    process.exit(1);
});