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

async function testJustin111Control() {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log('✅ 生產環境資料庫連線成功');
    
    // 檢查當前遊戲狀態
    const gameStateResult = await client.query(`
      SELECT * FROM game_state 
      ORDER BY id DESC 
      LIMIT 1
    `);
    
    if (gameStateResult.rows.length > 0) {
      const gameState = gameStateResult.rows[0];
      console.log(`📅 當前遊戲狀態: 期數=${gameState.current_period}, 狀態=${gameState.status}`);
    }
    
    // 檢查justin111的活躍輸贏控制
    const controlResult = await client.query(`
      SELECT * FROM win_loss_control 
      WHERE target_type = 'member' 
      AND target_username = 'justin111'
      AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    console.log(`\n🔍 查詢會員justin111的輸贏控制...`);
    
    if (controlResult.rows.length > 0) {
      const control = controlResult.rows[0];
      console.log('🎯 找到活躍的輸贏控制:', {
        id: control.id,
        target_username: control.target_username,
        win_control: control.win_control,
        loss_control: control.loss_control,
        control_percentage: control.control_percentage,
        start_period: control.start_period,
        created_at: control.created_at
      });
      
      // 檢查該會員最近的投注記錄
      const betResult = await client.query(`
        SELECT * FROM bet_history 
        WHERE username = 'justin111' 
        ORDER BY period DESC, created_at DESC
        LIMIT 20
      `);
      
      console.log(`\n💰 查詢會員justin111的投注記錄...`);
      
      if (betResult.rows.length > 0) {
        console.log('📊 該會員最近的投注記錄:');
        betResult.rows.forEach(bet => {
          console.log(`  期數${bet.period}: ${bet.bet_type} ${bet.bet_value}, 金額${bet.amount}, ${bet.settled ? (bet.win ? '贏' : '輸') : '未結算'}`);
        });
        
        // 檢查第5名投注
        const fifthBets = betResult.rows.filter(bet => bet.bet_type === 'fifth');
        if (fifthBets.length > 0) {
          console.log('\n🎯 分析第5名投注的控制效果:');
          for (const bet of fifthBets) {
            const resultQuery = await client.query(`
              SELECT result FROM result_history 
              WHERE period = $1
            `, [bet.period]);
            
            if (resultQuery.rows.length > 0) {
              const result = resultQuery.rows[0].result;
              if (result && result.length >= 5) {
                const fifthPosition = result[4];
                const shouldWin = control.win_control;
                const shouldLose = control.loss_control;
                
                let controlStatus = '❓未知';
                if (shouldWin && parseInt(bet.bet_value) === fifthPosition) {
                  controlStatus = '✅控制生效 (贏控制成功)';
                } else if (shouldLose && parseInt(bet.bet_value) !== fifthPosition) {
                  controlStatus = '✅控制生效 (輸控制成功)';
                } else if (shouldWin && parseInt(bet.bet_value) !== fifthPosition) {
                  controlStatus = '❌控制失效 (應該贏但沒中)';
                } else if (shouldLose && parseInt(bet.bet_value) === fifthPosition) {
                  controlStatus = '❌控制失效 (應該輸但中了)';
                }
                
                console.log(`  期數${bet.period}: 投注${bet.bet_value}號, 第5名開出${fifthPosition}號 ${controlStatus}`);
              }
            }
          }
        } else {
          console.log('📝 該會員沒有第5名的投注記錄');
        }
        
        // 檢查控制開始期數以後的整體勝率
        const controlStartPeriod = control.start_period;
        const controlledBets = betResult.rows.filter(bet => 
          parseInt(bet.period) >= parseInt(controlStartPeriod) && bet.settled
        );
        
        if (controlledBets.length > 0) {
          console.log(`\n📈 控制期間(${controlStartPeriod}期開始後)的整體投注分析:`);
          let winCount = 0;
          let totalBets = controlledBets.length;
          
          controlledBets.forEach(bet => {
            if (bet.win) winCount++;
          });
          
          const winRate = totalBets > 0 ? (winCount / totalBets * 100).toFixed(1) : 0;
          console.log(`  總投注: ${totalBets}筆, 勝率: ${winRate}%`);
          
          if (control.win_control && parseFloat(winRate) < 80) {
            console.log('⚠️ 贏控制可能沒有生效，勝率偏低');
          } else if (control.loss_control && parseFloat(winRate) > 20) {
            console.log('⚠️ 輸控制可能沒有生效，勝率偏高');
          } else if (control.win_control && parseFloat(winRate) >= 80) {
            console.log('✅ 贏控制運作正常，勝率符合預期');
          } else if (control.loss_control && parseFloat(winRate) <= 20) {
            console.log('✅ 輸控制運作正常，勝率符合預期');
          }
        }
        
      } else {
        console.log('📝 該會員沒有投注記錄');
      }
      
    } else {
      console.log('⚠️ 沒有找到針對justin111會員的活躍輸贏控制');
    }
    
    // 檢查最近的開獎記錄
    console.log('\n🎲 檢查最近的開獎記錄...');
    const historyResult = await client.query(`
      SELECT period, result 
      FROM result_history 
      ORDER BY period DESC
      LIMIT 5
    `);
    
    if (historyResult.rows.length > 0) {
      console.log('📊 最近5期開獎記錄:');
      historyResult.rows.forEach(record => {
        if (record.result && record.result.length >= 5) {
          console.log(`  期數${record.period}: 第5名=${record.result[4]}, 完整=[${record.result.join(', ')}]`);
        } else {
          console.log(`  期數${record.period}: 結果=${record.result}`);
        }
      });
    } else {
      console.log('📝 沒有找到開獎記錄');
    }
    
  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error.message);
    console.error('錯誤詳情:', error);
  } finally {
    await client.end();
  }
}

// 執行測試
testJustin111Control(); 