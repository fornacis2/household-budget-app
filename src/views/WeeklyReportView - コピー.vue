<template>
  <div class="weekly-report-view">
    <h2>週別レポート</h2>
    
    <!-- 期間選択 -->
    <div class="period-selector">
      <div class="form-group">
        <label>対象週（開始日）</label>
        <div class="week-selector">
          <button @click="previousWeek" class="btn-week"><<前週</button>
          <input
            v-model="selectedWeekStart"
            type="date"
            @change="loadReportData"
            class="form-input"
          />
          <button @click="nextWeek" class="btn-week">翌週>></button>
        </div>
        <small class="date-help">選択した日を含む週（日曜日開始）を表示します</small>
      </div>
      
      <button @click="refreshData" class="btn-refresh" :disabled="loading">
        {{ loading ? '読込中...' : '更新' }}
      </button>
    </div>

    <!-- レポートテーブル -->
    <div class="report-table-container">
      <table class="report-table">
        <thead>
          <tr>
            <th class="category-header">カテゴリ</th>
            <th v-for="(date, index) in dateColumns" :key="index" class="date-header">
              <div class="date-header-content">
                <div class="date-line">{{ formatDateHeader(date) }}</div>
                <div class="day-line" :class="getDayClass(date)">{{ formatDayHeader(date) }}</div>
              </div>
            </th>
            <th class="total-header">合計</th>
            <th class="monthly-header">月計</th>
          </tr>
        </thead>
        <tbody>
          <!-- 収入セクション -->
          <tr class="section-header income-section">
            <td @click="toggleSection('income')" class="expandable">
              <span class="expand-icon">{{ expandedSections.income ? '▼' : '▶' }}</span>
              収入
            </td>
            <td v-for="(date, index) in dateColumns" :key="index" class="amount-cell income clickable" @click="navigateToTransactions('income', null, date)">
              ¥{{ getDateTotal('income', date).toLocaleString() }}
            </td>
            <td class="amount-cell income total">
              ¥{{ getSectionTotal('income').toLocaleString() }}
            </td>
            <td class="amount-cell income monthly">
              ¥{{ getMonthlyTotal('income').toLocaleString() }}
            </td>
          </tr>
          
          <!-- 収入カテゴリ詳細 -->
          <template v-if="expandedSections.income">
            <tr v-for="category in incomeCategories" :key="category.name" class="category-row">
              <td class="category-name">
                <span class="category-indent">└ {{ category.name }}</span>
              </td>
              <td v-for="(date, index) in dateColumns" :key="index" class="amount-cell clickable" @click="navigateToTransactions('income', category.name, date)">
                ¥{{ getCategoryAmount(category.name, 'income', date).toLocaleString() }}
              </td>
              <td class="amount-cell total">
                ¥{{ getCategoryTotal(category.name, 'income').toLocaleString() }}
              </td>
              <td class="amount-cell monthly">
                ¥{{ getCategoryMonthly(category.name, 'income').toLocaleString() }}
              </td>
            </tr>
          </template>

          <!-- 支出セクション -->
          <tr class="section-header expense-section">
            <td @click="toggleSection('expense')" class="expandable">
              <span class="expand-icon">{{ expandedSections.expense ? '▼' : '▶' }}</span>
              支出
            </td>
            <td v-for="(date, index) in dateColumns" :key="index" class="amount-cell expense clickable" @click="navigateToTransactions('expense', null, date)">
              ¥{{ getDateTotal('expense', date).toLocaleString() }}
            </td>
            <td class="amount-cell expense total">
              ¥{{ getSectionTotal('expense').toLocaleString() }}
            </td>
            <td class="amount-cell expense monthly">
              ¥{{ getMonthlyTotal('expense').toLocaleString() }}
            </td>
          </tr>
          
          <!-- 支出カテゴリ詳細 -->
          <template v-if="expandedSections.expense">
            <tr v-for="category in expenseCategories" :key="category.name" class="category-row">
              <td class="category-name">
                <span class="category-indent">└ {{ category.name }}</span>
              </td>
              <td v-for="(date, index) in dateColumns" :key="index" class="amount-cell clickable" @click="navigateToTransactions('expense', category.name, date)">
                ¥{{ getCategoryAmount(category.name, 'expense', date).toLocaleString() }}
              </td>
              <td class="amount-cell total">
                ¥{{ getCategoryTotal(category.name, 'expense').toLocaleString() }}
              </td>
              <td class="amount-cell monthly">
                ¥{{ getCategoryMonthly(category.name, 'expense').toLocaleString() }}
              </td>
            </tr>
          </template>

          <!-- 残高セクション -->
          <tr class="section-header balance-section">
            <td @click="toggleSection('balance')" class="expandable">
              <span class="expand-icon">{{ expandedSections.balance ? '▼' : '▶' }}</span>
              残高
            </td>
            <td v-for="(date, index) in dateColumns" :key="index" class="amount-cell balance">
              -
            </td>
            <td class="amount-cell balance total">
              -
            </td>
            <td class="amount-cell balance monthly">
              -
            </td>
          </tr>
          
          <!-- 残高詳細 -->
          <template v-if="expandedSections.balance">
            <!-- 現金残高 -->
            <tr class="category-row">
              <td class="category-name">
                <span class="category-indent">└ 現金</span>
              </td>
              <td v-for="(date, index) in dateColumns" :key="index" class="amount-cell">
                {{ getDailyBalance('cash', date) }}
              </td>
              <td class="amount-cell total">
                
              </td>
              <td class="amount-cell monthly">
                
              </td>
            </tr>
            
            <!-- 銀行口座残高 -->
            <tr v-for="account in bankAccounts" :key="account.accountId" class="category-row">
              <td class="category-name">
                <span class="category-indent">└ {{ account.bankName }}</span>
              </td>
              <td v-for="(date, index) in dateColumns" :key="index" class="amount-cell">
                {{ getDailyBalance(account.accountId, date) }}
              </td>
              <td class="amount-cell total">
                
              </td>
              <td class="amount-cell monthly">
                
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import ApiService from '../services/api.js'

