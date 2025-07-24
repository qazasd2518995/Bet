// 修復期號與結果顯示不同步的問題

console.log(`
🔧 臨時修復方案（在瀏覽器Console執行）：

// === 複製以下代碼 ===

// 診斷當前狀態
console.log('🔍 診斷當前狀態...');
console.log('當前期號:', app.currentPeriod);
console.log('主畫面顯示結果:', app.lastResults);
console.log('應該顯示的期號:', parseInt(app.currentPeriod) - 1);

// 從歷史記錄獲取正確的上一期結果
fetch('/api/history?limit=20')
  .then(res => res.json())
  .then(data => {
    if (data.success && data.records) {
      const targetPeriod = (parseInt(app.currentPeriod) - 1).toString();
      const correctRecord = data.records.find(r => r.period === targetPeriod);
      
      if (correctRecord) {
        console.log('✅ 找到正確的上一期結果:');
        console.log('期號:', correctRecord.period);
        console.log('結果:', correctRecord.result);
        
        // 更新顯示
        app.lastResults = correctRecord.result;
        app.lastResult = correctRecord.result;
        app.$forceUpdate();
        
        console.log('✅ 主畫面已更新為正確結果！');
      } else {
        console.log('❌ 未找到期號', targetPeriod, '的結果');
      }
    }
  });

// === 複製以上代碼 ===

🔧 永久修復方案：

需要修改 frontend/index.html 中的 updateGameData 方法，確保：
1. lastResults 總是顯示 currentPeriod - 1 的結果
2. 在期號變更時，從歷史記錄中獲取正確的上一期結果
3. 避免顯示過舊的緩存結果

📌 問題根源：
系統設計是顯示「上一期」的開獎結果，但由於同步延遲或緩存問題，
導致顯示的是更早期的結果（如562期而不是563期）。
`);