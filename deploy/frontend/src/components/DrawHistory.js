// filepath: /Users/justin/Desktop/Bet/frontend/src/components/DrawHistory.js
// 開獎歷史組件 - 顯示歷史開獎結果，支持多種視圖模式
Vue.component('draw-history', {
  template: /* html */`
    <div class="draw-history">
      <div class="history-header">
        <div class="title">歷史開獎</div>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      
      <div class="draw-type-tabs">
        <div class="tabs">
          <div :class="['tab', viewMode === 'number' ? 'active' : '']" @click="viewMode = 'number'">號碼</div>
          <div :class="['tab', viewMode === 'bigSmall' ? 'active' : '']" @click="viewMode = 'bigSmall'">大小</div>
          <div :class="['tab', viewMode === 'oddEven' ? 'active' : '']" @click="viewMode = 'oddEven'">單雙</div>
          <div :class="['tab', viewMode === 'dragonTiger' ? 'active' : '']" @click="viewMode = 'dragonTiger'">冠亞和/龍虎</div>
        </div>
      </div>
      
      <!-- 日期選擇區域 -->
      <div class="date-selector">
        <div class="current-date" @click="showDatePicker = !showDatePicker">
          {{ formatDate(selectedDate) }} <i class="fas fa-calendar-alt"></i>
        </div>
        <!-- 日期選擇器彈窗 -->
        <div class="date-picker" v-if="showDatePicker">
          <div class="picker-header">
            <button @click="changeMonth(-1)">&lt;</button>
            <div class="month-year">{{ currentMonth }}月 <span @click="toggleYearSelector">{{ currentYear }}</span></div>
            <button @click="changeMonth(1)">&gt;</button>
          </div>
          
          <div class="weekdays">
            <div class="weekday" v-for="day in ['週日', '週一', '週二', '週三', '週四', '週五', '週六']">{{ day }}</div>
          </div>
          
          <div class="days">
            <div v-for="day in calendarDays" 
                 :class="['day', day.currentMonth ? '' : 'other-month', day.date.toDateString() === selectedDate.toDateString() ? 'selected' : '']"
                 @click="selectDate(day.date)">
              {{ day.date.getDate() }}
            </div>
          </div>
          
          <div class="picker-actions">
            <button class="cancel-btn" @click="showDatePicker = false">取消</button>
            <button class="confirm-btn" @click="confirmDateSelection">確認</button>
          </div>
        </div>
      </div>
      
      <!-- 開獎記錄列表 -->
      <div class="history-list">
        <!-- 號碼視圖 -->
        <div v-if="viewMode === 'number'" class="number-view">
          <div v-for="(record, index) in historyRecords" :key="record.period" class="history-item">
            <div class="period-info">
              <div class="period">{{ record.period }}期</div>
              <div class="time">{{ formatTime(record.time) }}</div>
            </div>
            <div class="result-balls">
              <div v-for="(number, ballIndex) in record.result" :key="ballIndex" 
                   :class="['number-ball', 'color-' + number]">
                {{ number }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- 大小視圖 -->
        <div v-if="viewMode === 'bigSmall'" class="bigsmall-view">
          <div v-for="(record, index) in historyRecords" :key="record.period" class="history-item">
            <div class="period-info">
              <div class="period">{{ record.period }}期</div>
              <div class="time">{{ formatTime(record.time) }}</div>
            </div>
            <div class="result-indicators">
              <div v-for="(number, ballIndex) in record.result" :key="ballIndex" 
                   :class="['indicator', number > 5 ? 'big' : 'small']">
                {{ number > 5 ? '大' : '小' }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- 單雙視圖 -->
        <div v-if="viewMode === 'oddEven'" class="oddeven-view">
          <div v-for="(record, index) in historyRecords" :key="record.period" class="history-item">
            <div class="period-info">
              <div class="period">{{ record.period }}期</div>
              <div class="time">{{ formatTime(record.time) }}</div>
            </div>
            <div class="result-indicators">
              <div v-for="(number, ballIndex) in record.result" :key="ballIndex" 
                   :class="['indicator', number % 2 === 1 ? 'odd' : 'even']">
                {{ number % 2 === 1 ? '單' : '雙' }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- 冠亞和/龍虎視圖 -->
        <div v-if="viewMode === 'dragonTiger'" class="dragontiger-view">
          <div v-for="(record, index) in historyRecords" :key="record.period" class="history-item">
            <div class="period-info">
              <div class="period">{{ record.period }}期</div>
              <div class="time">{{ formatTime(record.time) }}</div>
            </div>
            <div class="special-values">
              <div class="sum-value">
                {{ record.result[0] + record.result[1] }} 
                <span :class="getSumClass(record.result[0] + record.result[1])">
                  {{ getSumLabel(record.result[0] + record.result[1]) }}
                </span>
              </div>
              <div class="dragon-tiger">
                <span :class="record.result[0] > record.result[1] ? 'dragon' : 'tiger'">
                  {{ record.result[0] > record.result[1] ? '龍' : '虎' }}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 加載更多按鈕 -->
        <div class="load-more" @click="loadMoreHistory" v-if="hasMoreHistory">
          查看更多開獎結果
        </div>
        
        <!-- 無記錄提示 -->
        <div class="no-records" v-if="historyRecords.length === 0">
          暫無開獎記錄
        </div>
      </div>
    </div>
  `,
  
  props: {
    initialDate: {
      type: Date,
      default: () => new Date()
    }
  },
  
  data() {
    return {
      viewMode: 'number', // 視圖模式: number, bigSmall, oddEven, dragonTiger
      historyRecords: [], // 歷史記錄
      selectedDate: new Date(), // 當前選中日期
      currentYear: new Date().getFullYear(), // 當前日曆年份
      currentMonth: new Date().getMonth() + 1, // 當前日曆月份
      showDatePicker: false, // 是否顯示日期選擇器
      hasMoreHistory: true, // 是否有更多歷史記錄
      page: 1, // 當前頁碼
      itemsPerPage: 10 // 每頁記錄數
    };
  },
  
  computed: {
    // 計算日曆天數
    calendarDays() {
      const year = this.currentYear;
      const month = this.currentMonth - 1;
      
      // 獲取當前月份第一天
      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);
      
      // 獲取當前月份第一天是星期幾
      const firstDayWeekday = firstDayOfMonth.getDay();
      
      // 獲取上個月的最後幾天
      const days = [];
      const prevMonthLastDay = new Date(year, month, 0).getDate();
      
      // 添加上個月的日期
      for (let i = 0; i < firstDayWeekday; i++) {
        const date = new Date(year, month - 1, prevMonthLastDay - firstDayWeekday + i + 1);
        days.push({ date, currentMonth: false });
      }
      
      // 添加當前月份的日期
      for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
        const date = new Date(year, month, i);
        days.push({ date, currentMonth: true });
      }
      
      // 添加下個月的日期
      const remainingDays = 42 - days.length;
      for (let i = 1; i <= remainingDays; i++) {
        const date = new Date(year, month + 1, i);
        days.push({ date, currentMonth: false });
      }
      
      return days;
    }
  },
  
  created() {
    // 設置初始日期
    if (this.initialDate) {
      this.selectedDate = new Date(this.initialDate);
      this.currentYear = this.selectedDate.getFullYear();
      this.currentMonth = this.selectedDate.getMonth() + 1;
    }
    
    // 載入初始歷史記錄
    this.loadHistoryRecords();
  },
  
  methods: {
    // 載入歷史記錄
    async loadHistoryRecords() {
      try {
        // 格式化日期為YYYYMMDD格式
        const dateStr = this.formatDateForApi(this.selectedDate);
        
        const response = await axios.get(`${API_BASE_URL}/history`, {
          params: {
            date: dateStr,
            page: this.page,
            limit: this.itemsPerPage
          }
        });
        
        if (this.page === 1) {
          // 首次載入替換所有記錄
          this.historyRecords = response.data || [];
        } else {
          // 加載更多時追加記錄
          this.historyRecords = [...this.historyRecords, ...(response.data || [])];
        }
        
        // 判斷是否還有更多記錄
        this.hasMoreHistory = (response.data || []).length >= this.itemsPerPage;
      } catch (error) {
        console.error('獲取歷史記錄失敗:', error);
      }
    },
    
    // 載入更多歷史記錄
    loadMoreHistory() {
      this.page++;
      this.loadHistoryRecords();
    },
    
    // 選擇日期
    selectDate(date) {
      this.selectedDate = new Date(date);
    },
    
    // 確認日期選擇
    confirmDateSelection() {
      this.showDatePicker = false;
      this.page = 1;
      this.loadHistoryRecords();
    },
    
    // 改變月份
    changeMonth(diff) {
      let newMonth = this.currentMonth + diff;
      let newYear = this.currentYear;
      
      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      } else if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      }
      
      this.currentMonth = newMonth;
      this.currentYear = newYear;
    },
    
    // 切換年份選擇器
    toggleYearSelector() {
      // 這裡可以實現年份選擇的彈窗
      // 簡化版先不實現
    },
    
    // 格式化日期顯示
    formatDate(date) {
      if (!date) return '';
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },
    
    // 格式化日期為API請求格式
    formatDateForApi(date) {
      if (!date) return '';
      return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    },
    
    // 格式化時間顯示
    formatTime(time) {
      if (!time) return '';
      const date = new Date(time);
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    },
    
    // 獲取和值的樣式類
    getSumClass(sum) {
      let classes = [];
      if (sum > 11) {
        classes.push('big');
      } else {
        classes.push('small');
      }
      
      if (sum % 2 === 1) {
        classes.push('odd');
      } else {
        classes.push('even');
      }
      
      return classes.join(' ');
    },
    
    // 獲取和值的標籤
    getSumLabel(sum) {
      let label = '';
      if (sum > 11) {
        label += '大';
      } else {
        label += '小';
      }
      
      if (sum % 2 === 1) {
        label += '單';
      } else {
        label += '雙';
      }
      
      return label;
    }
  }
});