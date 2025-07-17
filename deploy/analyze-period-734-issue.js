// analyze-period-734-issue.js - 分析期號 734 贏控制邏輯問題
import db from './db/config.js';

async function analyzePeriod734Issue() {
    try {
        console.log('分析期號 20250717734 贏控制邏輯問題...\n');
        
        // 1. 查詢開獎結果
        const drawResult = await db.oneOrNone(`
            SELECT period, 
                   position_1, position_2, position_3, position_4, position_5,
                   position_6, position_7, position_8, position_9, position_10,
                   draw_time
            FROM result_history 
            WHERE period = $1
        `, ['20250717734']);
        
        if (drawResult) {
            console.log('開獎結果：');
            console.log(`期號: ${drawResult.period}`);
            console.log(`第1名(冠軍): ${drawResult.position_1}號`);
            
            const champion = drawResult.position_1;
            console.log('\n冠軍分析：');
            console.log(`冠軍號碼: ${champion}`);
            console.log(`是否為大: ${champion >= 6 ? '是（大）' : '否（小）'}`);
            console.log(`是否為單: ${champion % 2 === 1 ? '是（單）' : '否（雙）'}`);
            
            // 2. 查詢用戶的下注
            const bets = await db.manyOrNone(`
                SELECT id, username, bet_type, bet_value, position, 
                       amount, odds, win, win_amount, settled
                FROM bet_history
                WHERE period = $1 AND username = 'justin111'
                ORDER BY id
            `, ['20250717734']);
            
            console.log(`\n\n找到 ${bets.length} 筆下注記錄：`);
            bets.forEach((bet, idx) => {
                console.log(`\n${idx + 1}. ID:${bet.id}`);
                console.log(`   類型: ${bet.bet_type}`);
                console.log(`   選項: ${bet.bet_value}`);
                console.log(`   金額: $${bet.amount}`);
                console.log(`   中獎: ${bet.win ? '是' : '否'}`);
                
                // 分析應該的結果
                if (bet.bet_type === 'champion') {
                    let shouldWin = false;
                    if (bet.bet_value === 'big' || bet.bet_value === '大') {
                        shouldWin = champion >= 6;
                    } else if (bet.bet_value === 'small' || bet.bet_value === '小') {
                        shouldWin = champion <= 5;
                    } else if (bet.bet_value === 'odd' || bet.bet_value === '單') {
                        shouldWin = champion % 2 === 1;
                    } else if (bet.bet_value === 'even' || bet.bet_value === '雙') {
                        shouldWin = champion % 2 === 0;
                    }
                    
                    console.log(`   應該中獎: ${shouldWin ? '是' : '否'}`);
                    
                    if (bet.win !== shouldWin) {
                        console.log(`   ❌ 結算正確但控制邏輯錯誤！`);
                    }
                }
            });
            
            console.log('\n\n問題分析：');
            console.log('1. 系統說要讓用戶贏（10%機率），但開出的結果讓用戶輸了');
            console.log('2. 用戶下注：冠軍小、冠軍單');
            console.log('3. 開獎結果：冠軍10號（大且雙）');
            console.log('4. 結果：兩注都輸');
            console.log('\n原因：generateWinningResultFixed 函數只處理了數字類型的投注，');
            console.log('      沒有處理大小單雙類型的投注，導致贏控制失效。');
            
        } else {
            console.log('❌ 找不到期號 20250717734 的開獎結果');
        }
        
    } catch (error) {
        console.error('分析錯誤:', error);
    } finally {
        process.exit();
    }
}

analyzePeriod734Issue();