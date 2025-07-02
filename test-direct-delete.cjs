const http = require('http');

// 測試數據
const deleteData = JSON.stringify({});

// 請求選項
const options = {
  hostname: 'localhost',
  port: 3003,
  path: '/api/agent/win-loss-control/39',  // 使用調試中看到的實際ID
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': deleteData.length,
    // 嘗試添加一個測試token
    'Authorization': 'Bearer test_token'
  }
};

console.log('🔍 測試直接刪除API...');
console.log('請求路径:', options.path);

const req = http.request(options, (res) => {
  console.log('📡 響應狀態碼:', res.statusCode);
  console.log('📋 響應頭:', res.headers);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('📄 響應內容:', responseData);
    
    try {
      const jsonResponse = JSON.parse(responseData);
      console.log('🔍 解析後的響應:', JSON.stringify(jsonResponse, null, 2));
    } catch (e) {
      console.log('⚠️  響應不是有效的JSON');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 請求錯誤:', error);
});

// 發送請求
req.write(deleteData);
req.end();

console.log('✅ 請求已發送，等待響應...'); 