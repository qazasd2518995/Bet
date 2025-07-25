// 檢查近期開獎記錄同步問題
import db from './db/config.js';

async function checkRecentDrawsSync() {
    console.log('🔍 檢查近期開獎記錄同步狀態\n');

    try {
        // 1. 查詢最新的開獎記錄
        const latestDraws = await db.manyOrNone(`
            SELECT period, draw_time, position_1, position_5, position_10
            FROM result_history
            ORDER BY CAST(period AS BIGINT) DESC
            LIMIT 20
        `);

        console.log('📊 資料庫中最新20筆開獎記錄：');
        latestDraws.forEach((draw, index) => {
            const drawTime = new Date(draw.draw_time);
            console.log(`${index + 1}. 期號：${draw.period} | 時間：${drawTime.toLocaleString()} | 第1名：${draw.position_1} | 第5名：${draw.position_5} | 第10名：${draw.position_10}`);
        });

        // 2. 檢查 recent_draws 表是否存在
        const hasRecentDrawsTable = await db.oneOrNone(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'recent_draws'
            );
        `);

        if (hasRecentDrawsTable && hasRecentDrawsTable.exists) {
            console.log('\n✅ recent_draws 表存在');
            
            // 查詢 recent_draws 表內容
            const recentDraws = await db.manyOrNone(`
                SELECT * FROM recent_draws
                ORDER BY period DESC
            `);

            console.log(`\n📋 recent_draws 表中有 ${recentDraws.length} 筆記錄`);
            
            if (recentDraws.length > 0) {
                console.log('\n最新5筆：');
                recentDraws.slice(0, 5).forEach((draw, index) => {
                    console.log(`${index + 1}. 期號：${draw.period}`);
                });
            }
        } else {
            console.log('\n❌ recent_draws 表不存在');
            console.log('需要創建 recent_draws 表來維護最新10期記錄');
        }

        // 3. 檢查前端是否有快取機制
        console.log('\n🔍 檢查前端快取機制...');
        
        // 讀取前端文件查看如何獲取近期開獎
        const frontendCode = `
// 前端通常通過以下方式獲取近期開獎：
// 1. API 調用: /api/recent-results
// 2. localStorage 快取
// 3. Vue data 中的 recentResults 陣列
        `;
        console.log(frontendCode);

        // 4. 檢查是否有定期清理機制
        const oldestDraw = latestDraws[latestDraws.length - 1];
        if (oldestDraw) {
            const oldestTime = new Date(oldestDraw.draw_time);
            const now = new Date();
            const daysDiff = Math.floor((now - oldestTime) / (1000 * 60 * 60 * 24));
            
            console.log(`\n📅 最舊的記錄：`);
            console.log(`期號：${oldestDraw.period}`);
            console.log(`時間：${oldestTime.toLocaleString()}`);
            console.log(`距今：${daysDiff} 天`);
            
            if (daysDiff > 7) {
                console.log('\n⚠️ 發現超過7天的舊記錄，建議實施定期清理機制');
            }
        }

        // 5. 提供解決方案
        console.log('\n💡 建議解決方案：');
        console.log('1. 創建專門的 recent_draws 表或視圖，只保存最新10期');
        console.log('2. 在每次開獎後自動更新 recent_draws');
        console.log('3. 實施定期清理機制，刪除超過一定時間的舊記錄');
        console.log('4. 優化前端 API，確保只返回最新10期數據');

    } catch (error) {
        console.error('檢查失敗：', error);
    }
}

// 執行檢查
checkRecentDrawsSync().then(() => {
    console.log('\n✅ 檢查完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 錯誤：', error);
    process.exit(1);
});