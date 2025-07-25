// resettle-period-364.js - 重新结算期号 364
import db from './db/config.js';
import settlementSystem from './improved-settlement-system.js';

async function resettlePeriod364() {
    try {
        console.log('=== 重新结算期号 20250714364 ===\n');
        
        // 1. 获取开奖结果
        const result = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = $1
        `, [20250714364]);
        
        if (!result) {
            console.log('❌ 找不到期号 20250714364 的开奖结果！');
            return;
        }
        
        const resultArray = result.result.split ? result.result.split(',').map(Number) : result.result;
        const winResult = { positions: resultArray };
        
        console.log('开奖结果:', resultArray);
        console.log('冠军号码:', resultArray[0]);
        
        // 2. 获取该期所有注单
        const bets = await db.any(`
            SELECT * FROM bet_history 
            WHERE period = $1
            ORDER BY id
        `, [20250714364]);
        
        console.log(`\n找到 ${bets.length} 笔注单`);
        
        // 3. 重置注单状态
        console.log('\n重置注单状态...');
        await db.none(`
            UPDATE bet_history 
            SET settled = false, win = false, win_amount = 0
            WHERE period = $1
        `, [20250714364]);
        
        // 4. 使用改进的结算系统重新结算
        console.log('\n使用改进的结算系统重新结算...');
        const settlementResult = await settlementSystem.improvedSettleBets(20250714364, winResult);
        
        if (settlementResult.success) {
            console.log('\n✅ 结算成功！');
            console.log(`结算注单数: ${settlementResult.settledCount}`);
            console.log(`总中奖金额: $${settlementResult.totalWinAmount}`);
            
            if (settlementResult.userWinnings) {
                console.log('\n用户中奖明细:');
                for (const [username, amount] of Object.entries(settlementResult.userWinnings)) {
                    console.log(`  ${username}: $${amount}`);
                }
            }
        } else {
            console.log('\n❌ 结算失败:', settlementResult.reason);
        }
        
        // 5. 验证结算结果
        console.log('\n验证结算结果...');
        const verifyBets = await db.any(`
            SELECT 
                id,
                username,
                bet_type,
                bet_value,
                position,
                amount,
                win,
                win_amount,
                settled
            FROM bet_history 
            WHERE period = $1 AND position = 1
            ORDER BY id
        `, [20250714364]);
        
        console.log('\n冠军位置投注结果:');
        verifyBets.forEach(bet => {
            const status = bet.win ? '✅ 中奖' : '❌ 未中奖';
            console.log(`  用户: ${bet.username}, 号码: ${bet.bet_value}, ${status}, 赢金: $${bet.win_amount || 0}`);
        });
        
        // 6. 检查用户余额
        const users = [...new Set(bets.map(b => b.username))];
        console.log('\n用户余额检查:');
        for (const username of users) {
            const member = await db.oneOrNone(`
                SELECT balance FROM members WHERE username = $1
            `, [username]);
            if (member) {
                console.log(`  ${username}: $${member.balance}`);
            }
        }
        
    } catch (error) {
        console.error('重新结算过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行重新结算
resettlePeriod364();