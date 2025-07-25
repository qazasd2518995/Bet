// 修复号码投注结算逻辑
import db from './db/config.js';

async function analyzeAndFixNumberBetLogic() {
    console.log('🔍 分析号码投注结算逻辑问题\n');

    try {
        // 1. 检查期号 412 的详细数据
        console.log('📌 步骤1：检查期号 20250717412 的数据类型...');
        const period412Data = await db.oneOrNone(`
            SELECT 
                period,
                result,
                position_1, position_2, position_3, position_4, position_5,
                position_6, position_7, position_8, position_9, position_10,
                pg_typeof(position_10) as position_10_type,
                position_10::text as position_10_text
            FROM result_history
            WHERE period = '20250717412'
        `);

        if (period412Data) {
            console.log('开奖数据：');
            console.log(`- position_10 值：${period412Data.position_10}`);
            console.log(`- position_10 类型：${period412Data.position_10_type}`);
            console.log(`- position_10 文本：${period412Data.position_10_text}`);
            console.log(`- result 阵列：${JSON.stringify(period412Data.result)}`);
        }

        // 2. 检查投注数据
        console.log('\n📌 步骤2：检查投注数据类型...');
        const betData = await db.manyOrNone(`
            SELECT 
                id,
                bet_value,
                pg_typeof(bet_value) as bet_value_type,
                position,
                pg_typeof(position) as position_type,
                win
            FROM bet_history
            WHERE period = '20250717412'
            AND username = 'justin111'
            AND position = '10'
            AND bet_type = 'number'
            ORDER BY bet_value
        `);

        console.log(`\n找到 ${betData.length} 笔投注：`);
        betData.forEach(bet => {
            console.log(`\nID ${bet.id}:`);
            console.log(`- bet_value: "${bet.bet_value}" (类型: ${bet.bet_value_type})`);
            console.log(`- position: "${bet.position}" (类型: ${bet.position_type})`);
            console.log(`- 中奖状态: ${bet.win}`);
        });

        // 3. 模拟结算逻辑
        console.log('\n📌 步骤3：模拟结算逻辑...');
        if (period412Data && betData.length > 0) {
            const winningNumber = period412Data.position_10;
            console.log(`\n第10名开奖号码：${winningNumber}`);
            
            betData.forEach(bet => {
                console.log(`\n测试投注 ${bet.bet_value}：`);
                
                // 各种比较方式
                const test1 = bet.bet_value == winningNumber;
                const test2 = bet.bet_value === winningNumber;
                const test3 = parseInt(bet.bet_value) === parseInt(winningNumber);
                const test4 = bet.bet_value === winningNumber.toString();
                const test5 = bet.bet_value == winningNumber.toString();
                
                console.log(`- bet.bet_value == winningNumber: ${test1}`);
                console.log(`- bet.bet_value === winningNumber: ${test2}`);
                console.log(`- parseInt(bet.bet_value) === parseInt(winningNumber): ${test3}`);
                console.log(`- bet.bet_value === winningNumber.toString(): ${test4}`);
                console.log(`- bet.bet_value == winningNumber.toString(): ${test5}`);
                console.log(`- 实际中奖状态: ${bet.win}`);
                
                const shouldWin = test3; // 使用 parseInt 比较
                if (bet.win !== shouldWin) {
                    console.log(`❌ 错误！应该是 ${shouldWin}`);
                }
            });
        }

        // 4. 检查可能的数据污染
        console.log('\n📌 步骤4：检查数据是否有隐藏字符...');
        const suspiciousBets = await db.manyOrNone(`
            SELECT 
                id,
                bet_value,
                LENGTH(bet_value) as value_length,
                position,
                LENGTH(position) as position_length
            FROM bet_history
            WHERE period = '20250717412'
            AND username = 'justin111'
            AND position = '10'
            AND bet_type = 'number'
            AND (LENGTH(bet_value) > 2 OR LENGTH(position) > 2)
        `);

        if (suspiciousBets.length > 0) {
            console.log('\n⚠️ 发现可疑数据：');
            suspiciousBets.forEach(bet => {
                console.log(`- ID ${bet.id}: bet_value="${bet.bet_value}" (长度:${bet.value_length}), position="${bet.position}" (长度:${bet.position_length})`);
            });
        }

        // 5. 提供修复建议
        console.log('\n📌 步骤5：修复建议...');
        console.log('\n建议修改 enhanced-settlement-system.js 的第299-300行：');
        console.log(`
原代码：
const isWin = parseInt(winningNumber) === parseInt(betNumber);

建议改为：
// 确保移除任何空白字符并进行严格的数字比较
const cleanWinningNumber = String(winningNumber).trim();
const cleanBetNumber = String(betNumber).trim();
const isWin = parseInt(cleanWinningNumber, 10) === parseInt(cleanBetNumber, 10);

// 添加调试日志
if (bet.id) {
    settlementLog.info(\`号码比较: 开奖=\${cleanWinningNumber}(转换后:\${parseInt(cleanWinningNumber, 10)}), 投注=\${cleanBetNumber}(转换后:\${parseInt(cleanBetNumber, 10)}), 结果=\${isWin}\`);
}
`);

    } catch (error) {
        console.error('分析失败：', error);
    }
}

// 执行分析
analyzeAndFixNumberBetLogic().then(() => {
    console.log('\n✅ 分析完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 错误：', error);
    process.exit(1);
});