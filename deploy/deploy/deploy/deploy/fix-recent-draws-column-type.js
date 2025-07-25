// 修復 recent_draws 表的 period 欄位類型
import db from './db/config.js';

async function fixRecentDrawsColumnType() {
    console.log('🔧 修復 recent_draws 表的 period 欄位類型\n');

    try {
        // 1. 刪除舊的觸發器
        console.log('📌 步驟1：暫時停用觸發器...');
        await db.none('DROP TRIGGER IF EXISTS auto_sync_recent_draws_trigger ON result_history');
        console.log('✅ 觸發器已暫時停用');

        // 2. 備份現有數據
        console.log('\n📌 步驟2：備份現有數據...');
        const backupData = await db.manyOrNone('SELECT * FROM recent_draws');
        console.log(`備份了 ${backupData.length} 筆記錄`);

        // 3. 刪除舊表
        console.log('\n📌 步驟3：重建 recent_draws 表...');
        await db.none('DROP TABLE IF EXISTS recent_draws CASCADE');
        
        // 4. 創建新表（period 使用 BIGINT）
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
            )
        `);
        
        // 創建索引
        await db.none(`
            CREATE INDEX idx_recent_draws_period ON recent_draws(period DESC);
            CREATE INDEX idx_recent_draws_draw_time ON recent_draws(draw_time DESC);
        `);
        
        console.log('✅ 新表創建成功（period 使用 BIGINT）');

        // 5. 還原數據
        console.log('\n📌 步驟4：還原數據...');
        for (const record of backupData) {
            await db.none(`
                INSERT INTO recent_draws (
                    period, result,
                    position_1, position_2, position_3, position_4, position_5,
                    position_6, position_7, position_8, position_9, position_10,
                    draw_time, created_at
                ) VALUES (
                    $1, $2,
                    $3, $4, $5, $6, $7,
                    $8, $9, $10, $11, $12,
                    $13, $14
                )
            `, [
                parseInt(record.period), // 確保轉換為整數
                record.result,
                record.position_1, record.position_2, record.position_3, record.position_4, record.position_5,
                record.position_6, record.position_7, record.position_8, record.position_9, record.position_10,
                record.draw_time, record.created_at
            ]);
        }
        console.log(`✅ 還原了 ${backupData.length} 筆記錄`);

        // 6. 重新創建視圖
        console.log('\n📌 步驟5：重新創建視圖...');
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
        console.log('✅ 視圖重新創建成功');

        // 7. 重新創建觸發器函數（確保類型匹配）
        console.log('\n📌 步驟6：重新創建觸發器函數...');
        await db.none('DROP FUNCTION IF EXISTS auto_sync_recent_draws()');
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
                        NEW.period, NEW.result,
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

        // 8. 重新創建觸發器
        await db.none(`
            CREATE TRIGGER auto_sync_recent_draws_trigger
            AFTER INSERT OR UPDATE ON result_history
            FOR EACH ROW
            EXECUTE FUNCTION auto_sync_recent_draws()
        `);
        console.log('✅ 觸發器重新創建成功');

        // 9. 驗證
        console.log('\n📌 步驟7：驗證修復結果...');
        const finalCount = await db.one('SELECT COUNT(*) FROM recent_draws');
        console.log(`recent_draws 表最終有 ${finalCount.count} 筆記錄`);
        
        // 檢查數據類型
        const columnInfo = await db.one(`
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'recent_draws' 
            AND column_name = 'period'
        `);
        console.log(`period 欄位類型：${columnInfo.data_type}`);

        console.log('\n✅ 修復完成！');
        console.log('recent_draws.period 現在使用 BIGINT 類型');
        console.log('觸發器已重新啟用，系統將自動維護最新10期記錄');

    } catch (error) {
        console.error('修復失敗：', error);
        throw error;
    }
}

// 執行修復
fixRecentDrawsColumnType().then(() => {
    console.log('\n✅ 所有操作完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 錯誤：', error);
    process.exit(1);
});