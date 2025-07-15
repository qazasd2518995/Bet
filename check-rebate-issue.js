import db from './db/config.js';

async function checkRebateIssue() {
  try {
    console.log('=== 檢查退水計算問題 ===\n');

    // 1. 檢查 justin2025A 的代理鏈關係
    console.log('1. 檢查 justin2025A 的代理鏈關係：');
    const memberQuery = `
      WITH RECURSIVE agent_chain AS (
        -- 起始：找到會員的直屬代理
        SELECT 
          m.username as member_username,
          m.agent_id,
          m.market_type as member_market_type,
          a.id,
          a.username,
          a.parent_id,
          a.level,
          a.rebate_percentage,
          a.market_type,
          1 as chain_level
        FROM members m
        JOIN agents a ON m.agent_id = a.id
        WHERE m.username = 'justin2025A'
        
        UNION ALL
        
        -- 遞迴：找上級代理
        SELECT 
          ac.member_username,
          ac.agent_id,
          ac.member_market_type,
          a.id,
          a.username,
          a.parent_id,
          a.level,
          a.rebate_percentage,
          a.market_type,
          ac.chain_level + 1
        FROM agent_chain ac
        JOIN agents a ON ac.parent_id = a.id
      )
      SELECT * FROM agent_chain
      ORDER BY chain_level;
    `;
    
    const agentChain = await db.query(memberQuery);
    console.log('代理鏈：');
    agentChain.forEach(agent => {
      console.log(`  層級 ${agent.chain_level}: ${agent.username} (Level: ${agent.level}, 盤口: ${agent.market_type}, 退水: ${agent.rebate_percentage}%)`);
    });
    
    if (agentChain.length > 0) {
      console.log(`\n會員 justin2025A 的盤口類型: ${agentChain[0].member_market_type || '未設定（跟隨代理）'}`);
      console.log(`直屬代理 ${agentChain[0].username} 的盤口類型: ${agentChain[0].market_type}`);
    }

    // 2. 檢查最近的投注記錄
    console.log('\n2. 檢查 justin2025A 最近的投注記錄：');
    const betsQuery = `
      SELECT 
        b.id,
        b.member_id,
        b.amount,
        b.rebate_amount,
        b.agent_chain,
        b.created_at,
        ROUND((b.rebate_amount / b.amount * 100)::numeric, 2) as rebate_percentage
      FROM bet_history b
      JOIN members m ON b.member_id = m.id
      WHERE m.username = 'justin2025A'
      ORDER BY b.created_at DESC
      LIMIT 5;
    `;
    
    const bets = await db.query(betsQuery);
    console.log('最近投注：');
    bets.forEach(bet => {
      console.log(`\n  投注ID: ${bet.id}`);
      console.log(`  金額: ${bet.amount}, 退水: ${bet.rebate_amount}, 退水率: ${bet.rebate_percentage}%`);
      console.log(`  代理鏈: ${bet.agent_chain}`);
      console.log(`  時間: ${new Date(bet.created_at).toLocaleString()}`);
    });

    // 3. 檢查退水分配記錄
    console.log('\n3. 檢查退水分配詳情：');
    if (bets.length > 0) {
      const betId = bets[0].id;
      const rebateQuery = `
        SELECT 
          tr.bet_id,
          tr.agent_id,
          a.username,
          a.market_type,
          a.level,
          a.rebate_percentage,
          tr.type,
          tr.amount,
          tr.description
        FROM transaction_records tr
        JOIN agents a ON tr.agent_id = a.id
        WHERE tr.type = 'rebate' AND tr.bet_id = $1
        ORDER BY a.level;
      `;
      
      const rebateRecords = await db.query(rebateQuery, [betId]);
      console.log(`\n最近一筆投注（ID: ${betId}）的退水分配：`);
      let totalRebate = 0;
      rebateRecords.forEach(record => {
        totalRebate += parseFloat(record.amount);
        console.log(`  ${record.username} (Level ${record.level}, ${record.market_type}盤, 退水${record.rebate_percentage}%): ${record.amount}`);
      });
      console.log(`  總退水: ${totalRebate.toFixed(2)}`);
      
      if (bets[0].amount) {
        const totalRebatePercent = (totalRebate / bets[0].amount * 100).toFixed(2);
        console.log(`  總退水率: ${totalRebatePercent}%`);
      }
    }

    // 4. 分析問題
    console.log('\n=== 問題分析 ===');
    if (agentChain.length > 0 && bets.length > 0) {
      const directAgent = agentChain[0];
      const avgRebatePercent = bets.reduce((sum, bet) => sum + parseFloat(bet.rebate_percentage || 0), 0) / bets.length;
      
      console.log(`\n退水計算分析：`);
      console.log(`- 會員直屬代理: ${directAgent.username} (${directAgent.market_type}盤)`);
      console.log(`- 平均退水率: ${avgRebatePercent.toFixed(2)}%`);
      
      if (directAgent.market_type === 'A') {
        console.log(`- A盤標準退水池: 1.1%`);
        if (avgRebatePercent > 2) {
          console.log(`\n❌ 問題確認：A盤會員使用了過高的退水率！`);
          console.log(`   應該使用 1.1% 的總退水池，但實際使用了約 ${avgRebatePercent.toFixed(2)}%`);
          console.log(`   可能原因：系統錯誤地使用了 D盤的 4.1% 退水池`);
        }
      } else if (directAgent.market_type === 'D') {
        console.log(`- D盤標準退水池: 4.1%`);
        if (avgRebatePercent > 4.1) {
          console.log(`\n⚠️  退水率超過D盤標準！`);
        }
      }
    }

    // 5. 檢查結算系統文件
    console.log('\n5. 尋找結算系統文件：');
    const { readdirSync } = await import('fs');
    const files = readdirSync('.');
    const settlementFiles = files.filter(f => 
      f.includes('settlement') || 
      f.includes('rebate') || 
      f === 'backend.js' || 
      f === 'agentBackend.js'
    );
    
    console.log('相關文件：');
    settlementFiles.forEach(file => {
      console.log(`  - ${file}`);
    });

  } catch (error) {
    console.error('檢查失敗:', error);
  } finally {
    process.exit();
  }
}

checkRebateIssue();