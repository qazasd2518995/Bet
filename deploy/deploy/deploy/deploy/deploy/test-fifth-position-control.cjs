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

async function testFifthPositionControl() {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log('✅ 生產環境資料庫連線成功');
    
    // 檢查當前期數
    const periodResult = await client.query(`
      SELECT current_period, status, 
             EXTRACT(EPOCH FROM (phase_start_time + INTERVAL '60 seconds' - NOW())) as countdown_seconds
      FROM game_status 
      ORDER BY id DESC 
      LIMIT 1
    `);
    
    const currentPeriod = periodResult.rows[0]?.current_period;
    console.log(`📅 當前期數: ${currentPeriod}`);
    
    // 檢查最近的期數和結果
    const recentResults = await client.query(`
      SELECT period, result FROM game_history 
      ORDER BY period DESC 
      LIMIT 5
    `);
    
    console.log('📊 最近5期開獎結果:');
    recentResults.rows.forEach(row => {
      if (row.result && row.result.length >= 5) {
        console.log(`  期數${row.period}: 第5名=${row.result[4]}, 完整結果=[${row.result.join(', ')}]`);
      }
    });
    
    // 檢查是否有針對會員titi的輸贏控制
    const controlResult = await client.query(`
      SELECT * FROM win_loss_control 
      WHERE target_type = 'member' 
      AND target_username = 'titi'
      AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    console.log(`\n🔍 查詢會員titi的輸贏控制...`);
    
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
      
      // 檢查該會員最近的第5名投注
      const betResult = await client.query(`
        SELECT * FROM bet_history 
        WHERE username = 'titi' 
        AND bet_type = 'fifth'
        ORDER BY period DESC, created_at DESC
        LIMIT 10
      `);
      
      console.log(`\n💰 查詢會員titi的第5名投注記錄...`);
      
      if (betResult.rows.length > 0) {
        console.log('📊 該會員最近的第5名投注:');
        betResult.rows.forEach(bet => {
          console.log(`  期數${bet.period}: ${bet.bet_value}號, 金額${bet.amount}, 已結算=${bet.settled}, 結果=${bet.win ? '贏' : '輸'}`);
        });
        
        // 檢查最近有第5名10號投注的期數的開獎結果
        const tenBets = betResult.rows.filter(bet => bet.bet_value === '10');
        if (tenBets.length > 0) {
          console.log('\n🎯 分析第5名10號投注的控制效果:');
          for (const bet of tenBets) {
            const resultQuery = await client.query(`
              SELECT result FROM game_history 
              WHERE period = $1
            `, [bet.period]);
            
            if (resultQuery.rows.length > 0) {
              const result = resultQuery.rows[0].result;
              if (result && result.length >= 5) {
                const fifthPosition = result[4];
                const shouldWin = control.win_control;
                const shouldLose = control.loss_control;
                
                let controlStatus = '❓未知';
                if (shouldWin && fifthPosition === 10) {
                  controlStatus = '✅控制生效 (贏控制成功)';
                } else if (shouldLose && fifthPosition !== 10) {
                  controlStatus = '✅控制生效 (輸控制成功)';
                } else if (shouldWin && fifthPosition !== 10) {
                  controlStatus = '❌控制失效 (應該贏但沒中)';
                } else if (shouldLose && fifthPosition === 10) {
                  controlStatus = '❌控制失效 (應該輸但中了)';
                }
                
                console.log(`  期數${bet.period}: 第5名開出${fifthPosition}號 ${controlStatus}`);
              }
            }
          }
        } else {
          console.log('📝 該會員沒有第5名10號的投注記錄');
        }
        
        // 檢查控制開始期數以後的所有第5名投注
        const controlStartPeriod = control.start_period;
        const controlledBets = betResult.rows.filter(bet => 
          parseInt(bet.period) >= parseInt(controlStartPeriod)
        );
        
        if (controlledBets.length > 0) {
          console.log(`\n📈 控制期間(${controlStartPeriod}期開始後)的第5名投注分析:`);
          let winCount = 0;
          let totalBets = 0;
          
          for (const bet of controlledBets) {
            if (bet.settled) {
              totalBets++;
              if (bet.win) winCount++;
            }
          }
          
          const winRate = totalBets > 0 ? (winCount / totalBets * 100).toFixed(1) : 0;
          console.log(`  總投注: ${totalBets}筆, 勝率: ${winRate}%`);
          
          if (control.win_control && winRate < 80) {
            console.log('⚠️ 贏控制可能沒有生效，勝率偏低');
          } else if (control.loss_control && winRate > 20) {
            console.log('⚠️ 輸控制可能沒有生效，勝率偏高');
          }
        }
        
      } else {
        console.log('📝 該會員沒有第5名的投注記錄');
      }
    } else {
      console.log('⚠️ 沒有找到針對titi會員的活躍輸贏控制');
      
      // 檢查所有活躍控制
      const allControls = await client.query(`
        SELECT * FROM win_loss_control 
        WHERE is_active = true
        ORDER BY created_at DESC
        LIMIT 5
      `);
      
      if (allControls.rows.length > 0) {
        console.log('📋 當前活躍的輸贏控制:');
        allControls.rows.forEach(control => {
          console.log(`  ID${control.id}: ${control.target_type}=${control.target_username}, ${control.win_control ? '贏控制' : '輸控制'}${control.control_percentage}%`);
        });
      } else {
        console.log('📋 目前沒有任何活躍的輸贏控制');
      }
    }
    
    // 檢查期數20250703503的詳細資訊
    console.log(`\n🔍 檢查期數20250703503的詳細資訊...`);
    const specificPeriod = '20250703503';
    
    const periodBets = await client.query(`
      SELECT * FROM bet_history 
      WHERE period = $1 AND username = 'titi'
      ORDER BY created_at DESC
    `, [specificPeriod]);
    
    if (periodBets.rows.length > 0) {
      console.log(`期數${specificPeriod}的titi投注記錄:`);
      periodBets.rows.forEach(bet => {
        console.log(`  ${bet.bet_type} ${bet.bet_value}: ${bet.amount}元, 賠率${bet.odds}, ${bet.settled ? (bet.win ? '贏' : '輸') : '未結算'}`);
      });
      
      const periodResult = await client.query(`
        SELECT result FROM game_history WHERE period = $1
      `, [specificPeriod]);
      
      if (periodResult.rows.length > 0) {
        const result = periodResult.rows[0].result;
        console.log(`期數${specificPeriod}開獎結果: [${result.join(', ')}]`);
        if (result.length >= 5) {
          console.log(`第5名開出: ${result[4]}號`);
        }
      }
    } else {
      console.log(`期數${specificPeriod}沒有titi的投注記錄`);
    }
    
  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error.message);
    console.error('錯誤詳情:', error);
  } finally {
    await client.end();
  }
}

// 執行測試
testFifthPositionControl(); 