// Vue 应用實例
document.addEventListener('DOMContentLoaded', function() {
    new Vue({
        el: '#app',
        data() {
            return {
                API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                    ? 'http://localhost:3002' 
                    : '', // 在production環境中使用相同域名
                // 用戶相关
                isLoggedIn: false,
                username: '',
                balance: 0,
                balanceChanged: false,
                userMarketType: 'D', // 用戶盤口類型，預設D盤
                
                // 游戏状态
                gameStatus: 'betting', // betting or drawing
                currentPeriod: '',
                nextPeriod: '',
                countdownSeconds: 0,
                
                // 开奖结果
                lastResult: [],
                lastResults: [],
                
                // 投注相关
                defaultBetAmount: 1, // 默認投注金额
                betAmount: 1,
                selectedBets: [],
                activeTab: 'combined', // 当前活躍的標籤頁
                
                // 位置选择相关
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
                
                // 显示状态
                showHistory: false,
                showRecords: false,
                showProfitModal: false,
                showDayDetailModal: false,
                showDropdownMenu: false, // 控制下拉菜单显示状态
                
                // 热门投注
                hotBets: [],
                
                // 投注记录
                betRecords: [],
                betRecordsPagination: {
                    page: 1,
                    pageSize: 20,
                    total: 0
                },
                
                // 历史开奖记录
                historyRecords: [],
                historyPagination: {
                    page: 1,
                    pageSize: 20,
                    total: 0
                },
                
                // 统计数据
                dailyBetCount: 0,
                dailyProfit: 0,
                
                // 盈亏记录相关
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
                
                // 通知系统
                notificationText: '',
                notificationVisible: false,
                
                // 自訂金额
                customAmount: '',
                
                // 赔率数据 - 包含退水0.41，與後端一致
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
                
                // 开奖结果標籤
                resultLabels: Array.from({ length: 10 }, (_, i) => `${i + 1}名`),
                
                // 新的下注确认相关
                showBetModal: false,
                autoAcceptBetterOdds: true,
                hasLastBets: false,
                lastBets: [],
                showChips: false,
                
                // 新增缺失的数据屬性
                dragonRankingVisible: false, // 控制長龙排行显示状态
                themeSelectorVisible: false, // 控制主題选择器显示状态
                showRaceAnimation: false, // 控制赛车动画显示状态
                selectedPositions: [], // 多選位置
                
                // 盈亏记录相关
                profitTimeRange: 'thisWeek',
                selectedDate: '',
                dayDetailRecords: [],
                dayDetailStats: {
                    betCount: 0,
                    profit: 0
                },
                
                // 長龙排行数据
                dragonRankingData: {
                    champion: { type: '冠军', current: 0, max: 0, trend: [] },
                    runnerup: { type: '亚军', current: 0, max: 0, trend: [] },
                    big: { type: '大', current: 0, max: 0, trend: [] },
                    small: { type: '小', current: 0, max: 0, trend: [] },
                    odd: { type: '单', current: 0, max: 0, trend: [] },
                    even: { type: '双', current: 0, max: 0, trend: [] }
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
                roadBeadRows: [] , // 路珠资料 6xN
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
            // 初始化历史开奖记录为空數組，防止undefined错误
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
            // 初始化倒计时功能
            initCountdown() {
                // 每秒更新倒计时
                this.countdownTimer = setInterval(() => {
                    if (this.countdownSeconds > 0) {
                        this.countdownSeconds--;
                        this.updateCountdownDisplay();
                    }
                }, 1000);
            },
            
            // 更新倒计时显示
            updateCountdownDisplay() {
                // 实时更新倒计时显示
            },
            
            // 检查登录状态
            checkLoginStatus() {
                console.log('🔍 Vue检查登录状态 - isLoggedIn:', sessionStorage.getItem('isLoggedIn'), 'username:', sessionStorage.getItem('username'), 'balance:', sessionStorage.getItem('balance'));
                console.log('🧹 登录检查时执行遮罩清理...');
                
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
                
                // 确保#app容器显示
                const appContainer = document.querySelector('#app');
                if (appContainer) {
                    console.log('✅ 确保#app容器显示');
                    appContainer.style.display = 'block';
                    appContainer.style.visibility = 'visible';
                    appContainer.style.opacity = '1';
                }
                
                const isLoggedIn = sessionStorage.getItem('isLoggedIn');
                const username = sessionStorage.getItem('username');
                const balance = sessionStorage.getItem('balance');
                
                if (isLoggedIn === 'true' && username && balance !== null) {
                    console.log('✅ 登录状态有效，设置用戶资讯');
                    this.isLoggedIn = true;
                    this.username = username;
                    this.balance = parseFloat(balance) || 0;
                    // 獲取用戶盤口類型
                    this.getUserMarketType();
                } else {
                    console.log('❌ 登录状态无效，显示登录表单');
                    this.isLoggedIn = false;
                    this.username = '';
                    this.balance = 0;
                    this.userMarketType = 'D';
                }
            },
            
            // 更新游戏数据
            updateGameData() {
                console.log('开始获取游戏数据...');
                
                // 获取游戏状态
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
                        console.error('获取游戏状态失败:', error);
                    });
                
                // 更新历史开奖记录
                this.updateHistoryRecords();
            },
            
            // 更新历史记录
            updateHistoryRecords() {
                fetch(`${this.API_BASE_URL}/api/history?limit=20`)
                    .then(response => response.json())
                    .then(data => {
                        console.log('开奖历史API返回数据:', JSON.stringify(data).substring(0, 200) + '...');
                        if (data.success && data.records) {
                            this.historyRecords = data.records;
                            console.log('开奖历史更新成功，记录数量:', this.historyRecords.length);
                        }
                    })
                    .catch(error => {
                        console.error('获取历史记录失败:', error);
                    });
            },
            
            // 更新余额
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
                        
                        // 如果余额有變化，觸發动画
                        if (oldBalance !== this.balance) {
                            this.balanceChanged = true;
                            setTimeout(() => {
                                this.balanceChanged = false;
                            }, 2000);
                        }
                    }
                })
                .catch(error => {
                    console.error('更新余额失败:', error);
                });
            },
            
            // 更新每日统计
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
                        console.error('获取每日统计失败:', error);
                    });
            },
            
            // 更新投注历史
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
                        console.error('获取投注历史失败:', error);
                    });
            },
            
            // 获取热门投注
            fetchHotBets() {
                fetch(`${this.API_BASE_URL}/api/hot-bets`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success && data.hotBets) {
                            this.hotBets = data.hotBets;
                            console.log('热门投注数据获取成功，共有', this.hotBets.length, '個热门投注');
                        }
                    })
                    .catch(error => {
                        console.error('获取热门投注失败:', error);
                    });
            },
            
            // 獲取用戶盤口類型
            getUserMarketType() {
                if (!this.isLoggedIn || !this.username) return;
                
                // 調用代理系統API獲取會員盤口信息
                const agentApiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                    ? 'http://localhost:3003' 
                    : '/agent';  // 修復：生產環境使用相對路徑
                
                fetch(`${agentApiUrl}/api/member/info/${this.username}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success && data.member) {
                            this.userMarketType = data.member.market_type || 'D';
                            console.log(`用戶 ${this.username} 盤口類型: ${this.userMarketType}`);
                            // 更新賠率顯示
                            this.updateOddsDisplay();
                        } else {
                            console.warn('獲取用戶盤口信息失敗，使用預設D盤');
                            this.userMarketType = 'D';
                        }
                    })
                    .catch(error => {
                        console.error('獲取用戶盤口信息失敗:', error);
                        this.userMarketType = 'D';
                    });
            },
            
            // 更新賠率顯示
            updateOddsDisplay() {
                if (this.userMarketType === 'A') {
                    // A盤賠率：1.1%退水
                    this.odds = {
                        sumValue: {
                            '3': 40.559, '4': 20.769, '5': 15.824, '6': 12.857, '7': 10.879,
                            '8': 8.901, '9': 7.922, '10': 6.943, '11': 6.943, '12': 7.922,
                            '13': 8.901, '14': 10.879, '15': 12.857, '16': 15.824, '17': 20.769,
                            '18': 40.559, '19': 80.119,
                            big: 1.9, small: 1.9, odd: 1.9, even: 1.9
                        },
                        champion: { big: 1.9, small: 1.9, odd: 1.9, even: 1.9 },
                        runnerup: { big: 1.9, small: 1.9, odd: 1.9, even: 1.9 },
                        third: { big: 1.9, small: 1.9, odd: 1.9, even: 1.9 },
                        fourth: { big: 1.9, small: 1.9, odd: 1.9, even: 1.9 },
                        fifth: { big: 1.9, small: 1.9, odd: 1.9, even: 1.9 },
                        sixth: { big: 1.9, small: 1.9, odd: 1.9, even: 1.9 },
                        seventh: { big: 1.9, small: 1.9, odd: 1.9, even: 1.9 },
                        eighth: { big: 1.9, small: 1.9, odd: 1.9, even: 1.9 },
                        ninth: { big: 1.9, small: 1.9, odd: 1.9, even: 1.9 },
                        tenth: { big: 1.9, small: 1.9, odd: 1.9, even: 1.9 },
                        dragonTiger: { 
                            dragon: 1.9, 
                            tiger: 1.9 
                        },
                        number: {
                            first: 9.89,  // 10.0 - 0.11 = 9.89
                            second: 9.89,
                            third: 9.89,
                            fourth: 9.89,
                            fifth: 9.89,
                            sixth: 9.89,
                            seventh: 9.89,
                            eighth: 9.89,
                            ninth: 9.89,
                            tenth: 9.89
                        }
                    };
                    console.log('✅ 已切換至A盤賠率 (1.1%退水)');
                } else {
                    // D盤賠率：4.1%退水 (預設)
                    this.odds = {
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
                    };
                    console.log('✅ 已切換至D盤賠率 (4.1%退水)');
                }
            },
            
            // 选择热门投注
            selectHotBet(bet) {
                // 實現选择热门投注的邏輯
                console.log('选择热门投注:', bet);
                this.showDropdownMenu = false;
            },
            
            // 切換下拉菜单
            toggleDropdown() {
                this.showDropdownMenu = !this.showDropdownMenu;
            },
            
            // 显示历史开奖
            showDrawHistory() {
                this.showHistory = true;
                this.showDropdownMenu = false;
            },
            
            // 显示投注记录
            showBetRecords() {
                this.showRecords = true;
                this.showDropdownMenu = false;
            },
            
            // 显示盈亏记录
            showProfitRecords() {
                this.showProfitModal = true;
                this.showDropdownMenu = false;
                // 立即载入盈亏记录
                this.loadProfitRecords();
            },
            
            // 显示游戏規則
            showGameRules() {
                const rulesText = `重要声明

            1.如果客户怀疑自己的资料被盗用，应立即通知本公司，并更改详细数据，以前的用户名称及密码将全部无效。

2.客户有责任确保自己的账户及登录资料的保密性。以用户名称及密码进行的任何网上投注將被视为有效。

3.公佈赔率时出现的任何打字错误或非故意人为失誤，本公司保留改正错误和按正确赔率结算投注的權力。您居住所在地的法律有可能規定网络博弈不合法；若此情況屬實，本公司將不會批准您使用付賬卡进行交易。

4.每次登录时客户都应该核对自己的账户結余额。如對余额有任何疑问，请在第一时间內通知本公司。

5.一旦投注被接受，則不得取消或修改。

6.所有号码赔率將不时浮動，派彩时的赔率將以确认投注时之赔率为準。

7.每注最高投注金额按不同[場次]及[投注項目]及[会员賬号]设定浮動。如投注金额超過上述设定，本公司有權取消超過之投注金额。

            8.所有投注都必须在开奖前时间内进行否则投注无效。

9.所有投注派彩彩金皆含本金。

具體游戏規則如下：

1. 1～10 兩面：指 单、双；大、小。

单、双：号码为双數叫双，如4、8；号码为单數叫单，如5、9。

大、小：開出之号码大于或等于6为大，小于或等于5为小。

第一名～第十名 車号指定：每一個車号为一投注组合，开奖结果「投注車号」对应所投名次视为中奖，其余情形视为不中奖。

2. 1～5龙虎

冠 军 龙/虎：「第一名」車号大于「第十名」車号视为【龙】中奖、反之小于视为【虎】中奖，其余情形视为不中奖。

亞 军 龙/虎：「第二名」車号大于「第九名」車号视为【龙】中奖、反之小于视为【虎】中奖，其余情形视为不中奖。

第三名 龙/虎：「第三名」車号大于「第八名」車号视为【龙】中奖、反之小于视为【虎】中奖，其余情形视为不中奖。

第四名 龙/虎：「第四名」車号大于「第七名」車号视为【龙】中奖、反之小于视为【虎】中奖，其余情形视为不中奖。

第五名 龙/虎：「第五名」車号大于「第六名」車号视为【龙】中奖、反之小于视为【虎】中奖，其余情形视为不中奖。

3. 冠军車号＋亚军車号＝冠亞和值（为3~19)

冠亞和单双：「冠亞和值」为单视为投注「单」的註单视为中奖，为双视为投注「双」的註单视为中奖，其余视为不中奖。

冠亞和大小：「冠亞和值」大于11时投注「大」的註单视为中奖，小于或等于11时投注「小」的註单视为中奖，其余视为不中奖。

冠亞和指定：「冠亞和值」可能出现的结果为3～19， 投中对应「冠亞和值」数字的视为中奖，其余视为不中奖。`;

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
            
            // 登录
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
                        this.isLoggedIn = true;  // 確保設定登錄狀態
                        this.checkLoginStatus();  // 這會調用getUserMarketType()
                        this.showNotification('登录成功！');
                    } else {
                        this.showNotification('登录失败，请检查用戶名和密码。');
                    }
                })
                .catch(error => {
                    console.error('登录失败:', error);
                    this.showNotification('登录失败，请稍後再試。');
                });
            },
            
            // 显示通知
            showNotification(message) {
                this.notificationText = message;
                this.notificationVisible = true;
                setTimeout(() => {
                    this.notificationVisible = false;
                }, 3000);
            },
            
            // 格式化时间
            formatTime(seconds) {
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = seconds % 60;
                return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
            },
            
            // 格式化历史开奖时间为 HH:MM:SS 格式
            formatHistoryTime(dateStr) {
                if (!dateStr) return 'NaN:NaN:NaN';
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return 'NaN:NaN:NaN';
                return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
            },
            
            // 格式化金额
            formatMoney(amount) {
                return `¥${parseFloat(amount || 0).toFixed(2)}`;
            },
            
            // 格式化赔率
            formatOdds(odds) {
                return parseFloat(odds || 0).toFixed(2);
            },
            
            // 格式化盈亏
            formatProfit(profit) {
                const amount = parseFloat(profit || 0);
                return amount >= 0 ? `+¥${amount.toFixed(2)}` : `-¥${Math.abs(amount).toFixed(2)}`;
            },
            
            // 检查是否已选择
            isSelected(betType, value) {
                return this.selectedBets.some(bet => 
                    bet.betType === betType && bet.value === value
                );
            },
            
            // 选择投注
            selectBet(betType, value) {
                const existingIndex = this.selectedBets.findIndex(bet => 
                    bet.betType === betType && bet.value === value
                );
                
                if (existingIndex !== -1) {
                    // 如果已选择，則取消选择
                    this.selectedBets.splice(existingIndex, 1);
                } else {
                    // 添加新的选择
                    this.selectedBets.push({
                        betType: betType,
                        value: value,
                        odds: this.getOddsForBet(betType, value),
                        amount: this.betAmount
                    });
                }
            },
            
            // 获取投注赔率
            getOddsForBet(betType, value) {
                if (this.odds[betType] && this.odds[betType][value]) {
                    return this.odds[betType][value];
                }
                return 1.96; // 默認赔率
            },
            
            // 点击外部关闭
            handleClickOutside(event) {
                const menuContainer = this.$refs.menuContainer;
                if (menuContainer && !menuContainer.contains(event.target)) {
                    this.showDropdownMenu = false;
                }
                
                // 检查是否点击在籌碼選单外部
                const chipsDropdown = document.querySelector('.chips-dropdown');
                if (chipsDropdown && !chipsDropdown.contains(event.target)) {
                    this.showChips = false;
                }
            },
            
            // 显示長龙排行
            showDragonRanking() {
                this.dragonRankingVisible = true;
                this.loadDragonRankingData();
                this.showDropdownMenu = false;
            },
            
            // 显示主題选择器
            showThemeSelector() {
                this.themeSelectorVisible = true;
                this.showDropdownMenu = false;
            },
            
            // 切換赛车动画
            toggleAnimation() {
                this.showRaceAnimation = !this.showRaceAnimation;
                if (this.showRaceAnimation) {
                    this.playRaceAnimation();
                }
            },
            
            // 设置投注金额
            setBetAmount(amount) {
                this.betAmount = amount;
                this.customAmount = '';
                
                // 同时更新所有已选择投注項目的金额
                this.selectedBets.forEach(bet => {
                    bet.amount = amount;
                });
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
            
            // 显示投注确认彈窗
            showBetConfirmation() {
                if (this.selectedBets.length === 0) {
                    this.showNotification('请选择投注項目');
                    return;
                }
                if (this.betAmount < 1) {
                    this.showNotification('投注金额不能少于1元');
                    return;
                }
                this.showBetModal = true;
            },
            
            // 從确认彈窗中移除投注
            removeBetFromConfirm(index) {
                this.selectedBets.splice(index, 1);
            },
            
            // 确认投注
            confirmBets() {
                if (this.gameStatus !== 'betting') {
                    this.showNotification('当前無法下注');
                    return;
                }
                
                // 保存当前投注为最后投注
                this.lastBets = [...this.selectedBets];
                this.hasLastBets = true;
                
                // 执行投注邏輯
                this.placeBets();
                this.showBetModal = false;
            },
            
            // 执行投注
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
                        // 检查是否为账号凍結信息
                        if (data.message && data.message.includes('凍結')) {
                            this.showNotification(`${data.message}`, 'warning');
                            // 禁用投注按钮或显示特殊提示
                            this.showFrozenAccountWarning();
                        } else {
                            this.showNotification(`投注失败：${data.message}`);
                        }
                    }
                })
                .catch(error => {
                    console.error('投注失败:', error);
                    this.showNotification('投注失败，请稍後再試');
                });
            },
            
            // 显示凍結账号警告
            showFrozenAccountWarning() {
                // 可以在这里添加额外的UI处理
                const warningEl = document.querySelector('.frozen-account-warning');
                if (warningEl) {
                    warningEl.style.display = 'block';
                }
            },
            
            // 切換盈亏时间范围
            switchProfitRange(range) {
                this.profitTimeRange = range;
                this.loadProfitRecords();
            },
            
            // 显示日期詳情
            showDayDetail(date) {
                this.selectedDate = date;
                this.loadDayDetailRecords(date);
                this.showDayDetailModal = true;
            },
            
            // 搜索今日历史
            searchTodayHistory() {
                const today = new Date().toISOString().split('T')[0];
                this.loadHistoryRecords(today);
            },
            
            // 清除历史搜索
            clearHistorySearch() {
                this.loadHistoryRecords();
            },
            
            // 注册
            register() {
                if (this.registerForm.password !== this.registerForm.confirmPassword) {
                    this.showNotification('密码确认不一致');
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
                        this.showNotification('注册成功！请登录');
                        this.showRegisterModal = false;
                        this.showLoginModal = true;
                        this.registerForm = { username: '', password: '', confirmPassword: '' };
                    } else {
                        this.showNotification(`注册失败：${data.message}`);
                    }
                })
                .catch(error => {
                    console.error('注册失败:', error);
                    this.showNotification('注册失败，请稍後再試');
                });
            },
            
            // 载入長龙排行数据
            loadDragonRankingData() {
                fetch(`${this.API_BASE_URL}/api/dragon-ranking`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            this.dragonRankingData = data.dragonRankings || [];
                        }
                    })
                    .catch(error => {
                        console.error('载入長龙排行失败:', error);
                    });
            },
            
            // 播放赛车动画
            playRaceAnimation() {
                // 使用預先生成的结果播放赛车动画
                if (this.lastResult && this.lastResult.length > 0) {
                    this.animateRace(this.lastResult);
                }
            },
            
            // 赛车动画邏輯
            animateRace(result) {
                // 實際的赛车动画邏輯
                console.log('播放赛车动画:', result);
                // 这里可以添加具體的赛车动画實現
            },
            
            // 切換主題
            changeTheme(themeId) {
                this.currentTheme = themeId;
                const theme = this.themes.find(t => t.id === themeId);
                if (theme) {
                    // 主要顏色變數
                    document.documentElement.style.setProperty('--primary-color', theme.primary);
                    document.documentElement.style.setProperty('--secondary-color', theme.secondary);

                    // 依主要顏色動態计算 hover 與淡色背景
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

            // 新增：將 HEX 轉为 RGB
            hexToRgb(hex) {
                const sanitized = hex.replace('#', '');
                if (sanitized.length !== 6) return null;
                const bigint = parseInt(sanitized, 16);
                const r = (bigint >> 16) & 255;
                const g = (bigint >> 8) & 255;
                const b = bigint & 255;
                return { r, g, b };
            },
            
            // 载入盈亏记录
            loadProfitRecords() {
                if (!this.isLoggedIn) return;
                
                // 根據时间范围选择不同的API
                let apiUrl;
                if (this.profitTimeRange === 'thisWeek' || this.profitTimeRange === 'lastWeek') {
                    // 计算週的开始和结束日期
                    const today = new Date();
                    const startDate = new Date();
                    const endDate = new Date();
                    
                    if (this.profitTimeRange === 'thisWeek') {
                        // 本週（從星期一 00:00:00 开始）
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

                    // 使查询涵蓋整天 00:00:00 ~ 23:59:59
                    startDate.setHours(0, 0, 0, 0);
                    endDate.setHours(23, 59, 59, 999);

                    apiUrl = `${this.API_BASE_URL}/api/weekly-profit-records?username=${this.username}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
                } else {
                    // 其他时间范围使用原有API
                    const days = this.profitTimeRange === '7days' ? 7 : parseInt(this.profitTimeRange) || 7;
                    apiUrl = `${this.API_BASE_URL}/api/profit-records?username=${this.username}&days=${days}`;
                }
                
                fetch(apiUrl)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            this.profitRecords = data.records || [];
                            // 後端若未回傳统计，前端自行彙總
                            this.totalBetCount = ('totalBetCount' in data) ? (data.totalBetCount || 0) : this.profitRecords.reduce((s, r) => s + (r.betCount || 0), 0);
                            this.totalProfit = ('totalProfit' in data) ? (data.totalProfit || 0) : this.profitRecords.reduce((s, r) => s + (r.profit || 0), 0);
                        }
                    })
                    .catch(error => {
                        console.error('载入盈亏记录失败:', error);
                    });
            },
            
            // 载入日期詳情记录
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
                        console.error('载入日期詳情失败:', error);
                    });
            },
            
            // 切換位置选择
            togglePosition(position) {
                const index = this.selectedPositions.indexOf(position);
                if (index > -1) {
                    this.selectedPositions.splice(index, 1);
                } else {
                    this.selectedPositions.push(position);
                }
            },
            
            // 清除位置选择
            clearPositions() {
                this.selectedPositions = [];
            },
            
            // 选择多位置号码
            selectMultiPositionNumber(num) {
                if (this.selectedPositions.length === 0) {
                    this.showNotification('请先选择位置');
                    return;
                }
                
                this.selectedPositions.forEach(position => {
                    this.selectBet('number', String(num), position);
                });
            },
            
            // 选择多位置屬性
            selectMultiPositionProperty(property) {
                if (this.selectedPositions.length === 0) {
                    this.showNotification('请先选择位置');
                    return;
                }
                
                this.selectedPositions.forEach(position => {
                    const betType = this.getPositionBetType(position);
                    this.selectBet(betType, property);
                });
            },
            
            // 获取位置投注類型
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
                                // nums 为 10 号，这里示範第一名号码
                                const val = nums[0];
                                const rowIdx = idx % 6;
                                rows[rowIdx].push(val);
                            });
                            this.roadBeadRows = rows;
                        }
                    })
                    .catch(e=>console.error('载入路珠失败',e));
            },
        },
        mounted() {
            this.initCountdown();
            this.updateGameData();
            this.fetchHotBets();  // 加載热门投注数据
            
            // 每隔10秒刷新一次游戏数据
            setInterval(() => {
                this.updateGameData();
            }, 10000);
            
            // 每隔30秒刷新一次余额
            setInterval(() => {
                if (this.isLoggedIn) {
                    this.updateBalance();
                }
            }, 30000);
            
            // 每隔60秒刷新一次注单历史
            setInterval(() => {
                if (this.isLoggedIn) {
                    this.updateBetHistory();
                }
            }, 60000);
            
            // 每隔5分鐘刷新一次热门投注数据
            setInterval(() => {
                this.fetchHotBets();
            }, 5 * 60 * 1000);
            
            // 初始检查登录状态
            this.checkLoginStatus();
            
            // 更新初始资料
            this.updateDailyStats();
            this.updateHistoryRecords();
            
            // 强制清理任何剩餘的遮罩
            console.log('🚀 执行强制遮罩清理...');
            let cleanupCount = 0;
            const maxCleanupAttempts = 10;
            
            const forceCleanup = setInterval(() => {
                cleanupCount++;
                console.log(`🧹 第${cleanupCount}次清理检查...`);
                
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
                    console.log('✅ 清理任务完成');
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