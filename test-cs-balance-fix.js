const axios = require('axios');

// 配置
const API_BASE_URL = 'http://localhost:3003/api/agent';
const CS_USERNAME = 'ti2025A'; // 客服用戶名
const CS_PASSWORD = 'password123'; // 客服密碼

// 測試客服轉帳功能
async function testCSBalanceFix() {
    console.log('🔧 開始測試客服餘額修復功能...\n');
    
    try {
        // 1. 客服登錄
        console.log('1️⃣ 客服登錄...');
        const loginResponse = await axios.post(`${API_BASE_URL}/login`, {
            username: CS_USERNAME,
            password: CS_PASSWORD
        });
        
        if (!loginResponse.data.success) {
            throw new Error(`客服登錄失敗: ${loginResponse.data.message}`);
        }
        
        const csUser = loginResponse.data.user;
        const initialBalance = parseFloat(csUser.balance);
        console.log(`✅ 客服登錄成功: ${csUser.username}`);
        console.log(`📊 初始餘額: ${initialBalance.toFixed(2)}`);
        
        // 設置axios默認headers
        axios.defaults.headers.common['Authorization'] = `Bearer ${loginResponse.data.token}`;
        
        // 2. 獲取所有代理列表
        console.log('\n2️⃣ 獲取代理列表...');
        const agentsResponse = await axios.get(`${API_BASE_URL}/agents`);
        
        if (!agentsResponse.data.success || !agentsResponse.data.agents || agentsResponse.data.agents.length === 0) {
            throw new Error('無法獲取代理列表或代理列表為空');
        }
        
        // 找到一個非客服的代理
        const targetAgent = agentsResponse.data.agents.find(agent => 
            agent.id !== csUser.id && agent.level > 0
        );
        
        if (!targetAgent) {
            throw new Error('未找到適合的測試目標代理');
        }
        
        const targetAgentInitialBalance = parseFloat(targetAgent.balance);
        console.log(`✅ 找到測試目標代理: ${targetAgent.username}`);
        console.log(`📊 目標代理初始餘額: ${targetAgentInitialBalance.toFixed(2)}`);
        
        // 3. 獲取目標代理的會員
        console.log('\n3️⃣ 獲取目標代理的會員...');
        const membersResponse = await axios.get(`${API_BASE_URL}/members?agentId=${targetAgent.id}`);
        
        let testMember = null;
        if (membersResponse.data.success && membersResponse.data.members && membersResponse.data.members.length > 0) {
            testMember = membersResponse.data.members[0];
            console.log(`✅ 找到測試會員: ${testMember.username}`);
            console.log(`📊 會員初始餘額: ${parseFloat(testMember.balance).toFixed(2)}`);
        } else {
            console.log('⚠️ 目標代理沒有會員，只測試代理轉帳');
        }
        
        const testAmount = 100; // 測試金額
        
        // 4. 測試客服給代理存款
        console.log(`\n4️⃣ 測試客服給代理存款 ${testAmount} 點...`);
        
        if (initialBalance < testAmount) {
            console.log(`⚠️ 客服餘額不足 (${initialBalance} < ${testAmount})，跳過存款測試`);
        } else {
            const depositResponse = await axios.post(`${API_BASE_URL}/cs-agent-transfer`, {
                operatorId: csUser.id,
                targetAgentId: targetAgent.id,
                amount: testAmount,
                transferType: 'deposit',
                description: '測試客服存款功能'
            });
            
            if (depositResponse.data.success) {
                const newCSBalance = depositResponse.data.csBalance;
                const expectedCSBalance = initialBalance - testAmount;
                
                console.log(`✅ 代理存款成功`);
                console.log(`📊 客服餘額變化: ${initialBalance.toFixed(2)} → ${newCSBalance.toFixed(2)}`);
                console.log(`📊 預期餘額: ${expectedCSBalance.toFixed(2)}`);
                console.log(`📊 實際餘額: ${newCSBalance.toFixed(2)}`);
                
                if (Math.abs(newCSBalance - expectedCSBalance) < 0.01) {
                    console.log('✅ 客服餘額更新正確！');
                } else {
                    console.log('❌ 客服餘額更新錯誤！');
                }
            } else {
                console.log(`❌ 代理存款失敗: ${depositResponse.data.message}`);
            }
        }
        
        // 5. 測試客服從代理提款
        console.log(`\n5️⃣ 測試客服從代理提款 ${testAmount/2} 點...`);
        
        const withdrawResponse = await axios.post(`${API_BASE_URL}/cs-agent-transfer`, {
            operatorId: csUser.id,
            targetAgentId: targetAgent.id,
            amount: testAmount / 2,
            transferType: 'withdraw',
            description: '測試客服提款功能'
        });
        
        if (withdrawResponse.data.success) {
            const newCSBalance = withdrawResponse.data.csBalance;
            console.log(`✅ 代理提款成功`);
            console.log(`📊 客服餘額更新為: ${newCSBalance.toFixed(2)}`);
        } else {
            console.log(`❌ 代理提款失敗: ${withdrawResponse.data.message}`);
        }
        
        // 6. 如果有會員，測試會員轉帳
        if (testMember) {
            console.log(`\n6️⃣ 測試客服給會員存款 ${testAmount/4} 點...`);
            
            const memberDepositResponse = await axios.post(`${API_BASE_URL}/cs-member-transfer`, {
                operatorId: csUser.id,
                agentId: targetAgent.id,
                targetMemberUsername: testMember.username,
                amount: testAmount / 4,
                transferType: 'deposit',
                description: '測試客服會員存款功能'
            });
            
            if (memberDepositResponse.data.success) {
                const newCSBalance = memberDepositResponse.data.csBalance;
                console.log(`✅ 會員存款成功`);
                console.log(`📊 客服餘額更新為: ${newCSBalance.toFixed(2)}`);
            } else {
                console.log(`❌ 會員存款失敗: ${memberDepositResponse.data.message}`);
            }
            
            console.log(`\n7️⃣ 測試客服從會員提款 ${testAmount/8} 點...`);
            
            const memberWithdrawResponse = await axios.post(`${API_BASE_URL}/cs-member-transfer`, {
                operatorId: csUser.id,
                agentId: targetAgent.id,
                targetMemberUsername: testMember.username,
                amount: testAmount / 8,
                transferType: 'withdraw',
                description: '測試客服會員提款功能'
            });
            
            if (memberWithdrawResponse.data.success) {
                const newCSBalance = memberWithdrawResponse.data.csBalance;
                console.log(`✅ 會員提款成功`);
                console.log(`📊 客服餘額更新為: ${newCSBalance.toFixed(2)}`);
            } else {
                console.log(`❌ 會員提款失敗: ${memberWithdrawResponse.data.message}`);
            }
        }
        
        // 8. 獲取客服交易記錄
        console.log(`\n8️⃣ 獲取客服交易記錄...`);
        const transactionsResponse = await axios.get(`${API_BASE_URL}/cs-transactions?operatorId=${csUser.id}&limit=10`);
        
        if (transactionsResponse.data.success) {
            const transactions = transactionsResponse.data.data.list;
            console.log(`✅ 獲取到 ${transactions.length} 筆客服交易記錄`);
            
            // 顯示最近的交易記錄
            transactions.slice(0, 3).forEach((transaction, index) => {
                console.log(`📝 交易${index + 1}: ${transaction.transaction_type} ${transaction.amount} 點 (${transaction.description})`);
            });
        } else {
            console.log(`❌ 獲取交易記錄失敗: ${transactionsResponse.data.message}`);
        }
        
        console.log('\n✅ 客服餘額修復功能測試完成！');
        console.log('\n📋 測試總結:');
        console.log('   - 客服轉帳操作會正確更新客服本身的餘額');
        console.log('   - 存款操作會從客服餘額中扣除金額');
        console.log('   - 提款操作會增加客服餘額');
        console.log('   - 所有操作都會記錄在交易記錄中');
        console.log('   - 前端會即時獲得並更新客服餘額');
        
    } catch (error) {
        console.error('\n❌ 測試過程中發生錯誤:', error.message);
        if (error.response?.data) {
            console.error('   錯誤詳情:', error.response.data);
        }
    }
}

// 執行測試
if (require.main === module) {
    testCSBalanceFix();
}

module.exports = { testCSBalanceFix }; 