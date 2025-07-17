// analyze-settlement-timing-issue.js - 分析結算時機問題

/*
問題分析：

1. 時間線：
   - T-3秒：開獎倒計時剩3秒，backend.js 調用 drawSystemManager.executeDrawing()
   - T-3秒：fixed-draw-system.js 生成開獎結果並保存到數據庫
   - T-1秒：fixed-draw-system.js 自動觸發結算（延遲2秒+1秒）
   - T+0秒：開獎倒計時結束，進入新期
   
2. 問題核心：
   - fixed-draw-system.js 的 executeDrawing 方法會自動觸發結算
   - 結算在開獎倒計時還沒結束時就執行了
   - 這時候可能還有玩家在下注！

3. 為什麼會結算錯誤（期號579）：
   - 結算執行時，可能讀取到的不是最終的開獎結果
   - 或者結算邏輯本身有問題
   
4. 解決方案：
   - 方案A：移除 fixed-draw-system.js 中的自動結算
   - 方案B：讓 backend.js 在適當時機（開獎完全結束後）調用結算
   - 方案C：增加更長的延遲（但這不是好方案）
*/

import db from './db/config.js';

async function analyzeSettlementTiming() {
    try {
        console.log('🔍 分析結算時機問題...\n');
        
        // 檢查期號579的詳細時間線
        console.log('=== 期號 20250717579 時間線分析 ===');
        
        // 1. 查詢投注記錄
        const bets = await db.manyOrNone(`
            SELECT id, username, bet_type, bet_value, amount, 
                   created_at, settled_at, win, win_amount
            FROM bet_history 
            WHERE period = '20250717579'
            ORDER BY created_at
        `);
        
        console.log(`\n投注記錄（共 ${bets.length} 筆）：`);
        bets.forEach(bet => {
            console.log(`  ${bet.created_at} - ${bet.username} 下注 ${bet.bet_type} ${bet.bet_value} $${bet.amount}`);
            if (bet.settled_at) {
                console.log(`    → 結算時間: ${bet.settled_at}, 結果: ${bet.win ? '贏' : '輸'}`);
            }
        });
        
        // 2. 查詢開獎記錄
        const result = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = '20250717579'
        `);
        
        if (result) {
            console.log(`\n開獎記錄：`);
            console.log(`  創建時間: ${result.created_at}`);
            console.log(`  開獎時間: ${result.draw_time || result.created_at}`);
            console.log(`  開獎結果: [${result.position_1}, ${result.position_2}, ${result.position_3}, ...]`);
        }
        
        // 3. 查詢結算日誌
        const logs = await db.manyOrNone(`
            SELECT * FROM settlement_logs 
            WHERE period = '20250717579'
            ORDER BY created_at
        `);
        
        if (logs.length > 0) {
            console.log(`\n結算日誌（共 ${logs.length} 條）：`);
            logs.forEach(log => {
                console.log(`  ${log.created_at} - ${log.status}: ${log.message}`);
            });
        }
        
        // 4. 分析問題
        console.log('\n=== 問題分析 ===');
        
        if (bets.length > 0 && result) {
            const lastBetTime = new Date(bets[bets.length - 1].created_at);
            const drawTime = new Date(result.created_at);
            const firstSettleTime = bets.find(b => b.settled_at) ? new Date(bets.find(b => b.settled_at).settled_at) : null;
            
            console.log(`\n時間差分析：`);
            console.log(`  最後下注時間: ${lastBetTime.toISOString()}`);
            console.log(`  開獎記錄時間: ${drawTime.toISOString()}`);
            if (firstSettleTime) {
                console.log(`  首次結算時間: ${firstSettleTime.toISOString()}`);
                
                const betToDrawSeconds = (drawTime - lastBetTime) / 1000;
                const drawToSettleSeconds = (firstSettleTime - drawTime) / 1000;
                const betToSettleSeconds = (firstSettleTime - lastBetTime) / 1000;
                
                console.log(`\n  下注到開獎: ${betToDrawSeconds.toFixed(1)} 秒`);
                console.log(`  開獎到結算: ${drawToSettleSeconds.toFixed(1)} 秒`);
                console.log(`  下注到結算: ${betToSettleSeconds.toFixed(1)} 秒`);
                
                if (drawToSettleSeconds < 0) {
                    console.log(`\n  ⚠️ 警告：結算在開獎記錄創建之前！`);
                }
                if (betToSettleSeconds < 15) {
                    console.log(`  ⚠️ 警告：結算太快！應該在開獎倒計時結束後才結算`);
                }
            }
        }
        
        console.log('\n=== 結論 ===');
        console.log('1. fixed-draw-system.js 在生成開獎結果後會自動觸發結算');
        console.log('2. 這發生在開獎倒計時剩3秒時，而不是開獎結束後');
        console.log('3. 結算太早可能導致：');
        console.log('   - 還有玩家在下注');
        console.log('   - 結算邏輯使用了錯誤的數據');
        console.log('   - 與實際開獎結果不符');
        
    } catch (error) {
        console.error('分析失敗:', error);
    } finally {
        process.exit(0);
    }
}

analyzeSettlementTiming();