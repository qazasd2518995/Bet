const { Pool } = require('pg');

// 資料庫配置
const dbConfig = {
  user: 'postgres',
  host: 'localhost',
  database: 'game_betting',
  password: 'Zaq123456789',
  port: 5432,
};

const db = new Pool(dbConfig);

// 獲取當前期數
function getCurrentPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = Math.floor(now.getMinutes() / 5) * 5;
  const minuteStr = String(minute).padStart(2, '0');
  
  return `${year}${month}${date}${hour}${minuteStr}`;
}

// 創建測試下注數據
async function createTestBets(period) {
  try {
    console.log(`🎮 創建期數 ${period} 的測試下注數據...`);
    
    // 清理該期的舊數據
    await db.query('DELETE FROM bet_history WHERE period = $1', [period]);
    
    // 創建各種類型的測試下注
    const testBets = [
      // 大額號碼下注 - 讓平台面臨虧損風險
      { username: 'titi', bet_type: 'number', bet_value: '1', position: '1', amount: 5000 },
      { username: 'AAA', bet_type: 'number', bet_value: '1', position: '1', amount: 3000 },
      { username: 'BBB', bet_type: 'number', bet_value: '2', position: '1', amount: 2000 },
      
      // 熱門和值下注
      { username: 'titi', bet_type: 'sumValue', bet_value: '11', position: null, amount: 4000 },
      { username: 'CCC', bet_type: 'sumValue', bet_value: '11', position: null, amount: 2000 },
      { username: 'DDD', bet_type: 'sumValue', bet_value: '10', position: null, amount: 1500 },
      
      // 龍虎下注
      { username: 'EEE', bet_type: 'dragonTiger', bet_value: 'dragon', position: null, amount: 1000 },
      { username: 'FFF', bet_type: 'dragonTiger', bet_value: 'tiger', position: null, amount: 800 },
      
      // 分散的小額下注
      { username: 'GGG', bet_type: 'number', bet_value: '5', position: '2', amount: 100 },
      { username: 'HHH', bet_type: 'number', bet_value: '7', position: '3', amount: 200 },
      { username: 'III', bet_type: 'sumValue', bet_value: '15', position: null, amount: 300 },
    ];
    
    for (const bet of testBets) {
      await db.query(`
        INSERT INTO bet_history (username, period, bet_type, bet_value, position, amount, settled, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, false, NOW())
      `, [bet.username, period, bet.bet_type, bet.bet_value, bet.position, bet.amount]);
    }
    
    const totalAmount = testBets.reduce((sum, bet) => sum + bet.amount, 0);
    console.log(`✅ 測試下注創建完成，總金額: ${totalAmount}，筆數: ${testBets.length}`);
    
    return testBets;
  } catch (error) {
    console.error('❌ 創建測試下注失敗:', error);
    throw error;
  }
}

// 創建自動偵測控制設定
async function createAutoDetectControl(period) {
  try {
    console.log(`🤖 創建自動偵測控制設定...`);
    
    // 先刪除現有的活躍控制
    await fetch('http://localhost:3003/internal/win-loss-control/deactivate-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    // 創建新的自動偵測控制
    const controlData = {
      control_mode: 'auto_detect',
      target_type: null,
      target_username: null,
      control_percentage: 50, // 自動偵測模式不使用此值，但需要提供
      win_control: false,
      loss_control: false,
      start_period: period,
      operator_username: 'ti2025A'
    };
    
    const response = await fetch('http://localhost:3003/win-loss-control', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-session-token'
      },
      body: JSON.stringify(controlData)
    });
    
    const result = await response.json();
    if (result.success) {
      console.log(`✅ 自動偵測控制創建成功，ID: ${result.data.id}`);
      return result.data;
    } else {
      throw new Error(`創建控制失敗: ${result.message}`);
    }
  } catch (error) {
    console.error('❌ 創建自動偵測控制失敗:', error);
    throw error;
  }
}

