// check-settlement-logs-291.js - 检查期号291的结算日志
import db from './db/config.js';

async function checkSettlementLogs291() {
    try {
        console.log('🔍 检查期号291的结算日志...\n');
        
        // 1. 检查结算日志
        const logs = await db.manyOrNone(`
            SELECT period, settled_count, total_win_amount, created_at, settlement_details
            FROM settlement_logs 
            WHERE period = 20250714291 
            ORDER BY created_at
        `);
        
        console.log(`找到 ${logs.length} 条结算日志记录:\n`);
        
        logs.forEach((log, index) => {
            console.log(`结算记录 ${index + 1}:`);
            console.log(`  期号: ${log.period}`);
            console.log(`  结算数量: ${log.settled_count}`);
            console.log(`  总中奖金额: $${log.total_win_amount}`);
            console.log(`  结算时间: ${log.created_at}`);
            
            if (log.settlement_details) {
                try {
                    const details = JSON.parse(log.settlement_details);
                    console.log(`  中奖详情: ${details.filter(d => d.isWin).length} 个中奖注单`);
                } catch (e) {
                    console.log(`  结算详情解析错误: ${log.settlement_details}`);
                }
            }
            console.log('');
        });
        
        // 2. 检查事务记录
        const transactions = await db.manyOrNone(`
            SELECT user_id, transaction_type, amount, balance_before, balance_after, description, created_at
            FROM transaction_records 
            WHERE description LIKE '%291%' OR description LIKE '%期号291%'
            ORDER BY created_at
        `);
        
        console.log(`📋 相关事务记录 (${transactions.length}条):\n`);
        
        transactions.forEach((tx, index) => {
            console.log(`事务 ${index + 1}:`);
            console.log(`  类型: ${tx.transaction_type}`);
            console.log(`  金额: $${tx.amount}`);
            console.log(`  余额变化: $${tx.balance_before} → $${tx.balance_after}`);
            console.log(`  描述: ${tx.description}`);
            console.log(`  时间: ${tx.created_at}`);
            console.log('');
        });
        
        // 3. 检查用户当前状态
        const user = await db.oneOrNone(`
            SELECT id, username, balance 
            FROM members 
            WHERE username = 'justin111'
        `);
        
        console.log('👤 用户当前状态:');
        console.log(`  用户名: ${user.username}`);
        console.log(`  当前余额: $${user.balance}`);
        
        // 4. 检查期号291的投注总览
        const betSummary = await db.one(`
            SELECT 
                COUNT(*) as total_bets,
                SUM(amount) as total_bet_amount,
                SUM(CASE WHEN win = true THEN 1 ELSE 0 END) as winning_bets,
                SUM(CASE WHEN win = true THEN win_amount ELSE 0 END) as total_winnings,
                MIN(created_at) as first_bet_time,
                MAX(created_at) as last_bet_time
            FROM bet_history 
            WHERE period = 20250714291 AND username = 'justin111'
        `);
        
        console.log('\n📊 期号291投注总览:');
        console.log(`  总投注数: ${betSummary.total_bets}`);
        console.log(`  总投注金额: $${betSummary.total_bet_amount}`);
        console.log(`  中奖投注数: ${betSummary.winning_bets}`);
        console.log(`  总中奖金额: $${betSummary.total_winnings}`);
        console.log(`  投注时间范围: ${betSummary.first_bet_time} 到 ${betSummary.last_bet_time}`);
        
        // 5. 检查系统是否认为已结算
        const unsettledCount = await db.one(`
            SELECT COUNT(*) as count 
            FROM bet_history 
            WHERE period = 20250714291 AND settled = false
        `);
        
        console.log(`\n🔍 当前未结算注单数: ${unsettledCount.count}`);
        
        if (unsettledCount.count === 0) {
            console.log('✅ 系统认为期号291已完全结算');
        } else {
            console.log('⚠️ 仍有未结算的注单');
        }
        
        // 6. 分析可能的问题原因
        console.log('\n🔍 问题分析:');
        
        if (logs.length === 0) {
            console.log('❌ 没有结算日志 - 表示improvedSettleBets没有被正确调用');
        } else if (logs.length === 1 && logs[0].settled_count === 40) {
            console.log('✅ 结算日志正常 - 一次性结算了40笔注单');
        } else if (logs.length > 1) {
            console.log('⚠️ 多次结算 - 可能有重复结算问题');
        }
        
        if (transactions.filter(t => t.transaction_type === 'win').length !== 1) {
            console.log('⚠️ 中奖事务记录异常 - 应该只有一笔合并的中奖记录');
        }
        
        if (transactions.filter(t => t.transaction_type === 'adjustment').length > 0) {
            console.log('✅ 找到补偿记录 - 说明手动修复已执行');
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('检查过程中发生错误:', error);
        await db.$pool.end();
    }
}

checkSettlementLogs291();