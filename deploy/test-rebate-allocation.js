const axios = require('axios');

// 配置API端點
const FRONTEND_API = 'http://localhost:3002';
const AGENT_API = 'http://localhost:3003/api/agent';

// 延遲函數
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testRebateAllocation() {
  console.log('🔍 開始檢測退水分配流程...\n');
  
  try {
    // 1. 檢查服務狀態
    console.log('1. 檢查服務狀態...');
    try {
      const frontendStatus = await axios.get(`${FRONTEND_API}/api/status`);
      console.log('✅ 前端服務運行正常');
    } catch (error) {
      console.log('❌ 前端服務未運行:', error.message);
      return;
    }
    
    try {
      const agentStatus = await axios.get(`${AGENT_API}/status`);
      console.log('✅ 代理服務運行正常');
    } catch (error) {
      console.log('❌ 代理服務未運行:', error.message);
      return;
    }
    
    // 2. 獲取測試用戶和代理的初始餘額
    console.log('\n2. 獲取初始餘額...');
    const testUsername = 'testuser';
    const agentId = 1; // 假設代理ID為1
    
    try {
      const memberResponse = await axios.get(`${AGENT_API}/member-balance?username=${testUsername}`);
      const initialMemberBalance = parseFloat(memberResponse.data.balance);
      console.log(`會員 ${testUsername} 初始餘額: $${initialMemberBalance}`);
      
      const agentResponse = await axios.get(`${AGENT_API}/agent-balance?agentId=${agentId}`);
      const initialAgentBalance = parseFloat(agentResponse.data.balance);
      console.log(`代理 (ID:${agentId}) 初始餘額: $${initialAgentBalance}`);
      
      // 3. 執行一筆測試投注
      console.log('\n3. 執行測試投注...');
      const betAmount = 10;
      const betData = {
        username: testUsername,
        amount: betAmount,
        betType: 'position',
        value: 'big',
        period: '20250101999' // 使用未來期號避免立即結算
      };
      
      console.log(`投注資料:`, betData);
      
      const betResponse = await axios.post(`${FRONTEND_API}/api/bet`, betData);
      
      if (betResponse.data.success) {
        console.log('✅ 投注成功');
        console.log('投注ID:', betResponse.data.betId);
        
        // 4. 檢查投注後會員餘額變化
        console.log('\n4. 檢查投注後餘額變化...');
        await delay(1000); // 等待1秒確保資料更新
        
        const afterBetMemberResponse = await axios.get(`${AGENT_API}/member-balance?username=${testUsername}`);
        const afterBetMemberBalance = parseFloat(afterBetMemberResponse.data.balance);
        console.log(`會員投注後餘額: $${afterBetMemberBalance} (變化: ${afterBetMemberBalance - initialMemberBalance})`);
        
        // 5. 手動觸發退水分配測試
        console.log('\n5. 測試退水分配API...');
        const rebateTestData = {
          agentId: agentId,
          agentUsername: 'admin', // 假設代理用戶名為admin
          rebateAmount: betAmount * 0.041, // 4.1% 退水
          memberUsername: testUsername,
          betAmount: betAmount,
          reason: '測試退水分配'
        };
        
        console.log('退水測試資料:', rebateTestData);
        
        const rebateResponse = await axios.post(`${AGENT_API}/allocate-rebate`, rebateTestData);
        console.log('退水分配響應:', rebateResponse.data);
        
        if (rebateResponse.data.success) {
          console.log('✅ 退水分配API調用成功');
          
          // 6. 檢查代理餘額是否增加
          console.log('\n6. 檢查代理餘額變化...');
          await delay(1000);
          
          const afterRebateAgentResponse = await axios.get(`${AGENT_API}/agent-balance?agentId=${agentId}`);
          const afterRebateAgentBalance = parseFloat(afterRebateAgentResponse.data.balance);
          
          console.log(`代理退水後餘額: $${afterRebateAgentBalance} (變化: +$${(afterRebateAgentBalance - initialAgentBalance).toFixed(2)})`);
          
          if (afterRebateAgentBalance > initialAgentBalance) {
            console.log('✅ 代理餘額成功增加，退水分配正常工作');
          } else {
            console.log('❌ 代理餘額未增加，退水分配有問題');
          }
        } else {
          console.log('❌ 退水分配API調用失敗:', rebateResponse.data.message);
        }
        
        // 7. 檢查代理交易記錄
        console.log('\n7. 檢查代理交易記錄...');
        try {
          const transactionResponse = await axios.get(`${AGENT_API}/transactions?agentId=${agentId}&limit=5`);
          console.log('最近5筆交易記錄:');
          transactionResponse.data.transactions.forEach((tx, index) => {
            console.log(`${index + 1}. ${tx.type} $${tx.amount} - ${tx.description} (${tx.created_at})`);
          });
        } catch (error) {
          console.log('⚠️ 無法獲取交易記錄:', error.message);
        }
        
      } else {
        console.log('❌ 投注失敗:', betResponse.data.message);
      }
      
    } catch (error) {
      console.log('❌ 餘額查詢失敗:', error.message);
    }
    
  } catch (error) {
    console.error('❌ 測試過程發生錯誤:', error.message);
    if (error.response) {
      console.error('響應資料:', error.response.data);
    }
  }
}

// 執行測試
testRebateAllocation(); 