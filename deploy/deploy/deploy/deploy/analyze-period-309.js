// analyze-period-309.js - 分析期號309的結算問題
import db from './db/config.js';
import { checkWin } from './improved-settlement-system.js';

async function analyzePeriod309() {
    try {
        console.log('🔍 分析期號309的結算問題...\n');
        
        // 1. 獲取期號309的開獎結果
        const result = await db.oneOrNone('SELECT period, result FROM result_history WHERE period = 20250714309');
        if (!result) {
            console.log('❌ 找不到期號309的開獎結果');
            await db.$pool.end();
            return;
        }
        
        console.log('期號309開獎結果:');
        console.log('原始結果:', result.result);
        
        let positions = [];
        if (Array.isArray(result.result)) {
            positions = result.result;
        } else if (typeof result.result === 'string') {
            positions = result.result.split(',').map(n => parseInt(n.trim()));
        }
        
        console.log('解析後位置:', positions);
        console.log('\n各位置分析:');
        const positionNames = ['冠軍', '亞軍', '第三名', '第四名', '第五名', '第六名', '第七名', '第八名', '第九名', '第十名'];
        positions.forEach((num, index) => {
            const size = num >= 6 ? '大' : '小';
            const oddEven = num % 2 === 0 ? '雙' : '單';
            console.log(`  ${positionNames[index]}: ${num} (${size}, ${oddEven})`);
        });
        
        // 2. 獲取所有期號309的投注記錄
        const allBets = await db.any(`
            SELECT id, bet_type, bet_value, position, amount, odds, win, win_amount, settled, created_at
            FROM bet_history 
            WHERE period = 20250714309 AND username = 'justin111'
            ORDER BY id
        `);
        
        console.log(`\n📊 期號309投注統計:`);
        console.log(`總投注記錄數: ${allBets.length}`);
        console.log(`已結算投注數: ${allBets.filter(b => b.settled).length}`);
        console.log(`顯示為中獎的投注數: ${allBets.filter(b => b.win).length}`);
        console.log(`顯示為輸的投注數: ${allBets.filter(b => !b.win).length}`);
        
        // 3. 分析哪些應該中獎
        console.log('\n🎯 應該中獎的投注:');
        
        const betTypeMapping = {
            'champion': 0, '冠军': 0,
            'runnerup': 1, '亚军': 1,
            'third': 2, '第三名': 2,
            'fourth': 3, '第四名': 3,
            'fifth': 4, '第五名': 4,
            'sixth': 5, '第六名': 5,
            'seventh': 6, '第七名': 6,
            'eighth': 7, '第八名': 7,
            'ninth': 8, '第九名': 8,
            'tenth': 9, '第十名': 9
        };
        
        let shouldWinBets = [];
        const winResult = { positions };
        
        allBets.forEach(bet => {
            // 測試checkWin函數
            const isWin = checkWin(bet, winResult);
            
            if (isWin && !bet.win) {
                const positionIndex = betTypeMapping[bet.bet_type];
                const positionValue = positions[positionIndex];
                shouldWinBets.push({
                    ...bet,
                    positionIndex,
                    positionValue,
                    reason: `${bet.bet_type} ${bet.bet_value} (開出${positionValue})`
                });
                console.log(`❌ ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} 應該中獎但顯示為輸 (開出${positionValue})`);
            }
        });
        
        console.log(`\n📈 統計結果:`);
        console.log(`應該中獎但顯示為輸的投注數: ${shouldWinBets.length}`);
        console.log(`遺失的中獎金額: $${shouldWinBets.length * 198}`);
        
        // 4. 按投注類型統計
        const betStats = {};
        allBets.forEach(bet => {
            const key = `${bet.bet_type}_${bet.bet_value}`;
            if (!betStats[key]) {
                betStats[key] = { count: 0, wins: 0 };
            }
            betStats[key].count++;
            if (bet.win) betStats[key].wins++;
        });
        
        console.log('\n📋 各投注類型統計:');
        Object.entries(betStats).forEach(([key, stats]) => {
            console.log(`  ${key}: ${stats.count}筆 (中獎${stats.wins}筆)`);
        });
        
        // 5. 檢查結算日誌
        const settlementLog = await db.oneOrNone(`
            SELECT period, settled_count, total_win_amount, created_at
            FROM settlement_logs 
            WHERE period = 20250714309
            ORDER BY created_at DESC
            LIMIT 1
        `);
        
        if (settlementLog) {
            console.log('\n📋 結算日誌:');
            console.log(`  結算時間: ${settlementLog.created_at}`);
            console.log(`  結算數量: ${settlementLog.settled_count}`);
            console.log(`  總中獎金額: $${settlementLog.total_win_amount}`);
        } else {
            console.log('\n❌ 找不到結算日誌');
        }
        
        // 6. 返回需要修正的投注列表
        if (shouldWinBets.length > 0) {
            console.log('\n💡 需要修正的投注ID列表:');
            shouldWinBets.forEach(bet => {
                console.log(`  ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} → $198`);
            });
        }
        
        await db.$pool.end();
        return shouldWinBets;
    } catch (error) {
        console.error('分析過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

// 如果直接運行此檔案
if (import.meta.url === `file://${process.argv[1]}`) {
    analyzePeriod309();
}

export default analyzePeriod309;