// backend.js 中 settleBets 函數的修復版本
// 將此代碼整合到現有的 backend.js 中

async function settleBets(period, winResult) {
  console.log(`結算第${period}期注單...`);
  
  // 獲取系統時間內未結算的注單
  const bets = await BetModel.getUnsettledByPeriod(period);
  
  console.log(`找到${bets.length}個未結算注單`);
  
  if (bets.length === 0) {
    console.log(`第${period}期注單結算完成`);
    return;
  }
  
  // 獲取總代理ID
  const adminAgent = await getAdminAgentId();
  if (!adminAgent) {
    console.error('結算注單失敗: 找不到總代理帳戶');
    return;
  }
  
  // 使用事務處理整個批次結算過程，確保原子性
  try {
    // 遍歷並結算每個注單
    for (const bet of bets) {
      try {
        const username = bet.username;
        
        // 計算贏錢金額
        const winAmount = calculateWinAmount(bet, winResult);
        const isWin = winAmount > 0;
        
        console.log(`結算用戶 ${username} 的注單 ${bet.id}，下注類型: ${bet.bet_type}，下注值: ${bet.bet_value}，贏錢金額: ${winAmount}`);
        
        // 標記為已結算 - 使用修改過的 updateSettlement 方法，防止重複結算
        const settledBet = await BetModel.updateSettlement(bet.id, isWin, winAmount);
        
        // 如果沒有成功結算（可能已經被結算過），則跳過後續處理
        if (!settledBet) {
          console.log(`注單 ${bet.id} 已結算過或不存在，跳過處理`);
          continue;
        }
        
        // 如果贏了，直接增加會員餘額（不從代理扣除）
        if (isWin) {
          try {
            // 獲取當前餘額用於日誌記錄
            const currentBalance = await getBalance(username);
            
            // 用戶下注時已扣除本金，中獎時應返還總獎金
            const betAmount = parseFloat(bet.amount);
            const totalWinAmount = parseFloat(winAmount); // 這是總回報（含本金）
            const netProfit = totalWinAmount - betAmount; // 純獎金部分
            
            console.log(`🎯 結算詳情: 下注 ${betAmount} 元，總回報 ${totalWinAmount} 元，純獎金 ${netProfit} 元`);
            
            // 原子性增加會員餘額（增加總回報，因為下注時已扣除本金）
            const newBalance = await UserModel.addBalance(username, totalWinAmount);
            
            // 生成唯一的交易ID，用於防止重複處理
            const txId = `win_${bet.id}_${Date.now()}`;
            
            // 只同步餘額到代理系統（不扣代理點數）
            try {
              await fetch(`${AGENT_API_URL}/api/agent/sync-member-balance`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  username: username,
                  balance: newBalance,
                  transactionId: txId, // 添加唯一交易ID
                  reason: `第${period}期中獎 ${bet.bet_type}:${bet.bet_value} (下注${betAmount}元，總回報${totalWinAmount}元，純獎金${netProfit}元)`
                })
              });
            } catch (syncError) {
              console.warn('同步餘額到代理系統失敗，但會員餘額已更新:', syncError);
            }
            
            console.log(`用戶 ${username} 中獎結算: 下注${betAmount}元 → 總回報${totalWinAmount}元 → 純獎金${netProfit}元，餘額從 ${currentBalance} 更新為 ${newBalance}`);
          } catch (error) {
            console.error(`更新用戶 ${username} 中獎餘額失敗:`, error);
          }
        }
        
        // 在結算時分配退水給代理（不論輸贏，基於下注金額）
        try {
          // 生成唯一的退水交易ID
          const rebateTxId = `rebate_${bet.id}_${Date.now()}`;
          await distributeRebate(username, parseFloat(bet.amount), period, rebateTxId);
          console.log(`已為會員 ${username} 的注單 ${bet.id} 分配退水到代理 (交易ID: ${rebateTxId})`);
        } catch (rebateError) {
          console.error(`分配退水失敗 (注單ID=${bet.id}):`, rebateError);
        }
      } catch (error) {
        console.error(`結算用戶注單出錯 (ID=${bet.id}):`, error);
      }
    }
  } catch (batchError) {
    console.error(`批量結算注單時發生錯誤:`, batchError);
  }
  
  console.log(`第${period}期注單結算完成`);
}

