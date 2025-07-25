// 修复 Render 部署的 API 连接问题

// 问题：前端在 bet-game-vcje.onrender.com，但 API_BASE_URL 为空
// 解决方案：更新 frontend/index.html 中的 API_BASE_URL 配置

// 在 deploy/frontend/index.html 中找到这行（约第 7308 行）：
/*
API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : '', // 在production环境中使用相同域名
*/

// 更改为：
/*
API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : window.location.origin, // 使用完整的 origin 而不是空字符串
*/

// 或者，如果前端和后端在相同域名，确保使用正确的路径：
/*
API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : window.location.protocol + '//' + window.location.host,
*/

// 临时解决方案（用于测试）：
// 在浏览器控制台执行：
/*
if (window.app) {
    window.app.API_BASE_URL = window.location.origin;
    console.log('API_BASE_URL 已更新为:', window.app.API_BASE_URL);
}
*/