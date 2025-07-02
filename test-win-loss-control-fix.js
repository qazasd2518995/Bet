import axios from 'axios';

// 配置
const AGENT_BASE_URL = 'http://localhost:3003/api/agent';
const TEST_AGENT = {
  username: 'ti2025D',
  password: 'ti2025D'
};

async function testWinLossControlFix() {
  console.log('🔧 開始測試輸贏控制功能修復...\n');
  
  try {
    // 1. 登錄代理
    console.log('1. 代理登錄測試...');
    const loginResponse = await axios.post(`${AGENT_BASE_URL}/login`, TEST_AGENT);
    
    if (!loginResponse.data.success) {
      throw new Error('登錄失敗: ' + loginResponse.data.message);
    }
    
    const sessionToken = loginResponse.data.sessionToken || loginResponse.data.token;
    const headers = { 
      'X-Session-Token': sessionToken,
      'Authorization': `Bearer ${sessionToken}`
    };
    console.log('✅ 代理登錄成功');
    
    // 2. 測試創建輸贏控制
    console.log('\n2. 測試創建輸贏控制...');
    const createData = {
      control_mode: 'normal',
      control_percentage: 50,
      win_control: false,
      loss_control: false,
      start_period: '20250103001'
    };
    
    const createResponse = await axios.post(`${AGENT_BASE_URL}/win-loss-control`, createData, { headers });
    
    if (createResponse.data.success) {
      console.log('✅ 創建輸贏控制成功');
      console.log('📊 控制設定ID:', createResponse.data.data.id);
      
      const controlId = createResponse.data.data.id;
      
      // 3. 測試獲取控制列表
      console.log('\n3. 測試獲取控制列表...');
      const listResponse = await axios.get(`${AGENT_BASE_URL}/win-loss-control`, { headers });
      
      if (listResponse.data.success) {
        console.log('✅ 獲取控制列表成功');
        console.log('📋 控制數量:', listResponse.data.data.length);
      } else {
        console.log('❌ 獲取控制列表失敗:', listResponse.data.message);
      }
      
      // 4. 測試更新控制設定
      console.log('\n4. 測試更新控制設定...');
      const updateData = {
        control_percentage: 75,
        win_control: true,
        loss_control: false,
        is_active: true
      };
      
      const updateResponse = await axios.put(`${AGENT_BASE_URL}/win-loss-control/${controlId}`, updateData, { headers });
      
      if (updateResponse.data.success) {
        console.log('✅ 更新控制設定成功');
      } else {
        console.log('❌ 更新控制設定失敗:', updateResponse.data.message);
      }
      
      // 5. 測試激活控制
      console.log('\n5. 測試激活控制...');
      const activateResponse = await axios.put(`${AGENT_BASE_URL}/win-loss-control/${controlId}/activate`, {}, { headers });
      
      if (activateResponse.data.success) {
        console.log('✅ 激活控制成功');
      } else {
        console.log('❌ 激活控制失敗:', activateResponse.data.message);
      }
      
      // 6. 測試停用控制
      console.log('\n6. 測試停用控制...');
      const deactivateResponse = await axios.put(`${AGENT_BASE_URL}/win-loss-control/${controlId}/deactivate`, {}, { headers });
      
      if (deactivateResponse.data.success) {
        console.log('✅ 停用控制成功');
      } else {
        console.log('❌ 停用控制失敗:', deactivateResponse.data.message);
      }
      
      // 7. 測試刪除控制（這是原本出錯的功能）
      console.log('\n7. 測試刪除控制（核心修復測試）...');
      const deleteResponse = await axios.delete(`${AGENT_BASE_URL}/win-loss-control/${controlId}`, { headers });
      
      if (deleteResponse.data.success) {
        console.log('✅ 刪除控制成功 - 修復生效！');
      } else {
        console.log('❌ 刪除控制失敗:', deleteResponse.data.message);
      }
      
    } else {
      console.log('❌ 創建輸贏控制失敗:', createResponse.data.message);
    }
    
    console.log('\n🎉 測試完成！');
    
  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error.message);
    if (error.response) {
      console.error('🔍 錯誤詳情:', error.response.data);
    }
  }
}

// 執行測試
testWinLossControlFix(); 