export default {
  name: 'WeeklyReportView',
  data() {
    return {
      selectedWeekStart: new Date().toISOString().split('T')[0],
      transactions: [],
      categories: { income: [], expense: [] },
      bankAccounts: [],
      balances: {},
      expandedSections: {
        income: true,
        expense: true,
        balance: true
      },
      loading: false,
      cachedDateRange: {
        start: null,
        end: null
      }
    }
  },
  computed: {
    dateColumns() {
      const startDate = new Date(this.selectedWeekStart)
      const weekStartDate = this.getWeekStart(startDate)
      const dates = []
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(weekStartDate)
        currentDate.setDate(weekStartDate.getDate() + i)
        dates.push(currentDate.toISOString().split('T')[0])
      }
      return dates
    },
    
    incomeCategories() {
      return this.categories.income || []
    },
    
    expenseCategories() {
      return this.categories.expense || []
    }
  },
  mounted() {
    this.loadInitialData()
  },
  methods: {
    async loadInitialData() {
      await Promise.all([
        this.loadCategories(),
        this.loadBankAccounts(),
        this.loadReportData()
      ])
    },
    
    async loadCategories() {
      try {
        const response = await ApiService.getCategories()
        this.categories = response.categories
      } catch (error) {
        console.error('カテゴリの取得に失敗:', error)
      }
    },
    
    async loadBankAccounts() {
      try {
        const response = await ApiService.getBankAccounts()
        this.bankAccounts = response.bankAccounts || []
      } catch (error) {
        console.error('銀行口座の取得に失敗:', error)
      }
    },
    
    needsApiCall() {
      const weekStart = this.dateColumns[0]
      const weekEnd = this.dateColumns[6]
      
      return !this.cachedDateRange.start || 
             !this.cachedDateRange.end ||
             weekStart < this.cachedDateRange.start ||
             weekEnd > this.cachedDateRange.end
    },
    
    async loadReportData() {
      if (!this.needsApiCall()) {
        return
      }
      
      try {
        this.loading = true
        const weekStart = this.dateColumns[0]
        const weekEnd = this.dateColumns[6]
        const startMonth = weekStart.substring(0, 7)
        const endMonth = weekEnd.substring(0, 7)
        
        let apiStart, apiEnd
        if (startMonth === endMonth) {
          // 月跨がない: その月全体
          apiStart = startMonth + '-01'
          const year = parseInt(startMonth.substring(0, 4))
          const month = parseInt(startMonth.substring(5, 7))
          const lastDay = new Date(year, month, 0).getDate()
          apiEnd = startMonth + '-' + lastDay.toString().padStart(2, '0')
        } else {
          // 月跨ぐ: 開始月全体 + 終了月の週末まで
          apiStart = startMonth + '-01'
          apiEnd = weekEnd
        }
        
        const response = await ApiService.getTransactions(apiStart, apiEnd)
        this.transactions = response.transactions || []
        
        this.cachedDateRange = {
          start: apiStart,
          end: apiEnd
        }
        
        // 残高データを読み込み
        await this.loadBalances()
      } catch (error) {
        console.error('取引データの取得に失敗:', error)
      } finally {
        this.loading = false
      }
    },
    
    async refreshData() {
      await this.loadReportData()
    },
    
    async loadBalances() {
      try {
        const weekDates = this.dateColumns
        console.log('週の日付:', weekDates)
        
        // 範囲指定で一括読み込み
        const startDate = weekDates[0]
        const endDate = weekDates[6]
        
        const response = await ApiService.getDailyBalances(null, startDate, endDate)
        console.log(`${startDate}~${endDate}の日次残高:`, response)
        console.log(`残高配列:`, response.balances)
        
        // 日別に整理
        this.balances = { daily: {} }
        
        for (const date of weekDates) {
          this.balances.daily[date] = {
            cash: null,
            bankAccounts: {}
          }
          
          // 該当日の残高データを抽出
          const dayBalances = response.balances?.filter(b => b.date === date) || []
          console.log(`${date}の残高データ:`, dayBalances)
          
          // 現金残高
          const cashBalance = dayBalances.find(b => b.accountId === 'cash')
          console.log(`${date}の現金残高:`, cashBalance)
          this.balances.daily[date].cash = cashBalance ? cashBalance.balance : null
          
          // 銀行口座残高
          for (const account of this.bankAccounts) {
            const searchKey = `bank-${account.accountId}`
            console.log(`検索キー: ${searchKey}, 口座ID: ${account.accountId}`)
            const accountBalance = dayBalances.find(b => b.accountId === searchKey)
            console.log(`${account.bankName}の残高データ:`, accountBalance)
            this.balances.daily[date].bankAccounts[account.accountId] = accountBalance ? accountBalance.balance : null
          }
        }
        
        console.log('最終的な日別残高:', this.balances)
      } catch (error) {
        console.error('残高データの取得に失敗:', error)
        this.balances = { daily: {} }
      }
    },
    
    toggleSection(section) {
      this.expandedSections[section] = !this.expandedSections[section]
    },
    
    formatDateHeader(date) {
      const d = new Date(date)
      return `${d.getMonth() + 1}/${d.getDate()}`
    },
    
    formatDayHeader(date) {
      const d = new Date(date)
      const days = ['日', '月', '火', '水', '木', '金', '土']
      return days[d.getDay()]
    },
    
    getDayClass(date) {
      const d = new Date(date)
      const dayOfWeek = d.getDay()
      if (dayOfWeek === 0) return 'sunday'
      if (dayOfWeek === 6) return 'saturday'
      return ''
    },
    
    getDateTotal(type, date) {
      return this.transactions
        .filter(t => t.type === type && t.date === date)
        .reduce((sum, t) => sum + (t.amount || 0), 0)
    },
    
    getSectionTotal(type) {
      return this.dateColumns.reduce((total, date) => {
        return total + this.getDateTotal(type, date)
      }, 0)
    },
    
    getMonthlyTotal(type) {
      const weekStartDate = new Date(this.selectedWeekStart)
      const firstDayOfWeek = this.getWeekStart(weekStartDate)
      const year = firstDayOfWeek.getFullYear()
      const month = firstDayOfWeek.getMonth() + 1
      
      return this.transactions
        .filter(t => {
          const tDate = new Date(t.date)
          return t.type === type && 
                 tDate.getFullYear() === year && 
                 tDate.getMonth() + 1 === month
        })
        .reduce((sum, t) => sum + (t.amount || 0), 0)
    },
    
    getCategoryAmount(categoryName, type, date) {
      return this.transactions
        .filter(t => t.type === type && t.category === categoryName && t.date === date)
        .reduce((sum, t) => sum + (t.amount || 0), 0)
    },
    
    getCategoryTotal(categoryName, type) {
      return this.dateColumns.reduce((total, date) => {
        return total + this.getCategoryAmount(categoryName, type, date)
      }, 0)
    },
    
    getCategoryMonthly(categoryName, type) {
      const weekStartDate = new Date(this.selectedWeekStart)
      const firstDayOfWeek = this.getWeekStart(weekStartDate)
      const year = firstDayOfWeek.getFullYear()
      const month = firstDayOfWeek.getMonth() + 1
      
      return this.transactions
        .filter(t => {
          const tDate = new Date(t.date)
          return t.type === type && 
                 t.category === categoryName &&
                 tDate.getFullYear() === year && 
                 tDate.getMonth() + 1 === month
        })
        .reduce((sum, t) => sum + (t.amount || 0), 0)
    },
    
    getWeekStart(date) {
      const d = new Date(date)
      const day = d.getDay()
      const diff = d.getDate() - day
      return new Date(d.setDate(diff))
    },
    
    previousWeek() {
      const currentWeekStart = this.getWeekStart(new Date(this.selectedWeekStart))
      currentWeekStart.setDate(currentWeekStart.getDate() - 7)
      this.selectedWeekStart = currentWeekStart.toISOString().split('T')[0]
      this.loadReportData()
    },
    
    nextWeek() {
      const currentWeekStart = this.getWeekStart(new Date(this.selectedWeekStart))
      currentWeekStart.setDate(currentWeekStart.getDate() + 7)
      this.selectedWeekStart = currentWeekStart.toISOString().split('T')[0]
      this.loadReportData()
    },
    
    getDailyBalance(accountType, date) {
      if (!this.balances.daily || !this.balances.daily[date]) {
        return '-'
      }
      
      let balance
      if (accountType === 'cash') {
        balance = this.balances.daily[date].cash
      } else {
        balance = this.balances.daily[date].bankAccounts[accountType]
      }
      
      return (balance !== null && balance !== undefined) ? '¥' + balance.toLocaleString() : '-'
    },
    
    navigateToTransactions(type, category, date) {
      const query = {
        date: date,
        type: type
      }
      
      if (category) {
        query.category = category
      }
      
      this.$router.push({
        path: '/transactions',
        query: query
      })
    }
  }
}
</script>

