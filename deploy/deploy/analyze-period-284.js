// analyze-period-284.js - 分析期號284的結算問題
import db from './db/config.js';

async function analyzePeriod284() {
    try {
        console.log('🔍 分析期號284的結算問題...\n');
        
        // 獲取期號284的開獎結果
        const result = await db.oneOrNone('SELECT period, result FROM result_history WHERE period = 20250714284');
        if (!result) {
            console.log('❌ 找不到期號284的開獎結果');
            await db.$pool.end();
            return;
        }
        
        console.log('期號284開獎結果:');
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
        
        // 重點檢查第十名
        const tenthPosition = positions[9];
        const tenthSize = tenthPosition >= 6 ? '大' : '小';
        const tenthOddEven = tenthPosition % 2 === 0 ? '雙' : '單';
        
        console.log(`\n🎯 第十名詳細分析:`);
        console.log(`第十名開出: ${tenthPosition}號`);
        console.log(`大小: ${tenthSize} (${tenthPosition >= 6 ? '≥6為大' : '<6為小'})`);
        console.log(`單雙: ${tenthOddEven} (${tenthPosition % 2 === 0 ? '偶數為雙' : '奇數為單'})`);
        
        // 獲取所有期號284的投注
        const bets = await db.any('SELECT * FROM bet_history WHERE period = 20250714284 ORDER BY id');
        console.log(`\n期號284投注記錄數: ${bets.length}`);
        
        console.log('\n投注詳情分析:');
        const errorBets = [];
        
        for (const bet of bets) {
            let shouldWin = false;
            let analysis = '';
            
            // 根據投注類型檢查
            if (bet.bet_type === 'tenth') {
                if (bet.bet_value === 'big') {
                    shouldWin = tenthPosition >= 6;
                    analysis = `第十名${tenthPosition}號${tenthSize}`;
                } else if (bet.bet_value === 'small') {
                    shouldWin = tenthPosition < 6;
                    analysis = `第十名${tenthPosition}號${tenthSize}`;
                } else if (bet.bet_value === 'odd') {
                    shouldWin = tenthPosition % 2 === 1;
                    analysis = `第十名${tenthPosition}號${tenthOddEven}`;
                } else if (bet.bet_value === 'even') {
                    shouldWin = tenthPosition % 2 === 0;
                    analysis = `第十名${tenthPosition}號${tenthOddEven}`;
                }
            } else {
                // 檢查其他位置
                const positionMap = {
                    'champion': 0, 'runnerup': 1, 'third': 2, 'fourth': 3, 'fifth': 4,
                    'sixth': 5, 'seventh': 6, 'eighth': 7, 'ninth': 8
                };
                
                const posIndex = positionMap[bet.bet_type];
                if (posIndex !== undefined) {
                    const posValue = positions[posIndex];
                    const posName = ['冠軍', '亞軍', '第三名', '第四名', '第五名', '第六名', '第七名', '第八名', '第九名'][posIndex];
                    
                    if (bet.bet_value === 'big') {
                        shouldWin = posValue >= 6;
                        analysis = `${posName}${posValue}號${posValue >= 6 ? '大' : '小'}`;
                    } else if (bet.bet_value === 'small') {
                        shouldWin = posValue < 6;
                        analysis = `${posName}${posValue}號${posValue >= 6 ? '大' : '小'}`;
                    } else if (bet.bet_value === 'odd') {
                        shouldWin = posValue % 2 === 1;
                        analysis = `${posName}${posValue}號${posValue % 2 === 0 ? '雙' : '單'}`;
                    } else if (bet.bet_value === 'even') {
                        shouldWin = posValue % 2 === 0;
                        analysis = `${posName}${posValue}號${posValue % 2 === 0 ? '雙' : '單'}`;
                    }
                }
            }
            
            // 檢查結算是否正確
            if (shouldWin !== bet.win) {
                console.log(`❌ ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} - ${analysis} - 應該${shouldWin ? '中獎' : '未中獎'}但實際${bet.win ? '中獎' : '未中獎'}`);
                errorBets.push({
                    id: bet.id,
                    bet_type: bet.bet_type,
                    bet_value: bet.bet_value,
                    shouldWin: shouldWin,
                    actualWin: bet.win,
                    analysis: analysis,
                    odds: bet.odds
                });
            } else {
                console.log(`✅ ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} - ${analysis} - 結算正確`);
            }
        }
        
        console.log(`\n結算錯誤總結: ${errorBets.length}個錯誤`);
        
        if (errorBets.length > 0) {
            console.log('\n需要修正的投注:');
            let totalCompensation = 0;
            
            errorBets.forEach(error => {
                const winAmount = error.shouldWin ? (100 * parseFloat(error.odds)) : 0;
                totalCompensation += winAmount;
                console.log(`ID ${error.id}: ${error.bet_type} ${error.bet_value}`);
                console.log(`  ${error.analysis}`);
                console.log(`  應該${error.shouldWin ? '中獎' : '未中獎'}, 實際${error.actualWin ? '中獎' : '未中獎'}`);
                if (error.shouldWin) {
                    console.log(`  應獲獎金: $${winAmount}`);
                }
                console.log('');
            });
            
            console.log(`💰 總應補償金額: $${totalCompensation}`);
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('錯誤:', error);
        await db.$pool.end();
    }
}

analyzePeriod284();