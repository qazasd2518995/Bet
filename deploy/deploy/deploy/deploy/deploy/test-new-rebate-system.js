// 測試新的退水系統
import db from './db/config.js';

async function testNewRebateSystem() {
    console.log('========================================');
    console.log('🧪 測試新退水系統');
    console.log('========================================\n');
    
    try {
        // 1. 查找測試數據
        console.log('1️⃣ 查找測試代理鏈...');
        const testMember = await db.oneOrNone(`
            SELECT m.*, a.username as agent_username, a.market_type 
            FROM members m 
            JOIN agents a ON m.agent_id = a.id 
            ORDER BY m.created_at DESC
            LIMIT 1
        `);
        
        if (!testMember) {
            console.log('❌ 找不到任何會員');
            return;
        }
        
        console.log(`✓ 找到測試會員: ${testMember.username}`);
        console.log(`  代理: ${testMember.agent_username} (${testMember.market_type}盤)`);
        
        // 2. 獲取完整代理鏈
        console.log('\n2️⃣ 獲取代理鏈...');
        const agentChain = await db.any(`
            WITH RECURSIVE agent_chain AS (
                SELECT id, username, parent_id, rebate_percentage, market_type, 0 as level
                FROM agents 
                WHERE id = $1
                
                UNION ALL
                
                SELECT a.id, a.username, a.parent_id, a.rebate_percentage, a.market_type, ac.level + 1
                FROM agents a
                JOIN agent_chain ac ON a.id = ac.parent_id
                WHERE ac.level < 10
            )
            SELECT * FROM agent_chain ORDER BY level DESC
        `, [testMember.agent_id]);
        
        console.log(`✓ 代理鏈 (${agentChain.length} 層):`);
        agentChain.forEach((agent, index) => {
            console.log(`  ${index === 0 ? '總代理' : `L${agent.level}`}: ${agent.username} (退水: ${(agent.rebate_percentage * 100).toFixed(1)}%)`);
        });
        
        const topAgent = agentChain[0];
        console.log(`\n📍 總代理: ${topAgent.username}`);
        
        // 3. 模擬下注並計算退水
        console.log('\n3️⃣ 模擬下注並計算退水...');
        const betAmount = 1000;
        const marketType = topAgent.market_type || 'D';
        const rebatePercentage = marketType === 'A' ? 0.011 : 0.041;
        const rebateAmount = Math.round(betAmount * rebatePercentage * 100) / 100;
        
        console.log(`✓ 下注金額: ${betAmount}`);
        console.log(`✓ 盤口類型: ${marketType}盤`);
        console.log(`✓ 退水比例: ${(rebatePercentage * 100).toFixed(1)}%`);
        console.log(`✓ 退水金額: ${rebateAmount}`);
        console.log(`✓ 退水將全部給總代理: ${topAgent.username}`);
        
        // 4. 檢查最近的退水記錄
        console.log('\n4️⃣ 檢查最近的退水記錄...');
        const recentRebates = await db.any(`
            SELECT tr.*, a.username as agent_username 
            FROM transaction_records tr
            JOIN agents a ON tr.user_id = a.id
            WHERE tr.transaction_type = 'rebate' 
            AND tr.user_type = 'agent'
            AND tr.period IS NOT NULL
            ORDER BY tr.created_at DESC 
            LIMIT 5
        `);
        
        if (recentRebates.length > 0) {
            console.log(`✓ 最近 ${recentRebates.length} 筆退水記錄:`);
            recentRebates.forEach(record => {
                const desc = record.description || '';
                const marketMatch = desc.match(/([AD])盤/);
                const percentMatch = desc.match(/([\d.]+)%/);
                console.log(`  ${record.agent_username}: ${record.amount} 元 (${marketMatch ? marketMatch[1] : '?'}盤 ${percentMatch ? percentMatch[1] : '?'}%) - ${new Date(record.created_at).toLocaleString()}`);
            });
        } else {
            console.log('❌ 沒有找到退水記錄');
        }
        
        // 5. 檢查代理報表顯示
        console.log('\n5️⃣ 檢查代理報表顯示邏輯...');
        console.log('✓ 新邏輯說明:');
        console.log('  - 退水設定只影響報表顯示');
        console.log('  - 代理的賺水顯示 = 該代理的退水設定百分比 × 下注金額');
        console.log('  - 會員的賺水顯示 = 0 (會員沒有退水設定)');
        console.log('  - 這些數據僅供代理查看和手動分配退水使用');
        
        // 6. 查詢某個代理的報表數據範例
        const sampleAgent = await db.oneOrNone(`
            SELECT * FROM agents 
            WHERE rebate_percentage > 0 
            AND parent_id IS NOT NULL 
            ORDER BY created_at DESC 
            LIMIT 1
        `);
        
        if (sampleAgent) {
            console.log(`\n✓ 範例代理: ${sampleAgent.username}`);
            console.log(`  退水設定: ${(sampleAgent.rebate_percentage * 100).toFixed(1)}%`);
            
            const betStats = await db.oneOrNone(`
                SELECT 
                    COUNT(*) as bet_count,
                    COALESCE(SUM(amount), 0) as total_bet
                FROM bet_history 
                WHERE username IN (
                    SELECT username FROM members WHERE agent_id = $1
                )
            `, [sampleAgent.id]);
            
            if (betStats && parseFloat(betStats.total_bet) > 0) {
                const earnedRebate = parseFloat(betStats.total_bet) * sampleAgent.rebate_percentage;
                console.log(`  下注總額: ${betStats.total_bet}`);
                console.log(`  報表顯示賺水: ${earnedRebate.toFixed(2)} 元`);
            }
        }
        
        console.log('\n✅ 測試完成！');
        
    } catch (error) {
        console.error('❌ 測試失敗:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行測試
testNewRebateSystem();