-- 分析平台盈虧計算邏輯
-- 1. 查看近期所有已結算注單統計
SELECT 
  COUNT(*) as total_bets,
  SUM(amount) as total_bet_amount,
  SUM(CASE WHEN win = true THEN 1 ELSE 0 END) as win_count,
  SUM(CASE WHEN win = false THEN 1 ELSE 0 END) as lose_count,
  SUM(CASE WHEN win = true THEN win_amount ELSE 0 END) as total_win_amount,
  SUM(CASE WHEN win = true THEN (win_amount - amount) ELSE 0 END) as total_player_profit,
  SUM(CASE WHEN win = false THEN amount ELSE 0 END) as total_player_loss,
  -- 平台盈虧計算：玩家輸錢 - 玩家淨贏利
  SUM(CASE WHEN win = false THEN amount ELSE 0 END) - 
  SUM(CASE WHEN win = true THEN (win_amount - amount) ELSE 0 END) as platform_profit
FROM bet_history 
WHERE settled = true
ORDER BY period DESC;

-- 2. 查看最近500筆結算注單的詳細計算
SELECT 
  period,
  username,
  amount,
  win,
  win_amount,
  CASE 
    WHEN win = true THEN -(win_amount - amount)  -- 玩家贏錢，平台虧損
    ELSE amount  -- 玩家輸錢，平台獲利
  END as platform_profit_per_bet,
  created_at
FROM bet_history 
WHERE settled = true 
ORDER BY period DESC, id DESC
LIMIT 500;

-- 3. 按期數統計平台盈虧
SELECT 
  period,
  COUNT(*) as bet_count,
  SUM(amount) as total_bet,
  SUM(CASE WHEN win = true THEN 1 ELSE 0 END) as win_count,
  SUM(CASE WHEN win = true THEN win_amount ELSE 0 END) as total_payout,
  SUM(CASE WHEN win = false THEN amount ELSE 0 END) as platform_income,
  SUM(CASE WHEN win = true THEN (win_amount - amount) ELSE 0 END) as platform_loss,
  SUM(CASE WHEN win = false THEN amount ELSE 0 END) - 
  SUM(CASE WHEN win = true THEN (win_amount - amount) ELSE 0 END) as net_platform_profit
FROM bet_history 
WHERE settled = true 
GROUP BY period 
ORDER BY period DESC
LIMIT 50;

-- 4. 查看今日統計
SELECT 
  DATE(created_at) as bet_date,
  COUNT(*) as bet_count,
  SUM(amount) as total_bet,
  SUM(CASE WHEN win = true THEN win_amount ELSE 0 END) as total_payout,
  SUM(amount) - SUM(CASE WHEN win = true THEN win_amount ELSE 0 END) as platform_profit
FROM bet_history 
WHERE settled = true 
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY bet_date DESC; 