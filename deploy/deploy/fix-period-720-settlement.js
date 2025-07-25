// fix-period-720-settlement.js - 修復期號 720 的錯誤結算
import db from './db/config.js';
import { enhancedSettlement } from './enhanced-settlement-system.js';

async function fixPeriod720Settlement() {
    try {
        console.log('修復期號 20250717720 的錯誤結算...\n');
        
        const period = '20250717720';
        
        // 1. 查詢開獎結果
        const drawResult = await db.oneOrNone(`
            SELECT period, 
                   position_1, position_2, position_3, position_4, position_5,
                   position_6, position_7, position_8, position_9, position_10,
                   draw_time
            FROM result_history 
            WHERE period = $1
        `, [period]);
        
        if (!drawResult) {
            console.log('❌ 找不到開獎結果');
            return;
        }
        
        console.log('開獎結果：');
        console.log(`期號: ${drawResult.period}`);
        console.log(`第1名(冠軍): ${drawResult.position_1}號`);
        console.log(`第2名(亞軍): ${drawResult.position_2}號`);
        
        // 2. 構建正確的開獎結果陣列
        const positions = [];
        for (let i = 1; i <= 10; i++) {
            positions.push(parseInt(drawResult[`position_${i}`]));
        }
        console.log('\n開獎陣列:', positions);
        
        // 3. 重置該期號的結算狀態
        console.log('\n重置結算狀態...');
        await db.none(`
            UPDATE bet_history 
            SET settled = false, 
                win = false, 
                win_amount = 0,
                settled_at = NULL
            WHERE period = $1
        `, [period]);
        
        const resetCount = await db.one(`
            SELECT COUNT(*) as count 
            FROM bet_history 
            WHERE period = $1
        `, [period]);
        console.log(`✅ 已重置 ${resetCount.count} 筆投注記錄`);
        
        // 4. 重新執行結算
        console.log('\n重新執行結算...');
        const settlementResult = await enhancedSettlement(period, { positions });
        
        if (settlementResult.success) {
            console.log('\n✅ 結算成功！');
            console.log(`結算數量: ${settlementResult.settledCount}`);
            console.log(`中獎數量: ${settlementResult.winCount}`);
            console.log(`總派彩: ${settlementResult.totalWinAmount}`);
            
            // 5. 查詢修復後的結果
            const fixedBets = await db.manyOrNone(`
                SELECT id, username, bet_type, bet_value, 
                       amount, win, win_amount
                FROM bet_history
                WHERE period = $1 AND username = 'justin111'
                ORDER BY id
            `, [period]);
            
            console.log('\n修復後的投注記錄：');
            fixedBets.forEach((bet, idx) => {
                console.log(`${idx + 1}. ID:${bet.id}`);
                console.log(`   類型: ${bet.bet_type}`);
                console.log(`   選項: ${bet.bet_value}`);
                console.log(`   金額: $${bet.amount}`);
                console.log(`   中獎: ${bet.win ? '是' : '否'}`);
                console.log(`   派彩: $${bet.win_amount || 0}`);
                
                // 驗證冠軍投注
                if (bet.bet_type === 'champion') {
                    const champion = positions[0]; // 第1名
                    let shouldWin = false;
                    if (bet.bet_value === 'big') {
                        shouldWin = champion >= 6;
                    } else if (bet.bet_value === 'odd') {
                        shouldWin = champion % 2 === 1;
                    }
                    
                    if (shouldWin !== bet.win) {
                        console.log(`   ❌ 仍然錯誤！應該是${shouldWin ? '贏' : '輸'}`);
                    } else {
                        console.log(`   ✅ 正確！`);
                    }
                }
            });
            
            // 6. 更新用戶餘額（如果需要）
            const totalCorrectWin = fixedBets
                .filter(b => b.win)
                .reduce((sum, b) => sum + parseFloat(b.win_amount || 0), 0);
            
            console.log(`\n總正確派彩: $${totalCorrectWin.toFixed(2)}`);
            
        } else {
            console.log('❌ 結算失敗:', settlementResult.error);
        }
        
    } catch (error) {
        console.error('修復失敗:', error);
    } finally {
        process.exit();
    }
}

fixPeriod720Settlement();