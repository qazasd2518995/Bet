// check-settlement-issues.js - 檢查號碼、位置、龍虎結算問題
import db from './db/config.js';
import { checkBetWinEnhanced } from './enhanced-settlement-system.js';

async function checkSettlementIssues() {
    console.log('檢查結算問題...\n');
    
    // 測試期號
    const testPeriods = [
        '20250718477', // 冠軍雙
        '20250718478', // 第1名號碼4
        '20250718479'  // 龍虎(第3名vs第8名)
    ];
    
    for (const period of testPeriods) {
        console.log(`\n========== 期號 ${period} ==========`);
        
        try {
            // 1. 查詢開獎結果
            const drawResult = await db.oneOrNone(`
                SELECT * FROM result_history WHERE period = $1
            `, [period]);
            
            if (!drawResult) {
                console.log('找不到開獎結果');
                continue;
            }
            
            console.log('\n開獎結果：');
            for (let i = 1; i <= 10; i++) {
                console.log(`  第${i}名: ${drawResult[`position_${i}`]}號`);
            }
            
            // 2. 查詢該期所有投注
            const bets = await db.manyOrNone(`
                SELECT * FROM bet_history 
                WHERE period = $1
                ORDER BY id
            `, [period]);
            
            console.log(`\n找到 ${bets.length} 筆投注`);
            
            // 3. 檢查每筆投注的結算
            for (const bet of bets) {
                console.log(`\n投注 ID ${bet.id}:`);
                console.log(`  用戶: ${bet.username}`);
                console.log(`  類型: ${bet.bet_type}`);
                console.log(`  值: ${bet.bet_value}`);
                console.log(`  位置: ${bet.position || 'N/A'}`);
                console.log(`  金額: $${bet.amount}`);
                console.log(`  賠率: ${bet.odds}`);
                console.log(`  系統結算: ${bet.win ? '✓贏' : '✗輸'}, 派彩$${bet.win_amount || 0}`);
                
                // 使用結算系統重新檢查
                const positions = [];
                for (let i = 1; i <= 10; i++) {
                    positions.push(drawResult[`position_${i}`]);
                }
                
                const winCheck = await checkBetWinEnhanced(bet, { positions });
                console.log(`  重新檢查: ${winCheck.isWin ? '✓應該贏' : '✗應該輸'}`);
                console.log(`  原因: ${winCheck.reason}`);
                
                if (winCheck.isWin && bet.win) {
                    const expectedWinAmount = parseFloat(bet.amount) * parseFloat(bet.odds);
                    console.log(`  預期派彩: $${expectedWinAmount.toFixed(2)}`);
                    if (Math.abs(parseFloat(bet.win_amount) - expectedWinAmount) > 0.01) {
                        console.log(`  ⚠️ 派彩金額錯誤！`);
                    }
                } else if (bet.win !== winCheck.isWin) {
                    console.log(`  ⚠️ 結算結果錯誤！`);
                }
                
                // 特別檢查問題類型
                if (bet.bet_type === 'dragonTiger' || bet.bet_type === '龍虎') {
                    console.log(`  🐉 龍虎投注詳情:`);
                    console.log(`    投注值: ${bet.bet_value}`);
                    
                    // 解析龍虎投注
                    if (bet.bet_value.includes('vs')) {
                        const parts = bet.bet_value.split('vs');
                        const pos1 = parseInt(parts[0]);
                        const pos2 = parseInt(parts[1]);
                        console.log(`    對戰: 第${pos1}名(${positions[pos1-1]}) vs 第${pos2}名(${positions[pos2-1]})`);
                        console.log(`    結果: ${positions[pos1-1] > positions[pos2-1] ? '龍贏' : '虎贏'}`);
                    }
                } else if (bet.bet_type.includes('第') && bet.bet_type.includes('名')) {
                    console.log(`  📍 位置號碼投注詳情:`);
                    const posMatch = bet.bet_type.match(/第(\d+)名/);
                    if (posMatch) {
                        const pos = parseInt(posMatch[1]);
                        console.log(`    位置: 第${pos}名`);
                        console.log(`    開獎號碼: ${positions[pos-1]}`);
                        console.log(`    投注號碼: ${bet.bet_value}`);
                    }
                }
            }
            
        } catch (error) {
            console.error(`處理期號 ${period} 時出錯:`, error);
        }
    }
    
    // 4. 檢查結算邏輯
    console.log('\n\n========== 結算邏輯檢查 ==========');
    
    // 測試號碼投注
    console.log('\n1. 測試號碼投注結算:');
    const testNumberBet = {
        bet_type: 'champion',
        bet_value: '4',
        position: null
    };
    const testPositions = [4, 2, 3, 1, 5, 6, 7, 8, 9, 10];
    const numberResult = await checkBetWinEnhanced(testNumberBet, { positions: testPositions });
    console.log(`  冠軍4號: ${numberResult.isWin ? '✓中獎' : '✗未中'} - ${numberResult.reason}`);
    
    // 測試龍虎投注
    console.log('\n2. 測試龍虎投注結算:');
    const testDragonBet = {
        bet_type: 'dragonTiger',
        bet_value: '3_8_dragon'
    };
    const dragonResult = await checkBetWinEnhanced(testDragonBet, { positions: testPositions });
    console.log(`  第3名vs第8名(龍): ${dragonResult.isWin ? '✓中獎' : '✗未中'} - ${dragonResult.reason}`);
    
    process.exit();
}

checkSettlementIssues();