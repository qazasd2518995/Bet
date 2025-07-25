// 投注记录組件 - 显示用戶的下注记录和派彩结果
Vue.component('bet-records', {
  // 使用render函數而不是template字符串，避免TypeScript错误提示
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
      if (!bet.settled) return '进行中';
      return bet.win ? '赢' : '输';
    },
    
    getBetTypeDesc(bet) {
      const typeMap = {
        'sumValue': '冠亞和',
        'champion': '冠军',
        'runnerup': '亚军',
        'third': '第三名',
        'fourth': '第四名',
        'fifth': '第五名',
        'sixth': '第六名',
        'seventh': '第七名',
        'eighth': '第八名',
        'ninth': '第九名',
        'tenth': '第十名',
        'number': `第${bet.position || ''}名号码`,
        'dragonTiger': '龙虎',
        'dragon_tiger': '龙虎',
        '龙虎': '龙虎',
        'position': '快速大小單双'  // 修復position类型显示
      };
      return typeMap[bet.betType || bet.type] || (bet.betType || bet.type);
    },
    
    getBetValueDesc(bet) {
      const value = bet.value;
      const betType = bet.betType || bet.type;
      
      if (betType === 'sumValue') {
        if (['big', 'small', 'odd', 'even'].includes(value)) {
          const valueMap = {
            'big': '大', 'small': '小', 'odd': '單', 'even': '双'
          };
          return valueMap[value];
        } else {
          return `和值 ${value}`;
        }
      } else if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(betType)) {
        const valueMap = {
          'big': '大', 'small': '小', 'odd': '單', 'even': '双'
        };
        return valueMap[value] || `号码 ${value}`;
      } else if (betType === 'number') {
        return `号码 ${value}`;
      } else if (betType === 'dragonTiger' || betType === 'dragon_tiger' || betType === '龙虎') {
        // 处理龙虎投注格式：dragon_1_10 -> 龙(冠军vs第10名)
        if (value && value.includes('_')) {
          const parts = value.split('_');
          if (parts.length === 3) {
            const dragonTiger = parts[0] === 'dragon' ? '龙' : '虎';
            const pos1 = parts[1] === '1' ? '冠军' : parts[1] === '2' ? '亚军' : `第${parts[1]}名`;
            const pos2 = parts[2] === '10' ? '第十名' : `第${parts[2]}名`;
            return `${dragonTiger}(${pos1}vs${pos2})`;
          }
        }
        return value === 'dragon' ? '龙' : '虎';
      } else if (betType === 'position') {
        // 处理position类型（快速大小單双）
        const valueMap = {
          'big': '大', 'small': '小', 'odd': '單', 'even': '双'
        };
        return valueMap[value] || value;
      }
      return value;
    },
    
    formatTime(time) {
      if (!time) return '';
      const date = new Date(time);
      // 转換为台北时區显示 - 手動加8小时
      const taipeiTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
      const month = (taipeiTime.getMonth() + 1).toString().padStart(2, '0');
      const day = taipeiTime.getDate().toString().padStart(2, '0');
      const hours = taipeiTime.getHours().toString().padStart(2, '0');
      const minutes = taipeiTime.getMinutes().toString().padStart(2, '0');
      return `${month}/${day} ${hours}:${minutes}`;
    },
    
    formatOdds(odds) {
      if (!odds) return '1.00';
      return parseFloat(odds).toFixed(2);
    },

    // 根据投注类型和值获取正确的赔率 - 動態支持A盤D盤
    getCorrectOdds(bet) {
      const betType = bet.betType || bet.type;
      const value = bet.value;
      
      // 如果bet对象已经有正确的赔率，直接使用（優先級最高）
      if (bet.odds && bet.odds > 0) {
        return bet.odds;
      }
      
      // 根据用戶盤口类型设置退水比例和基礎赔率
      const userMarketType = this.$parent?.userMarketType || sessionStorage.getItem('userMarketType') || 'D';
      
      let rebatePercentage, baseNumberOdds, baseTwoSideOdds;
      if (userMarketType === 'A') {
        // A盤配置：1.1%退水
        rebatePercentage = 0.011;
        baseNumberOdds = 10.0;  // A盤基礎单号赔率
        baseTwoSideOdds = 2.0; // A盤基礎两面赔率：2×(1-0.011)=1.978
      } else {
        // D盤配置：4.1%退水  
        rebatePercentage = 0.041;
        baseNumberOdds = 10.0;  // D盤基礎单号赔率
        baseTwoSideOdds = 2.0; // D盤基礎两面赔率：2×(1-0.041)=1.918
      }
      
      // 根据投注类型计算赔率
      if (betType === 'sumValue') {
        if (['big', 'small', 'odd', 'even'].includes(value)) {
          return parseFloat((baseTwoSideOdds * (1 - rebatePercentage)).toFixed(3));
        } else {
          // 冠亞和值赔率表 (扣除退水) - 使用新的基礎赔率表
          const baseOdds = {
            '3': 45.0, '4': 23.0, '5': 15.0, '6': 11.5, '7': 9.0,
            '8': 7.5, '9': 6.5, '10': 5.7, '11': 5.7, '12': 6.5,
            '13': 7.5, '14': 9.0, '15': 11.5, '16': 15.0, '17': 23.0,
            '18': 45.0, '19': 90.0
          };
          const baseOdd = baseOdds[value] || 1.0;
          return parseFloat((baseOdd * (1 - rebatePercentage)).toFixed(3));
        }
      } else if (betType === 'number') {
        return parseFloat((baseNumberOdds * (1 - rebatePercentage)).toFixed(3));
      } else if (betType === 'dragonTiger') {
        return parseFloat((baseTwoSideOdds * (1 - rebatePercentage)).toFixed(3));
      } else if (betType === 'position') {
        // position类型（快速大小單双）的赔率
        if (['big', 'small', 'odd', 'even'].includes(value)) {
          return parseFloat((baseTwoSideOdds * (1 - rebatePercentage)).toFixed(3));
        } else {
          return 1.0; // 无效值返回预設赔率
        }
      } else if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(betType)) {
        if (['big', 'small', 'odd', 'even'].includes(value)) {
          return parseFloat((baseTwoSideOdds * (1 - rebatePercentage)).toFixed(3));
        } else {
          return parseFloat((baseNumberOdds * (1 - rebatePercentage)).toFixed(3)); // 單号投注
        }
      }
      
      return 1.0; // 预設赔率
    },
    
    formatMoney(amount) {
      if (!amount) return '$0';
      return `$${parseFloat(amount).toFixed(2)}`;
    }
  },
  
  render(h) {
    // 使用render函數创建模板，避免TypeScript检查错误
    return h('div', { class: 'bet-records' }, [
      // 头部
      h('div', { class: 'record-header' }, [
        h('div', { class: 'title' }, '投注记录'),
        h('button', { 
          class: 'close-btn',
          on: { click: () => this.$emit('close') } 
        }, '×')
      ]),
      
      // 標籤页
      h('div', { class: 'record-tabs' }, [
        h('div', { 
          class: ['tab', this.activeTab === 'ongoing' ? 'active' : ''],
          on: { click: () => this.activeTab = 'ongoing' } 
        }, '进行中'),
        h('div', { 
          class: ['tab', this.activeTab === 'settled' ? 'active' : ''],
          on: { click: () => this.activeTab = 'settled' } 
        }, '已结算')
      ]),
      
      // 记录列表
      this.filteredRecords.length > 0 
        ? h('div', { class: 'record-list' }, 
            this.filteredRecords.map(bet => 
              h('div', { class: 'record-item', key: bet.id }, [
                // 顶部信息：期数和状态
                h('div', { class: 'record-top' }, [
                  h('div', { class: 'period' }, `${bet.period}期`),
                  h('div', { 
                    class: ['status', bet.settled ? (bet.win ? 'win' : 'lose') : 'ongoing'] 
                  }, this.getBetStatus(bet))
                ]),
                
                // 投注资讯區域：投注类型和选项
                h('div', { class: 'record-bet-info' }, [
                  h('div', { class: 'bet-detail-row' }, [
                    h('span', { class: 'bet-label' }, '投注类型:'),
                    h('span', { class: 'bet-value' }, this.getBetTypeDesc(bet))
                  ]),
                  h('div', { class: 'bet-detail-row' }, [
                    h('span', { class: 'bet-label' }, '投注选项:'),
                    h('span', { class: 'bet-value' }, this.getBetValueDesc(bet))
                  ]),
                  h('div', { class: 'bet-detail-row' }, [
                    h('span', { class: 'bet-label' }, '赔率:'),
                    h('span', { class: 'bet-value' }, this.formatOdds(this.getCorrectOdds(bet)))
                  ]),
                  // 开奖号码显示
                  bet.drawResult ? h('div', { class: 'bet-detail-row draw-result-row' }, [
                    h('span', { class: 'bet-label' }, '开奖号码:'),
                    h('div', { class: 'draw-result-balls' }, 
                      bet.drawResult.map((number, index) => 
                        h('div', { 
                          class: ['result-ball', `color-${number}`],
                          key: index 
                        }, number)
                      )
                    )
                  ]) : null
                ]),
                
                // 底部信息：金额和时间
                h('div', { class: 'record-bottom' }, [
                  // 时间信息
                  h('div', { class: 'bet-time-info' }, [
                    h('span', { class: 'bet-label' }, '下注时间:'),
                    h('span', { class: 'time-value' }, this.formatTime(bet.time))
                  ]),
                  
                  // 金额信息
                  h('div', { class: 'bet-amount-info' }, [
                    h('div', { class: 'amount-row' }, [
                      h('span', { class: 'amount-label' }, '下注金额:'),
                      h('span', { class: 'amount-value' }, this.formatMoney(bet.amount))
                    ]),
                    bet.settled && bet.win && bet.winAmount ? 
                      h('div', { class: 'amount-row win-amount' }, [
                        h('span', { class: 'amount-label' }, '派彩金额:'),
                        h('span', { class: 'amount-value' }, this.formatMoney(bet.winAmount))
                      ]) : null
                  ])
                ])
              ])
            )
          )
        : h('div', { class: 'no-records' }, '暫無记录')
    ]);
  }
});