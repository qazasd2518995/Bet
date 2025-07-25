// 創建 v_api_recent_draws 視圖
import db from './db/config.js';

async function createRecentDrawsView() {
    console.log('🔧 創建 v_api_recent_draws 視圖\n');

    try {
        // 檢查 recent_draws 表是否存在
        const tableExists = await db.oneOrNone(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'recent_draws'
            );
        `);

        if (!tableExists || !tableExists.exists) {
            console.log('❌ recent_draws 表不存在，需要先創建表');
            
            // 創建 recent_draws 表
            console.log('📌 創建 recent_draws 表...');
            await db.none(`
                CREATE TABLE IF NOT EXISTS recent_draws (
                    id SERIAL PRIMARY KEY,
                    period BIGINT UNIQUE NOT NULL,
                    result JSONB,
                    position_1 INTEGER,
                    position_2 INTEGER,
                    position_3 INTEGER,
                    position_4 INTEGER,
                    position_5 INTEGER,
                    position_6 INTEGER,
                    position_7 INTEGER,
                    position_8 INTEGER,
                    position_9 INTEGER,
                    position_10 INTEGER,
                    draw_time TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            
            // 創建索引
            await db.none(`
                CREATE INDEX IF NOT EXISTS idx_recent_draws_period ON recent_draws(period DESC);
                CREATE INDEX IF NOT EXISTS idx_recent_draws_draw_time ON recent_draws(draw_time DESC);
            `);
            
            console.log('✅ recent_draws 表創建成功');
            
            // 初始化數據
            console.log('📌 初始化 recent_draws 數據...');
            await db.none(`
                INSERT INTO recent_draws (
                    period, result,
                    position_1, position_2, position_3, position_4, position_5,
                    position_6, position_7, position_8, position_9, position_10,
                    draw_time
                )
                SELECT 
                    period::bigint, result,
                    position_1, position_2, position_3, position_4, position_5,
                    position_6, position_7, position_8, position_9, position_10,
                    draw_time
                FROM result_history
                WHERE result IS NOT NULL
                AND position_1 IS NOT NULL
                AND LENGTH(period::text) = 11
                ORDER BY period::bigint DESC
                LIMIT 10
                ON CONFLICT (period) DO NOTHING;
            `);
            
            const count = await db.one('SELECT COUNT(*) FROM recent_draws');
            console.log(`✅ 初始化了 ${count.count} 筆記錄`);
        }

        // 創建視圖
        console.log('\n📌 創建 v_api_recent_draws 視圖...');
        await db.none(`
            CREATE OR REPLACE VIEW v_api_recent_draws AS
            SELECT 
                period::text as period,
                result,
                position_1, position_2, position_3, position_4, position_5,
                position_6, position_7, position_8, position_9, position_10,
                draw_time,
                TO_CHAR(draw_time AT TIME ZONE 'Asia/Shanghai', 'MM-DD HH24:MI') as formatted_time,
                ROW_NUMBER() OVER (ORDER BY period DESC) as row_num
            FROM recent_draws
            ORDER BY period DESC;
        `);
        
        console.log('✅ v_api_recent_draws 視圖創建成功');

        // 驗證視圖
        console.log('\n📌 驗證視圖...');
        const testQuery = await db.manyOrNone(`
            SELECT period, formatted_time, position_1, position_5, position_10
            FROM v_api_recent_draws
            LIMIT 3
        `);
        
        if (testQuery.length > 0) {
            console.log('✅ 視圖運作正常，測試數據：');
            testQuery.forEach((row, index) => {
                console.log(`${index + 1}. 期號：${row.period} | 時間：${row.formatted_time} | 第1名：${row.position_1} | 第5名：${row.position_5} | 第10名：${row.position_10}`);
            });
        }

        console.log('\n✅ 修復完成！');
        console.log('v_api_recent_draws 視圖已創建，API 應該可以正常運作了');

    } catch (error) {
        console.error('創建視圖失敗：', error);
        throw error;
    }
}

// 執行創建
createRecentDrawsView().then(() => {
    console.log('\n✅ 所有操作完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 錯誤：', error);
    process.exit(1);
});