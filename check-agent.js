import db from './db/config.js';

async function checkAgent() {
    try {
        console.log('檢查 A 盤總代理...');
        
        // 查詢 A 盤總代理
        const agent = await db.oneOrNone(`
            SELECT id, username, password, level, status, market_type, balance 
            FROM agents 
            WHERE username = $1
        `, ['MA@x9Kp#2025$zL7']);
        
        if (agent) {
            console.log('找到代理:', {
                id: agent.id,
                username: agent.username,
                level: agent.level,
                status: agent.status,
                market_type: agent.market_type,
                balance: agent.balance,
                passwordType: agent.password.startsWith('$2') ? 'hashed' : 'plain'
            });
        } else {
            console.log('代理不存在');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('錯誤:', error);
        process.exit(1);
    }
}

checkAgent();