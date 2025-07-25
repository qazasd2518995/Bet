// analyze-settlement-confusion.js - 分析結算混淆問題
import db from './db/config.js';

async function analyzeSettlementConfusion() {
    console.log('🔍 分析期號219結算混淆問題...\n');
    
    try {
        // 首先檢查result_history表結構
        console.log('🔍 檢查result_history表結構：');
        const tableInfo = await db.any(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'result_history'
            ORDER BY ordinal_position
        `);
        
        console.log('表結構：');
        tableInfo.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type}`);
        });
        console.log('');
        
        // 1. 檢查result_history表中是否有多個相同期號的記錄
        console.log('📊 檢查result_history表中期號219的記錄：');
        const resultRecords = await db.any(`
            SELECT id, period, result, created_at
            FROM result_history
            WHERE period = 20250714219
            ORDER BY created_at ASC
        `);
        
        console.log(`找到 ${resultRecords.length} 條記錄：`);
        resultRecords.forEach((record, idx) => {
            console.log(`記錄 ${idx + 1}:`);
            console.log(`  ID: ${record.id}`);
            console.log(`  期號: ${record.period}`);
            console.log(`  結果: ${record.result}`);
            console.log(`  創建時間: ${record.created_at}`);
            
            // 解析結果
            let positions = [];
            try {
                if (typeof record.result === 'string') {
                    if (record.result.includes(',') && !record.result.includes('[')) {
                        // 逗號分隔的字符串格式
                        positions = record.result.split(',').map(n => parseInt(n.trim()));
                    } else {
                        positions = JSON.parse(record.result);
                    }
                } else {
                    positions = record.result;
                }
                
                if (Array.isArray(positions) && positions.length >= 7) {
                    console.log(`  第7名: ${positions[6]}號`);
                } else {
                    console.log(`  解析失敗或數據不完整`);
                }
            } catch (e) {
                console.log(`  解析錯誤: ${e.message}`);
            }
            console.log('');
        });
        
        // 2. 檢查遊戲狀態表中是否有期號219的信息
        console.log('🎮 檢查game_state表中期號219的記錄：');
        const gameStates = await db.any(`
            SELECT period, result, state, countdown, created_at
            FROM game_state
            WHERE period = 20250714219
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        if (gameStates.length > 0) {
            console.log(`找到 ${gameStates.length} 條遊戲狀態記錄：`);
            gameStates.forEach((state, idx) => {
                console.log(`狀態 ${idx + 1}:`);
                console.log(`  期號: ${state.period}`);
                console.log(`  狀態: ${state.state}`);
                console.log(`  倒計時: ${state.countdown}`);
                console.log(`  結果: ${state.result || '無'}`);
                console.log(`  創建時間: ${state.created_at}`);
                console.log('');
            });
        } else {
            console.log('未找到遊戲狀態記錄');
        }
        
        // 3. 檢查settlement_logs表中期號219的結算記錄
        console.log('📋 檢查settlement_logs表中期號219的結算記錄：');
        try {
            const settlementLogs = await db.any(`
                SELECT period, settled_count, total_win_amount, settlement_details, created_at
                FROM settlement_logs
                WHERE period = 20250714219
                ORDER BY created_at ASC
            `);
            
            if (settlementLogs.length > 0) {
                console.log(`找到 ${settlementLogs.length} 條結算記錄：`);
                settlementLogs.forEach((log, idx) => {
                    console.log(`結算記錄 ${idx + 1}:`);
                    console.log(`  期號: ${log.period}`);
                    console.log(`  結算數量: ${log.settled_count}`);
                    console.log(`  總中獎金額: ${log.total_win_amount}`);
                    console.log(`  結算時間: ${log.created_at}`);
                    
                    if (log.settlement_details) {
                        try {
                            const details = JSON.parse(log.settlement_details);
                            console.log(`  結算詳情: ${details.length} 筆注單`);
                            // 檢查第7名的結算詳情
                            const position7Bets = details.filter(d => 
                                d.betId >= 1652 && d.betId <= 1660
                            );
                            if (position7Bets.length > 0) {
                                console.log(`  第7名相關注單:`);
                                position7Bets.forEach(bet => {
                                    console.log(`    ID ${bet.betId}: ${bet.username} ${bet.isWin ? '中獎' : '未中獎'} $${bet.winAmount || 0}`);
                                });
                            }
                        } catch (e) {
                            console.log(`  詳情解析失敗: ${e.message}`);
                        }
                    }
                    console.log('');
                });
            } else {
                console.log('未找到結算記錄');
            }
        } catch (error) {
            console.log('settlement_logs表可能不存在或查詢失敗:', error.message);
        }
        
        // 4. 檢查投注記錄的創建時間和結算時間
        console.log('⏰ 檢查投注和結算的時間順序：');
        const betTimings = await db.any(`
            SELECT id, bet_value, amount, win, win_amount, 
                   created_at as bet_time, settled_at
            FROM bet_history
            WHERE period = 20250714219
            AND bet_type = 'number'
            AND position = 7
            ORDER BY created_at ASC
        `);
        
        console.log('投注時間序列：');
        betTimings.forEach(bet => {
            console.log(`ID ${bet.id}: 投注${bet.bet_value}號 於 ${bet.bet_time}, 結算於 ${bet.settled_at || '未知'}, ${bet.win ? '中獎' : '未中獎'}`);
        });
        
        // 5. 分析可能的數據格式混淆
        console.log('\n🔍 分析可能的數據格式問題：');
        
        if (resultRecords.length > 0) {
            const mainResult = resultRecords[0];
            console.log('主要開獎結果分析：');
            console.log(`原始數據: ${mainResult.result}`);
            console.log(`數據類型: ${typeof mainResult.result}`);
            
            // 嘗試多種解析方式
            const parseAttempts = [];
            
            // 方式1: 直接JSON解析
            try {
                const parsed1 = JSON.parse(mainResult.result);
                parseAttempts.push({
                    method: 'JSON.parse',
                    result: parsed1,
                    position7: Array.isArray(parsed1) ? parsed1[6] : (parsed1.positions ? parsed1.positions[6] : '無法取得')
                });
            } catch (e) {
                parseAttempts.push({
                    method: 'JSON.parse',
                    error: e.message
                });
            }
            
            // 方式2: 逗號分割
            try {
                if (mainResult.result.includes(',')) {
                    const parsed2 = mainResult.result.split(',').map(n => parseInt(n.trim()));
                    parseAttempts.push({
                        method: '逗號分割',
                        result: parsed2,
                        position7: parsed2[6]
                    });
                }
            } catch (e) {
                parseAttempts.push({
                    method: '逗號分割',
                    error: e.message
                });
            }
            
            // 方式3: 字符串處理
            if (typeof mainResult.result === 'string' && mainResult.result.includes('positions')) {
                try {
                    const match = mainResult.result.match(/positions.*?\[([^\]]+)\]/);
                    if (match) {
                        const parsed3 = match[1].split(',').map(n => parseInt(n.trim()));
                        parseAttempts.push({
                            method: '正則提取positions',
                            result: parsed3,
                            position7: parsed3[6]
                        });
                    }
                } catch (e) {
                    parseAttempts.push({
                        method: '正則提取positions',
                        error: e.message
                    });
                }
            }
            
            console.log('\n解析結果對比：');
            parseAttempts.forEach((attempt, idx) => {
                console.log(`方式 ${idx + 1} (${attempt.method}):`);
                if (attempt.error) {
                    console.log(`  錯誤: ${attempt.error}`);
                } else {
                    console.log(`  結果: ${JSON.stringify(attempt.result)}`);
                    console.log(`  第7名: ${attempt.position7}號`);
                }
                console.log('');
            });
        }
        
        // 6. 檢查結算函數調用記錄
        console.log('📝 建議檢查的問題點：');
        console.log('1. 結算時使用的開獎結果是否正確');
        console.log('2. 數據格式轉換是否有問題（array vs object）');
        console.log('3. 是否有時間差導致使用了錯誤的結果');
        console.log('4. improved-settlement-system.js 的 checkWin 函數邏輯');
        console.log('5. 位置索引是否正確（0-based vs 1-based）');
        
    } catch (error) {
        console.error('分析過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行分析
analyzeSettlementConfusion();