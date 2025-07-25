-- 更新 ti2025A 和 ti2025D 的额度为 900 万
UPDATE agents 
SET balance = 9000000 
WHERE username IN ('ti2025A', 'ti2025D');

-- 确认更新后的结果
SELECT username, balance 
FROM agents 
WHERE username IN ('ti2025A', 'ti2025D');
