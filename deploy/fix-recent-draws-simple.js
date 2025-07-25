// 修复近期开奖记录同步问题（简化版）
import db from './db/config.js';

async function fixRecentDrawsSimple() {
    console.log('🔧 修复近期开奖记录同步问题\n');

    try {
        // 1. 查询有效的开奖记录
        console.log('📌 步骤1：查询有效的开奖记录...');
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

        console.log(`找到 ${validDraws.length} 笔有效记录`);

        if (validDraws.length > 0) {
            console.log('\n最新10期开奖记录：');
            validDraws.forEach((draw, index) => {
                console.log(`${index + 1}. 期号：${draw.period} | 第1名：${draw.position_1} | 第5名：${draw.position_5} | 第10名：${draw.position_10}`);
            });
        }

        // 2. 修改 /api/history 端点的查询逻辑
        console.log('\n💡 建议修改 backend.js 的 /api/history 端点：');
        console.log(`
// 在 backend.js 中找到 app.get('/api/history', ...) 
// 修改查询条件，过滤掉无效记录：

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

        // 3. 创建一个清理函数
        console.log('\n📌 步骤2：创建数据清理函数...');
        await db.none(`
            CREATE OR REPLACE FUNCTION clean_invalid_draws()
            RETURNS void AS $$
            BEGIN
                -- 删除结果为空的记录
                DELETE FROM result_history 
                WHERE result IS NULL 
                OR position_1 IS NULL;
                
                -- 删除期号长度异常的记录
                DELETE FROM result_history
                WHERE LENGTH(period::text) != 11;
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('✅ 清理函数创建成功');

        // 4. 执行清理
        console.log('\n📌 步骤3：执行数据清理...');
        await db.none('SELECT clean_invalid_draws()');
        console.log('✅ 清理完成');

        // 5. 查询清理后的结果
        console.log('\n📌 步骤4：查询清理后的最新记录...');
        const cleanedDraws = await db.manyOrNone(`
            SELECT * FROM result_history
            ORDER BY period::text DESC
            LIMIT 10
        `);

        console.log(`\n清理后的最新10期：`);
        cleanedDraws.forEach((draw, index) => {
            console.log(`${index + 1}. 期号：${draw.period} | 第1名：${draw.position_1} | 第5名：${draw.position_5} | 第10名：${draw.position_10}`);
        });

    } catch (error) {
        console.error('修复失败：', error);
    }
}

// 执行修复
fixRecentDrawsSimple().then(() => {
    console.log('\n✅ 修复完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 错误：', error);
    process.exit(1);
});