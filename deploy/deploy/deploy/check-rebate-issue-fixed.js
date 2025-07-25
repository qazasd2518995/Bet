// 檢查退水問題 - 修正版
import db from './db/config.js';

async function checkRebateIssue() {
    console.log('🔍 檢查退水問題...\n');
    
    try {
        // 1. 檢查會員代理關係
        console.log('=== 1. 檢查 justin111 的代理關係 ===');
        const memberInfo = await db.oneOrNone(`
            SELECT 
                m.username,
                m.agent_id,
                a.username as agent_username,
                a.level as agent_level,
                a.rebate_percentage,
                a.market_type,
                a.balance as agent_balance
            FROM members m
            JOIN agents a ON m.agent_id = a.id
            WHERE m.username = 'justin111'
        `);
        
        if (memberInfo) {
            console.log(`會員: ${memberInfo.username}`);
            console.log(`直屬代理: ${memberInfo.agent_username} (ID: ${memberInfo.agent_id})`);
            console.log(`代理層級: ${memberInfo.agent_level}`);
            console.log(`代理退水: ${(parseFloat(memberInfo.rebate_percentage) * 100).toFixed(1)}%`);
            console.log(`盤口類型: ${memberInfo.market_type}`);
            console.log(`代理餘額: ${memberInfo.agent_balance}`);
            
            // 檢查為什麼退水比例只有 0.5%
            if (memberInfo.market_type === 'A' && parseFloat(memberInfo.rebate_percentage) < 0.011) {
                console.log('\n❗ 問題發現: A盤代理退水比例只有 0.5%，應該至少有 1.1%');
            }
        }
        
        // 2. 檢查最近結算的期號是否有處理退水
        console.log('\n=== 2. 檢查最近結算期號的退水處理 ===');
        const recentSettledBets = await db.any(`
            SELECT 
                DISTINCT period,
                COUNT(*) as bet_count,
                SUM(amount) as total_amount
            FROM bet_history 
            WHERE username = 'justin111' 
            AND settled = true
            AND created_at > NOW() - INTERVAL '24 hours'
            GROUP BY period
            ORDER BY period DESC
            LIMIT 5
        `);
        
        console.log(`最近24小時內 justin111 的已結算期號:`);
        for (const record of recentSettledBets) {
            console.log(`期號: ${record.period}, 注單數: ${record.bet_count}, 總金額: ${record.total_amount}`);
            
            // 檢查這期是否有退水記錄
            const rebateRecord = await db.oneOrNone(`
                SELECT * FROM transaction_records 
                WHERE transaction_type = 'rebate' 
                AND reason LIKE '%${record.period}%'
                AND agent_username = 'justin2025A'
                LIMIT 1
            `);
            
            if (rebateRecord) {
                console.log(`  ✅ 找到退水記錄: ${rebateRecord.rebate_amount}元`);
            } else {
                console.log(`  ❌ 沒有找到退水記錄`);
            }
        }
        
        // 3. 計算預期的退水金額
        console.log('\n=== 3. 計算預期的退水金額 ===');
        if (memberInfo && memberInfo.market_type === 'A') {
            const betAmount = 1000;
            const expectedRebatePool = betAmount * 0.011; // A盤 1.1%
            const agentRebatePercentage = parseFloat(memberInfo.rebate_percentage);
            const expectedAgentRebate = betAmount * agentRebatePercentage;
            
            console.log(`下注金額: ${betAmount}元`);
            console.log(`A盤退水池: ${expectedRebatePool.toFixed(2)}元 (1.1%)`);
            console.log(`代理退水比例: ${(agentRebatePercentage * 100).toFixed(1)}%`);
            console.log(`代理應得退水: ${expectedAgentRebate.toFixed(2)}元`);
            
            if (agentRebatePercentage < 0.011) {
                console.log(`\n❗ 問題: 代理退水比例(${(agentRebatePercentage * 100).toFixed(1)}%)低於A盤標準(1.1%)`);
                console.log(`這表示代理只能拿到部分退水，上級代理會拿到差額`);
            }
        }
        
        // 4. 檢查退水是否在結算時被調用
        console.log('\n=== 4. 診斷結果 ===');
        console.log('發現的問題:');
        console.log('1. justin2025A 的退水比例只有 0.5%，而不是 A盤標準的 1.1%');
        console.log('2. 這表示 justin2025A 只能獲得下注金額的 0.5% 作為退水');
        console.log('3. 剩餘的 0.6% (1.1% - 0.5%) 會分配給上級代理');
        console.log('\n解決方案:');
        console.log('1. 如果要讓 justin2025A 獲得全部退水，需要將其退水比例設置為 1.1%');
        console.log('2. 或者檢查上級代理是否收到了剩餘的 0.6% 退水');
        
        // 5. 查找 justin2025A 的上級代理
        console.log('\n=== 5. 檢查代理鏈 ===');
        const agentChain = await db.any(`
            WITH RECURSIVE agent_tree AS (
                SELECT id, username, parent_id, level, rebate_percentage, market_type, 0 as depth
                FROM agents WHERE username = 'justin2025A'
                
                UNION ALL
                
                SELECT a.id, a.username, a.parent_id, a.level, a.rebate_percentage, a.market_type, at.depth + 1
                FROM agents a
                JOIN agent_tree at ON a.id = at.parent_id
            )
            SELECT * FROM agent_tree ORDER BY depth
        `);
        
        console.log('代理鏈:');
        agentChain.forEach(agent => {
            const indent = '  '.repeat(agent.depth);
            console.log(`${indent}${agent.username} (L${agent.level}, ${(parseFloat(agent.rebate_percentage) * 100).toFixed(1)}%)`);
        });
        
    } catch (error) {
        console.error('檢查時發生錯誤:', error);
    } finally {
        process.exit(0);
    }
}

checkRebateIssue();