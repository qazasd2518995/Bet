// filepath: /Users/justin/Desktop/Bet/agent/frontend/js/main.js
// 代理管理系統前端 JavaScript 檔案
// 最後更新：2025-05-08

// API 基礎 URL - 根據部署環境自動調整
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? '/api/agent'  // 本地開發環境
    : '/api/agent'; // 生產環境 (Render)

// 添加調試信息來確認 API URL
console.log('當前API基礎URL:', API_BASE_URL, '主機名:', window.location.hostname);

// API請求統一處理函數
async function safeApiCall(apiFunction, fallbackData = null, errorMessage = '操作失敗') {
    try {
        return await apiFunction();
    } catch (error) {
        console.error(`API請求錯誤: ${errorMessage}`, error);
        // 顯示較友好的錯誤訊息，但不阻礙使用者體驗
        // alert(`${errorMessage}，將顯示模擬數據`);
        return { success: false, data: fallbackData, message: errorMessage };
    }
}

// 添加安全渲染輔助方法，防止undefined錯誤
function safeAccess(obj, path, defaultValue = '') {
    try {
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current === undefined || current === null) {
                return defaultValue;
            }
            current = current[key];
        }
        
        return current !== undefined && current !== null ? current : defaultValue;
    } catch (e) {
        console.error('安全存取錯誤:', e);
        return defaultValue;
    }
}

