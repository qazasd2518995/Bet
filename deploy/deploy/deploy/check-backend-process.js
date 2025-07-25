import { spawn } from 'child_process';

console.log('=== 檢查後端進程狀態 ===\n');

// 檢查 node 進程
const ps = spawn('ps', ['aux']);
let output = '';

ps.stdout.on('data', (data) => {
  output += data.toString();
});

ps.on('close', (code) => {
  const lines = output.split('\n');
  const nodeProcesses = lines.filter(line => 
    line.includes('node') && 
    (line.includes('backend.js') || line.includes('agentBackend.js'))
  );
  
  if (nodeProcesses.length > 0) {
    console.log('找到運行中的後端進程:\n');
    nodeProcesses.forEach(process => {
      const parts = process.split(/\s+/);
      const pid = parts[1];
      const startTime = parts[8];
      const command = parts.slice(10).join(' ');
      
      console.log(`PID: ${pid}`);
      console.log(`啟動時間: ${startTime}`);
      console.log(`命令: ${command}`);
      console.log('---');
    });
    
    console.log('\n分析:');
    console.log('如果進程啟動時間早於 09:34 (1:34 AM)，則需要重啟以載入新的修復。');
    console.log('\n重啟方法:');
    console.log('1. 找到 PID 並終止進程: kill <PID>');
    console.log('2. 重新啟動: npm start 或 node backend.js');
  } else {
    console.log('沒有找到運行中的後端進程。');
    console.log('\n可能原因:');
    console.log('1. 後端不在本機運行（可能在 Render 上）');
    console.log('2. 使用了不同的進程名稱');
    console.log('3. 後端已經停止運行');
  }
  
  console.log('\n建議:');
  console.log('1. 如果後端在 Render 上運行，需要重新部署或重啟服務');
  console.log('2. 檢查 Render 控制台的部署時間');
  console.log('3. 或者聯繫系統管理員確認後端狀態');
});