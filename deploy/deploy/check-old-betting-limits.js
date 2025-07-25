import db from './db/config.js';

async function checkOldBettingLimits() {
  try {
    // 檢查是否有betting_limits表
    const tables = await db.any(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%betting%limit%'
      ORDER BY table_name
    `);
    
    console.log('限紅相關表格:');
    tables.forEach(t => console.log(`- ${t.table_name}`));
    
    // 查看betting_limits表
    const hasOldTable = await db.oneOrNone(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'betting_limits'
      )
    `);
    
    if (hasOldTable?.exists) {
      console.log('\n發現舊的betting_limits表，查詢內容...');
      const limits = await db.any(`
        SELECT * FROM betting_limits 
        ORDER BY id
      `);
      
      console.log('\nbetting_limits表內容:');
      limits.forEach(limit => {
        console.log(`\nID: ${limit.id}`);
        console.log(`Level: ${limit.level_name}`);
        console.log(`Display: ${limit.level_display_name}`);
        console.log(`Config:`, JSON.stringify(limit.config, null, 2));
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('錯誤:', error);
    process.exit(1);
  }
}

checkOldBettingLimits();
