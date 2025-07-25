import axios from 'axios';

const AGENT_BASE_URL = 'http://localhost:3003';
const GAME_BASE_URL = 'http://localhost:3000';

const TEST_USER = { username: 'ti2025A', password: 'ti2025A' };

async function quickTest() {
    try {
        console.log('=== 快速输赢控制测试 ===');
        
        // 1. 测试代理服务器连接
        console.log('1. 测试代理服务器连接...');
        try {
            const healthResponse = await axios.get(`${AGENT_BASE_URL}/api/dashboard/stats`);
            console.log('✓ 代理服务器连接正常');
        } catch (error) {
            console.log(`⚠️  代理服务器健康检查失败，但继续测试: ${error.response?.status || error.message}`);
            // 不返回，继续执行测试
        }

        // 2. 测试游戏服务器连接
        console.log('2. 测试游戏服务器连接...');
        try {
            const gameResponse = await axios.get(`${GAME_BASE_URL}/api/game/current`);
            console.log('✓ 游戏服务器连接正常');
        } catch (error) {
            console.log(`✗ 游戏服务器连接失败: ${error.message}`);
        }

        // 3. 测试代理登录
        console.log('3. 测试代理登录...');
        try {
            const loginResponse = await axios.post(`${AGENT_BASE_URL}/api/agent/login`, TEST_USER);
            if (loginResponse.data.success) {
                console.log('✓ 代理登录成功');
                const token = loginResponse.data.sessionToken || loginResponse.data.token;
                
                // 4. 测试输赢控制API
                console.log('4. 测试输赢控制API...');
                const headers = { Authorization: `Bearer ${token}` };
                
                // 测试获取代理列表
                try {
                    const agentsResponse = await axios.get(`${AGENT_BASE_URL}/api/agent/win-loss-control/agents`, { headers });
                    console.log(`✓ 获取代理列表成功: ${agentsResponse.data.data?.length || 0} 个代理`);
                } catch (error) {
                    console.log(`✗ 获取代理列表失败: ${error.response?.status} ${error.response?.data?.error || error.message}`);
                }

                // 测试获取会员列表
                try {
                    const membersResponse = await axios.get(`${AGENT_BASE_URL}/api/agent/win-loss-control/members`, { headers });
                    console.log(`✓ 获取会员列表成功: ${membersResponse.data.data?.length || 0} 个会员`);
                } catch (error) {
                    console.log(`✗ 获取会员列表失败: ${error.response?.status} ${error.response?.data?.error || error.message}`);
                }

                // 测试获取当前期数
                try {
                    const periodResponse = await axios.get(`${AGENT_BASE_URL}/api/agent/win-loss-control/current-period`, { headers });
                    console.log(`✓ 获取当前期数成功: ${periodResponse.data.data?.current_period}`);
                } catch (error) {
                    console.log(`✗ 获取当前期数失败: ${error.response?.status} ${error.response?.data?.error || error.message}`);
                }

                // 测试创建控制设定
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
                        console.log('✓ 创建控制设定成功');
                        
                        // 清理测试数据
                        const controlId = createResponse.data.control.id;
                        await axios.delete(`${AGENT_BASE_URL}/api/agent/win-loss-control/${controlId}`, { headers });
                        console.log('✓ 清理测试数据成功');
                    }
                } catch (error) {
                    console.log(`✗ 创建控制设定失败: ${error.response?.status} ${error.response?.data?.error || error.message}`);
                }

                console.log('\n=== 测试结果 ===');
                console.log('✓ 基本功能测试完成');
                console.log('📋 如需详细测试，请使用浏览器打开：');
                console.log(`   代理管理：http://localhost:3003`);
                console.log(`   会员游戏：http://localhost:3000`);
                
            } else {
                console.log('✗ 代理登录失败');
            }
        } catch (error) {
            console.log(`✗ 代理登录失败: ${error.response?.status} ${error.response?.data?.error || error.message}`);
        }

    } catch (error) {
        console.error('测试过程中发生错误:', error.message);
    }
}

quickTest(); 