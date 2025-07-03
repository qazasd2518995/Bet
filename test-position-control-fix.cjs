#!/usr/bin/env node
const { Client } = require('pg');

// 資料庫配置 - Render PostgreSQL
const dbConfig = {
  host: 'dpg-ct4n3452ng1s73aijre0-a.oregon-postgres.render.com',
  port: 5432,
  database: 'extremecar_db',
  user: 'extremecar_db_user',
  password: 'BgcxcARrdqrtMKD0k9k6cN35eAmLODUa',
  ssl: { rejectUnauthorized: false }
};

// 測試用戶和控制設定
const TEST_CONFIG = {
  testMember: 'testmember_position',
  testAgent: 'ti2025D',
  testPeriod: Date.now().toString().slice(-8), // 8位測試期數
  
  // 測試不同名次的控制
  testCases: [
    { position: 3, number: 7, controlType: 'win', description: '第三名7號100%贏控制' },
    { position: 5, number: 2, controlType: 'win', description: '第五名2號100%贏控制' },
    { position: 8, number: 9, controlType: 'loss', description: '第八名9號100%輸控制' },
    { position: 10, number: 4, controlType: 'loss', description: '第十名4號100%輸控制' }
  ]
};

class PositionControlTester {
  constructor() {
    this.db = null;
  }

  async init() {
    console.log('🔧 初始化資料庫連接...');
    this.db = new Client(dbConfig);
    await this.db.connect();
    console.log('✅ 資料庫連接成功');
  }

  async cleanup() {
    if (this.db) {
      await this.db.end();
      console.log('🔒 資料庫連接已關閉');
    }
  }

  // 清理測試數據
  async cleanupTestData() {
    console.log('🧹 清理測試數據...');
    
    try {
      // 刪除測試會員
      await this.db.query('DELETE FROM members WHERE username = $1', [TEST_CONFIG.testMember]);
      
      // 刪除測試下注記錄
      await this.db.query('DELETE FROM bet_history WHERE username = $1', [TEST_CONFIG.testMember]);
      
      // 刪除測試控制設定
      await this.db.query(`
        DELETE FROM win_loss_control 
        WHERE target_username = $1 OR start_period = $2
      `, [TEST_CONFIG.testMember, TEST_CONFIG.testPeriod]);
      
      console.log('✅ 測試數據清理完成');
    } catch (error) {
      console.warn('⚠️ 清理測試數據時出現警告:', error.message);
    }
  }

  // 創建測試會員
  async createTestMember() {
    console.log('👤 創建測試會員...');
    
    // 獲取代理ID
    const agentResult = await this.db.query('SELECT id FROM agents WHERE username = $1', [TEST_CONFIG.testAgent]);
    if (agentResult.rows.length === 0) {
      throw new Error(`找不到代理: ${TEST_CONFIG.testAgent}`);
    }
    const agentId = agentResult.rows[0].id;
    
    // 創建測試會員
    await this.db.query(`
      INSERT INTO members (username, password, balance, agent_id, status, market_type, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (username) DO UPDATE SET 
        balance = $3, agent_id = $4, status = $5, market_type = $6
    `, [TEST_CONFIG.testMember, 'test123', 10000, agentId, 'active', 'D']);
    
    console.log(`✅ 測試會員創建成功: ${TEST_CONFIG.testMember}`);
  }

  // 創建測試下注記錄
  async createTestBets() {
    console.log('💰 創建測試下注記錄...');
    
    for (const testCase of TEST_CONFIG.testCases) {
      await this.db.query(`
        INSERT INTO bet_history (
          username, period, bet_type, position, bet_value, amount, odds, 
          settled, win, win_amount, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      `, [
        TEST_CONFIG.testMember,
        TEST_CONFIG.testPeriod,
        'number',                    // bet_type
        testCase.position,           // position
        testCase.number,             // bet_value
        1000,                        // amount
        9.59,                        // odds (D盤單號賠率)
        false,                       // settled
        false,                       // win
        0                            // win_amount
      ]);
      
      console.log(`📝 下注記錄創建: ${testCase.description} - 位置${testCase.position}號碼${testCase.number}`);
    }
    
    console.log('✅ 所有測試下注記錄創建完成');
  }

