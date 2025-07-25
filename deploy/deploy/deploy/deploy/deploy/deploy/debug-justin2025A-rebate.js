// 調試 justin2025A 的退水計算問題
import pgPromise from 'pg-promise';

const pgp = pgPromise();
const db = pgp({
    host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bet_game',
    user: 'bet_game_user',
    password: 'B4x0J7dYjOt11BmK7JEbQ5n9cXoTQY9R',
    ssl: { rejectUnauthorized: false }
});

async function debugRebate() {
    console.log('========================================');
    console.log('🔍 調試 justin2025A 退水計算');
    console.log('========================================\n');
    
    try {
        // 1. 查詢 justin2025A 的信息
        console.log('1️⃣ 查詢 justin2025A 代理信息...');
        const agent = await db.oneOrNone(`
            SELECT a.*, p.username as parent_username, p.rebate_percentage as parent_rebate
            FROM agents a
            LEFT JOIN agents p ON a.parent_id = p.id
            WHERE a.username = 'justin2025A'
        `);
        
        if (!agent) {
            console.log('❌ 找不到代理 justin2025A');
            return;
        }
        
        console.log(`✓ 代理: ${agent.username}`);
        console.log(`  ID: ${agent.id}`);
        console.log(`  退水設定: ${(agent.rebate_percentage * 100).toFixed(1)}%`);
        console.log(`  市場類型: ${agent.market_type}盤`);
        console.log(`  上級代理: ${agent.parent_username || '無'}`);
        if (agent.parent_username) {
            console.log(`  上級退水: ${(agent.parent_rebate * 100).toFixed(1)}%`);
            const diff = agent.parent_rebate - agent.rebate_percentage;
            console.log(`  退水差額: ${(diff * 100).toFixed(1)}%`);
        }
        
        // 2. 查詢直屬代理和會員
        console.log('\n2️⃣ 查詢直屬下級...');
        const subAgents = await db.any(`
            SELECT username, rebate_percentage 
            FROM agents 
            WHERE parent_id = $1 AND status = 1
            ORDER BY username
        `, [agent.id]);
        
        const members = await db.any(`
            SELECT username 
            FROM members 
            WHERE agent_id = $1 AND status = 1
            ORDER BY username
        `, [agent.id]);
        
        console.log(`✓ 直屬代理: ${subAgents.length} 個`);
        subAgents.forEach(sub => {
            console.log(`  - ${sub.username} (退水: ${(sub.rebate_percentage * 100).toFixed(1)}%)`);
        });
        
        console.log(`✓ 直屬會員: ${members.length} 個`);
        members.forEach(member => {
            console.log(`  - ${member.username}`);
        });
        
        // 3. 計算下注統計
        console.log('\n3️⃣ 計算下注統計...');
        
        // 直屬會員的下注
        const memberBets = await db.oneOrNone(`
            SELECT 
                COUNT(*) as bet_count,
                COALESCE(SUM(amount), 0) as total_bet
            FROM bet_history 
            WHERE username IN (
                SELECT username FROM members WHERE agent_id = $1
            )
        `, [agent.id]);
        
        console.log(`✓ 直屬會員下注統計:`);
        console.log(`  筆數: ${memberBets.bet_count}`);
        console.log(`  總額: ${memberBets.total_bet}`);
        
        // 計算賺水
        const rebateAmount = parseFloat(memberBets.total_bet) * agent.rebate_percentage;
        console.log(`\n💰 賺水計算:`);
        console.log(`  公式: 下注總額 × 代理退水設定`);
        console.log(`  計算: ${memberBets.total_bet} × ${(agent.rebate_percentage * 100).toFixed(1)}%`);
        console.log(`  結果: ${rebateAmount.toFixed(2)}`);
        
        // 如果有上級，計算差額
        if (agent.parent_rebate) {
            const parentEarning = parseFloat(memberBets.total_bet) * (agent.parent_rebate - agent.rebate_percentage);
            console.log(`\n🔸 上級代理賺取 (舊邏輯):`);
            console.log(`  ${memberBets.total_bet} × ${((agent.parent_rebate - agent.rebate_percentage) * 100).toFixed(1)}% = ${parentEarning.toFixed(2)}`);
        }
        
        // 4. 檢查是否有其他影響因素
        console.log('\n4️⃣ 檢查可能的問題...');
        
        // 檢查是否有子代理的會員下注
        const subAgentMemberBets = await db.oneOrNone(`
            SELECT 
                COUNT(*) as bet_count,
                COALESCE(SUM(amount), 0) as total_bet
            FROM bet_history 
            WHERE username IN (
                SELECT m.username 
                FROM members m
                JOIN agents a ON m.agent_id = a.id
                WHERE a.parent_id = $1
            )
        `, [agent.id]);
        
        if (subAgentMemberBets && parseFloat(subAgentMemberBets.total_bet) > 0) {
            console.log(`⚠️  發現子代理的會員下注:`);
            console.log(`  筆數: ${subAgentMemberBets.bet_count}`);
            console.log(`  總額: ${subAgentMemberBets.total_bet}`);
            console.log(`  這些下注不應該計入 justin2025A 的賺水`);
        }
        
        // 總計
        const allBets = parseFloat(memberBets.total_bet) + parseFloat(subAgentMemberBets.total_bet || 0);
        if (allBets > parseFloat(memberBets.total_bet)) {
            console.log(`\n❌ 可能的問題：`);
            console.log(`  如果報表顯示總下注 ${allBets}，這包含了子代理的會員`);
            console.log(`  ${allBets} × 0.6% = ${(allBets * 0.006).toFixed(2)}`);
            console.log(`  這可能解釋了為什麼顯示 1,720.69`);
        }
        
    } catch (error) {
        console.error('❌ 調試失敗:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行調試
debugRebate();