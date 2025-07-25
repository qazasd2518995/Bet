// 检查近期开奖记录同步问题
import db from './db/config.js';

async function checkRecentDrawsSync() {
    console.log('🔍 检查近期开奖记录同步状态\n');

    try {
        // 1. 查询最新的开奖记录
        const latestDraws = await db.manyOrNone(`
            SELECT period, draw_time, position_1, position_5, position_10
            FROM result_history
            ORDER BY CAST(period AS BIGINT) DESC
            LIMIT 20
        `);

        console.log('📊 资料库中最新20笔开奖记录：');
        latestDraws.forEach((draw, index) => {
            const drawTime = new Date(draw.draw_time);
            console.log(`${index + 1}. 期号：${draw.period} | 时间：${drawTime.toLocaleString()} | 第1名：${draw.position_1} | 第5名：${draw.position_5} | 第10名：${draw.position_10}`);
        });

        // 2. 检查 recent_draws 表是否存在
        const hasRecentDrawsTable = await db.oneOrNone(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'recent_draws'
            );
        `);

        if (hasRecentDrawsTable && hasRecentDrawsTable.exists) {
            console.log('\n✅ recent_draws 表存在');
            
            // 查询 recent_draws 表内容
            const recentDraws = await db.manyOrNone(`
                SELECT * FROM recent_draws
                ORDER BY period DESC
            `);

            console.log(`\n📋 recent_draws 表中有 ${recentDraws.length} 笔记录`);
            
            if (recentDraws.length > 0) {
                console.log('\n最新5笔：');
                recentDraws.slice(0, 5).forEach((draw, index) => {
                    console.log(`${index + 1}. 期号：${draw.period}`);
                });
            }
        } else {
            console.log('\n❌ recent_draws 表不存在');
            console.log('需要创建 recent_draws 表来维护最新10期记录');
        }

        // 3. 检查前端是否有快取机制
        console.log('\n🔍 检查前端快取机制...');
        
        // 读取前端文件查看如何获取近期开奖
        const frontendCode = `
// 前端通常通过以下方式获取近期开奖：
// 1. API 调用: /api/recent-results
// 2. localStorage 快取
// 3. Vue data 中的 recentResults 阵列
        `;
        console.log(frontendCode);

        // 4. 检查是否有定期清理机制
        const oldestDraw = latestDraws[latestDraws.length - 1];
        if (oldestDraw) {
            const oldestTime = new Date(oldestDraw.draw_time);
            const now = new Date();
            const daysDiff = Math.floor((now - oldestTime) / (1000 * 60 * 60 * 24));
            
            console.log(`\n📅 最旧的记录：`);
            console.log(`期号：${oldestDraw.period}`);
            console.log(`时间：${oldestTime.toLocaleString()}`);
            console.log(`距今：${daysDiff} 天`);
            
            if (daysDiff > 7) {
                console.log('\n⚠️ 发现超过7天的旧记录，建议实施定期清理机制');
            }
        }

        // 5. 提供解决方案
        console.log('\n💡 建议解决方案：');
        console.log('1. 创建专门的 recent_draws 表或视图，只保存最新10期');
        console.log('2. 在每次开奖后自动更新 recent_draws');
        console.log('3. 实施定期清理机制，删除超过一定时间的旧记录');
        console.log('4. 优化前端 API，确保只返回最新10期数据');

    } catch (error) {
        console.error('检查失败：', error);
    }
}

// 执行检查
checkRecentDrawsSync().then(() => {
    console.log('\n✅ 检查完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 错误：', error);
    process.exit(1);
});