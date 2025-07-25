// monitor-control.js - 退水監控系統控制面板
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
        console.log('🎮 退水機制監控控制面板');
        console.log('=' .repeat(50));
        console.log('命令:');
        console.log('  start  - 啟動監控系統');
        console.log('  stop   - 停止監控系統');
        console.log('  status - 查看監控狀態');
        console.log('  exit   - 退出控制面板');
        console.log('=' .repeat(50));
        
        this.showPrompt();
    }

    showPrompt() {
        this.rl.question('\n🔧 請輸入命令: ', (command) => {
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
                console.log('❌ 未知命令。輸入 help 查看可用命令。');
                break;
        }
        
        this.showPrompt();
    }

    async startMonitor() {
        if (this.monitorProcess) {
            console.log('⚠️ 監控系統已在運行中');
            return;
        }

        console.log('🚀 啟動退水機制監控系統...');
        
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
            console.log(`\n📝 監控系統已退出 (代碼: ${code})`);
            this.monitorProcess = null;
        });

        this.monitorProcess.on('error', (error) => {
            console.error(`❌ 啟動監控系統失敗: ${error.message}`);
            this.monitorProcess = null;
        });

        // 等待一下確保啟動
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (this.monitorProcess && !this.monitorProcess.killed) {
            console.log('✅ 監控系統已啟動');
        }
    }

    async stopMonitor() {
        if (!this.monitorProcess) {
            console.log('⚠️ 監控系統未運行');
            return;
        }

        console.log('🛑 停止監控系統...');
        
        // 發送 SIGINT 信號（相當於 Ctrl+C）
        this.monitorProcess.kill('SIGINT');
        
        // 等待進程退出
        await new Promise((resolve) => {
            if (this.monitorProcess) {
                this.monitorProcess.on('close', resolve);
                
                // 如果5秒後還沒退出，強制終止
                setTimeout(() => {
                    if (this.monitorProcess && !this.monitorProcess.killed) {
                        console.log('🔨 強制終止監控系統...');
                        this.monitorProcess.kill('SIGKILL');
                    }
                    resolve();
                }, 5000);
            } else {
                resolve();
            }
        });

        this.monitorProcess = null;
        console.log('✅ 監控系統已停止');
    }

    showStatus() {
        if (this.monitorProcess && !this.monitorProcess.killed) {
            console.log('📊 監控系統狀態: 🟢 運行中');
            console.log(`   PID: ${this.monitorProcess.pid}`);
            console.log(`   啟動時間: ${this.getUptime()}`);
        } else {
            console.log('📊 監控系統狀態: 🔴 未運行');
        }
    }

    showHelp() {
        console.log('\n📖 命令說明:');
        console.log('  start  - 啟動實時退水監控系統');
        console.log('           * 自動檢測新下注');
        console.log('           * 等待開獎並驗證退水');
        console.log('           * 發現問題時自動報警');
        console.log('');
        console.log('  stop   - 優雅停止監控系統');
        console.log('  status - 顯示監控系統運行狀態');
        console.log('  exit   - 退出控制面板');
        console.log('');
        console.log('💡 使用技巧:');
        console.log('  - 啟動監控後，去下注測試');
        console.log('  - 監控會即時顯示每期的退水處理狀態');
        console.log('  - 如果發現退水問題，會自動嘗試修復');
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

// 處理 Ctrl+C
process.on('SIGINT', async () => {
    console.log('\n\n收到退出信號...');
    process.exit(0);
});

// 啟動控制面板
const controller = new MonitorController();
controller.start().catch(error => {
    console.error('❌ 啟動控制面板失敗:', error);
    process.exit(1);
});