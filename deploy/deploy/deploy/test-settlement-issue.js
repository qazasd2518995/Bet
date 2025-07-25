// test-settlement-issue.js - 測試結算問題
import db from './db/config.js';

async function testSettlementIssue() {
    console.log('🔍 測試結算問題...\n');
    
    try {
        // 1. 查看最近的開獎結果
        console.log('1️⃣ 最近的開獎結果:');
        const recentResults = await db.any(`
            SELECT period, result, created_at
            FROM result_history
            ORDER BY period DESC
            LIMIT 5
        `);
        
        recentResults.forEach(result => {
            console.log(`期號 ${result.period}: [${result.result.join(', ')}] - 冠軍: ${result.result[0]}`);
        });
        
        // 2. 查看 justin111 最近的下注記錄
        console.log('\n2️⃣ justin111 最近的下注記錄:');
        const recentBets = await db.any(`
            SELECT 
                id,
                period,
                bet_type,
                bet_value,
                position,
                amount,
                odds,
                win,
                win_amount,
                settled,
                created_at
            FROM bet_history
            WHERE username = 'justin111'
            AND created_at > NOW() - INTERVAL '30 minutes'
            ORDER BY created_at DESC
            LIMIT 20
        `);
        
        // 按期號分組
        const betsByPeriod = {};
        recentBets.forEach(bet => {
            if (!betsByPeriod[bet.period]) {
                betsByPeriod[bet.period] = [];
            }
            betsByPeriod[bet.period].push(bet);
        });
        
        // 分析每期的下注
        for (const [period, bets] of Object.entries(betsByPeriod)) {
            console.log(`\n期號 ${period}:`);
            
            // 獲取該期的開獎結果
            const gameResult = await db.oneOrNone(`
                SELECT result FROM result_history WHERE period = $1
            `, [period]);
            
            if (gameResult) {
                console.log(`開獎結果: [${gameResult.result.join(', ')}] - 冠軍: ${gameResult.result[0]}`);
            }
            
            let totalBet = 0;
            let totalWin = 0;
            let winCount = 0;
            
            console.log(`\n下注明細:`);
            bets.forEach(bet => {
                const status = bet.win ? '✅ 中獎' : '❌ 未中';
                console.log(`  ${bet.bet_type} ${bet.bet_value}: ${bet.amount} 元, ${status}, 中獎金額: ${bet.win_amount || 0}`);
                totalBet += parseFloat(bet.amount);
                totalWin += parseFloat(bet.win_amount || 0);
                if (bet.win) winCount++;
            });
            
            console.log(`\n統計:`);
            console.log(`  總下注: ${totalBet} 元`);
            console.log(`  中獎注數: ${winCount}`);
            console.log(`  中獎金額: ${totalWin} 元`);
            console.log(`  淨利: ${totalWin - totalBet} 元`);
            
            // 檢查冠軍下注的判定
            const championBets = bets.filter(bet => bet.bet_type === 'champion');
            if (championBets.length > 0 && gameResult) {
                console.log(`\n冠軍下注判定檢查:`);
                const winningNumber = gameResult.result[0];
                console.log(`  冠軍號碼: ${winningNumber}`);
                
                championBets.forEach(bet => {
                    const shouldWin = parseInt(bet.bet_value) === winningNumber;
                    const actualWin = bet.win;
                    
                    if (shouldWin !== actualWin) {
                        console.log(`  ⚠️ 判定錯誤: 下注 ${bet.bet_value} 號, 應該${shouldWin ? '中獎' : '未中'}, 實際${actualWin ? '中獎' : '未中'}`);
                    } else {
                        console.log(`  ✅ 判定正確: 下注 ${bet.bet_value} 號, ${actualWin ? '中獎' : '未中'}`);
                    }
                });
            }
        }
        
        // 3. 檢查結算邏輯
        console.log('\n3️⃣ 檢查結算邏輯:');
        console.log('檢查 checkWin 函數的判定邏輯...');
        
        // 模擬判定
        const testBet = {
            bet_type: 'champion',
            bet_value: '2',
            position: null
        };
        const testResult = [2, 5, 3, 7, 1, 8, 9, 10, 4, 6];
        
        console.log(`\n測試案例:`);
        console.log(`  下注: ${testBet.bet_type} ${testBet.bet_value}`);
        console.log(`  開獎: [${testResult.join(', ')}]`);
        console.log(`  冠軍: ${testResult[0]}`);
        console.log(`  預期: 應該中獎（2號是冠軍）`);
        
    } catch (error) {
        console.error('❌ 測試過程中發生錯誤:', error);
    }
}

// 執行
testSettlementIssue()
    .then(() => {
        console.log('\n測試完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('執行失敗:', error);
        process.exit(1);
    });