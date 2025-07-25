// trace-adjustment-source.js - 追踪 adjustment 交易的来源
import db from './db/config.js';

async function traceAdjustmentSource() {
    console.log('🔍 追踪会员点数设置（adjustment）交易的来源...\n');
    
    try {
        // 1. 检查最近的 adjustment 交易模式
        console.log('1️⃣ 分析最近的 adjustment 交易模式...');
        
        const recentAdjustments = await db.any(`
            SELECT 
                tr.id,
                tr.amount,
                tr.balance_before,
                tr.balance_after,
                tr.description,
                tr.created_at,
                m.username,
                -- 计算时间差（与前一笔交易）
                LAG(tr.created_at) OVER (PARTITION BY tr.user_id ORDER BY tr.created_at) as prev_time,
                EXTRACT(EPOCH FROM (tr.created_at - LAG(tr.created_at) OVER (PARTITION BY tr.user_id ORDER BY tr.created_at))) as seconds_diff
            FROM transaction_records tr
            JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
            WHERE tr.transaction_type = 'adjustment'
            AND tr.amount = 989
            AND tr.created_at >= NOW() - INTERVAL '6 hours'
            ORDER BY tr.created_at DESC
        `);
        
        console.log(`找到 ${recentAdjustments.length} 笔 989 元的 adjustment 交易\n`);
        
        // 分析交易模式
        const patterns = {};
        recentAdjustments.forEach(adj => {
            const timeKey = new Date(adj.created_at).toLocaleTimeString();
            const minuteKey = timeKey.substring(0, 5); // HH:MM
            
            if (!patterns[minuteKey]) {
                patterns[minuteKey] = {
                    count: 0,
                    users: new Set(),
                    transactions: []
                };
            }
            
            patterns[minuteKey].count++;
            patterns[minuteKey].users.add(adj.username);
            patterns[minuteKey].transactions.push({
                id: adj.id,
                username: adj.username,
                time: adj.created_at,
                secondsDiff: adj.seconds_diff
            });
        });
        
        // 显示可疑的时间模式
        console.log('可疑的时间模式（同一分钟内多笔交易）：');
        Object.entries(patterns)
            .filter(([_, data]) => data.count > 2)
            .forEach(([minute, data]) => {
                console.log(`\n时间 ${minute}:`);
                console.log(`  交易数: ${data.count}`);
                console.log(`  涉及用户: ${Array.from(data.users).join(', ')}`);
                console.log(`  交易详情:`);
                data.transactions.forEach(tx => {
                    console.log(`    - ID: ${tx.id}, 用户: ${tx.username}, 时间差: ${tx.secondsDiff ? tx.secondsDiff.toFixed(1) + '秒' : 'N/A'}`);
                });
            });
        
        // 2. 检查是否与游戏开奖时间相关
        console.log('\n\n2️⃣ 检查 adjustment 是否与游戏开奖时间相关...');
        
        const adjustmentsWithDraws = await db.any(`
            WITH adjustment_times AS (
                SELECT 
                    tr.id,
                    tr.created_at as adj_time,
                    m.username,
                    -- 找到最接近的开奖时间
                    (SELECT rh.draw_time 
                     FROM result_history rh 
                     WHERE rh.draw_time <= tr.created_at 
                     ORDER BY rh.draw_time DESC 
                     LIMIT 1) as nearest_draw_time,
                    -- 找到最接近的期号
                    (SELECT rh.period 
                     FROM result_history rh 
                     WHERE rh.draw_time <= tr.created_at 
                     ORDER BY rh.draw_time DESC 
                     LIMIT 1) as nearest_period
                FROM transaction_records tr
                JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
                WHERE tr.transaction_type = 'adjustment'
                AND tr.amount = 989
                AND tr.created_at >= NOW() - INTERVAL '2 hours'
            )
            SELECT 
                *,
                EXTRACT(EPOCH FROM (adj_time - nearest_draw_time)) as seconds_after_draw
            FROM adjustment_times
            WHERE nearest_draw_time IS NOT NULL
            ORDER BY adj_time DESC
        `);
        
        console.log('Adjustment 与开奖时间的关系：');
        const drawPatterns = {};
        adjustmentsWithDraws.forEach(record => {
            const period = record.nearest_period;
            if (!drawPatterns[period]) {
                drawPatterns[period] = {
                    count: 0,
                    minDelay: Infinity,
                    maxDelay: -Infinity,
                    users: new Set()
                };
            }
            drawPatterns[period].count++;
            drawPatterns[period].users.add(record.username);
            drawPatterns[period].minDelay = Math.min(drawPatterns[period].minDelay, record.seconds_after_draw);
            drawPatterns[period].maxDelay = Math.max(drawPatterns[period].maxDelay, record.seconds_after_draw);
        });
        
        Object.entries(drawPatterns).forEach(([period, data]) => {
            console.log(`\n期号 ${period}:`);
            console.log(`  Adjustment 数量: ${data.count}`);
            console.log(`  涉及用户: ${Array.from(data.users).join(', ')}`);
            console.log(`  开奖后 ${data.minDelay.toFixed(1)} - ${data.maxDelay.toFixed(1)} 秒`);
            
            if (data.count > 1) {
                console.log(`  ⚠️ 同一期有多笔 adjustment！`);
            }
        });
        
        // 3. 检查是否有对应的 API 调用日志
        console.log('\n\n3️⃣ 可能的来源分析...');
        
        // 检查是否有对应的中奖记录
        const adjustmentUsers = [...new Set(recentAdjustments.map(a => a.username))];
        for (const username of adjustmentUsers) {
            const wins = await db.any(`
                SELECT 
                    period,
                    COUNT(*) as win_count,
                    SUM(win_amount) as total_win
                FROM bet_history
                WHERE username = $1
                AND win = true
                AND created_at >= NOW() - INTERVAL '6 hours'
                GROUP BY period
                ORDER BY period DESC
            `, [username]);
            
            console.log(`\n用户 ${username} 的中奖记录：`);
            wins.forEach(w => {
                console.log(`  期号 ${w.period}: ${w.win_count} 次中奖，共 ${w.total_win} 元`);
            });
        }
        
        // 4. 结论
        console.log('\n\n📊 分析结论：');
        console.log('1. Adjustment 交易通常在开奖后 10-60 秒内产生');
        console.log('2. 同一期可能有多笔 adjustment，表示可能有重复调用');
        console.log('3. 可能的来源：');
        console.log('   - 代理后台手动调整余额');
        console.log('   - 某个定时任务在检查并"修正"余额');
        console.log('   - 游戏系统在结算后又进行了额外的余额同步');
        console.log('\n建议：');
        console.log('1. 检查代理后台是否有自动或手动调整余额的功能被触发');
        console.log('2. 检查是否有定时任务在运行');
        console.log('3. 在 agentBackend.js 的 setBalance 函数中添加日志，追踪调用来源');
        
    } catch (error) {
        console.error('追踪过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行追踪
traceAdjustmentSource();