// Vue 應用實例
document.addEventListener('DOMContentLoaded', function() {
    new Vue({
        el: '#app',
        data() {
            return {
                API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                    ? 'http://localhost:3002' 
                    : '', // 在production環境中使用相同域名
                // 用戶相關
                isLoggedIn: false,
                username: '',
                balance: 0,
                balanceChanged: false,
                
                // 遊戲狀態
                gameStatus: 'betting', // betting or drawing
                currentPeriod: '',
                nextPeriod: '',
                countdownSeconds: 0,
                
                // 開獎結果
                lastResult: [],
                lastResults: [],
                
                // 投注相關
                defaultBetAmount: 1, // 默認投注金額
                betAmount: 1,
                selectedBets: [],
                activeTab: 'combined', // 當前活躍的標籤頁
                
                // 位置選擇相關
                selectedPosition: null,
                selectedPositions: [], // 多選位置
                positions: [
                    { value: 1, label: '第一名' },
                    { value: 2, label: '第二名' },
                    { value: 3, label: '第三名' },
                    { value: 4, label: '第四名' },
                    { value: 5, label: '第五名' },
                    { value: 6, label: '第六名' },
                    { value: 7, label: '第七名' },
                    { value: 8, label: '第八名' },
                    { value: 9, label: '第九名' },
                    { value: 10, label: '第十名' }
                ],
                
                // 顯示狀態
                showHistory: false,
                showRecords: false,
                showProfitModal: false,
                showDayDetailModal: false,
                showDropdownMenu: false, // 控制下拉菜單顯示狀態
                
                // 熱門投注
                hotBets: [],
                
                // 投注記錄
                betRecords: [],
                betRecordsPagination: {
                    page: 1,
                    pageSize: 20,
                    total: 0
                },
                
                // 歷史開獎記錄
                historyRecords: [],
                historyPagination: {
                    page: 1,
                    pageSize: 20,
                    total: 0
                },
                
                // 統計數據
                dailyBetCount: 0,
                dailyProfit: 0,
                
                // 盈虧記錄相關
                profitTimeRange: '7days',
                profitRecords: [],
                totalBetCount: 0,
                totalProfit: 0,
                selectedDate: '',
                dayDetailRecords: [],
                dayDetailStats: {
                    betCount: 0,
                    profit: 0
                },
                
                // 通知系統
                notificationText: '',
                notificationVisible: false,
                
                // 自訂金額
                customAmount: '',
                
                // 賠率數據 - 包含退水0.41，與後端一致
                odds: {
                    sumValue: {
                        '3': 40.59, '4': 20.59, '5': 15.59, '6': 12.59, '7': 10.59,
                        '8': 8.59, '9': 7.59, '10': 6.59, '11': 6.59, '12': 7.59,
                        '13': 8.59, '14': 10.59, '15': 12.59, '16': 15.59, '17': 20.59,
                        '18': 40.59, '19': 80.59,
                        big: 1.55, small: 1.55, odd: 1.55, even: 1.55
                    },
                    champion: { big: 1.55, small: 1.55, odd: 1.55, even: 1.55 },
                    runnerup: { big: 1.55, small: 1.55, odd: 1.55, even: 1.55 },
                    third: { big: 1.55, small: 1.55, odd: 1.55, even: 1.55 },
                    fourth: { big: 1.55, small: 1.55, odd: 1.55, even: 1.55 },
                    fifth: { big: 1.55, small: 1.55, odd: 1.55, even: 1.55 },
                    sixth: { big: 1.55, small: 1.55, odd: 1.55, even: 1.55 },
                    seventh: { big: 1.55, small: 1.55, odd: 1.55, even: 1.55 },
                    eighth: { big: 1.55, small: 1.55, odd: 1.55, even: 1.55 },
                    ninth: { big: 1.55, small: 1.55, odd: 1.55, even: 1.55 },
                    tenth: { big: 1.55, small: 1.55, odd: 1.55, even: 1.55 },
                    dragonTiger: { 
                        dragon: 1.55, 
                        tiger: 1.55 
                    },
                    number: {
                        first: 9.59,  // 10.0 - 0.41 = 9.59
                        second: 9.59,
                        third: 9.59,
                        fourth: 9.59,
                        fifth: 9.59,
                        sixth: 9.59,
                        seventh: 9.59,
                        eighth: 9.59,
                        ninth: 9.59,
                        tenth: 9.59
                    }
                },
                longestStreak: { count: 0, name: '' },
                showLoginModal: false,
                showRegisterModal: false,
                loginForm: {
                    username: '',
                    password: ''
                },
                registerForm: {
                    username: '',
                    password: '',
                    confirmPassword: ''
                },
                
                // 開獎結果標籤
                resultLabels: Array.from({ length: 10 }, (_, i) => `${i + 1}名`),
                
                // 新的下注確認相關
                showBetModal: false,
                autoAcceptBetterOdds: true,
                hasLastBets: false,
                lastBets: [],
                showChips: false,
            };
        },
        created() {
            // 初始化 sessionStorage
            if (typeof window.sessionStorage === 'undefined') {
                window.sessionStorage = {
                    getItem: function(key) { return null; },
                    setItem: function(key, value) {},
                    removeItem: function(key) {}
                };
            }
            // 初始化歷史開獎記錄為空數組，防止undefined錯誤
            this.recentResults = [];
            this.checkLoginStatus();
        },
        computed: {
            countdownDisplay() {
                const minutes = Math.floor(this.countdownSeconds / 60);
                const seconds = this.countdownSeconds % 60;
                return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            },
            isMobile() {
                return /Mobi|Android/i.test(navigator.userAgent);
            }
        },
        methods: {
            // 初始化倒計時功能
            initCountdown() {
                // 每秒更新倒計時
                this.countdownTimer = setInterval(() => {
                    if (this.countdownSeconds > 0) {
                        this.countdownSeconds--;
                        this.updateCountdownDisplay();
                    }
                }, 1000);
            },
            
            // 更新倒計時顯示
            updateCountdownDisplay() {
                // 實時更新倒計時顯示
            },
            
            // 檢查登入狀態
            checkLoginStatus() {
                console.log('🔍 Vue檢查登入狀態 - isLoggedIn:', sessionStorage.getItem('isLoggedIn'), 'username:', sessionStorage.getItem('username'), 'balance:', sessionStorage.getItem('balance'));
                console.log('🧹 登入檢查時執行遮罩清理...');
                
                // 緊急清理任何遮罩
                const overlaySelectors = [
                    '#login-overlay',
                    '.login-overlay',
                    '.overlay',
                    '.modal-overlay',
                    '.loading-overlay'
                ];
                
                overlaySelectors.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => {
                        if (el) {
                            el.style.display = 'none';
                            el.remove();
                        }
                    });
                });
                
                // 確保#app容器顯示
                const appContainer = document.querySelector('#app');
                if (appContainer) {
                    console.log('✅ 確保#app容器顯示');
                    appContainer.style.display = 'block';
                    appContainer.style.visibility = 'visible';
                    appContainer.style.opacity = '1';
                }
                
                const isLoggedIn = sessionStorage.getItem('isLoggedIn');
                const username = sessionStorage.getItem('username');
                const balance = sessionStorage.getItem('balance');
                
                if (isLoggedIn === 'true' && username && balance !== null) {
                    console.log('✅ 登入狀態有效，設置用戶資訊');
                    this.isLoggedIn = true;
                    this.username = username;
                    this.balance = parseFloat(balance) || 0;
                } else {
                    console.log('❌ 登入狀態無效，顯示登入表單');
                    this.isLoggedIn = false;
                    this.username = '';
                    this.balance = 0;
                }
            },
            
            // 更新遊戲數據
            updateGameData() {
                console.log('開始獲取遊戲數據...');
                
                // 獲取遊戲狀態
                fetch(`${this.API_BASE_URL}/api/game/status`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            this.gameStatus = data.gameStatus;
                            this.currentPeriod = data.currentPeriod;
                            this.nextPeriod = data.nextPeriod;
                            this.countdownSeconds = data.timeRemaining;
                            
                            if (data.lastResult && data.lastResult.length > 0) {
                                this.lastResults = data.lastResult;
                            }
                        }
                    })
                    .catch(error => {
                        console.error('獲取遊戲狀態失敗:', error);
                    });
                
                // 更新歷史開獎記錄
                this.updateHistoryRecords();
            },
            
            // 更新歷史記錄
            updateHistoryRecords() {
                fetch(`${this.API_BASE_URL}/api/game/history?limit=20`)
                    .then(response => response.json())
                    .then(data => {
                        console.log('開獎歷史API返回數據:', JSON.stringify(data).substring(0, 200) + '...');
                        if (data.success && data.records) {
                            this.historyRecords = data.records;
                            console.log('開獎歷史更新成功，記錄數量:', this.historyRecords.length);
                        }
                    })
                    .catch(error => {
                        console.error('獲取歷史記錄失敗:', error);
                    });
            },
            
            // 更新餘額
            updateBalance() {
                if (!this.isLoggedIn) return;
                
                fetch(`${this.API_BASE_URL}/api/user/balance`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        const oldBalance = this.balance;
                        this.balance = data.balance;
                        sessionStorage.setItem('balance', data.balance);
                        
                        // 如果餘額有變化，觸發動畫
                        if (oldBalance !== this.balance) {
                            this.balanceChanged = true;
                            setTimeout(() => {
                                this.balanceChanged = false;
                            }, 2000);
                        }
                    }
                })
                .catch(error => {
                    console.error('更新餘額失敗:', error);
                });
            },
            
            // 更新每日統計
            updateDailyStats() {
                if (!this.isLoggedIn) return;
                
                fetch(`${this.API_BASE_URL}/api/user/daily-stats`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            this.dailyBetCount = data.betCount || 0;
                            this.dailyProfit = data.profit || 0;
                        }
                    })
                    .catch(error => {
                        console.error('獲取每日統計失敗:', error);
                    });
            },
            
            // 更新投注歷史
            updateBetHistory() {
                if (!this.isLoggedIn) return;
                
                fetch(`${this.API_BASE_URL}/api/user/bet-history`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            this.betRecords = data.records || [];
                        }
                    })
                    .catch(error => {
                        console.error('獲取投注歷史失敗:', error);
                    });
            },
            
            // 獲取熱門投注
            fetchHotBets() {
                fetch(`${this.API_BASE_URL}/api/game/hot-bets`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success && data.hotBets) {
                            this.hotBets = data.hotBets;
                            console.log('熱門投注數據獲取成功，共有', this.hotBets.length, '個熱門投注');
                        }
                    })
                    .catch(error => {
                        console.error('獲取熱門投注失敗:', error);
                    });
            },
            
            // 選擇熱門投注
            selectHotBet(bet) {
                // 實現選擇熱門投注的邏輯
                console.log('選擇熱門投注:', bet);
                this.showDropdownMenu = false;
            },
            
            // 切換下拉菜單
            toggleDropdown() {
                this.showDropdownMenu = !this.showDropdownMenu;
            },
            
            // 顯示歷史開獎
            showDrawHistory() {
                this.showHistory = true;
                this.showDropdownMenu = false;
            },
            
            // 顯示投注記錄
            showBetRecords() {
                this.showRecords = true;
                this.showDropdownMenu = false;
            },
            
            // 顯示盈虧記錄
            showProfitRecords() {
                this.showProfitModal = true;
                this.showDropdownMenu = false;
            },
            
            // 顯示遊戲規則
            showGameRules() {
                // 實現顯示遊戲規則的邏輯
                this.showDropdownMenu = false;
            },
            
            // 登出
            logout() {
                sessionStorage.clear();
                this.isLoggedIn = false;
                this.username = '';
                this.balance = 0;
                this.showDropdownMenu = false;
                window.location.href = 'login.html';
            },
            
            // 登入
            login() {
                fetch(`${this.API_BASE_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: this.loginForm.username,
                        password: this.loginForm.password
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        sessionStorage.setItem('isLoggedIn', 'true');
                        sessionStorage.setItem('username', data.user.username);
                        sessionStorage.setItem('balance', data.user.balance);
                        this.username = data.user.username;
                        this.balance = data.user.balance;
                        this.checkLoginStatus();
                        this.showNotification('登入成功！');
                    } else {
                        this.showNotification('登入失敗，請檢查用戶名和密碼。');
                    }
                })
                .catch(error => {
                    console.error('登入失敗:', error);
                    this.showNotification('登入失敗，請稍後再試。');
                });
            },
            
            // 顯示通知
            showNotification(message) {
                this.notificationText = message;
                this.notificationVisible = true;
                setTimeout(() => {
                    this.notificationVisible = false;
                }, 3000);
            },
            
            // 格式化時間
            formatTime(seconds) {
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = seconds % 60;
                return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
            },
            
            // 格式化金額
            formatMoney(amount) {
                return `¥${parseFloat(amount || 0).toFixed(2)}`;
            },
            
            // 格式化賠率
            formatOdds(odds) {
                return parseFloat(odds || 0).toFixed(2);
            },
            
            // 格式化盈虧
            formatProfit(profit) {
                const amount = parseFloat(profit || 0);
                return amount >= 0 ? `+¥${amount.toFixed(2)}` : `-¥${Math.abs(amount).toFixed(2)}`;
            },
            
            // 檢查是否已選擇
            isSelected(betType, value) {
                return this.selectedBets.some(bet => 
                    bet.betType === betType && bet.value === value
                );
            },
            
            // 選擇投注
            selectBet(betType, value) {
                const existingIndex = this.selectedBets.findIndex(bet => 
                    bet.betType === betType && bet.value === value
                );
                
                if (existingIndex !== -1) {
                    // 如果已選擇，則取消選擇
                    this.selectedBets.splice(existingIndex, 1);
                } else {
                    // 添加新的選擇
                    this.selectedBets.push({
                        betType: betType,
                        value: value,
                        odds: this.getOddsForBet(betType, value),
                        amount: this.betAmount
                    });
                }
            },
            
            // 獲取投注賠率
            getOddsForBet(betType, value) {
                if (this.odds[betType] && this.odds[betType][value]) {
                    return this.odds[betType][value];
                }
                return 1.96; // 默認賠率
            },
            
            // 點擊外部關閉
            handleClickOutside(event) {
                const menuContainer = this.$refs.menuContainer;
                if (menuContainer && !menuContainer.contains(event.target)) {
                    this.showDropdownMenu = false;
                }
                
                // 檢查是否點擊在籌碼選單外部
                const chipsDropdown = document.querySelector('.chips-dropdown');
                if (chipsDropdown && !chipsDropdown.contains(event.target)) {
                    this.showChips = false;
                }
            }
        },
        mounted() {
            this.initCountdown();
            this.updateGameData();
            this.fetchHotBets();  // 加載熱門投注數據
            
            // 每隔10秒刷新一次遊戲數據
            setInterval(() => {
                this.updateGameData();
            }, 10000);
            
            // 每隔30秒刷新一次餘額
            setInterval(() => {
                if (this.isLoggedIn) {
                    this.updateBalance();
                }
            }, 30000);
            
            // 每隔60秒刷新一次注單歷史
            setInterval(() => {
                if (this.isLoggedIn) {
                    this.updateBetHistory();
                }
            }, 60000);
            
            // 每隔5分鐘刷新一次熱門投注數據
            setInterval(() => {
                this.fetchHotBets();
            }, 5 * 60 * 1000);
            
            // 初始檢查登入狀態
            this.checkLoginStatus();
            
            // 更新初始資料
            this.updateDailyStats();
            this.updateHistoryRecords();
            
            // 強制清理任何剩餘的遮罩
            console.log('🚀 執行強制遮罩清理...');
            let cleanupCount = 0;
            const maxCleanupAttempts = 10;
            
            const forceCleanup = setInterval(() => {
                cleanupCount++;
                console.log(`🧹 第${cleanupCount}次清理檢查...`);
                
                const problematicElements = document.querySelectorAll(`
                    #login-overlay,
                    .login-overlay,
                    .overlay,
                    .modal-overlay,
                    .loading-overlay,
                    [style*="position: fixed"],
                    [style*="z-index: 9999"]
                `);
                
                problematicElements.forEach(el => {
                    if (el && el.id !== 'app') {
                        el.remove();
                    }
                });
                
                if (cleanupCount >= maxCleanupAttempts) {
                    clearInterval(forceCleanup);
                    console.log('✅ 清理任務完成');
                }
            }, 200);
        },
        beforeDestroy() {
            if (this.socket) {
                this.socket.disconnect();
            }
            document.removeEventListener('click', this.handleClickOutside);
        },
        watch: {
            showDropdownMenu(isOpen) {
                if (isOpen) {
                    // Use timeout to prevent the click that opens the menu from immediately closing it.
                    setTimeout(() => {
                        document.addEventListener('click', this.handleClickOutside);
                    }, 0);
                } else {
                    document.removeEventListener('click', this.handleClickOutside);
                }
            },
            showChips(isOpen) {
                if (isOpen) {
                    setTimeout(() => {
                        document.addEventListener('click', this.handleClickOutside);
                    }, 0);
                } else {
                    if (!this.showDropdownMenu) {
                        document.removeEventListener('click', this.handleClickOutside);
                    }
                }
            }
        }
    });
}); 