// 检查结算流程细节
import db from './db/config.js';

async function checkSettlementFlowDetail() {
    console.log('🔍 检查结算流程细节\n');

    try {
        // 1. 查找最近有号码投注错误的期号
        console.log('📌 步骤1：查找最近可能有结算错误的期号...');
        const errorCases = await db.manyOrNone(`
            SELECT DISTINCT
                bh.period,
                bh.position,
                bh.bet_value,
                bh.win,
                bh.win_amount,
                CASE 
                    WHEN bh.position = '1' THEN rh.position_1
                    WHEN bh.position = '2' THEN rh.position_2
                    WHEN bh.position = '3' THEN rh.position_3
                    WHEN bh.position = '4' THEN rh.position_4
                    WHEN bh.position = '5' THEN rh.position_5
                    WHEN bh.position = '6' THEN rh.position_6
                    WHEN bh.position = '7' THEN rh.position_7
                    WHEN bh.position = '8' THEN rh.position_8
                    WHEN bh.position = '9' THEN rh.position_9
                    WHEN bh.position = '10' THEN rh.position_10
                END as actual_number
            FROM bet_history bh
            JOIN result_history rh ON bh.period = rh.period
            WHERE bh.bet_type = 'number'
            AND bh.settled = true
            AND bh.created_at > NOW() - INTERVAL '1 day'
            ORDER BY bh.period DESC
            LIMIT 20
        `);

        console.log(`\n检查最近20笔号码投注：`);
        let errorCount = 0;
        
        errorCases.forEach(bet => {
            const shouldWin = parseInt(bet.bet_value) === parseInt(bet.actual_number);
            const isCorrect = bet.win === shouldWin;
            
            if (!isCorrect) {
                errorCount++;
                console.log(`\n❌ 错误案例：`);
                console.log(`- 期号：${bet.period}`);
                console.log(`- 位置：第${bet.position}名`);
                console.log(`- 投注号码：${bet.bet_value}`);
                console.log(`- 开奖号码：${bet.actual_number}`);
                console.log(`- 系统判定：${bet.win ? '中奖' : '未中奖'}`);
                console.log(`- 应该判定：${shouldWin ? '中奖' : '未中奖'}`);
                console.log(`- 错误奖金：${bet.win_amount}`);
            }
        });
        
        console.log(`\n总共发现 ${errorCount} 个结算错误`);

        // 2. 检查结算函数的调用顺序
        console.log('\n📌 步骤2：检查结算函数在 backend.js 中的实际使用...');
        
        // 这里模拟结算逻辑的问题
        console.log('\n可能的问题原因：');
        console.log('1. 资料库中 result_history 的 position_X 栏位可能在某些情况下被错误更新');
        console.log('2. 结算时可能存在并发问题，导致读取到错误的开奖结果');
        console.log('3. 可能有多个结算函数同时运行，导致数据混乱');

        // 3. 建议修复方案
        console.log('\n📌 步骤3：建议的修复方案...');
        console.log('\n在 enhanced-settlement-system.js 中添加更严格的验证：');
        console.log(`
// 在 checkBetWinEnhanced 函数的号码投注部分添加
if (betType === 'number' && bet.position) {
    const position = parseInt(bet.position);
    const betNumber = parseInt(betValue);
    
    // 添加详细日志
    const actualPositions = winResult.positions;
    settlementLog.info(\`号码投注验证: 投注ID=\${bet.id}, 位置=\${position}, 投注号码=\${betNumber}\`);
    settlementLog.info(\`开奖结果阵列: \${JSON.stringify(actualPositions)}\`);
    
    if (position < 1 || position > 10 || isNaN(betNumber)) {
        settlementLog.warn(\`无效投注: position=\${position}, betNumber=\${betNumber}\`);
        return { isWin: false, reason: '无效的位置或号码' };
    }
    
    const winningNumber = actualPositions[position - 1];
    const isWin = parseInt(winningNumber) === betNumber;
    
    // 添加结果验证日志
    settlementLog.info(\`结算结果: 位置\${position}开出\${winningNumber}, 投注\${betNumber}, 判定=\${isWin ? '中奖' : '未中奖'}\`);
    
    // 额外验证：确保开奖号码在有效范围内
    if (winningNumber < 1 || winningNumber > 10) {
        settlementLog.error(\`异常开奖号码: position=\${position}, number=\${winningNumber}\`);
        throw new Error(\`异常开奖号码: 第\${position}名开出\${winningNumber}\`);
    }
    
    return {
        isWin: isWin,
        reason: \`位置\${position}开出\${winningNumber}，投注\${betNumber}\${isWin ? '中奖' : '未中'}\`,
        odds: bet.odds || 9.85
    };
}
`);

        // 4. 检查是否有重复结算
        console.log('\n📌 步骤4：检查是否有重复结算的情况...');
        const duplicateSettlements = await db.manyOrNone(`
            SELECT 
                period,
                username,
                COUNT(*) as settlement_count,
                SUM(CASE WHEN transaction_type = 'win' THEN amount ELSE 0 END) as total_win
            FROM transaction_records
            WHERE transaction_type = 'win'
            AND created_at > NOW() - INTERVAL '1 day'
            GROUP BY period, username
            HAVING COUNT(*) > 1
            ORDER BY period DESC
            LIMIT 10
        `);

        if (duplicateSettlements.length > 0) {
            console.log('\n⚠️ 发现重复结算：');
            duplicateSettlements.forEach(dup => {
                console.log(`- 期号 ${dup.period}, 用户 ${dup.username}: ${dup.settlement_count} 次结算, 总奖金 ${dup.total_win}`);
            });
        } else {
            console.log('\n✅ 没有发现重复结算');
        }

    } catch (error) {
        console.error('检查失败：', error);
    }
}

// 执行检查
checkSettlementFlowDetail().then(() => {
    console.log('\n✅ 检查完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 错误：', error);
    process.exit(1);
});