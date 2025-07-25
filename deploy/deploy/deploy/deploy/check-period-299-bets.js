// check-period-299-bets.js - 檢查期號299的實際投注記錄
import db from './db/config.js';

async function checkPeriod299Bets() {
    try {
        console.log('🔍 檢查期號299的實際投注記錄...\n');
        
        // 獲取所有投注記錄的詳細信息
        const allBets = await db.any(`
            SELECT id, bet_type, bet_value, position, amount, odds, win, win_amount, settled, created_at
            FROM bet_history 
            WHERE period = 20250714299 AND username = 'justin111'
            ORDER BY created_at, id
        `);
        
        console.log(`找到 ${allBets.length} 筆投注記錄:\n`);
        
        // 顯示前10筆的詳細信息
        console.log('投注詳情（前10筆）:');
        allBets.slice(0, 10).forEach((bet, index) => {
            console.log(`${index + 1}. ID: ${bet.id}`);
            console.log(`   bet_type: "${bet.bet_type}"`);
            console.log(`   bet_value: "${bet.bet_value}"`);
            console.log(`   position: ${bet.position}`);
            console.log(`   amount: $${bet.amount}`);
            console.log(`   odds: ${bet.odds}`);
            console.log(`   win: ${bet.win}`);
            console.log(`   win_amount: ${bet.win_amount}`);
            console.log(`   settled: ${bet.settled}`);
            console.log(`   created_at: ${bet.created_at.toLocaleString('zh-TW')}`);
            console.log('');
        });
        
        // 統計bet_type的分佈
        const betTypeCount = {};
        allBets.forEach(bet => {
            if (!betTypeCount[bet.bet_type]) {
                betTypeCount[bet.bet_type] = 0;
            }
            betTypeCount[bet.bet_type]++;
        });
        
        console.log('投注類型分佈:');
        Object.entries(betTypeCount).forEach(([type, count]) => {
            console.log(`  "${type}": ${count}筆`);
        });
        
        // 統計bet_value的分佈
        const betValueCount = {};
        allBets.forEach(bet => {
            if (!betValueCount[bet.bet_value]) {
                betValueCount[bet.bet_value] = 0;
            }
            betValueCount[bet.bet_value]++;
        });
        
        console.log('\n投注選項分佈:');
        Object.entries(betValueCount).forEach(([value, count]) => {
            console.log(`  "${value}": ${count}筆`);
        });
        
        // 檢查是否有中文編碼問題
        console.log('\n檢查可能的編碼問題:');
        const uniqueBetTypes = [...new Set(allBets.map(b => b.bet_type))];
        uniqueBetTypes.forEach(type => {
            console.log(`  bet_type: "${type}" (長度: ${type.length}, 字符碼: ${[...type].map(c => c.charCodeAt(0)).join(', ')})`);
        });
        
        // 獲取開獎結果
        const result = await db.one('SELECT result FROM result_history WHERE period = 20250714299');
        const positions = Array.isArray(result.result) ? result.result : result.result.split(',').map(n => parseInt(n.trim()));
        
        console.log('\n開獎結果:', positions);
        console.log('各位置單雙:');
        positions.forEach((num, index) => {
            const posName = ['冠軍', '亞軍', '第三名', '第四名', '第五名', '第六名', '第七名', '第八名', '第九名', '第十名'][index];
            console.log(`  ${posName}: ${num} (${num % 2 === 0 ? '雙' : '單'})`);
        });
        
        // 手動檢查哪些應該中獎
        console.log('\n🎯 根據實際數據分析中獎情況:');
        
        let shouldWinBets = [];
        allBets.forEach(bet => {
            let positionIndex = -1;
            
            // 根據實際的bet_type值來判斷位置
            if (bet.bet_type.includes('冠') || bet.bet_type === 'champion') {
                positionIndex = 0;
            } else if (bet.bet_type.includes('亚') || bet.bet_type.includes('亞') || bet.bet_type === 'runnerup') {
                positionIndex = 1;
            } else if (bet.bet_type.includes('第三') || bet.bet_type === 'third') {
                positionIndex = 2;
            } else if (bet.bet_type.includes('第四') || bet.bet_type === 'fourth') {
                positionIndex = 3;
            } else if (bet.bet_type.includes('第五') || bet.bet_type === 'fifth') {
                positionIndex = 4;
            } else if (bet.bet_type.includes('第六') || bet.bet_type === 'sixth') {
                positionIndex = 5;
            } else if (bet.bet_type.includes('第七') || bet.bet_type === 'seventh') {
                positionIndex = 6;
            } else if (bet.bet_type.includes('第八') || bet.bet_type === 'eighth') {
                positionIndex = 7;
            } else if (bet.bet_type.includes('第九') || bet.bet_type === 'ninth') {
                positionIndex = 8;
            } else if (bet.bet_type.includes('第十') || bet.bet_type === 'tenth') {
                positionIndex = 9;
            }
            
            if (positionIndex >= 0) {
                const positionValue = positions[positionIndex];
                const isEven = positionValue % 2 === 0;
                const betIsEven = bet.bet_value === '雙' || bet.bet_value === 'even';
                const betIsOdd = bet.bet_value === '單' || bet.bet_value === 'odd';
                
                const shouldWin = (betIsEven && isEven) || (betIsOdd && !isEven);
                
                if (shouldWin) {
                    shouldWinBets.push({
                        ...bet,
                        positionIndex,
                        positionValue,
                        reason: `${bet.bet_type} 開出 ${positionValue} (${isEven ? '雙' : '單'}), 投注 ${bet.bet_value}`
                    });
                }
            }
        });
        
        console.log(`\n應該中獎的投注 (${shouldWinBets.length}筆):`);
        shouldWinBets.forEach(bet => {
            console.log(`❌ ID ${bet.id}: ${bet.reason}`);
            console.log(`   狀態: win=${bet.win}, win_amount=${bet.win_amount}`);
        });
        
        const totalMissingWinAmount = shouldWinBets.length * 198;
        console.log(`\n💰 遺失的中獎金額: $${totalMissingWinAmount}`);
        
        await db.$pool.end();
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

checkPeriod299Bets();