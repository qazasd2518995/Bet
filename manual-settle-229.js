// manual-settle-229.js - 手动结算期号229
import db from './db/config.js';
import { improvedSettleBets } from './improved-settlement-system.js';

async function manualSettle229() {
    console.log('🔧 手动结算期号 20250714229...\n');
    
    try {
        // 1. 获取开奖结果
        const result = await db.one(`
            SELECT period, result
            FROM result_history
            WHERE period = 20250714229
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
        console.log(`第6名开出: ${positions[5]}号\n`);
        
        // 2. 检查未结算的注单
        const unsettledBets = await db.any(`
            SELECT id, username, bet_type, bet_value, position, amount, odds
            FROM bet_history
            WHERE period = 20250714229
            AND settled = false
        `);
        
        console.log(`找到 ${unsettledBets.length} 笔未结算注单`);
        
        // 3. 准备结算数据
        const winResult = { positions: positions };
        console.log(`准备结算数据: ${JSON.stringify(winResult)}\n`);
        
        // 4. 执行结算
        console.log('🎯 开始执行结算...');
        
        const settlementResult = await improvedSettleBets(20250714229, winResult);
        
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
        
        // 5. 验证结算结果
        console.log('\n🔍 验证结算结果...');
        
        const verifyBets = await db.any(`
            SELECT id, bet_value, win, win_amount, settled, settled_at
            FROM bet_history
            WHERE period = 20250714229
            AND position = 6
            ORDER BY id ASC
        `);
        
        console.log('\n第6名投注结算结果:');
        verifyBets.forEach(bet => {
            const shouldWin = parseInt(bet.bet_value) === positions[5]; // 第6名是positions[5]
            const status = bet.settled ? '✅ 已结算' : '❌ 未结算';
            const winStatus = bet.win ? `中奖 $${bet.win_amount}` : '未中奖';
            const correct = shouldWin === bet.win ? '✅' : '❌';
            
            console.log(`${status} ID ${bet.id}: 投注${bet.bet_value}号, ${winStatus} ${correct}`);
        });
        
        // 6. 检查是否所有注单都已结算
        const stillUnsettled = await db.any(`
            SELECT COUNT(*) as count
            FROM bet_history
            WHERE period = 20250714229
            AND settled = false
        `);
        
        if (parseInt(stillUnsettled[0].count) === 0) {
            console.log('\n✅ 期号229所有注单已完成结算！');
        } else {
            console.log(`\n⚠️ 仍有 ${stillUnsettled[0].count} 笔注单未结算`);
        }
        
    } catch (error) {
        console.error('手动结算过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行手动结算
manualSettle229();