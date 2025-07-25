// analyze-period-268.js - 分析期號268的結算問題
import db from './db/config.js';

async function analyzePeriod268() {
    try {
        // 獲取期號268的開獎結果
        const result = await db.oneOrNone('SELECT period, result FROM result_history WHERE period = 20250714268');
        if (!result) {
            console.log('找不到期號268的開獎結果');
            await db.$pool.end();
            return;
        }
        
        console.log('期號268開獎結果:');
        console.log('原始結果:', result.result);
        
        let positions = [];
        if (Array.isArray(result.result)) {
            positions = result.result;
        } else if (typeof result.result === 'string') {
            positions = result.result.split(',').map(n => parseInt(n.trim()));
        }
        
        console.log('解析後位置:', positions);
        console.log('冠軍(1st):', positions[0]);
        console.log('亞軍(2nd):', positions[1]);
        console.log('第三名:', positions[2]);
        console.log('第四名:', positions[3]);
        console.log('第五名:', positions[4]);
        console.log('第六名:', positions[5]);
        console.log('第七名:', positions[6]);
        console.log('第八名:', positions[7]);
        console.log('第九名:', positions[8]);
        console.log('第十名:', positions[9]);
        
        // 計算冠亞和
        const sum = positions[0] + positions[1];
        console.log('\n冠亞和計算:');
        console.log('冠軍 + 亞軍 =', positions[0], '+', positions[1], '=', sum);
        console.log('冠亞和大小:', sum >= 12 ? '大' : '小');
        console.log('冠亞和單雙:', sum % 2 === 0 ? '雙' : '單');
        
        // 獲取所有期號268的投注
        const bets = await db.any('SELECT * FROM bet_history WHERE period = 20250714268 ORDER BY id');
        console.log('\n期號268投注記錄數:', bets.length);
        
        console.log('\n投注詳情分析:');
        const errorBets = [];
        
        for (const bet of bets) {
            console.log(`\nID ${bet.id}: ${bet.bet_type} - ${bet.bet_value} (位置${bet.position || 'N/A'}) - ${bet.win ? '中獎' : '未中獎'}`);
            
            // 檢查每種投注類型的正確性
            let shouldWin = false;
            let analysis = '';
            
            if (bet.bet_type === 'sumValue') {
                // 冠亞和數值
                shouldWin = sum === parseInt(bet.bet_value);
                analysis = `和值${bet.bet_value}, 實際${sum}`;
            } else if (bet.bet_type === 'sumOddEven') {
                // 冠亞和單雙
                const actualOddEven = sum % 2 === 0 ? '雙' : '單';
                shouldWin = bet.bet_value === actualOddEven;
                analysis = `投注${bet.bet_value}, 實際${actualOddEven}`;
            } else if (bet.bet_type === 'sumSize') {
                // 冠亞和大小
                const actualSize = sum >= 12 ? '大' : '小';
                shouldWin = bet.bet_value === actualSize;
                analysis = `投注${bet.bet_value}, 實際${actualSize}`;
            } else if (bet.bet_type === 'oddEven' && bet.position) {
                // 位置單雙
                const positionValue = positions[bet.position - 1];
                const actualOddEven = positionValue % 2 === 0 ? '雙' : '單';
                shouldWin = bet.bet_value === actualOddEven;
                analysis = `第${bet.position}名投注${bet.bet_value}, 實際${positionValue}=${actualOddEven}`;
            } else if (bet.bet_type === 'size' && bet.position) {
                // 位置大小
                const positionValue = positions[bet.position - 1];
                const actualSize = positionValue >= 6 ? '大' : '小';
                shouldWin = bet.bet_value === actualSize;
                analysis = `第${bet.position}名投注${bet.bet_value}, 實際${positionValue}=${actualSize}`;
            } else if (bet.bet_type === 'dragonTiger') {
                // 龍虎 - 需要解析bet_value中的位置信息
                const parts = bet.bet_value.match(/([龍虎])\((.+)vs(.+)\)/);
                if (parts) {
                    const dragonTiger = parts[1];
                    const pos1Name = parts[2];
                    const pos2Name = parts[3];
                    
                    // 位置名稱對應
                    const posMap = {
                        '冠军': 0, '亚军': 1, '第3名': 2, '第4名': 3, '第5名': 4,
                        '第6名': 5, '第7名': 6, '第8名': 7, '第9名': 8, '第十名': 9
                    };
                    const pos1 = posMap[pos1Name];
                    const pos2 = posMap[pos2Name];
                    
                    if (pos1 !== undefined && pos2 !== undefined) {
                        const val1 = positions[pos1];
                        const val2 = positions[pos2];
                        const actualResult = val1 > val2 ? '龍' : (val1 < val2 ? '虎' : '和');
                        shouldWin = dragonTiger === actualResult && actualResult !== '和'; // 和局通常不算贏
                        analysis = `投注${dragonTiger}, ${pos1Name}${val1}vs${pos2Name}${val2}=${actualResult}`;
                    }
                }
            }
            
            console.log(`  應該: ${shouldWin ? '中獎' : '未中獎'} (${analysis})`);
            
            // 標記結算錯誤
            if (shouldWin !== bet.win) {
                console.log(`  ❌ 結算錯誤! 應該${shouldWin ? '中獎' : '未中獎'}但實際${bet.win ? '中獎' : '未中獎'}`);
                errorBets.push({
                    id: bet.id,
                    bet_type: bet.bet_type,
                    bet_value: bet.bet_value,
                    position: bet.position,
                    shouldWin: shouldWin,
                    actualWin: bet.win,
                    analysis: analysis
                });
            } else {
                console.log(`  ✅ 結算正確`);
            }
        }
        
        console.log(`\n結算錯誤總結: ${errorBets.length}個投注結算錯誤`);
        if (errorBets.length > 0) {
            console.log('\n需要修正的投注:');
            errorBets.forEach(bet => {
                console.log(`ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} - ${bet.analysis}`);
                console.log(`  應該${bet.shouldWin ? '中獎' : '未中獎'}, 實際${bet.actualWin ? '中獎' : '未中獎'}`);
            });
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('錯誤:', error);
        await db.$pool.end();
    }
}

analyzePeriod268();