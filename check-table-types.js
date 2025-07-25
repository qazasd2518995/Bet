// 检查表格的数据类型
import db from './db/config.js';

async function checkTableTypes() {
    console.log('🔍 检查表格数据类型\n');

    try {
        // 检查 result_history 表的 period 栏位类型
        const resultHistoryColumns = await db.manyOrNone(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'result_history'
            AND column_name = 'period'
        `);
        
        console.log('📊 result_history 表的 period 栏位：');
        resultHistoryColumns.forEach(col => {
            console.log(`栏位名：${col.column_name} | 类型：${col.data_type} | 可为空：${col.is_nullable}`);
        });

        // 检查 recent_draws 表的 period 栏位类型
        const recentDrawsColumns = await db.manyOrNone(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'recent_draws'
            AND column_name = 'period'
        `);
        
        console.log('\n📊 recent_draws 表的 period 栏位：');
        recentDrawsColumns.forEach(col => {
            console.log(`栏位名：${col.column_name} | 类型：${col.data_type} | 可为空：${col.is_nullable}`);
        });

        console.log('\n💡 问题分析：');
        console.log('result_history.period 是 character varying 类型');
        console.log('recent_draws.period 是 bigint 类型');
        console.log('这就是为什么在比较时会出现类型错误');

    } catch (error) {
        console.error('检查失败：', error);
    }
}

// 执行检查
checkTableTypes().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('❌ 错误：', error);
    process.exit(1);
});