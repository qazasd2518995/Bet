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

async function checkProductionTables() {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log('✅ 生產環境資料庫連線成功');
    
    // 檢查所有表
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📋 生產環境中的所有表:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // 檢查是否有輸贏控制表
    const hasWinLossControl = tablesResult.rows.some(row => row.table_name === 'win_loss_control');
    if (hasWinLossControl) {
      console.log('\n🎯 檢查輸贏控制表...');
      
      const controlResult = await client.query(`
        SELECT * FROM win_loss_control 
        ORDER BY created_at DESC
        LIMIT 5
      `);
      
      if (controlResult.rows.length > 0) {
        console.log('📊 最近的輸贏控制記錄:');
        controlResult.rows.forEach(control => {
          console.log(`  ID${control.id}: ${control.target_type}=${control.target_username}, ${control.win_control ? '贏控制' : '輸控制'}${control.control_percentage}%, 活躍=${control.is_active}`);
        });
      } else {
        console.log('📝 沒有輸贏控制記錄');
      }
    }
    
    // 檢查是否有投注記錄表
    const hasBetHistory = tablesResult.rows.some(row => row.table_name === 'bet_history');
    if (hasBetHistory) {
      console.log('\n💰 檢查投注記錄表...');
      
      const betResult = await client.query(`
        SELECT username, bet_type, bet_value, period, settled, win
        FROM bet_history 
        WHERE username = 'titi'
        ORDER BY period DESC, created_at DESC
        LIMIT 10
      `);
      
      if (betResult.rows.length > 0) {
        console.log('📊 titi用戶最近的投注記錄:');
        betResult.rows.forEach(bet => {
          console.log(`  期數${bet.period}: ${bet.bet_type} ${bet.bet_value}, ${bet.settled ? (bet.win ? '贏' : '輸') : '未結算'}`);
        });
      } else {
        console.log('📝 沒有找到titi用戶的投注記錄');
      }
    }
    
    // 檢查是否有開獎記錄表
    const hasGameHistory = tablesResult.rows.some(row => row.table_name === 'game_history');
    if (hasGameHistory) {
      console.log('\n🎲 檢查開獎記錄表...');
      
      const historyResult = await client.query(`
        SELECT period, result 
        FROM game_history 
        ORDER BY period DESC
        LIMIT 5
      `);
      
      if (historyResult.rows.length > 0) {
        console.log('📊 最近的開獎記錄:');
        historyResult.rows.forEach(record => {
          if (record.result && record.result.length >= 5) {
            console.log(`  期數${record.period}: 第5名=${record.result[4]}, 完整=[${record.result.join(', ')}]`);
          } else {
            console.log(`  期數${record.period}: 結果=${record.result}`);
          }
        });
      } else {
        console.log('📝 沒有開獎記錄');
      }
    }
    
    // 檢查遊戲狀態相關的表
    const gameStatusTables = tablesResult.rows.filter(row => 
      row.table_name.includes('game') || 
      row.table_name.includes('status') ||
      row.table_name.includes('period')
    );
    
    if (gameStatusTables.length > 0) {
      console.log('\n🎮 遊戲狀態相關的表:');
      gameStatusTables.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 檢查過程中發生錯誤:', error.message);
  } finally {
    await client.end();
  }
}

// 執行檢查
checkProductionTables(); 