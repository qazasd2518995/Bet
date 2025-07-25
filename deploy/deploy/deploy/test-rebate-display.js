// 測試代理層級分析報表的賺水顯示
import pgPromise from 'pg-promise';
import { databaseConfig } from './db/config.js';

const pgp = pgPromise();
const db = pgp(databaseConfig);

async function testRebateDisplay() {
    console.log('========================================');
    console.log('🧪 測試代理層級分析報表賺水顯示');
    console.log('========================================\n');
    
    try {
        // 查找 justin2025A 代理
        console.log('1️⃣ 查找代理 justin2025A...');
        const agent = await db.oneOrNone(`
            SELECT id, username, rebate_percentage, market_type 
            FROM agents 
            WHERE username = 'justin2025A'
        `);
        
        if (!agent) {
            console.log('❌ 找不到代理 justin2025A');
            return;
        }
        
        console.log(`✓ 找到代理: ${agent.username}`);
        console.log(`  退水設定: ${(agent.rebate_percentage * 100).toFixed(1)}%`);
        console.log(`  市場類型: ${agent.market_type}盤`);
        
        // 查找其下的會員
        console.log('\n2️⃣ 查找直屬會員...');
        const members = await db.any(`
            SELECT username FROM members 
            WHERE agent_id = $1 
            ORDER BY username
        `, [agent.id]);
        
        console.log(`✓ 找到 ${members.length} 個直屬會員`);
        
        // 查找會員 justin111 的下注數據
        const memberBets = await db.oneOrNone(`
            SELECT 
                COUNT(*) as bet_count,
                COALESCE(SUM(amount), 0) as total_bet
            FROM bet_history 
            WHERE username = 'justin111'
        `);
        
        if (memberBets && parseFloat(memberBets.total_bet) > 0) {
            console.log(`\n3️⃣ 會員 justin111 的下注數據：`);
            console.log(`  下注筆數: ${memberBets.bet_count}`);
            console.log(`  下注總額: ${memberBets.total_bet}`);
            
            const expectedRebate = parseFloat(memberBets.total_bet) * agent.rebate_percentage;
            console.log(`\n📊 賺水計算：`);
            console.log(`  計算公式: 下注總額 × 代理退水設定`);
            console.log(`  ${memberBets.total_bet} × ${(agent.rebate_percentage * 100).toFixed(1)}% = ${expectedRebate.toFixed(2)}`);
        }
        
        // 查找所有會員的下注總額
        console.log('\n4️⃣ 計算所有直屬會員的下注總額...');
        const allMemberBets = await db.oneOrNone(`
            SELECT 
                COUNT(*) as bet_count,
                COALESCE(SUM(amount), 0) as total_bet
            FROM bet_history 
            WHERE username IN (
                SELECT username FROM members WHERE agent_id = $1
            )
        `, [agent.id]);
        
        if (allMemberBets && parseFloat(allMemberBets.total_bet) > 0) {
            console.log(`✓ 所有直屬會員下注總額: ${allMemberBets.total_bet}`);
            
            const totalExpectedRebate = parseFloat(allMemberBets.total_bet) * agent.rebate_percentage;
            console.log(`\n📊 代理總賺水計算：`);
            console.log(`  ${allMemberBets.total_bet} × ${(agent.rebate_percentage * 100).toFixed(1)}% = ${totalExpectedRebate.toFixed(2)}`);
        }
        
        console.log('\n✅ 修正後的顯示邏輯：');
        console.log('  1. 代理的賺水 = 其直屬會員的下注總額 × 該代理的退水設定');
        console.log('  2. 會員的賺水 = 該會員的下注總額 × 直屬代理的退水設定');
        console.log('  3. 總計賺水 = 所有下注總額 × 查詢代理的退水設定');
        
    } catch (error) {
        console.error('❌ 測試失敗:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行測試
testRebateDisplay();