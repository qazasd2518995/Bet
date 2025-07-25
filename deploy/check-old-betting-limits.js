import db from './db/config.js';

async function checkOldBettingLimits() {
  try {
    // 检查是否有betting_limits表
    const tables = await db.any(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%betting%limit%'
      ORDER BY table_name
    `);
    
    console.log('限红相关表格:');
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
      console.log('\n发现旧的betting_limits表，查询内容...');
      const limits = await db.any(`
        SELECT * FROM betting_limits 
        ORDER BY id
      `);
      
      console.log('\nbetting_limits表内容:');
      limits.forEach(limit => {
        console.log(`\nID: ${limit.id}`);
        console.log(`Level: ${limit.level_name}`);
        console.log(`Display: ${limit.level_display_name}`);
        console.log(`Config:`, JSON.stringify(limit.config, null, 2));
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

checkOldBettingLimits();
