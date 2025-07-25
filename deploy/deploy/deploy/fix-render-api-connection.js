// 修復 Render 部署的 API 連接問題

// 問題：前端在 bet-game-vcje.onrender.com，但 API_BASE_URL 為空
// 解決方案：更新 frontend/index.html 中的 API_BASE_URL 配置

// 在 deploy/frontend/index.html 中找到這行（約第 7308 行）：
/*
API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : '', // 在production环境中使用相同域名
*/

// 更改為：
/*
API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : window.location.origin, // 使用完整的 origin 而不是空字符串
*/

// 或者，如果前端和後端在相同域名，確保使用正確的路徑：
/*
API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : window.location.protocol + '//' + window.location.host,
*/

// 臨時解決方案（用於測試）：
// 在瀏覽器控制台執行：
/*
if (window.app) {
    window.app.API_BASE_URL = window.location.origin;
    console.log('API_BASE_URL 已更新為:', window.app.API_BASE_URL);
}
*/