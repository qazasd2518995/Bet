// create-test-member.js - 创建测试会员
import db from './db/config.js';
import dotenv from 'dotenv';

dotenv.config();

async function createTestMember() {
  try {
    console.log('开始创建测试会员...');
    
    // 1. 查找总代理
    const adminAgent = await db.oneOrNone('SELECT * FROM agents WHERE level = 0 LIMIT 1');
    
    if (!adminAgent) {
      console.error('未找到总代理，请先初始化代理系统');
      return;
    }
    
    console.log(`找到总代理: ${adminAgent.username} (ID: ${adminAgent.id})`);
    
    // 2. 检查测试会员是否已存在
    const existingMember = await db.oneOrNone('SELECT * FROM members WHERE username = $1', ['testuser']);
    
    if (existingMember) {
      console.log('测试会员已存在，更新密码和余额...');
      
      // 更新密码和余额
      await db.none(`
        UPDATE members 
        SET password = $1, balance = $2, status = 1
        WHERE username = $3
      `, ['123456', 10000, 'testuser']);
      
      console.log('测试会员已更新：');
      console.log('帐号: testuser');
      console.log('密码: 123456');
      console.log('余额: 10000');
      
    } else {
      console.log('创建新的测试会员...');
      
      // 创建测试会员
      await db.none(`
        INSERT INTO members (username, password, agent_id, balance, status)
        VALUES ($1, $2, $3, $4, $5)
      `, ['testuser', '123456', adminAgent.id, 10000, 1]);
      
      console.log('测试会员创建成功：');
      console.log('帐号: testuser');
      console.log('密码: 123456');
      console.log('余额: 10000');
      console.log(`代理: ${adminAgent.username}`);
    }
    
    // 3. 创建更多测试会员
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
        
        console.log(`创建会员: ${member.username} (密码: ${member.password}, 余额: ${member.balance})`);
      } else {
        console.log(`会员已存在: ${member.username}`);
      }
    }
    
    // 4. 显示所有会员
    const allMembers = await db.any('SELECT username, balance, status FROM members ORDER BY id');
    
    console.log('\n所有会员列表：');
    console.log('='.repeat(50));
    allMembers.forEach(member => {
      console.log(`${member.username} - 余额: ${member.balance} - 状态: ${member.status === 1 ? '启用' : '停用'}`);
    });
    console.log('='.repeat(50));
    
    console.log('\n✅ 测试会员创建完成！');
    console.log('\n可以使用以下帐号登入游戏：');
    console.log('帐号: testuser, 密码: 123456');
    console.log('帐号: member001, 密码: pass001');
    console.log('帐号: member002, 密码: pass002');
    console.log('帐号: player123, 密码: player123');
    
  } catch (error) {
    console.error('创建测试会员失败:', error);
  } finally {
    process.exit(0);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  createTestMember();
}

export default createTestMember; 