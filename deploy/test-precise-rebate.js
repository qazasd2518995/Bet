import pkg from 'pg-promise';
const pgp = pkg();
const db = pgp({
    connectionString: 'postgresql://bet_db_sldl_user:iAT91cS1Cl1tWANmgp3vLNarADrTNvKh@dpg-ct6go256l47c738ju4kg-a.oregon-postgres.render.com/bet_db_sldl?ssl=true',
    ssl: { rejectUnauthorized: false }
});

async function testPreciseRebate() {
    console.log('=== 測試精確退水比例 ===\n');
    
    try {
        // 1. 測試 JavaScript 浮點數精度
        console.log('1. JavaScript 浮點數精度測試：');
        const testValues = [0.89, 0.9, 0.1, 0.01, 0.001];
        for (const val of testValues) {
            const percentage = val / 100;
            console.log(`   ${val}% = ${percentage} (精確值)`);
        }
        
        // 2. 查找一個退水為 0.89% 的代理
        console.log('\n2. 查找退水為 0.89% 的代理：');
        const agent089 = await db.oneOrNone(`
            SELECT id, username, rebate_percentage, max_rebate_percentage, level
            FROM agents
            WHERE rebate_percentage = 0.0089 AND status = 1
            LIMIT 1
        `);
        
        if (agent089) {
            console.log(`   找到代理: ${agent089.username}`);
            console.log(`   退水: ${agent089.rebate_percentage} (${agent089.rebate_percentage * 100}%)`);
            console.log(`   最大退水: ${agent089.max_rebate_percentage} (${agent089.max_rebate_percentage * 100}%)`);
            
            // 查看其下級代理
            const childAgents = await db.any(`
                SELECT id, username, rebate_percentage, max_rebate_percentage
                FROM agents
                WHERE parent_id = $1 AND status = 1
            `, [agent089.id]);
            
            console.log(`\n   下級代理狀況：`);
            for (const child of childAgents) {
                console.log(`     - ${child.username}: 退水=${child.rebate_percentage * 100}%, max=${child.max_rebate_percentage * 100}%`);
                
                // 檢查是否可以設定為 0.9%
                if (child.max_rebate_percentage >= 0.009) {
                    console.log(`       ⚠️  此代理的 max_rebate_percentage 允許設定 0.9%`);
                    console.log(`       但上級只有 0.89%，應該無法設定`);
                }
            }
        } else {
            console.log('   未找到退水為 0.89% 的代理');
        }
        
        // 3. 測試比較邏輯
        console.log('\n3. 測試比較邏輯：');
        const parentRebate = 0.0089; // 0.89%
        const testRebate = 0.009;    // 0.9%
        
        console.log(`   上級退水: ${parentRebate} (${parentRebate * 100}%)`);
        console.log(`   測試退水: ${testRebate} (${testRebate * 100}%)`);
        console.log(`   testRebate > parentRebate: ${testRebate > parentRebate}`);
        console.log(`   差異: ${testRebate - parentRebate}`);
        
        // 4. 模擬驗證邏輯
        console.log('\n4. 模擬驗證邏輯：');
        const maxRebatePercentage = 0.0089;
        const inputRebate = 0.009;
        
        if (inputRebate > maxRebatePercentage) {
            console.log(`   ❌ 驗證失敗: ${inputRebate} > ${maxRebatePercentage}`);
            console.log(`   錯誤訊息: 退水比例必須在 0% - ${maxRebatePercentage * 100}% 之間`);
        } else {
            console.log(`   ✅ 驗證通過`);
        }
        
    } catch (error) {
        console.error('測試過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

testPreciseRebate();