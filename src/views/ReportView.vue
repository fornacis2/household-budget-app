<template>
  <div class="report-view">
    <h2>レポート</h2>
    
    <!-- 期間選択 -->
    <div class="period-selector">
      <div class="form-group">
        <label>表示期間</label>
        <select v-model="selectedPeriod" @change="onPeriodChange" class="form-select">
          <option value="week">週別</option>
          <option value="year">年別</option>
        </select>
      </div>
      
      <div class="form-group" v-if="selectedPeriod === 'week'">
        <label>対象週（開始日）</label>
        <input
          v-model="selectedWeekStart"
          type="date"
          @change="loadReportData"
          class="form-input"
        />
        <small class="date-help">選択した日を含む週（日曜日開始）を表示します</small>
      </div>
      
      <div class="form-group" v-if="selectedPeriod === 'year'">
        <label>対象年</label>
        <input
          v-model="selectedYear"
          type="number"
          min="2020"
          max="2030"
          @change="loadReportData"
          class="form-input"
        />
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
              {{ formatDateHeader(date) }}
            </th>
            <th v-if="selectedPeriod === 'week'" class="total-header">合計</th>
            <th class="monthly-header">{{ selectedPeriod === 'week' ? '月計' : '合計' }}</th>
          </tr>
        </thead>
        <tbody>
          <!-- 収入セクション -->
          <tr class="section-header income-section">
            <td @click="toggleSection('income')" class="expandable">
              <span class="expand-icon">{{ expandedSections.income ? '▼' : '▶' }}</span>
              収入
            </td>
            <td v-for="(date, index) in dateColumns" :key="index" class="amount-cell income">
              ¥{{ getDateTotal('income', date).toLocaleString() }}
            </td>
            <td v-if="selectedPeriod === 'week'" class="amount-cell income total">
              ¥{{ getSectionTotal('income').toLocaleString() }}
            </td>
            <td class="amount-cell income monthly">
              ¥{{ getMonthlyTotal('income').toLocaleString() }}
            </td>
          </tr>
          
          <!-- 収入カテゴリ詳細 -->
          <template v-if="expandedSections.income">
            <tr
              v-for="category in incomeCategories"
              :key="category.name"
              class="category-row"
            >
              <td class="category-name">
                <span class="category-indent">└ {{ category.name }}</span>
              </td>
              <td v-for="(date, index) in dateColumns" :key="index" class="amount-cell">
                ¥{{ getCategoryAmount(category.name, 'income', date).toLocaleString() }}
              </td>
              <td v-if="selectedPeriod === 'week'" class="amount-cell total">
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
            <td v-for="(date, index) in dateColumns" :key="index" class="amount-cell expense">
              ¥{{ getDateTotal('expense', date).toLocaleString() }}
            </td>
            <td v-if="selectedPeriod === 'week'" class="amount-cell expense total">
              ¥{{ getSectionTotal('expense').toLocaleString() }}
            </td>
            <td class="amount-cell expense monthly">
              ¥{{ getMonthlyTotal('expense').toLocaleString() }}
            </td>
          </tr>
          
          <!-- 支出カテゴリ詳細 -->
          <template v-if="expandedSections.expense">
            <tr
              v-for="category in expenseCategories"
              :key="category.name"
              class="category-row"
            >
              <td class="category-name">
                <span class="category-indent">└ {{ category.name }}</span>
              </td>
              <td v-for="(date, index) in dateColumns" :key="index" class="amount-cell">
                ¥{{ getCategoryAmount(category.name, 'expense', date).toLocaleString() }}
              </td>
              <td v-if="selectedPeriod === 'week'" class="amount-cell total">
                ¥{{ getCategoryTotal(category.name, 'expense').toLocaleString() }}
              </td>
              <td class="amount-cell monthly">
                ¥{{ getCategoryMonthly(category.name, 'expense').toLocaleString() }}
              </td>
            </tr>
          </template>

          <!-- 口座セクション -->
          <tr class="section-header account-section">
            <td @click="toggleSection('accounts')" class="expandable">
              <span class="expand-icon">{{ expandedSections.accounts ? '▼' : '▶' }}</span>
              口座
            </td>
            <td v-for="(date, index) in dateColumns" :key="index" class="amount-cell neutral">
              -
            </td>
            <td v-if="selectedPeriod === 'week'" class="amount-cell neutral total">
              -
            </td>
            <td class="amount-cell neutral monthly">
              ¥{{ getTotalBalance().toLocaleString() }}
            </td>
          </tr>
          
          <!-- 口座詳細 -->
          <template v-if="expandedSections.accounts">
            <tr class="category-row">
              <td class="category-name">
                <span class="category-indent">└ 現金</span>
              </td>
              <td v-for="(date, index) in dateColumns" :key="index" class="amount-cell">
                -
              </td>
              <td v-if="selectedPeriod === 'week'" class="amount-cell total">
                -
              </td>
              <td class="amount-cell monthly">
                ¥{{ getCashBalance().toLocaleString() }}
              </td>
            </tr>
            <tr
              v-for="account in bankAccounts"
              :key="account.accountId"
              class="category-row"
            >
              <td class="category-name">
                <span class="category-indent">└ {{ account.bankName }}</span>
              </td>
              <td v-for="(date, index) in dateColumns" :key="index" class="amount-cell">
                -
              </td>
              <td v-if="selectedPeriod === 'week'" class="amount-cell total">
                -
              </td>
              <td class="amount-cell monthly">
                ¥{{ account.balance.toLocaleString() }}
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
  name: 'ReportView',
  data() {
    return {
      selectedPeriod: 'week',
      selectedDate: new Date().toISOString().slice(0, 7), // YYYY-MM
      selectedWeekStart: new Date().toISOString().split('T')[0],
      selectedYear: new Date().getFullYear(),
      transactions: [],
      categories: { income: [], expense: [] },
      bankAccounts: [],
      initialBalance: 0,
      expandedSections: {
        income: true,
        expense: true,
        accounts: false
      },
      loading: false
    }
  },
  computed: {
    dateColumns() {
      const period = this.selectedPeriod
      const weekStart = this.selectedWeekStart
      const year = this.selectedYear
      
      const dates = []
      
      if (period === 'week') {
        // 週別表示（7日間）
        const startDate = new Date(weekStart)
        const weekStartDate = this.getWeekStart(startDate)
        for (let i = 0; i < 7; i++) {
          const currentDate = new Date(weekStartDate)
          currentDate.setDate(weekStartDate.getDate() + i)
          dates.push(currentDate.toISOString().split('T')[0])
        }
      } else if (period === 'year') {
        // 年別表示（月単位）
        for (let month = 1; month <= 12; month++) {
          dates.push({
            label: `${month}月`,
            start: `${year}-${month.toString().padStart(2, '0')}-01`,
            end: new Date(year, month, 0).toISOString().split('T')[0]
          })
        }
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
        this.loadInitialBalance(),
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
    
    async loadInitialBalance() {
      try {
        const response = await ApiService.getInitialBalance()
        this.initialBalance = response.initialBalance || 0
      } catch (error) {
        console.error('初期残高の取得に失敗:', error)
      }
    },
    
    async loadReportData() {
      try {
        this.loading = true
        const response = await ApiService.getTransactions()
        this.transactions = response.transactions || []
      } catch (error) {
        console.error('取引データの取得に失敗:', error)
      } finally {
        this.loading = false
      }
    },
    
    onPeriodChange() {
      if (this.selectedPeriod === 'week') {
        if (!this.selectedWeekStart) {
          this.selectedWeekStart = new Date().toISOString().split('T')[0]
        }
        // 選択した日を含む週の開始日（日曜日）に調整
        const selectedDate = new Date(this.selectedWeekStart)
        const weekStart = this.getWeekStart(selectedDate)
        this.selectedWeekStart = weekStart.toISOString().split('T')[0]
      }
      this.loadReportData()
    },
    
    async refreshData() {
      await this.loadReportData()
    },
    

    
    toggleSection(section) {
      this.expandedSections[section] = !this.expandedSections[section]
    },
    
    formatDateHeader(date) {
      if (this.selectedPeriod === 'week') {
        const d = new Date(date)
        return `${d.getMonth() + 1}/${d.getDate()}`
      } else if (this.selectedPeriod === 'year' && date.label) {
        return date.label
      }
      return date
    },
    
    getDateTotal(type, date) {
      return this.transactions
        .filter(t => t.type === type && this.isDateInRange(t.date, date))
        .reduce((sum, t) => sum + (t.amount || 0), 0)
    },
    
    getSectionTotal(type) {
      if (this.selectedPeriod === 'week') {
        // 週の合計（7日間の合計）
        return this.dateColumns.reduce((total, date) => {
          return total + this.getDateTotal(type, date)
        }, 0)
      } else if (this.selectedPeriod === 'year') {
        // 年の合計
        return this.getYearlyTotal(type)
      }
      return 0
    },
    
    getMonthlyTotal(type) {
      if (this.selectedPeriod === 'week') {
        // 週別表示時の月計：週の初日（日曜日）が属する月の合計
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
      } else if (this.selectedPeriod === 'year') {
        return this.getYearlyTotal(type)
      }
      return 0
    },
    
    getYearlyTotal(type) {
      return this.transactions
        .filter(t => {
          const tDate = new Date(t.date)
          return t.type === type && tDate.getFullYear() == this.selectedYear
        })
        .reduce((sum, t) => sum + (t.amount || 0), 0)
    },
    
    getCategoryAmount(categoryName, type, date) {
      return this.transactions
        .filter(t => 
          t.type === type && 
          t.category === categoryName && 
          this.isDateInRange(t.date, date)
        )
        .reduce((sum, t) => sum + (t.amount || 0), 0)
    },
    
    getCategoryTotal(categoryName, type) {
      if (this.selectedPeriod === 'week') {
        // 週の合計（7日間の合計）
        return this.dateColumns.reduce((total, date) => {
          return total + this.getCategoryAmount(categoryName, type, date)
        }, 0)
      } else if (this.selectedPeriod === 'year') {
        return this.getCategoryYearly(categoryName, type)
      }
      return 0
    },
    
    getCategoryMonthly(categoryName, type) {
      if (this.selectedPeriod === 'week') {
        // 週別表示時の月計：週の初日（日曜日）が属する月の合計
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
      } else if (this.selectedPeriod === 'year') {
        return this.getCategoryYearly(categoryName, type)
      }
      return 0
    },
    
    getCategoryYearly(categoryName, type) {
      return this.transactions
        .filter(t => {
          const tDate = new Date(t.date)
          return t.type === type && 
                 t.category === categoryName &&
                 tDate.getFullYear() == this.selectedYear
        })
        .reduce((sum, t) => sum + (t.amount || 0), 0)
    },
    
    isDateInRange(transactionDate, rangeDate) {
      if (this.selectedPeriod === 'week') {
        return transactionDate === rangeDate
      } else if (this.selectedPeriod === 'year' && rangeDate.start) {
        return transactionDate >= rangeDate.start && transactionDate <= rangeDate.end
      }
      return false
    },
    
    getWeekStart(date) {
      const d = new Date(date)
      const day = d.getDay()
      const diff = d.getDate() - day
      return new Date(d.setDate(diff))
    },
    
    getTotalBalance() {
      const cashBalance = this.getCashBalance()
      const bankBalance = this.bankAccounts.reduce((sum, acc) => sum + acc.balance, 0)
      return cashBalance + bankBalance
    },
    
    getCashBalance() {
      const income = this.transactions
        .filter(t => t.type === 'income' && (!t.accountType || t.accountType === 'cash'))
        .reduce((sum, t) => sum + (t.amount || 0), 0)
      
      const expense = this.transactions
        .filter(t => t.type === 'expense' && (!t.accountType || t.accountType === 'cash'))
        .reduce((sum, t) => sum + (t.amount || 0), 0)
      
      return this.initialBalance + income - expense
    }
  }
}
</script>

<style scoped>
.report-view {
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

.form-select, .form-input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-width: 120px;
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
  overflow-x: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.report-table th,
.report-table td {
  padding: 0.5rem;
  text-align: right;
  border: 1px solid #e0e0e0;
}

.category-header {
  text-align: left !important;
  background-color: #f5f5f5;
  font-weight: bold;
  min-width: 200px;
}

.date-header,
.total-header,
.monthly-header {
  background-color: #f5f5f5;
  font-weight: bold;
  min-width: 80px;
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

.section-header.account-section {
  background-color: #e8f0ff;
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

.amount-cell.neutral {
  color: #7f8c8d;
}

.amount-cell.total {
  background-color: #f0f0f0;
  font-weight: bold;
}

.amount-cell.monthly {
  background-color: #e6f3ff;
  font-weight: bold;
}

.date-help {
  color: #666;
  font-size: 0.8rem;
  margin-top: 0.25rem;
  display: block;
}
</style>