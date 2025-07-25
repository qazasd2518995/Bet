// check-period-20250717449.js - 检查期号 20250717449 的结算错误
import db from './db/config.js';

async function checkPeriod449() {
    console.log('=== 检查期号 20250717449 结算错误 ===\n');
    
    try {
        // 1. 检查开奖结果
        console.log('1. 开奖结果:');
        const result = await db.oneOrNone(`
            SELECT 
                period,
                position_1, position_2, position_3, position_4, position_5,
                position_6, position_7, position_8, position_9, position_10,
                result,
                draw_time,
                created_at
            FROM result_history
            WHERE period = '20250717449'
        `);
        
        if (result) {
            console.log(`期号: ${result.period}`);
            console.log(`开奖时间: ${result.draw_time}`);
            console.log(`创建时间: ${result.created_at}`);
            console.log(`开奖结果:`);
            for (let i = 1; i <= 10; i++) {
                const pos = result[`position_${i}`];
                console.log(`  第${i}名: ${pos}号`);
            }
            console.log(`\n冠军号码: ${result.position_1} (${result.position_1 >= 6 ? '大' : '小'})`);
            console.log(`冠军是1号，应该是小！`);
        } else {
            console.log('找不到该期开奖结果！');
        }
        
        // 2. 检查相关投注
        console.log('\n2. 所有冠军大小投注:');
        const bets = await db.manyOrNone(`
            SELECT 
                id, username, bet_type, bet_value, position,
                amount, odds, win, win_amount, settled,
                created_at, settled_at
            FROM bet_history
            WHERE period = '20250717449'
            AND (
                (bet_type = '冠军' AND bet_value IN ('大', '小'))
                OR (bet_type = 'champion' AND bet_value IN ('big', 'small'))
            )
            ORDER BY created_at
        `);
        
        if (bets && bets.length > 0) {
            console.log(`找到 ${bets.length} 笔冠军大小投注：`);
            for (const bet of bets) {
                const shouldWin = (bet.bet_value === '小' || bet.bet_value === 'small');
                const correct = bet.win === shouldWin;
                console.log(`\n${correct ? '✅' : '❌'} 投注ID: ${bet.id}`);
                console.log(`  用户: ${bet.username}`);
                console.log(`  投注: ${bet.bet_type} ${bet.bet_value}`);
                console.log(`  金额: ${bet.amount}`);
                console.log(`  实际结果: ${bet.win ? '赢' : '输'} (应该${shouldWin ? '赢' : '输'})`);
                if (bet.win) {
                    console.log(`  派彩: ${bet.win_amount}`);
                }
                console.log(`  下注时间: ${bet.created_at}`);
                console.log(`  结算时间: ${bet.settled_at}`);
            }
        }
        
        // 3. 检查结算日志
        console.log('\n3. 结算日志:');
        const logs = await db.manyOrNone(`
            SELECT 
                id, status, message, details, created_at
            FROM settlement_logs
            WHERE period = '20250717449'
            ORDER BY created_at
        `);
        
        if (logs && logs.length > 0) {
            console.log(`找到 ${logs.length} 笔结算日志：`);
            for (const log of logs) {
                console.log(`\n日志ID: ${log.id}`);
                console.log(`  状态: ${log.status}`);
                console.log(`  讯息: ${log.message}`);
                if (log.details) {
                    try {
                        const details = JSON.parse(log.details);
                        console.log(`  详情:`, details);
                    } catch (e) {
                        console.log(`  详情: ${log.details}`);
                    }
                }
                console.log(`  时间: ${log.created_at}`);
            }
        }
        
        // 4. 检查该期所有投注的结算情况
        console.log('\n4. 该期所有投注统计:');
        const stats = await db.oneOrNone(`
            SELECT 
                COUNT(*) as total_bets,
                SUM(CASE WHEN settled = true THEN 1 ELSE 0 END) as settled_count,
                SUM(CASE WHEN win = true THEN 1 ELSE 0 END) as win_count,
                SUM(win_amount) as total_payout
            FROM bet_history
            WHERE period = '20250717449'
        `);
        
        if (stats) {
            console.log(`总投注数: ${stats.total_bets}`);
            console.log(`已结算数: ${stats.settled_count}`);
            console.log(`中奖数: ${stats.win_count}`);
            console.log(`总派彩: ${stats.total_payout}`);
        }
        
        // 5. 检查是否有多条开奖记录
        console.log('\n5. 检查开奖记录数量:');
        const recordCount = await db.oneOrNone(`
            SELECT COUNT(*) as count
            FROM result_history
            WHERE period = '20250717449'
        `);
        
        console.log(`期号 20250717449 有 ${recordCount.count} 条开奖记录`);
        
        if (recordCount.count > 1) {
            console.log('\n所有开奖记录:');
            const allRecords = await db.manyOrNone(`
                SELECT id, position_1, draw_time, created_at
                FROM result_history
                WHERE period = '20250717449'
                ORDER BY created_at
            `);
            
            for (const rec of allRecords) {
                console.log(`  ID: ${rec.id}, 冠军: ${rec.position_1}号, 开奖时间: ${rec.draw_time}, 创建时间: ${rec.created_at}`);
            }
        }
        
    } catch (error) {
        console.error('检查失败:', error);
    } finally {
        await db.$pool.end();
    }
}

checkPeriod449();