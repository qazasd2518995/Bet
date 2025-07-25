// test-betting.js - 測試下注和結算流程
import fetch from 'node-fetch';
import db from './db/config.js';

const GAME_API_URL = 'http://localhost:3000';

async function testBetting() {
    console.log('🎯 測試下注和結算流程...\n');
    
    try {
        // 1. 獲取當前遊戲狀態
        console.log('📊 獲取當前遊戲狀態...');
        const gameStateResponse = await fetch(`${GAME_API_URL}/api/game-state?username=justin111`);
        const gameState = await gameStateResponse.json();
        
        if (!gameState.success) {
            console.error('無法獲取遊戲狀態:', gameState.message);
            return;
        }
        
        const currentPeriod = gameState.current_period;
        const countdown = gameState.countdown_seconds;
        const status = gameState.status;
        
        console.log(`當前期號: ${currentPeriod}`);
        console.log(`當前狀態: ${status}`);
        console.log(`倒計時: ${countdown}秒`);
        
        if (status !== 'betting' || countdown < 15) {
            console.log('⚠️ 不適合下注時機，等待下一期...');
            return;
        }
        
        // 2. 下注測試
        console.log('\n🎯 開始下注測試...');
        const betData = {
            username: 'justin111',
            password: 'aaaa00',
            amount: 100,
            betType: 'number',
            value: '5',
            position: 3, // 第3名
            period: currentPeriod
        };
        
        console.log(`投注內容: 期號${currentPeriod} 第3名=5號 $100`);
        
        const betResponse = await fetch(`${GAME_API_URL}/api/bet`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(betData)
        });
        
        const betResult = await betResponse.json();
        
        if (betResult.success) {
            console.log('✅ 下注成功!');
            console.log(`投注ID: 可能在數據庫中`);
            
            // 查詢剛才的投注記錄
            const newBet = await db.oneOrNone(`
                SELECT id, period, bet_type, bet_value, position, amount, odds, settled
                FROM bet_history
                WHERE username = 'justin111' 
                AND period = $1
                ORDER BY created_at DESC
                LIMIT 1
            `, [currentPeriod]);
            
            if (newBet) {
                console.log(`✅ 投注記錄已保存: ID ${newBet.id}`);
                console.log(`詳情: 期號${newBet.period} 第${newBet.position}名=${newBet.bet_value}號 $${newBet.amount} 賠率${newBet.odds}`);
                console.log(`結算狀態: ${newBet.settled ? '已結算' : '未結算'}`);
                
                // 3. 等待開獎和結算
                console.log('\n⏰ 等待本期開獎和結算...');
                console.log(`請等待 ${countdown + 15} 秒後檢查結算結果`);
                
                // 設置監控
                const monitorInterval = setInterval(async () => {
                    try {
                        // 檢查投注是否已結算
                        const updatedBet = await db.oneOrNone(`
                            SELECT settled, win, win_amount, settled_at
                            FROM bet_history
                            WHERE id = $1
                        `, [newBet.id]);
                        
                        if (updatedBet && updatedBet.settled) {
                            console.log('\n✅ 投注已結算!');
                            console.log(`結算結果: ${updatedBet.win ? '中獎' : '未中獎'}`);
                            if (updatedBet.win) {
                                console.log(`中獎金額: $${updatedBet.win_amount}`);
                            }
                            console.log(`結算時間: ${updatedBet.settled_at}`);
                            
                            // 檢查開獎結果
                            const drawResult = await db.oneOrNone(`
                                SELECT result
                                FROM result_history
                                WHERE period = $1
                            `, [currentPeriod]);
                            
                            if (drawResult) {
                                let positions = [];
                                if (Array.isArray(drawResult.result)) {
                                    positions = drawResult.result;
                                } else if (typeof drawResult.result === 'string') {
                                    positions = drawResult.result.split(',').map(n => parseInt(n.trim()));
                                }
                                
                                console.log(`開獎結果: [${positions.join(',')}]`);
                                console.log(`第3名開出: ${positions[2]}號`);
                                
                                const shouldWin = positions[2] === 5;
                                const actualWin = updatedBet.win;
                                
                                if (shouldWin === actualWin) {
                                    console.log('✅ 結算正確!');
                                } else {
                                    console.log('❌ 結算錯誤!');
                                    console.log(`應該: ${shouldWin ? '中獎' : '未中獎'}`);
                                    console.log(`實際: ${actualWin ? '中獎' : '未中獎'}`);
                                }
                            }
                            
                            clearInterval(monitorInterval);
                            await db.$pool.end();
                        } else {
                            process.stdout.write('.');
                        }
                    } catch (error) {
                        console.error('\n監控過程出錯:', error);
                        clearInterval(monitorInterval);
                        await db.$pool.end();
                    }
                }, 3000); // 每3秒檢查一次
                
                // 5分鐘後停止監控
                setTimeout(() => {
                    console.log('\n⏰ 監控超時，停止檢查');
                    clearInterval(monitorInterval);
                    db.$pool.end();
                }, 300000);
                
            } else {
                console.log('❌ 找不到投注記錄');
                await db.$pool.end();
            }
            
        } else {
            console.log('❌ 下注失敗:', betResult.message);
            await db.$pool.end();
        }
        
    } catch (error) {
        console.error('測試過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

// 執行測試
testBetting();