<style scoped>
.weekly-report-view {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.period-selector {
  display: flex;
  gap: 1rem;
  align-items: end;
  margin-bottom: 2rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 0.5rem;
  font-weight: bold;
  color: #333;
}

.week-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-width: 120px;
}

.btn-week {
  background-color: #95a5a6;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-week:hover {
  background-color: #7f8c8d;
}

.btn-refresh {
  background-color: #3498db;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  height: fit-content;
}

.btn-refresh:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

.report-table-container {
  border: 1px solid #ddd;
  border-radius: 4px;
}

.report-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.report-table th,
.report-table td {
  padding: 0.5rem;
  text-align: right;
  border: 1px solid #e0e0e0;
  word-wrap: break-word;
}

.category-header {
  text-align: left !important;
  background-color: #f5f5f5;
  font-weight: bold;
  width: 25%;
}

.date-header,
.total-header,
.monthly-header {
  background-color: #f5f5f5;
  font-weight: bold;
  width: calc(75% / 9);
}

.date-header-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.date-line {
  font-size: 0.9rem;
  margin-bottom: 0.2rem;
}

.day-line {
  font-size: 0.8rem;
  color: #666;
  font-weight: normal;
}

.day-line.sunday {
  color: #e74c3c;
}

.day-line.saturday {
  color: #3498db;
}

.section-header {
  background-color: #e8f5e8;
  font-weight: bold;
}

.section-header.income-section {
  background-color: #e8f5e8;
}

.section-header.expense-section {
  background-color: #ffe8e8;
}

.section-header.balance-section {
  background-color: #e8f4fd;
}

.expandable {
  cursor: pointer;
  text-align: left !important;
}

.expand-icon {
  margin-right: 0.5rem;
  font-size: 0.8rem;
}

.category-row {
  background-color: #fafafa;
}

.category-name {
  text-align: left !important;
}

.category-indent {
  margin-left: 1rem;
  color: #666;
}

.amount-cell {
  font-family: 'Courier New', monospace;
}

.amount-cell.income {
  color: #27ae60;
}

.amount-cell.expense {
  color: #e74c3c;
}

.amount-cell.total {
  background-color: #f0f0f0;
  font-weight: bold;
}

.amount-cell.monthly {
  background-color: #e6f3ff;
  font-weight: bold;
}

.amount-cell.clickable {
  cursor: pointer;
  transition: background-color 0.2s;
}

.amount-cell.clickable:hover {
  background-color: #f0f8ff;
}

.date-help {
  color: #666;
  font-size: 0.8rem;
  margin-top: 0.25rem;
  display: block;
}
</style>