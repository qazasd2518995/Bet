// check-period-219.js - 检查期号219的结算问题
import db from './db/config.js';

async function checkPeriod219() {
    console.log('🔍 检查期号 20250714219 的结算问题...\n');
    
    try {
        // 1. 查询期号 20250714219 的开奖结果
        const result = await db.oneOrNone(`
            SELECT period, result, created_at
            FROM result_history
            WHERE period = 20250714219
        `);
        
        if (!result) {
            console.log('找不到期号 20250714219 的开奖结果');
            return;
        }
        
        console.log(`期号: ${result.period}`);
        console.log(`开奖时间: ${result.created_at}`);
        console.log(`原始结果数据: ${result.result}`);
        
        // 解析开奖结果
        let positions = [];
        try {
            // 尝试多种解析方式
            if (typeof result.result === 'string') {
                if (result.result.startsWith('[') && result.result.endsWith(']')) {
                    // 直接的数组字符串
                    positions = JSON.parse(result.result);
                } else if (result.result.includes('positions')) {
                    // 包含positions属性的对象
                    const resultObj = JSON.parse(result.result);
                    positions = resultObj.positions || resultObj;
                } else {
                    // 其他格式
                    positions = JSON.parse(result.result);
                }
            } else if (Array.isArray(result.result)) {
                positions = result.result;
            } else {
                positions = result.result.positions || [];
            }
        } catch (e) {
            console.error('解析开奖结果失败:', e);
            console.log('尝试手动解析...');
            // 如果所有解析都失败，输出原始数据
            console.log('原始数据类型:', typeof result.result);
            console.log('原始数据内容:', result.result);
        }
        
        if (positions.length > 0) {
            console.log('\n📋 开奖结果（各名次号码）：');
            positions.forEach((num, idx) => {
                const highlight = idx === 6 ? ' ← 第7名' : '';
                console.log(`第${idx + 1}名: ${num}号${highlight}`);
            });
            
            console.log(`\n⚠️ 关键信息: 第7名开出 ${positions[6]}号`);
        }
        
        // 2. 查询该期第7名的所有投注记录
        const bets = await db.any(`
            SELECT id, username, bet_type, bet_value, position, amount, odds, 
                   win, win_amount, settled, created_at
            FROM bet_history
            WHERE period = 20250714219
            AND bet_type = 'number'
            AND position = 7
            ORDER BY created_at ASC
        `);
        
        if (bets.length > 0) {
            console.log(`\n📊 期号219第7名的投注记录 (共${bets.length}笔):\n`);
            
            let correctWins = 0;
            let incorrectWins = 0;
            let problemBets = [];
            
            bets.forEach(bet => {
                const actualWinner = positions[6]; // 第7名的实际开奖号码
                const shouldWin = parseInt(bet.bet_value) === actualWinner;
                const actualResult = bet.win;
                const isCorrect = shouldWin === actualResult;
                
                const status = isCorrect ? '✅' : '❌';
                const issue = isCorrect ? '' : ' ← 结算错误!';
                
                console.log(`${status} 投注ID: ${bet.id}`);
                console.log(`   用户: ${bet.username}`);
                console.log(`   投注: 第7名 = ${bet.bet_value}号`);
                console.log(`   金额: $${bet.amount}, 赔率: ${bet.odds}`);
                console.log(`   应该: ${shouldWin ? '中奖' : '未中奖'}`);
                console.log(`   实际: ${actualResult ? '中奖' : '未中奖'}${issue}`);
                if (bet.win) {
                    console.log(`   中奖金额: $${bet.win_amount}`);
                }
                console.log('');
                
                if (isCorrect) {
                    if (shouldWin) correctWins++;
                } else {
                    incorrectWins++;
                    problemBets.push({
                        id: bet.id,
                        username: bet.username,
                        bet_value: bet.bet_value,
                        shouldWin,
                        actualResult,
                        amount: bet.amount,
                        win_amount: bet.win_amount || 0
                    });
                }
            });
            
            // 3. 总结
            console.log('=' .repeat(50));
            console.log('📈 结算总结:');
            console.log(`正确结算: ${bets.length - incorrectWins} 笔`);
            console.log(`错误结算: ${incorrectWins} 笔`);
            
            if (problemBets.length > 0) {
                console.log('\n⚠️ 发现问题的注单:');
                problemBets.forEach(bet => {
                    console.log(`- ID ${bet.id}: ${bet.username} 投注${bet.bet_value}号, ` +
                              `${bet.shouldWin ? '应中奖但判为未中' : '不应中奖但判为中奖'}, ` +
                              `涉及金额: $${bet.shouldWin ? bet.amount * 9.89 : bet.win_amount}`);
                });
                
                console.log('\n🔧 需要修复的问题:');
                if (positions[6]) {
                    console.log(`- 第7名实际开出: ${positions[6]}号`);
                    console.log(`- 只有投注${positions[6]}号的注单应该中奖`);
                    console.log(`- 其他号码的注单都应该是未中奖`);
                } else {
                    console.log('- 无法确定第7名的开奖号码，需要进一步检查');
                }
            } else {
                console.log('\n✅ 所有注单结算正确！');
            }
        } else {
            console.log('\n📭 该期第7名没有投注记录');
        }
        
    } catch (error) {
        console.error('检查过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行检查
checkPeriod219();