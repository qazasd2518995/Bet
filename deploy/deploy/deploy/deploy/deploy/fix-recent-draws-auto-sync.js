// 自動同步近期開獎記錄 - 完整解決方案
import db from './db/config.js';

async function fixRecentDrawsAutoSync() {
    console.log('🔧 設置自動同步近期開獎記錄（保持最新10期）\n');

    try {
        // 1. 創建 recent_draws 表
        console.log('📌 步驟1：創建 recent_draws 表...');
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT valid_period CHECK (LENGTH(period::text) = 11)
            );
        `);
        
        // 創建索引
        await db.none(`
            CREATE INDEX IF NOT EXISTS idx_recent_draws_period ON recent_draws(period DESC);
            CREATE INDEX IF NOT EXISTS idx_recent_draws_draw_time ON recent_draws(draw_time DESC);
        `);
        
        console.log('✅ recent_draws 表創建成功');

        // 2. 清理 result_history 中的無效數據
        console.log('\n📌 步驟2：清理無效開獎記錄...');
        
        // 刪除結果為空或期號格式錯誤的記錄
        const deletedInvalid = await db.result(`
            DELETE FROM result_history 
            WHERE result IS NULL 
            OR position_1 IS NULL 
            OR LENGTH(period::text) != 11
            RETURNING period
        `);
        console.log(`刪除了 ${deletedInvalid.rowCount} 筆無效記錄`);

        // 3. 初始化 recent_draws 表
        console.log('\n📌 步驟3：初始化 recent_draws 表...');
        
        // 清空表
        await db.none('TRUNCATE TABLE recent_draws');
        
        // 插入最新10筆有效記錄
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
        `);
        
        const count = await db.one('SELECT COUNT(*) FROM recent_draws');
        console.log(`✅ 初始化完成，已同步 ${count.count} 筆記錄`);

        // 4. 創建自動維護函數
        console.log('\n📌 步驟4：創建自動維護函數...');
        
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
        
        console.log('✅ 自動維護函數創建成功');

        // 5. 創建觸發器
        console.log('\n📌 步驟5：創建自動同步觸發器...');
        
        await db.none(`
            DROP TRIGGER IF EXISTS auto_sync_recent_draws_trigger ON result_history;
            
            CREATE TRIGGER auto_sync_recent_draws_trigger
            AFTER INSERT OR UPDATE ON result_history
            FOR EACH ROW
            EXECUTE FUNCTION auto_sync_recent_draws();
        `);
        
        console.log('✅ 觸發器創建成功');

        // 6. 創建優化的 API 視圖
        console.log('\n📌 步驟6：創建 API 視圖...');
        
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
        
        console.log('✅ API 視圖創建成功');

        // 7. 驗證結果
        console.log('\n📊 驗證最新10期記錄：');
        const recentDraws = await db.manyOrNone(`
            SELECT * FROM v_api_recent_draws
        `);
        
        recentDraws.forEach((draw) => {
            console.log(`${draw.row_num}. 期號：${draw.period} | 時間：${draw.formatted_time} | 第1名：${draw.position_1} | 第5名：${draw.position_5} | 第10名：${draw.position_10}`);
        });

        // 8. 提供 API 更新建議
        console.log('\n💡 後端 API 更新建議：');
        console.log('在 backend.js 中修改 /api/recent-results 端點：');
        console.log(`
// 方法1：使用 recent_draws 表
app.get('/api/recent-results', async (req, res) => {
    try {
        const results = await db.manyOrNone(\`
            SELECT * FROM v_api_recent_draws
        \`);
        
        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('獲取近期開獎記錄失敗：', error);
        res.status(500).json({
            success: false,
            message: '獲取近期開獎記錄失敗'
        });
    }
});

// 方法2：修改現有 /api/history 端點
// 在查詢中加入有效性檢查
const validConditions = "result IS NOT NULL AND position_1 IS NOT NULL AND LENGTH(period::text) = 11";
`);

        console.log('\n✅ 自動同步系統設置完成！');
        console.log('系統將自動維護最新10期開獎記錄');
        console.log('每次新增開獎時會自動更新');

    } catch (error) {
        console.error('設置失敗：', error);
        throw error;
    }
}

// 執行設置
fixRecentDrawsAutoSync().then(() => {
    console.log('\n✅ 所有設置完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 錯誤：', error);
    process.exit(1);
});