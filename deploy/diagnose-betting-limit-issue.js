// diagnose-betting-limit-issue.js - 诊断限红问题
import db from './db/config.js';

async function diagnoseBettingLimitIssue() {
    console.log('诊断限红问题...\n');
    
    const username = 'justin111';
    const period = '20250718432'; // 请替换为实际期号
    
    try {
        // 1. 查询用户当期所有投注
        const userBets = await db.manyOrNone(`
            SELECT id, bet_type, bet_value, position, amount, created_at
            FROM bet_history
            WHERE username = $1 AND period = $2
            ORDER BY created_at DESC
        `, [username, period]);
        
        console.log(`用户 ${username} 在期号 ${period} 的投注记录：`);
        console.log('================================================');
        
        if (userBets.length === 0) {
            console.log('没有找到投注记录');
            return;
        }
        
        // 按选项分组统计
        const betsByOption = {};
        
        userBets.forEach((bet, index) => {
            console.log(`\n投注 ${index + 1}:`);
            console.log(`  ID: ${bet.id}`);
            console.log(`  类型: ${bet.bet_type}`);
            console.log(`  值: ${bet.bet_value}`);
            console.log(`  位置: ${bet.position || 'N/A'}`);
            console.log(`  金额: $${bet.amount}`);
            console.log(`  时间: ${bet.created_at}`);
            
            // 建立选项键
            const optionKey = `${bet.bet_type}-${bet.bet_value}${bet.position ? `-${bet.position}` : ''}`;
            
            if (!betsByOption[optionKey]) {
                betsByOption[optionKey] = {
                    betType: bet.bet_type,
                    betValue: bet.bet_value,
                    position: bet.position,
                    totalAmount: 0,
                    count: 0,
                    bets: []
                };
            }
            
            betsByOption[optionKey].totalAmount += parseFloat(bet.amount);
            betsByOption[optionKey].count++;
            betsByOption[optionKey].bets.push(bet);
        });
        
        console.log('\n\n按选项分组统计：');
        console.log('================================================');
        
        Object.entries(betsByOption).forEach(([key, data]) => {
            console.log(`\n选项: ${key}`);
            console.log(`  投注次数: ${data.count}`);
            console.log(`  累计金额: $${data.totalAmount}`);
            console.log(`  详细:`);
            data.bets.forEach(bet => {
                console.log(`    - ID ${bet.id}: $${bet.amount}`);
            });
        });
        
        // 2. 分析两面投注
        console.log('\n\n两面投注分析：');
        console.log('================================================');
        
        const twoSideBets = userBets.filter(bet => 
            ['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(bet.bet_type) &&
            ['big', 'small', 'odd', 'even', '大', '小', '单', '双'].includes(bet.bet_value)
        );
        
        if (twoSideBets.length > 0) {
            const twoSideByOption = {};
            
            twoSideBets.forEach(bet => {
                const optionKey = `${bet.bet_type}-${bet.bet_value}`;
                if (!twoSideByOption[optionKey]) {
                    twoSideByOption[optionKey] = 0;
                }
                twoSideByOption[optionKey] += parseFloat(bet.amount);
            });
            
            console.log('各选项累计：');
            Object.entries(twoSideByOption).forEach(([option, total]) => {
                console.log(`  ${option}: $${total}`);
            });
        } else {
            console.log('没有两面投注');
        }
        
        // 3. 查询会员限红设定
        console.log('\n\n会员限红设定：');
        console.log('================================================');
        
        try {
            const AGENT_API_URL = 'https://agent.jphd1314.com';
            const response = await fetch(`${AGENT_API_URL}/api/agent/member-betting-limit-by-username?username=${username}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.config) {
                    console.log(`限红等级: ${data.levelDisplayName} (${data.levelName})`);
                    console.log('\n两面限红:');
                    console.log(`  单注最高: $${data.config.twoSide.maxBet}`);
                    console.log(`  单期限额: $${data.config.twoSide.periodLimit}`);
                    
                    console.log('\n按照新逻辑，每个选项（如冠军大、冠军小）应该可以各自下注到 $${data.config.twoSide.periodLimit}`);
                }
            }
        } catch (error) {
            console.error('无法获取限红设定:', error.message);
        }
        
    } catch (error) {
        console.error('诊断失败:', error);
    } finally {
        process.exit();
    }
}

// 执行诊断
diagnoseBettingLimitIssue();