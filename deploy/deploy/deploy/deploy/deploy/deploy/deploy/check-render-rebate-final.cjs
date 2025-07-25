const axios = require('axios');

// Render 環境的正確API地址
const GAME_API_URL = 'https://bet-game-vcje.onrender.com';
const AGENT_API_URL = 'https://bet-agent.onrender.com';

async function checkRenderRebateFinal() {
    console.log('🔍 檢查 Render 環境中 justin2025A 的退水問題...\n');
    console.log(`遊戲平台: ${GAME_API_URL}`);
    console.log(`代理平台: ${AGENT_API_URL}\n`);
    
    // 1. 檢查期數20250702503是否已結算
    console.log('1️⃣ 檢查期數20250702503是否已結算...');
    try {
        const historyResponse = await axios.get(`${GAME_API_URL}/api/history`, {
            params: { period: '20250702503' },
            timeout: 10000
        });
        
        console.log('開獎歷史API響應:', historyResponse.data);
        
        if (historyResponse.data.success && historyResponse.data.records && historyResponse.data.records.length > 0) {
            const result = historyResponse.data.records[0];
            console.log(`✅ 期數20250702503已結算: 冠軍=${result.result[0]}`);
            console.log(`   完整開獎結果: [${result.result.join(', ')}]`);
            console.log(`   開獎時間: ${result.time}`);
        } else {
            console.log(`❌ 期數20250702503尚未結算或查詢失敗`);
            console.log('   可能原因: 該期還未開獎，或者API響應格式不同');
            
            // 嘗試查詢最近的開獎記錄
            const recentResponse = await axios.get(`${GAME_API_URL}/api/history`, {
                params: { limit: 5 },
                timeout: 10000
            });
            
            if (recentResponse.data.success && recentResponse.data.records) {
                console.log('\n最近的開獎記錄:');
                recentResponse.data.records.slice(0, 3).forEach(r => {
                    console.log(`   期數${r.period}: 冠軍=${r.result[0]} (${r.time})`);
                });
            }
        }
    } catch (error) {
        console.error('❌ 查詢開獎歷史失敗:', error.message);
        console.log('   可能原因: 網絡問題、API端點變更或服務暫時不可用');
    }
    
    // 2. 檢查justin2025A的身份
    console.log('\n2️⃣ 檢查justin2025A的身份...');
    try {
        // 首先嘗試會員登錄
        console.log('嘗試會員登錄...');
        const memberLoginResponse = await axios.post(`${GAME_API_URL}/api/member/login`, {
            username: 'justin2025A',
            password: 'justin2025A'
        }, { timeout: 10000 });
        
        console.log('會員登錄響應:', memberLoginResponse.data);
        
        if (memberLoginResponse.data.success) {
            console.log('✅ justin2025A 是會員！');
            console.log(`   會員餘額: ${memberLoginResponse.data.balance}`);
            console.log(`   盤口類型: ${memberLoginResponse.data.marketType}`);
            
            // 檢查會員的代理鏈
            console.log('\n檢查會員的代理鏈...');
            const agentChainResponse = await axios.get(`${AGENT_API_URL}/api/agent/member-agent-chain`, {
                params: { username: 'justin2025A' },
                timeout: 10000
            });
            
            console.log('代理鏈查詢響應:', agentChainResponse.data);
            
            if (agentChainResponse.data.success && agentChainResponse.data.agentChain) {
                const agentChain = agentChainResponse.data.agentChain;
                console.log('✅ 找到代理鏈:');
                agentChain.forEach((agent, index) => {
                    console.log(`   L${agent.level}: ${agent.username} (模式:${agent.rebate_mode}, 比例:${(agent.rebate_percentage*100).toFixed(1)}%)`);
                });
                
                // 檢查會員的下注記錄
                console.log('\n3️⃣ 檢查會員下注記錄...');
                const betHistoryResponse = await axios.get(`${GAME_API_URL}/api/bet-history`, {
                    params: { 
                        username: 'justin2025A',
                        limit: 10
                    },
                    timeout: 10000
                });
                
                if (betHistoryResponse.data.success) {
                    const bets = betHistoryResponse.data.bets || betHistoryResponse.data.records || [];
                    console.log(`✅ 找到 ${bets.length} 筆下注記錄`);
                    
                    // 查找期數20250702503的下注
                    const period503Bets = bets.filter(bet => bet.period == '20250702503');
                    if (period503Bets.length > 0) {
                        console.log(`✅ 期數20250702503下注記錄 ${period503Bets.length} 筆:`);
                        let totalBetAmount = 0;
                        period503Bets.forEach(bet => {
                            totalBetAmount += parseFloat(bet.amount);
                            console.log(`   ${bet.bet_type || bet.betType}:${bet.bet_value || bet.value} ${bet.amount}元 ${bet.settled ? '已結算' : '未結算'}`);
                        });
                        console.log(`   總下注金額: ${totalBetAmount}元`);
                        
                        // 計算預期退水
                        const directAgent = agentChain[0];
                        const expectedRebate = totalBetAmount * directAgent.rebate_percentage;
                        console.log(`   預期退水: ${expectedRebate.toFixed(2)}元 (${(directAgent.rebate_percentage*100).toFixed(1)}%)`);
                        
                        // 檢查直屬代理的退水記錄
                        console.log(`\n4️⃣ 檢查直屬代理 ${directAgent.username} 的退水記錄...`);
                        await checkAgentRebateRecords(directAgent.username, 'justin2025A', expectedRebate);
                        
                    } else {
                        console.log('❌ 沒有找到期數20250702503的下注記錄');
                    }
                } else {
                    console.log('❌ 無法獲取下注記錄:', betHistoryResponse.data.message);
                }
                
            } else {
                console.log('❌ 找不到代理鏈:', agentChainResponse.data.message || '會員可能不存在代理關係');
            }
            
        } else {
            // 嘗試代理登錄
            console.log('嘗試代理登錄...');
            const agentLoginResponse = await axios.post(`${AGENT_API_URL}/api/agent/login`, {
                username: 'justin2025A',
                password: 'justin2025A'
            }, { timeout: 10000 });
            
            console.log('代理登錄響應:', agentLoginResponse.data);
            
            if (agentLoginResponse.data.success) {
                console.log('✅ justin2025A 是代理！');
                console.log(`   代理ID: ${agentLoginResponse.data.agent.id}`);
                console.log(`   代理等級: ${agentLoginResponse.data.agent.level}`);
                console.log(`   餘額: ${agentLoginResponse.data.agent.balance}`);
                console.log('   ⚠️ 說明: 代理自己下注不會產生退水，因為代理不能給自己退水');
                
                // 檢查代理的退水記錄
                await checkAgentRebateRecords('justin2025A', null, 0, agentLoginResponse.data.token);
            } else {
                console.log('❌ justin2025A 既不是會員也不是代理，或密碼錯誤');
                console.log('   會員登錄失敗:', memberLoginResponse.data.message);
                console.log('   代理登錄失敗:', agentLoginResponse.data.message);
            }
        }
        
    } catch (error) {
        console.error('❌ 身份檢查失敗:', error.message);
        if (error.code === 'ECONNABORTED') {
            console.log('   原因: 請求超時，可能是網絡問題或服務響應慢');
        }
    }
    
    console.log('\n🔍 檢查完成！');
    console.log('\n💡 退水機制重要說明:');
    console.log('   1. 退水在每期開獎結算時自動分配，不是下注時立即分配');
    console.log('   2. 只有會員下注才會產生退水給代理');
    console.log('   3. 代理自己下注不會產生退水');
    console.log('   4. 退水基於下注金額計算，不論輸贏');
    console.log('   5. 如果期數尚未結算，退水將在結算後自動分配');
}

