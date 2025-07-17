// 新增: 批量扣除會員餘額API（用於多筆下注）
// 這段代碼應該插入到 agentBackend.js 的第 6942 行之後
// 即在 deduct-member-balance API 結束後，登錄日誌API 開始前

app.post(`${API_PREFIX}/batch-deduct-member-balance`, async (req, res) => {
  const { username, bets } = req.body;
  
  console.log(`收到批量扣除會員餘額請求: 會員=${username}, 下注筆數=${bets?.length || 0}`);
  
  try {
    if (!username || !bets || !Array.isArray(bets) || bets.length === 0) {
      return res.json({
        success: false,
        message: '請提供會員用戶名和下注列表'
      });
    }
    
    // 驗證所有下注金額
    for (let i = 0; i < bets.length; i++) {
      const bet = bets[i];
      if (!bet.amount || parseFloat(bet.amount) <= 0) {
        return res.json({
          success: false,
          message: `第 ${i + 1} 筆下注金額無效`
        });
      }
    }
    
    // 生成每筆下注的唯一ID
    const betsWithIds = bets.map((bet, index) => ({
      amount: parseFloat(bet.amount),
      bet_id: bet.bet_id || `bet_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
    }));
    
    try {
      // 使用批量扣款函數
      const result = await db.one(`
        SELECT * FROM batch_bet_deduction($1, $2::jsonb)
      `, [username, JSON.stringify(betsWithIds)]);
      
      if (result.success) {
        console.log(`成功批量扣除會員 ${username} 餘額，總金額: ${result.total_deducted} 元，新餘額: ${result.balance}`);
        
        // 記錄交易歷史
        try {
          const member = await MemberModel.findByUsername(username);
          if (member) {
            await db.none(`
              INSERT INTO transaction_records 
              (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, ['member', member.id, -result.total_deducted, 'game_bet', 
                parseFloat(result.balance) + parseFloat(result.total_deducted), 
                parseFloat(result.balance), 
                `批量下注 ${bets.length} 筆`]);
          }
        } catch (logError) {
          console.error('記錄交易歷史失敗:', logError);
          // 不影響主要操作
        }
        
        res.json({
          success: true,
          message: '批量餘額扣除成功',
          balance: parseFloat(result.balance),
          totalDeducted: parseFloat(result.total_deducted),
          processedBets: betsWithIds,
          failedBets: result.failed_bets || []
        });
      } else {
        console.log(`批量扣除餘額失敗: ${result.message}`);
        res.json({
          success: false,
          message: result.message,
          balance: parseFloat(result.balance),
          failedBets: result.failed_bets || bets
        });
      }
    } catch (dbError) {
      console.error('執行批量扣款函數失敗:', dbError);
      
      // 如果函數不存在，降級到逐筆處理
      if (dbError.code === '42883') { // function does not exist
        console.log('批量扣款函數不存在，降級到逐筆處理');
        
        // 使用事務逐筆處理
        let totalDeducted = 0;
        let finalBalance = 0;
        const processedBets = [];
        const failedBets = [];
        
        try {
          await db.tx(async t => {
            // 先檢查總餘額是否足夠
            const member = await t.oneOrNone('SELECT * FROM members WHERE username = $1 FOR UPDATE', [username]);
            if (!member) {
              throw new Error('會員不存在');
            }
            
            const totalAmount = betsWithIds.reduce((sum, bet) => sum + bet.amount, 0);
            if (parseFloat(member.balance) < totalAmount) {
              throw new Error('余额不足');
            }
            
            // 執行批量扣款
            finalBalance = await t.one(`
              UPDATE members 
              SET balance = balance - $1 
              WHERE username = $2 
              RETURNING balance
            `, [totalAmount, username]).then(r => parseFloat(r.balance));
            
            totalDeducted = totalAmount;
            processedBets.push(...betsWithIds);
          });
          
          console.log(`降級處理成功: 總扣款 ${totalDeducted} 元，新餘額 ${finalBalance}`);
          
          res.json({
            success: true,
            message: '批量餘額扣除成功（降級處理）',
            balance: finalBalance,
            totalDeducted: totalDeducted,
            processedBets: processedBets,
            failedBets: failedBets
          });
        } catch (txError) {
          console.error('降級處理失敗:', txError);
          res.json({
            success: false,
            message: txError.message || '批量扣款失敗',
            failedBets: betsWithIds
          });
        }
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    console.error('批量扣除會員餘額出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
}); 