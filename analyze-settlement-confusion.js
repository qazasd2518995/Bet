// analyze-settlement-confusion.js - 分析结算混淆问题
import db from './db/config.js';

async function analyzeSettlementConfusion() {
    console.log('🔍 分析期号219结算混淆问题...\n');
    
    try {
        // 首先检查result_history表结构
        console.log('🔍 检查result_history表结构：');
        const tableInfo = await db.any(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'result_history'
            ORDER BY ordinal_position
        `);
        
        console.log('表结构：');
        tableInfo.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type}`);
        });
        console.log('');
        
        // 1. 检查result_history表中是否有多个相同期号的记录
        console.log('📊 检查result_history表中期号219的记录：');
        const resultRecords = await db.any(`
            SELECT id, period, result, created_at
            FROM result_history
            WHERE period = 20250714219
            ORDER BY created_at ASC
        `);
        
        console.log(`找到 ${resultRecords.length} 条记录：`);
        resultRecords.forEach((record, idx) => {
            console.log(`记录 ${idx + 1}:`);
            console.log(`  ID: ${record.id}`);
            console.log(`  期号: ${record.period}`);
            console.log(`  结果: ${record.result}`);
            console.log(`  创建时间: ${record.created_at}`);
            
            // 解析结果
            let positions = [];
            try {
                if (typeof record.result === 'string') {
                    if (record.result.includes(',') && !record.result.includes('[')) {
                        // 逗号分隔的字符串格式
                        positions = record.result.split(',').map(n => parseInt(n.trim()));
                    } else {
                        positions = JSON.parse(record.result);
                    }
                } else {
                    positions = record.result;
                }
                
                if (Array.isArray(positions) && positions.length >= 7) {
                    console.log(`  第7名: ${positions[6]}号`);
                } else {
                    console.log(`  解析失败或数据不完整`);
                }
            } catch (e) {
                console.log(`  解析错误: ${e.message}`);
            }
            console.log('');
        });
        
        // 2. 检查游戏状态表中是否有期号219的信息
        console.log('🎮 检查game_state表中期号219的记录：');
        const gameStates = await db.any(`
            SELECT period, result, state, countdown, created_at
            FROM game_state
            WHERE period = 20250714219
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        if (gameStates.length > 0) {
            console.log(`找到 ${gameStates.length} 条游戏状态记录：`);
            gameStates.forEach((state, idx) => {
                console.log(`状态 ${idx + 1}:`);
                console.log(`  期号: ${state.period}`);
                console.log(`  状态: ${state.state}`);
                console.log(`  倒计时: ${state.countdown}`);
                console.log(`  结果: ${state.result || '无'}`);
                console.log(`  创建时间: ${state.created_at}`);
                console.log('');
            });
        } else {
            console.log('未找到游戏状态记录');
        }
        
        // 3. 检查settlement_logs表中期号219的结算记录
        console.log('📋 检查settlement_logs表中期号219的结算记录：');
        try {
            const settlementLogs = await db.any(`
                SELECT period, settled_count, total_win_amount, settlement_details, created_at
                FROM settlement_logs
                WHERE period = 20250714219
                ORDER BY created_at ASC
            `);
            
            if (settlementLogs.length > 0) {
                console.log(`找到 ${settlementLogs.length} 条结算记录：`);
                settlementLogs.forEach((log, idx) => {
                    console.log(`结算记录 ${idx + 1}:`);
                    console.log(`  期号: ${log.period}`);
                    console.log(`  结算数量: ${log.settled_count}`);
                    console.log(`  总中奖金额: ${log.total_win_amount}`);
                    console.log(`  结算时间: ${log.created_at}`);
                    
                    if (log.settlement_details) {
                        try {
                            const details = JSON.parse(log.settlement_details);
                            console.log(`  结算详情: ${details.length} 笔注单`);
                            // 检查第7名的结算详情
                            const position7Bets = details.filter(d => 
                                d.betId >= 1652 && d.betId <= 1660
                            );
                            if (position7Bets.length > 0) {
                                console.log(`  第7名相关注单:`);
                                position7Bets.forEach(bet => {
                                    console.log(`    ID ${bet.betId}: ${bet.username} ${bet.isWin ? '中奖' : '未中奖'} $${bet.winAmount || 0}`);
                                });
                            }
                        } catch (e) {
                            console.log(`  详情解析失败: ${e.message}`);
                        }
                    }
                    console.log('');
                });
            } else {
                console.log('未找到结算记录');
            }
        } catch (error) {
            console.log('settlement_logs表可能不存在或查询失败:', error.message);
        }
        
        // 4. 检查投注记录的创建时间和结算时间
        console.log('⏰ 检查投注和结算的时间顺序：');
        const betTimings = await db.any(`
            SELECT id, bet_value, amount, win, win_amount, 
                   created_at as bet_time, settled_at
            FROM bet_history
            WHERE period = 20250714219
            AND bet_type = 'number'
            AND position = 7
            ORDER BY created_at ASC
        `);
        
        console.log('投注时间序列：');
        betTimings.forEach(bet => {
            console.log(`ID ${bet.id}: 投注${bet.bet_value}号 于 ${bet.bet_time}, 结算于 ${bet.settled_at || '未知'}, ${bet.win ? '中奖' : '未中奖'}`);
        });
        
        // 5. 分析可能的数据格式混淆
        console.log('\n🔍 分析可能的数据格式问题：');
        
        if (resultRecords.length > 0) {
            const mainResult = resultRecords[0];
            console.log('主要开奖结果分析：');
            console.log(`原始数据: ${mainResult.result}`);
            console.log(`数据类型: ${typeof mainResult.result}`);
            
            // 尝试多种解析方式
            const parseAttempts = [];
            
            // 方式1: 直接JSON解析
            try {
                const parsed1 = JSON.parse(mainResult.result);
                parseAttempts.push({
                    method: 'JSON.parse',
                    result: parsed1,
                    position7: Array.isArray(parsed1) ? parsed1[6] : (parsed1.positions ? parsed1.positions[6] : '无法取得')
                });
            } catch (e) {
                parseAttempts.push({
                    method: 'JSON.parse',
                    error: e.message
                });
            }
            
            // 方式2: 逗号分割
            try {
                if (mainResult.result.includes(',')) {
                    const parsed2 = mainResult.result.split(',').map(n => parseInt(n.trim()));
                    parseAttempts.push({
                        method: '逗号分割',
                        result: parsed2,
                        position7: parsed2[6]
                    });
                }
            } catch (e) {
                parseAttempts.push({
                    method: '逗号分割',
                    error: e.message
                });
            }
            
            // 方式3: 字符串处理
            if (typeof mainResult.result === 'string' && mainResult.result.includes('positions')) {
                try {
                    const match = mainResult.result.match(/positions.*?\[([^\]]+)\]/);
                    if (match) {
                        const parsed3 = match[1].split(',').map(n => parseInt(n.trim()));
                        parseAttempts.push({
                            method: '正则提取positions',
                            result: parsed3,
                            position7: parsed3[6]
                        });
                    }
                } catch (e) {
                    parseAttempts.push({
                        method: '正则提取positions',
                        error: e.message
                    });
                }
            }
            
            console.log('\n解析结果对比：');
            parseAttempts.forEach((attempt, idx) => {
                console.log(`方式 ${idx + 1} (${attempt.method}):`);
                if (attempt.error) {
                    console.log(`  错误: ${attempt.error}`);
                } else {
                    console.log(`  结果: ${JSON.stringify(attempt.result)}`);
                    console.log(`  第7名: ${attempt.position7}号`);
                }
                console.log('');
            });
        }
        
        // 6. 检查结算函数调用记录
        console.log('📝 建议检查的问题点：');
        console.log('1. 结算时使用的开奖结果是否正确');
        console.log('2. 数据格式转换是否有问题（array vs object）');
        console.log('3. 是否有时间差导致使用了错误的结果');
        console.log('4. improved-settlement-system.js 的 checkWin 函数逻辑');
        console.log('5. 位置索引是否正确（0-based vs 1-based）');
        
    } catch (error) {
        console.error('分析过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行分析
analyzeSettlementConfusion();