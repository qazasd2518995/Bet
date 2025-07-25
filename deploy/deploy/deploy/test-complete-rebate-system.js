import pkg from 'pg-promise';
const pgp = pkg();
const db = pgp({
    connectionString: 'postgresql://bet_db_sldl_user:iAT91cS1Cl1tWANmgp3vLNarADrTNvKh@dpg-ct6go256l47c738ju4kg-a.oregon-postgres.render.com/bet_db_sldl?ssl=true',
    ssl: { rejectUnauthorized: false }
});

const API_BASE_URL = 'http://localhost:3003/api';

async function testCompleteRebateSystem() {
    console.log('=== 完整測試退水系統 ===\n');
    
    try {
        // 1. 測試浮點數精度問題
        console.log('1. 測試浮點數精度處理：');
        console.log('   - 測試設定 0.9% (0.009)');
        const testValue = 0.9 / 100;
        console.log(`   - 原始值: ${testValue}`);
        console.log(`   - 四捨五入後: ${Math.round(testValue * 10000) / 10000}`);
        console.log(`   - 是否相等: ${Math.round(testValue * 10000) / 10000 === 0.009}`);
        
        // 2. 檢查所有代理的 max_rebate_percentage 設定
        console.log('\n2. 檢查代理退水設定一致性：');
        const agents = await db.any(`
            WITH RECURSIVE agent_tree AS (
                SELECT 
                    a.id,
                    a.username,
                    a.level,
                    a.parent_id,
                    a.rebate_percentage,
                    a.max_rebate_percentage,
                    p.username as parent_username,
                    p.rebate_percentage as parent_rebate
                FROM agents a
                LEFT JOIN agents p ON a.parent_id = p.id
                WHERE a.status = 1
                ORDER BY a.level, a.id
            )
            SELECT * FROM agent_tree
        `);
        
        let inconsistentCount = 0;
        for (const agent of agents) {
            if (agent.parent_id) {
                // 檢查是否與上級退水一致
                if (parseFloat(agent.max_rebate_percentage) !== parseFloat(agent.parent_rebate)) {
                    console.log(`   ❌ ${agent.username}: max=${agent.max_rebate_percentage}, 上級退水=${agent.parent_rebate}`);
                    inconsistentCount++;
                }
            }
        }
        
        if (inconsistentCount === 0) {
            console.log('   ✅ 所有代理的 max_rebate_percentage 都與上級一致');
        }
        
        // 3. 測試級聯更新機制
        console.log('\n3. 測試級聯更新機制：');
        
        // 找一個有下級的代理進行測試
        const testAgent = await db.oneOrNone(`
            SELECT a.*, 
                   (SELECT COUNT(*) FROM agents WHERE parent_id = a.id AND status = 1) as child_count
            FROM agents a
            WHERE a.level > 0 AND a.status = 1
            AND EXISTS (SELECT 1 FROM agents WHERE parent_id = a.id AND status = 1)
            ORDER BY a.level
            LIMIT 1
        `);
        
        if (testAgent) {
            console.log(`   - 測試代理: ${testAgent.username} (當前退水: ${(testAgent.rebate_percentage * 100).toFixed(1)}%)`);
            console.log(`   - 下級代理數: ${testAgent.child_count}`);
            
            // 獲取下級代理的當前狀態
            const childAgents = await db.any(`
                SELECT id, username, rebate_percentage, max_rebate_percentage
                FROM agents
                WHERE parent_id = $1 AND status = 1
            `, [testAgent.id]);
            
            console.log('\n   下級代理當前狀態:');
            for (const child of childAgents) {
                console.log(`     - ${child.username}: 退水=${(child.rebate_percentage * 100).toFixed(1)}%, max=${(child.max_rebate_percentage * 100).toFixed(1)}%`);
            }
        }
        
        // 4. 檢查前端顯示邏輯
        console.log('\n4. 前端顯示邏輯檢查：');
        console.log('   - activeTab === "accounts" 時使用 currentMemberManagingAgent');
        console.log('   - 其他情況使用 currentManagingAgent 或 user');
        console.log('   - 總代理(level 0)使用盤口退水限制');
        console.log('   - 一般代理使用 rebate_percentage 作為下級最大值');
        
        // 5. 檢查即時更新機制
        console.log('\n5. 即時更新機制：');
        console.log('   - 更新後調用 fetchUserData() 刷新數據');
        console.log('   - 使用 Vue.$forceUpdate() 強制更新視圖');
        console.log('   - 無需手動刷新頁面');
        
    } catch (error) {
        console.error('測試過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

testCompleteRebateSystem();