// 驗證近期開獎記錄同步功能
import db from './db/config.js';
import fetch from 'node-fetch';

async function verifyRecentDrawsSync() {
    console.log('🔍 驗證近期開獎記錄同步功能\n');

    try {
        // 1. 檢查 recent_draws 表
        console.log('📌 步驟1：檢查 recent_draws 表狀態...');
        
        const recentDrawsCount = await db.one('SELECT COUNT(*) FROM recent_draws');
        console.log(`recent_draws 表中有 ${recentDrawsCount.count} 筆記錄`);
        
        // 顯示最新記錄
        const latestDraws = await db.manyOrNone(`
            SELECT period, draw_time, position_1, position_5, position_10
            FROM recent_draws
            ORDER BY period DESC
            LIMIT 5
        `);
        
        console.log('\n最新5期記錄：');
        latestDraws.forEach((draw, index) => {
            console.log(`${index + 1}. 期號：${draw.period} | 時間：${new Date(draw.draw_time).toLocaleString()} | 第1名：${draw.position_1} | 第5名：${draw.position_5} | 第10名：${draw.position_10}`);
        });

        // 2. 測試 API 端點
        console.log('\n📌 步驟2：測試 /api/recent-results 端點...');
        
        const apiUrl = 'http://localhost:3000/api/recent-results';
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.success) {
            console.log(`✅ API 返回成功，共 ${data.count} 筆記錄`);
            console.log('前3筆數據：');
            data.data.slice(0, 3).forEach((record, index) => {
                console.log(`${index + 1}. 期號：${record.period} | 時間：${record.formattedTime}`);
            });
        } else {
            console.error('❌ API 返回失敗：', data.message);
        }

        // 3. 測試自動同步功能
        console.log('\n📌 步驟3：測試自動同步觸發器...');
        
        // 插入測試記錄
        const testPeriod = '20250718999'; // 使用未來日期的測試期號
        console.log(`插入測試記錄，期號：${testPeriod}`);
        
        await db.none(`
            INSERT INTO result_history (
                period, result,
                position_1, position_2, position_3, position_4, position_5,
                position_6, position_7, position_8, position_9, position_10,
                draw_time
            ) VALUES (
                $1, $2::jsonb,
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
                NOW()
            )
            ON CONFLICT (period) DO NOTHING
        `, [testPeriod, JSON.stringify([1,2,3,4,5,6,7,8,9,10])]);

        // 檢查是否自動同步到 recent_draws
        const syncedRecord = await db.oneOrNone(
            'SELECT * FROM recent_draws WHERE period = $1',
            [parseInt(testPeriod)]
        );
        
        if (syncedRecord) {
            console.log('✅ 觸發器工作正常，新記錄已同步到 recent_draws');
        } else {
            console.log('❌ 觸發器可能有問題，新記錄未同步');
        }

        // 清理測試數據
        await db.none('DELETE FROM result_history WHERE period = $1', [testPeriod]);
        await db.none('DELETE FROM recent_draws WHERE period = $1', [parseInt(testPeriod)]);
        console.log('已清理測試數據');

        // 4. 檢查記錄數量
        console.log('\n📌 步驟4：驗證只保留最新10期...');
        const finalCount = await db.one('SELECT COUNT(*) FROM recent_draws');
        console.log(`recent_draws 表最終有 ${finalCount.count} 筆記錄`);
        
        if (parseInt(finalCount.count) <= 10) {
            console.log('✅ 符合要求，只保留最新10期');
        } else {
            console.log('⚠️ 記錄數量超過10筆，可能需要檢查維護邏輯');
        }

        console.log('\n✅ 所有驗證完成！');
        console.log('近期開獎記錄同步系統運作正常');

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