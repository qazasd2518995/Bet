import axios from 'axios';
import db from './db/config.js';

// 配置
const AGENT_API_URL = 'http://localhost:3003/api/agent';

async function testAgentReports() {
    console.log('=== 測試代理報表系統 ===\n');
    
    try {
        // 1. 查找有下注記錄的代理層級
        console.log('1. 查找代理層級結構...');
        const agentHierarchy = await db.any(`
            WITH RECURSIVE agent_tree AS (
                -- 找到有會員的代理
                SELECT DISTINCT a.id, a.username, a.parent_id, a.rebate_percentage, a.level, a.market_type
                FROM agents a
                INNER JOIN members m ON m.agent_id = a.id
                WHERE m.status = 1 AND a.status = 1
                
                UNION
                
                -- 遞歸找到所有上級
                SELECT p.id, p.username, p.parent_id, p.rebate_percentage, p.level, p.market_type
                FROM agents p
                INNER JOIN agent_tree at ON p.id = at.parent_id
            )
            SELECT DISTINCT * FROM agent_tree
            ORDER BY level ASC
            LIMIT 10
        `);
        
        if (agentHierarchy.length === 0) {
            console.log('找不到有效的代理層級結構');
            return;
        }
        
        console.log('找到代理層級:');
        agentHierarchy.forEach(agent => {
            console.log(`  ${' '.repeat(agent.level * 2)}L${agent.level} ${agent.username} (退水: ${(agent.rebate_percentage * 100).toFixed(1)}%)`);
        });
        console.log('');
        
        // 2. 為每個代理查詢層級分析報表
        console.log('2. 檢查各層代理報表...');
        const today = new Date().toISOString().split('T')[0];
        
        for (const agent of agentHierarchy) {
            console.log(`\n=== ${agent.username} (L${agent.level}) 的層級分析報表 ===`);
            
            try {
                // 模擬代理登入獲取報表
                const reportData = await db.any(`
                    WITH RECURSIVE downline AS (
                        -- 起始：查詢的代理本身
                        SELECT id, username, parent_id, rebate_percentage, 0 as depth
                        FROM agents
                        WHERE id = $1
                        
                        UNION ALL
                        
                        -- 遞歸：所有下級代理
                        SELECT a.id, a.username, a.parent_id, a.rebate_percentage, d.depth + 1
                        FROM agents a
                        INNER JOIN downline d ON a.parent_id = d.id
                        WHERE d.depth < 10
                    ),
                    agent_stats AS (
                        SELECT 
                            d.id as agent_id,
                            d.username as agent_username,
                            d.rebate_percentage,
                            COALESCE(SUM(CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END), 0) as member_count,
                            COALESCE(SUM(bh.amount), 0) as bet_amount,
                            COALESCE(SUM(CASE WHEN bh.win = true THEN bh.win_amount ELSE 0 END), 0) as win_amount
                        FROM downline d
                        LEFT JOIN members m ON m.agent_id = d.id
                        LEFT JOIN bet_history bh ON bh.username = m.username 
                            AND DATE(bh.created_at) = $2
                        GROUP BY d.id, d.username, d.rebate_percentage
                    )
                    SELECT 
                        agent_id,
                        agent_username,
                        rebate_percentage,
                        member_count,
                        bet_amount,
                        win_amount,
                        bet_amount * rebate_percentage as earned_rebate_amount
                    FROM agent_stats
                    WHERE bet_amount > 0
                    ORDER BY agent_username
                `, [agent.id, today]);
                
                if (reportData.length > 0) {
                    console.log('代理名稱\t會員數\t下注金額\t輸贏金額\t退水%\t賺水金額');
                    console.log('-'.repeat(70));
                    
                    let totalBetAmount = 0;
                    let totalWinAmount = 0;
                    let totalEarnedRebate = 0;
                    
                    reportData.forEach(row => {
                        const earnedRebate = parseFloat(row.earned_rebate_amount);
                        totalBetAmount += parseFloat(row.bet_amount);
                        totalWinAmount += parseFloat(row.win_amount);
                        totalEarnedRebate += earnedRebate;
                        
                        console.log(
                            `${row.agent_username}\t${row.member_count}\t${row.bet_amount}\t${row.win_amount}\t${(row.rebate_percentage * 100).toFixed(1)}%\t${earnedRebate.toFixed(2)}`
                        );
                    });
                    
                    console.log('-'.repeat(70));
                    console.log(`總計\t\t${totalBetAmount.toFixed(2)}\t${totalWinAmount.toFixed(2)}\t\t${totalEarnedRebate.toFixed(2)}`);
                    
                    // 驗證賺水計算
                    const expectedEarnedRebate = totalBetAmount * agent.rebate_percentage;
                    console.log(`\n預期賺水 (${(agent.rebate_percentage * 100).toFixed(1)}%): ${expectedEarnedRebate.toFixed(2)}`);
                    
                    if (Math.abs(totalEarnedRebate - expectedEarnedRebate) < 0.01) {
                        console.log('✓ 賺水計算正確');
                    } else {
                        console.log('✗ 賺水計算異常');
                    }
                } else {
                    console.log('該代理今日無下注記錄');
                }
                
            } catch (error) {
                console.error(`查詢 ${agent.username} 報表失敗:`, error.message);
            }
        }
        
        // 3. 檢查實際退水分配
        console.log('\n\n3. 檢查今日退水分配記錄...');
        const rebateRecords = await db.any(`
            SELECT 
                tr.user_id,
                a.username as agent_username,
                a.level as agent_level,
                tr.amount as rebate_amount,
                tr.member_username,
                tr.bet_amount,
                tr.rebate_percentage,
                tr.period
            FROM transaction_records tr
            JOIN agents a ON tr.user_id = a.id AND tr.user_type = 'agent'
            WHERE tr.transaction_type = 'rebate'
            AND DATE(tr.created_at) = $1
            ORDER BY tr.created_at DESC
            LIMIT 20
        `, [today]);
        
        if (rebateRecords.length > 0) {
            console.log('找到', rebateRecords.length, '筆退水記錄:');
            console.log('總代理\t級別\t會員\t下注金額\t退水%\t退水金額');
            console.log('-'.repeat(70));
            
            rebateRecords.forEach(record => {
                console.log(
                    `${record.agent_username}\tL${record.agent_level}\t${record.member_username}\t${record.bet_amount}\t${(record.rebate_percentage * 100).toFixed(1)}%\t${record.rebate_amount}`
                );
            });
            
            // 驗證所有退水都給了總代理
            const nonTopAgentRebates = rebateRecords.filter(r => r.agent_level > 0);
            if (nonTopAgentRebates.length === 0) {
                console.log('\n✓ 所有退水都正確分配給總代理（L0）');
            } else {
                console.log('\n✗ 發現非總代理收到退水:', nonTopAgentRebates.length, '筆');
            }
        } else {
            console.log('今日無退水記錄');
        }
        
        console.log('\n=== 測試完成 ===');
        
    } catch (error) {
        console.error('測試失敗:', error);
    } finally {
        process.exit(0);
    }
}

// 執行測試
testAgentReports();