  // 創建控制設定並測試
  async testPositionControl() {
    console.log('🎯 開始測試不同名次的控制效果...');
    
    const results = [];
    
    for (const testCase of TEST_CONFIG.testCases) {
      console.log(`\n🧪 測試: ${testCase.description}`);
      
      // 創建控制設定
      const controlResult = await this.db.query(`
        INSERT INTO win_loss_control (
          mode, target_username, win_control, loss_control, 
          control_percentage, start_period, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id
      `, [
        'single_member',
        TEST_CONFIG.testMember,
        testCase.controlType === 'win',  // win_control
        testCase.controlType === 'loss', // loss_control
        100,                             // control_percentage
        TEST_CONFIG.testPeriod,          // start_period
        'active'                         // status
      ]);
      
      const controlId = controlResult.rows[0].id;
      console.log(`✅ 控制設定創建成功 (ID: ${controlId})`);
      
      // 測試開獎生成多次
      const testResults = [];
      for (let attempt = 1; attempt <= 10; attempt++) {
        try {
          // 調用後端API測試控制效果
          const response = await fetch('http://localhost:3000/api/test-control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              period: TEST_CONFIG.testPeriod,
              testMode: true
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            const result = data.result;
            
            if (result && result.length >= testCase.position) {
              const actualNumber = result[testCase.position - 1]; // 轉為0-based索引
              const isControlled = (actualNumber === testCase.number);
              
              testResults.push({
                attempt,
                actualNumber,
                expectedNumber: testCase.number,
                isControlled,
                fullResult: result
              });
              
              console.log(`  第${attempt}次: 位置${testCase.position} = ${actualNumber} ${isControlled ? '✅控制成功' : '❌控制失效'}`);
            }
          }
        } catch (error) {
          console.error(`  第${attempt}次測試失敗:`, error.message);
        }
      }
      
      // 計算控制成功率
      const successCount = testResults.filter(r => r.isControlled).length;
      const successRate = (successCount / testResults.length) * 100;
      
      results.push({
        testCase,
        successCount,
        totalAttempts: testResults.length,
        successRate,
        results: testResults
      });
      
      console.log(`📊 ${testCase.description} 控制成功率: ${successCount}/${testResults.length} (${successRate.toFixed(1)}%)`);
      
      // 刪除本次控制設定
      await this.db.query('DELETE FROM win_loss_control WHERE id = $1', [controlId]);
    }
    
    return results;
  }

  // 生成測試報告
  generateReport(results) {
    console.log('\n' + '='.repeat(80));
    console.log('📋 第3-10名控制輸贏測試報告');
    console.log('='.repeat(80));
    
    let overallSuccess = 0;
    let overallTotal = 0;
    
    results.forEach((result, index) => {
      const { testCase, successCount, totalAttempts, successRate } = result;
      
      console.log(`\n${index + 1}. ${testCase.description}`);
      console.log(`   位置: 第${testCase.position}名`);
      console.log(`   號碼: ${testCase.number}`);
      console.log(`   控制類型: ${testCase.controlType === 'win' ? '100%贏控制' : '100%輸控制'}`);
      console.log(`   成功率: ${successCount}/${totalAttempts} (${successRate.toFixed(1)}%)`);
      console.log(`   狀態: ${successRate >= 80 ? '✅ 控制有效' : successRate >= 50 ? '⚠️ 控制部分有效' : '❌ 控制失效'}`);
      
      overallSuccess += successCount;
      overallTotal += totalAttempts;
    });
    
    const overallSuccessRate = (overallSuccess / overallTotal) * 100;
    
    console.log('\n' + '-'.repeat(80));
    console.log(`📈 總體控制成功率: ${overallSuccess}/${overallTotal} (${overallSuccessRate.toFixed(1)}%)`);
    
    if (overallSuccessRate >= 80) {
      console.log('🎉 修復成功！第3-10名控制輸贏功能正常工作');
    } else if (overallSuccessRate >= 50) {
      console.log('⚠️ 部分修復！控制效果有所改善但仍需優化');
    } else {
      console.log('❌ 修復失效！第3-10名控制輸贏功能仍有問題');
    }
    
    console.log('='.repeat(80));
  }

  async run() {
    try {
      await this.init();
      await this.cleanupTestData();
      await this.createTestMember();
      await this.createTestBets();
      
      const results = await this.testPositionControl();
      this.generateReport(results);
      
      await this.cleanupTestData();
      
    } catch (error) {
      console.error('❌ 測試執行失敗:', error);
    } finally {
      await this.cleanup();
    }
  }
}

// 執行測試
if (require.main === module) {
  const tester = new PositionControlTester();
  tester.run().catch(console.error);
}

module.exports = PositionControlTester; 