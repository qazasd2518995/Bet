import fetch from 'node-fetch';
import db from './db/config.js';

async function testLocalBettingFlow() {
    try {
        console.log('=== 測試本地下注和退水流程 ===\n');
        
        // 本地 API
        const apiUrl = 'http://localhost:3000';
        
        // 1. 登入
        console.log('1. 登入 justin111...');
        const loginResponse = await fetch(`${apiUrl}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'justin111',
                password: 'aaaa00'
            })
        });
        
        if (!loginResponse.ok) {
            console.error('登入請求失敗:', loginResponse.status);
            return;
        }
        
        const loginData = await loginResponse.json();
        if (!loginData.success) {
            console.error('登入失敗:', loginData.message);
            return;
        }
        
        const token = loginData.token;
        console.log('✅ 登入成功');
        console.log(`初始餘額: ${loginData.user.balance}`);
        
        // 記錄初始代理餘額
        const initialAgentBalances = await db.any(`
            SELECT username, balance FROM agents
            WHERE username IN ('justin2025A', 'ti2025A')
            ORDER BY username
        `);
        console.log('\n初始代理餘額:');
        initialAgentBalances.forEach(a => {
            console.log(`  ${a.username}: ${a.balance}`);
        });
        
        // 2. 獲取遊戲狀態
        console.log('\n2. 獲取遊戲狀態...');
        const gameStateResponse = await fetch(`${apiUrl}/api/game-state?username=justin111`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const gameState = await gameStateResponse.json();
        console.log(`當前期號: ${gameState.currentPeriod}`);
        console.log(`遊戲狀態: ${gameState.gameStatus}`);
        console.log(`倒數時間: ${gameState.countdownTime}秒`);
        
        if (gameState.gameStatus !== 'waiting') {
            console.log('\n⏳ 不在下注時間，等待下一期...');
            console.log('請等待當前期結束後重新運行測試');
            return;
        }
        
        const testPeriod = gameState.currentPeriod;
        
        // 3. 下注
        console.log('\n3. 進行測試下注...');
        const betData = {
            username: 'justin111',
            bets: [{
                type: 'champion',
                value: 'big',
                amount: 1000
            }]
        };
        
        const betResponse = await fetch(`${apiUrl}/api/place-bet`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(betData)
        });
        
        const betResult = await betResponse.json();
        if (!betResult.success) {
            console.error('❌ 下注失敗:', betResult.message);
            return;
        }
        
        console.log('✅ 下注成功！');
        console.log(`下注期號: ${testPeriod}`);
        console.log(`下注金額: ${betData.bets[0].amount}`);
        console.log(`下注類型: ${betData.bets[0].type}/${betData.bets[0].value}`);
        console.log(`剩餘餘額: ${betResult.balance}`);
        
        // 4. 等待開獎和結算
        console.log('\n4. 等待開獎和結算（最多90秒）...');
        console.log('監控中...');
        
        let settled = false;
        let rebateFound = false;
        const startTime = Date.now();
        const maxWaitTime = 90000; // 90秒
        
        while (!settled && (Date.now() - startTime < maxWaitTime)) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // 每3秒檢查一次
            
            // 檢查是否已結算
            const betStatus = await db.oneOrNone(`
                SELECT settled, win, win_amount 
                FROM bet_history 
                WHERE username = 'justin111' 
                AND period = $1
                ORDER BY created_at DESC
                LIMIT 1
            `, [testPeriod]);
            
            if (betStatus && betStatus.settled) {
                settled = true;
                console.log(`\n✅ 注單已結算！`);
                console.log(`結果: ${betStatus.win ? '贏' : '輸'}`);
                if (betStatus.win) {
                    console.log(`派彩金額: ${betStatus.win_amount}`);
                }
                
                // 檢查退水
                console.log('\n5. 檢查退水記錄...');
                await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒讓退水處理
                
                const rebates = await db.any(`
                    SELECT 
                        tr.*,
                        a.username as agent_name
                    FROM transaction_records tr
                    JOIN agents a ON tr.user_id = a.id
                    WHERE tr.transaction_type = 'rebate'
                    AND tr.period = $1
                    ORDER BY tr.created_at DESC
                `, [testPeriod]);
                
                if (rebates.length > 0) {
                    rebateFound = true;
                    console.log(`\n✅ 找到 ${rebates.length} 筆退水記錄：`);
                    rebates.forEach(r => {
                        console.log(`  ${r.agent_name}: ${r.amount}元`);
                    });
                } else {
                    console.log('\n❌ 沒有找到退水記錄！');
                    
                    // 嘗試手動觸發退水
                    console.log('\n嘗試手動觸發退水...');
                    const drawResult = await db.oneOrNone(`
                        SELECT * FROM result_history WHERE period = $1
                    `, [testPeriod]);
                    
                    if (drawResult) {
                        const { enhancedSettlement } = await import('./enhanced-settlement-system.js');
                        const winResult = {
                            positions: [
                                drawResult.position_1,
                                drawResult.position_2,
                                drawResult.position_3,
                                drawResult.position_4,
                                drawResult.position_5,
                                drawResult.position_6,
                                drawResult.position_7,
                                drawResult.position_8,
                                drawResult.position_9,
                                drawResult.position_10
                            ]
                        };
                        
                        const settlementResult = await enhancedSettlement(testPeriod, winResult);
                        console.log('手動結算結果:', settlementResult);
                        
                        // 再次檢查退水
                        const newRebates = await db.any(`
                            SELECT tr.*, a.username as agent_name
                            FROM transaction_records tr
                            JOIN agents a ON tr.user_id = a.id
                            WHERE tr.transaction_type = 'rebate'
                            AND tr.period = $1
                        `, [testPeriod]);
                        
                        if (newRebates.length > 0) {
                            console.log('\n✅ 手動觸發後找到退水：');
                            newRebates.forEach(r => {
                                console.log(`  ${r.agent_name}: ${r.amount}元`);
                            });
                        }
                    }
                }
            }
        }
        
        if (!settled) {
            console.log('\n⏱️ 超時：等待結算超過90秒');
        }
        
        // 6. 最終餘額對比
        console.log('\n6. 最終餘額對比：');
        const finalAgentBalances = await db.any(`
            SELECT username, balance FROM agents
            WHERE username IN ('justin2025A', 'ti2025A')
            ORDER BY username
        `);
        
        console.log('\n代理餘額變化:');
        finalAgentBalances.forEach((final, index) => {
            const initial = initialAgentBalances[index];
            const change = parseFloat(final.balance) - parseFloat(initial.balance);
            console.log(`  ${final.username}: ${initial.balance} → ${final.balance} (${change >= 0 ? '+' : ''}${change.toFixed(2)})`);
        });
        
        // 診斷結果
        console.log('\n=== 診斷結果 ===');
        if (settled && rebateFound) {
            console.log('✅ 結算和退水都正常運作');
        } else if (settled && !rebateFound) {
            console.log('⚠️ 結算正常但退水沒有自動觸發');
            console.log('可能原因：');
            console.log('1. enhanced-settlement-system.js 的退水邏輯沒有被執行');
            console.log('2. 退水 API 調用失敗');
            console.log('3. 退水檢查邏輯有問題');
        } else {
            console.log('❌ 結算沒有完成');
        }
        
    } catch (error) {
        console.error('測試錯誤:', error);
    } finally {
        process.exit(0);
    }
}

// 執行測試
testLocalBettingFlow();