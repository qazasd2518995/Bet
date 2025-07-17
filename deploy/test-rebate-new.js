import fetch from 'node-fetch';
import db from './db/config.js';

const GAME_API_URL = 'http://localhost:3000';

async function testRebateLogic() {
  try {
    console.log('=== 退水機制測試開始 ===');
    
    // 1. 檢查測試前的代理餘額
    console.log('\n1. 測試前代理餘額檢查：');
    const beforeBalances = await db.any(`
      SELECT username, balance 
      FROM agents 
      WHERE username IN ($1, $2) 
      ORDER BY level DESC
    `, ['ti2025A', 'justin2025A']);
    
    for (const agent of beforeBalances) {
      console.log(`${agent.username}: ${agent.balance}`);
    }
    
    // 2. 檢查會員餘額
    console.log('\n2. 檢查會員餘額：');
    const member = await db.oneOrNone('SELECT username, balance FROM members WHERE username = $1', ['justin111']);
    if (member) {
      console.log(`${member.username}: ${member.balance}`);
    }
    
    // 3. 確保會員有足夠餘額
    if (parseFloat(member.balance) < 1000) {
      console.log('會員餘額不足，先增加餘額...');
      await db.none('UPDATE members SET balance = balance + $1 WHERE username = $2', [1000, 'justin111']);
      console.log('已增加會員餘額');
    }
    
    // 4. 模擬下注
    console.log('\n3. 模擬下注 500 元：');
    const betData = {
      username: 'justin111',
      betType: 'number',
      position: 1, // 冠軍
      value: '5',
      amount: 500
    };
    
    console.log('發送下注請求...', betData);
    
    try {
      const betResponse = await fetch(`${GAME_API_URL}/api/bet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(betData)
      });
      
      const betResult = await betResponse.json();
      console.log('下注結果:', betResult);
      
      if (betResult.success) {
        // 5. 等待一段時間讓退水分配完成
        console.log('\n4. 等待退水分配（3秒）...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 6. 檢查測試後的代理餘額
        console.log('\n5. 測試後代理餘額檢查：');
        const afterBalances = await db.any(`
          SELECT username, balance 
          FROM agents 
          WHERE username IN ($1, $2) 
          ORDER BY level DESC
        `, ['ti2025A', 'justin2025A']);
        
        console.log('\n餘額變化：');
        for (let i = 0; i < beforeBalances.length; i++) {
          const before = parseFloat(beforeBalances[i].balance);
          const after = parseFloat(afterBalances[i].balance);
          const change = after - before;
          console.log(`${beforeBalances[i].username}: ${before} -> ${after} (變化: ${change > 0 ? '+' : ''}${change.toFixed(2)})`);
        }
        
        // 7. 檢查最新的退水記錄
        console.log('\n6. 最新退水記錄：');
        const latestRebates = await db.any(`
          SELECT user_id, amount, description, created_at
          FROM transaction_records 
          WHERE description LIKE '%退水%' 
          ORDER BY created_at DESC 
          LIMIT 5
        `);
        
        for (const rebate of latestRebates) {
          const agentInfo = await db.oneOrNone('SELECT username FROM agents WHERE id = $1', [rebate.user_id]);
          const agentName = agentInfo ? agentInfo.username : '未知';
          console.log(`${rebate.created_at}: ${agentName}, 金額=${rebate.amount}, 描述=${rebate.description}`);
        }
        
        // 8. 驗證退水邏輯是否正確
        console.log('\n7. 邏輯驗證：');
        console.log('預期結果（A盤，最大退水1.1%）：');
        console.log('- 總退水池：500 × 1.1% = 5.5元');
        console.log('- justin2025A (0.5%)：500 × 0.5% = 2.5元');
        console.log('- ti2025A (1.0%)：500 × (1.0% - 0.5%) = 2.5元');
        
      } else {
        console.error('下注失敗:', betResult.message);
      }
      
    } catch (fetchError) {
      console.error('API調用失敗:', fetchError.message);
    }
    
    await db.$pool.end();
    
  } catch (error) {
    console.error('測試過程中發生錯誤:', error);
    await db.$pool.end();
    process.exit(1);
  }
}

testRebateLogic();
