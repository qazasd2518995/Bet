import { spawn } from 'child_process';

console.log('=== 检查后端进程状态 ===\n');

// 检查 node 进程
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
    console.log('找到运行中的后端进程:\n');
    nodeProcesses.forEach(process => {
      const parts = process.split(/\s+/);
      const pid = parts[1];
      const startTime = parts[8];
      const command = parts.slice(10).join(' ');
      
      console.log(`PID: ${pid}`);
      console.log(`启动时间: ${startTime}`);
      console.log(`命令: ${command}`);
      console.log('---');
    });
    
    console.log('\n分析:');
    console.log('如果进程启动时间早于 09:34 (1:34 AM)，则需要重启以载入新的修复。');
    console.log('\n重启方法:');
    console.log('1. 找到 PID 并终止进程: kill <PID>');
    console.log('2. 重新启动: npm start 或 node backend.js');
  } else {
    console.log('没有找到运行中的后端进程。');
    console.log('\n可能原因:');
    console.log('1. 后端不在本机运行（可能在 Render 上）');
    console.log('2. 使用了不同的进程名称');
    console.log('3. 后端已经停止运行');
  }
  
  console.log('\n建议:');
  console.log('1. 如果后端在 Render 上运行，需要重新部署或重启服务');
  console.log('2. 检查 Render 控制台的部署时间');
  console.log('3. 或者联系系统管理员确认后端状态');
});