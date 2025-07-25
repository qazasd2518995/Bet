const { Client } = require('pg');

// 資料庫連接配置 (使用 Render PostgreSQL)
const dbConfig = {
    host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bet_game',
    user: 'bet_game_user',
    password: 'JK2EsOVnBkGEzgLp7cZ0OJQs4iWyRF9Q',
    ssl: {
        rejectUnauthorized: false
    }
};

async function testAgentDataSync() {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('🔗 連接到資料庫');
        
        // 1. 獲取 justin2025A 的完整資料
        const [justinData] = await connection.execute(
            'SELECT id, username, level, market_type, rebate_percentage, max_rebate_percentage FROM agents WHERE username = ?',
            ['justin2025A']
        );
        
        if (justinData.length === 0) {
            console.log('❌ 找不到 justin2025A');
            return;
        }
        
        console.log('\n📊 justin2025A 完整資料:');
        console.log(JSON.stringify(justinData[0], null, 2));
        
        // 2. 模擬前端 agents 陣列獲取（檢查後端 API 回傳的資料結構）
        console.log('\n🔍 模擬前端 agents 列表查詢:');
        const [agentsList] = await connection.execute(
            'SELECT id, username, level, market_type, status, rebate_percentage, max_rebate_percentage, parent_id, created_at FROM agents WHERE parent_id IS NULL OR parent_id = ? ORDER BY level, username',
            [justinData[0].id]
        );
        
        console.log('📋 代理列表 (前端應該看到的):');
        agentsList.forEach(agent => {
            console.log(`- ${agent.username}: rebate_percentage=${agent.rebate_percentage}, max_rebate_percentage=${agent.max_rebate_percentage}`);
        });
        
        // 3. 檢查前端切換代理時應該有的完整資料
        console.log('\n🔄 前端 currentManagingAgent 應該包含的欄位:');
        const requiredFields = ['id', 'username', 'level', 'market_type', 'rebate_percentage', 'max_rebate_percentage'];
        
        justinData.forEach(agent => {
            console.log(`\n${agent.username} 的資料完整性檢查:`);
            requiredFields.forEach(field => {
                const value = agent[field];
                const hasValue = value !== null && value !== undefined;
                console.log(`  - ${field}: ${value} ${hasValue ? '✅' : '❌ 缺失'}`);
            });
        });
        
        // 4. 檢查 availableMaxRebatePercentage 的計算邏輯
        console.log('\n🧮 availableMaxRebatePercentage 計算測試:');
        const justin = justinData[0];
        
        // 模擬前端計算邏輯
        console.log('\n原始資料:');
        console.log(`rebate_percentage: ${justin.rebate_percentage} (${typeof justin.rebate_percentage})`);
        console.log(`max_rebate_percentage: ${justin.max_rebate_percentage} (${typeof justin.max_rebate_percentage})`);
        
        // 測試 parseFloat 轉換
        const rebatePercentageFloat = parseFloat(justin.rebate_percentage);
        const maxRebatePercentageFloat = parseFloat(justin.max_rebate_percentage);
        const defaultRebate = justin.market_type === 'A' ? 0.011 : 0.041;
        
        console.log('\n轉換後:');
        console.log(`parseFloat(rebate_percentage): ${rebatePercentageFloat} (${isNaN(rebatePercentageFloat) ? '無效' : '有效'})`);
        console.log(`parseFloat(max_rebate_percentage): ${maxRebatePercentageFloat} (${isNaN(maxRebatePercentageFloat) ? '無效' : '有效'})`);
        
        // 前端計算邏輯
        let availableMaxRebatePercentage;
        if (!isNaN(rebatePercentageFloat) && rebatePercentageFloat > 0) {
            availableMaxRebatePercentage = rebatePercentageFloat;
            console.log(`✅ 使用 rebate_percentage: ${availableMaxRebatePercentage}`);
        } else if (!isNaN(maxRebatePercentageFloat) && maxRebatePercentageFloat > 0) {
            availableMaxRebatePercentage = maxRebatePercentageFloat;
            console.log(`⚠️ 回退到 max_rebate_percentage: ${availableMaxRebatePercentage}`);
        } else {
            availableMaxRebatePercentage = defaultRebate;
            console.log(`🔄 使用預設值: ${availableMaxRebatePercentage}`);
        }
        
        console.log(`\n🎯 最終 availableMaxRebatePercentage: ${availableMaxRebatePercentage}`);
        console.log(`前端顯示範圍應該是: 0% - ${(availableMaxRebatePercentage * 100).toFixed(1)}%`);
        
    } catch (error) {
        console.error('❌ 測試失敗:', error.message);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n📪 關閉資料庫連接');
        }
    }
}

// 執行測試
testAgentDataSync();
