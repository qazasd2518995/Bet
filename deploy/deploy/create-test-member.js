// create-test-member.js - 創建測試會員
import db from './db/config.js';
import dotenv from 'dotenv';

dotenv.config();

async function createTestMember() {
  try {
    console.log('開始創建測試會員...');
    
    // 1. 查找總代理
    const adminAgent = await db.oneOrNone('SELECT * FROM agents WHERE level = 0 LIMIT 1');
    
    if (!adminAgent) {
      console.error('未找到總代理，請先初始化代理系統');
      return;
    }
    
    console.log(`找到總代理: ${adminAgent.username} (ID: ${adminAgent.id})`);
    
    // 2. 檢查測試會員是否已存在
    const existingMember = await db.oneOrNone('SELECT * FROM members WHERE username = $1', ['testuser']);
    
    if (existingMember) {
      console.log('測試會員已存在，更新密碼和餘額...');
      
      // 更新密碼和餘額
      await db.none(`
        UPDATE members 
        SET password = $1, balance = $2, status = 1
        WHERE username = $3
      `, ['123456', 10000, 'testuser']);
      
      console.log('測試會員已更新：');
      console.log('帳號: testuser');
      console.log('密碼: 123456');
      console.log('餘額: 10000');
      
    } else {
      console.log('創建新的測試會員...');
      
      // 創建測試會員
      await db.none(`
        INSERT INTO members (username, password, agent_id, balance, status)
        VALUES ($1, $2, $3, $4, $5)
      `, ['testuser', '123456', adminAgent.id, 10000, 1]);
      
      console.log('測試會員創建成功：');
      console.log('帳號: testuser');
      console.log('密碼: 123456');
      console.log('餘額: 10000');
      console.log(`代理: ${adminAgent.username}`);
    }
    
    // 3. 創建更多測試會員
    const testMembers = [
      { username: 'member001', password: 'pass001', balance: 5000 },
      { username: 'member002', password: 'pass002', balance: 8000 },
      { username: 'player123', password: 'player123', balance: 15000 }
    ];
    
    for (const member of testMembers) {
      const existing = await db.oneOrNone('SELECT * FROM members WHERE username = $1', [member.username]);
      
      if (!existing) {
        await db.none(`
          INSERT INTO members (username, password, agent_id, balance, status)
          VALUES ($1, $2, $3, $4, $5)
        `, [member.username, member.password, adminAgent.id, member.balance, 1]);
        
        console.log(`創建會員: ${member.username} (密碼: ${member.password}, 餘額: ${member.balance})`);
      } else {
        console.log(`會員已存在: ${member.username}`);
      }
    }
    
    // 4. 顯示所有會員
    const allMembers = await db.any('SELECT username, balance, status FROM members ORDER BY id');
    
    console.log('\n所有會員列表：');
    console.log('='.repeat(50));
    allMembers.forEach(member => {
      console.log(`${member.username} - 餘額: ${member.balance} - 狀態: ${member.status === 1 ? '啟用' : '停用'}`);
    });
    console.log('='.repeat(50));
    
    console.log('\n✅ 測試會員創建完成！');
    console.log('\n可以使用以下帳號登入遊戲：');
    console.log('帳號: testuser, 密碼: 123456');
    console.log('帳號: member001, 密碼: pass001');
    console.log('帳號: member002, 密碼: pass002');
    console.log('帳號: player123, 密碼: player123');
    
  } catch (error) {
    console.error('創建測試會員失敗:', error);
  } finally {
    process.exit(0);
  }
}

// 如果直接運行此腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  createTestMember();
}

export default createTestMember; 