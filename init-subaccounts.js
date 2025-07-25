import db from './db/config.js';
import fs from 'fs/promises';

async function initSubAccounts() {
  try {
    console.log('开始创建子帐号表...\n');
    
    // 读取 SQL 文件
    const sql = await fs.readFile('./create-subaccounts-table.sql', 'utf-8');
    
    // 执行 SQL
    await db.none(sql);
    
    console.log('✅ 子帐号表创建成功！\n');
    
    // 检查表是否存在
    const tableExists = await db.oneOrNone(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sub_accounts'
      )
    `);
    
    if (tableExists?.exists) {
      console.log('确认子帐号表已创建');
      
      // 显示表结构
      const columns = await db.any(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'sub_accounts'
        ORDER BY ordinal_position
      `);
      
      console.log('\n表结构:');
      console.log('=====================================');
      columns.forEach(col => {
        console.log(`${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''} ${col.column_default || ''}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('创建子帐号表失败:', error);
    process.exit(1);
  }
}

initSubAccounts();