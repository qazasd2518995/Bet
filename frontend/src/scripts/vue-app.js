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
                        '3': 39.319, '4': 20.139, '5': 15.344, '6': 12.467, '7': 10.549,
                        '8': 8.631, '9': 7.672, '10': 6.713, '11': 6.713, '12': 7.672,
                        '13': 8.631, '14': 10.549, '15': 12.467, '16': 15.344, '17': 20.139,
                        '18': 39.319, '19': 77.679,
                        big: 1.88, small: 1.88, odd: 1.88, even: 1.88
                    },
                    champion: { big: 1.88, small: 1.88, odd: 1.88, even: 1.88 },
                    runnerup: { big: 1.88, small: 1.88, odd: 1.88, even: 1.88 },
                    third: { big: 1.88, small: 1.88, odd: 1.88, even: 1.88 },
                    fourth: { big: 1.88, small: 1.88, odd: 1.88, even: 1.88 },
                    fifth: { big: 1.88, small: 1.88, odd: 1.88, even: 1.88 },
                    sixth: { big: 1.88, small: 1.88, odd: 1.88, even: 1.88 },
                    seventh: { big: 1.88, small: 1.88, odd: 1.88, even: 1.88 },
                    eighth: { big: 1.88, small: 1.88, odd: 1.88, even: 1.88 },
                    ninth: { big: 1.88, small: 1.88, odd: 1.88, even: 1.88 },
                    tenth: { big: 1.88, small: 1.88, odd: 1.88, even: 1.88 },
                    dragonTiger: { 
                        dragon: 1.88, 
                        tiger: 1.88 
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
                
                // 新增缺失的數據屬性
                dragonRankingVisible: false, // 控制長龍排行顯示狀態
                themeSelectorVisible: false, // 控制主題選擇器顯示狀態
                showRaceAnimation: false, // 控制賽車動畫顯示狀態
                selectedPositions: [], // 多選位置
                
                // 盈虧記錄相關
                profitTimeRange: 'thisWeek',
                selectedDate: '',
                dayDetailRecords: [],
                dayDetailStats: {
                    betCount: 0,
                    profit: 0
                },
                
                // 長龍排行數據
                dragonRankingData: {
                    champion: { type: '冠軍', current: 0, max: 0, trend: [] },
                    runnerup: { type: '亞軍', current: 0, max: 0, trend: [] },
                    big: { type: '大', current: 0, max: 0, trend: [] },
                    small: { type: '小', current: 0, max: 0, trend: [] },
                    odd: { type: '單', current: 0, max: 0, trend: [] },
                    even: { type: '雙', current: 0, max: 0, trend: [] }
                },
                
                // 主題配置
                currentTheme: 'default',
                themes: [
                    { id: 'default', name: '經典藍', primary: '#667eea', secondary: '#764ba2' },
                    { id: 'red', name: '財運紅', primary: '#e74c3c', secondary: '#c0392b' },
                    { id: 'green', name: '翡翠綠', primary: '#27ae60', secondary: '#16a085' },
                    { id: 'gold', name: '黃金色', primary: '#f39c12', secondary: '#e67e22' }
                ],
                roadBeadVisible: false, // 路珠走勢開關
                roadBeadRows: [] , // 路珠資料 6xN
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
                fetch(`${this.API_BASE_URL}/api/game-data`)
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
                fetch(`${this.API_BASE_URL}/api/history?limit=20`)
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
                
                fetch(`${this.API_BASE_URL}/api/balance?username=${this.username}`, {
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
                
                fetch(`${this.API_BASE_URL}/api/daily-profit?username=${this.username}`)
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
                
                fetch(`${this.API_BASE_URL}/api/bet-history?username=${this.username}`)
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
                fetch(`${this.API_BASE_URL}/api/hot-bets`)
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
                // 立即載入盈虧記錄
                this.loadProfitRecords();
            },
            
            // 顯示遊戲規則
            showGameRules() {
                const rulesText = `重要聲明

1.如果客戶懷疑自己的資料被盜用，應立即通知本公司，並更改詳細數據，以前的使用者名稱及密碼將全部無效。

2.客戶有責任確保自己的賬戶及登入資料的保密性。以使用者名稱及密碼進行的任何網上投注將被視為有效。

3.公佈賠率時出現的任何打字錯誤或非故意人為失誤，本公司保留改正錯誤和按正確賠率結算投注的權力。您居住所在地的法律有可能規定網絡博弈不合法；若此情況屬實，本公司將不會批准您使用付賬卡進行交易。

4.每次登入時客戶都應該核對自己的賬戶結餘額。如對餘額有任何疑問，請在第一時間內通知本公司。

5.一旦投注被接受，則不得取消或修改。

6.所有號碼賠率將不時浮動，派彩時的賠率將以確認投注時之賠率為準。

7.每注最高投注金額按不同[場次]及[投注項目]及[會員賬號]設定浮動。如投注金額超過上述設定，本公司有權取消超過之投注金額。

8.所有投注都必須在開獎前時間內進行否則投注無效。

9.所有投注派彩彩金皆含本金。

具體遊戲規則如下：

1. 1～10 兩面：指 單、雙；大、小。

單、雙：號碼為雙數叫雙，如4、8；號碼為單數叫單，如5、9。

大、小：開出之號碼大於或等於6為大，小於或等於5為小。

第一名～第十名 車號指定：每一個車號為一投註組合，開獎結果「投註車號」對應所投名次視為中獎，其余情形視為不中獎。

2. 1～5龍虎

冠 軍 龍/虎：「第一名」車號大於「第十名」車號視為【龍】中獎、反之小於視為【虎】中獎，其余情形視為不中獎。

亞 軍 龍/虎：「第二名」車號大於「第九名」車號視為【龍】中獎、反之小於視為【虎】中獎，其余情形視為不中獎。

第三名 龍/虎：「第三名」車號大於「第八名」車號視為【龍】中獎、反之小於視為【虎】中獎，其余情形視為不中獎。

第四名 龍/虎：「第四名」車號大於「第七名」車號視為【龍】中獎、反之小於視為【虎】中獎，其余情形視為不中獎。

第五名 龍/虎：「第五名」車號大於「第六名」車號視為【龍】中獎、反之小於視為【虎】中獎，其余情形視為不中獎。

3. 冠軍車號＋亞軍車號＝冠亞和值（為3~19)

冠亞和單雙：「冠亞和值」為單視為投註「單」的註單視為中獎，為雙視為投註「雙」的註單視為中獎，其余視為不中獎。

冠亞和大小：「冠亞和值」大於11時投註「大」的註單視為中獎，小於或等於11時投註「小」的註單視為中獎，其余視為不中獎。

冠亞和指定：「冠亞和值」可能出現的結果為3～19， 投中對應「冠亞和值」數字的視為中獎，其余視為不中獎。`;

                alert(rulesText);
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
                fetch(`${this.API_BASE_URL}/api/member/login`, {
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
            
            // 格式化歷史開獎時間為 HH:MM:SS 格式
            formatHistoryTime(dateStr) {
                if (!dateStr) return 'NaN:NaN:NaN';
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return 'NaN:NaN:NaN';
                return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
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
            },
            
            // 顯示長龍排行
            showDragonRanking() {
                this.dragonRankingVisible = true;
                this.loadDragonRankingData();
                this.showDropdownMenu = false;
            },
            
            // 顯示主題選擇器
            showThemeSelector() {
                this.themeSelectorVisible = true;
                this.showDropdownMenu = false;
            },
            
            // 切換賽車動畫
            toggleAnimation() {
                this.showRaceAnimation = !this.showRaceAnimation;
                if (this.showRaceAnimation) {
                    this.playRaceAnimation();
                }
            },
            
            // 設置投注金額
            setBetAmount(amount) {
                this.betAmount = amount;
                this.customAmount = '';
            },
            
            // 清除投注
            clearBets() {
                this.selectedBets = [];
                this.selectedPositions = [];
            },
            
            // 重複上次投注
            repeatLastBets() {
                if (this.hasLastBets && this.lastBets.length > 0) {
                    this.selectedBets = [...this.lastBets];
                    this.showNotification('已恢復上次投注');
                }
            },
            
            // 顯示投注確認彈窗
            showBetConfirmation() {
                if (this.selectedBets.length === 0) {
                    this.showNotification('請選擇投注項目');
                    return;
                }
                if (this.betAmount <= 0) {
                    this.showNotification('請設置投注金額');
                    return;
                }
                this.showBetModal = true;
            },
            
            // 從確認彈窗中移除投注
            removeBetFromConfirm(index) {
                this.selectedBets.splice(index, 1);
            },
            
            // 確認投注
            confirmBets() {
                if (this.gameStatus !== 'betting') {
                    this.showNotification('當前無法下注');
                    return;
                }
                
                // 保存當前投注為最後投注
                this.lastBets = [...this.selectedBets];
                this.hasLastBets = true;
                
                // 執行投注邏輯
                this.placeBets();
                this.showBetModal = false;
            },
            
            // 執行投注
            placeBets() {
                const bets = this.selectedBets.map(bet => ({
                    betType: bet.betType,
                    value: bet.value,
                    amount: bet.amount || this.betAmount,
                    odds: bet.odds
                }));
                
                fetch(`${this.API_BASE_URL}/api/member/bet`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: this.username,
                        period: this.currentPeriod,
                        bets: bets
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        this.showNotification('投注成功！');
                        this.balance = data.balance;
                        sessionStorage.setItem('balance', data.balance);
                        this.clearBets();
                        this.updateBetHistory();
                    } else {
                        this.showNotification(`投注失敗：${data.message}`);
                    }
                })
                .catch(error => {
                    console.error('投注失敗:', error);
                    this.showNotification('投注失敗，請稍後再試');
                });
            },
            
            // 切換盈虧時間範圍
            switchProfitRange(range) {
                this.profitTimeRange = range;
                this.loadProfitRecords();
            },
            
            // 顯示日期詳情
            showDayDetail(date) {
                this.selectedDate = date;
                this.loadDayDetailRecords(date);
                this.showDayDetailModal = true;
            },
            
            // 搜尋今日歷史
            searchTodayHistory() {
                const today = new Date().toISOString().split('T')[0];
                this.loadHistoryRecords(today);
            },
            
            // 清除歷史搜尋
            clearHistorySearch() {
                this.loadHistoryRecords();
            },
            
            // 註冊
            register() {
                if (this.registerForm.password !== this.registerForm.confirmPassword) {
                    this.showNotification('密碼確認不一致');
                    return;
                }
                
                fetch(`${this.API_BASE_URL}/api/member/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: this.registerForm.username,
                        password: this.registerForm.password
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        this.showNotification('註冊成功！請登入');
                        this.showRegisterModal = false;
                        this.showLoginModal = true;
                        this.registerForm = { username: '', password: '', confirmPassword: '' };
                    } else {
                        this.showNotification(`註冊失敗：${data.message}`);
                    }
                })
                .catch(error => {
                    console.error('註冊失敗:', error);
                    this.showNotification('註冊失敗，請稍後再試');
                });
            },
            
            // 載入長龍排行數據
            loadDragonRankingData() {
                fetch(`${this.API_BASE_URL}/api/dragon-ranking`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            this.dragonRankingData = data.dragonRankings || [];
                        }
                    })
                    .catch(error => {
                        console.error('載入長龍排行失敗:', error);
                    });
            },
            
            // 播放賽車動畫
            playRaceAnimation() {
                // 使用預先生成的結果播放賽車動畫
                if (this.lastResult && this.lastResult.length > 0) {
                    this.animateRace(this.lastResult);
                }
            },
            
            // 賽車動畫邏輯
            animateRace(result) {
                // 實際的賽車動畫邏輯
                console.log('播放賽車動畫:', result);
                // 這裡可以添加具體的賽車動畫實現
            },
            
            // 切換主題
            changeTheme(themeId) {
                this.currentTheme = themeId;
                const theme = this.themes.find(t => t.id === themeId);
                if (theme) {
                    // 主要顏色變數
                    document.documentElement.style.setProperty('--primary-color', theme.primary);
                    document.documentElement.style.setProperty('--secondary-color', theme.secondary);

                    // 依主要顏色動態計算 hover 與淡色背景
                    const rgb = this.hexToRgb(theme.primary);
                    if (rgb) {
                        document.documentElement.style.setProperty('--primary-light', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`);
                        document.documentElement.style.setProperty('--primary-hover', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`);
                    }

                    // 動態插入或更新互動樣式
                    const dynamicStylesId = 'dynamic-theme-styles';
                    let styleEl = document.getElementById(dynamicStylesId);
                    if (!styleEl) {
                        styleEl = document.createElement('style');
                        styleEl.id = dynamicStylesId;
                        document.head.appendChild(styleEl);
                    }
                    styleEl.innerHTML = `
                    .option:hover {
                      border-color: ${theme.primary};
                      background: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1);
                      color: ${theme.primary};
                    }
                    .option.selected,
                    .option.big-option.selected,
                    .option.small-option.selected,
                    .option.odd-option.selected,
                    .option.even-option.selected {
                      background: linear-gradient(135deg, ${theme.primary}, ${theme.secondary});
                      border-color: ${theme.secondary};
                      color: #fff;
                    }
                    .option.selected:hover,
                    .option.big-option.selected:hover,
                    .option.small-option.selected:hover,
                    .option.odd-option.selected:hover,
                    .option.even-option.selected:hover {
                      background: linear-gradient(135deg, ${theme.secondary}, ${theme.primary});
                    }
                    `;

                    localStorage.setItem('selectedTheme', themeId);
                    this.showNotification(`已切換至${theme.name}主題`);
                } else {
                    // 若找不到主題，回退至預設主題
                    this.showNotification('找不到指定主題，已切回預設');
                    this.changeTheme('default');
                }
                this.themeSelectorVisible = false;
            },

            // 新增：將 HEX 轉為 RGB
            hexToRgb(hex) {
                const sanitized = hex.replace('#', '');
                if (sanitized.length !== 6) return null;
                const bigint = parseInt(sanitized, 16);
                const r = (bigint >> 16) & 255;
                const g = (bigint >> 8) & 255;
                const b = bigint & 255;
                return { r, g, b };
            },
            
            // 載入盈虧記錄
            loadProfitRecords() {
                if (!this.isLoggedIn) return;
                
                // 根據時間範圍選擇不同的API
                let apiUrl;
                if (this.profitTimeRange === 'thisWeek' || this.profitTimeRange === 'lastWeek') {
                    // 計算週的開始和結束日期
                    const today = new Date();
                    const startDate = new Date();
                    const endDate = new Date();
                    
                    if (this.profitTimeRange === 'thisWeek') {
                        // 本週（從星期一 00:00:00 開始）
                        const dayOfWeek = today.getDay();
                        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                        startDate.setDate(diff);
                        endDate.setDate(diff + 6);
                    } else {
                        // 上週（同樣取整天）
                        const dayOfWeek = today.getDay();
                        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -13 : -6);
                        startDate.setDate(diff);
                        endDate.setDate(diff + 6);
                    }

                    // 使查詢涵蓋整天 00:00:00 ~ 23:59:59
                    startDate.setHours(0, 0, 0, 0);
                    endDate.setHours(23, 59, 59, 999);

                    apiUrl = `${this.API_BASE_URL}/api/weekly-profit-records?username=${this.username}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
                } else {
                    // 其他時間範圍使用原有API
                    const days = this.profitTimeRange === '7days' ? 7 : parseInt(this.profitTimeRange) || 7;
                    apiUrl = `${this.API_BASE_URL}/api/profit-records?username=${this.username}&days=${days}`;
                }
                
                fetch(apiUrl)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            this.profitRecords = data.records || [];
                            // 後端若未回傳統計，前端自行彙總
                            this.totalBetCount = ('totalBetCount' in data) ? (data.totalBetCount || 0) : this.profitRecords.reduce((s, r) => s + (r.betCount || 0), 0);
                            this.totalProfit = ('totalProfit' in data) ? (data.totalProfit || 0) : this.profitRecords.reduce((s, r) => s + (r.profit || 0), 0);
                        }
                    })
                    .catch(error => {
                        console.error('載入盈虧記錄失敗:', error);
                    });
            },
            
            // 載入日期詳情記錄
            loadDayDetailRecords(date) {
                if (!this.isLoggedIn) return;
                
                fetch(`${this.API_BASE_URL}/api/day-detail?date=${date}&username=${this.username}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            this.dayDetailRecords = data.records || [];
                            this.dayDetailStats = data.stats || { betCount: 0, profit: 0 };
                        }
                    })
                    .catch(error => {
                        console.error('載入日期詳情失敗:', error);
                    });
            },
            
            // 切換位置選擇
            togglePosition(position) {
                const index = this.selectedPositions.indexOf(position);
                if (index > -1) {
                    this.selectedPositions.splice(index, 1);
                } else {
                    this.selectedPositions.push(position);
                }
            },
            
            // 清除位置選擇
            clearPositions() {
                this.selectedPositions = [];
            },
            
            // 選擇多位置號碼
            selectMultiPositionNumber(num) {
                if (this.selectedPositions.length === 0) {
                    this.showNotification('請先選擇位置');
                    return;
                }
                
                this.selectedPositions.forEach(position => {
                    this.selectBet('number', String(num), position);
                });
            },
            
            // 選擇多位置屬性
            selectMultiPositionProperty(property) {
                if (this.selectedPositions.length === 0) {
                    this.showNotification('請先選擇位置');
                    return;
                }
                
                this.selectedPositions.forEach(position => {
                    const betType = this.getPositionBetType(position);
                    this.selectBet(betType, property);
                });
            },
            
            // 獲取位置投注類型
            getPositionBetType(position) {
                const positionMap = {
                    1: 'champion',
                    2: 'runnerup', 
                    3: 'third',
                    4: 'fourth',
                    5: 'fifth',
                    6: 'sixth',
                    7: 'seventh',
                    8: 'eighth',
                    9: 'ninth',
                    10: 'tenth'
                };
                return positionMap[position] || 'champion';
            },
            showRoadBead() {
                this.roadBeadVisible = true;
                this.loadRoadBeadData();
            },
            loadRoadBeadData() {
                fetch(`${this.API_BASE_URL}/api/history?limit=30`)
                    .then(r=>r.json())
                    .then(d=>{
                        if(d.success && Array.isArray(d.records)){
                            const numbersList = d.records.map(rec=>rec.result);
                            // 轉置成 6 行
                            const rows=[[],[],[],[],[],[]];
                            numbersList.forEach((nums, idx)=>{
                                // nums 為 10 號，這裡示範第一名號碼
                                const val = nums[0];
                                const rowIdx = idx % 6;
                                rows[rowIdx].push(val);
                            });
                            this.roadBeadRows = rows;
                        }
                    })
                    .catch(e=>console.error('載入路珠失敗',e));
            },
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