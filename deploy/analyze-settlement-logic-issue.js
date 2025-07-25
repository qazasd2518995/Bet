// analyze-settlement-logic-issue.js - 分析结算逻辑问题
import db from './db/config.js';
import { checkWin } from './improved-settlement-system.js';

async function analyzeSettlementLogicIssue() {
    try {
        console.log('🔍 分析结算逻辑问题...\n');
        
        // 1. 检查最近的结算日志
        console.log('📋 最近的结算日志:');
        const recentLogs = await db.any(`
            SELECT period, settled_count, total_win_amount, created_at 
            FROM settlement_logs 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        
        recentLogs.forEach(log => {
            console.log(`期号 ${log.period}: ${log.settled_count}笔, 总中奖 $${log.total_win_amount} (${log.created_at.toLocaleString('zh-TW')})`);
        });
        
        // 2. 检查checkWin函数是否正常工作
        console.log('\n🧪 测试checkWin函数:');
        
        // 模拟测试案例
        const testCases = [
            {
                bet: { bet_type: 'champion', bet_value: 'big' },
                winResult: { positions: [7, 2, 3, 4, 5, 6, 8, 9, 10, 1] },
                expected: true,
                description: '冠军大 (7号)'
            },
            {
                bet: { bet_type: 'champion', bet_value: 'small' },
                winResult: { positions: [3, 2, 1, 4, 5, 6, 7, 8, 9, 10] },
                expected: true,
                description: '冠军小 (3号)'
            },
            {
                bet: { bet_type: 'tenth', bet_value: 'odd' },
                winResult: { positions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 7] },
                expected: true,
                description: '第十名单 (7号)'
            },
            {
                bet: { bet_type: 'fifth', bet_value: 'even' },
                winResult: { positions: [1, 2, 3, 4, 8, 6, 7, 5, 9, 10] },
                expected: true,
                description: '第五名双 (8号)'
            }
        ];
        
        testCases.forEach(test => {
            const result = checkWin(test.bet, test.winResult);
            const status = result === test.expected ? '✅' : '❌';
            console.log(`${status} ${test.description}: ${result ? '中奖' : '未中奖'}`);
        });
        
        // 3. 检查最近的投注记录结算状态
        console.log('\n📊 最近期号的结算状态:');
        const recentPeriods = await db.any(`
            SELECT period, 
                   COUNT(*) as total_bets,
                   SUM(CASE WHEN settled = true THEN 1 ELSE 0 END) as settled_bets,
                   SUM(CASE WHEN win = true THEN 1 ELSE 0 END) as winning_bets,
                   SUM(CASE WHEN win = true THEN win_amount ELSE 0 END) as total_winnings
            FROM bet_history 
            WHERE username = 'justin111' 
                AND period >= 20250714290
            GROUP BY period
            ORDER BY period DESC
            LIMIT 10
        `);
        
        recentPeriods.forEach(p => {
            console.log(`期号 ${p.period}: ${p.total_bets}笔 (已结算${p.settled_bets}, 中奖${p.winning_bets}, 总奖金$${p.total_winnings || 0})`);
        });
        
        // 4. 检查bet_value的格式
        console.log('\n🔍 检查bet_value格式:');
        const betValueFormats = await db.any(`
            SELECT DISTINCT bet_value, COUNT(*) as count
            FROM bet_history 
            WHERE username = 'justin111' 
                AND period >= 20250714290
            GROUP BY bet_value
            ORDER BY count DESC
        `);
        
        console.log('投注选项格式分布:');
        betValueFormats.forEach(v => {
            console.log(`  "${v.bet_value}": ${v.count}笔`);
        });
        
        // 5. 分析可能的问题原因
        console.log('\n🎯 问题分析:');
        
        // 检查是否有中文与英文混用问题
        const mixedFormats = await db.any(`
            SELECT period, bet_type, bet_value, win, created_at
            FROM bet_history 
            WHERE username = 'justin111' 
                AND period >= 20250714299
                AND bet_value IN ('单', '双', '大', '小')
            ORDER BY period DESC, created_at DESC
            LIMIT 10
        `);
        
        if (mixedFormats.length > 0) {
            console.log('\n⚠️ 发现使用中文投注选项:');
            mixedFormats.forEach(b => {
                console.log(`  期号 ${b.period}: ${b.bet_type} ${b.bet_value} - ${b.win ? '中奖' : '输'}`);
            });
        }
        
        // 6. 检查checkWin函数对中文的支援
        console.log('\n🧪 测试checkWin对中文的支援:');
        const chineseTests = [
            {
                bet: { bet_type: 'champion', bet_value: '大' },
                winResult: { positions: [7, 2, 3, 4, 5, 6, 8, 9, 10, 1] },
                description: '冠军大(中文) (7号)'
            },
            {
                bet: { bet_type: 'champion', bet_value: '单' },
                winResult: { positions: [7, 2, 3, 4, 5, 6, 8, 9, 10, 1] },
                description: '冠军单(中文) (7号)'
            }
        ];
        
        chineseTests.forEach(test => {
            const result = checkWin(test.bet, test.winResult);
            const status = result ? '✅' : '❌';
            console.log(`${status} ${test.description}: ${result ? '中奖' : '未中奖'}`);
        });
        
        console.log('\n💡 结论:');
        console.log('问题可能是checkWin函数不支援中文的"大"、"小"、"单"、"双"');
        console.log('需要更新checkWin函数以支援中文投注选项');
        
        await db.$pool.end();
    } catch (error) {
        console.error('分析过程中发生错误:', error);
        await db.$pool.end();
    }
}

analyzeSettlementLogicIssue();