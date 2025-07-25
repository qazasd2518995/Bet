// analyze-early-settlement.js - 分析提前结算的原因
import db from './db/config.js';

async function analyzeEarlySettlement() {
    console.log('=== 分析提前结算的原因 ===\n');
    
    try {
        // 检查期号 20250717449 的具体情况
        const period = '20250717449';
        
        // 1. 检查该期的所有事件时间线
        console.log('1. 期号 20250717449 的时间线:');
        
        // 获取第一笔和最后一笔投注时间
        const betTimes = await db.oneOrNone(`
            SELECT 
                MIN(created_at) as first_bet,
                MAX(created_at) as last_bet,
                COUNT(*) as total_bets
            FROM bet_history
            WHERE period = $1
        `, [period]);
        
        console.log(`首笔投注: ${betTimes.first_bet}`);
        console.log(`末笔投注: ${betTimes.last_bet}`);
        console.log(`总投注数: ${betTimes.total_bets}`);
        
        // 获取结算时间
        const settlementTime = await db.oneOrNone(`
            SELECT 
                MIN(settled_at) as settlement_time,
                COUNT(DISTINCT settled_at) as unique_times
            FROM bet_history
            WHERE period = $1 AND settled = true
        `, [period]);
        
        console.log(`\n结算时间: ${settlementTime.settlement_time}`);
        console.log(`唯一结算时间数: ${settlementTime.unique_times}`);
        
        // 获取开奖记录创建时间
        const drawRecord = await db.oneOrNone(`
            SELECT created_at, draw_time, position_1
            FROM result_history
            WHERE period = $1
        `, [period]);
        
        console.log(`\n开奖记录创建时间: ${drawRecord.created_at}`);
        console.log(`开奖时间(draw_time): ${drawRecord.draw_time}`);
        
        // 2. 分析时间差
        console.log('\n2. 时间差分析:');
        const lastBetTime = new Date(betTimes.last_bet);
        const settleTime = new Date(settlementTime.settlement_time);
        const drawCreateTime = new Date(drawRecord.created_at);
        const drawTime = new Date(drawRecord.draw_time);
        
        console.log(`最后投注到结算: ${((settleTime - lastBetTime) / 1000).toFixed(1)} 秒`);
        console.log(`结算到开奖记录创建: ${((drawCreateTime - settleTime) / 1000).toFixed(1)} 秒`);
        console.log(`结算到开奖时间: ${((drawTime - settleTime) / 1000).toFixed(1)} 秒`);
        
        // 3. 检查结算时的开奖结果
        console.log('\n3. 检查结算时可能使用的结果:');
        
        // 检查是否有前一期的结果
        const prevPeriod = String(BigInt(period) - 1n);
        const prevResult = await db.oneOrNone(`
            SELECT period, position_1, draw_time
            FROM result_history
            WHERE period = $1
        `, [prevPeriod]);
        
        if (prevResult) {
            console.log(`\n前一期 ${prevResult.period}:`);
            console.log(`  冠军: ${prevResult.position_1}号`);
            console.log(`  开奖时间: ${prevResult.draw_time}`);
        }
        
        // 4. 分析冠军大的中奖情况
        console.log('\n4. 分析"冠军大"投注的结算:');
        const championBigBet = await db.oneOrNone(`
            SELECT * FROM bet_history
            WHERE id = 3321
        `);
        
        console.log(`投注ID 3321:`);
        console.log(`  投注内容: ${championBigBet.bet_type} ${championBigBet.bet_value}`);
        console.log(`  结算结果: ${championBigBet.win ? '赢' : '输'}`);
        console.log(`  派彩: ${championBigBet.win_amount}`);
        console.log(`  实际开奖: 冠军${drawRecord.position_1}号 (${drawRecord.position_1 >= 6 ? '大' : '小'})`);
        console.log(`  正确结果: 应该${drawRecord.position_1 < 6 ? '输' : '赢'}`);
        
        // 5. 检查交易记录
        console.log('\n5. 检查相关交易记录:');
        const transactions = await db.manyOrNone(`
            SELECT 
                id,
                transaction_type,
                amount,
                description,
                created_at
            FROM transaction_records
            WHERE created_at BETWEEN $1 AND $2
            AND description LIKE '%20250717449%'
            ORDER BY created_at
            LIMIT 5
        `, [
            new Date(settleTime.getTime() - 60000), // 结算前1分钟
            new Date(settleTime.getTime() + 60000)  // 结算后1分钟
        ]);
        
        if (transactions.length > 0) {
            for (const tx of transactions) {
                console.log(`\n交易 ${tx.id}:`);
                console.log(`  类型: ${tx.transaction_type}`);
                console.log(`  金额: ${tx.amount}`);
                console.log(`  描述: ${tx.description}`);
                console.log(`  时间: ${tx.created_at}`);
            }
        }
        
        // 6. 检查系统日志或错误
        console.log('\n6. 可能的原因分析:');
        console.log('- 结算时间比开奖时间早375.7秒（6分钟）');
        console.log('- 所有30笔投注在同一时间结算');
        console.log('- 可能在betting阶段结束时错误地触发了结算');
        console.log('- 可能使用了错误的开奖结果或预设值');
        
    } catch (error) {
        console.error('分析失败:', error);
    } finally {
        await db.$pool.end();
    }
}

analyzeEarlySettlement();