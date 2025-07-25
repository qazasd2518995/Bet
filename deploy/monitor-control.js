// monitor-control.js - 退水监控系统控制面板
import { spawn } from 'child_process';
import readline from 'readline';

class MonitorController {
    constructor() {
        this.monitorProcess = null;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async start() {
        console.log('🎮 退水机制监控控制面板');
        console.log('=' .repeat(50));
        console.log('命令:');
        console.log('  start  - 启动监控系统');
        console.log('  stop   - 停止监控系统');
        console.log('  status - 查看监控状态');
        console.log('  exit   - 退出控制面板');
        console.log('=' .repeat(50));
        
        this.showPrompt();
    }

    showPrompt() {
        this.rl.question('\n🔧 请输入命令: ', (command) => {
            this.handleCommand(command.trim().toLowerCase());
        });
    }

    async handleCommand(command) {
        switch (command) {
            case 'start':
                await this.startMonitor();
                break;
            case 'stop':
                await this.stopMonitor();
                break;
            case 'status':
                this.showStatus();
                break;
            case 'exit':
            case 'quit':
                await this.exit();
                return;
            case 'help':
                this.showHelp();
                break;
            default:
                console.log('❌ 未知命令。输入 help 查看可用命令。');
                break;
        }
        
        this.showPrompt();
    }

    async startMonitor() {
        if (this.monitorProcess) {
            console.log('⚠️ 监控系统已在运行中');
            return;
        }

        console.log('🚀 启动退水机制监控系统...');
        
        this.monitorProcess = spawn('node', ['real-time-rebate-monitor.js'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.monitorProcess.stdout.on('data', (data) => {
            process.stdout.write(data);
        });

        this.monitorProcess.stderr.on('data', (data) => {
            process.stderr.write(data);
        });

        this.monitorProcess.on('close', (code) => {
            console.log(`\n📝 监控系统已退出 (代码: ${code})`);
            this.monitorProcess = null;
        });

        this.monitorProcess.on('error', (error) => {
            console.error(`❌ 启动监控系统失败: ${error.message}`);
            this.monitorProcess = null;
        });

        // 等待一下确保启动
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (this.monitorProcess && !this.monitorProcess.killed) {
            console.log('✅ 监控系统已启动');
        }
    }

    async stopMonitor() {
        if (!this.monitorProcess) {
            console.log('⚠️ 监控系统未运行');
            return;
        }

        console.log('🛑 停止监控系统...');
        
        // 发送 SIGINT 信号（相当于 Ctrl+C）
        this.monitorProcess.kill('SIGINT');
        
        // 等待进程退出
        await new Promise((resolve) => {
            if (this.monitorProcess) {
                this.monitorProcess.on('close', resolve);
                
                // 如果5秒后还没退出，强制终止
                setTimeout(() => {
                    if (this.monitorProcess && !this.monitorProcess.killed) {
                        console.log('🔨 强制终止监控系统...');
                        this.monitorProcess.kill('SIGKILL');
                    }
                    resolve();
                }, 5000);
            } else {
                resolve();
            }
        });

        this.monitorProcess = null;
        console.log('✅ 监控系统已停止');
    }

    showStatus() {
        if (this.monitorProcess && !this.monitorProcess.killed) {
            console.log('📊 监控系统状态: 🟢 运行中');
            console.log(`   PID: ${this.monitorProcess.pid}`);
            console.log(`   启动时间: ${this.getUptime()}`);
        } else {
            console.log('📊 监控系统状态: 🔴 未运行');
        }
    }

    showHelp() {
        console.log('\n📖 命令说明:');
        console.log('  start  - 启动实时退水监控系统');
        console.log('           * 自动检测新下注');
        console.log('           * 等待开奖并验证退水');
        console.log('           * 发现问题时自动报警');
        console.log('');
        console.log('  stop   - 优雅停止监控系统');
        console.log('  status - 显示监控系统运行状态');
        console.log('  exit   - 退出控制面板');
        console.log('');
        console.log('💡 使用技巧:');
        console.log('  - 启动监控后，去下注测试');
        console.log('  - 监控会即时显示每期的退水处理状态');
        console.log('  - 如果发现退水问题，会自动尝试修复');
    }

    getUptime() {
        if (!this.monitorProcess || !this.monitorProcess.spawnDate) {
            return '未知';
        }
        
        const uptime = Date.now() - this.monitorProcess.spawnDate;
        const seconds = Math.floor(uptime / 1000);
        const minutes = Math.floor(seconds / 60);
        
        if (minutes > 0) {
            return `${minutes}分${seconds % 60}秒`;
        } else {
            return `${seconds}秒`;
        }
    }

    async exit() {
        console.log('👋 正在退出...');
        
        if (this.monitorProcess) {
            await this.stopMonitor();
        }
        
        this.rl.close();
        console.log('✅ 已退出控制面板');
        process.exit(0);
    }
}

// 处理 Ctrl+C
process.on('SIGINT', async () => {
    console.log('\n\n收到退出信号...');
    process.exit(0);
});

// 启动控制面板
const controller = new MonitorController();
controller.start().catch(error => {
    console.error('❌ 启动控制面板失败:', error);
    process.exit(1);
});