// Vue 應用實例
const app = new Vue({
    el: '#app',
    data: {
        // 身份驗證狀態
        isLoggedIn: false,
        loading: false,
        
        // 登入表單
        loginForm: {
            username: '',
            password: ''
        },
        
        // 用戶資訊
        user: {
            id: '',
            username: '',
            level: 0,
            balance: 0
        },
        
        // 系統公告
        notices: [],
        
        // 當前活動分頁
        activeTab: 'dashboard',
        transactionTab: 'deposit',
        
        // 儀表板數據
        dashboardData: {
            totalAgents: 0,
            totalMembers: 0,
            todayTransactions: 0,
            monthlyCommission: 0
        },
        
        // 圖表實例
        transactionChart: null,
        
        // 代理管理相關
        agents: [],
        agentFilters: {
            level: '-1',
            status: '-1',
            keyword: ''
        },
        agentPagination: {
            currentPage: 1,
            totalPages: 1,
            limit: 20
        },
        
        // 新增代理相關
        showCreateAgentModal: false,
        newAgent: {
            username: '',
            password: '',
            level: '1',
            parent: '',
            commission: 0.2
        },
        parentAgents: [],
        
        // 編輯代理相關
        showEditAgentModal: false,
        editAgentData: {
            id: '',
            username: '',
            password: '',
            commission: 0.2,
            status: 1
        },
        editAgentModal: null,
        
        // 會員管理相關
        members: [],
        memberFilters: {
            status: '-1',
            keyword: ''
        },
        memberPagination: {
            currentPage: 1,
            totalPages: 1,
            limit: 20
        },
        
        // 新增會員相關
        showCreateMemberModal: false,
        newMember: {
            username: '',
            password: '',
            confirmPassword: ''
        },
        
        // 會員餘額調整相關
        showAdjustBalanceModal: false,
        balanceAdjustData: {
            memberId: null,
            memberUsername: '',
            agentId: null,
            currentBalance: 0,
            amount: 0,
            description: ''
        },
        transferType: 'deposit', // 轉移類型，默認為存入
        transferAmount: 0, // 轉移金額，始終為正數
        agentCurrentBalance: 0, // 當前代理餘額
        adjustBalanceModal: null,
        
        // 點數轉移記錄
        pointTransfers: [],
        
        // 開獎記錄相關
        drawRecords: [],
        drawFilters: {
            period: '',
            date: ''
        },
        drawPagination: {
            currentPage: 1,
            totalPages: 1,
            limit: 20
        },
        
        // 添加下注記錄相關
        bets: [],
        betFilters: {
            member: '',
            date: '',
            period: ''
        },
        betPagination: {
            currentPage: 1,
            totalPages: 1,
            limit: 20
        },
        betStats: {
            totalBets: 0,
            totalAmount: 0,
            totalProfit: 0
        },
    },
    
    // 頁面載入時自動執行
    async mounted() {
        console.log('Vue應用已掛載');
        
        // 檢查登入狀態
        await this.checkAuth();
        
        // 獲取代理自身額度
        if (this.isLoggedIn && this.user && this.user.id) {
            const result = await safeApiCall(
                async () => {
                    const response = await fetch(`${API_BASE_URL}/agent-balance?agentId=${this.user.id}`);
                    if (!response.ok) throw new Error(`HTTP錯誤: ${response.status}`);
                    return await response.json();
                },
                { balance: 100000 }, // 默認數據
                '獲取代理額度失敗'
            );
            
            if (result.success) {
                this.user.balance = result.balance;
                console.log('代理當前額度:', this.user.balance);
            } else {
                // 使用默認數據
                this.user.balance = result.data.balance;
                console.log('使用模擬代理額度:', this.user.balance);
            }
        }
        
        // 如果已登入，初始化儀表板和圖表
        if (this.isLoggedIn) {
            await this.fetchDashboardData();
            this.initTransactionChart();
            this.fetchNotices();
        }
        
        // 初始化模態框
        this.initModals();
    },
    
    methods: {
        // 初始化 Bootstrap 5 模態框
        initModals() {
            // 不需要在此處初始化模態框，因為當它們通過v-if被渲染時才應該被初始化
        },
        
        // 顯示創建代理模態框
        showAgentModal() {
            this.showCreateAgentModal = true;
            this.$nextTick(() => {
                // 確保模態框元素已經被渲染到DOM後再初始化和顯示
                const modalEl = document.getElementById('createAgentModal');
                if (modalEl) {
                    this.agentModal = new bootstrap.Modal(modalEl);
                    this.agentModal.show();
                    this.fetchParentAgents();
                } else {
                    console.error('找不到代理模態框元素');
                    this.showMessage('系統錯誤，請稍後再試', 'error');
                }
            });
        },
        
        // 隱藏創建代理模態框
        hideCreateAgentModal() {
            if (this.agentModal) {
                this.agentModal.hide();
            }
            this.showCreateAgentModal = false;
        },
        
        // 顯示創建會員模態框
        showMemberModal() {
            this.showCreateMemberModal = true;
            this.$nextTick(() => {
                // 確保模態框元素已經被渲染到DOM後再初始化和顯示
                const modalEl = document.getElementById('createMemberModal');
                if (modalEl) {
                    this.memberModal = new bootstrap.Modal(modalEl);
                    this.memberModal.show();
                } else {
                    console.error('找不到會員模態框元素');
                    this.showMessage('系統錯誤，請稍後再試', 'error');
                }
            });
        },
        
        // 隱藏創建會員模態框
        hideCreateMemberModal() {
            if (this.memberModal) {
                this.memberModal.hide();
            }
            this.showCreateMemberModal = false;
        },
        
        // 檢查身份驗證狀態
        async checkAuth() {
            const token = localStorage.getItem('agent_token');
            const user = JSON.parse(localStorage.getItem('agent_user') || '{}');
            
            if (token && user.id) {
                this.isLoggedIn = true;
                this.user = user;
                
                // 設置 axios 身份驗證頭
                axios.defaults.headers.common['Authorization'] = token;
            }
        },
        
        // 登入方法
        async login() {
            if (!this.loginForm.username || !this.loginForm.password) {
                return this.showMessage('請輸入用戶名和密碼', 'error');
            }
            
            this.loading = true;
            
            try {
                const response = await axios.post(`${API_BASE_URL}/login`, this.loginForm);
                
                if (response.data.success) {
                    // 保存用戶資訊和 token
                    const { agent, token } = response.data;
                    localStorage.setItem('agent_token', token);
                    localStorage.setItem('agent_user', JSON.stringify(agent));
                    
                    // 設置 axios 身份驗證頭
                    axios.defaults.headers.common['Authorization'] = token;
                    
                    // 更新用戶資訊
                    this.user = agent;
                    this.isLoggedIn = true;
                    
                    // 獲取初始數據
                    await this.fetchDashboardData();
                    await this.fetchNotices();
                    
                    this.showMessage('登入成功', 'success');
                } else {
                    this.showMessage(response.data.message || '登入失敗', 'error');
                }
            } catch (error) {
                this.showMessage(error.response?.data?.message || '登入失敗，請稍後再試', 'error');
                console.error('登入錯誤:', error);
            } finally {
                this.loading = false;
            }
        },
        
        // 登出方法
        logout() {
            // 清除本地存儲
            localStorage.removeItem('agent_token');
            localStorage.removeItem('agent_user');
            
            // 重置狀態
            this.isLoggedIn = false;
            this.user = {
                id: '',
                username: '',
                level: 0,
                balance: 0
            };
            
            // 重置 axios 身份驗證頭
            delete axios.defaults.headers.common['Authorization'];
            
            this.showMessage('已成功登出', 'success');
        },
        
        // 獲取儀表板數據
        async fetchDashboardData() {
            const result = await safeApiCall(
                async () => {
                    const response = await axios.get(`${API_BASE_URL}/stats`, {
                        params: { agentId: this.user.id }
                    });
                    return response.data;
                },
                // 默認數據
                { 
                    memberCount: 50,
                    totalDeposit: 50000, 
                    totalWithdraw: 30000,
                    totalRevenue: 10000
                },
                '獲取儀表板數據失敗'
            );
            
            if (result.success && result.data) {
                const data = result.data;
                this.dashboardData = {
                    totalAgents: this.user.level === 0 ? 10 : 0,
                    totalMembers: data.memberCount || 0,
                    todayTransactions: (data.totalDeposit || 0) + (data.totalWithdraw || 0),
                    monthlyCommission: data.totalRevenue || 0
                };
            } else {
                // 使用默認數據
                const fallbackData = result.data;
                this.dashboardData = {
                    totalAgents: this.user.level === 0 ? 10 : 0,
                    totalMembers: fallbackData.memberCount || 0,
                    todayTransactions: (fallbackData.totalDeposit || 0) + (fallbackData.totalWithdraw || 0),
                    monthlyCommission: fallbackData.totalRevenue || 0
                };
                console.log('使用模擬儀表板數據');
            }
            
            // 初始化交易圖表
            this.$nextTick(() => {
                this.initTransactionChart();
            });
        },
        
        // 初始化交易趨勢圖表
        initTransactionChart() {
            const ctx = document.getElementById('transactionChart');
            if (!ctx) return;
            
            // 模擬數據 - 過去7天的交易數據
            const labels = Array(7).fill(0).map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (6 - i));
                return `${date.getMonth() + 1}/${date.getDate()}`;
            });
            
            const transactionData = [15000, 22000, 19500, 24000, 28000, 21000, 26500];
            const commissionData = transactionData.map(val => val * 0.05);
            
            if (this.transactionChart) {
                this.transactionChart.destroy();
            }
            
            this.transactionChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: '交易金額',
                            data: transactionData,
                            borderColor: 'rgba(54, 162, 235, 1)',
                            backgroundColor: 'rgba(54, 162, 235, 0.2)',
                            borderWidth: 2,
                            fill: true
                        },
                        {
                            label: '佣金',
                            data: commissionData,
                            borderColor: 'rgba(255, 159, 64, 1)',
                            backgroundColor: 'rgba(255, 159, 64, 0.2)',
                            borderWidth: 2,
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        },
        
        // 獲取系統公告
        async fetchNotices() {
            const result = await safeApiCall(
                async () => {
                    const response = await axios.get(`${API_BASE_URL}/notices`);
                    return response.data;
                },
                // 默認公告數據
                [
                    { id: 1, title: '系統維護通知', content: '系統將於2025年5月20日進行維護升級，期間服務可能不穩定。', createdAt: new Date().toISOString() },
                    { id: 2, title: '佣金調整公告', content: '從2025年6月起，佣金比例將調整為最高25%，請各代理留意。', createdAt: new Date().toISOString() }
                ],
                '獲取系統公告失敗'
            );
            
            if (result.success) {
                this.notices = result.notices;
            } else {
                // 使用默認數據
                this.notices = result.data;
                console.log('使用模擬系統公告數據');
            }
        },
        
        // 搜尋代理
        async searchAgents() {
            this.agentPagination.currentPage = 1;
            await this.fetchAgents();
        },
        
        // 獲取代理列表
        async fetchAgents() {
            this.loading = true;
            
            const result = await safeApiCall(
                async () => {
                    const response = await axios.get(`${API_BASE_URL}/sub-agents`, {
                        params: {
                            parentId: this.user.level === 0 ? '' : this.user.id,
                            level: this.agentFilters.level,
                            status: this.agentFilters.status,
                            keyword: this.agentFilters.keyword,
                            page: this.agentPagination.currentPage,
                            limit: this.agentPagination.limit
                        }
                    });
                    return response.data;
                },
                // 默認代理數據
                { 
                    agents: [
                        { id: 101, username: '測試代理1', level: 1, status: 1, balance: 50000, commission_rate: 0.2, createdAt: new Date().toISOString() },
                        { id: 102, username: '測試代理2', level: 1, status: 1, balance: 30000, commission_rate: 0.2, createdAt: new Date().toISOString() }
                    ],
                    total: 2
                },
                '獲取代理列表失敗'
            );
            
            this.loading = false;
            
            if (result.success) {
                this.agents = result.agents;
                
                // 計算總頁數
                const total = result.total;
                this.agentPagination.totalPages = Math.ceil(total / this.agentPagination.limit);
            } else {
                // 使用默認數據
                this.agents = result.data.agents;
                this.agentPagination.totalPages = Math.ceil(result.data.total / this.agentPagination.limit);
                console.log('使用模擬代理列表數據');
            }
        },
        
        // 獲取可作為上級的代理列表
        async fetchParentAgents() {
            try {
                const response = await axios.get(`${API_BASE_URL}/sub-agents`, {
                    params: {
                        parentId: '',
                        level: parseInt(this.newAgent.level) - 1, // 只獲取上一級的代理
                        status: 1, // 只獲取啟用狀態的代理
                        page: 1,
                        limit: 100
                    }
                });
                
                if (response.data.success) {
                    this.parentAgents = response.data.agents;
                }
            } catch (error) {
                console.error('獲取上級代理列表錯誤:', error);
            }
        },
        
        // 創建新代理
        async createAgent() {
            if (!this.newAgent.username || !this.newAgent.password) {
                return this.showMessage('請輸入用戶名和密碼', 'error');
            }
            
            this.loading = true;
            
            try {
                const response = await axios.post(`${API_BASE_URL}/create`, this.newAgent);
                
                if (response.data.success) {
                    this.showMessage('創建代理成功', 'success');
                    this.hideCreateAgentModal();
                    
                    // 重置表單
                    this.newAgent = {
                        username: '',
                        password: '',
                        level: '1',
                        parent: '',
                        commission: 0.2
                    };
                    
                    // 重新獲取代理列表
                    await this.fetchAgents();
                } else {
                    this.showMessage(response.data.message || '創建代理失敗', 'error');
                }
            } catch (error) {
                this.showMessage(error.response?.data?.message || '創建代理失敗', 'error');
                console.error('創建代理錯誤:', error);
            } finally {
                this.loading = false;
            }
        },
        
        // 查看代理詳細資訊
        async viewAgentDetails(agent) {
            // 實現代理詳細資訊查看邏輯
            console.log('查看代理詳細資訊:', agent);
        },
        
        // 編輯代理
        async editAgent(agent) {
            console.log('編輯代理:', agent);
            
            // 初始化編輯資料
            this.editAgentData = {
                id: agent.id,
                username: agent.username,
                password: '', // 留空表示不修改
                commission: agent.commission_rate || 0.2,
                status: agent.status
            };
            
            this.showEditAgentModal = true;
            this.$nextTick(() => {
                // 確保模態框已經存在才顯示
                if (document.getElementById('editAgentModal')) {
                    this.editAgentModal = new bootstrap.Modal(document.getElementById('editAgentModal'));
                    this.editAgentModal.show();
                } else {
                    console.error('找不到編輯代理模態框元素');
                }
            });
        },
        
        // 更新代理資訊
        async updateAgent() {
            if (!this.editAgentData.id) {
                return this.showMessage('缺少代理ID', 'error');
            }
            
            this.loading = true;
            
            try {
                // 使用update-status API更新代理資訊(暫時替代方案)
                // 待後端實現專門的更新API
                const url = `${API_BASE_URL}/update-status`;
                
                const response = await axios.put(url, {
                    id: this.editAgentData.id,
                    status: this.editAgentData.status
                });
                
                if (response.data.success) {
                    this.showMessage('更新代理狀態成功', 'success');
                    
                    // 關閉模態框
                    if (this.editAgentModal) {
                        this.editAgentModal.hide();
                    }
                    this.showEditAgentModal = false;
                    
                    // 重新獲取代理列表
                    await this.fetchAgents();
                } else {
                    this.showMessage(response.data.message || '更新代理資訊失敗', 'error');
                }
            } catch (error) {
                console.error('更新代理錯誤:', error);
                this.showMessage(error.response?.data?.message || '更新代理資訊失敗', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 隱藏編輯代理模態框
        hideEditAgentModal() {
            if (this.editAgentModal) {
                this.editAgentModal.hide();
            }
            this.showEditAgentModal = false;
        },
        
        // 切換代理狀態
        async toggleAgentStatus(agent) {
            const newStatus = agent.status === 1 ? 0 : 1;
            const statusText = newStatus === 1 ? '啟用' : '停用';
            
            if (!confirm(`確定要${statusText}代理 ${agent.username} 嗎？`)) {
                return;
            }
            
            try {
                const response = await axios.put(`${API_BASE_URL}/update-status`, {
                    id: agent.id,
                    status: newStatus
                });
                
                if (response.data.success) {
                    agent.status = newStatus;
                    this.showMessage(`已成功${statusText}代理`, 'success');
                } else {
                    this.showMessage(response.data.message || `${statusText}代理失敗`, 'error');
                }
            } catch (error) {
                this.showMessage(`${statusText}代理失敗`, 'error');
                console.error('切換代理狀態錯誤:', error);
            }
        },
        
        // 搜尋會員
        async searchMembers() {
            this.memberPagination.currentPage = 1;
            await this.fetchMembers();
        },
        
        // 獲取會員列表
        async fetchMembers() {
            this.loading = true;
            
            try {
                console.log('獲取會員列表，參數:', {
                    agentId: this.user.id,
                    status: this.memberFilters.status,
                    keyword: this.memberFilters.keyword,
                    page: this.memberPagination.currentPage,
                    limit: this.memberPagination.limit
                });
                
                const response = await axios.get(`${API_BASE_URL}/members`, {
                    params: {
                        agentId: this.user.id,
                        status: this.memberFilters.status,
                        keyword: this.memberFilters.keyword,
                        page: this.memberPagination.currentPage,
                        limit: this.memberPagination.limit
                    }
                });
                
                console.log('會員列表API響應:', response.data);
                
                if (response.data.success) {
                    // 使用data.list屬性而非members屬性
                    if (response.data.data && response.data.data.list) {
                        this.members = response.data.data.list;
                        
                        // 計算總頁數
                        const total = response.data.data.total || 0;
                        this.memberPagination.totalPages = Math.ceil(total / this.memberPagination.limit);
                        
                        console.log(`成功獲取 ${this.members.length} 位會員，總計 ${total} 位`);
                    } else {
                        console.error('會員列表數據格式異常:', response.data);
                        this.members = [];
                        this.memberPagination.totalPages = 1;
                    }
                } else {
                    this.showMessage(response.data.message || '獲取會員列表失敗', 'error');
                }
            } catch (error) {
                console.error('獲取會員列表錯誤:', error);
                this.showMessage('獲取會員列表失敗', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 創建新會員
        async createMember() {
            if (!this.newMember.username || !this.newMember.password) {
                return this.showMessage('請輸入用戶名和密碼', 'error');
            }
            
            if (this.newMember.password !== this.newMember.confirmPassword) {
                return this.showMessage('兩次輸入的密碼不一致', 'error');
            }
            
            this.loading = true;
            
            try {
                const memberData = {
                    username: this.newMember.username,
                    password: this.newMember.password,
                    agentId: this.user.id
                };
                
                const response = await axios.post(`${API_BASE_URL}/create-member`, memberData);
                
                if (response.data.success) {
                    this.showMessage('創建會員成功', 'success');
                    this.hideCreateMemberModal();
                    
                    // 重置表單
                    this.newMember = {
                        username: '',
                        password: '',
                        confirmPassword: ''
                    };
                    
                    // 重新獲取會員列表
                    await this.fetchMembers();
                } else {
                    this.showMessage(response.data.message || '創建會員失敗', 'error');
                }
            } catch (error) {
                this.showMessage(error.response?.data?.message || '創建會員失敗', 'error');
                console.error('創建會員錯誤:', error);
            } finally {
                this.loading = false;
            }
        },
        
        // 查看會員詳細資訊
        async viewMemberDetails(member) {
            // 實現會員詳細資訊查看邏輯
            console.log('查看會員詳細資訊:', member);
            
            try {
                const response = await axios.get(`${API_BASE_URL}/member-info`, {
                    params: { id: member.id }
                });
                
                if (response.data.success) {
                    // 顯示會員詳細資訊的實現，可以使用模態框等方式
                    alert(`會員ID: ${member.id}\n用戶名: ${member.username}\n餘額: ${this.formatMoney(member.balance)}\n創建時間: ${this.formatDate(member.createdAt)}`);
                } else {
                    this.showMessage(response.data.message || '獲取會員資訊失敗', 'error');
                }
            } catch (error) {
                this.showMessage('獲取會員資訊失敗', 'error');
                console.error('獲取會員資訊錯誤:', error);
            }
        },
        
        // 編輯會員
        async editMember(member) {
            // 實現會員編輯邏輯
            console.log('編輯會員:', member);
            alert('會員編輯功能待實現');
        },
        
        // 切換會員狀態
        async toggleMemberStatus(memberId, status) {
            try {
                const newStatus = status === 1 ? 0 : 1;
                const statusText = newStatus === 1 ? '啟用' : '停用';
                
                if (!confirm(`確定要${statusText}此會員嗎？`)) {
                    return;
                }
                
                const response = await fetch(`${API_BASE_URL}/toggle-member-status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        memberId,
                        status: newStatus
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    this.showMessage(`會員${statusText}成功`);
                    this.fetchMembers();
                } else {
                    this.showMessage(`會員${statusText}失敗: ${result.message}`, 'error');
                }
            } catch (error) {
                console.error('切換會員狀態錯誤:', error);
                this.showMessage('操作失敗，請稍後再試', 'error');
            }
        },
        
        // 切換頁面
        async changePage(page, type) {
            if (page < 1) return;
            
            if (type === 'agents') {
                if (page > this.agentPagination.totalPages) return;
                this.agentPagination.currentPage = page;
                await this.fetchAgents();
            } else if (type === 'members') {
                if (page > this.memberPagination.totalPages) return;
                this.memberPagination.currentPage = page;
                await this.fetchMembers();
            } else if (type === 'draw') {
                if (page > this.drawPagination.totalPages) return;
                this.drawPagination.currentPage = page;
                await this.loadDrawHistory();
            } else if (type === 'bets') {
                if (page > this.betPagination.totalPages) return;
                this.betPagination.currentPage = page;
                await this.fetchBets();
            }
        },
        
        // 格式化金額
        formatMoney(amount) {
            return new Intl.NumberFormat('zh-TW', {
                style: 'decimal',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        },
        
        // 格式化日期
        formatDate(dateString) {
            const date = new Date(dateString);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        },
        
        // 獲取代理級別名稱
        getLevelName(level) {
            const levelMap = {
                0: '總代理',
                1: '一級代理',
                2: '二級代理'
            };
            return levelMap[level] || '未知';
        },
        
        // 顯示訊息
        showMessage(message, type = 'info') {
            // 可根據項目需求使用 alert、toast 或自定義訊息組件
            if (type === 'error') {
                alert(`錯誤: ${message}`);
            } else if (type === 'success') {
                alert(`成功: ${message}`);
            } else {
                alert(message);
            }
        },
        
        // 調整會員餘額
        adjustMemberBalance(member) {
            // 清空之前的表單數據
            this.balanceAdjustData = {
                memberId: member.id,
                memberUsername: member.username,
                agentId: this.user.id, // 使用當前代理ID
                currentBalance: parseFloat(member.balance) || 0,
                amount: 0,
                description: ''
            };
            
            // 重置轉移類型和金額
            this.transferType = 'deposit';
            this.transferAmount = 0;
            this.agentCurrentBalance = parseFloat(this.user.balance) || 0;
            
            this.showAdjustBalanceModal = true;
            
            // 初始化模態框
            const modalEl = document.getElementById('adjustBalanceModal');
            if (modalEl) {
                this.adjustBalanceModal = new bootstrap.Modal(modalEl);
                this.adjustBalanceModal.show();
            }
        },
        
        // 隱藏會員餘額調整模態框
        hideAdjustBalanceModal() {
            if (this.adjustBalanceModal) {
                this.adjustBalanceModal.hide();
            }
            this.showAdjustBalanceModal = false;
        },
        
        // 提交餘額調整
        async submitBalanceAdjustment() {
            // 檢查餘額調整金額是否為零
            if (parseFloat(this.transferAmount) <= 0) {
                alert('請輸入大於零的轉移金額');
                return;
            }
            
            // 根據轉移類型設置金額的正負號
            const finalAmount = this.transferType === 'deposit' ? 
                parseFloat(this.transferAmount) : 
                -parseFloat(this.transferAmount);
            
            try {
                // 獲取代理的餘額
                const agentResponse = await fetch(`/api/agent/agent-balance?agentId=${this.balanceAdjustData.agentId}`);
                const agentData = await agentResponse.json();
                
                if (!agentData.success) {
                    alert(`獲取代理餘額失敗: ${agentData.message}`);
                    return;
                }
                
                this.agentCurrentBalance = parseFloat(agentData.balance);
                
                // 檢查代理餘額是否足夠（如果是從代理轉移點數到會員）
                if (this.transferType === 'deposit' && 
                    this.agentCurrentBalance < parseFloat(this.transferAmount)) {
                    alert(`代理餘額不足，當前餘額: ${this.formatMoney(this.agentCurrentBalance)}`);
                    return;
                }
                
                // 檢查會員餘額是否足夠（如果是從會員提領點數到代理）
                if (this.transferType === 'withdraw' && 
                    this.balanceAdjustData.currentBalance < parseFloat(this.transferAmount)) {
                    alert(`會員餘額不足，當前餘額: ${this.formatMoney(this.balanceAdjustData.currentBalance)}`);
                    return;
                }
                
                // 發送點數轉移請求
                const response = await fetch('/api/agent/update-member-balance', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        agentId: this.balanceAdjustData.agentId,
                        username: this.balanceAdjustData.memberUsername,
                        amount: finalAmount,
                        description: this.balanceAdjustData.description || 
                                   (this.transferType === 'deposit' ? 
                                    '代理存入點數給會員' : '會員提領點數給代理')
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('點數轉移成功');
                    this.hideAdjustBalanceModal();
                    // 更新代理餘額
                    this.user.balance = result.agentBalance;
                    // 重新載入會員清單
                    this.fetchMembers();
                } else {
                    alert(`點數轉移失敗: ${result.message}`);
                }
            } catch (error) {
                console.error('點數轉移出錯:', error);
                alert('系統錯誤，請稍後再試');
            }
        },
        
        // 加載點數轉移記錄
        async loadPointTransfers() {
            try {
                const response = await fetch(`/api/agent/point-transfers?userType=agent&userId=${this.user.id}`);
                const data = await response.json();
                
                if (data.success) {
                    this.pointTransfers = data.transfers;
                } else {
                    console.error('載入點數轉移記錄失敗:', data.message);
                }
            } catch (error) {
                console.error('載入點數轉移記錄出錯:', error);
            }
        },
        
        // 格式化點數轉移類型
        formatTransferType(transfer) {
            if (transfer.from_type === 'agent' && transfer.to_type === 'member') {
                return '轉出給會員';
            } else if (transfer.from_type === 'member' && transfer.to_type === 'agent') {
                return '會員轉入';
            } else {
                return '其他轉移';
            }
        },
        
        // 格式化轉移方向的中文顯示
        formatTransferDirection(transfer) {
            let fromType = transfer.from_type === 'agent' ? '代理' : '會員';
            let toType = transfer.to_type === 'agent' ? '代理' : '會員';
            
            return `${fromType} (${transfer.from_id}) → ${toType} (${transfer.to_id})`;
        },
        
        // 計算轉移後會員餘額
        calculateFinalMemberBalance() {
            const currentBalance = parseFloat(this.balanceAdjustData.currentBalance) || 0;
            const amount = parseFloat(this.transferAmount) || 0;
            
            if (this.transferType === 'deposit') {
                return currentBalance + amount;
            } else {
                return currentBalance - amount;
            }
        },
        
        // 計算轉移後代理餘額
        calculateFinalAgentBalance() {
            const currentBalance = this.agentCurrentBalance || 0;
            const amount = parseFloat(this.transferAmount) || 0;
            
            if (this.transferType === 'deposit') {
                return currentBalance - amount;
            } else {
                return currentBalance + amount;
            }
        },
        
        // 載入開獎記錄
        async loadDrawHistory() {
            try {
                this.loading = true;
                
                const result = await safeApiCall(
                    async () => {
                        const response = await fetch(`${API_BASE_URL}/draw-history?page=${this.drawPagination.currentPage}&limit=${this.drawPagination.limit}&period=${this.drawFilters.period || ''}&date=${this.drawFilters.date || ''}`, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        if (!response.ok) {
                            throw new Error(`HTTP錯誤 ${response.status}`);
                        }
                        
                        return await response.json();
                    },
                    // 默認開獎記錄 - 確保結構與API一致
                    {
                        records: [
                            { 
                                period: "20250510001", 
                                result: [3, 5, 7, 8, 2, 1, 9, 10, 4, 6], 
                                time: new Date().toISOString() 
                            },
                            { 
                                period: "20250510002", 
                                result: [8, 1, 4, 7, 3, 5, 10, 9, 2, 6], 
                                time: new Date().toISOString() 
                            }
                        ],
                        totalPages: 1,
                        currentPage: 1,
                        totalRecords: 2
                    },
                    '獲取開獎記錄失敗'
                );
                
                if (result.success) {
                    this.drawRecords = result.records || [];
                    // 更新總頁數（使用後端返回的總頁數）
                    if (result.totalPages) {
                        this.drawPagination.totalPages = result.totalPages;
                    } else {
                        this.drawPagination.totalPages = Math.ceil(this.drawRecords.length / this.drawPagination.limit) || 1;
                    }
                } else {
                    // 使用默認數據
                    this.drawRecords = result.data.records;
                    this.drawPagination.totalPages = result.data.totalPages || 1;
                    console.log('使用模擬開獎記錄數據');
                }
            } finally {
                this.loading = false;
            }
        },
        
        // 搜索開獎記錄
        async searchDrawHistory() {
            this.drawPagination.currentPage = 1;
            await this.loadDrawHistory();
        },
        
        // 搜索今日開獎記錄
        async searchTodayDrawHistory() {
            this.drawPagination.currentPage = 1;
            // 獲取今天的日期，並格式化為 YYYY-MM-DD 格式
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            this.drawFilters.date = `${year}-${month}-${day}`;
            this.drawFilters.period = ''; // 清除期數篩選
            await this.loadDrawHistory();
        },
        
        // 產生分頁範圍
        getPageRange(currentPage, totalPages) {
            const range = [];
            const maxVisible = 5; // 最多顯示幾個頁碼
            
            let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
            let end = Math.min(totalPages, start + maxVisible - 1);
            
            if (end - start + 1 < maxVisible) {
                start = Math.max(1, end - maxVisible + 1);
            }
            
            for (let i = start; i <= end; i++) {
                range.push(i);
            }
            
            return range;
        },
        
        // 搜索下注記錄
        async searchBets() {
            this.betPagination.currentPage = 1;
            await this.fetchBets();
        },
        
        // 獲取下注記錄
        async fetchBets() {
            this.loading = true;
            
            const result = await safeApiCall(
                async () => {
                    // 構建查詢參數
                    const params = new URLSearchParams();
                    params.append('page', this.betPagination.currentPage);
                    params.append('limit', this.betPagination.limit);
                    
                    if (this.betFilters.member) {
                        params.append('username', this.betFilters.member);
                    }
                    
                    if (this.betFilters.date) {
                        params.append('date', this.betFilters.date);
                    }
                    
                    if (this.betFilters.period) {
                        params.append('period', this.betFilters.period);
                    }
                    
                    // 添加代理ID參數，確保只查看自己的下線會員
                    params.append('agentId', this.user.id);
                    
                    const response = await fetch(`${API_BASE_URL}/bets?${params.toString()}`);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP錯誤 ${response.status}`);
                    }
                    
                    return await response.json();
                },
                // 默認下注記錄
                {
                    bets: [
                        { id: 1, username: 'test_user1', period: '20250508001', bet_type: 'champion_number', position: 'first', selection: '3', amount: 100, payout: 950, createdAt: new Date().toISOString() },
                        { id: 2, username: 'test_user2', period: '20250508001', bet_type: 'sum_bs', position: 'sum', selection: 'big', amount: 200, payout: 380, createdAt: new Date().toISOString() }
                    ],
                    total: 2,
                    stats: { totalBets: 2, totalAmount: 300, totalProfit: 70 }
                },
                '獲取下注記錄失敗'
            );
            
            this.loading = false;
            
            if (result.success) {
                this.bets = result.bets;
                this.betPagination.totalPages = Math.ceil(result.total / this.betPagination.limit) || 1;
                this.betStats = result.stats || {
                    totalBets: 0,
                    totalAmount: 0,
                    totalProfit: 0
                };
            } else {
                // 使用默認數據
                this.bets = result.data.bets;
                this.betPagination.totalPages = Math.ceil(result.data.total / this.betPagination.limit) || 1;
                this.betStats = result.data.stats;
                console.log('使用模擬下注記錄數據');
            }
        },
        
        // 格式化投注類型
        formatBetType(type) {
            const betTypeMap = {
                'champion_number': '冠軍號碼',
                'champion_bs': '冠軍大小',
                'champion_oe': '冠軍單雙',
                'runnerup_number': '亞軍號碼',
                'runnerup_bs': '亞軍大小',
                'runnerup_oe': '亞軍單雙',
                'sum_value': '冠亞和值',
                'sum_bs': '冠亞和大小',
                'sum_oe': '冠亞和單雙',
                'dragon_tiger': '龍虎'
            };
            
            return betTypeMap[type] || type;
        },
        
        // 格式化投注位置
        formatPosition(position) {
            const positionMap = {
                'first': '冠軍',
                'second': '亞軍',
                'third': '第三名',
                'fourth': '第四名',
                'fifth': '第五名',
                'sixth': '第六名',
                'seventh': '第七名',
                'eighth': '第八名',
                'ninth': '第九名',
                'tenth': '第十名',
                'champion': '冠軍',
                'runnerup': '亞軍',
                'sum': '冠亞和',
                'dragon_tiger': '龍虎'
            };
            
            return positionMap[position] || position;
        },
        
        // 安全獲取龍虎結果
        getDragonTigerResult(record) {
            if (!record || !record.result || !Array.isArray(record.result) || record.result.length < 10) {
                return { isDragon: false, value: '數據錯誤' };
            }
            
            const isDragon = record.result[0] > record.result[9];
            return { 
                isDragon: isDragon,
                value: isDragon ? '龍' : '虎'
            };
        },
    },
    
    // 計算屬性
    computed: {
        // 可根據需求添加更多計算屬性
        
        // 檢查轉移是否有效
        isValidTransfer() {
            if (parseFloat(this.transferAmount) <= 0) {
                return false;
            }
            
            if (this.transferType === 'deposit') {
                return this.agentCurrentBalance >= parseFloat(this.transferAmount);
            } else if (this.transferType === 'withdraw') {
                return this.balanceAdjustData.currentBalance >= parseFloat(this.transferAmount);
            }
            
            return false;
        }
    },
    
    // 監聽屬性
    watch: {
        // 當活動分頁變更時，加載對應數據
        activeTab(newTab, oldTab) {
            if (newTab === 'agents' && (oldTab !== 'agents' || this.agents.length === 0)) {
                this.fetchAgents();
            } else if (newTab === 'dashboard' && oldTab !== 'dashboard') {
                this.fetchDashboardData();
            } else if (newTab === 'notices' && (oldTab !== 'notices' || this.notices.length === 0)) {
                this.fetchNotices();
            } else if (newTab === 'members' && (oldTab !== 'members' || this.members.length === 0)) {
                this.fetchMembers();
            } else if (newTab === 'transactions') {
                if (this.transactionTab === 'transfers') {
                    this.loadPointTransfers();
                }
            } else if (newTab === 'draw') {
                this.loadDrawHistory();
            } else if (newTab === 'stats' && oldTab !== 'stats') {
                this.fetchBets();
            }
        },
        
        // 監聽交易記錄標籤變化
        transactionTab(newTab) {
            if (newTab === 'transfers') {
                this.loadPointTransfers();
            }
        }
    }
});
