// manual-settle-234.js - 手动结算期号234
import db from './db/config.js';
import { improvedSettleBets } from './improved-settlement-system.js';

async function manualSettle234() {
    console.log('🔧 手动结算期号 20250714234...\n');
    
    try {
        // 1. 获取开奖结果
        const result = await db.one(`
            SELECT period, result
            FROM result_history
            WHERE period = 20250714234
        `);
        
        console.log(`📊 期号: ${result.period}`);
        console.log(`开奖结果: ${result.result}`);
        
        // 解析开奖结果
        let positions = [];
        if (Array.isArray(result.result)) {
            positions = result.result;
        } else if (typeof result.result === 'string') {
            positions = result.result.split(',').map(n => parseInt(n.trim()));
        }
        
        console.log(`解析后结果: [${positions.join(',')}]`);
        console.log(`第4名开出: ${positions[3]}号\n`);
        
        // 2. 准备结算数据
        const winResult = { positions: positions };
        console.log(`准备结算数据: ${JSON.stringify(winResult)}\n`);
        
        // 3. 执行结算
        console.log('🎯 开始执行结算...');
        
        const settlementResult = await improvedSettleBets(20250714234, winResult);
        
        if (settlementResult.success) {
            console.log('\n✅ 结算成功！');
            console.log(`结算注单数: ${settlementResult.settledCount}`);
            console.log(`总中奖金额: $${settlementResult.totalWinAmount || 0}`);
            
            if (settlementResult.userWinnings && Object.keys(settlementResult.userWinnings).length > 0) {
                console.log('\n💰 中奖详情:');
                Object.entries(settlementResult.userWinnings).forEach(([username, amount]) => {
                    console.log(`  ${username}: $${amount}`);
                });
            } else {
                console.log('\n📋 本期无中奖注单');
            }
        } else {
            console.log(`\n❌ 结算失败: ${settlementResult.reason}`);
        }
        
        // 4. 验证结算结果
        console.log('\n🔍 验证结算结果...');
        
        const verifyBets = await db.any(`
            SELECT id, bet_value, win, win_amount, settled, settled_at
            FROM bet_history
            WHERE period = 20250714234
            AND position = 4
            ORDER BY id ASC
        `);
        
        console.log('\n第4名投注结算结果:');
        verifyBets.forEach(bet => {
            const shouldWin = parseInt(bet.bet_value) === positions[3]; // 第4名是positions[3]
            const status = bet.settled ? '✅ 已结算' : '❌ 未结算';
            const winStatus = bet.win ? `中奖 $${bet.win_amount}` : '未中奖';
            const correct = shouldWin === bet.win ? '✅' : '❌';
            
            console.log(`${status} ID ${bet.id}: 投注${bet.bet_value}号, ${winStatus} ${correct}`);
        });
        
        console.log('\n✅ 期号234手动结算完成！');
        
    } catch (error) {
        console.error('手动结算过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行手动结算
manualSettle234();