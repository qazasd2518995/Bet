// trace-adjustment-source.js - 追蹤 adjustment 交易的來源
import db from './db/config.js';

async function traceAdjustmentSource() {
    console.log('🔍 追蹤會員點數設置（adjustment）交易的來源...\n');
    
    try {
        // 1. 檢查最近的 adjustment 交易模式
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
                -- 計算時間差（與前一筆交易）
                LAG(tr.created_at) OVER (PARTITION BY tr.user_id ORDER BY tr.created_at) as prev_time,
                EXTRACT(EPOCH FROM (tr.created_at - LAG(tr.created_at) OVER (PARTITION BY tr.user_id ORDER BY tr.created_at))) as seconds_diff
            FROM transaction_records tr
            JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
            WHERE tr.transaction_type = 'adjustment'
            AND tr.amount = 989
            AND tr.created_at >= NOW() - INTERVAL '6 hours'
            ORDER BY tr.created_at DESC
        `);
        
        console.log(`找到 ${recentAdjustments.length} 筆 989 元的 adjustment 交易\n`);
        
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
        
        // 顯示可疑的時間模式
        console.log('可疑的時間模式（同一分鐘內多筆交易）：');
        Object.entries(patterns)
            .filter(([_, data]) => data.count > 2)
            .forEach(([minute, data]) => {
                console.log(`\n時間 ${minute}:`);
                console.log(`  交易數: ${data.count}`);
                console.log(`  涉及用戶: ${Array.from(data.users).join(', ')}`);
                console.log(`  交易詳情:`);
                data.transactions.forEach(tx => {
                    console.log(`    - ID: ${tx.id}, 用戶: ${tx.username}, 時間差: ${tx.secondsDiff ? tx.secondsDiff.toFixed(1) + '秒' : 'N/A'}`);
                });
            });
        
        // 2. 檢查是否與遊戲開獎時間相關
        console.log('\n\n2️⃣ 檢查 adjustment 是否與遊戲開獎時間相關...');
        
        const adjustmentsWithDraws = await db.any(`
            WITH adjustment_times AS (
                SELECT 
                    tr.id,
                    tr.created_at as adj_time,
                    m.username,
                    -- 找到最接近的開獎時間
                    (SELECT rh.draw_time 
                     FROM result_history rh 
                     WHERE rh.draw_time <= tr.created_at 
                     ORDER BY rh.draw_time DESC 
                     LIMIT 1) as nearest_draw_time,
                    -- 找到最接近的期號
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
        
        console.log('Adjustment 與開獎時間的關係：');
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
            console.log(`\n期號 ${period}:`);
            console.log(`  Adjustment 數量: ${data.count}`);
            console.log(`  涉及用戶: ${Array.from(data.users).join(', ')}`);
            console.log(`  開獎後 ${data.minDelay.toFixed(1)} - ${data.maxDelay.toFixed(1)} 秒`);
            
            if (data.count > 1) {
                console.log(`  ⚠️ 同一期有多筆 adjustment！`);
            }
        });
        
        // 3. 檢查是否有對應的 API 調用日誌
        console.log('\n\n3️⃣ 可能的來源分析...');
        
        // 檢查是否有對應的中獎記錄
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
            
            console.log(`\n用戶 ${username} 的中獎記錄：`);
            wins.forEach(w => {
                console.log(`  期號 ${w.period}: ${w.win_count} 次中獎，共 ${w.total_win} 元`);
            });
        }
        
        // 4. 結論
        console.log('\n\n📊 分析結論：');
        console.log('1. Adjustment 交易通常在開獎後 10-60 秒內產生');
        console.log('2. 同一期可能有多筆 adjustment，表示可能有重複調用');
        console.log('3. 可能的來源：');
        console.log('   - 代理後台手動調整餘額');
        console.log('   - 某個定時任務在檢查並"修正"餘額');
        console.log('   - 遊戲系統在結算後又進行了額外的餘額同步');
        console.log('\n建議：');
        console.log('1. 檢查代理後台是否有自動或手動調整餘額的功能被觸發');
        console.log('2. 檢查是否有定時任務在運行');
        console.log('3. 在 agentBackend.js 的 setBalance 函數中添加日誌，追蹤調用來源');
        
    } catch (error) {
        console.error('追蹤過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行追蹤
traceAdjustmentSource();