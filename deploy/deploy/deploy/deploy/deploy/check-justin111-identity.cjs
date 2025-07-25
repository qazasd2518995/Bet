const Database = require('better-sqlite3');
const path = require('path');

console.log('🔍 完整檢查 justin111 的身份和退水設定...\n');

try {
    // 連接資料庫
    const dbPath = path.join(__dirname, 'betting_site.db');
    const db = new Database(dbPath);
    
    console.log('0️⃣ 檢查資料庫表結構:');
    const tableInfo = db.prepare("PRAGMA table_info(bet_history)").all();
    console.log('   bet_history表欄位:', tableInfo.map(col => col.name).join(', '));
    console.log('');
    
    // 1. 檢查會員表
    console.log('1️⃣ 檢查會員表中的 justin111:');
    const member = db.prepare("SELECT * FROM members WHERE username = ?").get('justin111');
    if (member) {
        console.log('   ✅ 找到會員:', {
            username: member.username,
            balance: member.balance,
            market_type: member.market_type,
            agent_username: member.agent_username,
            rebate_rate: member.rebate_rate
        });
    } else {
        console.log('   ❌ 在會員表中未找到 justin111');
    }
    
    // 2. 檢查代理表
    console.log('\n2️⃣ 檢查代理表中的 justin111:');
    const agent = db.prepare("SELECT * FROM agents WHERE username = ?").get('justin111');
    if (agent) {
        console.log('   ✅ 找到代理:', {
            username: agent.username,
            balance: agent.balance,
            market_type: agent.market_type
        });
    } else {
        console.log('   ❌ 在代理表中未找到 justin111');
    }
    
    // 3. 檢查今日最新的期數
    console.log('\n3️⃣ 檢查今日最新期數:');
    const latestPeriod = db.prepare(`
        SELECT * FROM periods 
        WHERE date = date('now', 'localtime') 
        ORDER BY period_number DESC 
        LIMIT 1
    `).get();
    
    if (latestPeriod) {
        console.log('   最新期數:', latestPeriod.period_number);
        console.log('   狀態:', latestPeriod.status);
        console.log('   開獎號碼:', latestPeriod.result);
    } else {
        console.log('   ❌ 沒有找到今日期數');
    }
    
    // 4. 檢查 justin111 的下注記錄（最近5筆）
    console.log('\n4️⃣ 檢查 justin111 的最近下注記錄:');
    const bets = db.prepare(`
        SELECT * FROM bet_history 
        WHERE username = ? 
        ORDER BY created_at DESC 
        LIMIT 5
    `).all('justin111');
    
    console.log(`   找到 ${bets.length} 筆下注記錄:`);
    bets.forEach((bet, index) => {
        console.log(`   ${index + 1}. 期數: ${bet.period}, 下注: ${bet.bet_type}${bet.bet_value}, 金額: ${bet.amount}, 賠率: ${bet.odds}, 中獎: ${bet.win}, 獎金: ${bet.win_amount}, 已結算: ${bet.settled}`);
    });
    
    // 5. 檢查 ti2025A 代理資訊
    console.log('\n5️⃣ 檢查代理 ti2025A:');
    const ti2025A = db.prepare("SELECT * FROM agents WHERE username = ?").get('ti2025A');
    if (ti2025A) {
        console.log('   ✅ 找到代理 ti2025A:', {
            username: ti2025A.username,
            balance: ti2025A.balance,
            market_type: ti2025A.market_type
        });
        
        // 檢查該代理下的會員
        const agentMembers = db.prepare("SELECT username, balance, market_type FROM members WHERE agent_username = ?").all('ti2025A');
        console.log(`   代理下會員數: ${agentMembers.length}`);
        agentMembers.forEach(m => {
            console.log(`     - ${m.username}: 餘額 ${m.balance}, 盤口 ${m.market_type}`);
        });
    } else {
        console.log('   ❌ 在代理表中未找到 ti2025A');
    }
    
    // 6. 檢查退水記錄
    console.log('\n6️⃣ 檢查 justin111 的退水記錄:');
    const rebates = db.prepare(`
        SELECT * FROM rebates 
        WHERE username = ? 
        ORDER BY created_at DESC 
        LIMIT 5
    `).all('justin111');
    
    console.log(`   找到 ${rebates.length} 筆退水記錄:`);
    rebates.forEach((rebate, index) => {
        console.log(`   ${index + 1}. 期數: ${rebate.period}, 金額: ${rebate.amount}, 日期: ${rebate.created_at}`);
    });
    
    console.log('\n🎯 問題分析:');
    if (!member && !agent) {
        console.log('   ❌ CRITICAL: justin111 既不是會員也不是代理！');
        console.log('   這表示可能存在資料庫不一致性問題。');
    } else if (member) {
        console.log('   ✅ justin111 是會員帳號');
        console.log(`   所屬代理: ${member.agent_username}`);
        console.log(`   盤口類型: ${member.market_type}`);
        console.log(`   退水率: ${member.rebate_rate}`);
    }
    
    db.close();
    
} catch (error) {
    console.error('❌ 檢查過程發生錯誤:', error.message);
}
