import axios from 'axios';

const AGENT_BASE_URL = 'http://localhost:3003';
const GAME_BASE_URL = 'http://localhost:3000';

const TEST_USER = { username: 'ti2025A', password: 'ti2025A' };

async function quickTest() {
    try {
        console.log('=== 快速輸贏控制測試 ===');
        
        // 1. 測試代理服務器連接
        console.log('1. 測試代理服務器連接...');
        try {
            const healthResponse = await axios.get(`${AGENT_BASE_URL}/api/dashboard/stats`);
            console.log('✓ 代理服務器連接正常');
        } catch (error) {
            console.log(`⚠️  代理服務器健康檢查失敗，但繼續測試: ${error.response?.status || error.message}`);
            // 不返回，繼續執行測試
        }

        // 2. 測試遊戲服務器連接
        console.log('2. 測試遊戲服務器連接...');
        try {
            const gameResponse = await axios.get(`${GAME_BASE_URL}/api/game/current`);
            console.log('✓ 遊戲服務器連接正常');
        } catch (error) {
            console.log(`✗ 遊戲服務器連接失敗: ${error.message}`);
        }

        // 3. 測試代理登錄
        console.log('3. 測試代理登錄...');
        try {
            const loginResponse = await axios.post(`${AGENT_BASE_URL}/api/agent/login`, TEST_USER);
            if (loginResponse.data.success) {
                console.log('✓ 代理登錄成功');
                const token = loginResponse.data.sessionToken || loginResponse.data.token;
                
                // 4. 測試輸贏控制API
                console.log('4. 測試輸贏控制API...');
                const headers = { Authorization: `Bearer ${token}` };
                
                // 測試獲取代理列表
                try {
                    const agentsResponse = await axios.get(`${AGENT_BASE_URL}/api/agent/win-loss-control/agents`, { headers });
                    console.log(`✓ 獲取代理列表成功: ${agentsResponse.data.data?.length || 0} 個代理`);
                } catch (error) {
                    console.log(`✗ 獲取代理列表失敗: ${error.response?.status} ${error.response?.data?.error || error.message}`);
                }

                // 測試獲取會員列表
                try {
                    const membersResponse = await axios.get(`${AGENT_BASE_URL}/api/agent/win-loss-control/members`, { headers });
                    console.log(`✓ 獲取會員列表成功: ${membersResponse.data.data?.length || 0} 個會員`);
                } catch (error) {
                    console.log(`✗ 獲取會員列表失敗: ${error.response?.status} ${error.response?.data?.error || error.message}`);
                }

                // 測試獲取當前期數
                try {
                    const periodResponse = await axios.get(`${AGENT_BASE_URL}/api/agent/win-loss-control/current-period`, { headers });
                    console.log(`✓ 獲取當前期數成功: ${periodResponse.data.data?.current_period}`);
                } catch (error) {
                    console.log(`✗ 獲取當前期數失敗: ${error.response?.status} ${error.response?.data?.error || error.message}`);
                }

                // 測試創建控制設定
                try {
                    const createData = {
                        mode: 'normal',
                        target_type: 'none',
                        target_username: '',
                        control_type: 'win',
                        intensity: 1,
                        start_period: 999999
                    };
                    
                    const createResponse = await axios.post(`${AGENT_BASE_URL}/api/agent/win-loss-control`, createData, { headers });
                    if (createResponse.data.success) {
                        console.log('✓ 創建控制設定成功');
                        
                        // 清理測試數據
                        const controlId = createResponse.data.control.id;
                        await axios.delete(`${AGENT_BASE_URL}/api/agent/win-loss-control/${controlId}`, { headers });
                        console.log('✓ 清理測試數據成功');
                    }
                } catch (error) {
                    console.log(`✗ 創建控制設定失敗: ${error.response?.status} ${error.response?.data?.error || error.message}`);
                }

                console.log('\n=== 測試結果 ===');
                console.log('✓ 基本功能測試完成');
                console.log('📋 如需詳細測試，請使用瀏覽器打開：');
                console.log(`   代理管理：http://localhost:3003`);
                console.log(`   會員遊戲：http://localhost:3000`);
                
            } else {
                console.log('✗ 代理登錄失敗');
            }
        } catch (error) {
            console.log(`✗ 代理登錄失敗: ${error.response?.status} ${error.response?.data?.error || error.message}`);
        }

    } catch (error) {
        console.error('測試過程中發生錯誤:', error.message);
    }
}

quickTest(); 