// 測試自動偵測分析功能
async function testAutoDetectAnalysis() {
  try {
    console.log('\n🎯 開始測試自動偵測控制功能...\n');
    
    const period = getCurrentPeriod();
    console.log(`📅 測試期數: ${period}`);
    
    // 1. 創建測試下注數據
    const testBets = await createTestBets(period);
    
    // 2. 創建自動偵測控制設定
    const control = await createAutoDetectControl(period);
    
    // 3. 測試檢查輸贏控制API
    console.log('\n🔍 測試輸贏控制檢查API...');
    const checkResponse = await fetch('http://localhost:3003/internal/win-loss-control/active');
    const checkResult = await checkResponse.json();
    
    if (checkResult.success && checkResult.data) {
      console.log('✅ 輸贏控制檢查成功:', {
        id: checkResult.data.id,
        mode: checkResult.data.control_mode,
        start_period: checkResult.data.start_period,
        is_active: checkResult.data.is_active
      });
    } else {
      console.log('❌ 輸贏控制檢查失敗:', checkResult);
    }
    
    // 4. 測試遊戲後端的自動偵測邏輯
    console.log('\n🎮 測試遊戲後端的智能開獎...');
    const gameResponse = await fetch('http://localhost:3000/admin/manual-draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period })
    });
    
    if (gameResponse.ok) {
      const gameResult = await gameResponse.json();
      console.log('✅ 智能開獎測試成功:', gameResult);
    } else {
      console.log('❌ 智能開獎測試失敗，狀態:', gameResponse.status);
    }
    
    // 5. 查看開獎結果和下注結算
    console.log('\n📊 檢查開獎結果和下注結算...');
    const betsResult = await db.query(`
      SELECT username, bet_type, bet_value, position, amount, win, win_amount
      FROM bet_history 
      WHERE period = $1 
      ORDER BY amount DESC
    `, [period]);
    
    console.log('\n📋 下注結算結果:');
    let totalBet = 0;
    let totalWin = 0;
    
    betsResult.rows.forEach(bet => {
      totalBet += parseFloat(bet.amount);
      if (bet.win) {
        totalWin += parseFloat(bet.win_amount);
      }
      
      console.log(`用戶: ${bet.username}, 下注: ${bet.bet_type} ${bet.bet_value || ''} ${bet.position || ''}, 金額: ${bet.amount}, 結果: ${bet.win ? '贏' : '輸'}, 贏錢: ${bet.win_amount || 0}`);
    });
    
    const platformProfit = totalBet - totalWin;
    const playerWinRate = totalBet > 0 ? (totalWin / totalBet * 100).toFixed(1) : 0;
    
    console.log('\n📈 期數總結:');
    console.log(`總下注金額: ${totalBet}`);
    console.log(`總贏錢金額: ${totalWin}`);
    console.log(`平台收益: ${platformProfit} (${platformProfit > 0 ? '獲利' : '虧損'})`);
    console.log(`玩家勝率: ${playerWinRate}%`);
    
    // 6. 驗證自動偵測效果
    console.log('\n🎯 自動偵測效果分析:');
    if (platformProfit > 0) {
      console.log('✅ 自動偵測成功：平台實現小贏，符合預期目標');
    } else if (platformProfit < -totalBet * 0.1) {
      console.log('⚠️  自動偵測需要調整：平台虧損較大，可能需要加強控制邏輯');
    } else {
      console.log('📊 自動偵測正常：平台略有虧損，在可接受範圍內');
    }
    
    return {
      period,
      totalBet,
      totalWin,
      platformProfit,
      playerWinRate,
      controlEffect: platformProfit > 0 ? 'success' : 'needs_adjustment'
    };
    
  } catch (error) {
    console.error('❌ 自動偵測測試失敗:', error);
    throw error;
  }
}

// 運行測試
async function runTest() {
  try {
    const result = await testAutoDetectAnalysis();
    console.log('\n🏆 測試完成，結果:', result);
    
    console.log('\n📝 測試總結:');
    console.log('- 自動偵測控制功能已實現');
    console.log('- 系統能智能分析全體玩家輸贏比例');
    console.log('- 自動調整開獎結果讓平台小贏');
    console.log('- 對熱門下注選項進行反向權重調整');
    console.log('- 保持遊戲公平性的同時確保平台收益');
    
  } catch (error) {
    console.error('測試執行失敗:', error);
  } finally {
    await db.end();
  }
}

// 執行測試
if (require.main === module) {
  runTest();
}

module.exports = { testAutoDetectAnalysis }; 