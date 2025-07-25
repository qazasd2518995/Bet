// 修復近期開獎記錄同步問題
import db from './db/config.js';

async function fixRecentDrawsSync() {
    console.log('🔧 修復近期開獎記錄同步問題\n');

    try {
        // 1. 創建 recent_draws 表（如果不存在）
        console.log('📌 步驟1：創建 recent_draws 表...');
        await db.none(`
            CREATE TABLE IF NOT EXISTS recent_draws (
                id SERIAL PRIMARY KEY,
                period VARCHAR(20) UNIQUE NOT NULL,
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
            CREATE INDEX IF NOT EXISTS idx_recent_draws_period ON recent_draws(period);
            CREATE INDEX IF NOT EXISTS idx_recent_draws_draw_time ON recent_draws(draw_time DESC);
        `);
        
        console.log('✅ recent_draws 表創建成功');

        // 2. 清理異常數據
        console.log('\n📌 步驟2：清理異常的開獎記錄...');
        
        // 刪除結果為 null 的記錄
        const deletedNull = await db.result(`
            DELETE FROM result_history 
            WHERE result IS NULL 
            OR position_1 IS NULL 
            OR position_2 IS NULL
            RETURNING period
        `);
        console.log(`刪除了 ${deletedNull.rowCount} 筆空結果記錄`);

        // 刪除期號格式異常的記錄
        const deletedInvalid = await db.result(`
            DELETE FROM result_history 
            WHERE NOT (period ~ '^[0-9]{11}$')
            RETURNING period
        `);
        console.log(`刪除了 ${deletedInvalid.rowCount} 筆格式異常的記錄`);

        // 3. 獲取最新的有效開獎記錄
        console.log('\n📌 步驟3：獲取最新10期有效開獎記錄...');
        const validDraws = await db.manyOrNone(`
            SELECT * FROM result_history
            WHERE result IS NOT NULL
            AND position_1 IS NOT NULL
            AND period ~ '^[0-9]{11}$'
            ORDER BY CAST(period AS BIGINT) DESC
            LIMIT 10
        `);

        console.log(`找到 ${validDraws.length} 筆有效記錄`);

        // 4. 同步到 recent_draws 表
        if (validDraws.length > 0) {
            console.log('\n📌 步驟4：同步到 recent_draws 表...');
            
            // 清空 recent_draws 表
            await db.none('TRUNCATE TABLE recent_draws');
            
            // 批量插入
            for (const draw of validDraws) {
                await db.none(`
                    INSERT INTO recent_draws (
                        period, result, 
                        position_1, position_2, position_3, position_4, position_5,
                        position_6, position_7, position_8, position_9, position_10,
                        draw_time
                    ) VALUES (
                        $1, $2::jsonb,
                        $3, $4, $5, $6, $7,
                        $8, $9, $10, $11, $12,
                        $13
                    )
                    ON CONFLICT (period) DO NOTHING
                `, [
                    draw.period, draw.result,
                    draw.position_1, draw.position_2, draw.position_3, draw.position_4, draw.position_5,
                    draw.position_6, draw.position_7, draw.position_8, draw.position_9, draw.position_10,
                    draw.draw_time
                ]);
            }
            
            console.log('✅ 同步完成');
        }

        // 5. 創建觸發器自動維護最新10期
        console.log('\n📌 步驟5：創建自動維護觸發器...');
        
        // 創建函數
        await db.none(`
            CREATE OR REPLACE FUNCTION maintain_recent_draws()
            RETURNS TRIGGER AS $$
            BEGIN
                -- 插入新記錄到 recent_draws
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
                
                -- 保留最新10筆，刪除舊記錄
                DELETE FROM recent_draws
                WHERE period NOT IN (
                    SELECT period FROM recent_draws
                    ORDER BY CAST(period AS BIGINT) DESC
                    LIMIT 10
                );
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // 創建觸發器
        await db.none(`
            DROP TRIGGER IF EXISTS maintain_recent_draws_trigger ON result_history;
            
            CREATE TRIGGER maintain_recent_draws_trigger
            AFTER INSERT OR UPDATE ON result_history
            FOR EACH ROW
            EXECUTE FUNCTION maintain_recent_draws();
        `);
        
        console.log('✅ 自動維護觸發器創建成功');

        // 6. 創建優化的視圖
        console.log('\n📌 步驟6：創建優化視圖...');
        await db.none(`
            CREATE OR REPLACE VIEW v_recent_draws AS
            SELECT 
                period,
                result,
                position_1, position_2, position_3, position_4, position_5,
                position_6, position_7, position_8, position_9, position_10,
                draw_time,
                TO_CHAR(draw_time, 'MM-DD HH24:MI') as formatted_time
            FROM recent_draws
            ORDER BY CAST(period AS BIGINT) DESC;
        `);
        
        console.log('✅ 視圖創建成功');

        // 7. 顯示最終結果
        console.log('\n📊 最新10期開獎記錄：');
        const finalRecords = await db.manyOrNone(`
            SELECT * FROM v_recent_draws
        `);
        
        finalRecords.forEach((record, index) => {
            console.log(`${index + 1}. 期號：${record.period} | 時間：${record.formatted_time} | 第1名：${record.position_1} | 第5名：${record.position_5} | 第10名：${record.position_10}`);
        });

        // 8. 提供前端調用建議
        console.log('\n💡 前端調用建議：');
        console.log('1. 直接查詢 recent_draws 表或 v_recent_draws 視圖');
        console.log('2. API 優化範例：');
        console.log(`
// backend.js 中添加新的 API
app.get('/api/recent-draws', async (req, res) => {
    try {
        const draws = await db.manyOrNone('SELECT * FROM v_recent_draws');
        res.json({
            success: true,
            data: draws
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '獲取近期開獎記錄失敗'
        });
    }
});
        `);

    } catch (error) {
        console.error('修復失敗：', error);
    }
}

// 執行修復
fixRecentDrawsSync().then(() => {
    console.log('\n✅ 修復完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 錯誤：', error);
    process.exit(1);
});