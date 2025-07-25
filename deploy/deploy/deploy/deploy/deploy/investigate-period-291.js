// investigate-period-291.js - 調查期號291的投注消失問題
import db from './db/config.js';

async function investigatePeriod291() {
    try {
        console.log('🔍 調查期號291的投注消失問題...\n');
        
        // 1. 獲取期號291的開獎結果
        const result = await db.oneOrNone('SELECT period, result FROM result_history WHERE period = 20250714291');
        if (!result) {
            console.log('❌ 找不到期號291的開獎結果');
            await db.$pool.end();
            return;
        }
        
        console.log('期號291開獎結果:');
        console.log('原始結果:', result.result);
        
        let positions = [];
        if (Array.isArray(result.result)) {
            positions = result.result;
        } else if (typeof result.result === 'string') {
            positions = result.result.split(',').map(n => parseInt(n.trim()));
        }
        
        console.log('解析後位置:', positions);
        console.log('各位置分析:');
        positions.forEach((num, index) => {
            const posName = ['冠軍', '亞軍', '第三名', '第四名', '第五名', '第六名', '第七名', '第八名', '第九名', '第十名'][index];
            const size = num >= 6 ? '大' : '小';
            const oddEven = num % 2 === 0 ? '雙' : '單';
            console.log(`  ${posName}: ${num} (${size}, ${oddEven})`);
        });
        
        // 2. 獲取所有期號291的投注記錄
        const allBets = await db.any(`
            SELECT id, bet_type, bet_value, position, amount, odds, win, win_amount, settled, created_at
            FROM bet_history 
            WHERE period = 20250714291 AND username = 'justin111'
            ORDER BY id
        `);
        
        console.log(`\n📊 期號291投注統計:`);
        console.log(`總投注記錄數: ${allBets.length}`);
        console.log(`已結算投注數: ${allBets.filter(b => b.settled).length}`);
        console.log(`未結算投注數: ${allBets.filter(b => !b.settled).length}`);
        console.log(`中獎投注數: ${allBets.filter(b => b.win).length}`);
        
        // 3. 按投注類型分組統計
        const betsByType = {};
        allBets.forEach(bet => {
            const key = `${bet.bet_type}_${bet.bet_value}`;
            if (!betsByType[key]) {
                betsByType[key] = [];
            }
            betsByType[key].push(bet);
        });
        
        console.log('\n📋 投注詳細分析:');
        
        // 預期的40注組合
        const expectedBets = [];
        const betTypes = ['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
        const betValues = ['big', 'small', 'odd', 'even'];
        
        betTypes.forEach(type => {
            betValues.forEach(value => {
                expectedBets.push(`${type}_${value}`);
            });
        });
        
        console.log(`預期投注組合數: ${expectedBets.length}`);
        console.log(`實際投注組合數: ${Object.keys(betsByType).length}`);
        
        // 4. 檢查缺失的投注
        const missingBets = expectedBets.filter(expected => !betsByType[expected]);
        if (missingBets.length > 0) {
            console.log(`\n❌ 缺失的投注組合 (${missingBets.length}個):`);
            missingBets.forEach(missing => {
                console.log(`  ${missing}`);
            });
        }
        
        // 5. 檢查應該中獎但沒有出現的投注
        console.log('\n🔍 檢查應該中獎的投注:');
        
        const positionNames = ['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
        
        positions.forEach((num, index) => {
            const posType = positionNames[index];
            const size = num >= 6 ? 'big' : 'small';
            const oddEven = num % 2 === 0 ? 'even' : 'odd';
            
            // 檢查大小投注
            const sizeKey = `${posType}_${size}`;
            const sizeWinner = betsByType[sizeKey];
            if (!sizeWinner) {
                console.log(`❌ 缺失中獎投注: ${posType} ${size} (${num}號)`);
            } else if (!sizeWinner[0].win) {
                console.log(`❌ 應中獎但標記為輸: ${posType} ${size} (${num}號) - ID ${sizeWinner[0].id}`);
            } else {
                console.log(`✅ 正確中獎: ${posType} ${size} (${num}號) - ID ${sizeWinner[0].id}`);
            }
            
            // 檢查單雙投注
            const oddEvenKey = `${posType}_${oddEven}`;
            const oddEvenWinner = betsByType[oddEvenKey];
            if (!oddEvenWinner) {
                console.log(`❌ 缺失中獎投注: ${posType} ${oddEven} (${num}號)`);
            } else if (!oddEvenWinner[0].win) {
                console.log(`❌ 應中獎但標記為輸: ${posType} ${oddEven} (${num}號) - ID ${oddEvenWinner[0].id}`);
            } else {
                console.log(`✅ 正確中獎: ${posType} ${oddEven} (${num}號) - ID ${oddEvenWinner[0].id}`);
            }
        });
        
        // 6. 檢查投注時間範圍
        if (allBets.length > 0) {
            const timeRange = {
                earliest: new Date(Math.min(...allBets.map(b => new Date(b.created_at)))),
                latest: new Date(Math.max(...allBets.map(b => new Date(b.created_at))))
            };
            console.log('\n⏰ 投注時間範圍:');
            console.log(`最早: ${timeRange.earliest.toLocaleString('zh-TW')}`);
            console.log(`最晚: ${timeRange.latest.toLocaleString('zh-TW')}`);
            console.log(`時間跨度: ${(timeRange.latest - timeRange.earliest) / 1000} 秒`);
        }
        
        // 7. 檢查是否有重複的投注ID或組合
        const duplicateChecks = {};
        allBets.forEach(bet => {
            const key = `${bet.bet_type}_${bet.bet_value}`;
            if (duplicateChecks[key]) {
                console.log(`⚠️ 發現重複投注: ${key} - IDs: ${duplicateChecks[key].id}, ${bet.id}`);
            } else {
                duplicateChecks[key] = bet;
            }
        });
        
        // 8. 計算應該的總中獎金額
        let expectedWinAmount = 0;
        let actualWinAmount = 0;
        
        positions.forEach((num, index) => {
            const posType = positionNames[index];
            const size = num >= 6 ? 'big' : 'small';
            const oddEven = num % 2 === 0 ? 'even' : 'odd';
            
            // 每個位置應該有2注中獎（大小+單雙）
            expectedWinAmount += 2 * 100 * 1.98; // 2注 × 100元 × 1.98賠率
        });
        
        allBets.filter(b => b.win).forEach(bet => {
            actualWinAmount += parseFloat(bet.win_amount);
        });
        
        console.log('\n💰 中獎金額統計:');
        console.log(`預期總中獎: $${expectedWinAmount} (20注 × $198)`);
        console.log(`實際總中獎: $${actualWinAmount}`);
        console.log(`差額: $${expectedWinAmount - actualWinAmount}`);
        
        await db.$pool.end();
    } catch (error) {
        console.error('調查過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

investigatePeriod291();