const { Client } = require('pg');

// 生產環境資料庫連線設定
const dbConfig = {
  host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
  port: 5432,
  database: 'bet_game',
  user: 'bet_game_user',
  password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
  ssl: {
    rejectUnauthorized: false
  }
};

async function checkProductionControl() {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log('✅ 連線生產環境資料庫成功\n');
    
    // 1. 檢查當前遊戲狀態
    console.log('🎮 檢查當前遊戲狀態...');
    const gameStateQuery = await client.query('SELECT * FROM game_state ORDER BY id DESC LIMIT 1');
    if (gameStateQuery.rows.length > 0) {
      const state = gameStateQuery.rows[0];
      console.log(`📅 當前期數: ${state.current_period}`);
      console.log(`⏰ 狀態: ${state.status}`);
      console.log(`⏱️ 倒計時: ${state.countdown}秒`);
    }
    
    // 2. 檢查活躍的輸贏控制
    console.log('\n🎯 檢查活躍的輸贏控制...');
    const activeControlQuery = await client.query(`
      SELECT * FROM win_loss_control 
      WHERE is_active = true 
      ORDER BY created_at DESC
    `);
    
    if (activeControlQuery.rows.length > 0) {
      console.log(`找到 ${activeControlQuery.rows.length} 個活躍控制:`);
      activeControlQuery.rows.forEach((control, index) => {
        console.log(`${index + 1}. ID:${control.id} 目標:${control.target_type} ${control.target_username || '全體'} 類型:${control.win_control ? '贏' : '輸'}控制 比例:${control.control_percentage}% 開始期數:${control.start_period}`);
      });
    } else {
      console.log('❌ 沒有找到活躍的輸贏控制');
    }
    
    // 3. 檢查justin111最近的投注和結果
    console.log('\n💰 檢查justin111最近的投注...');
    const recentBetsQuery = await client.query(`
      SELECT 
        bh.*,
        rh.result
      FROM bet_history bh
      LEFT JOIN result_history rh ON bh.period = rh.period
      WHERE bh.username = 'justin111'
      ORDER BY bh.period DESC, bh.created_at DESC
      LIMIT 10
    `);
    
    if (recentBetsQuery.rows.length > 0) {
      console.log('最近10筆投注記錄:');
      recentBetsQuery.rows.forEach(bet => {
        const result = bet.result || [];
        let analysis = '';
        
        if (bet.bet_type === 'fifth' && result.length >= 5) {
          const fifthResult = result[4];
          const betNumber = parseInt(bet.bet_value);
          analysis = `第5名開出${fifthResult}，投注${betNumber}${fifthResult === betNumber ? '✅中' : '❌不中'}`;
        } else if (bet.bet_type === 'number' && result.length >= 10) {
          const betNumber = parseInt(bet.bet_value);
          const hit = result.includes(betNumber);
          analysis = `投注${betNumber}號${hit ? '✅包含在結果中' : '❌不在結果中'}`;
        } else {
          analysis = `${bet.bet_type} ${bet.bet_value}`;
        }
        
        console.log(`期數${bet.period}: ${analysis}, 金額${bet.amount}, ${bet.settled ? (bet.win ? '贏' : '輸') : '未結算'}`);
      });
    } else {
      console.log('❌ 沒有找到投注記錄');
    }
    
    // 4. 檢查最近的開獎記錄
    console.log('\n🎲 檢查最近的開獎記錄...');
    const recentResultsQuery = await client.query(`
      SELECT period, result 
      FROM result_history 
      ORDER BY period DESC 
      LIMIT 5
    `);
    
    if (recentResultsQuery.rows.length > 0) {
      console.log('最近5期開獎:');
      recentResultsQuery.rows.forEach(record => {
        if (record.result && record.result.length >= 5) {
          console.log(`期數${record.period}: 第5名=${record.result[4]}, 完整=[${record.result.join(', ')}]`);
        }
      });
    }
    
    // 5. 總結問題
    console.log('\n📊 問題分析總結:');
    
    const controlStats = activeControlQuery.rows.find(c => c.target_username === 'justin111');
    if (controlStats) {
      console.log(`✅ justin111有活躍的${controlStats.win_control ? '贏' : '輸'}控制(${controlStats.control_percentage}%)`);
      
      const controlledBets = recentBetsQuery.rows.filter(bet => 
        parseInt(bet.period) >= parseInt(controlStats.start_period) && bet.settled
      );
      
      if (controlledBets.length > 0) {
        const winCount = controlledBets.filter(bet => bet.win).length;
        const winRate = (winCount / controlledBets.length * 100).toFixed(1);
        
        console.log(`📈 控制期間勝率: ${winRate}% (${winCount}/${controlledBets.length})`);
        
        if (controlStats.win_control && parseFloat(winRate) < 70) {
          console.log('❌ 贏控制明顯失效！實際勝率遠低於預期');
          console.log('🔧 建議檢查:');
          console.log('   1. 生產環境是否已重啟應用最新代碼');
          console.log('   2. checkWinLossControl函數是否正常觸發');
          console.log('   3. calculateTargetControlWeights函數是否正確計算權重');
          console.log('   4. generateWeightedResult函數是否使用了權重');
        } else if (controlStats.win_control && parseFloat(winRate) >= 80) {
          console.log('✅ 贏控制運作正常');
        }
      }
    } else {
      console.log('❌ justin111沒有活躍的輸贏控制');
    }
    
  } catch (error) {
    console.error('❌ 檢查過程中發生錯誤:', error.message);
  } finally {
    await client.end();
  }
}

checkProductionControl(); 