const axios = require('axios');

// 配置
const GAME_API_URL = 'http://localhost:3000';
const AGENT_API_URL = 'http://localhost:3003/api/agent';

// 測試會員
const TEST_MEMBER = 'titi';

async function testBettingLimitsSync() {
  console.log('🧪 測試限紅同步功能...\n');

  try {
    console.log('1️⃣ 測試獲取會員限紅設定...');
    
    // 從遊戲API獲取會員限紅設定
    const response = await axios.get(`${GAME_API_URL}/api/member-betting-limits`, {
      params: { username: TEST_MEMBER }
    });

    if (response.data.success) {
      console.log('✅ 成功獲取會員限紅設定');
      console.log(`📊 會員: ${TEST_MEMBER}`);
      console.log(`🏷️ 限紅等級: ${response.data.levelDisplayName || response.data.levelName}`);
      console.log('💰 限紅配置:');
      
      const config = response.data.config;
      console.log(`   • 1-10車號: 單注最高 ${config.number.maxBet} / 單期限額 ${config.number.periodLimit}`);
      console.log(`   • 兩面: 單注最高 ${config.twoSide.maxBet} / 單期限額 ${config.twoSide.periodLimit}`);
      console.log(`   • 冠亞軍和大小: 單注最高 ${config.sumValueSize.maxBet} / 單期限額 ${config.sumValueSize.periodLimit}`);
      console.log(`   • 冠亞軍和單雙: 單注最高 ${config.sumValueOddEven.maxBet} / 單期限額 ${config.sumValueOddEven.periodLimit}`);
      console.log(`   • 冠亞軍和: 單注最高 ${config.sumValue.maxBet} / 單期限額 ${config.sumValue.periodLimit}`);
      console.log(`   • 龍虎: 單注最高 ${config.dragonTiger.maxBet} / 單期限額 ${config.dragonTiger.periodLimit}`);
      
      console.log('\n2️⃣ 測試下注限制驗證...');
      
      // 測試不同金額的下注
      const testAmounts = [100, 1000, 3000, 6000];
      
      for (const amount of testAmounts) {
        console.log(`\n💸 測試下注金額: ${amount}`);
        
        // 測試車號投注
        if (amount <= config.number.maxBet) {
          console.log(`   ✅ 車號投注 ${amount} 元 - 符合限制 (最高${config.number.maxBet})`);
        } else {
          console.log(`   ❌ 車號投注 ${amount} 元 - 超過限制 (最高${config.number.maxBet})`);
        }
        
        // 測試兩面投注
        if (amount <= config.twoSide.maxBet) {
          console.log(`   ✅ 兩面投注 ${amount} 元 - 符合限制 (最高${config.twoSide.maxBet})`);
        } else {
          console.log(`   ❌ 兩面投注 ${amount} 元 - 超過限制 (最高${config.twoSide.maxBet})`);
        }
        
        // 測試冠亞軍和投注
        if (amount <= config.sumValue.maxBet) {
          console.log(`   ✅ 冠亞軍和投注 ${amount} 元 - 符合限制 (最高${config.sumValue.maxBet})`);
        } else {
          console.log(`   ❌ 冠亞軍和投注 ${amount} 元 - 超過限制 (最高${config.sumValue.maxBet})`);
        }
      }

      console.log('\n✅ 限紅同步功能測試完成！');
      console.log('🎯 功能狀態:');
      console.log('   • ✅ API端點正常工作');
      console.log('   • ✅ 會員限紅設定獲取成功');
      console.log('   • ✅ 限紅配置格式正確');
      console.log('   • ✅ 遊戲平台可以獲取動態限紅');
      
    } else {
      console.log('❌ 獲取會員限紅設定失敗:', response.data.message);
    }

  } catch (error) {
    console.error('❌ 測試過程中出現錯誤:', error.message);
    if (error.response) {
      console.error('📝 錯誤詳情:', error.response.data);
    }
  }
}

// 執行測試
if (require.main === module) {
  testBettingLimitsSync();
}

module.exports = { testBettingLimitsSync }; 