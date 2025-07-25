import db from './db/config.js';

async function checkTables() {
  try {
    const tables = await db.any("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%rebate%'");
    console.log('退水相關表:', tables.map(t => t.table_name));
    
    const allTables = await db.any("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log('所有表:', allTables.map(t => t.table_name));
    
    await db.$pool.end();
  } catch (error) {
    console.error('錯誤:', error);
    process.exit(1);
  }
}

checkTables();
