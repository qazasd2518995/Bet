// 修復主畫面與歷史記錄結果不一致的問題

console.log(`
🔧 修復方案：

1. 在瀏覽器中打開遊戲頁面
2. 按 F12 開啟開發者工具
3. 在 Console 中執行以下代碼：

// === 複製以下代碼到瀏覽器 Console ===

// 檢查當前顯示的資料
console.log('🔍 檢查當前顯示資料...');
console.log('當前期號:', app.currentPeriod);
console.log('主畫面顯示結果:', app.lastResults);
console.log('緩存的結果:', app.lastResult);

// 強制更新顯示結果
console.log('\\n🔧 強制同步最新資料...');

// 從歷史記錄API獲取正確資料
fetch('/api/history?limit=1')
  .then(res => res.json())
  .then(data => {
    if (data.success && data.records && data.records[0]) {
      const latestRecord = data.records[0];
      console.log('✅ 從API獲取到最新結果:');
      console.log('期號:', latestRecord.period);
      console.log('結果:', latestRecord.result);
      
      // 檢查是否是當前期
      if (latestRecord.period === app.currentPeriod) {
        console.log('\\n🔄 更新主畫面顯示...');
        app.lastResults = latestRecord.result;
        app.lastResult = latestRecord.result;
        app.$forceUpdate();
        console.log('✅ 更新完成！');
      } else {
        console.log('⚠️ API返回的期號與當前期號不符');
        console.log('當前期號:', app.currentPeriod);
        console.log('API期號:', latestRecord.period);
      }
    }
  });

// 監控資料變化
const originalUpdateGameData = app.updateGameData;
app.updateGameData = function() {
  console.log('📊 [監控] updateGameData 被調用');
  return originalUpdateGameData.call(this).then(result => {
    console.log('📊 [監控] 遊戲資料更新完成');
    console.log('當前期號:', this.currentPeriod);
    console.log('顯示結果:', this.lastResults);
    return result;
  });
};

console.log('✅ 監控已啟動，請觀察資料變化');

// === 複製以上代碼 ===

4. 執行後查看 Console 輸出，確認資料是否正確同步

5. 如果問題持續，執行以下額外診斷：

// 檢查所有相關的資料來源
console.log('\\n📊 完整資料診斷:');
console.log('1. Vue 組件資料:');
console.log('   currentPeriod:', app.currentPeriod);
console.log('   lastResults:', app.lastResults);
console.log('   lastResult:', app.lastResult);
console.log('   gameStatus:', app.gameStatus);

console.log('\\n2. DOM 顯示:');
const balls = document.querySelectorAll('.results-display-new .number-ball');
console.log('   顯示的號碼數量:', balls.length);
balls.forEach((ball, index) => {
  console.log(\`   第\${index + 1}個: \${ball.textContent}\`);
});

console.log('\\n3. 歷史記錄顯示:');
const historyItems = document.querySelectorAll('.draw-history-item');
if (historyItems.length > 0) {
  const firstHistory = historyItems[0];
  console.log('   最新一期:', firstHistory.querySelector('.period')?.textContent);
  const historyBalls = firstHistory.querySelectorAll('.result-ball');
  const historyResults = Array.from(historyBalls).map(b => b.textContent);
  console.log('   歷史結果:', historyResults);
}

`);

console.log(`
📌 可能的原因：

1. **時間差問題**：主畫面可能顯示的是正在開獎的當前期，而歷史記錄顯示的是已完成的上一期
2. **緩存問題**：主畫面可能使用了緩存的舊資料
3. **API不同步**：遊戲狀態API和歷史記錄API可能返回不同的資料
4. **期號錯位**：前端可能錯誤地顯示了不同期的結果

💡 永久解決方案：

修改 frontend/index.html 中的 updateGameData 方法，確保總是顯示正確期號的結果。
`);