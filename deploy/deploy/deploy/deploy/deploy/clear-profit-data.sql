-- ⚠️  警告：以下指令將清除歷史數據，請謹慎使用！

-- 1. 備份當前數據（執行清除前建議先備份）
-- CREATE TABLE bet_history_backup AS SELECT * FROM bet_history WHERE settled = true;

-- 2. 清除所有已結算的下注記錄（保留未結算的）
-- DELETE FROM bet_history WHERE settled = true;

-- 3. 僅清除舊的已結算記錄（保留最近3天）
-- DELETE FROM bet_history 
-- WHERE settled = true 
--   AND created_at < CURRENT_DATE - INTERVAL '3 days';

-- 4. 僅重置結算狀態（不刪除記錄，但讓盈虧重新計算）
-- UPDATE bet_history SET settled = false, win = null, win_amount = null 
-- WHERE settled = true;

-- 5. 清除開獎結果歷史（會影響所有統計）
-- DELETE FROM result_history WHERE period < 當前期數;

-- 6. 查看數據清除後的狀態
SELECT 
  'bet_history' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN settled = true THEN 1 END) as settled_records,
  COUNT(CASE WHEN settled = false THEN 1 END) as unsettled_records
FROM bet_history
UNION ALL
SELECT 
  'result_history' as table_name,
  COUNT(*) as total_records,
  0 as settled_records,
  0 as unsettled_records
FROM result_history;

-- 建議的清除策略：
-- 選項A：保留最近7天數據，清除更早的記錄
-- DELETE FROM bet_history WHERE settled = true AND created_at < CURRENT_DATE - INTERVAL '7 days';
-- DELETE FROM result_history WHERE created_at < CURRENT_DATE - INTERVAL '7 days';

-- 選項B：完全重置（開發/測試環境使用）
-- TRUNCATE TABLE bet_history;
-- TRUNCATE TABLE result_history; 