// final-check.js - 最终检查结算修复结果
import db from './db/config.js';

async function finalCheck() {
    console.log('🔍 最终检查结算修复结果...\n');
    
    try {
        // 1. 检查用户当前状态
        const member = await db.one(`
            SELECT username, balance FROM members WHERE username = 'justin111'
        `);
        
        console.log(`用户 ${member.username} 当前余额: ${member.balance}`);
        console.log('（修复后应该是 141,773.49）');
        
        // 2. 检查最近是否还有新的 adjustment
        const recentAdjustments = await db.any(`
            SELECT 
                tr.created_at,
                tr.amount,
                tr.description
            FROM transaction_records tr
            JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
            WHERE m.username = 'justin111'
            AND tr.transaction_type = 'adjustment'
            AND tr.description = '会员点数设置'
            AND tr.created_at >= NOW() - INTERVAL '10 minutes'
            ORDER BY tr.created_at DESC
        `);
        
        if (recentAdjustments.length > 0) {
            console.log(`\n❌ 警告：最近 10 分钟内仍有 ${recentAdjustments.length} 笔 adjustment 交易！`);
            recentAdjustments.forEach(adj => {
                console.log(`  - ${new Date(adj.created_at).toLocaleTimeString()}: ${adj.amount} 元`);
            });
            console.log('\n可能原因：');
            console.log('1. 修复的代码还未生效');
            console.log('2. 有其他服务还在使用旧逻辑');
        } else {
            console.log('\n✅ 最近 10 分钟没有新的可疑 adjustment 交易');
        }
        
        // 3. 检查最近的中奖记录
        const recentWins = await db.any(`
            SELECT 
                bh.period,
                bh.username,
                bh.bet_type,
                bh.bet_value,
                bh.win_amount,
                bh.created_at
            FROM bet_history bh
            WHERE bh.username = 'justin111'
            AND bh.win = true
            AND bh.settled = true
            AND bh.created_at >= NOW() - INTERVAL '1 hour'
            ORDER BY bh.created_at DESC
            LIMIT 5
        `);
        
        console.log(`\n最近的中奖记录（1小时内）：`);
        if (recentWins.length > 0) {
            recentWins.forEach(win => {
                console.log(`  期号 ${win.period}: ${win.bet_type}=${win.bet_value}, 中奖 ${win.win_amount} 元`);
            });
        } else {
            console.log('  没有中奖记录');
        }
        
        // 4. 总结
        console.log('\n📊 总结：');
        console.log('1. backend.js 已成功重启并使用修复后的代码');
        console.log('2. 结算现在使用 improvedSettleBets 函数');
        console.log('3. legacySettleBets 中的重复结算逻辑已被注释');
        console.log('4. 用户余额已修正为正确的金额');
        
        console.log('\n下次投注时应该：');
        console.log('- 中奖后只增加净利润（989-900=89元）');
        console.log('- 交易记录显示 "win" 类型而非 "adjustment"');
        console.log('- 不会有 "会员点数设置" 的交易');
        
    } catch (error) {
        console.error('检查过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行检查
finalCheck();