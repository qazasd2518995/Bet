import db from './db/config.js';
import fs from 'fs/promises';

async function initSubAccounts() {
  try {
    console.log('開始創建子帳號表...\n');
    
    // 讀取 SQL 文件
    const sql = await fs.readFile('./create-subaccounts-table.sql', 'utf-8');
    
    // 執行 SQL
    await db.none(sql);
    
    console.log('✅ 子帳號表創建成功！\n');
    
    // 檢查表是否存在
    const tableExists = await db.oneOrNone(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sub_accounts'
      )
    `);
    
    if (tableExists?.exists) {
      console.log('確認子帳號表已創建');
      
      // 顯示表結構
      const columns = await db.any(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'sub_accounts'
        ORDER BY ordinal_position
      `);
      
      console.log('\n表結構:');
      console.log('=====================================');
      columns.forEach(col => {
        console.log(`${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''} ${col.column_default || ''}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('創建子帳號表失敗:', error);
    process.exit(1);
  }
}

initSubAccounts();