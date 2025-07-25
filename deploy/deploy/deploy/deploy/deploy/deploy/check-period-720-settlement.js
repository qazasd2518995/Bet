// check-period-720-settlement.js - 檢查期號 720 的結算問題
import db from './db/config.js';

async function checkPeriod720Settlement() {
    try {
        console.log('檢查期號 20250717720 的結算問題...\n');
        
        // 1. 查詢開獎結果
        const drawResult = await db.oneOrNone(`
            SELECT period, 
                   position_1, position_2, position_3, position_4, position_5,
                   position_6, position_7, position_8, position_9, position_10,
                   result,
                   draw_time
            FROM result_history 
            WHERE period = $1
        `, ['20250717720']);
        
        if (drawResult) {
            console.log('開獎結果：');
            console.log('期號:', drawResult.period);
            console.log('開獎時間:', drawResult.draw_time);
            console.log('\n各位置的號碼：');
            console.log(`第1名(冠軍): ${drawResult.position_1}號`);
            console.log(`第2名(亞軍): ${drawResult.position_2}號`);
            console.log(`第3名(季軍): ${drawResult.position_3}號`);
            
            const champion = drawResult.position_1;
            console.log('\n冠軍分析：');
            console.log(`冠軍號碼: ${champion}`);
            console.log(`是否為大: ${champion >= 6 ? '是（大）' : '否（小）'} (6-10為大)`);
            console.log(`是否為單: ${champion % 2 === 1 ? '是（單）' : '否（雙）'} (奇數為單)`);
            
            // 2. 查詢相關的下注記錄
            const bets = await db.manyOrNone(`
                SELECT id, username, bet_type, bet_value, position, 
                       amount, odds, win, win_amount, settled, 
                       created_at, settled_at
                FROM bet_history
                WHERE period = $1 AND username = 'justin111'
                ORDER BY id
            `, ['20250717720']);
            
            console.log(`\n\n找到 ${bets.length} 筆下注記錄：`);
            bets.forEach((bet, idx) => {
                console.log(`\n${idx + 1}. ID:${bet.id}`);
                console.log(`   類型: ${bet.bet_type}`);
                console.log(`   選項: ${bet.bet_value}`);
                console.log(`   金額: $${bet.amount}`);
                console.log(`   賠率: ${bet.odds}`);
                console.log(`   已結算: ${bet.settled ? '是' : '否'}`);
                console.log(`   中獎: ${bet.win ? '是' : '否'}`);
                console.log(`   派彩: $${bet.win_amount || 0}`);
                
                // 判斷是否應該中獎
                if (bet.bet_type === 'champion') {
                    let shouldWin = false;
                    if (bet.bet_value === 'big' || bet.bet_value === '大') {
                        shouldWin = champion >= 6;
                        console.log(`   應該中獎: ${shouldWin ? '是' : '否'} (冠軍${champion} ${shouldWin ? '≥' : '<'} 6)`);
                    } else if (bet.bet_value === 'small' || bet.bet_value === '小') {
                        shouldWin = champion <= 5;
                        console.log(`   應該中獎: ${shouldWin ? '是' : '否'} (冠軍${champion} ${shouldWin ? '≤' : '>'} 5)`);
                    } else if (bet.bet_value === 'odd' || bet.bet_value === '單') {
                        shouldWin = champion % 2 === 1;
                        console.log(`   應該中獎: ${shouldWin ? '是' : '否'} (冠軍${champion} ${shouldWin ? '是' : '不是'}奇數)`);
                    } else if (bet.bet_value === 'even' || bet.bet_value === '雙') {
                        shouldWin = champion % 2 === 0;
                        console.log(`   應該中獎: ${shouldWin ? '是' : '否'} (冠軍${champion} ${shouldWin ? '是' : '不是'}偶數)`);
                    }
                    
                    if (shouldWin !== bet.win) {
                        console.log(`   ❌ 錯誤！系統判定為${bet.win ? '贏' : '輸'}，但應該是${shouldWin ? '贏' : '輸'}`);
                    }
                }
            });
            
            // 3. 查詢結算記錄
            const settlementLogs = await db.manyOrNone(`
                SELECT *
                FROM settlement_logs
                WHERE period = $1
                ORDER BY created_at
            `, ['20250717720']);
            
            console.log(`\n\n結算日誌 (${settlementLogs.length} 筆)：`);
            settlementLogs.forEach(log => {
                console.log(`時間: ${log.created_at}`);
                console.log(`已結算數: ${log.settled_count}`);
                console.log(`總派彩: ${log.total_win_amount}`);
                console.log(`狀態: ${log.status || 'N/A'}`);
            });
            
        } else {
            console.log('❌ 找不到期號 20250717720 的開獎結果');
        }
        
    } catch (error) {
        console.error('檢查錯誤:', error);
    } finally {
        process.exit();
    }
}

checkPeriod720Settlement();