// 測試所有投注類型 - 簡化版
import db from './db/config.js';
import drawSystemManager from './fixed-draw-system.js';

console.log('🎰 開始測試所有投注類型\n');

async function testAllBetTypes() {
    try {
        // 1. 獲取下一期號
        const nextPeriod = await db.one(`
            SELECT COALESCE(MAX(period::bigint), 20250717000) + 1 as next_period 
            FROM result_history
        `);
        const testPeriod = nextPeriod.next_period.toString();
        console.log(`📌 測試期號: ${testPeriod}`);
        
        // 清除該期舊數據
        await db.none(`DELETE FROM bet_history WHERE period = $1`, [testPeriod]);
        
        // 2. 準備所有投注類型
        console.log('\n📌 準備各種投注類型...');
        
        // 2.1 號碼投注
        console.log('\n🎯 號碼投注:');
        const numberBets = [
            { position: '1', betValue: '5', amount: 1, odds: 9.89 },
            { position: '5', betValue: '8', amount: 1, odds: 9.89 },
            { position: '10', betValue: '3', amount: 1, odds: 9.89 }
        ];
        
        for (const bet of numberBets) {
            await placeBet({
                betType: 'number',
                betValue: bet.betValue,
                position: bet.position,
                amount: bet.amount,
                odds: bet.odds
            }, testPeriod);
            console.log(`  - 第${bet.position}名 號碼${bet.betValue}`);
        }
        
        // 2.2 兩面投注（大小單雙）
        console.log('\n🎲 兩面投注:');
        const twoSidesBets = [
            { betType: '冠軍', betValue: '大', amount: 1, odds: 1.985 },
            { betType: '亞軍', betValue: '小', amount: 1, odds: 1.985 },
            { betType: '季軍', betValue: '單', amount: 1, odds: 1.985 },
            { betType: '第四名', betValue: '雙', amount: 1, odds: 1.985 },
            { betType: '第五名', betValue: '大', amount: 1, odds: 1.985 },
            { betType: '第六名', betValue: '小', amount: 1, odds: 1.985 },
            { betType: '第七名', betValue: '單', amount: 1, odds: 1.985 },
            { betType: '第八名', betValue: '雙', amount: 1, odds: 1.985 }
        ];
        
        for (const bet of twoSidesBets) {
            await placeBet(bet, testPeriod);
            console.log(`  - ${bet.betType} ${bet.betValue}`);
        }
        
        // 2.3 龍虎投注
        console.log('\n🐉🐅 龍虎投注:');
        const dragonTigerBets = [
            { betType: 'dragon_tiger', betValue: '1_10_dragon', amount: 1, odds: 1.985 },
            { betType: 'dragon_tiger', betValue: '2_9_tiger', amount: 1, odds: 1.985 },
            { betType: 'dragon_tiger', betValue: '3_8_dragon', amount: 1, odds: 1.985 },
            { betType: 'dragon_tiger', betValue: '4_7_tiger', amount: 1, odds: 1.985 },
            { betType: 'dragon_tiger', betValue: '5_6_dragon', amount: 1, odds: 1.985 }
        ];
        
        for (const bet of dragonTigerBets) {
            await placeBet(bet, testPeriod);
            const parts = bet.betValue.split('_');
            console.log(`  - 第${parts[0]}名 vs 第${parts[1]}名 押${parts[2] === 'dragon' ? '龍' : '虎'}`);
        }
        
        // 2.4 冠亞和投注
        console.log('\n➕ 冠亞和投注:');
        const sumBets = [
            { betType: 'sum', betValue: '11', amount: 1, odds: 5.37 },  // 和值11
            { betType: 'sum', betValue: '12', amount: 1, odds: 6.14 },  // 和值12
            { betType: 'sum', betValue: '大', amount: 1, odds: 1.985 }, // 和值大 (12-19)
            { betType: 'sum', betValue: '小', amount: 1, odds: 1.985 }, // 和值小 (3-11)
            { betType: 'sum', betValue: '單', amount: 1, odds: 1.985 }, // 和值單
            { betType: 'sum', betValue: '雙', amount: 1, odds: 1.985 }  // 和值雙
        ];
        
        for (const bet of sumBets) {
            await placeBet(bet, testPeriod);
            if (/^\d+$/.test(bet.betValue)) {
                console.log(`  - 冠亞和值 ${bet.betValue}`);
            } else {
                console.log(`  - 冠亞和 ${bet.betValue}`);
            }
        }
        
        // 2.5 多碼投注（例如冠軍1-8名）
        console.log('\n🎪 多碼特殊投注:');
        // 模擬冠軍 1-8 名（下注冠軍位置的號碼1-8）
        const multiCodeBets = [];
        for (let i = 1; i <= 8; i++) {
            multiCodeBets.push({
                betType: 'number',
                betValue: i.toString(),
                position: '1', // 冠軍位置
                amount: 0.5,
                odds: 9.89
            });
        }
        
        console.log('  - 冠軍 1-8 名（下注冠軍位置號碼1到8）:');
        for (const bet of multiCodeBets) {
            await placeBet(bet, testPeriod);
        }
        console.log(`    共 ${multiCodeBets.length} 注，每注 $0.50`);
        
        // 總計
        const totalBets = numberBets.length + twoSidesBets.length + dragonTigerBets.length + sumBets.length + multiCodeBets.length;
        console.log(`\n📊 總計投注 ${totalBets} 筆`);
        
        // 3. 執行開獎
        console.log('\n📌 執行開獎...');
        const drawResult = await drawSystemManager.executeDrawing(testPeriod);
        
        if (drawResult.success) {
            console.log('\n✅ 開獎成功!');
            console.log(`開獎結果: ${drawResult.result.join(', ')}`);
            
            // 4. 分析結果
            console.log('\n📌 分析中獎結果...');
            const positions = drawResult.result;
            
            // 分析號碼投注
            console.log('\n🎯 號碼投注結果:');
            for (const bet of numberBets) {
                const pos = parseInt(bet.position);
                const actualNumber = positions[pos - 1];
                const isWin = parseInt(bet.betValue) === actualNumber;
                console.log(`  - 第${pos}名: 投注${bet.betValue}, 開出${actualNumber} ${isWin ? '✅ 中獎' : '❌ 未中'}`);
            }
            
            // 分析兩面投注
            console.log('\n🎲 兩面投注結果:');
            const positionMap = {
                '冠軍': 1, '亞軍': 2, '季軍': 3, '第四名': 4,
                '第五名': 5, '第六名': 6, '第七名': 7, '第八名': 8
            };
            
            for (const bet of twoSidesBets) {
                const pos = positionMap[bet.betType];
                const number = positions[pos - 1];
                let isWin = false;
                
                switch (bet.betValue) {
                    case '大': isWin = number >= 6; break;
                    case '小': isWin = number <= 5; break;
                    case '單': isWin = number % 2 === 1; break;
                    case '雙': isWin = number % 2 === 0; break;
                }
                
                console.log(`  - ${bet.betType}(${number}) ${bet.betValue}: ${isWin ? '✅ 中獎' : '❌ 未中'}`);
            }
            
            // 分析龍虎投注
            console.log('\n🐉🐅 龍虎投注結果:');
            for (const bet of dragonTigerBets) {
                const parts = bet.betValue.split('_');
                const pos1 = parseInt(parts[0]);
                const pos2 = parseInt(parts[1]);
                const betSide = parts[2];
                
                const num1 = positions[pos1 - 1];
                const num2 = positions[pos2 - 1];
                const actualWinner = num1 > num2 ? 'dragon' : 'tiger';
                const isWin = betSide === actualWinner;
                
                console.log(`  - 第${pos1}名(${num1}) vs 第${pos2}名(${num2}): ${actualWinner === 'dragon' ? '龍' : '虎'}贏, 投注${betSide === 'dragon' ? '龍' : '虎'} ${isWin ? '✅ 中獎' : '❌ 未中'}`);
            }
            
            // 分析冠亞和投注
            console.log('\n➕ 冠亞和投注結果:');
            const sum = positions[0] + positions[1];
            console.log(`  冠軍(${positions[0]}) + 亞軍(${positions[1]}) = ${sum}`);
            
            for (const bet of sumBets) {
                let isWin = false;
                
                if (/^\d+$/.test(bet.betValue)) {
                    isWin = sum === parseInt(bet.betValue);
                    console.log(`  - 和值${bet.betValue}: ${isWin ? '✅ 中獎' : '❌ 未中'}`);
                } else {
                    switch (bet.betValue) {
                        case '大': isWin = sum >= 12; break;
                        case '小': isWin = sum <= 11; break;
                        case '單': isWin = sum % 2 === 1; break;
                        case '雙': isWin = sum % 2 === 0; break;
                    }
                    console.log(`  - 和值${bet.betValue}: ${isWin ? '✅ 中獎' : '❌ 未中'}`);
                }
            }
            
            // 分析多碼投注
            console.log('\n🎪 多碼投注結果:');
            const champion = positions[0];
            const multiWins = multiCodeBets.filter(bet => parseInt(bet.betValue) === champion);
            console.log(`  - 冠軍 1-8 名: 冠軍開出 ${champion}`);
            if (multiWins.length > 0) {
                console.log(`    ✅ 中獎! 共 ${multiWins.length} 注中獎`);
            } else {
                console.log(`    ❌ 未中獎 (冠軍${champion > 8 ? '是9或10' : '是' + champion})`);
            }
            
            // 5. 查看結算統計
            console.log('\n📌 查看結算統計...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const settlementStats = await db.one(`
                SELECT 
                    COUNT(*) as total_bets,
                    SUM(CASE WHEN win = true THEN 1 ELSE 0 END) as win_count,
                    SUM(amount) as total_amount,
                    SUM(win_amount) as total_win_amount
                FROM bet_history
                WHERE period = $1 AND username = 'justin111'
            `, [testPeriod]);
            
            console.log('\n📊 結算統計:');
            console.log(`- 總投注數: ${settlementStats.total_bets}`);
            console.log(`- 中獎數: ${settlementStats.win_count}`);
            console.log(`- 總投注金額: $${parseFloat(settlementStats.total_amount || 0).toFixed(2)}`);
            console.log(`- 總獎金: $${parseFloat(settlementStats.total_win_amount || 0).toFixed(2)}`);
            console.log(`- 淑盈虧: $${(parseFloat(settlementStats.total_win_amount || 0) - parseFloat(settlementStats.total_amount || 0)).toFixed(2)}`);
            
        } else {
            console.log('❌ 開獎失敗:', drawResult.error);
        }
        
    } catch (error) {
        console.error('\n❌ 測試失敗:', error);
        console.error(error.stack);
    }
}

// 下注輔助函數
async function placeBet(betData, period) {
    try {
        await db.none(`
            INSERT INTO bet_history 
            (username, period, bet_type, bet_value, position, amount, odds, settled, created_at)
            VALUES ('justin111', $1, $2, $3, $4, $5, $6, false, NOW())
        `, [
            period,
            betData.betType,
            betData.betValue,
            betData.position || null,
            betData.amount,
            betData.odds
        ]);
    } catch (error) {
        console.error(`下注失敗: ${error.message}`);
    }
}

// 執行測試
testAllBetTypes().then(() => {
    console.log('\n🎯 測試完成');
    process.exit(0);
}).catch(error => {
    console.error('錯誤:', error);
    process.exit(1);
});