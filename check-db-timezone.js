import db from './db/config.js';

async function checkDbTimezone() {
  try {
    console.log('🔍 檢查資料庫時區設定\n');
    
    const timezone = await db.one('SHOW timezone');
    console.log('資料庫時區:', timezone.timezone);
    
    const currentTime = await db.one("SELECT NOW() as db_time, NOW() AT TIME ZONE 'Asia/Taipei' as taipei_time, NOW() AT TIME ZONE 'UTC' as utc_time");
    console.log('\n當前時間比較:');
    console.log('資料庫時間:', currentTime.db_time);
    console.log('台北時間:', currentTime.taipei_time);
    console.log('UTC時間:', currentTime.utc_time);
    
    const sampleHistory = await db.oneOrNone("SELECT period, created_at, created_at AT TIME ZONE 'Asia/Taipei' as taipei_created_at FROM result_history ORDER BY created_at DESC LIMIT 1");
    if (sampleHistory) {
      console.log('\n最新開獎記錄:');
      console.log('期號:', sampleHistory.period);
      console.log('原始 created_at:', sampleHistory.created_at);
      console.log('台北時間 created_at:', sampleHistory.taipei_created_at);
      
      // 檢查 JavaScript Date 解析
      console.log('\nJavaScript Date 解析:');
      const jsDate = new Date(sampleHistory.created_at);
      console.log('JS Date:', jsDate);
      console.log('toISOString():', jsDate.toISOString());
      console.log('toLocaleString(Asia/Taipei):', jsDate.toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'}));
    }
    
    await db.$pool.end();
  } catch (error) {
    console.error('錯誤:', error);
    process.exit(1);
  }
}

checkDbTimezone();