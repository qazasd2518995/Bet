// check-rebate-logic.js - 檢查退水邏輯
import db from './db/config.js';

async function checkRebateLogic() {
    console.log('🔍 檢查退水邏輯...\n');
    
    try {
        // 1. 檢查 justin111 的代理鏈
        console.log('1️⃣ 檢查 justin111 的代理鏈:');
        const member = await db.oneOrNone(`
            SELECT m.*, a.username as agent_username, a.market_type
            FROM members m
            LEFT JOIN agents a ON m.agent_id = a.id
            WHERE m.username = 'justin111'
        `);
        
        if (member) {
            console.log(`會員: ${member.username}`);
            console.log(`代理: ${member.agent_username}`);
            console.log(`盤口: ${member.market_type}`);
            console.log(`餘額: ${member.balance}`);
        }
        
        // 2. 檢查最近的退水記錄
        console.log('\n2️⃣ 檢查最近的退水記錄:');
        const rebateRecords = await db.any(`
            SELECT * FROM transaction_records
            WHERE transaction_type = 'rebate'
            AND created_at > NOW() - INTERVAL '1 hour'
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        if (rebateRecords.length > 0) {
            console.log(`找到 ${rebateRecords.length} 筆退水記錄:`);
            rebateRecords.forEach(rec => {
                console.log(`  ${rec.created_at.toLocaleTimeString()}: ${rec.user_type} ${rec.description}, 金額: ${rec.amount}`);
            });
        } else {
            console.log('沒有找到退水記錄');
        }
        
        // 3. 檢查代理的退水比例設定
        console.log('\n3️⃣ 檢查代理退水比例設定:');
        const agents = await db.any(`
            SELECT 
                a.username,
                a.level,
                a.rebate_percentage,
                a.market_type,
                a.rebate_mode,
                ar.member_rebate_percentage
            FROM agents a
            LEFT JOIN agent_rebate_settings ar ON a.id = ar.agent_id
            WHERE a.id IN (
                SELECT agent_id FROM members WHERE username = 'justin111'
                UNION
                SELECT parent_id FROM agents WHERE id IN (
                    SELECT agent_id FROM members WHERE username = 'justin111'
                )
            )
            ORDER BY a.level
        `);
        
        if (agents.length > 0) {
            console.log('代理鏈退水設定:');
            agents.forEach(agent => {
                console.log(`\n代理: ${agent.username} (層級 ${agent.level})`);
                console.log(`  盤口: ${agent.market_type}`);
                console.log(`  代理退水: ${(agent.rebate_percentage * 100).toFixed(1)}%`);
                console.log(`  會員退水: ${agent.member_rebate_percentage ? (agent.member_rebate_percentage * 100).toFixed(1) + '%' : '未設定'}`);
                console.log(`  退水模式: ${agent.rebate_mode || '未設定'}`);
            });
        }
        
        // 4. 測試計算退水
        console.log('\n4️⃣ 測試計算退水:');
        const testBetAmount = 900;
        const marketType = member?.market_type || 'A';
        const rebatePercentage = marketType === 'A' ? 0.011 : 0.041;
        const expectedRebate = testBetAmount * rebatePercentage;
        
        console.log(`下注金額: ${testBetAmount}`);
        console.log(`盤口類型: ${marketType}`);
        console.log(`退水比例: ${(rebatePercentage * 100).toFixed(1)}%`);
        console.log(`預期退水: ${expectedRebate.toFixed(2)} 元`);
        
        // 5. 檢查結算時是否有給會員退水
        console.log('\n5️⃣ 檢查結算邏輯:');
        console.log('根據代碼分析：');
        console.log('- distributeRebate 函數只分配退水給代理，不給會員');
        console.log('- 會員的退水應該在結算時直接加到餘額中');
        console.log('- 需要檢查 improvedSettleBets 函數是否有處理會員退水');
        
    } catch (error) {
        console.error('❌ 檢查過程中發生錯誤:', error);
    }
}

// 執行
checkRebateLogic()
    .then(() => {
        console.log('\n檢查完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('執行失敗:', error);
        process.exit(1);
    });