// analyze-period-299.js - 分析期号299的投注问题
import db from './db/config.js';

async function analyzePeriod299() {
    try {
        console.log('🔍 分析期号299的投注问题...\n');
        
        // 1. 获取期号299的开奖结果
        const result = await db.oneOrNone('SELECT period, result FROM result_history WHERE period = 20250714299');
        if (!result) {
            console.log('❌ 找不到期号299的开奖结果');
            await db.$pool.end();
            return;
        }
        
        console.log('期号299开奖结果:');
        console.log('原始结果:', result.result);
        
        let positions = [];
        if (Array.isArray(result.result)) {
            positions = result.result;
        } else if (typeof result.result === 'string') {
            positions = result.result.split(',').map(n => parseInt(n.trim()));
        }
        
        console.log('解析后位置:', positions);
        console.log('\n各位置分析:');
        const positionNames = ['冠军', '亚军', '第三名', '第四名', '第五名', '第六名', '第七名', '第八名', '第九名', '第十名'];
        positions.forEach((num, index) => {
            const oddEven = num % 2 === 0 ? '双' : '单';
            console.log(`  ${positionNames[index]}: ${num} (${oddEven})`);
        });
        
        // 2. 获取所有期号299的投注记录
        const allBets = await db.any(`
            SELECT id, bet_type, bet_value, position, amount, odds, win, win_amount, settled, created_at
            FROM bet_history 
            WHERE period = 20250714299 AND username = 'justin111'
            ORDER BY id
        `);
        
        console.log(`\n📊 期号299投注统计:`);
        console.log(`总投注记录数: ${allBets.length}`);
        console.log(`已结算投注数: ${allBets.filter(b => b.settled).length}`);
        console.log(`未结算投注数: ${allBets.filter(b => !b.settled).length}`);
        console.log(`显示为中奖的投注数: ${allBets.filter(b => b.win).length}`);
        console.log(`显示为输的投注数: ${allBets.filter(b => !b.win).length}`);
        
        // 3. 分析哪些应该中奖
        console.log('\n🎯 应该中奖的投注:');
        
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
                const shouldWin = (bet.bet_value === '双' && isEven) || (bet.bet_value === '单' && !isEven);
                
                if (shouldWin) {
                    shouldWinCount++;
                    expectedWinAmount += 100 * 1.98;
                    
                    if (!bet.win) {
                        console.log(`❌ 应中奖但显示为输: ID ${bet.id} - ${bet.bet_type} ${bet.bet_value} (开出${positionValue})`);
                    } else {
                        actualWinCount++;
                        console.log(`✅ 正确中奖: ID ${bet.id} - ${bet.bet_type} ${bet.bet_value} (开出${positionValue})`);
                    }
                }
            }
        });
        
        console.log(`\n📈 统计结果:`);
        console.log(`应该中奖的投注数: ${shouldWinCount}`);
        console.log(`实际中奖的投注数: ${actualWinCount}`);
        console.log(`错误标记为输的投注数: ${shouldWinCount - actualWinCount}`);
        console.log(`预期总中奖金额: $${expectedWinAmount}`);
        
        // 4. 检查用户说的缺失投注
        console.log('\n🔍 检查可能缺失的投注:');
        
        // 检查单双投注的完整性
        const expectedBets = [];
        const betTypes = ['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
        const betValues = ['单', '双'];
        
        betTypes.forEach(type => {
            betValues.forEach(value => {
                expectedBets.push(`${type}_${value}`);
            });
        });
        
        // 转换数据库中的投注为相同格式
        const actualBetKeys = allBets.map(bet => {
            // 标准化bet_type（处理中文）
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
            console.log(`缺失的投注组合 (${missingBets.length}个):`);
            missingBets.forEach(missing => {
                console.log(`  ${missing}`);
            });
        } else {
            console.log('✅ 所有预期的投注组合都存在');
        }
        
        // 5. 检查结算日志
        const settlementLog = await db.oneOrNone(`
            SELECT period, settled_count, total_win_amount, created_at
            FROM settlement_logs 
            WHERE period = 20250714299
            ORDER BY created_at DESC
            LIMIT 1
        `);
        
        if (settlementLog) {
            console.log('\n📋 结算日志:');
            console.log(`  结算时间: ${settlementLog.created_at}`);
            console.log(`  结算数量: ${settlementLog.settled_count}`);
            console.log(`  总中奖金额: $${settlementLog.total_win_amount}`);
        } else {
            console.log('\n❌ 找不到结算日志');
        }
        
        // 6. 检查余额变化
        const balanceChanges = await db.manyOrNone(`
            SELECT transaction_type, amount, balance_before, balance_after, description, created_at
            FROM transaction_records 
            WHERE user_id = (SELECT id FROM members WHERE username = 'justin111')
            AND created_at >= (SELECT MIN(created_at) FROM bet_history WHERE period = 20250714299 AND username = 'justin111')
            ORDER BY created_at
            LIMIT 10
        `);
        
        console.log('\n💰 相关余额变化:');
        balanceChanges.forEach(tx => {
            console.log(`  ${tx.created_at.toLocaleString('zh-TW')}: ${tx.transaction_type} $${tx.amount} - ${tx.description}`);
            console.log(`    余额: $${tx.balance_before} → $${tx.balance_after}`);
        });
        
        // 7. 总结问题
        console.log('\n🚨 问题总结:');
        if (shouldWinCount > actualWinCount) {
            const missingWinAmount = (shouldWinCount - actualWinCount) * 198;
            console.log(`发现 ${shouldWinCount - actualWinCount} 笔应该中奖但被标记为输的投注`);
            console.log(`遗失的中奖金额: $${missingWinAmount}`);
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('分析过程中发生错误:', error);
        await db.$pool.end();
    }
}

analyzePeriod299();