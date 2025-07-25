// check-settlement-issues.js - 检查号码、位置、龙虎结算问题
import db from './db/config.js';
import { checkBetWinEnhanced } from './enhanced-settlement-system.js';

async function checkSettlementIssues() {
    console.log('检查结算问题...\n');
    
    // 测试期号
    const testPeriods = [
        '20250718477', // 冠军双
        '20250718478', // 第1名号码4
        '20250718479'  // 龙虎(第3名vs第8名)
    ];
    
    for (const period of testPeriods) {
        console.log(`\n========== 期号 ${period} ==========`);
        
        try {
            // 1. 查询开奖结果
            const drawResult = await db.oneOrNone(`
                SELECT * FROM result_history WHERE period = $1
            `, [period]);
            
            if (!drawResult) {
                console.log('找不到开奖结果');
                continue;
            }
            
            console.log('\n开奖结果：');
            for (let i = 1; i <= 10; i++) {
                console.log(`  第${i}名: ${drawResult[`position_${i}`]}号`);
            }
            
            // 2. 查询该期所有投注
            const bets = await db.manyOrNone(`
                SELECT * FROM bet_history 
                WHERE period = $1
                ORDER BY id
            `, [period]);
            
            console.log(`\n找到 ${bets.length} 笔投注`);
            
            // 3. 检查每笔投注的结算
            for (const bet of bets) {
                console.log(`\n投注 ID ${bet.id}:`);
                console.log(`  用户: ${bet.username}`);
                console.log(`  类型: ${bet.bet_type}`);
                console.log(`  值: ${bet.bet_value}`);
                console.log(`  位置: ${bet.position || 'N/A'}`);
                console.log(`  金额: $${bet.amount}`);
                console.log(`  赔率: ${bet.odds}`);
                console.log(`  系统结算: ${bet.win ? '✓赢' : '✗输'}, 派彩$${bet.win_amount || 0}`);
                
                // 使用结算系统重新检查
                const positions = [];
                for (let i = 1; i <= 10; i++) {
                    positions.push(drawResult[`position_${i}`]);
                }
                
                const winCheck = await checkBetWinEnhanced(bet, { positions });
                console.log(`  重新检查: ${winCheck.isWin ? '✓应该赢' : '✗应该输'}`);
                console.log(`  原因: ${winCheck.reason}`);
                
                if (winCheck.isWin && bet.win) {
                    const expectedWinAmount = parseFloat(bet.amount) * parseFloat(bet.odds);
                    console.log(`  预期派彩: $${expectedWinAmount.toFixed(2)}`);
                    if (Math.abs(parseFloat(bet.win_amount) - expectedWinAmount) > 0.01) {
                        console.log(`  ⚠️ 派彩金额错误！`);
                    }
                } else if (bet.win !== winCheck.isWin) {
                    console.log(`  ⚠️ 结算结果错误！`);
                }
                
                // 特别检查问题类型
                if (bet.bet_type === 'dragonTiger' || bet.bet_type === '龙虎') {
                    console.log(`  🐉 龙虎投注详情:`);
                    console.log(`    投注值: ${bet.bet_value}`);
                    
                    // 解析龙虎投注
                    if (bet.bet_value.includes('vs')) {
                        const parts = bet.bet_value.split('vs');
                        const pos1 = parseInt(parts[0]);
                        const pos2 = parseInt(parts[1]);
                        console.log(`    对战: 第${pos1}名(${positions[pos1-1]}) vs 第${pos2}名(${positions[pos2-1]})`);
                        console.log(`    结果: ${positions[pos1-1] > positions[pos2-1] ? '龙赢' : '虎赢'}`);
                    }
                } else if (bet.bet_type.includes('第') && bet.bet_type.includes('名')) {
                    console.log(`  📍 位置号码投注详情:`);
                    const posMatch = bet.bet_type.match(/第(\d+)名/);
                    if (posMatch) {
                        const pos = parseInt(posMatch[1]);
                        console.log(`    位置: 第${pos}名`);
                        console.log(`    开奖号码: ${positions[pos-1]}`);
                        console.log(`    投注号码: ${bet.bet_value}`);
                    }
                }
            }
            
        } catch (error) {
            console.error(`处理期号 ${period} 时出错:`, error);
        }
    }
    
    // 4. 检查结算逻辑
    console.log('\n\n========== 结算逻辑检查 ==========');
    
    // 测试号码投注
    console.log('\n1. 测试号码投注结算:');
    const testNumberBet = {
        bet_type: 'champion',
        bet_value: '4',
        position: null
    };
    const testPositions = [4, 2, 3, 1, 5, 6, 7, 8, 9, 10];
    const numberResult = await checkBetWinEnhanced(testNumberBet, { positions: testPositions });
    console.log(`  冠军4号: ${numberResult.isWin ? '✓中奖' : '✗未中'} - ${numberResult.reason}`);
    
    // 测试龙虎投注
    console.log('\n2. 测试龙虎投注结算:');
    const testDragonBet = {
        bet_type: 'dragonTiger',
        bet_value: '3_8_dragon'
    };
    const dragonResult = await checkBetWinEnhanced(testDragonBet, { positions: testPositions });
    console.log(`  第3名vs第8名(龙): ${dragonResult.isWin ? '✓中奖' : '✗未中'} - ${dragonResult.reason}`);
    
    process.exit();
}

checkSettlementIssues();