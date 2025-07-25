-- ⚠️  警告：以下指令将清除历史数据，请谨慎使用！

-- 1. 备份当前数据（执行清除前建议先备份）
-- CREATE TABLE bet_history_backup AS SELECT * FROM bet_history WHERE settled = true;

-- 2. 清除所有已结算的下注记录（保留未结算的）
-- DELETE FROM bet_history WHERE settled = true;

-- 3. 仅清除旧的已结算记录（保留最近3天）
-- DELETE FROM bet_history 
-- WHERE settled = true 
--   AND created_at < CURRENT_DATE - INTERVAL '3 days';

-- 4. 仅重置结算状态（不删除记录，但让盈亏重新计算）
-- UPDATE bet_history SET settled = false, win = null, win_amount = null 
-- WHERE settled = true;

-- 5. 清除开奖结果历史（会影响所有统计）
-- DELETE FROM result_history WHERE period < 当前期数;

-- 6. 查看数据清除后的状态
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

-- 建议的清除策略：
-- 选项A：保留最近7天数据，清除更早的记录
-- DELETE FROM bet_history WHERE settled = true AND created_at < CURRENT_DATE - INTERVAL '7 days';
-- DELETE FROM result_history WHERE created_at < CURRENT_DATE - INTERVAL '7 days';

-- 选项B：完全重置（开发/测试环境使用）
-- TRUNCATE TABLE bet_history;
-- TRUNCATE TABLE result_history; 