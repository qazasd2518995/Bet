import axios from 'axios';

// Render環境URL（請替換為您的實際URL）
const RENDER_GAME_URL = 'https://bet-game.onrender.com'; // 替換為您的遊戲後端URL
const RENDER_AGENT_URL = 'https://bet-agent.onrender.com'; // 替換為您的代理後端URL

async function testRenderAPI() {
    console.log('🧪 測試Render環境A盤D盤API...\n');
    
    try {
        // 1. 測試代理系統API - 直接檢查用戶盤口
        console.log('1️⃣ 測試代理系統API...');
        
        try {
            const agentResponse = await axios.get(`${RENDER_AGENT_URL}/api/agent/member/info/titi`);
            if (agentResponse.data.success) {
                const member = agentResponse.data.member;
                console.log(`✅ 代理系統: 用戶titi盤口類型: ${member.market_type}`);
            } else {
                console.log('❌ 代理系統: 獲取用戶信息失敗');
            }
        } catch (error) {
            console.log(`❌ 代理系統連接失敗: ${error.message}`);
        }
        
        // 2. 測試遊戲後端API - 不帶用戶名（應該返回D盤默認）
        console.log('\n2️⃣ 測試遊戲API（無用戶名）...');
        
        try {
            const gameResponse = await axios.get(`${RENDER_GAME_URL}/api/game-data`);
            if (gameResponse.data) {
                const { odds, marketType } = gameResponse.data;
                console.log(`📊 無用戶名請求:`);
                console.log(`   └─ 返回盤口: ${marketType || '未返回'}`);
                console.log(`   └─ 單號賠率: ${odds.number.first}`);
                console.log(`   └─ 兩面賠率: ${odds.champion.big}`);
            }
        } catch (error) {
            console.log(`❌ 遊戲API連接失敗: ${error.message}`);
        }
        
        // 3. 測試遊戲後端API - 帶A盤用戶名
        console.log('\n3️⃣ 測試遊戲API（A盤用戶titi）...');
        
        try {
            const gameResponseA = await axios.get(`${RENDER_GAME_URL}/api/game-data?username=titi`);
            if (gameResponseA.data) {
                const { odds, marketType } = gameResponseA.data;
                console.log(`📊 A盤用戶titi:`);
                console.log(`   └─ 返回盤口: ${marketType || '未返回'}`);
                console.log(`   └─ 單號賠率: ${odds.number.first}`);
                console.log(`   └─ 兩面賠率: ${odds.champion.big}`);
                
                // 驗證賠率
                if (odds.number.first === 9.89 && odds.champion.big === 1.9) {
                    console.log(`   ✅ A盤賠率正確！`);
                } else {
                    console.log(`   ❌ A盤賠率錯誤，期望9.89/1.9`);
                }
            }
        } catch (error) {
            console.log(`❌ 遊戲API（A盤用戶）連接失敗: ${error.message}`);
        }
        
        // 4. 測試遊戲後端API - 帶D盤用戶名
        console.log('\n4️⃣ 測試遊戲API（D盤用戶memberD1）...');
        
        try {
            const gameResponseD = await axios.get(`${RENDER_GAME_URL}/api/game-data?username=memberD1`);
            if (gameResponseD.data) {
                const { odds, marketType } = gameResponseD.data;
                console.log(`📊 D盤用戶memberD1:`);
                console.log(`   └─ 返回盤口: ${marketType || '未返回'}`);
                console.log(`   └─ 單號賠率: ${odds.number.first}`);
                console.log(`   └─ 兩面賠率: ${odds.champion.big}`);
                
                // 驗證賠率
                if (odds.number.first === 9.59 && odds.champion.big === 1.88) {
                    console.log(`   ✅ D盤賠率正確！`);
                } else {
                    console.log(`   ❌ D盤賠率錯誤，期望9.59/1.88`);
                }
            }
        } catch (error) {
            console.log(`❌ 遊戲API（D盤用戶）連接失敗: ${error.message}`);
        }
        
        console.log('\n📋 Render環境測試總結:');
        console.log('   如果看到A盤賠率9.89/1.9則表示動態賠率功能正常');
        console.log('   如果看到D盤賠率9.59/1.88則表示默認配置正常');
        console.log('   如果API連接失敗，可能需要等待Render部署完成');
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error.message);
    }
}

// 執行測試
testRenderAPI(); 