// analyze-period-299.js - 分析期號299的投注問題
import db from './db/config.js';

async function analyzePeriod299() {
    try {
        console.log('🔍 分析期號299的投注問題...\n');
        
        // 1. 獲取期號299的開獎結果
        const result = await db.oneOrNone('SELECT period, result FROM result_history WHERE period = 20250714299');
        if (!result) {
            console.log('❌ 找不到期號299的開獎結果');
            await db.$pool.end();
            return;
        }
        
        console.log('期號299開獎結果:');
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
            const oddEven = num % 2 === 0 ? '雙' : '單';
            console.log(`  ${positionNames[index]}: ${num} (${oddEven})`);
        });
        
        // 2. 獲取所有期號299的投注記錄
        const allBets = await db.any(`
            SELECT id, bet_type, bet_value, position, amount, odds, win, win_amount, settled, created_at
            FROM bet_history 
            WHERE period = 20250714299 AND username = 'justin111'
            ORDER BY id
        `);
        
        console.log(`\n📊 期號299投注統計:`);
        console.log(`總投注記錄數: ${allBets.length}`);
        console.log(`已結算投注數: ${allBets.filter(b => b.settled).length}`);
        console.log(`未結算投注數: ${allBets.filter(b => !b.settled).length}`);
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
        
        let shouldWinCount = 0;
        let actualWinCount = 0;
        let expectedWinAmount = 0;
        
        allBets.forEach(bet => {
            const positionIndex = betTypeMapping[bet.bet_type];
            if (positionIndex !== undefined) {
                const positionValue = positions[positionIndex];
                const isEven = positionValue % 2 === 0;
                const shouldWin = (bet.bet_value === '雙' && isEven) || (bet.bet_value === '單' && !isEven);
                
                if (shouldWin) {
                    shouldWinCount++;
                    expectedWinAmount += 100 * 1.98;
                    
                    if (!bet.win) {
                        console.log(`❌ 應中獎但顯示為輸: ID ${bet.id} - ${bet.bet_type} ${bet.bet_value} (開出${positionValue})`);
                    } else {
                        actualWinCount++;
                        console.log(`✅ 正確中獎: ID ${bet.id} - ${bet.bet_type} ${bet.bet_value} (開出${positionValue})`);
                    }
                }
            }
        });
        
        console.log(`\n📈 統計結果:`);
        console.log(`應該中獎的投注數: ${shouldWinCount}`);
        console.log(`實際中獎的投注數: ${actualWinCount}`);
        console.log(`錯誤標記為輸的投注數: ${shouldWinCount - actualWinCount}`);
        console.log(`預期總中獎金額: $${expectedWinAmount}`);
        
        // 4. 檢查用戶說的缺失投注
        console.log('\n🔍 檢查可能缺失的投注:');
        
        // 檢查單雙投注的完整性
        const expectedBets = [];
        const betTypes = ['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
        const betValues = ['單', '雙'];
        
        betTypes.forEach(type => {
            betValues.forEach(value => {
                expectedBets.push(`${type}_${value}`);
            });
        });
        
        // 轉換數據庫中的投注為相同格式
        const actualBetKeys = allBets.map(bet => {
            // 標準化bet_type（處理中文）
            let normalizedType = bet.bet_type;
            Object.keys(betTypeMapping).forEach(key => {
                if (bet.bet_type === key && key.includes('军') || key.includes('名')) {
                    normalizedType = Object.keys(betTypeMapping).find(k => betTypeMapping[k] === betTypeMapping[key] && /^[a-z]+$/.test(k));
                }
            });
            return `${normalizedType}_${bet.bet_value}`;
        });
        
        const missingBets = expectedBets.filter(expected => !actualBetKeys.includes(expected));
        
        if (missingBets.length > 0) {
            console.log(`缺失的投注組合 (${missingBets.length}個):`);
            missingBets.forEach(missing => {
                console.log(`  ${missing}`);
            });
        } else {
            console.log('✅ 所有預期的投注組合都存在');
        }
        
        // 5. 檢查結算日誌
        const settlementLog = await db.oneOrNone(`
            SELECT period, settled_count, total_win_amount, created_at
            FROM settlement_logs 
            WHERE period = 20250714299
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
        
        // 6. 檢查餘額變化
        const balanceChanges = await db.manyOrNone(`
            SELECT transaction_type, amount, balance_before, balance_after, description, created_at
            FROM transaction_records 
            WHERE user_id = (SELECT id FROM members WHERE username = 'justin111')
            AND created_at >= (SELECT MIN(created_at) FROM bet_history WHERE period = 20250714299 AND username = 'justin111')
            ORDER BY created_at
            LIMIT 10
        `);
        
        console.log('\n💰 相關餘額變化:');
        balanceChanges.forEach(tx => {
            console.log(`  ${tx.created_at.toLocaleString('zh-TW')}: ${tx.transaction_type} $${tx.amount} - ${tx.description}`);
            console.log(`    餘額: $${tx.balance_before} → $${tx.balance_after}`);
        });
        
        // 7. 總結問題
        console.log('\n🚨 問題總結:');
        if (shouldWinCount > actualWinCount) {
            const missingWinAmount = (shouldWinCount - actualWinCount) * 198;
            console.log(`發現 ${shouldWinCount - actualWinCount} 筆應該中獎但被標記為輸的投注`);
            console.log(`遺失的中獎金額: $${missingWinAmount}`);
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('分析過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

analyzePeriod299();