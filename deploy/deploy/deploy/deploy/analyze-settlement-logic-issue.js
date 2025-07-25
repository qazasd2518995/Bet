// analyze-settlement-logic-issue.js - 分析結算邏輯問題
import db from './db/config.js';
import { checkWin } from './improved-settlement-system.js';

async function analyzeSettlementLogicIssue() {
    try {
        console.log('🔍 分析結算邏輯問題...\n');
        
        // 1. 檢查最近的結算日誌
        console.log('📋 最近的結算日誌:');
        const recentLogs = await db.any(`
            SELECT period, settled_count, total_win_amount, created_at 
            FROM settlement_logs 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        
        recentLogs.forEach(log => {
            console.log(`期號 ${log.period}: ${log.settled_count}筆, 總中獎 $${log.total_win_amount} (${log.created_at.toLocaleString('zh-TW')})`);
        });
        
        // 2. 檢查checkWin函數是否正常工作
        console.log('\n🧪 測試checkWin函數:');
        
        // 模擬測試案例
        const testCases = [
            {
                bet: { bet_type: 'champion', bet_value: 'big' },
                winResult: { positions: [7, 2, 3, 4, 5, 6, 8, 9, 10, 1] },
                expected: true,
                description: '冠軍大 (7號)'
            },
            {
                bet: { bet_type: 'champion', bet_value: 'small' },
                winResult: { positions: [3, 2, 1, 4, 5, 6, 7, 8, 9, 10] },
                expected: true,
                description: '冠軍小 (3號)'
            },
            {
                bet: { bet_type: 'tenth', bet_value: 'odd' },
                winResult: { positions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 7] },
                expected: true,
                description: '第十名單 (7號)'
            },
            {
                bet: { bet_type: 'fifth', bet_value: 'even' },
                winResult: { positions: [1, 2, 3, 4, 8, 6, 7, 5, 9, 10] },
                expected: true,
                description: '第五名雙 (8號)'
            }
        ];
        
        testCases.forEach(test => {
            const result = checkWin(test.bet, test.winResult);
            const status = result === test.expected ? '✅' : '❌';
            console.log(`${status} ${test.description}: ${result ? '中獎' : '未中獎'}`);
        });
        
        // 3. 檢查最近的投注記錄結算狀態
        console.log('\n📊 最近期號的結算狀態:');
        const recentPeriods = await db.any(`
            SELECT period, 
                   COUNT(*) as total_bets,
                   SUM(CASE WHEN settled = true THEN 1 ELSE 0 END) as settled_bets,
                   SUM(CASE WHEN win = true THEN 1 ELSE 0 END) as winning_bets,
                   SUM(CASE WHEN win = true THEN win_amount ELSE 0 END) as total_winnings
            FROM bet_history 
            WHERE username = 'justin111' 
                AND period >= 20250714290
            GROUP BY period
            ORDER BY period DESC
            LIMIT 10
        `);
        
        recentPeriods.forEach(p => {
            console.log(`期號 ${p.period}: ${p.total_bets}筆 (已結算${p.settled_bets}, 中獎${p.winning_bets}, 總獎金$${p.total_winnings || 0})`);
        });
        
        // 4. 檢查bet_value的格式
        console.log('\n🔍 檢查bet_value格式:');
        const betValueFormats = await db.any(`
            SELECT DISTINCT bet_value, COUNT(*) as count
            FROM bet_history 
            WHERE username = 'justin111' 
                AND period >= 20250714290
            GROUP BY bet_value
            ORDER BY count DESC
        `);
        
        console.log('投注選項格式分佈:');
        betValueFormats.forEach(v => {
            console.log(`  "${v.bet_value}": ${v.count}筆`);
        });
        
        // 5. 分析可能的問題原因
        console.log('\n🎯 問題分析:');
        
        // 檢查是否有中文與英文混用問題
        const mixedFormats = await db.any(`
            SELECT period, bet_type, bet_value, win, created_at
            FROM bet_history 
            WHERE username = 'justin111' 
                AND period >= 20250714299
                AND bet_value IN ('單', '雙', '大', '小')
            ORDER BY period DESC, created_at DESC
            LIMIT 10
        `);
        
        if (mixedFormats.length > 0) {
            console.log('\n⚠️ 發現使用中文投注選項:');
            mixedFormats.forEach(b => {
                console.log(`  期號 ${b.period}: ${b.bet_type} ${b.bet_value} - ${b.win ? '中獎' : '輸'}`);
            });
        }
        
        // 6. 檢查checkWin函數對中文的支援
        console.log('\n🧪 測試checkWin對中文的支援:');
        const chineseTests = [
            {
                bet: { bet_type: 'champion', bet_value: '大' },
                winResult: { positions: [7, 2, 3, 4, 5, 6, 8, 9, 10, 1] },
                description: '冠軍大(中文) (7號)'
            },
            {
                bet: { bet_type: 'champion', bet_value: '單' },
                winResult: { positions: [7, 2, 3, 4, 5, 6, 8, 9, 10, 1] },
                description: '冠軍單(中文) (7號)'
            }
        ];
        
        chineseTests.forEach(test => {
            const result = checkWin(test.bet, test.winResult);
            const status = result ? '✅' : '❌';
            console.log(`${status} ${test.description}: ${result ? '中獎' : '未中獎'}`);
        });
        
        console.log('\n💡 結論:');
        console.log('問題可能是checkWin函數不支援中文的"大"、"小"、"單"、"雙"');
        console.log('需要更新checkWin函數以支援中文投注選項');
        
        await db.$pool.end();
    } catch (error) {
        console.error('分析過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

analyzeSettlementLogicIssue();