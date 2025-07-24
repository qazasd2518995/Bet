import db from './db/config.js';

async function checkSubAccountsTable() {
  try {
    // 檢查表是否存在
    const tableExists = await db.oneOrNone(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sub_accounts'
      )
    `);
    
    console.log('子帳號表是否存在:', tableExists?.exists);
    
    if (tableExists?.exists) {
      // 如果表存在，顯示表結構
      const columns = await db.any(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'sub_accounts'
        ORDER BY ordinal_position
      `);
      
      console.log('\n當前表結構:');
      console.log('=====================================');
      columns.forEach(col => {
        console.log(`${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''} ${col.column_default || ''}`);
      });
      
      // 刪除現有表
      console.log('\n刪除現有表...');
      await db.none('DROP TABLE IF EXISTS sub_accounts CASCADE');
      console.log('表已刪除');
    }
    
    // 重新創建表
    console.log('\n重新創建子帳號表...');
    await db.none(`
      CREATE TABLE sub_accounts (
        id SERIAL PRIMARY KEY,
        parent_agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        status INTEGER DEFAULT 1,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 創建索引
    await db.none('CREATE INDEX idx_sub_accounts_parent_agent_id ON sub_accounts(parent_agent_id)');
    await db.none('CREATE INDEX idx_sub_accounts_username ON sub_accounts(username)');
    
    // 創建觸發器
    await db.none(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);
    
    await db.none(`
      CREATE TRIGGER update_sub_accounts_updated_at 
      BEFORE UPDATE ON sub_accounts 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column()
    `);
    
    console.log('\n✅ 子帳號表創建成功！');
    
    process.exit(0);
  } catch (error) {
    console.error('錯誤:', error);
    process.exit(1);
  }
}

checkSubAccountsTable();