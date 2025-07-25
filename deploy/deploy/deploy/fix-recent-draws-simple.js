// 修復近期開獎記錄同步問題（簡化版）
import db from './db/config.js';

async function fixRecentDrawsSimple() {
    console.log('🔧 修復近期開獎記錄同步問題\n');

    try {
        // 1. 查詢有效的開獎記錄
        console.log('📌 步驟1：查詢有效的開獎記錄...');
        const validDraws = await db.manyOrNone(`
            SELECT * FROM result_history
            WHERE result IS NOT NULL
            AND position_1 IS NOT NULL
            AND position_2 IS NOT NULL
            AND position_3 IS NOT NULL
            AND position_4 IS NOT NULL
            AND position_5 IS NOT NULL
            AND position_6 IS NOT NULL
            AND position_7 IS NOT NULL
            AND position_8 IS NOT NULL
            AND position_9 IS NOT NULL
            AND position_10 IS NOT NULL
            AND LENGTH(period::text) = 11
            ORDER BY period::text DESC
            LIMIT 10
        `);

        console.log(`找到 ${validDraws.length} 筆有效記錄`);

        if (validDraws.length > 0) {
            console.log('\n最新10期開獎記錄：');
            validDraws.forEach((draw, index) => {
                console.log(`${index + 1}. 期號：${draw.period} | 第1名：${draw.position_1} | 第5名：${draw.position_5} | 第10名：${draw.position_10}`);
            });
        }

        // 2. 修改 /api/history 端點的查詢邏輯
        console.log('\n💡 建議修改 backend.js 的 /api/history 端點：');
        console.log(`
// 在 backend.js 中找到 app.get('/api/history', ...) 
// 修改查詢條件，過濾掉無效記錄：

const query = \`
    SELECT * FROM (
        SELECT * FROM result_history
        WHERE result IS NOT NULL
        AND position_1 IS NOT NULL
        AND LENGTH(period::text) = 11
        \${whereClause}
        ORDER BY period::text DESC
        LIMIT \$\${params.length + 1} OFFSET \$\${params.length + 2}
    ) AS valid_results
    ORDER BY period::text DESC
\`;
        `);

        // 3. 創建一個清理函數
        console.log('\n📌 步驟2：創建數據清理函數...');
        await db.none(`
            CREATE OR REPLACE FUNCTION clean_invalid_draws()
            RETURNS void AS $$
            BEGIN
                -- 刪除結果為空的記錄
                DELETE FROM result_history 
                WHERE result IS NULL 
                OR position_1 IS NULL;
                
                -- 刪除期號長度異常的記錄
                DELETE FROM result_history
                WHERE LENGTH(period::text) != 11;
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('✅ 清理函數創建成功');

        // 4. 執行清理
        console.log('\n📌 步驟3：執行數據清理...');
        await db.none('SELECT clean_invalid_draws()');
        console.log('✅ 清理完成');

        // 5. 查詢清理後的結果
        console.log('\n📌 步驟4：查詢清理後的最新記錄...');
        const cleanedDraws = await db.manyOrNone(`
            SELECT * FROM result_history
            ORDER BY period::text DESC
            LIMIT 10
        `);

        console.log(`\n清理後的最新10期：`);
        cleanedDraws.forEach((draw, index) => {
            console.log(`${index + 1}. 期號：${draw.period} | 第1名：${draw.position_1} | 第5名：${draw.position_5} | 第10名：${draw.position_10}`);
        });

    } catch (error) {
        console.error('修復失敗：', error);
    }
}

// 執行修復
fixRecentDrawsSimple().then(() => {
    console.log('\n✅ 修復完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 錯誤：', error);
    process.exit(1);
});