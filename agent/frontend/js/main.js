// filepath: /Users/justin/Desktop/Bet/agent/frontend/js/main.js
// 代理管理系統前端 JavaScript 檔案
// 最後更新：2025-05-10

// API 基礎 URL - 根據環境調整
let API_BASE_URL;

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // 本地開發環境 - 代理系統運行在3003端口
    API_BASE_URL = 'http://localhost:3003/api/agent';
} else {
    // Render 生產環境 - 不使用端口號，讓Render處理路由
    API_BASE_URL = 'https://bet-agent.onrender.com/api/agent';
}

// 添加調試信息
console.log('當前API基礎URL:', API_BASE_URL, '主機名:', window.location.hostname);

// API請求通用配置
const API_CONFIG = {
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
};

console.log('開始初始化Vue應用');
console.log('Vue是否可用:', typeof Vue);

if (typeof Vue === 'undefined') {
    console.error('Vue未定義！請檢查Vue腳本是否正確加載。');
    alert('Vue未定義！請檢查Vue腳本是否正確加載。');
    throw new Error('Vue未定義');
}

const { createApp } = Vue;
console.log('createApp是否可用:', typeof createApp);

const app = createApp({
    data() {
        return {
            // 將API_BASE_URL添加到Vue實例的data中，使模板可以訪問
            API_BASE_URL: API_BASE_URL,
            
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
                id: null,
                username: '',
                level: 0,
                balance: 0
            },
            
            // 系統公告
            notices: [],
            noticeCategories: [],
            selectedNoticeCategory: 'all',
            
            // 公告表單相關
            showNoticeForm: false,
            editingNoticeId: null,
            noticeForm: {
                title: '',
                content: '',
                category: '最新公告'
            },
            
            // 當前活動分頁
            activeTab: 'dashboard',
            transactionTab: 'transfers',
            
            // 儀表板數據
            dashboardData: {
                totalDeposit: 0,
                totalWithdraw: 0,
                totalRevenue: 0,
                totalTransactions: 0,
                memberCount: 0,
                activeMembers: 0,
                subAgentsCount: 0
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
                rebate_mode: 'percentage',
                rebate_percentage: 2.0
            },
            parentAgents: [],
            
            // 代理層級導航相關
            agentBreadcrumbs: [],
            currentManagingAgent: {
                id: null,
                username: '',
                level: 0,
                max_rebate_percentage: 0.041
            },
            
            // 退水設定相關
            showRebateModal: false,
            rebateAgent: {
                id: null,
                username: '',
                rebate_mode: '',
                rebate_percentage: 0,
                max_rebate_percentage: 0
            },
            rebateSettings: {
                rebate_mode: '',
                rebate_percentage: 0
            },
            
            // 編輯代理相關
            showEditAgentModal: false,
            editAgentData: {
                id: '',
                username: '',
                password: '',
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
                confirmPassword: '',
                balance: 0,
                status: 1
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
            transferType: 'deposit',
            transferAmount: 0,
            agentCurrentBalance: 0,
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
                period: '',
                viewScope: 'own', // 'own', 'downline', 'specific'
                specificAgent: ''
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
            
            // 代理線管理相關
            allDownlineAgents: [], // 所有下級代理
            availableMembers: [], // 當前可用的會員列表
            
            // 會員餘額修改相關
            modifyBalanceData: {
                memberId: null,
                memberUsername: '',
                currentBalance: 0,
                reason: ''
            },
            modifyBalanceType: 'absolute', // 'absolute' 或 'relative'
            modifyBalanceAmount: 0,
            balanceChangeDirection: 'increase', // 'increase' 或 'decrease'
            modifyMemberBalanceModal: null,
            
            // 代理餘額修改相關
            agentBalanceData: {
                agentId: null,
                agentUsername: '',
                currentBalance: 0,
                reason: '',
                description: '' // 新增: 點數轉移備註
            },
            agentModifyType: 'absolute', // 'absolute' 或 'relative'
            agentModifyAmount: 0,
            agentChangeDirection: 'increase', // 'increase' 或 'decrease'
            adjustAgentBalanceModal: null,
            
            // 新增: 代理點數轉移相關變量
            agentTransferType: 'deposit', // 'deposit' 或 'withdraw'
            agentTransferAmount: 0,

            // 客服專用數據
            isCustomerService: true, // 是否為客服 - 臨時設為 true 用於測試
            showCSOperationModal: false, // 客服操作模態框
            csOperation: {
                targetAgentId: '',
                operationTarget: '', // 'agent' 或 'member'
                targetMemberId: '',
                transferType: '', // 'deposit' 或 'withdraw'
                amount: '',
                description: ''
            },
            csTransactions: [], // 客服交易記錄
            csTransactionFilters: {
                userType: 'all',
                transactionType: 'all'
            },
            csTransactionsPagination: {
                page: 1,
                limit: 20,
                total: 0
            },
            allAgents: [], // 所有代理列表（供客服選擇）
            agentMembers: [], // 選中代理的會員列表
            csOperationModal: null, // 客服操作模態框
            
            // 存款記錄
            depositRecords: [],
            depositPagination: {
                page: 1,
                limit: 20,
                total: 0
            },
            
            // 提款記錄
            withdrawRecords: [],
            withdrawPagination: {
                page: 1,
                limit: 20,
                total: 0
            },
            
            // 重設密碼數據
            resetPasswordData: {
                userType: '', // 'agent' 或 'member'
                userId: null,
                username: '',
                newPassword: '',
                confirmPassword: ''
            },
            
            // 個人資料數據
            profileData: {
                realName: '',
                phone: '',
                email: '',
                lineId: '',
                telegram: '',
                address: '',
                remark: ''
            },
            
            // 顯示用的用戶信息
            displayUsername: '載入中...',
            displayUserLevel: '載入中...',
            // 個人資料儲存專用載入狀態
            profileLoading: false,
            // 控制個人資料 modal 顯示
            isProfileModalVisible: false,
        };
    },
    
    // 頁面載入時自動執行
    async mounted() {
        console.log('Vue應用已掛載');
        console.log('初始數據檢查:', {
            noticeForm: this.noticeForm,
            showNoticeForm: this.showNoticeForm,
            isCustomerService: this.isCustomerService
        });
        
        // 測試模板插值功能
        this.$nextTick(() => {
            console.log('nextTick 檢查模板數據:', {
                'noticeForm.title': this.noticeForm.title,
                'noticeForm.title.length': this.noticeForm.title.length,
                'noticeForm.content.length': this.noticeForm.content.length
            });
        });
        
        // 檢查是否已登入
        const isAuthenticated = await this.checkAuth();
        
        if (isAuthenticated) {
            console.log('用戶已認證，開始加載初始數據');
            // 檢查是否為客服
            this.isCustomerService = this.user.level === 0;
            console.log('是否為客服:', this.isCustomerService);
            
            // 如果是客服，加載所有代理列表
            if (this.isCustomerService) {
                await this.loadAllAgents();
            }
            
            // 獲取初始數據
            await Promise.all([
                this.fetchDashboardData(),
                this.fetchNotices()
            ]);
            
            // 獲取代理現有的點數餘額
            console.log('嘗試獲取代理餘額，代理ID:', this.user.id);
            try {
                // 修改API路徑格式，使其與後端一致
                const response = await axios.get(`${API_BASE_URL}/agent-balance?agentId=${this.user.id}`);
                if (response.data.success) {
                    console.log('代理當前額度:', response.data.balance);
                    this.user.balance = response.data.balance;
                }
            } catch (error) {
                console.error('獲取代理額度錯誤:', error);
                // 遇到錯誤時嘗試備用API格式
                try {
                    console.log('嘗試備用API路徑獲取代理餘額');
                    const fallbackResponse = await axios.get(`${API_BASE_URL}/agent/${this.user.id}`);
                    if (fallbackResponse.data.success) {
                        console.log('備用API路徑獲取代理額度成功:', fallbackResponse.data.agent?.balance);
                        this.user.balance = fallbackResponse.data.agent?.balance || 0;
                    }
                } catch (fallbackError) {
                    console.error('備用API路徑獲取代理額度也失敗:', fallbackError);
                }
            }
        } else {
            console.log('用戶未認證，顯示登入表單');
        }
        
        // 初始化模態框
        this.$nextTick(() => {
            this.initModals();
        });
    },
    
    methods: {
        // 初始化 Bootstrap 5 模態框
        initModals() {
            console.log('初始化所有模態框');
            
            // 初始化創建代理模態框
            const createAgentModalEl = document.getElementById('createAgentModal');
            if (createAgentModalEl) {
                console.log('初始化創建代理模態框');
                this.agentModal = new bootstrap.Modal(createAgentModalEl);
            }
            
            // 初始化創建會員模態框
            const createMemberModalEl = document.getElementById('createMemberModal');
            if (createMemberModalEl) {
                console.log('初始化創建會員模態框');
                this.memberModal = new bootstrap.Modal(createMemberModalEl);
            }
            
            // 初始化會員餘額調整模態框
            const adjustBalanceModalEl = document.getElementById('adjustBalanceModal');
            if (adjustBalanceModalEl) {
                console.log('初始化會員餘額調整模態框');
                this.adjustBalanceModal = new bootstrap.Modal(adjustBalanceModalEl);
            }
            
            // 初始化代理餘額調整模態框
            const adjustAgentBalanceModalEl = document.getElementById('adjustAgentBalanceModal');
            if (adjustAgentBalanceModalEl) {
                console.log('初始化代理餘額調整模態框');
                this.adjustAgentBalanceModal = new bootstrap.Modal(adjustAgentBalanceModalEl);
            }
            
            // 初始化修改會員餘額模態框
            const modifyMemberBalanceModalEl = document.getElementById('modifyMemberBalanceModal');
            if (modifyMemberBalanceModalEl) {
                console.log('初始化修改會員餘額模態框');
                this.modifyMemberBalanceModal = new bootstrap.Modal(modifyMemberBalanceModalEl);
            }
            
            // 初始化客服操作模態框
            const csOperationModalEl = document.getElementById('csOperationModal');
            if (csOperationModalEl) {
                console.log('初始化客服操作模態框');
                this.csOperationModal = new bootstrap.Modal(csOperationModalEl);
                
                // 監聽模態框隱藏事件，重置表單
                csOperationModalEl.addEventListener('hidden.bs.modal', () => {
                    this.hideCSOperationModal();
                });
            }
        },
        
        // 顯示創建代理模態框
        showAgentModal() {
            this.showCreateAgentModal = true;
            
            // 根據當前管理代理級別，設置默認的下級代理級別
            this.newAgent = {
                username: '',
                password: '',
                level: (this.currentManagingAgent.level + 1).toString(),
                parent: this.currentManagingAgent.id,
                rebate_mode: 'percentage',
                rebate_percentage: 2.0
            };
            
            this.$nextTick(() => {
                // 確保模態框元素已經被渲染到DOM後再初始化和顯示
                const modalEl = document.getElementById('createAgentModal');
                if (modalEl) {
                    this.agentModal = new bootstrap.Modal(modalEl);
                    this.agentModal.show();
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
        
        // 顯示新增會員模態框 - 重定向到統一函數
        showMemberModal() {
            console.log('showMemberModal 已棄用，重定向到 quickCreateMember');
            this.quickCreateMember();
        },
        
        // 快速新增會員 - 專為會員管理頁面和下級代理管理設計
        quickCreateMember() {
            console.log('快速新增會員啟動');
            console.log('當前狀態:');
            console.log('- activeTab:', this.activeTab);
            console.log('- currentManagingAgent:', this.currentManagingAgent);
            console.log('- agentBreadcrumbs:', this.agentBreadcrumbs);
            console.log('- user:', this.user);
            
            // 重置表單
            this.newMember = { 
                username: '', 
                password: '', 
                confirmPassword: '',
                balance: 0,
                status: 1
            };
            
            // 根據當前頁面和狀態確定管理代理
            let targetAgent = null;
            
            if (this.activeTab === 'agents' && this.agentBreadcrumbs.length > 0) {
                // 在下級代理管理頁面，為當前查看的代理新增會員
                targetAgent = this.currentManagingAgent;
                console.log('下級代理管理模式：為代理', targetAgent?.username, '新增會員');
            } else if (this.activeTab === 'members') {
                // 在會員管理頁面，為自己新增會員
                targetAgent = {
                    id: this.user.id,
                    username: this.user.username,
                    level: this.user.level,
                    max_rebate_percentage: this.user.max_rebate_percentage || 0.041
                };
                console.log('👤 會員管理模式：為自己新增會員');
            } else {
                // 預設情況：為自己新增會員
                targetAgent = {
                    id: this.user.id,
                    username: this.user.username,
                    level: this.user.level,
                    max_rebate_percentage: this.user.max_rebate_percentage || 0.041
                };
                console.log('🔄 預設模式：為自己新增會員');
            }
            
            if (!targetAgent || !targetAgent.id) {
                console.error('❌ 無法確定目標代理');
                this.showMessage('無法確定代理信息，請重新整理頁面', 'error');
                return;
            }
            
            // 設置當前管理代理
            this.currentManagingAgent = targetAgent;
            console.log('✅ 設置目標代理:', this.currentManagingAgent);
            
            // 直接顯示模態框
            this.showCreateMemberModal = true;
            
            // 立即確保模態框可見
            this.$nextTick(() => {
                setTimeout(() => {
                    const modal = document.getElementById('createMemberModal');
                    if (modal) {
                        modal.style.display = 'flex';
                        modal.style.zIndex = '10000';
                        console.log('✅ 快速新增會員模態框已顯示');
                        
                        // 自動聚焦到用戶名輸入框
                        const usernameInput = modal.querySelector('input[type="text"]');
                        if (usernameInput) {
                            usernameInput.focus();
                        }
                        
                        // 滾動到視窗中央
                        modal.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } else {
                        console.error('❌ 快速新增：找不到模態框DOM');
                        this.showMessage('新增會員視窗載入失敗', 'error');
                        
                        // 嘗試重新渲染
                        this.$forceUpdate();
                        setTimeout(() => {
                            const retryModal = document.getElementById('createMemberModal');
                            if (retryModal) {
                                retryModal.style.display = 'flex';
                                retryModal.style.zIndex = '10000';
                                console.log('✅ 重試成功顯示模態框');
                            } else {
                                console.error('❌ 重試失敗，模態框仍然無法顯示');
                            }
                        }, 200);
                    }
                }, 100);
            });
        },
        
        // 隱藏創建會員模態框 - 完全重新實現
        hideCreateMemberModal() {
            console.log('🚫 關閉新增會員模態框');
            
            // 直接隱藏模態框
            this.showCreateMemberModal = false;
            
            // 重置表單數據
            this.newMember = { 
                username: '', 
                password: '', 
                confirmPassword: '',
                balance: 0,
                status: 1
            };
            
            // 清除任何內聯樣式
            setTimeout(() => {
                const modal = document.getElementById('createMemberModal');
                if (modal) {
                    modal.style.display = '';
                    modal.style.zIndex = '';
                }
            }, 50);
            
            console.log('✅ 模態框已關閉，數據已重置');
        },
        

        
        // 設置活動標籤並關閉漢堡選單
        setActiveTab(tab) {
            console.log('🔄 切換頁籤到:', tab);
            
            // 如果不是在代理管理頁面，重置當前管理代理為自己
            if (tab !== 'agents') {
                if (this.currentManagingAgent.id !== this.user.id) {
                    console.log('📍 重置管理視角：從', this.currentManagingAgent.username, '回到', this.user.username);
                    this.currentManagingAgent = {
                        id: this.user.id,
                        username: this.user.username,
                        level: this.user.level,
                        max_rebate_percentage: this.user.max_rebate_percentage || 0.041
                    };
                    
                    // 清空代理導航面包屑
                    this.agentBreadcrumbs = [];
                    
                    // 如果切換到會員管理或下注記錄，重新載入相關數據
                    if (tab === 'members') {
                        this.searchMembers();
                    } else if (tab === 'bets') {
                        this.searchBets();
                    }
                }
            }
            
            this.activeTab = tab;
            
            // 關閉Bootstrap漢堡選單
            const navbarCollapse = document.getElementById('navbarNav');
            if (navbarCollapse && navbarCollapse.classList.contains('show')) {
                const bsCollapse = new bootstrap.Collapse(navbarCollapse, {
                    toggle: false
                });
                bsCollapse.hide();
            }
        },
        
        // 檢查身份驗證狀態
        async checkAuth() {
            const token = localStorage.getItem('agent_token');
            const userStr = localStorage.getItem('agent_user');
            console.log('檢查認證，localStorage中的user字符串:', userStr);
            
            if (!userStr || !token) {
                console.log('認證失敗，缺少token或user數據');
                return false;
            }
            
            try {
                const user = JSON.parse(userStr);
                console.log('解析後的user對象:', user);
                
                if (user && user.id) {
                    this.isLoggedIn = true;
                    this.user = user;
                    console.log('設置user對象成功:', this.user);
                    
                    // 初始化當前管理代理為自己
                    this.currentManagingAgent = {
                        id: this.user.id,
                        username: this.user.username,
                        level: this.user.level,
                        max_rebate_percentage: this.user.max_rebate_percentage || 0.041
                    };
                    
                    // 設置 axios 身份驗證頭
                    axios.defaults.headers.common['Authorization'] = token;
                    
                    // 強制Vue更新
                    this.$forceUpdate();
                    return true;
                }
            } catch (error) {
                console.error('解析用戶數據失敗:', error);
                // 清除損壞的數據
                localStorage.removeItem('agent_token');
                localStorage.removeItem('agent_user');
            }
            
            console.log('認證失敗');
            return false;
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
                    
                    // 檢查是否為客服
                    this.isCustomerService = this.user.level === 0;
                    console.log('登入後是否為客服:', this.isCustomerService, '用戶級別:', this.user.level);
                    
                    // 如果是客服，加載所有代理列表
                    if (this.isCustomerService) {
                        await this.loadAllAgents();
                    }
                    
                    // 獲取初始數據
                    await this.fetchDashboardData();
                    await this.fetchNotices();
                    
                                    // 載入當前代理的下級代理和會員列表
                await this.searchAgents();
                await this.searchMembers();
                
                // 初始化可用會員列表
                this.availableMembers = this.members;
                    
                    this.showMessage('登入成功', 'success');
                } else {
                    this.showMessage(response.data.message || '登入失敗', 'error');
                }
            } catch (error) {
                console.error('登入錯誤:', error);
                this.showMessage(error.response?.data?.message || '登入失敗，請稍後再試', 'error');
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
            this.loading = true;
            
            try {
                console.log('嘗試獲取儀表板數據，代理ID:', this.currentManagingAgent.id);
                const response = await axios.get(`${API_BASE_URL}/stats`, {
                    params: { agentId: this.currentManagingAgent.id }
                });
                
                if (response.data.success) {
                    // 使用data屬性而非stats屬性
                    const data = response.data.data;
                    
                    if (!data) {
                        console.error('獲取儀表板數據錯誤: 返回數據格式異常', response.data);
                        this.showMessage('獲取數據失敗，數據格式異常', 'error');
                        return;
                    }
                    
                    this.dashboardData = {
                        totalDeposit: data.totalDeposit || 0,
                        totalWithdraw: data.totalWithdraw || 0,
                        totalRevenue: data.totalRevenue || 0,
                        totalTransactions: data.totalTransactions || 0,
                        memberCount: data.memberCount || 0,
                        activeMembers: data.activeMembers || 0,
                        subAgentsCount: data.subAgentsCount || 0
                    };
                    
                    // 初始化交易圖表
                    this.$nextTick(() => {
                        this.initTransactionChart();
                    });
                } else {
                    // 處理成功但返回失敗的情況
                    console.error('獲取儀表板數據錯誤: API返回失敗', response.data);
                    this.showMessage(response.data.message || '獲取數據失敗，請稍後再試', 'error');
                }
            } catch (error) {
                console.error('獲取儀表板數據錯誤:', error);
                this.showMessage('獲取數據失敗，請檢查網絡連接', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 初始化交易趨勢圖表
        initTransactionChart() {
            const ctx = document.getElementById('transactionChart');
            if (!ctx) return;
            
            // 檢查 Chart.js 是否已加載
            if (typeof Chart === 'undefined') {
                console.warn('Chart.js 尚未加載，延遲初始化圖表');
                setTimeout(() => this.initTransactionChart(), 500);
                return;
            }
            
            // 模擬數據 - 過去7天的交易數據
            const labels = Array(7).fill(0).map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (6 - i));
                return `${date.getMonth() + 1}/${date.getDate()}`;
            });
            
            const transactionData = [15000, 22000, 19500, 24000, 28000, 21000, 26500];

            
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
        

        
        // 顯示訊息
        showMessage(message, type = 'info') {
            console.log(`[${type}] ${message}`);
            // 可根據項目需求使用 alert、toast 或自定義訊息組件
            if (type === 'error') {
                alert(`錯誤: ${message}`);
            } else if (type === 'success') {
                alert(`成功: ${message}`);
            } else {
                alert(message);
            }
        },
        
        // 格式化金額顯示
        formatMoney(amount) {
            if (amount === undefined || amount === null) return '0.00';
            return Number(amount).toLocaleString('zh-TW', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        },
        
        // 格式化日期顯示
        formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleString('zh-TW', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        },
        
        // 格式化日期時間（與 formatDate 相同，為了模板兼容性）
        formatDateTime(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleString('zh-TW', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        },
        
        // 客服交易記錄分頁 - 上一頁
        loadCSTransactionsPrevPage() {
            const prevPage = Math.max(1, this.csTransactionsPagination.page - 1);
            this.loadCSTransactions(prevPage);
        },
        
        // 客服交易記錄分頁 - 下一頁
        loadCSTransactionsNextPage() {
            const maxPage = Math.ceil(this.csTransactionsPagination.total / this.csTransactionsPagination.limit);
            const nextPage = Math.min(maxPage, this.csTransactionsPagination.page + 1);
            this.loadCSTransactions(nextPage);
        },
        
        // 獲取系統公告
        async fetchNotices(category = null) {
            try {
                console.log('獲取系統公告...');
                let url = `${API_BASE_URL}/notices`;
                if (category && category !== 'all') {
                    url += `?category=${encodeURIComponent(category)}`;
                }
                
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('獲取系統公告失敗:', response.status);
                    this.notices = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success) {
                    if (Array.isArray(data.notices)) {
                        this.notices = data.notices;
                    } else {
                        this.notices = [];
                    }
                    
                    if (Array.isArray(data.categories)) {
                        this.noticeCategories = ['all', ...data.categories];
                    }
                } else {
                    console.error('系統公告數據格式錯誤:', data);
                    this.notices = [];
                }
            } catch (error) {
                console.error('獲取系統公告錯誤:', error);
                this.notices = [];
            }
        },
        
        // 根據分類過濾公告
        async filterNoticesByCategory(category) {
            this.selectedNoticeCategory = category;
            await this.fetchNotices(category === 'all' ? null : category);
        },
        
        // 顯示新增公告模態框
        // 開始編輯公告
        startEditNotice(notice) {
            if (this.user.level !== 0) {
                this.showMessage('權限不足，只有總代理可以編輯系統公告', 'error');
                return;
            }
            
            // 設置編輯數據
            this.editingNoticeId = notice.id;
            this.noticeForm = {
                title: notice.title,
                content: notice.content,
                category: notice.category
            };
            this.showNoticeForm = true;
            
            // 滾動到表單
            this.$nextTick(() => {
                const formElement = document.querySelector('.card .card-header h5');
                if (formElement) {
                    formElement.scrollIntoView({ behavior: 'smooth' });
                }
            });
        },
        
        // 取消編輯公告
        cancelNoticeEdit() {
            this.showNoticeForm = false;
            this.editingNoticeId = null;
            this.noticeForm = {
                title: '',
                content: '',
                category: '最新公告'
            };
        },
        
        // 提交公告（新增或編輯）
        async submitNotice() {
            try {
                // 驗證輸入
                if (!this.noticeForm.title.trim()) {
                    this.showMessage('請輸入公告標題', 'error');
                    return;
                }
                
                if (!this.noticeForm.content.trim()) {
                    this.showMessage('請輸入公告內容', 'error');
                    return;
                }
                
                // 標題長度限制
                if (this.noticeForm.title.length > 100) {
                    this.showMessage('公告標題不能超過100個字符', 'error');
                    return;
                }
                
                this.loading = true;
                
                let response;
                if (this.editingNoticeId) {
                    // 編輯現有公告
                    response = await axios.put(`${API_BASE_URL}/notice/${this.editingNoticeId}`, {
                        operatorId: this.user.id,
                        title: this.noticeForm.title.trim(),
                        content: this.noticeForm.content.trim(),
                        category: this.noticeForm.category
                    });
                } else {
                    // 新增公告
                    response = await axios.post(`${API_BASE_URL}/create-notice`, {
                        operatorId: this.user.id,
                        title: this.noticeForm.title.trim(),
                        content: this.noticeForm.content.trim(),
                        category: this.noticeForm.category
                    });
                }
                
                if (response.data.success) {
                    this.showMessage(this.editingNoticeId ? '系統公告更新成功' : '系統公告創建成功', 'success');
                    this.cancelNoticeEdit();
                    
                    // 刷新公告列表
                    await this.fetchNotices();
                } else {
                    this.showMessage(response.data.message || '操作失敗', 'error');
                }
                
            } catch (error) {
                console.error('公告操作出錯:', error);
                this.showMessage('操作出錯，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 獲取當前日期時間
        getCurrentDateTime() {
            return new Date().toLocaleString('zh-TW', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        },
        
        // 刪除公告
        async deleteNotice(notice) {
            if (this.user.level !== 0) {
                this.showMessage('權限不足，只有總代理可以刪除系統公告', 'error');
                return;
            }
            
            // 確認刪除
            if (!confirm(`確定要刪除公告「${notice.title}」嗎？此操作無法恢復。`)) {
                return;
            }
            
            try {
                this.loading = true;
                
                const response = await axios.delete(`${API_BASE_URL}/notice/${notice.id}`, {
                    data: {
                        operatorId: this.user.id
                    }
                });
                
                if (response.data.success) {
                    this.showMessage('系統公告刪除成功', 'success');
                    
                    // 刷新公告列表
                    await this.fetchNotices();
                } else {
                    this.showMessage(response.data.message || '刪除公告失敗', 'error');
                }
                
            } catch (error) {
                console.error('刪除公告出錯:', error);
                this.showMessage('刪除公告出錯，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 搜索代理
        async searchAgents() {
            this.loading = true;
            try {
                console.log('搜索代理...');
                const params = new URLSearchParams();
                if (this.agentFilters.status !== '-1') params.append('status', this.agentFilters.status);
                if (this.agentFilters.keyword) params.append('keyword', this.agentFilters.keyword);
                // 使用當前管理代理的ID作為parentId
                params.append('parentId', this.currentManagingAgent.id);
                
                const url = `${API_BASE_URL}/sub-agents?${params.toString()}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('搜索代理失敗:', response.status);
                    this.agents = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success && data.data) {
                    this.agents = data.data.list || [];
                    this.agentPagination.totalPages = Math.ceil(data.data.total / this.agentPagination.limit);
                    this.agentPagination.currentPage = data.data.page || 1;
                } else {
                    console.error('代理數據格式錯誤:', data);
                    this.agents = [];
                }
            } catch (error) {
                console.error('搜索代理錯誤:', error);
                this.agents = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 搜索會員
        async searchMembers() {
            this.loading = true;
            try {
                console.log('搜索會員...當前管理代理ID:', this.currentManagingAgent.id);
                const params = new URLSearchParams();
                if (this.memberFilters.status !== '-1') params.append('status', this.memberFilters.status);
                if (this.memberFilters.keyword) params.append('keyword', this.memberFilters.keyword);
                params.append('agentId', this.currentManagingAgent.id); // 使用當前管理代理的ID
                
                const url = `${API_BASE_URL}/members?${params.toString()}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('搜索會員失敗:', response.status);
                    this.members = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success && data.data) {
                    this.members = data.data.list || [];
                    this.memberPagination.totalPages = Math.ceil(data.data.total / this.memberPagination.limit);
                    this.memberPagination.currentPage = data.data.page || 1;
                } else {
                    console.error('會員數據格式錯誤:', data);
                    this.members = [];
                }
            } catch (error) {
                console.error('搜索會員錯誤:', error);
                this.members = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 隱藏餘額調整模態框
        hideAdjustBalanceModal() {
            if (this.adjustBalanceModal) {
                this.adjustBalanceModal.hide();
            }
            this.showAdjustBalanceModal = false;
        },
        
        // 計算最終會員餘額
        calculateFinalMemberBalance() {
            const currentBalance = parseFloat(this.balanceAdjustData.currentBalance) || 0;
            const amount = parseFloat(this.transferAmount) || 0;
            if (this.transferType === 'deposit') {
                return currentBalance + amount;
            } else {
                return currentBalance - amount;
            }
        },
        
        // 計算最終代理餘額（會員點數轉移用）
        calculateFinalAgentBalance() {
            const currentBalance = parseFloat(this.agentCurrentBalance) || 0;
            const amount = parseFloat(this.transferAmount) || 0;
            
            if (this.transferType === 'deposit') {
                // 代理存入點數給會員，代理餘額減少
                return currentBalance - amount;
            } else {
                // 代理從會員提領點數，代理餘額增加
                return currentBalance + amount;
            }
        },
        
        // 格式化時間
        formatTime(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleTimeString('zh-TW', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false
            });
        },
        
        // 處理查看範圍變更
        async handleViewScopeChange() {
            console.log('🔄 查看範圍變更:', this.betFilters.viewScope);
            
            // 重置相關篩選
            this.betFilters.member = '';
            this.betFilters.specificAgent = '';
            
            if (this.betFilters.viewScope === 'own') {
                // 僅本代理下級會員
                this.availableMembers = this.members;
            } else if (this.betFilters.viewScope === 'downline') {
                // 整條代理線
                await this.loadDownlineAgentsAndMembers();
            } else if (this.betFilters.viewScope === 'specific') {
                // 指定代理/會員
                await this.loadAllDownlineAgents();
                this.availableMembers = [];
            }
        },
        
        // 載入所有下級代理
        async loadAllDownlineAgents() {
            try {
                console.log('📡 載入所有下級代理...');
                const response = await axios.get(`${API_BASE_URL}/downline-agents`, {
                    params: { 
                        rootAgentId: this.currentManagingAgent.id 
                    }
                });
                
                if (response.data.success) {
                    this.allDownlineAgents = response.data.agents || [];
                    console.log('✅ 載入下級代理成功:', this.allDownlineAgents.length, '個');
                } else {
                    console.error('❌ 載入下級代理失敗:', response.data.message);
                }
            } catch (error) {
                console.error('❌ 載入下級代理錯誤:', error);
                this.showMessage('載入代理列表失敗', 'error');
            }
        },
        
        // 載入整條代理線的代理和會員
        async loadDownlineAgentsAndMembers() {
            try {
                console.log('📡 載入整條代理線的會員...');
                const response = await axios.get(`${API_BASE_URL}/downline-members`, {
                    params: { 
                        rootAgentId: this.currentManagingAgent.id 
                    }
                });
                
                if (response.data.success) {
                    this.availableMembers = response.data.members || [];
                    console.log('✅ 載入整條代理線會員成功:', this.availableMembers.length, '個');
                } else {
                    console.error('❌ 載入整條代理線會員失敗:', response.data.message);
                }
            } catch (error) {
                console.error('❌ 載入整條代理線會員錯誤:', error);
                this.showMessage('載入會員列表失敗', 'error');
            }
        },
        
        // 載入指定代理的會員
        async loadSpecificAgentMembers() {
            if (!this.betFilters.specificAgent) {
                this.availableMembers = [];
                return;
            }
            
            try {
                console.log('📡 載入指定代理的會員...', this.betFilters.specificAgent);
                const response = await axios.get(`${API_BASE_URL}/agent-members`, {
                    params: { 
                        agentId: this.betFilters.specificAgent 
                    }
                });
                
                if (response.data.success) {
                    this.availableMembers = response.data.members || [];
                    console.log('✅ 載入指定代理會員成功:', this.availableMembers.length, '個');
                } else {
                    console.error('❌ 載入指定代理會員失敗:', response.data.message);
                }
            } catch (error) {
                console.error('❌ 載入指定代理會員錯誤:', error);
                this.showMessage('載入會員列表失敗', 'error');
            }
        },
        
        // 重置下注篩選條件
        resetBetFilters() {
            console.log('🔄 重置下注篩選條件');
            this.betFilters = {
                member: '',
                date: '',
                period: '',
                viewScope: 'own',
                specificAgent: ''
            };
            this.availableMembers = this.members;
            this.searchBets();
        },
        
        // 搜索下注記錄
        async searchBets() {
            this.loading = true;
            try {
                console.log('🔍 搜索下注記錄...當前管理代理ID:', this.currentManagingAgent.id);
                console.log('📊 查看範圍:', this.betFilters.viewScope);
                
                const params = new URLSearchParams();
                if (this.betFilters.member) params.append('username', this.betFilters.member);
                if (this.betFilters.date) params.append('date', this.betFilters.date);
                if (this.betFilters.period) params.append('period', this.betFilters.period);
                
                // 根據查看範圍設置不同的查詢參數
                if (this.betFilters.viewScope === 'own') {
                    // 僅本代理下級會員
                    params.append('agentId', this.currentManagingAgent.id);
                } else if (this.betFilters.viewScope === 'downline') {
                    // 整條代理線
                    params.append('rootAgentId', this.currentManagingAgent.id);
                    params.append('includeDownline', 'true');
                } else if (this.betFilters.viewScope === 'specific' && this.betFilters.specificAgent) {
                    // 指定代理
                    params.append('agentId', this.betFilters.specificAgent);
                }
                
                // 添加分頁參數
                params.append('page', this.betPagination.currentPage);
                params.append('limit', this.betPagination.limit);
                
                const url = `${API_BASE_URL}/bets?${params.toString()}`;
                console.log('📡 請求URL:', url);
                
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('❌ 搜索下注記錄失敗:', response.status);
                    this.bets = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success) {
                    this.bets = data.bets || [];
                    console.log('✅ 獲取下注記錄成功:', this.bets.length, '筆');
                    
                    this.betPagination.totalPages = Math.ceil(data.total / this.betPagination.limit);

                    // 更新統計數據
                    this.betStats = data.stats || {
                        totalBets: 0,
                        totalAmount: 0,
                        totalProfit: 0
                    };
                } else {
                    console.error('❌ 獲取下注記錄失敗:', data.message || '未知錯誤');
                    this.bets = [];
                    this.betPagination.totalPages = 1;
                    this.betStats = { totalBets: 0, totalAmount: 0, totalProfit: 0 };
                }
            } catch (error) {
                console.error('❌ 搜索下注記錄錯誤:', error);
                this.bets = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 加載開獎歷史
        async loadDrawHistory() {
            this.loading = true;
            try {
                console.log('加載開獎歷史...');
                const url = `${API_BASE_URL}/draw-history`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('加載開獎歷史失敗:', response.status);
                    this.drawRecords = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success && data.records) {
                    this.drawRecords = data.records || [];
                    this.drawPagination.totalPages = Math.ceil(data.total / this.drawPagination.limit);
                    this.drawPagination.currentPage = data.page || 1;
                } else {
                    console.error('開獎歷史數據格式錯誤:', data);
                    this.drawRecords = [];
                }
            } catch (error) {
                console.error('加載開獎歷史錯誤:', error);
                this.drawRecords = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 搜索開獎歷史
        async searchDrawHistory() {
            this.loading = true;
            try {
                console.log('搜索開獎歷史...');
                const params = new URLSearchParams();
                if (this.drawFilters.period) params.append('period', this.drawFilters.period);
                if (this.drawFilters.date) params.append('date', this.drawFilters.date);
                params.append('page', this.drawPagination.currentPage);
                params.append('limit', this.drawPagination.limit);
                
                const url = `${API_BASE_URL}/draw-history?${params.toString()}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('搜索開獎歷史失敗:', response.status);
                    this.drawRecords = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success && data.records) {
                    this.drawRecords = data.records || [];
                    this.drawPagination.totalPages = Math.ceil(data.total / this.drawPagination.limit);
                    this.drawPagination.currentPage = data.page || 1;
                } else {
                    console.error('開獎歷史數據格式錯誤:', data);
                    this.drawRecords = [];
                }
            } catch (error) {
                console.error('搜索開獎歷史錯誤:', error);
                this.drawRecords = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 搜索今日開獎記錄
        async searchTodayDrawHistory() {
            this.drawFilters.date = new Date().toISOString().split('T')[0]; // 設置為今天日期 YYYY-MM-DD
            this.drawFilters.period = '';
            await this.searchDrawHistory();
        },
        
        // 獲取分頁範圍
        getPageRange(currentPage, totalPages) {
            const range = [];
            const maxVisible = 5;
            
            if (totalPages <= maxVisible) {
                // 如果總頁數小於要顯示的頁數，顯示所有頁
                for (let i = 1; i <= totalPages; i++) {
                    range.push(i);
                }
            } else {
                // 計算顯示哪些頁面
                let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                let end = start + maxVisible - 1;
                
                if (end > totalPages) {
                    end = totalPages;
                    start = Math.max(1, end - maxVisible + 1);
                }
                
                for (let i = start; i <= end; i++) {
                    range.push(i);
                }
            }
            
            return range;
        },
        
        // 格式化投注類型
        formatBetType(type) {
            // 根據後端邏輯，重新分類投注類型
            if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(type)) {
                return '雙面';
            } else if (type === 'number') {
                return '號碼';
            } else if (type === 'sumValue') {
                return '冠亞和值';
            } else if (type === 'dragonTiger' || type === 'dragon_tiger') {
                return '龍虎';
            }
            
            // 備用映射（向下相容）
            const types = {
                'sum': '冠亞和值',
                'second': '雙面'
            };
            return types[type] || type;
        },
        
        // 格式化位置
        formatPosition(position, betType) {
            // 對於號碼投注，position是數字（1-10），代表第幾位
            if (betType === 'number' && position) {
                const positionMap = {
                    '1': '冠軍',
                    '2': '亞軍', 
                    '3': '第三名',
                    '4': '第四名',
                    '5': '第五名',
                    '6': '第六名',
                    '7': '第七名',
                    '8': '第八名',
                    '9': '第九名',
                    '10': '第十名'
                };
                return positionMap[position.toString()] || `第${position}名`;
            }
            
            // 對於位置投注，bet_type本身就是位置
            if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(betType)) {
                const positionMap = {
                    'champion': '冠軍',
                    'runnerup': '亞軍',
                    'third': '第三名',
                    'fourth': '第四名',
                    'fifth': '第五名',
                    'sixth': '第六名',
                    'seventh': '第七名',
                    'eighth': '第八名',
                    'ninth': '第九名',
                    'tenth': '第十名'
                };
                return positionMap[betType] || betType;
            }
            
            // 其他情況（冠亞和值、龍虎等）不需要位置
            return '-';
        },
        
        // 獲取龍虎結果
        getDragonTigerResult(record) {
            if (!record || !record.result || record.result.length < 10) {
                return { value: '-', class: '' };
            }
            
            const first = record.result[0];
            const tenth = record.result[9];
            
            if (first > tenth) {
                return { value: '龍', class: 'text-danger' };
            } else if (first < tenth) {
                return { value: '虎', class: 'text-primary' };
            } else {
                return { value: '和', class: 'text-warning' };
            }
        },
        
        // 格式化轉移類型
        formatTransferType(transfer) {
            // 以當前登入代理身份為第一人稱，只顯示存款或提領
            const currentAgentId = this.user.id;
            
            // 如果當前代理是轉出方，顯示為「提領」（我轉出給其他人）
            if (transfer.from_id === currentAgentId && transfer.from_type === 'agent') {
                return '提領';
            }
            // 如果當前代理是轉入方，顯示為「存款」（其他人轉入給我）
            else if (transfer.to_id === currentAgentId && transfer.to_type === 'agent') {
                return '存款';
            }
            // 備用邏輯（適用於查看其他代理記錄的情況）
            else if (transfer.from_type === 'agent' && transfer.to_type === 'member') {
                return '存入';
            } else if (transfer.from_type === 'member' && transfer.to_type === 'agent') {
                return '提領';
            } else if (transfer.from_type === 'agent' && transfer.to_type === 'agent') {
                return '存入';  // 代理間轉移統一顯示為存入
            } else {
                return '點數轉移';
            }
        },
        
        // 格式化轉移方向
        formatTransferDirection(transfer) {
            // 以當前登入代理身份為第一人稱，從其觀點描述轉移方向
            const currentAgentId = this.user.id;
            
            // 如果當前代理是轉出方
            if (transfer.from_id === currentAgentId && transfer.from_type === 'agent') {
                if (transfer.to_type === 'member') {
                    return `我 → ${transfer.to_username || '未知會員'}`;
                } else if (transfer.to_type === 'agent') {
                    return `我 → ${transfer.to_username || '未知代理'}`;
                }
            }
            // 如果當前代理是轉入方
            else if (transfer.to_id === currentAgentId && transfer.to_type === 'agent') {
                if (transfer.from_type === 'member') {
                    return `${transfer.from_username || '未知會員'} → 我`;
                } else if (transfer.from_type === 'agent') {
                    return `${transfer.from_username || '未知代理'} → 我`;
                }
            }
            // 其他情況（查看他人記錄）
            else {
                const fromName = transfer.from_username || (transfer.from_type === 'agent' ? '代理' : '會員');
                const toName = transfer.to_username || (transfer.to_type === 'agent' ? '代理' : '會員');
                return `${fromName} → ${toName}`;
            }
            
            return '未知方向';
        },
        
        // 格式化交易類型
        formatTransactionType(transaction) {
            const type = transaction.transaction_type || transaction.type;
            switch (type) {
                case 'cs_deposit':
                    return '客服存款';
                case 'cs_withdraw':
                    return '客服提款';
                case 'deposit':
                    return '存款';
                case 'withdraw':
                    return '提款';
                case 'transfer_in':
                    return '轉入';
                case 'transfer_out':
                    return '轉出';
                case 'adjustment':
                    return '餘額調整';
                case 'password_reset':
                    return '密碼重設';
                case 'game_bet':
                    return '遊戲下注';
                case 'game_win':
                    return '遊戲中獎';
                case 'rebate':
                    return '退水';
                default:
                    return type || '未知';
            }
        },
        
        // 格式化用戶類型
        formatUserType(userType) {
            switch (userType) {
                case 'agent':
                    return '代理';
                case 'member':
                    return '會員';
                default:
                    return userType || '未知';
            }
        },
        
        // 獲取級別名稱
        getLevelName(level) {
            const levels = {
                0: '總代理',
                1: '一級代理', 
                2: '二級代理',
                3: '三級代理',
                4: '四級代理',
                5: '五級代理',
                6: '六級代理',
                7: '七級代理',
                8: '八級代理',
                9: '九級代理',
                10: '十級代理',
                11: '十一級代理',
                12: '十二級代理',
                13: '十三級代理',
                14: '十四級代理',
                15: '十五級代理'
            };
            return levels[level] || `${level}級代理`;
        },
        
        // 提交餘額調整
        async submitBalanceAdjustment() {
            if (!this.balanceAdjustData.memberId || !this.balanceAdjustData.currentBalance || !this.transferAmount || !this.transferType) {
                return this.showMessage('請填寫完整餘額調整資料', 'error');
            }
            
            this.loading = true;
            
            try {
                // 準備要傳送的數據，確保包含所有後端需要的欄位
                const payload = {
                    agentId: this.balanceAdjustData.agentId,
                    username: this.balanceAdjustData.memberUsername, // 後端需要 username
                    amount: this.transferType === 'deposit' ? this.transferAmount : -this.transferAmount, // 根據類型調整金額正負
                    type: this.transferType, // 轉移類型 'deposit' 或 'withdraw'
                    description: this.balanceAdjustData.description
                };

                const response = await axios.post(`${API_BASE_URL}/update-member-balance`, payload);
                
                if (response.data.success) {
                    this.showMessage('餘額調整成功', 'success');
                    // 更新前端顯示的代理和會員餘額
                    this.user.balance = response.data.agentBalance;
                    // 同時更新localStorage中的用戶資訊
                    localStorage.setItem('agent_user', JSON.stringify(this.user));
                    this.agentCurrentBalance = parseFloat(response.data.agentBalance) || 0; // 同步更新代理當前餘額
                    // 需要重新獲取會員列表或更新特定會員的餘額，以反映變更
                    this.searchMembers(); // 重新載入會員列表，會包含更新後的餘額
                    this.hideAdjustBalanceModal(); // 關閉模態框
                    await this.fetchDashboardData(); // 更新儀表板數據
                } else {
                    this.showMessage(response.data.message || '餘額調整失敗', 'error');
                }
            } catch (error) {
                console.error('提交餘額調整錯誤:', error);
                this.showMessage(error.response?.data?.message || '餘額調整失敗，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        // 新增的方法，確保在Vue實例中定義
        async createMember() {
            // 實際的創建會員邏輯需要您來實現
            console.log('createMember 方法被調用', this.newMember);
            if (!this.newMember.username || !this.newMember.password || !this.newMember.confirmPassword) {
                this.showMessage('請填寫所有必填欄位', 'error');
                return;
            }
            if (this.newMember.password !== this.newMember.confirmPassword) {
                this.showMessage('兩次輸入的密碼不一致', 'error');
                return;
            }
            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/create-member`, {
                    username: this.newMember.username,
                    password: this.newMember.password,
                    agentId: this.currentManagingAgent.id // 使用當前管理代理的ID而非登入代理
                });
                if (response.data.success) {
                    const agentName = this.currentManagingAgent.username;
                    const isCurrentUser = this.currentManagingAgent.id === this.user.id;
                    const message = isCurrentUser ? 
                        `會員 ${this.newMember.username} 創建成功!` : 
                        `已為代理 ${agentName} 創建會員 ${this.newMember.username}`;
                    this.showMessage(message, 'success');
                    this.hideCreateMemberModal();
                    // 重置新增會員表單
                    this.newMember = {
                        username: '',
                        password: '',
                        confirmPassword: '',
                        balance: 0,
                        status: 1
                    };
                    await this.searchMembers(); // 刷新會員列表
                } else {
                    this.showMessage(response.data.message || '會員創建失敗', 'error');
                }
            } catch (error) {
                console.error('創建會員出錯:', error);
                this.showMessage(error.response?.data?.message || '創建會員出錯，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        

        async fetchParentAgents() {
            // 實際獲取上級代理列表的邏輯需要您來實現
            console.log('fetchParentAgents 方法被調用');
             if (this.user.level === 0) { // 總代理不能有上級
                this.parentAgents = [];
                return;
            }
            this.loading = true;
            try {
                // 通常是獲取可作為當前操作代理的上級代理列表
                // 這裡假設API會返回合適的代理列表
                const response = await axios.get(`${API_BASE_URL}/available-parents`);
                if (response.data.success) {
                    this.parentAgents = response.data.agents || [];
                } else {
                    this.showMessage(response.data.message || '獲取上級代理失敗', 'error');
                    this.parentAgents = [];
                }
            } catch (error) {
                console.error('獲取上級代理列表出錯:', error);
                this.showMessage('獲取上級代理列表出錯，請稍後再試', 'error');
                this.parentAgents = [];
            } finally {
                this.loading = false;
            }
        },
        async createAgent() {
            console.log('createAgent 方法被調用', this.newAgent);
            if (!this.newAgent.username || !this.newAgent.password) {
                this.showMessage('請填寫所有必填欄位', 'error');
                return;
            }
            
            // 驗證退水設定
            if (this.newAgent.rebate_mode === 'percentage') {
                const rebatePercentage = parseFloat(this.newAgent.rebate_percentage);
                const maxRebate = this.currentManagingAgent.max_rebate_percentage * 100;
                
                if (isNaN(rebatePercentage) || rebatePercentage < 0 || rebatePercentage > maxRebate) {
                    this.showMessage(`退水比例必須在 0% - ${maxRebate.toFixed(1)}% 之間`, 'error');
                    return;
                }
            }
            
            this.loading = true;
            try {
                const payload = {
                    username: this.newAgent.username,
                    password: this.newAgent.password,
                    level: parseInt(this.newAgent.level),
                    parent: this.newAgent.parent,
                    rebate_mode: this.newAgent.rebate_mode
                };
                
                // 只有在選擇具體比例時才傳送退水比例
                if (this.newAgent.rebate_mode === 'percentage') {
                    payload.rebate_percentage = parseFloat(this.newAgent.rebate_percentage) / 100;
                }
                
                console.log('創建代理請求數據:', payload);
                
                const response = await axios.post(`${API_BASE_URL}/create-agent`, payload);
                if (response.data.success) {
                    this.showMessage('代理創建成功!', 'success');
                    this.hideCreateAgentModal();
                    
                    // 重置表單
                    this.newAgent = {
                        username: '',
                        password: '',
                        level: '1',
                        parent: '',
                        rebate_mode: 'percentage',
                        rebate_percentage: 2.0
                    };
                    
                    this.searchAgents(); // 刷新代理列表
                } else {
                    this.showMessage(response.data.message || '代理創建失敗', 'error');
                }
            } catch (error) {
                console.error('創建代理出錯:', error);
                this.showMessage(error.response?.data?.message || '創建代理出錯，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        // 加載點數轉移記錄
        async loadPointTransfers() {
            this.loading = true;
            try {
                console.log('加載點數轉移記錄...');
                const url = `${API_BASE_URL}/point-transfers?agentId=${this.user.id}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('加載點數轉移記錄失敗:', response.status);
                    this.pointTransfers = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success) {
                    this.pointTransfers = data.transfers || [];
                    console.log('點數轉移記錄載入成功，共有 ' + this.pointTransfers.length + ' 筆記錄');
                } else {
                    console.error('點數轉移記錄數據格式錯誤:', data);
                    this.pointTransfers = [];
                }
            } catch (error) {
                console.error('加載點數轉移記錄錯誤:', error);
                this.pointTransfers = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 清空所有轉移記錄（僅用於測試）
        async clearAllTransfers() {
            if (!confirm('確定要清空所有點數轉移記錄嗎？此操作無法撤銷！')) {
                return;
            }
            
            this.loading = true;
            try {
                const response = await fetch(`${API_BASE_URL}/agent/clear-transfers`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.showMessage('所有轉移記錄已清空', 'success');
                    this.pointTransfers = [];
                } else {
                    this.showMessage(data.message || '清空記錄失敗', 'error');
                }
            } catch (error) {
                console.error('清空記錄出錯:', error);
                this.showMessage('清空記錄失敗，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        // 新增：處理會員餘額調整模態框的顯示
        adjustMemberBalance(member) {
            this.balanceAdjustData.memberId = member.id;
            this.balanceAdjustData.memberUsername = member.username;
            this.balanceAdjustData.currentBalance = member.balance;
            this.balanceAdjustData.agentId = this.user.id; // 設置代理ID
            this.balanceAdjustData.description = ''; // 重置描述
            this.agentCurrentBalance = parseFloat(this.user.balance) || 0; // 設置代理當前餘額，確保是數字格式
            this.transferAmount = 0; // 重置轉移金額
            this.transferType = 'deposit'; // 預設為存入

            // 強制更新Vue實例以確保響應式數據同步
            this.$forceUpdate();

            this.showAdjustBalanceModal = true;
            this.$nextTick(() => {
                const modalEl = document.getElementById('adjustBalanceModal');
                if (modalEl) {
                    this.adjustBalanceModal = new bootstrap.Modal(modalEl);
                    this.adjustBalanceModal.show();
                } else {
                    console.error('找不到餘額調整模態框元素');
                    this.showMessage('系統錯誤，請稍後再試', 'error');
                }
            });
        },

        // 進入代理管理（導航到下級代理）
        async enterAgentManagement(agent) {
            // 添加到面包屑導航
            this.agentBreadcrumbs.push({
                id: this.currentManagingAgent.id,
                username: this.currentManagingAgent.username,
                level: this.currentManagingAgent.level
            });
            
            // 更新當前管理代理
            this.currentManagingAgent = {
                id: agent.id,
                username: agent.username,
                level: agent.level,
                max_rebate_percentage: agent.max_rebate_percentage || 0.041
            };
            
            // 重新載入代理列表和會員列表（該代理的下級）
            await this.searchAgents();
            await this.searchMembers();
        },
        
        // 導航到指定代理層級
        async navigateToAgentLevel(agentId, username) {
            // 查找面包屑中的位置
            const targetIndex = this.agentBreadcrumbs.findIndex(b => b.id === agentId);
            
            if (agentId === this.user.id) {
                // 返回到自己
                this.agentBreadcrumbs = [];
                this.currentManagingAgent = {
                    id: this.user.id,
                    username: this.user.username,
                    level: this.user.level,
                    max_rebate_percentage: this.user.max_rebate_percentage || 0.041
                };
            } else if (targetIndex >= 0) {
                // 移除該位置之後的所有面包屑
                const targetBreadcrumb = this.agentBreadcrumbs[targetIndex];
                this.agentBreadcrumbs = this.agentBreadcrumbs.slice(0, targetIndex);
                this.currentManagingAgent = {
                    id: targetBreadcrumb.id,
                    username: targetBreadcrumb.username,
                    level: targetBreadcrumb.level,
                    max_rebate_percentage: targetBreadcrumb.max_rebate_percentage || 0.041
                };
            }
            
            // 重新載入代理列表和會員列表
            await this.searchAgents();
            await this.searchMembers();
        },
        
        // 返回上級代理
        async goBackToParentLevel() {
            if (this.agentBreadcrumbs.length > 0) {
                const parentBreadcrumb = this.agentBreadcrumbs.pop();
                this.currentManagingAgent = {
                    id: parentBreadcrumb.id,
                    username: parentBreadcrumb.username,
                    level: parentBreadcrumb.level,
                    max_rebate_percentage: parentBreadcrumb.max_rebate_percentage || 0.041
                };
            } else {
                // 返回到自己
                this.currentManagingAgent = {
                    id: this.user.id,
                    username: this.user.username,
                    level: this.user.level,
                    max_rebate_percentage: this.user.max_rebate_percentage || 0.041
                };
            }
            
            // 重新載入代理列表和會員列表
            await this.searchAgents();
            await this.searchMembers();
        },
        
        // 顯示退水設定模態框
        showRebateSettingsModal(agent) {
            this.rebateAgent = {
                id: agent.id,
                username: agent.username,
                rebate_mode: agent.rebate_mode || 'percentage',
                rebate_percentage: agent.rebate_percentage || 0,
                max_rebate_percentage: agent.max_rebate_percentage || 0.041
            };
            
            this.rebateSettings = {
                rebate_mode: this.rebateAgent.rebate_mode,
                rebate_percentage: (this.rebateAgent.rebate_percentage * 100).toFixed(1)
            };
            
            this.showRebateModal = true;
            this.$nextTick(() => {
                const modalEl = document.getElementById('rebateSettingsModal');
                if (modalEl) {
                    this.rebateSettingsModal = new bootstrap.Modal(modalEl);
                    this.rebateSettingsModal.show();
                }
            });
        },
        
        // 隱藏退水設定模態框
        hideRebateSettingsModal() {
            if (this.rebateSettingsModal) {
                this.rebateSettingsModal.hide();
            }
            this.showRebateModal = false;
        },
        
        // 更新退水設定
        async updateRebateSettings() {
            this.loading = true;
            try {
                const payload = {
                    rebate_mode: this.rebateSettings.rebate_mode
                };
                
                if (this.rebateSettings.rebate_mode === 'percentage') {
                    payload.rebate_percentage = parseFloat(this.rebateSettings.rebate_percentage) / 100;
                }
                
                const response = await axios.put(`${API_BASE_URL}/update-rebate-settings/${this.rebateAgent.id}`, payload);
                
                if (response.data.success) {
                    this.showMessage('退水設定更新成功', 'success');
                    this.hideRebateSettingsModal();
                    await this.searchAgents(); // 刷新代理列表
                } else {
                    this.showMessage(response.data.message || '更新退水設定失敗', 'error');
                }
            } catch (error) {
                console.error('更新退水設定錯誤:', error);
                this.showMessage(error.response?.data?.message || '更新退水設定失敗', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 獲取退水模式文本
        getRebateModeText(mode) {
            switch (mode) {
                case 'all':
                    return '全拿退水';
                case 'none':
                    return '全退下級';
                case 'percentage':
                    return '自定比例';
                default:
                    return '未設定';
            }
        },

        // 新增：切換會員狀態
        async toggleMemberStatus(memberId, currentStatus) {
            const newStatus = currentStatus === 1 ? 0 : 1;
            const actionText = newStatus === 1 ? '啟用' : '停用';
            if (!confirm(`確定要${actionText}該會員嗎？`)) {
                return;
            }

            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/toggle-member-status`, { memberId, status: newStatus });
                if (response.data.success) {
                    this.showMessage(`會員已${actionText}`, 'success');
                    // 更新本地會員列表中的狀態
                    const member = this.members.find(m => m.id === memberId);
                    if (member) {
                        member.status = newStatus;
                    }
                } else {
                    this.showMessage(response.data.message || `${actionText}會員失敗`, 'error');
                }
            } catch (error) {
                console.error(`${actionText}會員出錯:`, error);
                this.showMessage(error.response?.data?.message || `${actionText}會員失敗，請稍後再試`, 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 修改會員額度
        modifyMemberBalance(member) {
            this.modifyBalanceData.memberId = member.id;
            this.modifyBalanceData.memberUsername = member.username;
            this.modifyBalanceData.currentBalance = member.balance;
            this.modifyBalanceData.reason = '';
            this.modifyBalanceType = 'absolute';
            this.modifyBalanceAmount = 0;
            this.balanceChangeDirection = 'increase';
            
            this.$nextTick(() => {
                const modalEl = document.getElementById('modifyMemberBalanceModal');
                if (modalEl) {
                    this.modifyMemberBalanceModal = new bootstrap.Modal(modalEl);
                    this.modifyMemberBalanceModal.show();
                } else {
                    console.error('找不到修改會員額度模態框元素');
                    this.showMessage('系統錯誤，請稍後再試', 'error');
                }
            });
        },
        
        // 隱藏修改會員額度模態框
        hideModifyMemberBalanceModal() {
            if (this.modifyMemberBalanceModal) {
                this.modifyMemberBalanceModal.hide();
            }
        },
        
        // 計算最終修改後的會員餘額
        calculateFinalModifiedBalance() {
            const currentBalance = parseFloat(this.modifyBalanceData.currentBalance) || 0;
            const modifyAmount = parseFloat(this.modifyBalanceAmount) || 0;
            
            if (this.modifyBalanceType === 'absolute') {
                return modifyAmount;
            } else {
                if (this.balanceChangeDirection === 'increase') {
                    return currentBalance + modifyAmount;
                } else {
                    return currentBalance - modifyAmount;
                }
            }
        },
        
        // 提交修改會員額度
        async submitModifyMemberBalance() {
            if (!this.modifyBalanceData.memberId || !this.modifyBalanceAmount || !this.modifyBalanceData.reason) {
                return this.showMessage('請填寫完整資料', 'error');
            }
            
            // 檢查修改後的金額是否合理
            const finalBalance = this.calculateFinalModifiedBalance();
            if (finalBalance < 0) {
                return this.showMessage('修改後的額度不能小於0', 'error');
            }
            
            this.loading = true;
            
            try {
                // 準備發送到後端的數據
                let requestData = {
                    memberId: this.modifyBalanceData.memberId,
                    amount: finalBalance,
                    reason: this.modifyBalanceData.reason
                };
                
                // 相對值模式下，發送相對值變化量
                if (this.modifyBalanceType === 'relative') {
                    requestData.amount = this.balanceChangeDirection === 'increase' 
                        ? this.modifyBalanceAmount 
                        : -this.modifyBalanceAmount;
                    requestData.isRelative = true;
                } else {
                    requestData.isRelative = false;
                }
                
                const response = await axios.post(`${API_BASE_URL}/modify-member-balance`, requestData);
                
                if (response.data.success) {
                    this.showMessage('會員額度修改成功', 'success');
                    this.hideModifyMemberBalanceModal();
                    this.searchMembers(); // 重新載入會員列表
                } else {
                    this.showMessage(response.data.message || '會員額度修改失敗', 'error');
                }
            } catch (error) {
                console.error('修改會員額度錯誤:', error);
                this.showMessage(error.response?.data?.message || '會員額度修改失敗，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 刪除會員
        async deleteMember(memberId, username) {
            if (!confirm(`確定要刪除會員 ${username} 嗎？此操作不可恢復！`)) {
                return;
            }
            
            this.loading = true;
            
            try {
                const response = await axios.delete(`${API_BASE_URL}/delete-member/${memberId}`);
                
                if (response.data.success) {
                    this.showMessage('會員刪除成功', 'success');
                    this.searchMembers(); // 重新載入會員列表
                } else {
                    this.showMessage(response.data.message || '會員刪除失敗', 'error');
                }
            } catch (error) {
                console.error('刪除會員錯誤:', error);
                this.showMessage(error.response?.data?.message || '會員刪除失敗，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 代理額度修改相關方法
        adjustAgentBalance(agent) {
            // 設置要修改的代理資料
            this.agentBalanceData = {
                agentId: agent.id,
                agentUsername: agent.username,
                currentBalance: agent.balance,
                description: ''
            };
            
            // 設置默認值
            this.agentTransferType = 'deposit';
            this.agentTransferAmount = 0;
            
            console.log('代理點數轉移數據準備完成:', {
                agent: agent,
                user: this.user,
                agentBalanceData: this.agentBalanceData
            });
            
            // 使用Bootstrap 5標準方式顯示模態框
            const modalElement = document.getElementById('adjustAgentBalanceModal');
            if (!modalElement) {
                console.error('找不到模態框元素');
                return this.showMessage('系統錯誤：找不到模態框元素', 'error');
            }
            
            // 直接使用Bootstrap 5的Modal方法
            const modal = new bootstrap.Modal(modalElement);
            this.adjustAgentBalanceModal = modal;
            modal.show();
        },
        
        // 計算最終下級代理餘額
        calculateFinalSubAgentBalance() {
            // 確保使用有效數值
            const currentBalance = parseFloat(this.agentBalanceData?.currentBalance) || 0;
            const transferAmount = parseFloat(this.agentTransferAmount) || 0;
            
            if (this.agentTransferType === 'deposit') {
                return currentBalance + transferAmount;
            } else {
                return currentBalance - transferAmount;
            }
        },
        
        // 計算最終上級代理(自己)餘額
        calculateFinalParentAgentBalance() {
            // 確保使用有效數值
            const currentBalance = parseFloat(this.user.balance) || 0;
            const transferAmount = parseFloat(this.agentTransferAmount) || 0;
            
            if (this.agentTransferType === 'deposit') {
                return currentBalance - transferAmount;
            } else {
                return currentBalance + transferAmount;
            }
        },
        
        // 切換代理狀態
        async toggleAgentStatus(agent) {
            const newStatus = agent.status === 1 ? 0 : 1;
            const actionText = newStatus === 1 ? '啟用' : '停用';
            if (!confirm(`確定要${actionText}該代理嗎？`)) {
                return;
            }

            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/toggle-agent-status`, { 
                    agentId: agent.id, 
                    status: newStatus 
                });
                
                if (response.data.success) {
                    this.showMessage(`代理已${actionText}`, 'success');
                    // 更新本地代理列表中的狀態
                    const agentInList = this.agents.find(a => a.id === agent.id);
                    if (agentInList) {
                        agentInList.status = newStatus;
                    }
                } else {
                    this.showMessage(response.data.message || `${actionText}代理失敗`, 'error');
                }
            } catch (error) {
                console.error(`${actionText}代理出錯:`, error);
                this.showMessage(error.response?.data?.message || `${actionText}代理失敗，請稍後再試`, 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 隱藏代理額度修改模態框
        hideAdjustAgentBalanceModal() {
            console.log('嘗試隱藏代理點數轉移模態框');
            try {
                if (this.adjustAgentBalanceModal) {
                    console.log('找到模態框實例，嘗試隱藏');
                    this.adjustAgentBalanceModal.hide();
                    console.log('模態框隱藏方法已調用');
                } else {
                    console.log('找不到模態框實例，嘗試手動隱藏');
                    const modalEl = document.getElementById('adjustAgentBalanceModal');
                    if (modalEl) {
                        modalEl.style.display = 'none';
                        modalEl.classList.remove('show');
                        document.body.classList.remove('modal-open');
                        const backdrop = document.querySelector('.modal-backdrop');
                        if (backdrop) backdrop.remove();
                        console.log('已手動隱藏模態框');
                    }
                }
            } catch (error) {
                console.error('隱藏模態框時出錯:', error);
            }
        },
        
        // 計算最終代理餘額（代理額度修改用）
        calculateFinalAgentBalance() {
            const currentBalance = parseFloat(this.agentBalanceData.currentBalance) || 0;
            const modifyAmount = parseFloat(this.agentModifyAmount) || 0;
            
            if (this.agentModifyType === 'absolute') {
                return modifyAmount;
            } else {
                if (this.agentChangeDirection === 'increase') {
                    return currentBalance + modifyAmount;
                } else {
                    return currentBalance - modifyAmount;
                }
            }
        },
        
        // 提交代理額度修改
        async submitAgentBalanceAdjustment() {
            console.log('嘗試提交代理點數轉移');
            if (!this.agentBalanceData.agentId || !this.agentTransferAmount) {
                console.log('資料不完整:', {
                    agentId: this.agentBalanceData.agentId,
                    transferAmount: this.agentTransferAmount,
                    description: this.agentBalanceData.description
                });
                return this.showMessage('請填寫轉移金額', 'error');
            }
            
            this.loading = true;
            console.log('開始提交代理點數轉移數據');
            
            try {
                // 準備要傳送的數據
                const payload = {
                    agentId: this.user.id,  // 當前代理ID（來源或目標）
                    subAgentId: this.agentBalanceData.agentId,  // 下級代理ID
                    amount: this.agentTransferType === 'deposit' ? this.agentTransferAmount : -this.agentTransferAmount, // 根據類型調整金額正負
                    type: this.agentTransferType, // 轉移類型 'deposit' 或 'withdraw'
                    description: this.agentBalanceData.description
                };

                console.log('準備發送的數據:', payload);
                const response = await axios.post(`${API_BASE_URL}/transfer-agent-balance`, payload);
                console.log('伺服器返回結果:', response.data);
                
                if (response.data.success) {
                    this.showMessage('代理點數轉移成功', 'success');
                    // 更新前端顯示的代理餘額
                    this.user.balance = response.data.parentBalance;
                    // 同時更新localStorage中的用戶資訊
                    localStorage.setItem('agent_user', JSON.stringify(this.user));
                    // 需要重新獲取代理列表或更新特定代理的餘額
                    this.searchAgents(); // 重新載入代理列表
                    this.hideAdjustAgentBalanceModal(); // 關閉模態框
                    await this.fetchDashboardData(); // 更新儀表板數據
                } else {
                    this.showMessage(response.data.message || '代理點數轉移失敗', 'error');
                }
            } catch (error) {
                console.error('提交代理點數轉移錯誤:', error);
                this.showMessage(error.response?.data?.message || '代理點數轉移失敗，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 刪除代理
        async deleteAgent(agentId, username) {
            if (!confirm(`確定要刪除代理 ${username} 嗎？此操作將刪除該代理及其所有下級代理和會員，不可恢復！`)) {
                return;
            }
            
            this.loading = true;
            
            try {
                const response = await axios.delete(`${API_BASE_URL}/delete-agent/${agentId}`);
                
                if (response.data.success) {
                    this.showMessage('代理刪除成功', 'success');
                    this.searchAgents(); // 重新載入代理列表
                } else {
                    this.showMessage(response.data.message || '代理刪除失敗', 'error');
                }
            } catch (error) {
                console.error('刪除代理錯誤:', error);
                this.showMessage(error.response?.data?.message || '代理刪除失敗，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 改變頁碼
        changePage(page, type) {
            if (page < 1) return;
            
            switch (type) {
                case 'agents':
                    if (page > this.agentPagination.totalPages) return;
                    this.agentPagination.currentPage = page;
                    this.searchAgents();
                    break;
                case 'members':
                    if (page > this.memberPagination.totalPages) return;
                    this.memberPagination.currentPage = page;
                    this.searchMembers();
                    break;
                case 'draw':
                    if (page > this.drawPagination.totalPages) return;
                    this.drawPagination.currentPage = page;
                    this.searchDrawHistory();
                    break;
                case 'bets':
                    if (page > this.betPagination.totalPages) return;
                    this.betPagination.currentPage = page;
                    this.searchBets();
                    break;
                default:
                    console.warn('未知的分頁類型:', type);
            }
        },
        
        // 格式化佣金比例顯示

        
        // 格式化投注選項顯示
        formatBetValue(value) {
            if (!value) return '-';
            
            const valueMap = {
                // 大小
                'big': '大',
                'small': '小',
                // 單雙
                'odd': '單',
                'even': '雙',
                // 龍虎
                'dragon': '龍',
                'tiger': '虎',
                // 和值相關
                'sumBig': '總和大',
                'sumSmall': '總和小',
                'sumOdd': '總和單',
                'sumEven': '總和雙',
            };
            
            // 如果是純數字，直接返回
            if (!isNaN(value) && !isNaN(parseFloat(value))) {
                return value;
            }
            
            // 查找對應的中文翻譯
            return valueMap[value] || value;
        },
        
        // 客服專用方法
        async loadAllAgents() {
            try {
                this.loading = true;
                console.log('開始加載所有代理...');
                // 遞歸獲取所有代理
                const response = await axios.get(`${API_BASE_URL}/sub-agents`, {
                    params: {
                        parentId: '', // 空值獲取所有代理
                        level: -1,
                        status: -1,
                        page: 1,
                        limit: 1000 // 設置較大的limit獲取所有代理
                    }
                });
                
                console.log('API響應:', response.data);
                
                if (response.data.success) {
                    this.allAgents = response.data.data.list || [];
                    console.log('加載所有代理成功:', this.allAgents.length, this.allAgents);
                    
                    // 確保每個代理都有正確的屬性
                    this.allAgents.forEach((agent, index) => {
                        console.log(`代理 ${index}:`, {
                            id: agent.id,
                            username: agent.username,
                            level: agent.level,
                            balance: agent.balance,
                            levelName: this.getLevelName(agent.level),
                            formattedBalance: this.formatMoney(agent.balance)
                        });
                        
                        // 確保數據類型正確
                        agent.balance = parseFloat(agent.balance) || 0;
                        agent.level = parseInt(agent.level) || 0;
                    });
                    
                    // 手動更新代理選擇下拉列表
                    this.updateAgentSelect();
                } else {
                    console.error('API返回失敗:', response.data.message);
                    this.showMessage('加載代理列表失敗', 'error');
                }
            } catch (error) {
                console.error('加載所有代理出錯:', error);
                this.showMessage('加載代理列表出錯', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        async loadCSTransactions(page = 1) {
            if (!this.isCustomerService) return;
            
            try {
                this.loading = true;
                // 確保 page 是一個有效的數字
                const pageNum = parseInt(page) || 1;
                const response = await axios.get(`${API_BASE_URL}/cs-transactions`, {
                    params: {
                        operatorId: this.user.id,
                        page: pageNum,
                        limit: this.csTransactionsPagination.limit,
                        userType: this.csTransactionFilters.userType,
                        transactionType: this.csTransactionFilters.transactionType
                    }
                });
                
                if (response.data.success) {
                    this.csTransactions = response.data.data.list || [];
                    this.csTransactionsPagination = {
                        page: response.data.data.page,
                        limit: response.data.data.limit,
                        total: response.data.data.total
                    };
                    console.log('加載客服交易記錄成功:', this.csTransactions.length);
                } else {
                    this.showMessage(response.data.message || '加載客服交易記錄失敗', 'error');
                }
            } catch (error) {
                console.error('加載客服交易記錄出錯:', error);
                this.showMessage('加載客服交易記錄出錯', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 顯示客服操作模態框
        async showCSOperationModalFunc() {
            console.log('=== 開始顯示客服操作模態框 ===');
            
            // 重置表單數據
            this.csOperation = {
                targetAgentId: '',
                operationTarget: '',
                targetMemberId: '',
                transferType: '',
                amount: '',
                description: ''
            };
            this.agentMembers = [];
            
            console.log('當前allAgents數量:', this.allAgents.length);
            
            // 確保代理列表已加載
            if (this.allAgents.length === 0) {
                console.log('代理列表為空，開始加載...');
                await this.loadAllAgents();
            }
            
            console.log('加載後allAgents數量:', this.allAgents.length);
            console.log('allAgents內容:', this.allAgents);
            
            // 手動更新代理選擇列表
            this.updateAgentSelect();
            
            // 顯示模態框
            if (this.csOperationModal) {
                this.csOperationModal.show();
            } else {
                // 如果模態框還沒初始化，先初始化再顯示
                const csOperationModalEl = document.getElementById('csOperationModal');
                if (csOperationModalEl) {
                    this.csOperationModal = new bootstrap.Modal(csOperationModalEl);
                    this.csOperationModal.show();
                }
            }
            
            // 設置初始操作對象（默認為代理）
            setTimeout(() => {
                const targetAgent = document.getElementById('csTargetAgent');
                if (targetAgent) {
                    targetAgent.checked = true;
                    this.csOperation.operationTarget = 'agent';
                    this.onOperationTargetChange();
                }
            }, 200);
            
            // 添加事件監聽器
            setTimeout(() => {
                const targetAgent = document.getElementById('csTargetAgent');
                const targetMember = document.getElementById('csTargetMember');
                const agentSelect = document.getElementById('agentSelect');
                const memberSelect = document.getElementById('memberSelect');
                const amountInput = document.getElementById('amountInput');
                const depositRadio = document.getElementById('csDeposit');
                const withdrawRadio = document.getElementById('csWithdraw');
                
                // 移除之前的事件監聽器（避免重複）
                if (targetAgent) {
                    targetAgent.removeEventListener('change', this.handleOperationTargetChange);
                    targetAgent.addEventListener('change', this.handleOperationTargetChange.bind(this));
                }
                if (targetMember) {
                    targetMember.removeEventListener('change', this.handleOperationTargetChange);
                    targetMember.addEventListener('change', this.handleOperationTargetChange.bind(this));
                }
                if (agentSelect) {
                    agentSelect.removeEventListener('change', this.handleAgentSelectionChange);
                    agentSelect.addEventListener('change', this.handleAgentSelectionChange.bind(this));
                }
                if (memberSelect) {
                    memberSelect.removeEventListener('change', this.handleMemberSelectionChange);
                    memberSelect.addEventListener('change', this.handleMemberSelectionChange.bind(this));
                }
                if (amountInput) {
                    amountInput.removeEventListener('input', this.handleAmountChange);
                    amountInput.addEventListener('input', this.handleAmountChange.bind(this));
                }
                if (depositRadio) {
                    depositRadio.removeEventListener('change', this.handleTransferTypeChange);
                    depositRadio.addEventListener('change', this.handleTransferTypeChange.bind(this));
                }
                if (withdrawRadio) {
                    withdrawRadio.removeEventListener('change', this.handleTransferTypeChange);
                    withdrawRadio.addEventListener('change', this.handleTransferTypeChange.bind(this));
                }
                
                // 添加表單提交事件監聽器
                const submitBtn = document.getElementById('csOperationSubmitBtn');
                if (submitBtn) {
                    submitBtn.removeEventListener('click', this.handleSubmitCSOperation);
                    submitBtn.addEventListener('click', this.handleSubmitCSOperation.bind(this));
                }
                
                console.log('事件監聽器已添加');
            }, 300);
            
            console.log('=== 客服操作模態框顯示完成 ===');
        },
        
        // 事件處理器方法
        handleOperationTargetChange() {
            this.onOperationTargetChange();
        },
        
        handleAgentSelectionChange() {
            this.onAgentSelectionChange();
        },
        
        handleMemberSelectionChange() {
            const memberSelect = document.getElementById('memberSelect');
            const memberId = memberSelect ? memberSelect.value : '';
            this.csOperation.targetMemberId = memberId;
            this.updateCurrentBalanceDisplay();
        },
        
        handleAmountChange() {
            const amountInput = document.getElementById('amountInput');
            this.csOperation.amount = amountInput ? amountInput.value : '';
            this.updateFinalBalanceDisplay();
        },
        
        handleTransferTypeChange() {
            const depositRadio = document.getElementById('csDeposit');
            const withdrawRadio = document.getElementById('csWithdraw');
            
            if (depositRadio && depositRadio.checked) {
                this.csOperation.transferType = 'deposit';
            } else if (withdrawRadio && withdrawRadio.checked) {
                this.csOperation.transferType = 'withdraw';
            }
            this.updateFinalBalanceDisplay();
        },
        
        handleSubmitCSOperation() {
            console.log('處理表單提交');
            // 防止重複提交
            const submitBtn = document.getElementById('csOperationSubmitBtn');
            const spinner = document.getElementById('csOperationSpinner');
            
            if (submitBtn.disabled) {
                console.log('按鈕已禁用，防止重複提交');
                return;
            }
            
            // 驗證表單
            if (!this.isValidCSOperation) {
                console.log('表單驗證失敗');
                this.showMessage('請填寫完整的操作信息', 'error');
                return;
            }
            
            // 顯示載入狀態
            submitBtn.disabled = true;
            spinner.style.display = 'inline-block';
            
            // 調用提交方法
            this.submitCSOperation().finally(() => {
                // 恢復按鈕狀態
                submitBtn.disabled = false;
                spinner.style.display = 'none';
            });
        },
        
        hideCSOperationModal() {
            this.showCSOperationModal = false;
            this.csOperation = {
                targetAgentId: '',
                operationTarget: '',
                targetMemberId: '',
                transferType: '',
                amount: '',
                description: ''
            };
            this.agentMembers = [];
        },
        
        // 操作對象變化時的處理
        async onOperationTargetChange() {
            const targetAgent = document.getElementById('csTargetAgent');
            const targetMember = document.getElementById('csTargetMember');
            
            let operationTarget = '';
            if (targetAgent && targetAgent.checked) {
                operationTarget = 'agent';
            } else if (targetMember && targetMember.checked) {
                operationTarget = 'member';
            }
            
            console.log('操作對象變化:', operationTarget);
            this.csOperation.operationTarget = operationTarget;
            
            // 重置會員選擇和操作相關欄位（但保留代理選擇）
            this.csOperation.targetMemberId = '';
            this.csOperation.transferType = '';
            this.csOperation.amount = '';
            this.agentMembers = [];
            
            // 清空表單
            const memberSelect = document.getElementById('memberSelect');
            const amountInput = document.getElementById('amountInput');
            const currentBalanceInput = document.getElementById('currentBalanceInput');
            const finalBalanceInput = document.getElementById('finalBalanceInput');
            const depositRadio = document.getElementById('csDeposit');
            const withdrawRadio = document.getElementById('csWithdraw');
            
            if (memberSelect) memberSelect.value = '';
            if (amountInput) amountInput.value = '';
            if (currentBalanceInput) currentBalanceInput.value = '';
            if (finalBalanceInput) finalBalanceInput.value = '';
            if (depositRadio) depositRadio.checked = false;
            if (withdrawRadio) withdrawRadio.checked = false;
            
            // 顯示/隱藏相關元素
            const agentSelectDiv = document.getElementById('agentSelectDiv');
            const memberSelectDiv = document.getElementById('memberSelectDiv');
            const currentBalanceDiv = document.getElementById('currentBalanceDiv');
            const operationTypeDiv = document.getElementById('operationTypeDiv');
            const amountDiv = document.getElementById('amountDiv');
            const finalBalanceDiv = document.getElementById('finalBalanceDiv');
            
            if (operationTarget) {
                agentSelectDiv.style.display = 'block';
                this.updateAgentSelect();
            } else {
                agentSelectDiv.style.display = 'none';
                memberSelectDiv.style.display = 'none';
                currentBalanceDiv.style.display = 'none';
                operationTypeDiv.style.display = 'none';
                amountDiv.style.display = 'none';
                finalBalanceDiv.style.display = 'none';
            }
            
            // 清空會員選擇列表
            this.updateMemberSelect();
            
            // 如果改為會員操作且已經選擇了代理，則加載會員列表
            if (operationTarget === 'member' && this.csOperation.targetAgentId) {
                console.log('需要加載代理會員列表，代理ID:', this.csOperation.targetAgentId);
                await this.loadAgentMembers(this.csOperation.targetAgentId);
            }
            
            // 更新當前餘額顯示
            setTimeout(() => {
                this.updateCurrentBalanceDisplay();
            }, 100);
        },
        
        // 代理選擇變化時的處理
        async onAgentSelectionChange() {
            const agentSelect = document.getElementById('agentSelect');
            const agentId = agentSelect ? agentSelect.value : '';
            
            console.log('代理選擇變化:', agentId, '操作對象:', this.csOperation.operationTarget);
            this.csOperation.targetAgentId = agentId;
            
            // 重置會員選擇和操作相關欄位
            this.csOperation.targetMemberId = '';
            this.csOperation.transferType = '';
            this.csOperation.amount = '';
            this.agentMembers = [];
            
            // 清空表單
            const memberSelect = document.getElementById('memberSelect');
            const amountInput = document.getElementById('amountInput');
            const currentBalanceInput = document.getElementById('currentBalanceInput');
            const finalBalanceInput = document.getElementById('finalBalanceInput');
            const depositRadio = document.getElementById('csDeposit');
            const withdrawRadio = document.getElementById('csWithdraw');
            
            if (memberSelect) memberSelect.value = '';
            if (amountInput) amountInput.value = '';
            if (currentBalanceInput) currentBalanceInput.value = '';
            if (finalBalanceInput) finalBalanceInput.value = '';
            if (depositRadio) depositRadio.checked = false;
            if (withdrawRadio) withdrawRadio.checked = false;
            
            // 顯示/隱藏相關元素
            const memberSelectDiv = document.getElementById('memberSelectDiv');
            const currentBalanceDiv = document.getElementById('currentBalanceDiv');
            const operationTypeDiv = document.getElementById('operationTypeDiv');
            const amountDiv = document.getElementById('amountDiv');
            const finalBalanceDiv = document.getElementById('finalBalanceDiv');
            
            if (agentId) {
                // 根據操作對象決定是否顯示會員選擇
                if (this.csOperation.operationTarget === 'member') {
                    memberSelectDiv.style.display = 'block';
                    console.log('開始加載選中代理的會員列表，代理ID:', agentId);
                    await this.loadAgentMembers(agentId);
                } else {
                    memberSelectDiv.style.display = 'none';
                }
                
                currentBalanceDiv.style.display = 'block';
                operationTypeDiv.style.display = 'block';
                amountDiv.style.display = 'block';
                finalBalanceDiv.style.display = 'block';
            } else {
                memberSelectDiv.style.display = 'none';
                currentBalanceDiv.style.display = 'none';
                operationTypeDiv.style.display = 'none';
                amountDiv.style.display = 'none';
                finalBalanceDiv.style.display = 'none';
            }
            
            // 清空會員選擇列表
            this.updateMemberSelect();
            
            // 更新當前餘額顯示
            setTimeout(() => {
                this.updateCurrentBalanceDisplay();
            }, 100);
        },
        
        // 加載指定代理的會員列表
        async loadAgentMembers(agentId) {
            try {
                const response = await axios.get(`${API_BASE_URL}/members`, {
                    params: {
                        agentId: agentId,
                        status: -1, // 獲取所有狀態的會員
                        page: 1,
                        limit: 1000 // 設置較大的limit獲取所有會員
                    }
                });
                if (response.data.success) {
                    this.agentMembers = response.data.data.list || [];
                    console.log('加載代理會員列表成功:', this.agentMembers.length, this.agentMembers);
                    
                    // 確保每個會員都有正確的屬性
                    this.agentMembers.forEach((member, index) => {
                        console.log(`會員 ${index}:`, {
                            id: member.id,
                            username: member.username,
                            balance: member.balance,
                            formattedBalance: this.formatMoney(member.balance)
                        });
                        
                        // 確保數據類型正確
                        member.balance = parseFloat(member.balance) || 0;
                    });
                    
                    // 手動更新會員選擇下拉列表
                    this.updateMemberSelect();
                    
                    // 為會員選擇添加change事件監聽器
                    this.$nextTick(() => {
                        const memberSelect = document.getElementById('memberSelect');
                        if (memberSelect) {
                            memberSelect.addEventListener('change', () => {
                                this.updateCurrentBalanceDisplay();
                            });
                        }
                        this.updateCurrentBalanceDisplay();
                    });
                } else {
                    console.error('加載代理會員列表失敗:', response.data.message);
                    this.agentMembers = [];
                }
            } catch (error) {
                console.error('加載代理會員列表出錯:', error);
                this.agentMembers = [];
            }
        },
        
        // 手動更新代理選擇下拉列表
        updateAgentSelect() {
            const agentSelect = document.getElementById('agentSelect');
            if (!agentSelect) return;
            
            // 清除現有選項（保留第一個）
            while (agentSelect.children.length > 1) {
                agentSelect.removeChild(agentSelect.lastChild);
            }
            
            // 添加代理選項
            this.allAgents.forEach(agent => {
                // 代理操作：排除總代理（避免自己操作自己）
                // 會員操作：包含總代理（可以操作自己旗下的會員）
                const shouldInclude = this.csOperation.operationTarget === 'member' || agent.level !== 0;
                
                if (shouldInclude) {
                    const option = document.createElement('option');
                    option.value = agent.id;
                    option.textContent = `${agent.username} (${this.getLevelName(agent.level)}) - 餘額: ${this.formatMoney(agent.balance)}`;
                    agentSelect.appendChild(option);
                }
            });
            
            const totalOptions = agentSelect.children.length - 1; // 排除第一個默認選項
            console.log('已更新代理選擇列表，共', totalOptions, '個選項，操作類型:', this.csOperation.operationTarget);
        },
        
        // 手動更新會員選擇下拉列表
        updateMemberSelect() {
            const memberSelect = document.getElementById('memberSelect');
            if (!memberSelect) return;
            
            // 清除現有選項（保留第一個）
            while (memberSelect.children.length > 1) {
                memberSelect.removeChild(memberSelect.lastChild);
            }
            
            // 添加會員選項
            this.agentMembers.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = `${member.username} - 餘額: ${this.formatMoney(member.balance)}`;
                memberSelect.appendChild(option);
            });
            
            console.log('已更新會員選擇列表，共', this.agentMembers.length, '個選項');
        },
        
        // 更新當前餘額顯示
        updateCurrentBalanceDisplay() {
            const currentBalanceInput = document.getElementById('currentBalanceInput');
            if (currentBalanceInput) {
                const balance = this.getCurrentBalance();
                currentBalanceInput.value = balance !== null ? this.formatMoney(balance) : '';
                console.log('更新當前餘額顯示:', balance);
            }
        },
        
        // 更新操作後餘額顯示
        updateFinalBalanceDisplay() {
            const finalBalanceInput = document.getElementById('finalBalanceInput');
            if (finalBalanceInput) {
                const finalBalance = this.calculateFinalBalance();
                finalBalanceInput.value = this.formatMoney(finalBalance);
                console.log('更新操作後餘額顯示:', finalBalance);
            }
        },
        
        // 獲取當前選中用戶的餘額
        getCurrentBalance() {
            console.log('獲取當前餘額:', {
                operationTarget: this.csOperation.operationTarget,
                targetAgentId: this.csOperation.targetAgentId,
                targetMemberId: this.csOperation.targetMemberId,
                allAgents: this.allAgents.length,
                agentMembers: this.agentMembers.length
            });
            
            if (this.csOperation.operationTarget === 'agent' && this.csOperation.targetAgentId) {
                const selectedAgent = this.allAgents.find(agent => agent.id == this.csOperation.targetAgentId);
                console.log('找到代理:', selectedAgent);
                return selectedAgent ? parseFloat(selectedAgent.balance) : null;
            } else if (this.csOperation.operationTarget === 'member' && this.csOperation.targetMemberId) {
                const selectedMember = this.agentMembers.find(member => member.id == this.csOperation.targetMemberId);
                console.log('找到會員:', selectedMember);
                return selectedMember ? parseFloat(selectedMember.balance) : null;
            }
            return null;
        },
        
        // 計算操作後的最終餘額
        calculateFinalBalance() {
            const currentBalance = this.getCurrentBalance();
            const amount = parseFloat(this.csOperation.amount) || 0;
            
            if (currentBalance === null || amount <= 0) {
                return currentBalance || 0;
            }
            
            if (this.csOperation.transferType === 'deposit') {
                return currentBalance + amount;
            } else if (this.csOperation.transferType === 'withdraw') {
                return currentBalance - amount;
            }
            
            return currentBalance;
        },
        
        async submitCSOperation() {
            console.log('開始提交客服操作');
            
            // 從DOM元素獲取最新值
            const targetAgent = document.getElementById('csTargetAgent');
            const targetMember = document.getElementById('csTargetMember');
            const agentSelect = document.getElementById('agentSelect');
            const memberSelect = document.getElementById('memberSelect');
            const amountInput = document.getElementById('amountInput');
            const depositRadio = document.getElementById('csDeposit');
            const withdrawRadio = document.getElementById('csWithdraw');
            const descriptionInput = document.getElementById('csOperationDescription');
            
            // 更新csOperation數據
            if (targetAgent && targetAgent.checked) {
                this.csOperation.operationTarget = 'agent';
            } else if (targetMember && targetMember.checked) {
                this.csOperation.operationTarget = 'member';
            }
            
            this.csOperation.targetAgentId = agentSelect ? agentSelect.value : '';
            this.csOperation.targetMemberId = memberSelect ? memberSelect.value : '';
            this.csOperation.amount = amountInput ? amountInput.value : '';
            
            if (depositRadio && depositRadio.checked) {
                this.csOperation.transferType = 'deposit';
            } else if (withdrawRadio && withdrawRadio.checked) {
                this.csOperation.transferType = 'withdraw';
            }
            
            this.csOperation.description = descriptionInput ? descriptionInput.value : '';
            
            console.log('表單數據:', this.csOperation);
            
            if (!this.isValidCSOperation) {
                this.showMessage('請檢查輸入資料', 'error');
                return;
            }
            
            try {
                this.loading = true;
                let response;
                
                const currentBalance = this.getCurrentBalance();
                const amount = parseFloat(this.csOperation.amount);
                
                console.log('操作詳情:', {
                    操作對象: this.csOperation.operationTarget,
                    當前餘額: currentBalance,
                    操作金額: amount,
                    操作類型: this.csOperation.transferType
                });
                
                if (this.csOperation.operationTarget === 'agent') {
                    // 代理操作 - 客服代表總代理進行點數轉移
                    // 存款 = 總代理轉給目標代理
                    // 提款 = 目標代理轉給總代理
                    response = await axios.post(`${API_BASE_URL}/cs-agent-transfer`, {
                        operatorId: this.user.id,
                        targetAgentId: this.csOperation.targetAgentId,
                        amount: amount,
                        transferType: this.csOperation.transferType, // 'deposit' 或 'withdraw'
                        description: this.csOperation.description || `客服${this.csOperation.transferType === 'deposit' ? '存款' : '提款'}`
                    });
                } else {
                    // 會員操作 - 客服代表代理進行點數轉移
                    // 存款 = 代理轉給會員
                    // 提款 = 會員轉給代理
                    const selectedMember = this.agentMembers.find(member => member.id == this.csOperation.targetMemberId);
                    response = await axios.post(`${API_BASE_URL}/cs-member-transfer`, {
                        operatorId: this.user.id,
                        agentId: this.csOperation.targetAgentId,
                        targetMemberUsername: selectedMember.username,
                        amount: amount,
                        transferType: this.csOperation.transferType, // 'deposit' 或 'withdraw'
                        description: this.csOperation.description || `客服${this.csOperation.transferType === 'deposit' ? '存款' : '提款'}`
                    });
                }
                
                if (response.data.success) {
                    this.showMessage('餘額調整成功!', 'success');
                    
                    // 保存操作類型和代理ID，用於後續刷新
                    const wasMembeOperation = this.csOperation.operationTarget === 'member';
                    const targetAgentId = this.csOperation.targetAgentId;
                    
                    // 隱藏模態框
                    if (this.csOperationModal) {
                        this.csOperationModal.hide();
                    }
                    this.hideCSOperationModal();
                    
                    // 重置操作表單
                    this.csOperation = {
                        targetAgentId: '',
                        operationTarget: '',
                        targetMemberId: '',
                        transferType: '',
                        amount: '',
                        description: ''
                    };
                    
                    // 全面刷新所有相關數據
                    const refreshPromises = [
                        this.loadCSTransactions(), // 刷新客服交易記錄
                        this.loadAllAgents(),      // 刷新代理列表
                        this.fetchDashboardData()  // 刷新儀表板統計
                    ];
                    
                    // 如果操作的是會員，也要刷新會員列表
                    if (wasMembeOperation && targetAgentId) {
                        refreshPromises.push(this.loadAgentMembers(targetAgentId));
                    }
                    
                    // 如果當前在會員頁面，刷新會員列表
                    if (this.activeTab === 'members') {
                        refreshPromises.push(this.searchMembers());
                    }
                    
                    // 執行所有刷新操作
                    await Promise.all(refreshPromises);
                    
                    // 刷新當前用戶餘額（右上角顯示）
                    await this.refreshUserBalance();
                    
                    console.log('✅ 客服操作完成，所有數據已刷新');
                } else {
                    this.showMessage(response.data.message || '餘額調整失敗', 'error');
                }
            } catch (error) {
                console.error('客服操作出錯:', error);
                this.showMessage(error.response?.data?.message || '操作失敗，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 刷新當前用戶餘額
        async refreshUserBalance() {
            try {
                // 從所有代理列表中找到當前用戶並更新餘額
                if (this.isCustomerService && this.allAgents.length > 0) {
                    const currentUserAgent = this.allAgents.find(agent => agent.id == this.user.id);
                    if (currentUserAgent) {
                        this.user.balance = currentUserAgent.balance;
                        // 同時更新localStorage中的用戶資訊
                        localStorage.setItem('agent_user', JSON.stringify(this.user));
                        console.log('✅ 用戶餘額已更新:', this.formatMoney(this.user.balance));
                    }
                }
            } catch (error) {
                console.error('刷新用戶餘額失敗:', error);
            }
        },
        
        // 加載存款記錄
        async loadDepositRecords(page = 1) {
            this.loading = true;
            try {
                console.log('加載存款記錄...');
                const response = await fetch(`${API_BASE_URL}/transactions?agentId=${this.user.id}&type=deposit&page=${page}&limit=${this.depositPagination.limit}`);
                
                if (!response.ok) {
                    console.error('加載存款記錄失敗:', response.status);
                    this.depositRecords = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success) {
                    this.depositRecords = data.data.list || [];
                    this.depositPagination = {
                        page: data.data.page || 1,
                        limit: data.data.limit || 20,
                        total: data.data.total || 0
                    };
                    console.log('存款記錄載入成功，共有 ' + this.depositRecords.length + ' 筆記錄');
                } else {
                    console.error('存款記錄數據格式錯誤:', data);
                    this.depositRecords = [];
                }
            } catch (error) {
                console.error('加載存款記錄錯誤:', error);
                this.depositRecords = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 加載提款記錄
        async loadWithdrawRecords(page = 1) {
            this.loading = true;
            try {
                console.log('加載提款記錄...');
                const response = await fetch(`${API_BASE_URL}/transactions?agentId=${this.user.id}&type=withdraw&page=${page}&limit=${this.withdrawPagination.limit}`);
                
                if (!response.ok) {
                    console.error('加載提款記錄失敗:', response.status);
                    this.withdrawRecords = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success) {
                    this.withdrawRecords = data.data.list || [];
                    this.withdrawPagination = {
                        page: data.data.page || 1,
                        limit: data.data.limit || 20,
                        total: data.data.total || 0
                    };
                    console.log('提款記錄載入成功，共有 ' + this.withdrawRecords.length + ' 筆記錄');
                } else {
                    console.error('提款記錄數據格式錯誤:', data);
                    this.withdrawRecords = [];
                }
            } catch (error) {
                console.error('加載提款記錄錯誤:', error);
                this.withdrawRecords = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 重設代理密碼
        resetAgentPassword(agent) {
            this.resetPasswordData = {
                userType: 'agent',
                userId: agent.id,
                username: agent.username,
                newPassword: '',
                confirmPassword: ''
            };
            
            const modal = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
            modal.show();
        },
        
        // 重設會員密碼
        resetMemberPassword(member) {
            this.resetPasswordData = {
                userType: 'member',
                userId: member.id,
                username: member.username,
                newPassword: '',
                confirmPassword: ''
            };
            
            const modal = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
            modal.show();
        },
        
        // 提交密碼重設
        async submitPasswordReset() {
            if (!this.isPasswordResetValid) {
                this.showMessage('請確認密碼格式正確且兩次輸入一致', 'error');
                return;
            }
            
            this.loading = true;
            
            try {
                const endpoint = this.resetPasswordData.userType === 'agent' ? 'reset-agent-password' : 'reset-member-password';
                
                const response = await axios.post(`${API_BASE_URL}/${endpoint}`, {
                    userId: this.resetPasswordData.userId,
                    newPassword: this.resetPasswordData.newPassword,
                    operatorId: this.user.id // 記錄操作者
                });
                
                if (response.data.success) {
                    this.showMessage(`${this.resetPasswordData.userType === 'agent' ? '代理' : '會員'}密碼重設成功`, 'success');
                    
                    // 關閉模態框
                    const modal = bootstrap.Modal.getInstance(document.getElementById('resetPasswordModal'));
                    modal.hide();
                    
                    // 清空表單數據
                    this.resetPasswordData = {
                        userType: '',
                        userId: null,
                        username: '',
                        newPassword: '',
                        confirmPassword: ''
                    };
                } else {
                    this.showMessage(response.data.message || '密碼重設失敗', 'error');
                }
            } catch (error) {
                console.error('重設密碼錯誤:', error);
                this.showMessage(error.response?.data?.message || '密碼重設失敗，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 顯示個人資料模態框
        async showProfileModal() {
            console.log('顯示個人資料模態框');
            // 載入個人資料數據
            await this.loadProfileData();
            // 顯示 modal
            this.isProfileModalVisible = true;
        },
        
        // 隱藏個人資料模態框
        hideProfileModal() {
            this.isProfileModalVisible = false;
        },
        
        // 載入個人資料數據
        async loadProfileData() {
            this.profileLoading = true;
            
            try {
                const response = await axios.get(`${API_BASE_URL}/agent-profile/${this.user.id}`);
                
                if (response.data.success) {
                    // 更新個人資料數據
                    this.profileData = {
                        realName: response.data.data.real_name || '',
                        phone: response.data.data.phone || '',
                        email: response.data.data.email || '',
                        lineId: response.data.data.line_id || '',
                        telegram: response.data.data.telegram || '',
                        address: response.data.data.address || '',
                        remark: response.data.data.remark || ''
                    };
                } else {
                    console.log('首次載入個人資料，使用空白數據');
                }
            } catch (error) {
                console.error('載入個人資料錯誤:', error);
                // 如果載入失敗，使用空白數據
                this.profileData = {
                    realName: '',
                    phone: '',
                    email: '',
                    lineId: '',
                    telegram: '',
                    address: '',
                    remark: ''
                };
            } finally {
                this.profileLoading = false;
            }
        },
        
        // 更新個人資料
        async updateProfile() {
            console.log('開始更新個人資料...', this.user?.id);
             
             if (!this.user?.id) {
                 this.showMessage('用戶信息錯誤，請重新登入', 'error');
                 return;
             }
             
             this.profileLoading = true;
             
             try {
                 console.log('發送更新請求到:', `${API_BASE_URL}/update-agent-profile`);
                 
                 const response = await axios.post(`${API_BASE_URL}/update-agent-profile`, {
                     agentId: this.user.id,
                     realName: this.profileData.realName,
                     phone: this.profileData.phone,
                     email: this.profileData.email,
                     lineId: this.profileData.lineId,
                     telegram: this.profileData.telegram,
                     address: this.profileData.address,
                     remark: this.profileData.remark
                 }, {
                     timeout: 10000, // 10秒超時
                     headers: {
                         'Content-Type': 'application/json'
                     }
                 });
                 
                 console.log('收到API回應:', response.data);
                 
                 if (response.data.success) {
                     this.showMessage('個人資料更新成功', 'success');
                     
                     // 關閉 modal
                     this.hideProfileModal();
                 } else {
                     this.showMessage(response.data.message || '個人資料更新失敗', 'error');
                 }
             } catch (error) {
                 console.error('更新個人資料錯誤:', error);
                 console.error('錯誤詳情:', error.response);
                 
                 let errorMessage = '個人資料更新失敗，請稍後再試';
                 if (error.response?.data?.message) {
                     errorMessage = error.response.data.message;
                 } else if (error.message) {
                     errorMessage = error.message;
                 }
                 
                 this.showMessage(errorMessage, 'error');
             } finally {
                 console.log('更新個人資料完成');
                 this.profileLoading = false;
                 
                 // 額外的安全機制：確保按鈕狀態正確重置
                 setTimeout(() => {
                     if (this.profileLoading) {
                         console.warn('檢測到 profileLoading 狀態異常，強制重置');
                         this.profileLoading = false;
                     }
                 }, 1000);
             }
         },
    },
        
    // 計算屬性
    computed: {
        // 計算最終代理餘額（會員點數轉移用）- 作為計算屬性
        finalAgentBalance() {
            const currentBalance = parseFloat(this.agentCurrentBalance) || 0;
            const amount = parseFloat(this.transferAmount) || 0;
            
            if (this.transferType === 'deposit') {
                // 代理存入點數給會員，代理餘額減少
                return currentBalance - amount;
            } else {
                // 代理從會員提領點數，代理餘額增加
                return currentBalance + amount;
            }
        },
        
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
        },
        
        // 檢查代理點數轉移是否有效
        isValidAgentTransfer() {
            // 確保數值正確
            const amount = parseFloat(this.agentTransferAmount) || 0;
            const userBalance = parseFloat(this.user.balance) || 0;
            const agentBalance = parseFloat(this.agentBalanceData?.currentBalance) || 0;
            
            console.log('驗證代理點數轉移:', {
                amount, 
                userBalance, 
                agentBalance, 
                type: this.agentTransferType
            });
            
            // 金額必須大於0
            if (amount <= 0) {
                return false;
            }
            
            if (this.agentTransferType === 'deposit') {
                // 存入時，檢查上級代理(自己)餘額是否足夠
                return userBalance >= amount;
            } else if (this.agentTransferType === 'withdraw') {
                // 提領時，檢查下級代理餘額是否足夠
                return agentBalance >= amount;
            }
            
            return false;
        },
        
        // 檢查會員餘額修改是否有效
        isValidBalanceModification() {
            const amount = parseFloat(this.modifyBalanceAmount) || 0;
            if (amount <= 0) return false;
            
            if (this.modifyBalanceType === 'absolute') {
                return true; // 絕對值模式下，只要金額大於0即可
            } else {
                // 相對值模式下，如果是減少，則不能超過當前餘額
                if (this.balanceChangeDirection === 'decrease') {
                    const currentBalance = parseFloat(this.modifyBalanceData.currentBalance) || 0;
                    return amount <= currentBalance;
                }
                return true;
            }
        },
        
        // 檢查代理餘額修改是否有效
        isValidAgentBalanceModification() {
            const amount = parseFloat(this.agentModifyAmount) || 0;
            if (amount <= 0) return false;
            
            if (this.agentModifyType === 'absolute') {
                return true; // 絕對值模式下，只要金額大於0即可
            } else {
                // 相對值模式下，如果是減少，則不能超過當前餘額
                if (this.agentChangeDirection === 'decrease') {
                    const currentBalance = parseFloat(this.agentBalanceData.currentBalance) || 0;
                    return amount <= currentBalance;
                }
                return true;
            }
        },
        
        // 檢查客服操作是否有效
        isValidCSOperation() {
            const amount = parseFloat(this.csOperation.amount) || 0;
            
            if (amount <= 0) return false;
            if (!this.csOperation.operationTarget) return false;
            if (!this.csOperation.targetAgentId) return false;
            if (this.csOperation.operationTarget === 'member' && !this.csOperation.targetMemberId) return false;
            if (!this.csOperation.transferType) return false;
            
            return true;
        },
        
        // 檢查密碼重設是否有效
        isPasswordResetValid() {
            return (
                this.resetPasswordData.newPassword && 
                this.resetPasswordData.confirmPassword &&
                this.resetPasswordData.newPassword.length >= 6 &&
                this.resetPasswordData.newPassword === this.resetPasswordData.confirmPassword
            );
        },
        
        // 當前用戶名
        currentUsername() {
            console.log('計算currentUsername，user:', this.user);
            const username = this.user?.username || '載入中...';
            console.log('計算得到的username:', username);
            return username;
        },
        
        // 當前用戶級別
        currentUserLevel() {
            console.log('計算currentUserLevel，user.level:', this.user?.level);
            if (this.user?.level !== undefined && this.user?.level !== null) {
                const levelName = this.getLevelName(this.user.level);
                console.log('計算得到的levelName:', levelName);
                return levelName;
            }
            console.log('回傳載入中...');
            return '載入中...';
        }
    },
    
    // 監聽屬性
    watch: {
        // 當活動分頁變更時，加載對應數據
        activeTab(newTab, oldTab) {
            if (newTab === 'dashboard' && oldTab !== 'dashboard') {
                this.fetchDashboardData();
            }
            if (newTab === 'members') {
                this.searchMembers();
            }
            if (newTab === 'agents') {
                this.searchAgents();
            }
            if (newTab === 'draw') {
                this.loadDrawHistory();
            }
            if (newTab === 'stats') {
                this.searchBets();
            }
            if (newTab === 'notices') {
                this.fetchNotices();
            }
            if (newTab === 'transactions' && this.transactionTab === 'transfers') {
                this.loadPointTransfers();
            }
                                 if (newTab === 'customer-service' && this.user.level === 0) {
                         this.loadCSTransactions();
                     }
        },
        transactionTab(newTab, oldTab) {
            if (this.activeTab === 'transactions' && newTab === 'transfers') {
                this.loadPointTransfers();
            }
        }
    }
});

// 延遲掛載 Vue 應用，確保所有依賴都已載入
setTimeout(function() {
    console.log('延遲掛載 Vue 應用');
    console.log('Vue 可用性:', typeof Vue);
    console.log('Document 狀態:', document.readyState);
    
    const appElement = document.getElementById('app');
    console.log('找到 app 元素:', appElement);
    
    if (appElement && typeof Vue !== 'undefined') {
        try {
            // 檢查是否已經掛載過
            if (appElement.__vue_app__) {
                console.log('Vue 應用已經掛載過，跳過');
                return;
            }
            
            const mountedApp = app.mount('#app');
            console.log('Vue 應用掛載成功:', mountedApp);
            
            // 添加全域調試函數
            window.debugVue = function() {
                console.log('=== Vue 除錯資訊 ===');
                console.log('Vue 實例:', mountedApp);
                console.log('showNoticeForm:', mountedApp.showNoticeForm);
                console.log('noticeForm:', mountedApp.noticeForm);
                console.log('isCustomerService:', mountedApp.isCustomerService);
                
                // 測試顯示公告表單
                console.log('測試顯示公告表單...');
                mountedApp.startEditNotice({
                    id: 1,
                    title: '測試公告',
                    content: '這是測試內容',
                    category: '最新公告'
                });
            };
            
            window.closeForm = function() {
                mountedApp.showNoticeForm = false;
                console.log('強制關閉公告表單');
            };
            
            console.log('全域除錯函數已添加：debugVue() 和 closeForm()');
            
            // 額外檢查：確保響應式變數正常工作
            setTimeout(() => {
                if (mountedApp && mountedApp.noticeForm) {
                    console.log('Vue 響應式數據檢查:', {
                        noticeForm: mountedApp.noticeForm,
                        showNoticeForm: mountedApp.showNoticeForm
                    });
                }
            }, 1000);
            
        } catch (error) {
            console.error('Vue 應用掛載失敗:', error);
            console.error('錯誤詳情:', error.stack);
            
            // 嘗試重新整理頁面
            setTimeout(() => {
                if (confirm('系統載入失敗，是否重新整理頁面？')) {
                    window.location.reload();
                }
            }, 2000);
        }
    } else {
        console.error('條件不滿足:', {
            appElement: !!appElement,
            Vue: typeof Vue
        });
        
        // 嘗試等待更長時間
        setTimeout(arguments.callee, 500);
    }
}, 100);