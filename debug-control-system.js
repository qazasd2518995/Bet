#!/usr/bin/env node

import fetch from 'node-fetch';

const AGENT_API_URL = 'http://localhost:3003';

async function debugControlSystem() {
  console.log('🔍 開始偵錯輸贏控制系統...\n');
  
  try {
    // 1. 檢查代理系統是否運行
    console.log('1. 檢查代理系統狀態...');
    try {
      const healthResponse = await fetch(`${AGENT_API_URL}/api/health`);
      if (healthResponse.ok) {
        console.log('✅ 代理系統運行中');
      } else {
        console.log('❌ 代理系統回應異常:', healthResponse.status);
      }
    } catch (error) {
      console.log('❌ 代理系統連接失敗:', error.message);
    }
    
    // 2. 檢查活躍的輸贏控制設定
    console.log('\n2. 檢查活躍的輸贏控制設定...');
    try {
      const controlResponse = await fetch(`${AGENT_API_URL}/api/agent/internal/win-loss-control/active`);
      
      if (!controlResponse.ok) {
        console.log('❌ 無法獲取控制設定:', controlResponse.status, controlResponse.statusText);
        return;
      }
      
      const controlResult = await controlResponse.json();
      console.log('📋 API響應:', JSON.stringify(controlResult, null, 2));
      
      if (controlResult.success && controlResult.data) {
        const control = controlResult.data;
        console.log('\n✅ 找到活躍控制設定:');
        console.log(`   ID: ${control.id}`);
        console.log(`   控制模式: ${control.control_mode}`);
        console.log(`   目標用戶: ${control.target_username}`);
        console.log(`   開始期數: ${control.start_period || '無限制'}`);
        console.log(`   控制機率: ${control.control_percentage}%`);
        console.log(`   贏控制: ${control.win_control}`);
        console.log(`   輸控制: ${control.loss_control}`);
        console.log(`   是否啟用: ${control.is_active}`);
        
        // 3. 檢查當前期數
        console.log('\n3. 檢查當前遊戲期數...');
        try {
          const gameResponse = await fetch('http://localhost:3000/api/game-data');
          if (gameResponse.ok) {
            const gameData = await gameResponse.json();
            const currentPeriod = parseInt(gameData.period);
            const startPeriod = control.start_period ? parseInt(control.start_period) : null;
            
            console.log(`   當前期數: ${currentPeriod}`);
            console.log(`   控制開始期數: ${startPeriod || '無限制'}`);
            
            if (startPeriod && currentPeriod < startPeriod) {
              console.log(`❌ 期數檢查: 當前期數(${currentPeriod}) < 控制開始期數(${startPeriod})`);
              console.log(`💡 建議: 將控制開始期數設定為 ${currentPeriod} 或更小的值`);
            } else {
              console.log(`✅ 期數檢查: 符合控制條件`);
            }
          } else {
            console.log('❌ 無法獲取遊戲數據');
          }
        } catch (error) {
          console.log('❌ 遊戲數據獲取失敗:', error.message);
        }
        
        // 4. 檢查目標用戶的下注記錄
        if (control.control_mode === 'single_member' && control.target_username) {
          console.log('\n4. 檢查目標用戶下注記錄...');
          try {
            const betResponse = await fetch(`http://localhost:3000/api/bet-records?username=${control.target_username}&page=1`);
            if (betResponse.ok) {
              const betData = await betResponse.json();
              console.log(`   目標用戶 ${control.target_username} 的下注記錄:`);
              console.log(`   總筆數: ${betData.total || 0}`);
              
              if (betData.data && betData.data.length > 0) {
                const recentBets = betData.data.slice(0, 3);
                console.log(`   最近3筆下注:`);
                recentBets.forEach((bet, index) => {
                  console.log(`     ${index + 1}. 期數:${bet.period}, 金額:${bet.amount}, 類型:${bet.betType}, 值:${bet.value}, 位置:${bet.position || 'N/A'}, 已結算:${bet.settled}`);
                });
              } else {
                console.log(`   ⚠️ 目標用戶沒有下注記錄`);
              }
            } else {
              console.log('❌ 無法獲取下注記錄');
            }
          } catch (error) {
            console.log('❌ 下注記錄獲取失敗:', error.message);
          }
        }
        
      } else {
        console.log('❌ 沒有活躍的輸贏控制設定');
        console.log('💡 請先在代理管理系統中創建輸贏控制設定');
      }
      
    } catch (error) {
      console.log('❌ 檢查控制設定失敗:', error.message);
    }
    
    // 5. 重新啟動後端服務的建議
    console.log('\n5. 重新啟動建議:');
    console.log('📝 為了應用最新的偵錯訊息，請重新啟動後端服務:');
    console.log('   1. 終止當前的 backend.js 進程: killall node');
    console.log('   2. 重新啟動: node backend.js');
    console.log('   3. 觀察控制台輸出的詳細偵錯訊息');
    
  } catch (error) {
    console.error('❌ 偵錯過程出錯:', error);
  }
}

// 執行偵錯
debugControlSystem().catch(console.error); 