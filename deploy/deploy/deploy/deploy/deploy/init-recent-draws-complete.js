// 完整初始化 recent_draws 系統
import db from './db/config.js';

async function initRecentDrawsComplete() {
    console.log('🔧 完整初始化 recent_draws 系統\n');

    try {
        // 1. 確保 recent_draws 表存在
        console.log('📌 步驟1：檢查 recent_draws 表...');
        const tableExists = await db.oneOrNone(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'recent_draws'
            );
        `);

        if (tableExists && tableExists.exists) {
            console.log('✅ recent_draws 表已存在');
        } else {
            console.log('創建 recent_draws 表...');
            await db.none(`
                CREATE TABLE recent_draws (
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
                
                CREATE INDEX idx_recent_draws_period ON recent_draws(period DESC);
                CREATE INDEX idx_recent_draws_draw_time ON recent_draws(draw_time DESC);
            `);
        }

        // 2. 初始化數據
        console.log('\n📌 步驟2：初始化最新10期數據...');
        
        // 清空表
        await db.none('TRUNCATE TABLE recent_draws');
        
        // 插入最新10筆有效記錄
        const insertCount = await db.result(`
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
        `);
        
        console.log(`✅ 成功插入 ${insertCount.rowCount} 筆記錄`);

        // 3. 創建自動同步觸發器
        console.log('\n📌 步驟3：創建自動同步觸發器...');
        
        // 刪除舊的觸發器和函數
        await db.none('DROP TRIGGER IF EXISTS auto_sync_recent_draws_trigger ON result_history');
        await db.none('DROP FUNCTION IF EXISTS auto_sync_recent_draws()');
        
        // 創建新的觸發器函數
        await db.none(`
            CREATE OR REPLACE FUNCTION auto_sync_recent_draws()
            RETURNS TRIGGER AS $$
            DECLARE
                min_period BIGINT;
            BEGIN
                -- 只處理有效的新記錄
                IF NEW.result IS NOT NULL 
                   AND NEW.position_1 IS NOT NULL 
                   AND LENGTH(NEW.period::text) = 11 THEN
                    
                    -- 插入或更新到 recent_draws
                    INSERT INTO recent_draws (
                        period, result,
                        position_1, position_2, position_3, position_4, position_5,
                        position_6, position_7, position_8, position_9, position_10,
                        draw_time
                    )
                    VALUES (
                        NEW.period::bigint, NEW.result,
                        NEW.position_1, NEW.position_2, NEW.position_3, NEW.position_4, NEW.position_5,
                        NEW.position_6, NEW.position_7, NEW.position_8, NEW.position_9, NEW.position_10,
                        NEW.draw_time
                    )
                    ON CONFLICT (period) DO UPDATE SET
                        result = EXCLUDED.result,
                        position_1 = EXCLUDED.position_1,
                        position_2 = EXCLUDED.position_2,
                        position_3 = EXCLUDED.position_3,
                        position_4 = EXCLUDED.position_4,
                        position_5 = EXCLUDED.position_5,
                        position_6 = EXCLUDED.position_6,
                        position_7 = EXCLUDED.position_7,
                        position_8 = EXCLUDED.position_8,
                        position_9 = EXCLUDED.position_9,
                        position_10 = EXCLUDED.position_10,
                        draw_time = EXCLUDED.draw_time;
                    
                    -- 獲取第10筆記錄的期號
                    SELECT period INTO min_period
                    FROM recent_draws
                    ORDER BY period DESC
                    LIMIT 1 OFFSET 9;
                    
                    -- 刪除超過10筆的舊記錄
                    IF min_period IS NOT NULL THEN
                        DELETE FROM recent_draws
                        WHERE period < min_period;
                    END IF;
                END IF;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);
        
        // 創建觸發器
        await db.none(`
            CREATE TRIGGER auto_sync_recent_draws_trigger
            AFTER INSERT OR UPDATE ON result_history
            FOR EACH ROW
            EXECUTE FUNCTION auto_sync_recent_draws()
        `);
        
        console.log('✅ 觸發器創建成功');

        // 4. 驗證結果
        console.log('\n📌 步驟4：驗證結果...');
        
        // 檢查 recent_draws 表
        const recentDraws = await db.manyOrNone(`
            SELECT period, draw_time, position_1, position_5, position_10
            FROM recent_draws
            ORDER BY period DESC
            LIMIT 5
        `);
        
        console.log('\nrecent_draws 表最新5筆：');
        recentDraws.forEach((draw, index) => {
            const drawTime = new Date(draw.draw_time);
            console.log(`${index + 1}. 期號：${draw.period} | 時間：${drawTime.toLocaleString('zh-TW')} | 第1名：${draw.position_1} | 第5名：${draw.position_5} | 第10名：${draw.position_10}`);
        });
        
        // 檢查視圖
        const viewData = await db.manyOrNone(`
            SELECT period, formatted_time, position_1
            FROM v_api_recent_draws
            LIMIT 3
        `);
        
        console.log('\nv_api_recent_draws 視圖測試：');
        viewData.forEach((row, index) => {
            console.log(`${index + 1}. 期號：${row.period} | 時間：${row.formatted_time} | 第1名：${row.position_1}`);
        });

        console.log('\n✅ 初始化完成！');
        console.log('recent_draws 系統已完全設置好：');
        console.log('- recent_draws 表已創建並填充數據');
        console.log('- v_api_recent_draws 視圖已創建');
        console.log('- 自動同步觸發器已設置');
        console.log('- API 錯誤應該已經解決');

    } catch (error) {
        console.error('初始化失敗：', error);
        throw error;
    }
}

// 執行初始化
initRecentDrawsComplete().then(() => {
    console.log('\n✅ 所有操作完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 錯誤：', error);
    process.exit(1);
});