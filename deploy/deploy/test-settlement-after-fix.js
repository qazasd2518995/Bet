// test-settlement-after-fix.js - 測試修復後的結算功能
import db from './db/config.js';

async function testSettlement() {
    console.log('🧪 測試修復後的結算功能...\n');
    
    try {
        // 1. 檢查用戶當前餘額
        const member = await db.one(`
            SELECT id, username, balance FROM members WHERE username = 'justin111'
        `);
        
        console.log(`當前用戶資訊：`);
        console.log(`用戶名: ${member.username}`);
        console.log(`用戶ID: ${member.id}`);
        console.log(`當前餘額: ${member.balance}`);
        
        // 2. 獲取當前期號
        const currentGame = await db.oneOrNone(`
            SELECT period, status, countdown FROM game_state 
            ORDER BY id DESC LIMIT 1
        `);
        
        if (!currentGame || currentGame.status !== 'betting') {
            console.log('\n⚠️ 當前不是投注時間，請稍後再試');
            return;
        }
        
        console.log(`\n當前期號: ${currentGame.period}`);
        console.log(`狀態: ${currentGame.status}`);
        console.log(`倒計時: ${currentGame.countdown} 秒`);
        
        // 3. 下測試注單（只下一注，避免餘額不足）
        if (currentGame.countdown > 10) {
            console.log('\n📝 下注測試：');
            console.log('下注號碼 5 在第1名，金額 100 元');
            
            // 模擬API調用下注
            const betResponse = await fetch('http://localhost:3000/api/bet', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: 'justin111',
                    betType: 'number',
                    value: '5',
                    position: 1,
                    amount: 100,
                    period: currentGame.period
                })
            });
            
            const betResult = await betResponse.json();
            console.log('下注結果:', betResult);
            
            if (betResult.success) {
                console.log('✅ 下注成功！');
                console.log(`注單ID: ${betResult.betId}`);
                console.log(`餘額: ${betResult.balance}`);
                
                // 4. 等待開獎和結算
                console.log('\n⏳ 等待開獎和結算...');
                console.log('請觀察 backend.log 中的結算日誌');
                console.log('應該看到：');
                console.log('1. "使用改進的結算系統結算" 的訊息');
                console.log('2. 沒有 "legacySettleBets" 的警告');
                console.log('3. 沒有 "會員點數設置" 的 adjustment 交易');
                
                // 設置檢查函數
                const checkSettlement = async () => {
                    // 等待結算完成（約70秒後）
                    await new Promise(resolve => setTimeout(resolve, 70000));
                    
                    // 檢查結算結果
                    const bet = await db.oneOrNone(`
                        SELECT * FROM bet_history 
                        WHERE id = $1
                    `, [betResult.betId]);
                    
                    console.log('\n📊 結算結果：');
                    console.log(`注單狀態: ${bet.settled ? '已結算' : '未結算'}`);
                    console.log(`是否中獎: ${bet.win ? '是' : '否'}`);
                    
                    if (bet.win) {
                        console.log(`中獎金額: ${bet.win_amount}`);
                        
                        // 檢查交易記錄
                        const transactions = await db.any(`
                            SELECT * FROM transaction_records 
                            WHERE user_id = $1 
                            AND user_type = 'member'
                            AND created_at >= NOW() - INTERVAL '5 minutes'
                            ORDER BY created_at DESC
                        `, [member.id]);
                        
                        console.log(`\n最近的交易記錄：`);
                        transactions.forEach(tx => {
                            console.log(`- ${tx.transaction_type}: ${tx.amount} (${tx.description})`);
                        });
                        
                        // 檢查是否有 adjustment
                        const hasAdjustment = transactions.some(tx => 
                            tx.transaction_type === 'adjustment' && 
                            tx.description === '會員點數設置'
                        );
                        
                        if (hasAdjustment) {
                            console.log('\n❌ 發現 adjustment 交易！可能仍有重複結算');
                        } else {
                            console.log('\n✅ 沒有發現 adjustment 交易，結算正常！');
                        }
                    }
                    
                    // 顯示最終餘額
                    const finalMember = await db.one(`
                        SELECT balance FROM members WHERE username = 'justin111'
                    `);
                    console.log(`\n最終餘額: ${finalMember.balance}`);
                };
                
                // 執行檢查
                checkSettlement().catch(console.error);
                
            } else {
                console.log('❌ 下注失敗:', betResult.message);
            }
        } else {
            console.log('\n⚠️ 倒計時太短，等待下一期再測試');
        }
        
    } catch (error) {
        console.error('測試過程中發生錯誤:', error);
    }
}

// 執行測試（不關閉資料庫連接，因為需要等待結算）
testSettlement();