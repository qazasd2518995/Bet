import db from './db/config.js';

async function testCascadingBettingLimitAdjustment() {
  try {
    console.log('=== 測試限紅等級連鎖調整功能 ===\n');
    
    // 1. 先查看代理 A01agent (ID: 31) 及其下級的當前限紅等級
    console.log('1. 查看 A01agent 及其下級的當前限紅等級:');
    
    const agent31 = await db.oneOrNone(`
      SELECT id, username, level, betting_limit_level, parent_id
      FROM agents
      WHERE id = 31
    `);
    
    console.log(`\n主代理: ${agent31.username} (ID: ${agent31.id})`);
    console.log(`  - 層級: ${agent31.level}級代理`);
    console.log(`  - 當前限紅等級: ${agent31.betting_limit_level}`);
    
    // 查看其下級代理
    const childAgents = await db.any(`
      SELECT id, username, level, betting_limit_level
      FROM agents
      WHERE parent_id = 31
      ORDER BY level, username
    `);
    
    console.log(`\n下級代理 (共 ${childAgents.length} 個):`);
    for (const child of childAgents) {
      console.log(`  - ${child.username} (ID: ${child.id}): ${child.level}級代理, 限紅等級: ${child.betting_limit_level}`);
    }
    
    // 查看其會員
    const members = await db.any(`
      SELECT id, username, betting_limit_level
      FROM members
      WHERE agent_id = 31
      ORDER BY username
    `);
    
    console.log(`\n直屬會員 (共 ${members.length} 個):`);
    for (const member of members) {
      console.log(`  - ${member.username} (ID: ${member.id}): 限紅等級: ${member.betting_limit_level}`);
    }
    
    // 2. 模擬調整 A01agent 的限紅等級從 level4 調降到 level2
    console.log('\n\n2. 模擬調整 A01agent 的限紅等級從 level4 調降到 level2...');
    console.log('   (實際調整將通過 API 進行，這裡只是查看預期結果)');
    
    const levelOrder = {
      'level1': 1,
      'level2': 2,
      'level3': 3,
      'level4': 4,
      'level5': 5,
      'level6': 6
    };
    
    const newLevel = 'level2';
    console.log(`\n預期連鎖調整結果:`);
    
    // 檢查哪些下級需要被調整
    let adjustmentCount = 0;
    
    for (const child of childAgents) {
      if (levelOrder[child.betting_limit_level] > levelOrder[newLevel]) {
        console.log(`  ✓ 代理 ${child.username} 將從 ${child.betting_limit_level} 調整為 ${newLevel}`);
        adjustmentCount++;
      } else {
        console.log(`  - 代理 ${child.username} 維持 ${child.betting_limit_level} (未超過新限制)`);
      }
    }
    
    for (const member of members) {
      if (levelOrder[member.betting_limit_level] > levelOrder[newLevel]) {
        console.log(`  ✓ 會員 ${member.username} 將從 ${member.betting_limit_level} 調整為 ${newLevel}`);
        adjustmentCount++;
      } else {
        console.log(`  - 會員 ${member.username} 維持 ${member.betting_limit_level} (未超過新限制)`);
      }
    }
    
    console.log(`\n總計將有 ${adjustmentCount} 個下級需要連鎖調整`);
    
    // 3. 建議測試步驟
    console.log('\n\n3. 建議測試步驟:');
    console.log('   a. 在前端使用總代理帳號登入');
    console.log('   b. 找到 A01agent 並點擊"限紅設定"');
    console.log('   c. 將限紅等級從 level4 調整為 level2');
    console.log('   d. 確認後檢查所有下級的限紅等級是否正確調整');
    console.log('   e. 查看 transaction_records 表中的調整記錄');
    
    console.log('\n=== 測試腳本執行完成 ===');
    
  } catch (error) {
    console.error('測試執行失敗:', error);
  } finally {
    await db.$pool.end();
  }
}

testCascadingBettingLimitAdjustment();