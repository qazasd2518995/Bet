// frontend/src/scripts/session-monitor.js - 会话监控腳本
class SessionMonitor {
    constructor() {
        this.checkInterval = 15 * 1000; // 15秒检查一次，更频繁
        this.warningDisplayed = false;
        this.intervalId = null;
        this.isChecking = false;
        this.lastSessionId = null; // 记录最后的会话ID
    }
    
    /**
     * 啟動会话监控
     */
    start() {
        console.log('🔍 会话监控已啟動');
        
        // 立即检查一次
        this.checkSession();
        
        // 设置定期检查
        this.intervalId = setInterval(() => {
            this.checkSession();
        }, this.checkInterval);
        
        // 監聽页面可见性變化，當页面重新可见时检查会话
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('📖 页面重新可见，检查会话状态');
                this.checkSession();
            }
        });
    }
    
    /**
     * 停止会话监控
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('⏹️ 会话监控已停止');
        }
    }
    
    /**
     * 检查会话状态
     */
    async checkSession() {
        if (this.isChecking) {
            return; // 避免重复检查
        }
        
        this.isChecking = true;
        
        try {
            const isLoggedIn = sessionStorage.getItem('isLoggedIn');
            if (!isLoggedIn || isLoggedIn !== 'true') {
                // 用戶未登入，停止监控
                this.stop();
                return;
            }
            
            const sessionToken = sessionStorage.getItem('sessionToken');
            if (!sessionToken) {
                // 沒有会话token，使用舊版验证
                return;
            }
            
            const response = await fetch('/api/member/check-session', {
                method: 'GET',
                headers: {
                    'X-Session-Token': sessionToken,
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (!result.isAuthenticated) {
                await this.handleSessionInvalid(result.reason);
            } else {
                // 会话有效，重置警告状态
                this.warningDisplayed = false;
                
                // 检查是否有新的登入（会话ID變化）
                if (result.sessionId && this.lastSessionId && result.sessionId !== this.lastSessionId) {
                    console.log('⚠️ 检测到新的登入，强制登出...');
                    await this.handleSessionInvalid('other_device_login');
                } else if (result.sessionId) {
                    this.lastSessionId = result.sessionId;
                }
            }
            
        } catch (error) {
            console.error('会话检查失败:', error);
        } finally {
            this.isChecking = false;
        }
    }
    
    /**
     * 处理会话失效
     */
    async handleSessionInvalid(reason) {
        if (this.warningDisplayed) {
            return; // 避免重复显示警告
        }
        
        this.warningDisplayed = true;
        
        let message = '您的登入会话已失效，请重新登入。';
        
        switch (reason) {
            case 'session_invalid':
                message = '检测到您的帳號已在其他装置登入，当前会话已失效。';
                break;
            case 'other_device_login':
                message = '您的帳號在其他装置登入，为了安全起见，当前会话已自動登出。';
                break;
            case 'no_token':
                message = '登入凭证遗失，请重新登入。';
                break;
            case 'system_error':
                message = '系统验证出現问题，请重新登入。';
                break;
        }
        
        console.warn('⚠️ 会话失效:', reason);
        
        // 显示警告並跳转
        const shouldRelogin = confirm(`${message}\n\n点擊确定立即重新登入，点擊取消繼續使用（可能会有功能限制）。`);
        
        if (shouldRelogin) {
            await this.logout();
        } else {
            // 用戶选择繼續使用，暂停监控30秒後再次检查
            setTimeout(() => {
                this.warningDisplayed = false;
            }, 30000);
        }
    }
    
    /**
     * 登出並清理
     */
    async logout() {
        const sessionToken = sessionStorage.getItem('sessionToken');
        
        // 通知伺服器登出
        if (sessionToken) {
            try {
                await fetch('/api/member/logout', {
                    method: 'POST',
                    headers: {
                        'X-Session-Token': sessionToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ sessionToken })
                });
                console.log('✅ 已通知伺服器登出');
            } catch (error) {
                console.error('通知伺服器登出失败:', error);
            }
        }
        
        // 清理本地存儲
        sessionStorage.clear();
        
        // 停止监控
        this.stop();
        
        // 跳转到登入页面
        window.location.href = 'login.html';
    }
    
    /**
     * 获取剩余会话时间（估算）
     */
    getEstimatedSessionTime() {
        const sessionToken = sessionStorage.getItem('sessionToken');
        if (!sessionToken) {
            return null;
        }
        
        // 由于会话token是随机生成的，無法直接获取过期时间
        // 可以根据登入时间估算，预設会话时长为8小时
        const loginTime = sessionStorage.getItem('loginTime');
        if (loginTime) {
            const sessionDuration = 8 * 60 * 60 * 1000; // 8小时
            const elapsed = Date.now() - parseInt(loginTime);
            return Math.max(0, sessionDuration - elapsed);
        }
        
        return null;
    }
    
    /**
     * 显示会话状态
     */
    showSessionStatus() {
        const remainingTime = this.getEstimatedSessionTime();
        if (remainingTime !== null) {
            const hours = Math.floor(remainingTime / (60 * 60 * 1000));
            const minutes = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000));
            console.log(`⏰ 估計剩余会话时间: ${hours}小时${minutes}分钟`);
        }
    }
}

// 创建全局会话监控實例
window.sessionMonitor = new SessionMonitor();

// 當页面加载完成後自動啟動会话监控
document.addEventListener('DOMContentLoaded', function() {
    // 检查是否已登入
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
        // 记录登入时间（如果还没有记录）
        if (!sessionStorage.getItem('loginTime')) {
            sessionStorage.setItem('loginTime', Date.now().toString());
        }
        
        // 啟動会话监控
        window.sessionMonitor.start();
    }
});

// 當登入成功时調用此函數
window.startSessionMonitoring = function() {
    sessionStorage.setItem('loginTime', Date.now().toString());
    window.sessionMonitor.start();
};

// 當登出时調用此函數
window.stopSessionMonitoring = function() {
    window.sessionMonitor.stop();
};

export default SessionMonitor; 