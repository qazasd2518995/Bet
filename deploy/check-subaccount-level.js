import pgp from 'pg-promise';
import config from './db/config.js';

const db = pgp()(config);

async function checkSubAccountLevel() {
    try {
        console.log('检查子帐号级别问题...\n');
        
        // 查询子帐号 justin2025Ab
        const subAccount = await db.oneOrNone(`
            SELECT sa.*, a.username as parent_agent_username, a.id as parent_agent_id, a.level as parent_agent_level
            FROM sub_accounts sa
            JOIN agents a ON sa.parent_agent_id = a.id
            WHERE sa.username = $1
        `, ['justin2025Ab']);
        
        if (subAccount) {
            console.log('子帐号信息:');
            console.log('- 子帐号用户名:', subAccount.username);
            console.log('- 父代理ID:', subAccount.parent_agent_id);
            console.log('- 父代理用户名:', subAccount.parent_agent_username);
            console.log('- 父代理级别:', subAccount.parent_agent_level);
            console.log('\n');
            
            // 直接查询父代理
            const parentAgent = await db.oneOrNone(`
                SELECT id, username, level
                FROM agents
                WHERE username = $1
            `, ['ti2025A']);
            
            if (parentAgent) {
                console.log('直接查询父代理 ti2025A:');
                console.log('- ID:', parentAgent.id);
                console.log('- 用户名:', parentAgent.username);
                console.log('- 级别:', parentAgent.level);
                console.log('\n');
            }
            
            // 查询 ID 28 的代理
            const agent28 = await db.oneOrNone(`
                SELECT id, username, level
                FROM agents
                WHERE id = 28
            `, []);
            
            if (agent28) {
                console.log('ID 28 的代理信息:');
                console.log('- ID:', agent28.id);
                console.log('- 用户名:', agent28.username);
                console.log('- 级别:', agent28.level);
            }
        } else {
            console.log('找不到子帐号 justin2025Ab');
        }
        
    } catch (error) {
        console.error('错误:', error);
    } finally {
        await db.$pool.end();
    }
}

checkSubAccountLevel();