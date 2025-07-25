// 修復觸發器類型錯誤
import db from './db/config.js';

async function fixTriggerTypeError() {
    console.log('🔧 修復觸發器函數類型錯誤\n');

    try {
        // 1. 刪除舊的觸發器
        console.log('📌 步驟1：刪除舊的觸發器和函數...');
        await db.none('DROP TRIGGER IF EXISTS auto_sync_recent_draws_trigger ON result_history');
        await db.none('DROP FUNCTION IF EXISTS auto_sync_recent_draws()');
        console.log('✅ 舊的觸發器和函數已刪除');

        // 2. 創建修正後的函數
        console.log('\n📌 步驟2：創建修正後的觸發器函數...');
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
                    
                    -- 插入或更新到 recent_draws（確保 period 類型轉換）
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
        console.log('✅ 新的觸發器函數創建成功');

        // 3. 創建觸發器
        console.log('\n📌 步驟3：創建觸發器...');
        await db.none(`
            CREATE TRIGGER auto_sync_recent_draws_trigger
            AFTER INSERT OR UPDATE ON result_history
            FOR EACH ROW
            EXECUTE FUNCTION auto_sync_recent_draws()
        `);
        console.log('✅ 觸發器創建成功');

        // 4. 測試觸發器
        console.log('\n📌 步驟4：測試觸發器功能...');
        
        // 插入測試記錄
        const testPeriod = '20250718888';
        console.log(`插入測試記錄，期號：${testPeriod}`);
        
        try {
            await db.none(`
                INSERT INTO result_history (
                    period, result,
                    position_1, position_2, position_3, position_4, position_5,
                    position_6, position_7, position_8, position_9, position_10,
                    draw_time, created_at
                ) VALUES (
                    $1, $2::jsonb,
                    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
                    NOW(), NOW()
                )
            `, [testPeriod, JSON.stringify([1,2,3,4,5,6,7,8,9,10])]);
            
            // 檢查是否同步成功
            const syncedRecord = await db.oneOrNone(
                'SELECT * FROM recent_draws WHERE period = $1',
                [parseInt(testPeriod)]
            );
            
            if (syncedRecord) {
                console.log('✅ 觸發器測試成功，新記錄已同步');
                
                // 檢查記錄數
                const count = await db.one('SELECT COUNT(*) FROM recent_draws');
                console.log(`recent_draws 表目前有 ${count.count} 筆記錄`);
            } else {
                console.log('❌ 觸發器測試失敗');
            }
            
            // 清理測試數據
            await db.none('DELETE FROM result_history WHERE period = $1', [testPeriod]);
            await db.none('DELETE FROM recent_draws WHERE period = $1', [parseInt(testPeriod)]);
            console.log('測試數據已清理');
            
        } catch (err) {
            console.error('測試過程出錯：', err.message);
        }

        console.log('\n✅ 觸發器修復完成！');
        console.log('系統現在會自動維護最新10期開獎記錄');

    } catch (error) {
        console.error('修復失敗：', error);
        throw error;
    }
}

// 執行修復
fixTriggerTypeError().then(() => {
    console.log('\n✅ 所有操作完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 錯誤：', error);
    process.exit(1);
});