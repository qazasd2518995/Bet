// analyze-settlement-timing-issue.js - 分析结算时机问题

/*
问题分析：

1. 时间线：
   - T-3秒：开奖倒计时剩3秒，backend.js 调用 drawSystemManager.executeDrawing()
   - T-3秒：fixed-draw-system.js 生成开奖结果并保存到数据库
   - T-1秒：fixed-draw-system.js 自动触发结算（延迟2秒+1秒）
   - T+0秒：开奖倒计时结束，进入新期
   
2. 问题核心：
   - fixed-draw-system.js 的 executeDrawing 方法会自动触发结算
   - 结算在开奖倒计时还没结束时就执行了
   - 这时候可能还有玩家在下注！

3. 为什么会结算错误（期号579）：
   - 结算执行时，可能读取到的不是最终的开奖结果
   - 或者结算逻辑本身有问题
   
4. 解决方案：
   - 方案A：移除 fixed-draw-system.js 中的自动结算
   - 方案B：让 backend.js 在适当时机（开奖完全结束后）调用结算
   - 方案C：增加更长的延迟（但这不是好方案）
*/

import db from './db/config.js';

async function analyzeSettlementTiming() {
    try {
        console.log('🔍 分析结算时机问题...\n');
        
        // 检查期号579的详细时间线
        console.log('=== 期号 20250717579 时间线分析 ===');
        
        // 1. 查询投注记录
        const bets = await db.manyOrNone(`
            SELECT id, username, bet_type, bet_value, amount, 
                   created_at, settled_at, win, win_amount
            FROM bet_history 
            WHERE period = '20250717579'
            ORDER BY created_at
        `);
        
        console.log(`\n投注记录（共 ${bets.length} 笔）：`);
        bets.forEach(bet => {
            console.log(`  ${bet.created_at} - ${bet.username} 下注 ${bet.bet_type} ${bet.bet_value} $${bet.amount}`);
            if (bet.settled_at) {
                console.log(`    → 结算时间: ${bet.settled_at}, 结果: ${bet.win ? '赢' : '输'}`);
            }
        });
        
        // 2. 查询开奖记录
        const result = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = '20250717579'
        `);
        
        if (result) {
            console.log(`\n开奖记录：`);
            console.log(`  创建时间: ${result.created_at}`);
            console.log(`  开奖时间: ${result.draw_time || result.created_at}`);
            console.log(`  开奖结果: [${result.position_1}, ${result.position_2}, ${result.position_3}, ...]`);
        }
        
        // 3. 查询结算日志
        const logs = await db.manyOrNone(`
            SELECT * FROM settlement_logs 
            WHERE period = '20250717579'
            ORDER BY created_at
        `);
        
        if (logs.length > 0) {
            console.log(`\n结算日志（共 ${logs.length} 条）：`);
            logs.forEach(log => {
                console.log(`  ${log.created_at} - ${log.status}: ${log.message}`);
            });
        }
        
        // 4. 分析问题
        console.log('\n=== 问题分析 ===');
        
        if (bets.length > 0 && result) {
            const lastBetTime = new Date(bets[bets.length - 1].created_at);
            const drawTime = new Date(result.created_at);
            const firstSettleTime = bets.find(b => b.settled_at) ? new Date(bets.find(b => b.settled_at).settled_at) : null;
            
            console.log(`\n时间差分析：`);
            console.log(`  最后下注时间: ${lastBetTime.toISOString()}`);
            console.log(`  开奖记录时间: ${drawTime.toISOString()}`);
            if (firstSettleTime) {
                console.log(`  首次结算时间: ${firstSettleTime.toISOString()}`);
                
                const betToDrawSeconds = (drawTime - lastBetTime) / 1000;
                const drawToSettleSeconds = (firstSettleTime - drawTime) / 1000;
                const betToSettleSeconds = (firstSettleTime - lastBetTime) / 1000;
                
                console.log(`\n  下注到开奖: ${betToDrawSeconds.toFixed(1)} 秒`);
                console.log(`  开奖到结算: ${drawToSettleSeconds.toFixed(1)} 秒`);
                console.log(`  下注到结算: ${betToSettleSeconds.toFixed(1)} 秒`);
                
                if (drawToSettleSeconds < 0) {
                    console.log(`\n  ⚠️ 警告：结算在开奖记录创建之前！`);
                }
                if (betToSettleSeconds < 15) {
                    console.log(`  ⚠️ 警告：结算太快！应该在开奖倒计时结束后才结算`);
                }
            }
        }
        
        console.log('\n=== 结论 ===');
        console.log('1. fixed-draw-system.js 在生成开奖结果后会自动触发结算');
        console.log('2. 这发生在开奖倒计时剩3秒时，而不是开奖结束后');
        console.log('3. 结算太早可能导致：');
        console.log('   - 还有玩家在下注');
        console.log('   - 结算逻辑使用了错误的数据');
        console.log('   - 与实际开奖结果不符');
        
    } catch (error) {
        console.error('分析失败:', error);
    } finally {
        process.exit(0);
    }
}

analyzeSettlementTiming();