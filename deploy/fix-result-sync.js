// 修复主画面与历史记录结果不一致的问题

console.log(`
🔧 修复方案：

1. 在浏览器中打开游戏页面
2. 按 F12 开启开发者工具
3. 在 Console 中执行以下代码：

// === 复制以下代码到浏览器 Console ===

// 检查当前显示的资料
console.log('🔍 检查当前显示资料...');
console.log('当前期号:', app.currentPeriod);
console.log('主画面显示结果:', app.lastResults);
console.log('缓存的结果:', app.lastResult);

// 强制更新显示结果
console.log('\\n🔧 强制同步最新资料...');

// 从历史记录API获取正确资料
fetch('/api/history?limit=1')
  .then(res => res.json())
  .then(data => {
    if (data.success && data.records && data.records[0]) {
      const latestRecord = data.records[0];
      console.log('✅ 从API获取到最新结果:');
      console.log('期号:', latestRecord.period);
      console.log('结果:', latestRecord.result);
      
      // 检查是否是当前期
      if (latestRecord.period === app.currentPeriod) {
        console.log('\\n🔄 更新主画面显示...');
        app.lastResults = latestRecord.result;
        app.lastResult = latestRecord.result;
        app.$forceUpdate();
        console.log('✅ 更新完成！');
      } else {
        console.log('⚠️ API返回的期号与当前期号不符');
        console.log('当前期号:', app.currentPeriod);
        console.log('API期号:', latestRecord.period);
      }
    }
  });

// 监控资料变化
const originalUpdateGameData = app.updateGameData;
app.updateGameData = function() {
  console.log('📊 [监控] updateGameData 被调用');
  return originalUpdateGameData.call(this).then(result => {
    console.log('📊 [监控] 游戏资料更新完成');
    console.log('当前期号:', this.currentPeriod);
    console.log('显示结果:', this.lastResults);
    return result;
  });
};

console.log('✅ 监控已启动，请观察资料变化');

// === 复制以上代码 ===

4. 执行后查看 Console 输出，确认资料是否正确同步

5. 如果问题持续，执行以下额外诊断：

// 检查所有相关的资料来源
console.log('\\n📊 完整资料诊断:');
console.log('1. Vue 组件资料:');
console.log('   currentPeriod:', app.currentPeriod);
console.log('   lastResults:', app.lastResults);
console.log('   lastResult:', app.lastResult);
console.log('   gameStatus:', app.gameStatus);

console.log('\\n2. DOM 显示:');
const balls = document.querySelectorAll('.results-display-new .number-ball');
console.log('   显示的号码数量:', balls.length);
balls.forEach((ball, index) => {
  console.log(\`   第\${index + 1}个: \${ball.textContent}\`);
});

console.log('\\n3. 历史记录显示:');
const historyItems = document.querySelectorAll('.draw-history-item');
if (historyItems.length > 0) {
  const firstHistory = historyItems[0];
  console.log('   最新一期:', firstHistory.querySelector('.period')?.textContent);
  const historyBalls = firstHistory.querySelectorAll('.result-ball');
  const historyResults = Array.from(historyBalls).map(b => b.textContent);
  console.log('   历史结果:', historyResults);
}

`);

console.log(`
📌 可能的原因：

1. **时间差问题**：主画面可能显示的是正在开奖的当前期，而历史记录显示的是已完成的上一期
2. **缓存问题**：主画面可能使用了缓存的旧资料
3. **API不同步**：游戏状态API和历史记录API可能返回不同的资料
4. **期号错位**：前端可能错误地显示了不同期的结果

💡 永久解决方案：

修改 frontend/index.html 中的 updateGameData 方法，确保总是显示正确期号的结果。
`);