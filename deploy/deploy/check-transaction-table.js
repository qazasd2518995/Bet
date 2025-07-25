import db from './db/config.js';

async function checkTransactionTable() {
  try {
    console.log('=== 檢查 transaction_records 表結構 ===');
    
    const columns = await db.any(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'transaction_records'
      ORDER BY ordinal_position
    `);
    
    for (const col of columns) {
      console.log(`${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    }
    
    console.log('\n=== 最近的退水記錄詳細信息 ===');
    const transactions = await db.any(`
      SELECT user_id, user_type, amount, description, member_username, bet_amount, rebate_percentage, created_at
      FROM transaction_records 
      WHERE description LIKE '%退水%' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    for (const tx of transactions) {
      console.log(`時間: ${tx.created_at}`);
      console.log(`用戶ID: ${tx.user_id}, 用戶類型: ${tx.user_type}`);
      console.log(`退水金額: ${tx.amount}, 下注金額: ${tx.bet_amount}`);
      console.log(`退水比例: ${tx.rebate_percentage}, 會員: ${tx.member_username}`);
      console.log(`描述: ${tx.description}`);
      console.log('---');
    }
    
    // 通過 user_id 查找對應的代理
    console.log('\n=== 查找退水記錄對應的代理 ===');
    const rebateRecords = await db.any(`
      SELECT tr.user_id, tr.amount, tr.description, tr.member_username, a.username as agent_username
      FROM transaction_records tr
      LEFT JOIN agents a ON tr.user_id = a.id
      WHERE tr.description LIKE '%退水%'
      ORDER BY tr.created_at DESC 
      LIMIT 5
    `);
    
    for (const record of rebateRecords) {
      console.log(`代理: ${record.agent_username} (ID: ${record.user_id}), 退水: ${record.amount}, 會員: ${record.member_username}`);
    }
    
    await db.$pool.end();
    
  } catch (error) {
    console.error('錯誤:', error);
    await db.$pool.end();
    process.exit(1);
  }
}

checkTransactionTable();
