<template>
  <div class="yearly-report-view">
    <h2>年別レポート</h2>
    
    <!-- 期間選択 -->
    <div class="period-selector">
      <div class="form-group">
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
            <th v-for="(month, index) in dateColumns" :key="index" class="date-header">
              {{ month.label }}
            </th>
            <th class="total-header">合計</th>
          </tr>
        </thead>
        <tbody>
          <!-- 収入セクション -->
          <tr class="section-header income-section">
            <td @click="toggleSection('income')" class="expandable">
              <span class="expand-icon">{{ expandedSections.income ? '▼' : '▶' }}</span>
              収入
            </td>
            <td v-for="(month, index) in dateColumns" :key="index" class="amount-cell income">
              ¥{{ getMonthTotal('income', month).toLocaleString() }}
            </td>
            <td class="amount-cell income total">
              ¥{{ getYearlyTotal('income').toLocaleString() }}
            </td>
          </tr>
          
          <!-- 収入カテゴリ詳細 -->
          <template v-if="expandedSections.income">
            <tr v-for="category in incomeCategories" :key="category.name" class="category-row">
              <td class="category-name">
                <span class="category-indent">└ {{ category.name }}</span>
              </td>
              <td v-for="(month, index) in dateColumns" :key="index" class="amount-cell">
                ¥{{ getCategoryMonthAmount(category.name, 'income', month).toLocaleString() }}
              </td>
              <td class="amount-cell total">
                ¥{{ getCategoryYearlyTotal(category.name, 'income').toLocaleString() }}
              </td>
            </tr>
          </template>

          <!-- 支出セクション -->
          <tr class="section-header expense-section">
            <td @click="toggleSection('expense')" class="expandable">
              <span class="expand-icon">{{ expandedSections.expense ? '▼' : '▶' }}</span>
              支出
            </td>
            <td v-for="(month, index) in dateColumns" :key="index" class="amount-cell expense">
              ¥{{ getMonthTotal('expense', month).toLocaleString() }}
            </td>
            <td class="amount-cell expense total">
              ¥{{ getYearlyTotal('expense').toLocaleString() }}
            </td>
          </tr>
          
          <!-- 支出カテゴリ詳細 -->
          <template v-if="expandedSections.expense">
            <tr v-for="category in expenseCategories" :key="category.name" class="category-row">
              <td class="category-name">
                <span class="category-indent">└ {{ category.name }}</span>
              </td>
              <td v-for="(month, index) in dateColumns" :key="index" class="amount-cell">
                ¥{{ getCategoryMonthAmount(category.name, 'expense', month).toLocaleString() }}
              </td>
              <td class="amount-cell total">
                ¥{{ getCategoryYearlyTotal(category.name, 'expense').toLocaleString() }}
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
  name: 'YearlyReportView',
  data() {
    return {
      selectedYear: new Date().getFullYear(),
      transactions: [],
      categories: { income: [], expense: [] },
      expandedSections: {
        income: true,
        expense: true
      },
      loading: false
    }
  },
  computed: {
    dateColumns() {
      const months = []
      for (let month = 1; month <= 12; month++) {
        months.push({
          label: `${month}月`,
          start: `${this.selectedYear}-${month.toString().padStart(2, '0')}-01`,
          end: new Date(this.selectedYear, month, 0).toISOString().split('T')[0]
        })
      }
      return months
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
    
    async loadReportData() {
      try {
        this.loading = true
        const startDate = `${this.selectedYear}-01-01`
        const endDate = `${this.selectedYear}-12-31`
        const response = await ApiService.getTransactions(startDate, endDate)
        this.transactions = response.transactions || []
      } catch (error) {
        console.error('取引データの取得に失敗:', error)
      } finally {
        this.loading = false
      }
    },
    
    async refreshData() {
      await this.loadReportData()
    },
    
    toggleSection(section) {
      this.expandedSections[section] = !this.expandedSections[section]
    },
    
    getMonthTotal(type, month) {
      return this.transactions
        .filter(t => t.type === type && t.date >= month.start && t.date <= month.end)
        .reduce((sum, t) => sum + (t.amount || 0), 0)
    },
    
    getYearlyTotal(type) {
      return this.transactions
        .filter(t => t.type === type)
        .reduce((sum, t) => sum + (t.amount || 0), 0)
    },
    
    getCategoryMonthAmount(categoryName, type, month) {
      return this.transactions
        .filter(t => t.type === type && t.category === categoryName && 
                     t.date >= month.start && t.date <= month.end)
        .reduce((sum, t) => sum + (t.amount || 0), 0)
    },
    
    getCategoryYearlyTotal(categoryName, type) {
      return this.transactions
        .filter(t => t.type === type && t.category === categoryName)
        .reduce((sum, t) => sum + (t.amount || 0), 0)
    }
  }
}
</script>

<style scoped>
.yearly-report-view {
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

.form-input {
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
.total-header {
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
</style>