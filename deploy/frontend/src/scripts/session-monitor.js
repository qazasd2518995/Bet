// frontend/src/scripts/session-monitor.js - 會話監控腳本
class SessionMonitor {
    constructor() {
        this.checkInterval = 5 * 60 * 1000; // 5分鐘檢查一次
        this.warningDisplayed = false;
        this.intervalId = null;
        this.isChecking = false;
    }
    
    /**
     * 啟動會話監控
     */
    start() {
        console.log('🔍 會話監控已啟動');
        
        // 立即檢查一次
        this.checkSession();
        
        // 設置定期檢查
        this.intervalId = setInterval(() => {
            this.checkSession();
        }, this.checkInterval);
        
        // 監聽頁面可見性變化，當頁面重新可見時檢查會話
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('📖 頁面重新可見，檢查會話狀態');
                this.checkSession();
            }
        });
    }
    
    /**
     * 停止會話監控
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('⏹️ 會話監控已停止');
        }
    }
    
    /**
     * 檢查會話狀態
     */
    async checkSession() {
        if (this.isChecking) {
            return; // 避免重複檢查
        }
        
        this.isChecking = true;
        
        try {
            const isLoggedIn = sessionStorage.getItem('isLoggedIn');
            if (!isLoggedIn || isLoggedIn !== 'true') {
                // 用戶未登入，停止監控
                this.stop();
                return;
            }
            
            const sessionToken = sessionStorage.getItem('sessionToken');
            if (!sessionToken) {
                // 沒有會話token，使用舊版驗證
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
                // 會話有效，重置警告狀態
                this.warningDisplayed = false;
            }
            
        } catch (error) {
            console.error('會話檢查失敗:', error);
        } finally {
            this.isChecking = false;
        }
    }
    
    /**
     * 處理會話失效
     */
    async handleSessionInvalid(reason) {
        if (this.warningDisplayed) {
            return; // 避免重複顯示警告
        }
        
        this.warningDisplayed = true;
        
        let message = '您的登入會話已失效，請重新登入。';
        
        switch (reason) {
            case 'session_invalid':
                message = '檢測到您的帳號已在其他裝置登入，當前會話已失效。';
                break;
            case 'no_token':
                message = '登入憑證遺失，請重新登入。';
                break;
            case 'system_error':
                message = '系統驗證出現問題，請重新登入。';
                break;
        }
        
        console.warn('⚠️ 會話失效:', reason);
        
        // 顯示警告並跳轉
        const shouldRelogin = confirm(`${message}\n\n點擊確定立即重新登入，點擊取消繼續使用（可能會有功能限制）。`);
        
        if (shouldRelogin) {
            await this.logout();
        } else {
            // 用戶選擇繼續使用，暫停監控30秒後再次檢查
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
                console.error('通知伺服器登出失敗:', error);
            }
        }
        
        // 清理本地存儲
        sessionStorage.clear();
        
        // 停止監控
        this.stop();
        
        // 跳轉到登入頁面
        window.location.href = 'login.html';
    }
    
    /**
     * 獲取剩餘會話時間（估算）
     */
    getEstimatedSessionTime() {
        const sessionToken = sessionStorage.getItem('sessionToken');
        if (!sessionToken) {
            return null;
        }
        
        // 由於會話token是隨機生成的，無法直接獲取過期時間
        // 可以根據登入時間估算，預設會話時長為8小時
        const loginTime = sessionStorage.getItem('loginTime');
        if (loginTime) {
            const sessionDuration = 8 * 60 * 60 * 1000; // 8小時
            const elapsed = Date.now() - parseInt(loginTime);
            return Math.max(0, sessionDuration - elapsed);
        }
        
        return null;
    }
    
    /**
     * 顯示會話狀態
     */
    showSessionStatus() {
        const remainingTime = this.getEstimatedSessionTime();
        if (remainingTime !== null) {
            const hours = Math.floor(remainingTime / (60 * 60 * 1000));
            const minutes = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000));
            console.log(`⏰ 估計剩餘會話時間: ${hours}小時${minutes}分鐘`);
        }
    }
}

// 創建全局會話監控實例
window.sessionMonitor = new SessionMonitor();

// 當頁面加載完成後自動啟動會話監控
document.addEventListener('DOMContentLoaded', function() {
    // 檢查是否已登入
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
        // 記錄登入時間（如果還沒有記錄）
        if (!sessionStorage.getItem('loginTime')) {
            sessionStorage.setItem('loginTime', Date.now().toString());
        }
        
        // 啟動會話監控
        window.sessionMonitor.start();
    }
});

// 當登入成功時調用此函數
window.startSessionMonitoring = function() {
    sessionStorage.setItem('loginTime', Date.now().toString());
    window.sessionMonitor.start();
};

// 當登出時調用此函數
window.stopSessionMonitoring = function() {
    window.sessionMonitor.stop();
};

export default SessionMonitor; 