// analyze-settlement-errors-268.js - 詳細分析期號268的結算錯誤
import db from './db/config.js';

async function analyzeSettlementErrors() {
    try {
        // 獲取期號268的開獎結果
        const result = await db.one('SELECT result FROM result_history WHERE period = 20250714268');
        const positions = result.result;
        
        console.log('期號268開獎結果:', positions);
        console.log('各位置數值:');
        positions.forEach((num, index) => {
            const posName = ['冠軍', '亞軍', '第三名', '第四名', '第五名', '第六名', '第七名', '第八名', '第九名', '第十名'][index];
            const size = num >= 6 ? '大' : '小';
            const oddEven = num % 2 === 0 ? '雙' : '單';
            console.log(`  ${posName}: ${num} (${size}, ${oddEven})`);
        });
        
        // 計算冠亞和
        const sum = positions[0] + positions[1];
        const sumSize = sum >= 12 ? '大' : '小';
        const sumOddEven = sum % 2 === 0 ? '雙' : '單';
        console.log(`冠亞和: ${positions[0]} + ${positions[1]} = ${sum} (${sumSize}, ${sumOddEven})`);
        
        // 獲取所有投注
        const bets = await db.any('SELECT * FROM bet_history WHERE period = 20250714268 ORDER BY id');
        
        console.log('\n詳細錯誤分析:');
        const errors = [];
        
        for (const bet of bets) {
            let shouldWin = false;
            let analysis = '';
            let error = null;
            
            // 根據bet_type和bet_value判斷是否應該中獎
            if (bet.bet_type === 'champion' && bet.bet_value === 'big') {
                shouldWin = positions[0] >= 6;
                analysis = `冠軍${positions[0]}號${positions[0] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'champion' && bet.bet_value === 'even') {
                shouldWin = positions[0] % 2 === 0;
                analysis = `冠軍${positions[0]}號${positions[0] % 2 === 0 ? '雙' : '單'}`;
            } else if (bet.bet_type === 'runnerup' && bet.bet_value === 'big') {
                shouldWin = positions[1] >= 6;
                analysis = `亞軍${positions[1]}號${positions[1] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'runnerup' && bet.bet_value === 'even') {
                shouldWin = positions[1] % 2 === 0;
                analysis = `亞軍${positions[1]}號${positions[1] % 2 === 0 ? '雙' : '單'}`;
            } else if (bet.bet_type === 'third' && bet.bet_value === 'big') {
                shouldWin = positions[2] >= 6;
                analysis = `第三名${positions[2]}號${positions[2] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'third' && bet.bet_value === 'even') {
                shouldWin = positions[2] % 2 === 0;
                analysis = `第三名${positions[2]}號${positions[2] % 2 === 0 ? '雙' : '單'}`;
            } else if (bet.bet_type === 'fourth' && bet.bet_value === 'big') {
                shouldWin = positions[3] >= 6;
                analysis = `第四名${positions[3]}號${positions[3] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'fourth' && bet.bet_value === 'even') {
                shouldWin = positions[3] % 2 === 0;
                analysis = `第四名${positions[3]}號${positions[3] % 2 === 0 ? '雙' : '單'}`;
            } else if (bet.bet_type === 'fifth' && bet.bet_value === 'big') {
                shouldWin = positions[4] >= 6;
                analysis = `第五名${positions[4]}號${positions[4] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'fifth' && bet.bet_value === 'even') {
                shouldWin = positions[4] % 2 === 0;
                analysis = `第五名${positions[4]}號${positions[4] % 2 === 0 ? '雙' : '單'}`;
            } else if (bet.bet_type === 'sixth' && bet.bet_value === 'big') {
                shouldWin = positions[5] >= 6;
                analysis = `第六名${positions[5]}號${positions[5] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'sixth' && bet.bet_value === 'even') {
                shouldWin = positions[5] % 2 === 0;
                analysis = `第六名${positions[5]}號${positions[5] % 2 === 0 ? '雙' : '單'}`;
            } else if (bet.bet_type === 'seventh' && bet.bet_value === 'big') {
                shouldWin = positions[6] >= 6;
                analysis = `第七名${positions[6]}號${positions[6] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'seventh' && bet.bet_value === 'even') {
                shouldWin = positions[6] % 2 === 0;
                analysis = `第七名${positions[6]}號${positions[6] % 2 === 0 ? '雙' : '單'}`;
            } else if (bet.bet_type === 'eighth' && bet.bet_value === 'big') {
                shouldWin = positions[7] >= 6;
                analysis = `第八名${positions[7]}號${positions[7] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'eighth' && bet.bet_value === 'even') {
                shouldWin = positions[7] % 2 === 0;
                analysis = `第八名${positions[7]}號${positions[7] % 2 === 0 ? '雙' : '單'}`;
            } else if (bet.bet_type === 'ninth' && bet.bet_value === 'big') {
                shouldWin = positions[8] >= 6;
                analysis = `第九名${positions[8]}號${positions[8] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'ninth' && bet.bet_value === 'even') {
                shouldWin = positions[8] % 2 === 0;
                analysis = `第九名${positions[8]}號${positions[8] % 2 === 0 ? '雙' : '單'}`;
            } else if (bet.bet_type === 'tenth' && bet.bet_value === 'big') {
                shouldWin = positions[9] >= 6;
                analysis = `第十名${positions[9]}號${positions[9] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'tenth' && bet.bet_value === 'even') {
                shouldWin = positions[9] % 2 === 0;
                analysis = `第十名${positions[9]}號${positions[9] % 2 === 0 ? '雙' : '單'}`;
            } else if (bet.bet_type === 'sumValue' && bet.bet_value === 'small') {
                shouldWin = sum < 12;
                analysis = `冠亞和${sum}${sum < 12 ? '小' : '大'}`;
            } else if (bet.bet_type === 'sumValue' && bet.bet_value === 'even') {
                shouldWin = sum % 2 === 0;
                analysis = `冠亞和${sum}${sum % 2 === 0 ? '雙' : '單'}`;
            } else if (bet.bet_type === 'sumValue' && /^\d+$/.test(bet.bet_value)) {
                shouldWin = sum === parseInt(bet.bet_value);
                analysis = `冠亞和值${bet.bet_value}, 實際${sum}`;
            } else if (bet.bet_type === 'dragonTiger') {
                // 解析龍虎投注
                if (bet.bet_value === 'dragon_1_10') {
                    shouldWin = positions[0] > positions[9]; // 冠軍 vs 第十名
                    analysis = `冠軍${positions[0]} vs 第十名${positions[9]} = ${positions[0] > positions[9] ? '龍' : '虎'}`;
                } else if (bet.bet_value === 'dragon_3_8') {
                    shouldWin = positions[2] > positions[7]; // 第三名 vs 第八名
                    analysis = `第三名${positions[2]} vs 第八名${positions[7]} = ${positions[2] > positions[7] ? '龍' : '虎'}`;
                } else if (bet.bet_value === 'dragon_5_6') {
                    shouldWin = positions[4] > positions[5]; // 第五名 vs 第六名
                    analysis = `第五名${positions[4]} vs 第六名${positions[5]} = ${positions[4] > positions[5] ? '龍' : '虎'}`;
                } else if (bet.bet_value === 'tiger_2_9') {
                    shouldWin = positions[1] < positions[8]; // 亞軍 vs 第九名，投注虎
                    analysis = `亞軍${positions[1]} vs 第九名${positions[8]} = ${positions[1] < positions[8] ? '虎' : '龍'}`;
                } else if (bet.bet_value === 'tiger_4_7') {
                    shouldWin = positions[3] < positions[6]; // 第四名 vs 第七名，投注虎
                    analysis = `第四名${positions[3]} vs 第七名${positions[6]} = ${positions[3] < positions[6] ? '虎' : '龍'}`;
                }
            }
            
            // 檢查是否有結算錯誤
            if (shouldWin !== bet.win) {
                error = `❌ 結算錯誤! 應該${shouldWin ? '中獎' : '未中獎'}但實際${bet.win ? '中獎' : '未中獎'}`;
                errors.push({
                    id: bet.id,
                    bet_type: bet.bet_type,
                    bet_value: bet.bet_value,
                    shouldWin: shouldWin,
                    actualWin: bet.win,
                    analysis: analysis,
                    odds: bet.odds
                });
            }
            
            console.log(`ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} - ${analysis} - ${error || '✅ 正確'}`);
        }
        
        console.log(`\n結算錯誤總結: ${errors.length}個錯誤`);
        
        if (errors.length > 0) {
            console.log('\n需要修正的投注:');
            let totalWinAmount = 0;
            
            errors.forEach(error => {
                const winAmount = error.shouldWin ? (100 * parseFloat(error.odds)) : 0;
                totalWinAmount += winAmount;
                console.log(`ID ${error.id}: ${error.bet_type} ${error.bet_value}`);
                console.log(`  ${error.analysis}`);
                console.log(`  應該${error.shouldWin ? '中獎' : '未中獎'}, 實際${error.actualWin ? '中獎' : '未中獎'}`);
                if (error.shouldWin) {
                    console.log(`  應獲獎金: $${winAmount}`);
                }
                console.log('');
            });
            
            console.log(`總應補償金額: $${totalWinAmount}`);
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('錯誤:', error);
        await db.$pool.end();
    }
}

analyzeSettlementErrors();