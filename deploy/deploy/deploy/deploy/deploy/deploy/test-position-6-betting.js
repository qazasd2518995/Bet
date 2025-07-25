// test-position-6-betting.js - 測試第六名1-10號投注
import db from './db/config.js';

async function testPosition6Betting() {
    console.log('🎯 測試第六名1-10號投注...\\n');
    
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
        
        const totalBetAmount = 1000; // 10注 × 100元
        if (parseFloat(member.balance) < totalBetAmount) {
            console.log('❌ 餘額不足，需要至少 $1000');
            return;
        }
        
        // 3. 批量下注 (第六名 1-10號 各100元)
        console.log('\\n🎯 開始批量下注第六名1-10號...');
        
        const betOdds = 9.89;
        const position = 6; // 第6名
        const betAmount = 100;
        const betIds = [];
        
        let currentBalance = parseFloat(member.balance);
        
        // 下注1-10號
        for (let number = 1; number <= 10; number++) {
            console.log(`下注第${position}名 ${number}號...`);
            
            // 插入投注記錄
            const newBetId = await db.one(`
                INSERT INTO bet_history 
                (username, amount, bet_type, bet_value, position, period, odds, created_at, settled, win, win_amount)
                VALUES ($1, $2, 'number', $3, $4, $5, $6, NOW(), false, false, 0)
                RETURNING id
            `, ['justin111', betAmount, number.toString(), position, currentState.current_period, betOdds]);
            
            betIds.push({
                id: newBetId.id,
                number: number,
                amount: betAmount
            });
            
            // 更新餘額
            currentBalance -= betAmount;
            await db.none(`
                UPDATE members SET balance = $1 WHERE id = $2
            `, [currentBalance, member.id]);
            
            // 記錄交易
            await db.none(`
                INSERT INTO transaction_records
                (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                VALUES ('member', $1, 'bet', $2, $3, $4, $5, NOW())
            `, [member.id, -betAmount, currentBalance + betAmount, currentBalance, `期號 ${currentState.current_period} 第${position}名${number}號投注`]);
            
            console.log(`✅ 第${position}名${number}號投注成功 - ID: ${newBetId.id}`);
        }
        
        console.log(`\\n✅ 批量下注完成！總共下注: $${totalBetAmount}`);
        console.log(`餘額變化: $${member.balance} → $${currentBalance}`);
        console.log(`投注詳情: 第${position}名 1-10號 各$${betAmount} 賠率${betOdds}`);
        
        console.log('\\n📋 投注記錄:');
        betIds.forEach(bet => {
            console.log(`  ID ${bet.id}: 第${position}名${bet.number}號 $${bet.amount}`);
        });
        
        // 4. 監控結算
        console.log('\\n⏰ 開始監控結算狀態...');
        console.log('請等待當期開獎和結算完成...\\n');
        
        let monitorCount = 0;
        const maxMonitor = 100; // 最多監控5分鐘
        
        const monitorInterval = setInterval(async () => {
            try {
                monitorCount++;
                if (monitorCount > maxMonitor) {
                    console.log('\\n⏰ 監控超時，停止檢查');
                    clearInterval(monitorInterval);
                    await db.$pool.end();
                    return;
                }
                
                // 檢查是否有投注已結算
                const settledBets = await db.any(`
                    SELECT id, bet_value, settled, win, win_amount, settled_at
                    FROM bet_history
                    WHERE id = ANY($1) AND settled = true
                `, [betIds.map(b => b.id)]);
                
                if (settledBets.length > 0) {
                    console.log('\\n✅ 投注已結算!');
                    
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
                        
                        const winningNumber = positions[position-1];
                        
                        // 檢查所有投注的結算結果
                        console.log('\\n📊 結算詳情:');
                        let totalWinAmount = 0;
                        let winCount = 0;
                        
                        for (const betInfo of betIds) {
                            const betResult = await db.oneOrNone(`
                                SELECT settled, win, win_amount, settled_at
                                FROM bet_history
                                WHERE id = $1
                            `, [betInfo.id]);
                            
                            if (betResult && betResult.settled) {
                                const shouldWin = betInfo.number === winningNumber;
                                const actualWin = betResult.win;
                                const correct = shouldWin === actualWin ? '✅' : '❌';
                                
                                console.log(`  第${position}名${betInfo.number}號: ${actualWin ? `中獎 $${betResult.win_amount}` : '未中獎'} ${correct}`);
                                
                                if (betResult.win) {
                                    totalWinAmount += parseFloat(betResult.win_amount);
                                    winCount++;
                                }
                            } else {
                                console.log(`  第${position}名${betInfo.number}號: 未結算 ⏳`);
                            }
                        }
                        
                        // 計算總盈虧
                        const netProfit = totalWinAmount - totalBetAmount;
                        console.log(`\\n💰 結算總結:`);
                        console.log(`中獎注數: ${winCount}/10`);
                        console.log(`中獎號碼: ${winningNumber}號`);
                        console.log(`總投注額: $${totalBetAmount}`);
                        console.log(`總中獎額: $${totalWinAmount}`);
                        console.log(`淨盈虧: $${netProfit} ${netProfit > 0 ? '💚' : netProfit < 0 ? '💔' : '💛'}`);
                        
                        // 檢查用戶最終餘額
                        const finalMember = await db.oneOrNone(`
                            SELECT balance FROM members WHERE id = $1
                        `, [member.id]);
                        
                        if (finalMember) {
                            const expectedBalance = currentBalance + totalWinAmount;
                            console.log(`\\n💳 餘額變化:`);
                            console.log(`結算前餘額: $${currentBalance}`);
                            console.log(`實際餘額: $${finalMember.balance}`);
                            console.log(`預期餘額: $${expectedBalance}`);
                            
                            if (Math.abs(parseFloat(finalMember.balance) - expectedBalance) < 0.01) {
                                console.log('✅ 餘額計算正確!');
                            } else {
                                console.log('❌ 餘額計算錯誤!');
                            }
                        }
                        
                        // 驗證結算邏輯
                        console.log(`\\n🔍 結算邏輯驗證:`);
                        if (winCount === 1 && winningNumber >= 1 && winningNumber <= 10) {
                            console.log('✅ 結算邏輯正確: 只有中獎號碼對應的投注獲勝');
                        } else if (winCount === 0) {
                            console.log(`ℹ️ 本期第${position}名開出${winningNumber}號，不在1-10號範圍內，無中獎`);
                        } else {
                            console.log('❌ 結算邏輯異常: 中獎注數不符預期');
                        }
                    }
                    
                    console.log('\\n🎯 測試完成!');
                    clearInterval(monitorInterval);
                    await db.$pool.end();
                } else {
                    // 檢查當前期號是否已變化
                    const newState = await db.oneOrNone(`
                        SELECT current_period FROM game_state ORDER BY id DESC LIMIT 1
                    `);
                    
                    if (newState && newState.current_period > currentState.current_period) {
                        process.stdout.write(`\\n期號已更新到: ${newState.current_period}, 繼續等待結算...`);
                    } else {
                        process.stdout.write('.');
                    }
                }
            } catch (error) {
                console.error('\\n監控過程出錯:', error);
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
testPosition6Betting();