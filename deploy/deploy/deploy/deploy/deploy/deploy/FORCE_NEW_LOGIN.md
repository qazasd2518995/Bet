# 強制使用新登入頁面 - 解決方案

## 問題
Render 上的代理系統仍顯示舊的登入界面

## 可能原因
1. 瀏覽器強緩存
2. CDN 緩存
3. Service Worker 緩存
4. Render 部署尚未完成

## 解決步驟

### 1. 清除所有緩存
在瀏覽器中按 F12 打開開發者工具，然後：
- 右鍵點擊重新整理按鈕
- 選擇「清除快取並強制重新載入」

或在 Console 中執行：
```javascript
// 清除所有存儲
localStorage.clear();
sessionStorage.clear();
// 清除 Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
            registration.unregister();
        }
    });
}
// 強制重載
location.reload(true);
```

### 2. 使用無痕/隱私模式
- Chrome: Ctrl+Shift+N (Windows) 或 Cmd+Shift+N (Mac)
- Firefox: Ctrl+Shift+P (Windows) 或 Cmd+Shift+P (Mac)
- Safari: Cmd+Shift+N

### 3. 直接訪問新登入頁面
訪問：https://bet-agent.onrender.com/login.html

### 4. 檢查部署狀態
1. 登入 [Render Dashboard](https://dashboard.render.com)
2. 找到 `bet-agent` 服務
3. 檢查最新部署狀態是否為 "Live"
4. 查看 Logs 確認沒有錯誤

### 5. 手動觸發重新部署（如果需要）
在 Render Dashboard 中：
1. 選擇 `bet-agent` 服務
2. 點擊 "Manual Deploy"
3. 選擇 "Deploy latest commit"

## 驗證步驟
1. 訪問 https://bet-agent.onrender.com
2. 應該自動重定向到 F1 賽車主題登入頁面
3. 如果仍看到舊界面，直接訪問 https://bet-agent.onrender.com/login.html

## 臨時解決方案
如果上述方法都無效，可以暫時使用直接連結：
https://bet-agent.onrender.com/login.html

這將直接載入新的登入頁面，繞過任何緩存問題。