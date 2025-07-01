// 限紅功能測試腳本
import axios from 'axios';

const AGENT_API_URL = 'http://localhost:3002/api';

async function testBettingLimits() {
    console.log('🚀 開始測試限紅功能...\n');
    
    try {
        // 1. 測試獲取限紅配置列表
        console.log('1️⃣ 測試獲取限紅配置列表...');
        const configsResponse = await axios.get(`${AGENT_API_URL}/betting-limit-configs`);
        console.log('✅ 限紅配置列表:', configsResponse.data.configs?.length || 0, '個配置');
        
        if (configsResponse.data.configs && configsResponse.data.configs.length > 0) {
            console.log('📋 可用的限紅等級:');
            configsResponse.data.configs.forEach(config => {
                console.log(`   - ${config.level_name}: ${config.level_display_name} (${config.description})`);
            });
        }
        console.log('');
        
        // 2. 測試根據用戶名獲取會員限紅設定
        console.log('2️⃣ 測試根據用戶名獲取會員限紅設定...');
        const testUsername = 'test123'; // 假設的測試用戶名
        try {
            const memberLimitResponse = await axios.get(`${AGENT_API_URL}/member-betting-limit-by-username?username=${testUsername}`);
            if (memberLimitResponse.data.success) {
                console.log('✅ 會員限紅設定:', memberLimitResponse.data.member);
                console.log('📊 當前限紅配置:', memberLimitResponse.data.config);
            } else {
                console.log('⚠️ 會員不存在或獲取失敗:', memberLimitResponse.data.message);
            }
        } catch (error) {
            console.log('⚠️ 測試會員不存在或API錯誤');
        }
        console.log('');
        
        // 3. 顯示限紅配置範例
        console.log('3️⃣ 限紅配置範例:');
        const exampleConfig = {
            "number": {"minBet": 1, "maxBet": 500, "periodLimit": 1000},
            "twoSide": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000},
            "sumValueSize": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000},
            "sumValueOddEven": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000},
            "sumValue": {"minBet": 1, "maxBet": 200, "periodLimit": 400},
            "dragonTiger": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000}
        };
        
        console.log('📝 新手限紅 (level1):');
        Object.entries(exampleConfig).forEach(([key, config]) => {
            console.log(`   ${formatBetTypeName(key)}: 單注最高 ${config.maxBet}元, 單期限額 ${config.periodLimit}元`);
        });
        console.log('');
        
        // 4. 顯示限紅驗證流程
        console.log('4️⃣ 限紅驗證流程:');
        console.log('🔍 投注時系統會:');
        console.log('   1. 根據用戶名獲取會員的限紅等級');
        console.log('   2. 查詢對應的限紅配置');
        console.log('   3. 驗證單注金額是否超過最高限制');
        console.log('   4. 檢查同期同類型投注累計是否超過單期限額');
        console.log('   5. 超過任一限制則拒絕投注');
        console.log('');
        
        console.log('✅ 限紅功能測試完成！');
        
    } catch (error) {
        console.error('❌ 測試過程中發生錯誤:', error.message);
        if (error.response) {
            console.error('響應錯誤:', error.response.status, error.response.data);
        }
    }
}

// 格式化投注類型名稱
function formatBetTypeName(key) {
    const names = {
        'number': '1-10車號',
        'twoSide': '兩面',
        'sumValueSize': '冠亞軍和大小',
        'sumValueOddEven': '冠亞軍和單雙',
        'sumValue': '冠亞軍和',
        'dragonTiger': '龍虎'
    };
    return names[key] || key;
}

// 運行測試
testBettingLimits();

export { testBettingLimits }; 