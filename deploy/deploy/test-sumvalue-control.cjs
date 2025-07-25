const { Client } = require('pg');

const db = new Client({
  host: process.env.DB_HOST || 'dpg-csaq3452ng1s73e3ufs0-a.oregon-postgres.render.com',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bet_db_x7hy',
  user: process.env.DB_USER || 'bet_db_x7hy_user',
  password: process.env.DB_PASSWORD || 'MNAZfCeBiWdF1EYQTBbMxOWdaYEUyicS',
  ssl: {
    rejectUnauthorized: false
  }
});

async function testSumValueControl() {
  try {
    await db.connect();
    console.log('🔗 資料庫連接成功');

    // 1. 清理測試數據
    console.log('\n📋 清理現有測試數據...');
    await db.query('DELETE FROM bet_history WHERE username = $1', ['testuser_sumvalue']);
    await db.query('DELETE FROM win_loss_control WHERE target_username = $1', ['testuser_sumvalue']);

    // 2. 創建測試會員餘額
    console.log('👤 設置測試會員餘額...');
    await db.query(`
      INSERT INTO members (username, balance, agent_id, market_type) 
      VALUES ($1, $2, 1, 'D') 
      ON CONFLICT (username) DO UPDATE SET balance = $2
    `, ['testuser_sumvalue', 10000]);

    // 3. 創建100%贏控制設定（針對冠亞和值7）
    const testPeriod = '20250103001';
    console.log(`\n🎯 創建100%贏控制設定 - 冠亞和值7 期數${testPeriod}`);
    
    const controlResult = await db.query(`
      INSERT INTO win_loss_control 
      (target_type, target_username, control_percentage, win_control, loss_control, start_period, created_by, is_active) 
      VALUES ('member', $1, 100, true, false, $2, 'admin', true)
      RETURNING id
    `, ['testuser_sumvalue', testPeriod]);
    
    const controlId = controlResult.rows[0].id;
    console.log(`✅ 控制設定創建成功，ID: ${controlId}`);

    // 4. 模擬會員下注冠亞和值7（金額1000）
    console.log('\n💰 模擬會員下注冠亞和值7...');
    await db.query(`
      INSERT INTO bet_history 
      (username, period, bet_type, bet_value, position, amount, odds, created_at, status, agent_id)
      VALUES ($1, $2, 'sumValue', '7', null, 1000, 10.88, NOW(), 'pending', 1)
    `, ['testuser_sumvalue', testPeriod]);

    console.log('✅ 下注記錄創建成功');

    // 5. 測試權重計算邏輯
    console.log('\n⚖️ 測試權重計算邏輯...');
    
    // 模擬權重計算
    const weights = {
      sumValue: new Array(17).fill(1) // 3-19 的權重數組
    };

    // 模擬控制邏輯
    const betValue = '7';
    const sumIndex = parseInt(betValue) - 3; // 7-3=4
    console.log(`📊 和值${betValue}對應索引: ${sumIndex}`);

    if (sumIndex >= 0 && sumIndex < 17) {
      weights.sumValue[sumIndex] *= 1000; // 100%控制增加1000倍權重
      console.log(`✅ 和值${betValue}權重增加至1000倍`);
    }

    console.log('權重數組狀態:');
    weights.sumValue.forEach((weight, index) => {
      const sumValue = index + 3;
      if (weight !== 1) {
        console.log(`  和值${sumValue}: 權重=${weight}`);
      }
    });

    // 6. 測試開獎結果生成
    console.log('\n🎲 測試開獎結果生成...');
    
    let controlHitCount = 0;
    const testRounds = 100;
    
    for (let round = 0; round < testRounds; round++) {
      // 簡化的開獎結果生成
      const result = [];
      for (let pos = 0; pos < 10; pos++) {
        result.push(Math.floor(Math.random() * 10) + 1);
      }
      
      const sumValue = result[0] + result[1]; // 冠軍+亞軍
      if (sumValue === 7) {
        controlHitCount++;
      }
    }
    
    console.log(`🎯 測試結果：${testRounds}次模擬中，和值7出現${controlHitCount}次 (${(controlHitCount/testRounds*100).toFixed(1)}%)`);
    console.log(`📈 理論期望：在100%控制下，應該有很高機率出現和值7`);

    // 7. 檢查現有控制設定
    console.log('\n🔍 檢查現有活躍控制設定...');
    const activeControls = await db.query(`
      SELECT id, target_username, control_percentage, win_control, loss_control, start_period, is_active
      FROM win_loss_control 
      WHERE is_active = true 
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (activeControls.rows.length > 0) {
      console.log('📋 活躍控制設定:');
      activeControls.rows.forEach(control => {
        console.log(`  ID:${control.id} 用戶:${control.target_username} 比例:${control.control_percentage}% 贏控制:${control.win_control} 期數:${control.start_period}`);
      });
    } else {
      console.log('⚠️ 沒有找到活躍的控制設定');
    }

    // 8. 檢查冠亞和值下注記錄
    console.log('\n📊 檢查冠亞和值下注記錄...');
    const sumValueBets = await db.query(`
      SELECT username, bet_type, bet_value, amount, period, created_at
      FROM bet_history 
      WHERE bet_type = 'sumValue' 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    if (sumValueBets.rows.length > 0) {
      console.log('💰 最近冠亞和值下注:');
      sumValueBets.rows.forEach(bet => {
        console.log(`  ${bet.username} 下注和值${bet.bet_value} 金額:${bet.amount} 期數:${bet.period}`);
      });
    } else {
      console.log('ℹ️ 沒有找到冠亞和值下注記錄');
    }

    console.log('\n✅ 冠亞和值控制測試完成');

  } catch (error) {
    console.error('❌ 測試出現錯誤:', error);
  } finally {
    await db.end();
  }
}

testSumValueControl(); 