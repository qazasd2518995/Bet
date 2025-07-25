const axios = require('axios');

const AGENT_API_URL = 'http://localhost:3003';

async function checkJustinStatus() {
    console.log('🔍 檢查 justin2025A 的身份...\n');
    
    try {
        // 1. 檢查是否為代理
        console.log('1️⃣ 檢查是否為代理...');
        const agentLoginResponse = await axios.post(`${AGENT_API_URL}/api/agent/login`, {
            username: 'justin2025A',
            password: 'justin2025A'
        });
        
        console.log('代理登錄結果:', agentLoginResponse.data);
        
        if (agentLoginResponse.data.success) {
            const agentData = agentLoginResponse.data;
            console.log('✅ justin2025A 是代理！');
            console.log(`   代理ID: ${agentData.agent.id}`);
            console.log(`   代理等級: ${agentData.agent.level}`);
            console.log(`   盤口類型: ${agentData.agent.market_type}`);
            console.log(`   退水比例: ${(agentData.agent.rebate_percentage * 100).toFixed(1)}%`);
            console.log(`   退水模式: ${agentData.agent.rebate_mode}`);
            console.log(`   餘額: ${agentData.agent.balance}`);
            
            // 2. 檢查其下線會員
            console.log('\n2️⃣ 檢查下線會員...');
            const membersResponse = await axios.get(`${AGENT_API_URL}/api/agent/members?agentId=${agentData.agent.id}`, {
                headers: {
                    'Authorization': `Bearer ${agentData.token}`
                }
            });
            
            if (membersResponse.data.success) {
                const members = membersResponse.data.members;
                console.log(`✅ 找到 ${members.length} 個下線會員:`);
                members.forEach(member => {
                    console.log(`   ${member.username} (餘額: ${member.balance})`);
                });
                
                // 3. 檢查退水記錄
                console.log('\n3️⃣ 檢查退水記錄...');
                const rebateResponse = await axios.get(`${AGENT_API_URL}/api/agent/rebate-records`, {
                    headers: {
                        'Authorization': `Bearer ${agentData.token}`
                    }
                });
                
                if (rebateResponse.data.success) {
                    const records = rebateResponse.data.records;
                    console.log(`✅ 找到 ${records.length} 筆退水記錄:`);
                    records.slice(0, 5).forEach(record => {
                        console.log(`   ${record.created_at}: +${record.amount}元 (來自 ${record.member_username || '未知'})`);
                    });
                } else {
                    console.log('❌ 無法獲取退水記錄:', rebateResponse.data.message);
                }
            } else {
                console.log('❌ 無法獲取下線會員:', membersResponse.data.message);
            }
            
        } else {
            console.log('❌ justin2025A 不是代理:', agentLoginResponse.data.message);
        }
        
    } catch (error) {
        console.error('❌ 檢查過程出錯:', error.message);
        
        // 如果是401錯誤，可能是密碼錯誤
        if (error.response && error.response.status === 401) {
            console.log('可能是密碼錯誤，justin2025A 可能存在但密碼不正確');
        }
    }
    
    console.log('\n🔍 檢查完成！');
}

checkJustinStatus().catch(console.error); 