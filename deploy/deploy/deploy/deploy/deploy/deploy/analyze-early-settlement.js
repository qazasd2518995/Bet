// analyze-early-settlement.js - 分析提前結算的原因
import db from './db/config.js';

async function analyzeEarlySettlement() {
    console.log('=== 分析提前結算的原因 ===\n');
    
    try {
        // 檢查期號 20250717449 的具體情況
        const period = '20250717449';
        
        // 1. 檢查該期的所有事件時間線
        console.log('1. 期號 20250717449 的時間線:');
        
        // 獲取第一筆和最後一筆投注時間
        const betTimes = await db.oneOrNone(`
            SELECT 
                MIN(created_at) as first_bet,
                MAX(created_at) as last_bet,
                COUNT(*) as total_bets
            FROM bet_history
            WHERE period = $1
        `, [period]);
        
        console.log(`首筆投注: ${betTimes.first_bet}`);
        console.log(`末筆投注: ${betTimes.last_bet}`);
        console.log(`總投注數: ${betTimes.total_bets}`);
        
        // 獲取結算時間
        const settlementTime = await db.oneOrNone(`
            SELECT 
                MIN(settled_at) as settlement_time,
                COUNT(DISTINCT settled_at) as unique_times
            FROM bet_history
            WHERE period = $1 AND settled = true
        `, [period]);
        
        console.log(`\n結算時間: ${settlementTime.settlement_time}`);
        console.log(`唯一結算時間數: ${settlementTime.unique_times}`);
        
        // 獲取開獎記錄創建時間
        const drawRecord = await db.oneOrNone(`
            SELECT created_at, draw_time, position_1
            FROM result_history
            WHERE period = $1
        `, [period]);
        
        console.log(`\n開獎記錄創建時間: ${drawRecord.created_at}`);
        console.log(`開獎時間(draw_time): ${drawRecord.draw_time}`);
        
        // 2. 分析時間差
        console.log('\n2. 時間差分析:');
        const lastBetTime = new Date(betTimes.last_bet);
        const settleTime = new Date(settlementTime.settlement_time);
        const drawCreateTime = new Date(drawRecord.created_at);
        const drawTime = new Date(drawRecord.draw_time);
        
        console.log(`最後投注到結算: ${((settleTime - lastBetTime) / 1000).toFixed(1)} 秒`);
        console.log(`結算到開獎記錄創建: ${((drawCreateTime - settleTime) / 1000).toFixed(1)} 秒`);
        console.log(`結算到開獎時間: ${((drawTime - settleTime) / 1000).toFixed(1)} 秒`);
        
        // 3. 檢查結算時的開獎結果
        console.log('\n3. 檢查結算時可能使用的結果:');
        
        // 檢查是否有前一期的結果
        const prevPeriod = String(BigInt(period) - 1n);
        const prevResult = await db.oneOrNone(`
            SELECT period, position_1, draw_time
            FROM result_history
            WHERE period = $1
        `, [prevPeriod]);
        
        if (prevResult) {
            console.log(`\n前一期 ${prevResult.period}:`);
            console.log(`  冠軍: ${prevResult.position_1}號`);
            console.log(`  開獎時間: ${prevResult.draw_time}`);
        }
        
        // 4. 分析冠軍大的中獎情況
        console.log('\n4. 分析"冠軍大"投注的結算:');
        const championBigBet = await db.oneOrNone(`
            SELECT * FROM bet_history
            WHERE id = 3321
        `);
        
        console.log(`投注ID 3321:`);
        console.log(`  投注內容: ${championBigBet.bet_type} ${championBigBet.bet_value}`);
        console.log(`  結算結果: ${championBigBet.win ? '贏' : '輸'}`);
        console.log(`  派彩: ${championBigBet.win_amount}`);
        console.log(`  實際開獎: 冠軍${drawRecord.position_1}號 (${drawRecord.position_1 >= 6 ? '大' : '小'})`);
        console.log(`  正確結果: 應該${drawRecord.position_1 < 6 ? '輸' : '贏'}`);
        
        // 5. 檢查交易記錄
        console.log('\n5. 檢查相關交易記錄:');
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
            new Date(settleTime.getTime() - 60000), // 結算前1分鐘
            new Date(settleTime.getTime() + 60000)  // 結算後1分鐘
        ]);
        
        if (transactions.length > 0) {
            for (const tx of transactions) {
                console.log(`\n交易 ${tx.id}:`);
                console.log(`  類型: ${tx.transaction_type}`);
                console.log(`  金額: ${tx.amount}`);
                console.log(`  描述: ${tx.description}`);
                console.log(`  時間: ${tx.created_at}`);
            }
        }
        
        // 6. 檢查系統日誌或錯誤
        console.log('\n6. 可能的原因分析:');
        console.log('- 結算時間比開獎時間早375.7秒（6分鐘）');
        console.log('- 所有30筆投注在同一時間結算');
        console.log('- 可能在betting階段結束時錯誤地觸發了結算');
        console.log('- 可能使用了錯誤的開獎結果或預設值');
        
    } catch (error) {
        console.error('分析失敗:', error);
    } finally {
        await db.$pool.end();
    }
}

analyzeEarlySettlement();