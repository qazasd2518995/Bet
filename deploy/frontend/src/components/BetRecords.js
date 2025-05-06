// 投注記錄組件 - 顯示用戶的下注記錄和派彩結果
Vue.component('bet-records', {
  // 使用render函數而不是template字符串，避免TypeScript錯誤提示
  props: {
    records: {
      type: Array,
      default: () => []
    }
  },
  
  data() {
    return {
      activeTab: 'ongoing'
    }
  },
  
  computed: {
    filteredRecords() {
      if (this.activeTab === 'ongoing') {
        return this.records.filter(bet => !bet.settled);
      } else {
        return this.records.filter(bet => bet.settled);
      }
    }
  },
  
  methods: {
    getBetStatus(bet) {
      if (!bet.settled) return '進行中';
      return bet.win ? '贏' : '輸';
    },
    
    getBetTypeDesc(bet) {
      const typeMap = {
        'sumValue': '冠亞和',
        'champion': '冠軍',
        'runnerup': '亞軍',
        'number': `第${bet.position}名`,
        'dragonTiger': '龍虎'
      };
      return typeMap[bet.type] || bet.type;
    },
    
    getBetValueDesc(bet) {
      if (bet.type === 'sumValue') {
        if (['big', 'small', 'odd', 'even'].includes(bet.value)) {
          const valueMap = {
            'big': '大', 'small': '小', 'odd': '單', 'even': '雙'
          };
          return valueMap[bet.value];
        } else {
          return `和值 ${bet.value}`;
        }
      } else if (bet.type === 'champion' || bet.type === 'runnerup') {
        const valueMap = {
          'big': '大', 'small': '小', 'odd': '單', 'even': '雙'
        };
        return valueMap[bet.value] || bet.value;
      } else if (bet.type === 'number') {
        return `號碼 ${bet.value}`;
      } else if (bet.type === 'dragonTiger') {
        return bet.value === 'dragon' ? '龍' : '虎';
      }
      return bet.value;
    },
    
    formatTime(time) {
      if (!time) return '';
      const date = new Date(time);
      return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
  },
  
  render(h) {
    // 使用render函數創建模板，避免TypeScript檢查錯誤
    return h('div', { class: 'bet-records' }, [
      // 頭部
      h('div', { class: 'record-header' }, [
        h('div', { class: 'title' }, '投注記錄'),
        h('button', { 
          class: 'close-btn',
          on: { click: () => this.$emit('close') } 
        }, '×')
      ]),
      
      // 標籤頁
      h('div', { class: 'record-tabs' }, [
        h('div', { 
          class: ['tab', this.activeTab === 'ongoing' ? 'active' : ''],
          on: { click: () => this.activeTab = 'ongoing' } 
        }, '進行中'),
        h('div', { 
          class: ['tab', this.activeTab === 'settled' ? 'active' : ''],
          on: { click: () => this.activeTab = 'settled' } 
        }, '已結算')
      ]),
      
      // 記錄列表
      this.filteredRecords.length > 0 
        ? h('div', { class: 'record-list' }, 
            this.filteredRecords.map(bet => 
              h('div', { class: 'record-item', key: bet.id }, [
                // 頂部信息
                h('div', { class: 'record-top' }, [
                  h('div', { class: 'period' }, `${bet.period}期`),
                  h('div', { 
                    class: ['status', bet.settled ? (bet.win ? 'win' : 'lose') : 'ongoing'] 
                  }, this.getBetStatus(bet))
                ]),
                
                // 內容區域
                h('div', { class: 'record-content' }, [
                  h('div', { class: 'bet-type' }, this.getBetTypeDesc(bet)),
                  h('div', { class: 'bet-value' }, this.getBetValueDesc(bet))
                ]),
                
                // 底部信息
                h('div', { class: 'record-bottom' }, [
                  h('div', { class: 'bet-time' }, this.formatTime(bet.time)),
                  h('div', { class: 'bet-amount' }, [
                    h('span', {}, `下注金額: $${bet.amount ? bet.amount : 0}`),
                    bet.settled && bet.win && bet.winAmount
                      ? h('span', {}, `派彩: $${bet.winAmount}`)
                      : null
                  ])
                ])
              ])
            )
          )
        : h('div', { class: 'no-records' }, '暫無記錄')
    ]);
  }
});