// 修改退水分配函數，添加交易ID防止重複處理
async function distributeRebate(username, betAmount, period, transactionId = null) {
  try {
    console.log(`開始為會員 ${username} 分配退水，下注金額: ${betAmount}`);
    
    // 生成唯一交易ID，如果沒有提供
    const txId = transactionId || `rebate_${username}_${period}_${Date.now()}`;
    
    // 獲取會員的代理鏈來確定最大退水比例
    const agentChain = await getAgentChain(username);
    if (!agentChain || agentChain.length === 0) {
      console.log(`會員 ${username} 沒有代理鏈，退水歸平台所有`);
      return;
    }
    
    // 計算固定的總退水池（根據盤口類型）
    const directAgent = agentChain[0]; // 第一個是直屬代理
    const maxRebatePercentage = directAgent.market_type === 'A' ? 0.011 : 0.041; // A盤1.1%, D盤4.1%
    const totalRebatePool = parseFloat(betAmount) * maxRebatePercentage; // 固定總池
    
    console.log(`會員 ${username} 的代理鏈:`, agentChain.map(a => `${a.username}(L${a.level}-${a.rebate_mode}:${(a.rebate_percentage*100).toFixed(1)}%)`));
    console.log(`固定退水池: ${totalRebatePool.toFixed(2)} 元 (${(maxRebatePercentage*100).toFixed(1)}%)`);
    
    // 按層級順序分配退水，上級只拿差額
    let remainingRebate = totalRebatePool;
    let distributedPercentage = 0; // 已經分配的退水比例
    
    for (let i = 0; i < agentChain.length; i++) {
      const agent = agentChain[i];
      let agentRebateAmount = 0;
      
      // 如果沒有剩餘退水，結束分配
      if (remainingRebate <= 0.01) {
        console.log(`退水池已全部分配完畢`);
        break;
      }
      
      const rebatePercentage = parseFloat(agent.rebate_percentage);
      
      if (isNaN(rebatePercentage) || rebatePercentage <= 0) {
        // 退水比例為0，該代理不拿退水，全部給上級
        agentRebateAmount = 0;
        console.log(`代理 ${agent.username} 退水比例為 ${(rebatePercentage*100).toFixed(1)}%，不拿任何退水，剩餘 ${remainingRebate.toFixed(2)} 元繼續向上分配`);
      } else {
        // 計算該代理實際能拿的退水比例（不能超過已分配的）
        const actualRebatePercentage = Math.max(0, rebatePercentage - distributedPercentage);
        
        if (actualRebatePercentage <= 0) {
          console.log(`代理 ${agent.username} 退水比例 ${(rebatePercentage*100).toFixed(1)}% 已被下級分完，不能再獲得退水`);
          agentRebateAmount = 0;
        } else {
          // 計算該代理實際獲得的退水金額
          agentRebateAmount = parseFloat(betAmount) * actualRebatePercentage;
          // 確保不超過剩餘退水池
          agentRebateAmount = Math.min(agentRebateAmount, remainingRebate);
          // 四捨五入到小數點後2位
          agentRebateAmount = Math.round(agentRebateAmount * 100) / 100;
          remainingRebate -= agentRebateAmount;
          distributedPercentage += actualRebatePercentage;
          
          console.log(`代理 ${agent.username} 退水比例為 ${(rebatePercentage*100).toFixed(1)}%，實際獲得 ${(actualRebatePercentage*100).toFixed(1)}% = ${agentRebateAmount.toFixed(2)} 元，剩餘池額 ${remainingRebate.toFixed(2)} 元`);
        }
        
        // 如果該代理的比例達到或超過最大值，說明是全拿模式
        if (rebatePercentage >= maxRebatePercentage) {
          console.log(`代理 ${agent.username} 拿了全部退水池，結束分配`);
          remainingRebate = 0;
        }
      }
      
      if (agentRebateAmount > 0) {
        // 分配退水給代理，添加交易ID防止重複處理
        await allocateRebateToAgent(agent.id, agent.username, agentRebateAmount, username, betAmount, period, `${txId}_${agent.username}`);
        console.log(`✅ 分配退水 ${agentRebateAmount.toFixed(2)} 給代理 ${agent.username} (比例: ${(parseFloat(agent.rebate_percentage)*100).toFixed(1)}%, 剩餘: ${remainingRebate.toFixed(2)})`);
        
        // 如果沒有剩餘退水了，結束分配
        if (remainingRebate <= 0.01) {
          break;
        }
      }
    }
    
    // 剩餘退水歸平台所有
    if (remainingRebate > 0.01) { // 考慮浮點數精度問題
      console.log(`剩餘退水池 ${remainingRebate.toFixed(2)} 元歸平台所有`);
    }
    
    console.log(`✅ 退水分配完成，總池: ${totalRebatePool.toFixed(2)}元，已分配: ${(totalRebatePool - remainingRebate).toFixed(2)}元，平台保留: ${remainingRebate.toFixed(2)}元`);
    
  } catch (error) {
    console.error('分配退水時發生錯誤:', error);
  }
}

// 修改退水分配給代理的函數，添加交易ID
async function allocateRebateToAgent(agentId, agentUsername, amount, memberUsername, betAmount, period, transactionId = null) {
  try {
    // 生成唯一交易ID，如果沒有提供
    const txId = transactionId || `rebate_${agentUsername}_${memberUsername}_${period}_${Date.now()}`;
    
    // 調用代理系統API分配退水
    const response = await fetch(`${AGENT_API_URL}/api/agent/allocate-rebate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent_username: agentUsername,
        amount: amount,
        member_username: memberUsername,
        bet_amount: betAmount,
        period: period,
        transaction_id: txId // 添加交易ID防止重複處理
      })
    });
    
    if (!response.ok) {
      throw new Error(`分配退水API返回錯誤: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    if (!result.success) {
      throw new Error(`分配退水API操作失敗: ${result.message}`);
    }
    
    return result;
  } catch (error) {
    console.error(`給代理 ${agentUsername} 分配退水失敗:`, error);
    throw error;
  }
}
