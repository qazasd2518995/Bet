// diagnose-betting-limit-issue.js - 診斷限紅問題
import db from './db/config.js';

async function diagnoseBettingLimitIssue() {
    console.log('診斷限紅問題...\n');
    
    const username = 'justin111';
    const period = '20250718432'; // 請替換為實際期號
    
    try {
        // 1. 查詢用戶當期所有投注
        const userBets = await db.manyOrNone(`
            SELECT id, bet_type, bet_value, position, amount, created_at
            FROM bet_history
            WHERE username = $1 AND period = $2
            ORDER BY created_at DESC
        `, [username, period]);
        
        console.log(`用戶 ${username} 在期號 ${period} 的投注記錄：`);
        console.log('================================================');
        
        if (userBets.length === 0) {
            console.log('沒有找到投注記錄');
            return;
        }
        
        // 按選項分組統計
        const betsByOption = {};
        
        userBets.forEach((bet, index) => {
            console.log(`\n投注 ${index + 1}:`);
            console.log(`  ID: ${bet.id}`);
            console.log(`  類型: ${bet.bet_type}`);
            console.log(`  值: ${bet.bet_value}`);
            console.log(`  位置: ${bet.position || 'N/A'}`);
            console.log(`  金額: $${bet.amount}`);
            console.log(`  時間: ${bet.created_at}`);
            
            // 建立選項鍵
            const optionKey = `${bet.bet_type}-${bet.bet_value}${bet.position ? `-${bet.position}` : ''}`;
            
            if (!betsByOption[optionKey]) {
                betsByOption[optionKey] = {
                    betType: bet.bet_type,
                    betValue: bet.bet_value,
                    position: bet.position,
                    totalAmount: 0,
                    count: 0,
                    bets: []
                };
            }
            
            betsByOption[optionKey].totalAmount += parseFloat(bet.amount);
            betsByOption[optionKey].count++;
            betsByOption[optionKey].bets.push(bet);
        });
        
        console.log('\n\n按選項分組統計：');
        console.log('================================================');
        
        Object.entries(betsByOption).forEach(([key, data]) => {
            console.log(`\n選項: ${key}`);
            console.log(`  投注次數: ${data.count}`);
            console.log(`  累計金額: $${data.totalAmount}`);
            console.log(`  詳細:`);
            data.bets.forEach(bet => {
                console.log(`    - ID ${bet.id}: $${bet.amount}`);
            });
        });
        
        // 2. 分析兩面投注
        console.log('\n\n兩面投注分析：');
        console.log('================================================');
        
        const twoSideBets = userBets.filter(bet => 
            ['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(bet.bet_type) &&
            ['big', 'small', 'odd', 'even', '大', '小', '單', '雙'].includes(bet.bet_value)
        );
        
        if (twoSideBets.length > 0) {
            const twoSideByOption = {};
            
            twoSideBets.forEach(bet => {
                const optionKey = `${bet.bet_type}-${bet.bet_value}`;
                if (!twoSideByOption[optionKey]) {
                    twoSideByOption[optionKey] = 0;
                }
                twoSideByOption[optionKey] += parseFloat(bet.amount);
            });
            
            console.log('各選項累計：');
            Object.entries(twoSideByOption).forEach(([option, total]) => {
                console.log(`  ${option}: $${total}`);
            });
        } else {
            console.log('沒有兩面投注');
        }
        
        // 3. 查詢會員限紅設定
        console.log('\n\n會員限紅設定：');
        console.log('================================================');
        
        try {
            const AGENT_API_URL = 'https://agent.jphd1314.com';
            const response = await fetch(`${AGENT_API_URL}/api/agent/member-betting-limit-by-username?username=${username}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.config) {
                    console.log(`限紅等級: ${data.levelDisplayName} (${data.levelName})`);
                    console.log('\n兩面限紅:');
                    console.log(`  單注最高: $${data.config.twoSide.maxBet}`);
                    console.log(`  單期限額: $${data.config.twoSide.periodLimit}`);
                    
                    console.log('\n按照新邏輯，每個選項（如冠軍大、冠軍小）應該可以各自下注到 $${data.config.twoSide.periodLimit}`);
                }
            }
        } catch (error) {
            console.error('無法獲取限紅設定:', error.message);
        }
        
    } catch (error) {
        console.error('診斷失敗:', error);
    } finally {
        process.exit();
    }
}

// 執行診斷
diagnoseBettingLimitIssue();