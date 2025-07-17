// check-period-219.js - 檢查期號219的結算問題
import db from './db/config.js';

async function checkPeriod219() {
    console.log('🔍 檢查期號 20250714219 的結算問題...\n');
    
    try {
        // 1. 查詢期號 20250714219 的開獎結果
        const result = await db.oneOrNone(`
            SELECT period, result, created_at
            FROM result_history
            WHERE period = 20250714219
        `);
        
        if (!result) {
            console.log('找不到期號 20250714219 的開獎結果');
            return;
        }
        
        console.log(`期號: ${result.period}`);
        console.log(`開獎時間: ${result.created_at}`);
        console.log(`原始結果數據: ${result.result}`);
        
        // 解析開獎結果
        let positions = [];
        try {
            // 嘗試多種解析方式
            if (typeof result.result === 'string') {
                if (result.result.startsWith('[') && result.result.endsWith(']')) {
                    // 直接的數組字符串
                    positions = JSON.parse(result.result);
                } else if (result.result.includes('positions')) {
                    // 包含positions屬性的對象
                    const resultObj = JSON.parse(result.result);
                    positions = resultObj.positions || resultObj;
                } else {
                    // 其他格式
                    positions = JSON.parse(result.result);
                }
            } else if (Array.isArray(result.result)) {
                positions = result.result;
            } else {
                positions = result.result.positions || [];
            }
        } catch (e) {
            console.error('解析開獎結果失敗:', e);
            console.log('嘗試手動解析...');
            // 如果所有解析都失敗，輸出原始數據
            console.log('原始數據類型:', typeof result.result);
            console.log('原始數據內容:', result.result);
        }
        
        if (positions.length > 0) {
            console.log('\n📋 開獎結果（各名次號碼）：');
            positions.forEach((num, idx) => {
                const highlight = idx === 6 ? ' ← 第7名' : '';
                console.log(`第${idx + 1}名: ${num}號${highlight}`);
            });
            
            console.log(`\n⚠️ 關鍵信息: 第7名開出 ${positions[6]}號`);
        }
        
        // 2. 查詢該期第7名的所有投注記錄
        const bets = await db.any(`
            SELECT id, username, bet_type, bet_value, position, amount, odds, 
                   win, win_amount, settled, created_at
            FROM bet_history
            WHERE period = 20250714219
            AND bet_type = 'number'
            AND position = 7
            ORDER BY created_at ASC
        `);
        
        if (bets.length > 0) {
            console.log(`\n📊 期號219第7名的投注記錄 (共${bets.length}筆):\n`);
            
            let correctWins = 0;
            let incorrectWins = 0;
            let problemBets = [];
            
            bets.forEach(bet => {
                const actualWinner = positions[6]; // 第7名的實際開獎號碼
                const shouldWin = parseInt(bet.bet_value) === actualWinner;
                const actualResult = bet.win;
                const isCorrect = shouldWin === actualResult;
                
                const status = isCorrect ? '✅' : '❌';
                const issue = isCorrect ? '' : ' ← 結算錯誤!';
                
                console.log(`${status} 投注ID: ${bet.id}`);
                console.log(`   用戶: ${bet.username}`);
                console.log(`   投注: 第7名 = ${bet.bet_value}號`);
                console.log(`   金額: $${bet.amount}, 賠率: ${bet.odds}`);
                console.log(`   應該: ${shouldWin ? '中獎' : '未中獎'}`);
                console.log(`   實際: ${actualResult ? '中獎' : '未中獎'}${issue}`);
                if (bet.win) {
                    console.log(`   中獎金額: $${bet.win_amount}`);
                }
                console.log('');
                
                if (isCorrect) {
                    if (shouldWin) correctWins++;
                } else {
                    incorrectWins++;
                    problemBets.push({
                        id: bet.id,
                        username: bet.username,
                        bet_value: bet.bet_value,
                        shouldWin,
                        actualResult,
                        amount: bet.amount,
                        win_amount: bet.win_amount || 0
                    });
                }
            });
            
            // 3. 總結
            console.log('=' .repeat(50));
            console.log('📈 結算總結:');
            console.log(`正確結算: ${bets.length - incorrectWins} 筆`);
            console.log(`錯誤結算: ${incorrectWins} 筆`);
            
            if (problemBets.length > 0) {
                console.log('\n⚠️ 發現問題的注單:');
                problemBets.forEach(bet => {
                    console.log(`- ID ${bet.id}: ${bet.username} 投注${bet.bet_value}號, ` +
                              `${bet.shouldWin ? '應中獎但判為未中' : '不應中獎但判為中獎'}, ` +
                              `涉及金額: $${bet.shouldWin ? bet.amount * 9.89 : bet.win_amount}`);
                });
                
                console.log('\n🔧 需要修復的問題:');
                if (positions[6]) {
                    console.log(`- 第7名實際開出: ${positions[6]}號`);
                    console.log(`- 只有投注${positions[6]}號的注單應該中獎`);
                    console.log(`- 其他號碼的注單都應該是未中獎`);
                } else {
                    console.log('- 無法確定第7名的開獎號碼，需要進一步檢查');
                }
            } else {
                console.log('\n✅ 所有注單結算正確！');
            }
        } else {
            console.log('\n📭 該期第7名沒有投注記錄');
        }
        
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行檢查
checkPeriod219();