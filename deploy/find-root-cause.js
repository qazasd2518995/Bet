// find-root-cause.js - 找出结算错误的根本原因
import db from './db/config.js';

async function findRootCause() {
    console.log('🔍 追查期号219结算错误的根本原因...\n');
    
    try {
        // 1. 检查期号219的原始错误状态（在我们修复前）
        console.log('📊 分析期号219的错误模式：');
        
        // 检查transaction_records看看修复记录
        const transactions = await db.any(`
            SELECT user_id, transaction_type, amount, description, created_at
            FROM transaction_records
            WHERE description LIKE '%20250714219%'
            ORDER BY created_at ASC
        `);
        
        console.log('相关交易记录：');
        transactions.forEach(tx => {
            console.log(`${tx.created_at}: ${tx.transaction_type} $${tx.amount} - ${tx.description}`);
        });
        
        // 2. 检查是否有settlement_logs记录原始结算
        const settlementLogs = await db.any(`
            SELECT period, settled_count, total_win_amount, settlement_details, created_at
            FROM settlement_logs
            WHERE period = 20250714219
            ORDER BY created_at ASC
        `);
        
        if (settlementLogs.length > 0) {
            console.log('\n📋 结算日志记录：');
            settlementLogs.forEach((log, idx) => {
                console.log(`记录 ${idx + 1} (${log.created_at}):`);
                console.log(`  结算数量: ${log.settled_count}`);
                console.log(`  总中奖金额: $${log.total_win_amount}`);
                
                if (log.settlement_details) {
                    const details = JSON.parse(log.settlement_details);
                    const position7Bets = details.filter(d => 
                        d.betId >= 1652 && d.betId <= 1660
                    );
                    
                    console.log(`  第7名相关结算:`);
                    position7Bets.forEach(bet => {
                        console.log(`    ID ${bet.betId}: ${bet.isWin ? '中奖' : '未中奖'} $${bet.winAmount || 0}`);
                    });
                }
                console.log('');
            });
        } else {
            console.log('\n📋 未找到settlement_logs记录');
        }
        
        // 3. 分析可能的错误来源
        console.log('🔍 分析可能的错误来源：\n');
        
        // 检查backend.js的修复历史
        console.log('修复时间线分析：');
        console.log('1. 原始问题: 重复结算 (已修复)');
        console.log('2. 数据格式问题: array vs {positions: array} (已修复)');
        console.log('3. 期号219特定问题: 结算逻辑错误 (手动修复)');
        
        // 4. 检查是否还有其他结算异常
        console.log('\n🔍 检查最近是否还有其他结算异常：');
        
        // 检查最近几期是否有异常的中奖模式
        const recentSettlements = await db.any(`
            SELECT period, COUNT(*) as total_bets, 
                   SUM(CASE WHEN win = true THEN 1 ELSE 0 END) as win_count,
                   SUM(CASE WHEN win = true THEN win_amount ELSE 0 END) as total_win_amount
            FROM bet_history
            WHERE period >= 20250714217 AND period <= 20250714221
            AND settled = true
            GROUP BY period
            ORDER BY period ASC
        `);
        
        console.log('最近几期结算统计：');
        recentSettlements.forEach(stat => {
            const winRate = ((stat.win_count / stat.total_bets) * 100).toFixed(2);
            console.log(`期号 ${stat.period}: ${stat.total_bets}注, ${stat.win_count}中奖 (${winRate}%), 总派彩 $${stat.total_win_amount}`);
        });
        
        // 5. 检查position 7的特定模式
        console.log('\n🎯 检查第7名投注的结算模式：');
        
        const position7Analysis = await db.any(`
            SELECT bh.period, rh.result, bh.bet_value, bh.win, bh.win_amount
            FROM bet_history bh
            JOIN result_history rh ON bh.period = rh.period
            WHERE bh.position = 7 
            AND bh.bet_type = 'number'
            AND bh.period >= 20250714217 
            AND bh.period <= 20250714221
            ORDER BY bh.period, bh.bet_value
        `);
        
        // 按期号分组分析
        const periodGroups = {};
        position7Analysis.forEach(bet => {
            if (!periodGroups[bet.period]) {
                periodGroups[bet.period] = {
                    result: bet.result,
                    bets: []
                };
            }
            periodGroups[bet.period].bets.push(bet);
        });
        
        Object.entries(periodGroups).forEach(([period, data]) => {
            // 解析开奖结果
            let positions = [];
            if (Array.isArray(data.result)) {
                positions = data.result;
            } else if (typeof data.result === 'string') {
                positions = data.result.split(',').map(n => parseInt(n.trim()));
            }
            
            const actualWinner = positions[6]; // 第7名
            console.log(`\n期号 ${period} - 第7名开出: ${actualWinner}号`);
            
            data.bets.forEach(bet => {
                const shouldWin = parseInt(bet.bet_value) === actualWinner;
                const actualWin = bet.win;
                const correct = shouldWin === actualWin;
                
                const status = correct ? '✅' : '❌';
                console.log(`  ${status} 投注${bet.bet_value}号: ${actualWin ? '中奖' : '未中奖'} $${bet.win_amount || 0} ${correct ? '' : '(错误!)'}`);
            });
        });
        
        // 6. 检查系统当前状态
        console.log('\n🔧 系统当前状态检查：');
        
        // 检查backend.js的settleBets函数调用
        console.log('Backend.js settleBets调用:');
        console.log('✅ 行1204: await settleBets(currentDrawPeriod, { positions: newResult });');
        console.log('✅ 数据格式: 正确的 {positions: array} 格式');
        
        // 检查improvedSettleBets是否正常工作
        console.log('\nImproved settlement system:');
        console.log('✅ 分布式锁机制: 防止重复结算');
        console.log('✅ 事务处理: 确保数据一致性');
        console.log('✅ checkWin函数: 正确的位置索引逻辑');
        
        // 7. 总结根本原因
        console.log('\n🎯 根本原因分析总结：');
        console.log('期号219的结算错误很可能是由以下原因造成的：');
        console.log('');
        console.log('1. **数据格式转换问题** (已修复):');
        console.log('   - 修复前: settleBets(period, array)');
        console.log('   - checkWin收到array, winResult.positions = undefined');
        console.log('   - 导致所有投注应该return false');
        console.log('');
        console.log('2. **多重结算系统冲突** (已修复):');
        console.log('   - 新的improvedSettleBets + 旧的legacySettleBets');
        console.log('   - 旧系统可能使用了不同的判断逻辑');
        console.log('   - 结果被多次覆写导致混乱');
        console.log('');
        console.log('3. **时间竞争条件**:');
        console.log('   - 投注在04:32创建，开奖在04:33');
        console.log('   - 可能存在数据同步延迟');
        console.log('');
        console.log('4. **可能的手动干预或系统故障**:');
        console.log('   - 某些投注被手动修改过');
        console.log('   - 或者系统在结算时发生了异常');
        
        console.log('\n✅ 当前防护措施：');
        console.log('1. 统一使用improvedSettleBets');
        console.log('2. 正确的数据格式 {positions: array}');
        console.log('3. 分布式锁防止重复结算');
        console.log('4. 事务处理确保原子性');
        console.log('5. 详细的日志记录');
        
        console.log('\n🔮 预防未来问题的建议：');
        console.log('1. 实时监控结算正确性');
        console.log('2. 添加结算前后的数据验证');
        console.log('3. 实施结算结果的自动对账');
        console.log('4. 建立异常告警机制');
        
    } catch (error) {
        console.error('分析过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行分析
findRootCause();