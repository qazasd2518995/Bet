// test-bet-simple.js - 簡單的投注測試
import db from './db/config.js';

async function testBetSimple() {
    console.log('🎯 簡單投注測試...\n');
    
    try {
        // 1. 獲取當前期號
        const currentState = await db.oneOrNone(`
            SELECT current_period, status, countdown_seconds
            FROM game_state
            ORDER BY id DESC
            LIMIT 1
        `);
        
        if (!currentState) {
            console.log('❌ 無法獲取遊戲狀態');
            return;
        }
        
        console.log(`當前期號: ${currentState.current_period}`);
        console.log(`當前狀態: ${currentState.status}`);
        console.log(`倒計時: ${currentState.countdown_seconds}秒`);
        
        if (currentState.status !== 'betting') {
            console.log('⚠️ 當前不是投注時間');
            return;
        }
        
        // 2. 檢查用戶餘額
        const member = await db.oneOrNone(`
            SELECT id, balance FROM members WHERE username = 'justin111'
        `);
        
        if (!member) {
            console.log('❌ 找不到用戶');
            return;
        }
        
        console.log(`用戶餘額: $${member.balance}`);
        
        if (parseFloat(member.balance) < 100) {
            console.log('❌ 餘額不足');
            return;
        }
        
        // 3. 手動插入投注記錄
        console.log('\n🎯 插入測試投注...');
        
        const betAmount = 100;
        const betOdds = 9.89;
        const position = 3; // 第3名
        const betValue = '7'; // 投注7號
        
        const newBetId = await db.one(`
            INSERT INTO bet_history 
            (username, amount, bet_type, bet_value, position, period, odds, created_at, settled, win, win_amount)
            VALUES ($1, $2, 'number', $3, $4, $5, $6, NOW(), false, false, 0)
            RETURNING id
        `, ['justin111', betAmount, betValue, position, currentState.current_period, betOdds]);
        
        console.log(`✅ 投注記錄已創建: ID ${newBetId.id}`);
        console.log(`投注內容: 期號${currentState.current_period} 第${position}名=${betValue}號 $${betAmount} 賠率${betOdds}`);
        
        // 4. 更新用戶餘額（扣除投注金額）
        const newBalance = parseFloat(member.balance) - betAmount;
        await db.none(`
            UPDATE members SET balance = $1 WHERE id = $2
        `, [newBalance, member.id]);
        
        console.log(`✅ 餘額已更新: $${member.balance} → $${newBalance}`);
        
        // 5. 記錄交易
        await db.none(`
            INSERT INTO transaction_records
            (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
            VALUES ('member', $1, 'bet', $2, $3, $4, $5, NOW())
        `, [member.id, -betAmount, parseFloat(member.balance), newBalance, `期號 ${currentState.current_period} 投注`]);
        
        console.log('✅ 交易記錄已保存');
        
        // 6. 監控結算
        console.log('\n⏰ 開始監控結算狀態...');
        console.log('請等待當期開獎和結算完成...\n');
        
        let monitorCount = 0;
        const maxMonitor = 100; // 最多監控5分鐘
        
        const monitorInterval = setInterval(async () => {
            try {
                monitorCount++;
                if (monitorCount > maxMonitor) {
                    console.log('\n⏰ 監控超時，停止檢查');
                    clearInterval(monitorInterval);
                    await db.$pool.end();
                    return;
                }
                
                // 檢查投注是否已結算
                const betStatus = await db.oneOrNone(`
                    SELECT settled, win, win_amount, settled_at
                    FROM bet_history
                    WHERE id = $1
                `, [newBetId.id]);
                
                if (betStatus && betStatus.settled) {
                    console.log('\n✅ 投注已結算!');
                    console.log(`結算結果: ${betStatus.win ? '中獎' : '未中獎'}`);
                    if (betStatus.win) {
                        console.log(`中獎金額: $${betStatus.win_amount}`);
                    }
                    console.log(`結算時間: ${betStatus.settled_at}`);
                    
                    // 檢查開獎結果
                    const drawResult = await db.oneOrNone(`
                        SELECT result
                        FROM result_history
                        WHERE period = $1
                    `, [currentState.current_period]);
                    
                    if (drawResult) {
                        let positions = [];
                        if (Array.isArray(drawResult.result)) {
                            positions = drawResult.result;
                        } else if (typeof drawResult.result === 'string') {
                            positions = drawResult.result.split(',').map(n => parseInt(n.trim()));
                        }
                        
                        console.log(`開獎結果: [${positions.join(',')}]`);
                        console.log(`第${position}名開出: ${positions[position-1]}號`);
                        
                        const shouldWin = positions[position-1] === parseInt(betValue);
                        const actualWin = betStatus.win;
                        
                        if (shouldWin === actualWin) {
                            console.log('✅ 結算正確!');
                        } else {
                            console.log('❌ 結算錯誤!');
                            console.log(`應該: ${shouldWin ? '中獎' : '未中獎'}`);
                            console.log(`實際: ${actualWin ? '中獎' : '未中獎'}`);
                        }
                        
                        // 檢查用戶最終餘額
                        const finalMember = await db.oneOrNone(`
                            SELECT balance FROM members WHERE id = $1
                        `, [member.id]);
                        
                        if (finalMember) {
                            console.log(`最終餘額: $${finalMember.balance}`);
                            const expectedBalance = betStatus.win ? 
                                (newBalance + parseFloat(betStatus.win_amount)) : newBalance;
                            console.log(`預期餘額: $${expectedBalance}`);
                            
                            if (Math.abs(parseFloat(finalMember.balance) - expectedBalance) < 0.01) {
                                console.log('✅ 餘額計算正確!');
                            } else {
                                console.log('❌ 餘額計算錯誤!');
                            }
                        }
                    }
                    
                    console.log('\n🎯 測試完成!');
                    clearInterval(monitorInterval);
                    await db.$pool.end();
                } else {
                    // 檢查當前期號是否已變化
                    const newState = await db.oneOrNone(`
                        SELECT current_period FROM game_state ORDER BY id DESC LIMIT 1
                    `);
                    
                    if (newState && newState.current_period > currentState.current_period) {
                        process.stdout.write(`\n期號已更新到: ${newState.current_period}, 繼續等待結算...`);
                    } else {
                        process.stdout.write('.');
                    }
                }
            } catch (error) {
                console.error('\n監控過程出錯:', error);
                clearInterval(monitorInterval);
                await db.$pool.end();
            }
        }, 3000); // 每3秒檢查一次
        
    } catch (error) {
        console.error('測試過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

// 執行測試
testBetSimple();