import fetch from 'node-fetch';
import db from './db/config.js';

async function testLocalFlow() {
    try {
        console.log('=== 測試本地下注和退水流程 V2 ===\n');
        
        // 本地 API
        const apiUrl = 'http://localhost:3000';
        
        // 1. 登入
        console.log('1. 登入 justin111...');
        const loginResponse = await fetch(`${apiUrl}/api/member/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'justin111',
                password: 'aaaa00'
            })
        });
        
        const loginData = await loginResponse.json();
        if (!loginData.success) {
            console.error('登入失敗:', loginData.message);
            return;
        }
        
        console.log('✅ 登入成功');
        console.log(`餘額: ${loginData.balance}`);
        
        // 2. 獲取遊戲狀態
        console.log('\n2. 獲取遊戲狀態...');
        const gameStateResponse = await fetch(`${apiUrl}/api/game-data`);
        const gameState = await gameStateResponse.json();
        
        console.log(`當前期號: ${gameState.currentPeriod}`);
        console.log(`遊戲狀態: ${gameState.status}`);
        console.log(`倒數時間: ${gameState.countdownSeconds}秒`);
        
        if (gameState.status !== 'betting') {
            console.log('\n⏳ 不在下注時間，手動觸發最近的結算...');
            
            // 找最近未處理退水的期號
            const recentBets = await db.any(`
                SELECT DISTINCT bh.period
                FROM bet_history bh
                WHERE bh.settled = true
                AND bh.username = 'justin111'
                AND NOT EXISTS (
                    SELECT 1 FROM transaction_records tr
                    WHERE tr.transaction_type = 'rebate'
                    AND tr.period = bh.period::text
                )
                ORDER BY bh.period DESC
                LIMIT 1
            `);
            
            if (recentBets.length > 0) {
                const period = recentBets[0].period;
                console.log(`\n找到需要處理退水的期號: ${period}`);
                
                const drawResult = await db.oneOrNone(`
                    SELECT * FROM result_history WHERE period = $1
                `, [period]);
                
                if (drawResult) {
                    console.log('調用結算系統處理退水...');
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
                    
                    const result = await enhancedSettlement(period, winResult);
                    console.log('結算結果:', result);
                }
            }
            
            return;
        }
        
        const testPeriod = gameState.currentPeriod;
        
        // 3. 下注
        console.log('\n3. 進行測試下注...');
        const betResponse = await fetch(`${apiUrl}/api/bet`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'justin111',
                type: 'champion',
                value: 'big',
                amount: 1000,
                period: testPeriod
            })
        });
        
        const betResult = await betResponse.json();
        if (!betResult.success) {
            console.error('❌ 下注失敗:', betResult.message);
            return;
        }
        
        console.log('✅ 下注成功！');
        console.log(`下注期號: ${testPeriod}`);
        console.log(`下注金額: 1000`);
        console.log(`剩餘餘額: ${betResult.balance}`);
        
        // 4. 監控結算
        console.log('\n4. 等待開獎和結算...');
        console.log('請等待本期結束（約60秒）...');
        
        // 持續監控
        let checkCount = 0;
        const checkInterval = setInterval(async () => {
            checkCount++;
            
            // 檢查是否已結算
            const betStatus = await db.oneOrNone(`
                SELECT settled FROM bet_history 
                WHERE username = 'justin111' 
                AND period = $1
                LIMIT 1
            `, [testPeriod]);
            
            if (betStatus && betStatus.settled) {
                console.log('\n✅ 注單已結算！');
                clearInterval(checkInterval);
                
                // 等待3秒讓退水處理
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // 檢查退水
                const rebates = await db.any(`
                    SELECT tr.*, a.username as agent_name
                    FROM transaction_records tr
                    JOIN agents a ON tr.user_id = a.id
                    WHERE tr.transaction_type = 'rebate'
                    AND tr.period = $1
                `, [testPeriod]);
                
                if (rebates.length > 0) {
                    console.log(`\n✅ 找到退水記錄：`);
                    rebates.forEach(r => {
                        console.log(`  ${r.agent_name}: ${r.amount}元`);
                    });
                } else {
                    console.log('\n❌ 沒有找到退水記錄！');
                    console.log('問題診斷：退水邏輯沒有在結算時自動觸發');
                }
                
                process.exit(0);
            }
            
            if (checkCount > 30) { // 90秒超時
                console.log('\n超時：等待結算超過90秒');
                clearInterval(checkInterval);
                process.exit(0);
            }
        }, 3000);
        
    } catch (error) {
        console.error('測試錯誤:', error);
        process.exit(1);
    }
}

// 執行測試
testLocalFlow();