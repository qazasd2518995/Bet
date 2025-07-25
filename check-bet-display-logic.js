// check-bet-display-logic.js - 检查投注记录显示逻辑
import db from './db/config.js';

async function checkBetDisplayLogic() {
    try {
        console.log('🔍 检查投注记录显示逻辑...\n');
        
        // 1. 检查今日所有投注记录
        const today = new Date().toISOString().split('T')[0]; // 2025-07-14
        
        const allTodayBets = await db.any(`
            SELECT period, COUNT(*) as count, 
                   MIN(created_at) as first_bet, 
                   MAX(created_at) as last_bet
            FROM bet_history 
            WHERE username = 'justin111' 
                AND DATE(created_at) = $1
            GROUP BY period
            ORDER BY period DESC
        `, [today]);
        
        console.log(`📅 今日 (${today}) 投注统计:\n`);
        
        let totalBetsToday = 0;
        allTodayBets.forEach(period => {
            totalBetsToday += parseInt(period.count);
            console.log(`期号 ${period.period}: ${period.count} 笔投注`);
            console.log(`  时间范围: ${new Date(period.first_bet).toLocaleString('zh-TW')} - ${new Date(period.last_bet).toLocaleString('zh-TW')}`);
        });
        
        console.log(`\n今日总投注数: ${totalBetsToday} 笔`);
        
        // 2. 检查期号299的详细投注
        console.log('\n📊 期号299投注详情:');
        
        const period299Bets = await db.any(`
            SELECT id, bet_type, bet_value, amount, win, win_amount, created_at
            FROM bet_history 
            WHERE username = 'justin111' 
                AND period = 20250714299
            ORDER BY id
        `);
        
        console.log(`期号299总投注数: ${period299Bets.length} 笔`);
        
        // 显示前10笔和后10笔
        if (period299Bets.length > 20) {
            console.log('\n前10笔投注:');
            period299Bets.slice(0, 10).forEach(bet => {
                console.log(`  ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} - ${bet.win ? '中奖' : '输'}`);
            });
            
            console.log('\n...(中间省略)...\n');
            
            console.log('后10笔投注:');
            period299Bets.slice(-10).forEach(bet => {
                console.log(`  ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} - ${bet.win ? '中奖' : '输'}`);
            });
        }
        
        // 3. 检查前端API限制
        console.log('\n🔍 检查前端API查询逻辑:');
        
        // 模拟前端查询
        const queryWithLimit = await db.any(`
            SELECT id, period, bet_type, bet_value, amount, win, win_amount
            FROM bet_history 
            WHERE username = 'justin111' 
                AND DATE(created_at) = $1
            ORDER BY created_at DESC 
            LIMIT 20
        `, [today]);
        
        console.log(`\n使用 LIMIT 20 查询结果: ${queryWithLimit.length} 笔`);
        
        // 查看是否有分页
        const queryWithOffset = await db.any(`
            SELECT id, period, bet_type, bet_value, amount, win, win_amount
            FROM bet_history 
            WHERE username = 'justin111' 
                AND DATE(created_at) = $1
            ORDER BY created_at DESC 
            LIMIT 20 OFFSET 20
        `, [today]);
        
        console.log(`第二页 (OFFSET 20) 查询结果: ${queryWithOffset.length} 笔`);
        
        // 4. 查看backend.js的查询逻辑
        console.log('\n📝 Backend.js 查询逻辑分析:');
        console.log('根据之前的日志，backend.js 使用了:');
        console.log('- LIMIT 20 OFFSET 0 (第一页只显示20笔)');
        console.log('- 这解释了为什么只看到20笔投注记录');
        
        // 5. 建议修复方案
        console.log('\n💡 修复建议:');
        console.log('1. 修改前端显示逻辑，支援分页或一次显示更多记录');
        console.log('2. 或修改backend.js，增加每页显示数量 (如 LIMIT 100)');
        console.log('3. 添加"载入更多"或分页按钮功能');
        
        // 6. 实际应显示的记录数
        const shouldDisplay = await db.one(`
            SELECT COUNT(*) as total
            FROM bet_history 
            WHERE username = 'justin111' 
                AND DATE(created_at) = $1
        `, [today]);
        
        console.log(`\n📊 总结:`);
        console.log(`今日实际投注总数: ${shouldDisplay.total} 笔`);
        console.log(`前端目前只显示: 20 笔 (第一页)`);
        console.log(`缺少显示: ${shouldDisplay.total - 20} 笔`);
        
        await db.$pool.end();
    } catch (error) {
        console.error('检查过程中发生错误:', error);
        await db.$pool.end();
    }
}

checkBetDisplayLogic();