-- 更新 ti2025A 和 ti2025D 的額度為 900 萬
UPDATE agents 
SET balance = 9000000 
WHERE username IN ('ti2025A', 'ti2025D');

-- 確認更新後的結果
SELECT username, balance 
FROM agents 
WHERE username IN ('ti2025A', 'ti2025D');
