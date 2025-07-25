const axios = require('axios');

// Render 環境的API地址
const GAME_API_URL = 'https://bet-game-vcje.onrender.com';
const AGENT_API_URL = 'https://bet-agent.onrender.com';

async function checkRenderRebateIssue() {
    console.log('🔍 檢查 Render 環境中 justin2025A 的退水問題...\n');
    
    // 1. 檢查期數20250702503是否已結算
    console.log('1️⃣ 檢查期數20250702503是否已結算...');
    try {
        const historyResponse = await axios.get(`${GAME_API_URL}/api/history?period=20250702503`);
        
        if (historyResponse.data.success && historyResponse.data.results.length > 0) {
            const result = historyResponse.data.results[0];
            console.log(`✅ 期數20250702503已結算: 冠軍=${result.first}`);
            console.log(`   開獎結果: [${result.first}, ${result.second}, ${result.third}, ${result.fourth}, ${result.fifth}...]`);
        } else {
            console.log(`❌ 期數20250702503尚未結算`);
            console.log('   退水將在該期結算後自動分配');
            return;
        }
    } catch (error) {
        console.error('❌ 查詢開獎歷史失敗:', error.message);
        return;
    }
    
    // 2. 檢查justin2025A的身份
    console.log('\n2️⃣ 檢查justin2025A的身份和代理關係...');
    try {
        // 首先嘗試會員登錄
        console.log('嘗試會員登錄...');
        const memberLoginResponse = await axios.post(`${GAME_API_URL}/api/login`, {
            username: 'justin2025A',
            password: 'justin2025A'
        });
        
        if (memberLoginResponse.data.success) {
            console.log('✅ justin2025A 是會員！');
            console.log(`   會員餘額: ${memberLoginResponse.data.balance}`);
            console.log(`   盤口類型: ${memberLoginResponse.data.marketType}`);
            
            // 檢查會員的代理鏈
            const agentChainResponse = await axios.get(`${AGENT_API_URL}/api/agent/member-agent-chain?username=justin2025A`);
            
            if (agentChainResponse.data.success && agentChainResponse.data.agentChain) {
                const agentChain = agentChainResponse.data.agentChain;
                console.log('\n✅ 找到代理鏈:');
                agentChain.forEach((agent, index) => {
                    console.log(`   L${agent.level}: ${agent.username} (${agent.rebate_mode}, ${(agent.rebate_percentage*100).toFixed(1)}%)`);
                });
                
                // 檢查直屬代理的退水記錄
                const directAgent = agentChain[0];
                console.log(`\n3️⃣ 檢查直屬代理 ${directAgent.username} 的退水記錄...`);
                
                // 需要代理登錄才能查看退水記錄
                const agentLoginResponse = await axios.post(`${AGENT_API_URL}/api/agent/login`, {
                    username: directAgent.username,
                    password: directAgent.username // 假設密碼相同
                });
                
                if (agentLoginResponse.data.success) {
                    const rebateResponse = await axios.get(`${AGENT_API_URL}/api/agent/rebate-records?limit=20`, {
                        headers: {
                            'Authorization': `Bearer ${agentLoginResponse.data.token}`
                        }
                    });
                    
                    if (rebateResponse.data.success) {
                        const records = rebateResponse.data.records;
                        console.log(`✅ 找到 ${records.length} 筆退水記錄`);
                        
                        // 查找來自justin2025A的退水記錄
                        const justinRebates = records.filter(r => r.member_username === 'justin2025A');
                        if (justinRebates.length > 0) {
                            console.log(`✅ 找到來自justin2025A的退水記錄 ${justinRebates.length} 筆:`);
                            justinRebates.forEach(record => {
                                console.log(`   ${record.created_at}: +${record.amount}元`);
                            });
                        } else {
                            console.log('❌ 沒有找到來自justin2025A的退水記錄');
                        }
                        
                        // 顯示最近幾筆退水記錄
                        console.log('\n最近的退水記錄:');
                        records.slice(0, 5).forEach(record => {
                            console.log(`   ${record.created_at}: +${record.amount}元 (來自 ${record.member_username || '未知'})`);
                        });
                    }
                } else {
                    console.log(`❌ 無法登錄代理 ${directAgent.username}:`, agentLoginResponse.data.message);
                }
                
            } else {
                console.log('❌ 找不到代理鏈:', agentChainResponse.data.message);
            }
            
        } else {
            // 嘗試代理登錄
            console.log('嘗試代理登錄...');
            const agentLoginResponse = await axios.post(`${AGENT_API_URL}/api/agent/login`, {
                username: 'justin2025A',
                password: 'justin2025A'
            });
            
            if (agentLoginResponse.data.success) {
                console.log('✅ justin2025A 是代理！');
                console.log(`   代理ID: ${agentLoginResponse.data.agent.id}`);
                console.log(`   代理等級: ${agentLoginResponse.data.agent.level}`);
                console.log(`   餘額: ${agentLoginResponse.data.agent.balance}`);
                console.log('   說明: 如果是代理下注，不會產生退水，因為代理不能給自己退水');
            } else {
                console.log('❌ justin2025A 既不是會員也不是代理');
            }
        }
        
    } catch (error) {
        console.error('❌ 身份檢查失敗:', error.message);
    }
    
    // 4. 檢查當前期數和結算狀態
    console.log('\n4️⃣ 檢查當前期數和系統狀態...');
    try {
        const gameDataResponse = await axios.get(`${GAME_API_URL}/api/game-data`);
        if (gameDataResponse.data.success) {
            const { period, phase } = gameDataResponse.data.gameData;
            console.log(`✅ 當前期數: ${period}, 階段: ${phase}`);
            
            if (parseInt(period) > 20250702503) {
                console.log('✅ 期數20250702503應該已經結算完成');
            } else {
                console.log('⚠️ 期數20250702503可能尚未結算');
            }
        }
    } catch (error) {
        console.error('❌ 遊戲狀態查詢錯誤:', error.message);
    }
    
    console.log('\n🔍 檢查完成！');
    console.log('\n💡 退水機制說明:');
    console.log('   - 退水在每期開獎結算時自動分配');
    console.log('   - 只有會員下注才會產生退水給代理');
    console.log('   - 代理自己下注不會產生退水');
    console.log('   - 退水基於下注金額計算，不論輸贏');
}

checkRenderRebateIssue().catch(console.error); 