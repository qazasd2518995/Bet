// 调试 justin2025A 的退水计算问题
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
    console.log('🔍 调试 justin2025A 退水计算');
    console.log('========================================\n');
    
    try {
        // 1. 查询 justin2025A 的信息
        console.log('1️⃣ 查询 justin2025A 代理信息...');
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
        console.log(`  退水设定: ${(agent.rebate_percentage * 100).toFixed(1)}%`);
        console.log(`  市场类型: ${agent.market_type}盘`);
        console.log(`  上级代理: ${agent.parent_username || '无'}`);
        if (agent.parent_username) {
            console.log(`  上级退水: ${(agent.parent_rebate * 100).toFixed(1)}%`);
            const diff = agent.parent_rebate - agent.rebate_percentage;
            console.log(`  退水差额: ${(diff * 100).toFixed(1)}%`);
        }
        
        // 2. 查询直属代理和会员
        console.log('\n2️⃣ 查询直属下级...');
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
        
        console.log(`✓ 直属代理: ${subAgents.length} 个`);
        subAgents.forEach(sub => {
            console.log(`  - ${sub.username} (退水: ${(sub.rebate_percentage * 100).toFixed(1)}%)`);
        });
        
        console.log(`✓ 直属会员: ${members.length} 个`);
        members.forEach(member => {
            console.log(`  - ${member.username}`);
        });
        
        // 3. 计算下注统计
        console.log('\n3️⃣ 计算下注统计...');
        
        // 直属会员的下注
        const memberBets = await db.oneOrNone(`
            SELECT 
                COUNT(*) as bet_count,
                COALESCE(SUM(amount), 0) as total_bet
            FROM bet_history 
            WHERE username IN (
                SELECT username FROM members WHERE agent_id = $1
            )
        `, [agent.id]);
        
        console.log(`✓ 直属会员下注统计:`);
        console.log(`  笔数: ${memberBets.bet_count}`);
        console.log(`  总额: ${memberBets.total_bet}`);
        
        // 计算赚水
        const rebateAmount = parseFloat(memberBets.total_bet) * agent.rebate_percentage;
        console.log(`\n💰 赚水计算:`);
        console.log(`  公式: 下注总额 × 代理退水设定`);
        console.log(`  计算: ${memberBets.total_bet} × ${(agent.rebate_percentage * 100).toFixed(1)}%`);
        console.log(`  结果: ${rebateAmount.toFixed(2)}`);
        
        // 如果有上级，计算差额
        if (agent.parent_rebate) {
            const parentEarning = parseFloat(memberBets.total_bet) * (agent.parent_rebate - agent.rebate_percentage);
            console.log(`\n🔸 上级代理赚取 (旧逻辑):`);
            console.log(`  ${memberBets.total_bet} × ${((agent.parent_rebate - agent.rebate_percentage) * 100).toFixed(1)}% = ${parentEarning.toFixed(2)}`);
        }
        
        // 4. 检查是否有其他影响因素
        console.log('\n4️⃣ 检查可能的问题...');
        
        // 检查是否有子代理的会员下注
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
            console.log(`⚠️  发现子代理的会员下注:`);
            console.log(`  笔数: ${subAgentMemberBets.bet_count}`);
            console.log(`  总额: ${subAgentMemberBets.total_bet}`);
            console.log(`  这些下注不应该计入 justin2025A 的赚水`);
        }
        
        // 总计
        const allBets = parseFloat(memberBets.total_bet) + parseFloat(subAgentMemberBets.total_bet || 0);
        if (allBets > parseFloat(memberBets.total_bet)) {
            console.log(`\n❌ 可能的问题：`);
            console.log(`  如果报表显示总下注 ${allBets}，这包含了子代理的会员`);
            console.log(`  ${allBets} × 0.6% = ${(allBets * 0.006).toFixed(2)}`);
            console.log(`  这可能解释了为什么显示 1,720.69`);
        }
        
    } catch (error) {
        console.error('❌ 调试失败:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行调试
debugRebate();