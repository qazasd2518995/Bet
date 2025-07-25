// fix-period-493-result.js - 修復期號 20250718493 的開獎結果不一致問題
import db from './db/config.js';

async function fixPeriod493() {
    console.log('========== 修復期號 20250718493 開獎結果 ==========\n');
    
    const period = '20250718493';
    
    try {
        // 1. 查詢當前資料庫中的開獎結果
        const currentResult = await db.oneOrNone(`
            SELECT * FROM result_history WHERE period = $1
        `, [period]);
        
        if (!currentResult) {
            console.error('找不到該期的開獎結果');
            return;
        }
        
        console.log('當前資料庫中的開獎結果：');
        for (let i = 1; i <= 10; i++) {
            console.log(`  第${i}名: ${currentResult[`position_${i}`]}號`);
        }
        
        // 2. 系統日誌中的正確開獎結果（結算時使用的）
        const correctPositions = [2, 1, 3, 8, 7, 5, 10, 6, 4, 9];
        
        console.log('\n系統結算時使用的正確開獎結果：');
        for (let i = 0; i < correctPositions.length; i++) {
            console.log(`  第${i + 1}名: ${correctPositions[i]}號`);
        }
        
        // 3. 查詢該期所有投注記錄
        const bets = await db.manyOrNone(`
            SELECT id, username, bet_type, bet_value, position, amount, odds, win, win_amount
            FROM bet_history 
            WHERE period = $1
            ORDER BY id
        `, [period]);
        
        console.log(`\n找到 ${bets.length} 筆投注記錄`);
        
        // 4. 驗證當前結算狀態是否與正確開獎結果一致
        console.log('\n驗證結算狀態：');
        let isConsistent = true;
        
        for (const bet of bets) {
            if (bet.bet_type === 'number' && bet.position == 1) {
                const betNumber = parseInt(bet.bet_value);
                const shouldWin = correctPositions[0] === betNumber;
                
                if (bet.win !== shouldWin) {
                    console.log(`❌ 結算錯誤: 號碼${betNumber}, 當前${bet.win ? '贏' : '輸'}, 應該${shouldWin ? '贏' : '輸'}`);
                    isConsistent = false;
                } else {
                    console.log(`✅ 結算正確: 號碼${betNumber}, ${bet.win ? '贏' : '輸'}`);
                }
            }
        }
        
        if (isConsistent) {
            console.log('\n結算狀態與正確開獎結果一致，只需要更新資料庫中的開獎記錄');
            
            // 5. 更新資料庫中的開獎結果
            await db.tx(async t => {
                // 建立更新語句
                const updateColumns = [];
                for (let i = 0; i < correctPositions.length; i++) {
                    updateColumns.push(`position_${i + 1} = ${correctPositions[i]}`);
                }
                
                await t.none(`
                    UPDATE result_history 
                    SET ${updateColumns.join(', ')}
                    WHERE period = $1
                `, [period]);
                
                console.log('\n✅ 已更新資料庫中的開獎結果');
            });
            
            // 6. 驗證更新後的結果
            const updatedResult = await db.oneOrNone(`
                SELECT * FROM result_history WHERE period = $1
            `, [period]);
            
            console.log('\n更新後的開獎結果：');
            for (let i = 1; i <= 10; i++) {
                console.log(`  第${i}名: ${updatedResult[`position_${i}`]}號`);
            }
            
            console.log('\n✅ 修復完成！開獎結果已與結算結果保持一致');
        } else {
            console.log('\n⚠️ 發現結算狀態與正確開獎結果不一致，需要進一步調查');
        }
        
    } catch (error) {
        console.error('修復過程中發生錯誤:', error);
    }
    
    process.exit();
}

// 執行修復
fixPeriod493();