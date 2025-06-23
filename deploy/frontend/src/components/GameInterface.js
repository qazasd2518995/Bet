// filepath: /Users/justin/Desktop/Bet/frontend/src/components/GameInterface.js
// 遊戲界面主組件 - 根據設備類型提供適當的遊戲界面佈局

Vue.component('game-interface', {
  template: /* html */`
    <div class="game-interface game-container">
      <!-- 比賽結果顯示區 -->
      <div class="race-result">
        <h2 class="result-title">極速賽車 第{{currentPeriod}}期</h2>
        <div class="countdown">
          <div class="countdown-label">距離下期開獎:</div>
          <div class="countdown-timer">{{formatCountdown(countdown)}}</div>
        </div>
        
        <!-- 賽車軌道區域 - 根據設備類型有不同佈局 -->
        <div class="race-track" :class="{'desktop-layout': isDesktop}">
          <!-- 賽車內容（遊戲動畫）-->
          <div class="racing-content">
            <!-- 賽車會在這裡動畫顯示 -->
          </div>
          
          <!-- 當前開獎結果 - 球號顯示 -->
          <div class="current-result">
            <div v-for="(number, index) in currentResult" :key="index" 
                 :class="['number-ball', 'color-' + number]">
              {{ number }}
            </div>
          </div>
        </div>
      </div>
      
      <!-- 下注區域 - 根據設備類型自動調整排列方向 -->
      <div class="betting-area">
        <!-- 下注選項 -->
        <div class="bet-options">
          <div class="bet-type-tabs">
            <div :class="['tab', activeTab === 'number' ? 'active' : '']" 
                 @click="activeTab = 'number'">號碼</div>
            <div :class="['tab', activeTab === 'bigSmall' ? 'active' : '']" 
                 @click="activeTab = 'bigSmall'">大小</div>
            <div :class="['tab', activeTab === 'oddEven' ? 'active' : '']" 
                 @click="activeTab = 'oddEven'">單雙</div>
            <div :class="['tab', activeTab === 'combo' ? 'active' : '']" 
                 @click="activeTab = 'combo'">冠亞和/龍虎</div>
          </div>
          
          <div class="betting-content">
            <!-- 號碼投注 -->
            <div v-if="activeTab === 'number'" class="number-betting">
              <div class="ball-grid">
                <div v-for="num in 10" :key="num-1" 
                     :class="['ball-option', {'selected': isBetSelected('number', num-1)}]" 
                     @click="toggleBet('number', num-1)">
                  <div :class="['number-ball', 'color-' + (num-1)]">{{ num-1 }}</div>
                  <div class="odds">{{getBetOdds('number', num-1)}}</div>
                </div>
              </div>
            </div>
            
            <!-- 大小投注 -->
            <div v-if="activeTab === 'bigSmall'" class="bigsmall-betting">
              <div class="option-row">
                <div v-for="(option, index) in ['大', '小']" :key="index"
                     :class="['bet-option', {'selected': isBetSelected('bigSmall', option)}]" 
                     @click="toggleBet('bigSmall', option)">
                  <div class="option-label">{{ option }}</div>
                  <div class="odds">{{getBetOdds('bigSmall', option)}}</div>
                </div>
              </div>
            </div>
            
            <!-- 單雙投注 -->
            <div v-if="activeTab === 'oddEven'" class="oddeven-betting">
              <div class="option-row">
                <div v-for="(option, index) in ['單', '雙']" :key="index"
                     :class="['bet-option', {'selected': isBetSelected('oddEven', option)}]" 
                     @click="toggleBet('oddEven', option)">
                  <div class="option-label">{{ option }}</div>
                  <div class="odds">{{getBetOdds('oddEven', option)}}</div>
                </div>
              </div>
            </div>
            
            <!-- 冠亞和/龍虎投注 -->
            <div v-if="activeTab === 'combo'" class="combo-betting">
              <div class="option-section">
                <h3>冠亞和</h3>
                <div class="combo-grid">
                  <div v-for="sum in 19" :key="'sum-' + sum"
                       :class="['bet-option', {'selected': isBetSelected('sum', sum)}]" 
                       @click="toggleBet('sum', sum)">
                    <div class="option-label">{{ sum }}</div>
                    <div class="odds">{{getBetOdds('sum', sum)}}</div>
                  </div>
                </div>
              </div>
              
              <div class="option-section">
                <h3>龍虎</h3>
                <div class="option-row">
                  <div v-for="(option, index) in ['龍', '虎', '和']" :key="index"
                       :class="['bet-option', {'selected': isBetSelected('dragonTiger', option)}]" 
                       @click="toggleBet('dragonTiger', option)">
                    <div class="option-label">{{ option }}</div>
                    <div class="odds">{{getBetOdds('dragonTiger', option)}}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 投注單 -->
        <div class="bet-sidebar">
          <div class="bet-slip">
            <h3>投注單</h3>
            <div class="bet-list">
              <div v-for="(bet, index) in currentBets" :key="index" class="bet-item">
                <div class="bet-info">
                  <span class="bet-type">{{ getBetTypeLabel(bet.type) }}</span>
                  <span class="bet-value">{{ bet.value }}</span>
                  <span class="bet-odds">{{ bet.odds }}</span>
                </div>
                <div class="bet-amount">
                  <input type="number" v-model="bet.amount" placeholder="金額">
                  <button class="remove-bet" @click="removeBet(index)">×</button>
                </div>
              </div>
            </div>
            <div class="bet-actions">
              <div class="total-info">
                <div>總金額: {{calculateTotalAmount()}}</div>
                <div>可贏金額: {{calculatePossibleWin()}}</div>
              </div>
              <button class="place-bet-btn" @click="placeBets" :disabled="!canPlaceBet">投注</button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 顯示/隱藏歷史記錄控制按鈕 - 現在放在頂部 -->
      <div class="history-buttons">
        <button @click="toggleHistory" class="history-control-btn">
          {{ showHistory ? '關閉開獎歷史' : '開獎歷史' }}
        </button>
        <button @click="toggleBetRecords" class="history-control-btn">
          {{ showBetRecords ? '關閉住單資訊' : '住單資訊' }}
        </button>
      </div>
      
      <!-- 歷史記錄區域 - 浮動覆蓋顯示 -->
      <div class="modal-overlay" v-if="showHistory || showBetRecords" @click="closeAllModals"></div>
      
      <div class="history-modal" v-if="showHistory">
        <draw-history 
          :initialDate="new Date()" 
          @close="showHistory = false">
        </draw-history>
      </div>
      
      <div class="history-modal" v-if="showBetRecords">
        <bet-records 
          :userId="userId" 
          @close="showBetRecords = false">
        </bet-records>
      </div>
    </div>
  `,
  
  data() {
    return {
      isDesktop: false, // 是否為桌面設備
      activeTab: 'number', // 當前活躍的投注標籤
      currentPeriod: '20230001', // 當前期數
      countdown: 60, // 倒計時（秒）
      currentResult: [1, 3, 5, 7, 9, 2, 4, 6, 8, 0], // 當前開獎結果
      currentBets: [], // 當前投注清單
      userId: 'user123', // 用戶ID
      showHistory: false, // 是否顯示開獎歷史
      showBetRecords: false, // 是否顯示投注記錄
      // 賠率表 - 通常從伺服器加載
      odds: {
        number: [9.8, 9.8, 9.8, 9.8, 9.8, 9.8, 9.8, 9.8, 9.8, 9.8],
        bigSmall: { '大': 1.95, '小': 1.95 },
        oddEven: { '單': 1.95, '雙': 1.95 },
        sum: { 3: 40, 4: 20, 5: 10, 6: 8, 7: 7, 8: 6, 9: 5, 10: 4.5, 11: 4, 
               12: 4, 13: 4.5, 14: 5, 15: 6, 16: 7, 17: 8, 18: 10, 19: 20 },
        dragonTiger: { '龍': 1.95, '虎': 1.95, '和': 9.0 }
      }
    };
  },
  
  computed: {
    // 是否可以下注
    canPlaceBet() {
      return this.currentBets.length > 0 && 
             this.currentBets.every(bet => bet.amount > 0 && !isNaN(bet.amount));
    }
  },
  
  created() {
    // 監聽設備檢測模組的事件
    this.checkDeviceType();
    window.addEventListener('resize', this.checkDeviceType);
    
    // 模擬倒計時更新
    this.startCountdown();
  },
  
  beforeDestroy() {
    window.removeEventListener('resize', this.checkDeviceType);
    clearInterval(this.countdownInterval);
  },
  
  methods: {
    // 檢查設備類型
    checkDeviceType() {
      if (window.DeviceDetector) {
        this.isDesktop = window.DeviceDetector.detectDevice() === 'desktop';
        
        // 在桌面設備上同時顯示兩個歷史記錄區域
        if (this.isDesktop) {
          this.showHistory = true;
          this.showBetRecords = true;
        }
      }
    },
    
    // 格式化倒計時顯示
    formatCountdown(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs < 10 ? '0' + secs : secs}`;
    },
    
    // 開始倒計時
    startCountdown() {
      this.countdownInterval = setInterval(() => {
        if (this.countdown > 0) {
          this.countdown--;
        } else {
          // 當倒計時結束時，模擬新的一期開始
          this.countdown = 60; // 重設倒計時
          this.currentPeriod = String(parseInt(this.currentPeriod) + 1); // 更新期數
          this.generateNewResult(); // 生成新的結果
        }
      }, 1000);
    },
    
    // 生成新的開獎結果（模擬）
    generateNewResult() {
      // 隨機生成10個不重複的數字（0-9）
      const numbers = Array.from({length: 10}, (_, i) => i);
      for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]]; // 洗牌算法
      }
      this.currentResult = numbers;
    },
    
    // 檢查投注是否被選中
    isBetSelected(type, value) {
      return this.currentBets.some(bet => bet.type === type && bet.value === value);
    },
    
    // 切換投注選擇
    toggleBet(type, value) {
      const index = this.currentBets.findIndex(bet => bet.type === type && bet.value === value);
      if (index === -1) {
        // 添加新投注
        this.currentBets.push({
          type: type,
          value: value,
          odds: this.getBetOdds(type, value),
          amount: ''
        });
      } else {
        // 移除已有投注
        this.removeBet(index);
      }
    },
    
    // 獲取投注賠率
    getBetOdds(type, value) {
      if (type === 'number') {
        return this.odds.number[value];
      } else if (type === 'bigSmall') {
        return this.odds.bigSmall[value];
      } else if (type === 'oddEven') {
        return this.odds.oddEven[value];
      } else if (type === 'sum') {
        return this.odds.sum[value] || 0;
      } else if (type === 'dragonTiger') {
        return this.odds.dragonTiger[value];
      }
      return 0;
    },
    
    // 移除投注
    removeBet(index) {
      this.currentBets.splice(index, 1);
    },
    
    // 計算總金額
    calculateTotalAmount() {
      return this.currentBets.reduce((total, bet) => {
        return total + (parseFloat(bet.amount) || 0);
      }, 0).toFixed(2);
    },
    
    // 計算可能獲勝金額
    calculatePossibleWin() {
      return this.currentBets.reduce((total, bet) => {
        return total + (parseFloat(bet.amount) || 0) * parseFloat(bet.odds);
      }, 0).toFixed(2);
    },
    
    // 提交投注（實際應用中會發送到伺服器）
    placeBets() {
      if (!this.canPlaceBet) return;
      
      // 這裡應該有API調用將投注發送到伺服器
      alert(`已投注 ${this.calculateTotalAmount()} 元`);
      
      // 清空投注單
      this.currentBets = [];
    },
    
    // 獲取投注類型標籤
    getBetTypeLabel(type) {
      const typeMap = {
        'number': '號碼',
        'bigSmall': '大小',
        'oddEven': '單雙',
        'sum': '冠亞和',
        'dragonTiger': '龍虎'
      };
      return typeMap[type] || type;
    },
    
    // 切換開獎歷史顯示
    toggleHistory() {
      this.showHistory = !this.showHistory;
      // 確保不會同時顯示兩個模態窗口
      if (this.showHistory) this.showBetRecords = false;
    },
    
    // 切換投注記錄顯示
    toggleBetRecords() {
      this.showBetRecords = !this.showBetRecords;
      // 確保不會同時顯示兩個模態窗口
      if (this.showBetRecords) this.showHistory = false;
    },
    
    // 關閉所有模態窗口
    closeAllModals() {
      this.showHistory = false;
      this.showBetRecords = false;
    }
  }
}); 