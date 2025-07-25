const axios = require('axios');

// API 端點
const AGENT_API_URL = 'http://localhost:3003';  // agentBackend.js
const GAME_API_URL = 'http://localhost:3000';   // backend.js

async function checkJustin111Complete() {
    console.log('🔍 完整檢查 justin111 的身份和狀態...\n');
    
    try {
        // 1. 先檢查是否為代理 (ti2025A)
        console.log('1️⃣ 檢查代理 ti2025A 登入...');
        try {
            const agentLoginResponse = await axios.post(`${AGENT_API_URL}/api/agent/login`, {
                username: 'ti2025A',
                password: 'ti2025A'
            });
            
            if (agentLoginResponse.data.success) {
                console.log('✅ 代理 ti2025A 登入成功');
                console.log('   代理資訊:', {
                    username: agentLoginResponse.data.agent.username,
                    balance: agentLoginResponse.data.agent.balance,
                    market_type: agentLoginResponse.data.agent.market_type,
                    level: agentLoginResponse.data.agent.level
                });
                
                // 查看該代理下的會員
                const token = agentLoginResponse.data.token;
                console.log('\n   檢查代理下的會員...');
                try {
                    const membersResponse = await axios.get(`${AGENT_API_URL}/api/agent/members`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    
                    const members = membersResponse.data.members || [];
                    console.log(`   代理下會員數: ${members.length}`);
                    
                    const justin111Member = members.find(m => m.username === 'justin111');
                    if (justin111Member) {
                        console.log('   ✅ 找到會員 justin111:', {
                            username: justin111Member.username,
                            balance: justin111Member.balance,
                            market_type: justin111Member.market_type,
                            rebate_rate: justin111Member.rebate_rate
                        });
                    } else {
                        console.log('   ❌ 在代理會員中未找到 justin111');
                        console.log('   現有會員:', members.map(m => m.username).join(', '));
                    }
                } catch (error) {
                    console.log('   ❌ 獲取代理會員失敗:', error.response?.data?.message || error.message);
                }
            }
        } catch (error) {
            console.log('❌ 代理 ti2025A 登入失敗:', error.response?.data?.message || error.message);
        }
        
        // 2. 檢查是否為遊戲會員
        console.log('\n2️⃣ 檢查遊戲會員 justin111 登入...');
        try {
            const memberLoginResponse = await axios.post(`${GAME_API_URL}/api/login`, {
                username: 'justin111',
                password: 'aaaa00'
            });
            
            if (memberLoginResponse.data.success) {
                console.log('✅ 會員 justin111 登入成功');
                console.log('   會員資訊:', {
                    username: memberLoginResponse.data.username,
                    balance: memberLoginResponse.data.balance,
                    market_type: memberLoginResponse.data.market_type,
                    agent_username: memberLoginResponse.data.agent_username
                });
                
                // 獲取下注歷史
                console.log('\n   檢查最近下注記錄...');
                try {
                    const historyResponse = await axios.get(`${GAME_API_URL}/api/bet-history?username=justin111&limit=5`);
                    const bets = historyResponse.data.bets || [];
                    console.log(`   最近 ${bets.length} 筆下注:`);
                    bets.forEach((bet, index) => {
                        console.log(`     ${index + 1}. 期數: ${bet.period}, 下注: ${bet.bet_type}${bet.bet_value}, 金額: ${bet.amount}, 賠率: ${bet.odds}, 中獎: ${bet.win ? '是' : '否'}, 獎金: ${bet.win_amount || 0}, 已結算: ${bet.settled ? '是' : '否'}`);
                    });
                } catch (error) {
                    console.log('   ❌ 獲取下注歷史失敗:', error.response?.data?.message || error.message);
                }
                
                // 獲取當前期數
                console.log('\n   檢查當前期數...');
                try {
                    const periodResponse = await axios.get(`${GAME_API_URL}/api/current-period`);
                    console.log('   當前期數:', periodResponse.data.period);
                    console.log('   狀態:', periodResponse.data.status);
                } catch (error) {
                    console.log('   ❌ 獲取當前期數失敗:', error.response?.data?.message || error.message);
                }
                
            } else {
                console.log('❌ 會員 justin111 登入失敗:', memberLoginResponse.data.message);
            }
        } catch (error) {
            console.log('❌ 會員 justin111 登入失敗:', error.response?.data?.message || error.message);
        }
        
        // 3. 檢查最近期數的開獎結果
        console.log('\n3️⃣ 檢查最近期數開獎結果...');
        try {
            const resultsResponse = await axios.get(`${GAME_API_URL}/api/recent-results?limit=5`);
            const results = resultsResponse.data.results || [];
            console.log('   最近 5 期開獎:');
            results.forEach((result, index) => {
                console.log(`     ${index + 1}. 期數: ${result.period}, 結果: ${result.result}, 狀態: ${result.status}`);
            });
        } catch (error) {
            console.log('   ❌ 獲取開獎結果失敗:', error.response?.data?.message || error.message);
        }
        
    } catch (error) {
        console.error('❌ 檢查過程發生錯誤:', error.message);
    }
}

// 執行檢查
checkJustin111Complete();
