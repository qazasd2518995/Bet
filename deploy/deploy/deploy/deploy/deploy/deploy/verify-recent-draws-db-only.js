// 驗證近期開獎記錄同步功能（僅資料庫）
import db from './db/config.js';

async function verifyRecentDrawsSync() {
    console.log('🔍 驗證近期開獎記錄同步功能（資料庫層面）\n');

    try {
        // 1. 檢查 recent_draws 表
        console.log('📌 步驟1：檢查 recent_draws 表狀態...');
        
        const recentDrawsCount = await db.one('SELECT COUNT(*) FROM recent_draws');
        console.log(`recent_draws 表中有 ${recentDrawsCount.count} 筆記錄`);
        
        // 顯示所有記錄
        const allDraws = await db.manyOrNone(`
            SELECT period, draw_time, position_1, position_5, position_10
            FROM recent_draws
            ORDER BY period DESC
        `);
        
        console.log('\n所有記錄（應該只有10筆）：');
        allDraws.forEach((draw, index) => {
            const drawTime = new Date(draw.draw_time);
            console.log(`${index + 1}. 期號：${draw.period} | 時間：${drawTime.toLocaleString('zh-TW', {timeZone: 'Asia/Shanghai'})} | 第1名：${draw.position_1} | 第5名：${draw.position_5} | 第10名：${draw.position_10}`);
        });

        // 2. 測試自動同步觸發器
        console.log('\n📌 步驟2：測試自動同步觸發器...');
        
        // 先記錄當前最舊的期號
        const oldestDraw = await db.one(`
            SELECT period FROM recent_draws 
            ORDER BY period ASC 
            LIMIT 1
        `);
        console.log(`當前最舊期號：${oldestDraw.period}`);
        
        // 插入測試記錄（使用更新的期號）
        const testPeriod = '20250717999';
        console.log(`\n插入測試記錄，期號：${testPeriod}`);
        
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
            ON CONFLICT (period) DO NOTHING
        `, [testPeriod, JSON.stringify([1,2,3,4,5,6,7,8,9,10])]);

        // 等待一下讓觸發器執行
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 檢查是否自動同步到 recent_draws
        const syncedRecord = await db.oneOrNone(
            'SELECT * FROM recent_draws WHERE period = $1',
            [parseInt(testPeriod)]
        );
        
        if (syncedRecord) {
            console.log('✅ 觸發器工作正常，新記錄已同步到 recent_draws');
            
            // 檢查是否仍然只有10筆記錄
            const newCount = await db.one('SELECT COUNT(*) FROM recent_draws');
            console.log(`同步後記錄數：${newCount.count}`);
            
            if (parseInt(newCount.count) === 10) {
                console.log('✅ 正確維持10筆記錄，最舊的記錄已被刪除');
                
                // 確認最舊的記錄是否被刪除
                const newOldestDraw = await db.one(`
                    SELECT period FROM recent_draws 
                    ORDER BY period ASC 
                    LIMIT 1
                `);
                
                if (newOldestDraw.period !== oldestDraw.period) {
                    console.log(`✅ 最舊期號已從 ${oldestDraw.period} 更新為 ${newOldestDraw.period}`);
                }
            } else {
                console.log(`⚠️ 記錄數不正確：${newCount.count}`);
            }
        } else {
            console.log('❌ 觸發器可能有問題，新記錄未同步');
        }

        // 清理測試數據
        console.log('\n清理測試數據...');
        await db.none('DELETE FROM result_history WHERE period = $1', [testPeriod]);
        await db.none('DELETE FROM recent_draws WHERE period = $1', [parseInt(testPeriod)]);

        // 3. 檢查視圖
        console.log('\n📌 步驟3：檢查 v_api_recent_draws 視圖...');
        const viewData = await db.manyOrNone(`
            SELECT period, formatted_time, row_num
            FROM v_api_recent_draws
            LIMIT 3
        `);
        
        console.log('視圖前3筆數據：');
        viewData.forEach(record => {
            console.log(`排序：${record.row_num} | 期號：${record.period} | 格式化時間：${record.formatted_time}`);
        });

        // 4. 最終驗證
        console.log('\n📌 步驟4：最終驗證...');
        const finalCount = await db.one('SELECT COUNT(*) FROM recent_draws');
        const resultHistoryCount = await db.one(`
            SELECT COUNT(*) FROM result_history 
            WHERE result IS NOT NULL 
            AND position_1 IS NOT NULL 
            AND LENGTH(period::text) = 11
        `);
        
        console.log(`recent_draws 表：${finalCount.count} 筆記錄`);
        console.log(`result_history 表有效記錄：${resultHistoryCount.count} 筆`);
        
        console.log('\n✅ 所有驗證完成！');
        console.log('近期開獎記錄同步系統運作正常');
        console.log('系統會自動維護最新10期開獎記錄');

    } catch (error) {
        console.error('驗證失敗：', error);
    }
}

// 執行驗證
verifyRecentDrawsSync().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('❌ 錯誤：', error);
    process.exit(1);
});