async function checkAgentRebateRecords(agentUsername, memberUsername = null, expectedRebate = 0, token = null) {
    try {
        // 如果沒有token，嘗試代理登錄
        if (!token) {
            const loginResponse = await axios.post(`${AGENT_API_URL}/api/agent/login`, {
                username: agentUsername,
                password: agentUsername
            }, { timeout: 10000 });
            
            if (!loginResponse.data.success) {
                console.log(`❌ 無法登錄代理 ${agentUsername}:`, loginResponse.data.message);
                return;
            }
            token = loginResponse.data.token;
        }
        
        // 查詢退水記錄
        const rebateResponse = await axios.get(`${AGENT_API_URL}/api/agent/rebate-records`, {
            params: { limit: 50 },
            headers: {
                'Authorization': `Bearer ${token}`
            },
            timeout: 10000
        });
        
        console.log('退水記錄查詢響應:', rebateResponse.data);
        
        if (rebateResponse.data.success) {
            const records = rebateResponse.data.records || [];
            console.log(`✅ 找到 ${records.length} 筆退水記錄`);
            
            if (memberUsername) {
                // 查找來自特定會員的退水記錄
                const memberRebates = records.filter(r => r.member_username === memberUsername);
                if (memberRebates.length > 0) {
                    console.log(`✅ 找到來自 ${memberUsername} 的退水記錄 ${memberRebates.length} 筆:`);
                    let totalRebate = 0;
                    memberRebates.forEach(record => {
                        totalRebate += parseFloat(record.amount);
                        console.log(`   ${record.created_at}: +${record.amount}元 (下注: ${record.bet_amount}元)`);
                    });
                    console.log(`   總退水: ${totalRebate.toFixed(2)}元`);
                    
                    if (expectedRebate > 0) {
                        const difference = Math.abs(totalRebate - expectedRebate);
                        if (difference < 0.01) {
                            console.log('✅ 退水金額正確！');
                        } else {
                            console.log(`⚠️ 退水金額差異: 預期${expectedRebate.toFixed(2)}元，實際${totalRebate.toFixed(2)}元，差異${difference.toFixed(2)}元`);
                        }
                    }
                } else {
                    console.log(`❌ 沒有找到來自 ${memberUsername} 的退水記錄`);
                    if (expectedRebate > 0) {
                        console.log(`   可能原因: 期數尚未結算，預期退水${expectedRebate.toFixed(2)}元將在結算後發放`);
                    }
                }
            }
            
            // 顯示最近的退水記錄
            if (records.length > 0) {
                console.log('\n最近的退水記錄:');
                records.slice(0, 5).forEach(record => {
                    console.log(`   ${record.created_at}: +${record.amount}元 (來自 ${record.member_username || '未知'})`);
                });
            } else {
                console.log('   該代理目前沒有任何退水記錄');
            }
        } else {
            console.log('❌ 無法獲取退水記錄:', rebateResponse.data.message);
        }
        
    } catch (error) {
        console.error(`❌ 檢查代理 ${agentUsername} 退水記錄失敗:`, error.message);
    }
}

checkRenderRebateFinal().catch(console.error); 