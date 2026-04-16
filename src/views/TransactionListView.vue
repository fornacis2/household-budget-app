<template>
  <div class="transaction-list-view">
    <h2>取引データ一覧</h2>
    
    <!-- 検索条件 -->
    <div class="search-section">
      <div class="search-controls">
        <div class="form-group">
          <label>開始日</label>
          <input v-model="startDate" type="date" class="form-input" />
        </div>
        <div class="form-group">
          <label>終了日</label>
          <input v-model="endDate" type="date" class="form-input" />
        </div>
        <button @click="searchTransactions" class="btn-search" :disabled="loading">
          {{ loading ? '検索中...' : '検索' }}
        </button>
        <div class="form-group">
          <label>カテゴリ</label>
          <select v-model="selectedCategory" @change="applyFilters" class="form-select">
            <option value="all">全て</option>
            <optgroup label="収入">
              <option value="income-all">収入（全て）</option>
              <option v-for="category in incomeCategories" :key="category.name" :value="`income-${category.name}`">
                {{ category.name }}
              </option>
            </optgroup>
            <optgroup label="支出">
              <option value="expense-all">支出（全て）</option>
              <option v-for="category in expenseCategories" :key="category.name" :value="`expense-${category.name}`">
                {{ category.name }}
              </option>
            </optgroup>
          </select>
        </div>
      </div>
    </div>

    <!-- 取引一覧 -->
    <div class="transactions-section">
      <div v-if="filteredTransactions.length === 0" class="no-data">
        取引データがありません
      </div>
      <div v-else>
        <div class="summary">
          表示件数: {{ filteredTransactions.length }}件
          <span v-if="selectedCategory !== 'all'">（フィルタ適用中）</span>
        </div>
        
        <table class="transactions-table">
          <thead>
            <tr>
              <th>日付</th>
              <th>カテゴリ</th>
              <th>サブカテゴリ</th>
              <th>金額</th>
              <th>タイプ</th>
              <th>口座</th>
              <th>メモ</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="transaction in sortedTransactions" :key="transaction.transactionId" class="transaction-row">
              <td>{{ formatDate(transaction.date) }}</td>
              <td>{{ transaction.category }}</td>
              <td>{{ transaction.subcategory || '-' }}</td>
              <td class="amount" :class="transaction.type">
                {{ transaction.type === 'income' ? '+' : '-' }}¥{{ transaction.amount.toLocaleString() }}
              </td>
              <td class="type" :class="transaction.type">
                {{ transaction.type === 'income' ? '収入' : '支出' }}
              </td>
              <td>{{ getAccountName(transaction) }}</td>
              <td>{{ transaction.memo || '-' }}</td>
              <td>
                <button @click="editTransaction(transaction)" class="btn-edit">
                  編集
                </button>
                <button @click="deleteTransaction(transaction)" class="btn-delete">
                  削除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
import ApiService from '../services/api.js'

export default {
  name: 'TransactionListView',
  data() {
    return {
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      selectedCategory: 'all',
      selectedType: 'all',
      transactions: [],
      categories: { income: [], expense: [] },
      bankAccounts: [],
      loading: false
    }
  },
  computed: {
    incomeCategories() {
      return this.categories.income || []
    },
    
    expenseCategories() {
      return this.categories.expense || []
    },
    
    filteredTransactions() {
      let filtered = this.transactions
      
      // カテゴリフィルタ
      if (this.selectedCategory !== 'all') {
        if (this.selectedCategory === 'income-all') {
          filtered = filtered.filter(t => t.type === 'income')
        } else if (this.selectedCategory === 'expense-all') {
          filtered = filtered.filter(t => t.type === 'expense')
        } else if (this.selectedCategory.startsWith('income-')) {
          const categoryName = this.selectedCategory.replace('income-', '')
          filtered = filtered.filter(t => t.type === 'income' && t.category === categoryName)
        } else if (this.selectedCategory.startsWith('expense-')) {
          const categoryName = this.selectedCategory.replace('expense-', '')
          filtered = filtered.filter(t => t.type === 'expense' && t.category === categoryName)
        }
      }
      
      return filtered
    },
    
    sortedTransactions() {
      return [...this.filteredTransactions].sort((a, b) => {
        const dateA = new Date(a.date)
        const dateB = new Date(b.date)
        if (dateA.getTime() !== dateB.getTime()) {
          return dateB - dateA
        }
        return new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp)
      })
    }
  },
  mounted() {
    this.applyQueryParams()
    this.loadInitialData()
  },
  methods: {
    applyQueryParams() {
      const query = this.$route.query
      
      // 日付指定（単日）
      if (query.date) {
        this.startDate = query.date
        this.endDate = query.date
      }
      
      // 期間指定
      if (query.startDate) {
        this.startDate = query.startDate
      }
      if (query.endDate) {
        this.endDate = query.endDate
      }
      
      // カテゴリ指定
      if (query.category && query.type) {
        this.selectedCategory = `${query.type}-${query.category}`
        this.selectedType = query.type
      } else if (query.type) {
        this.selectedCategory = `${query.type}-all`
        this.selectedType = query.type
      }
    },
    async loadInitialData() {
      await Promise.all([
        this.loadCategories(),
        this.loadBankAccounts(),
        this.searchTransactions()
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
    
    async searchTransactions() {
      try {
        this.loading = true
        const response = await ApiService.getTransactions(this.startDate, this.endDate)
        this.transactions = response.transactions || []
      } catch (error) {
        console.error('取引データの取得に失敗:', error)
      } finally {
        this.loading = false
      }
    },
    
    applyFilters() {
      // フィルタ変更時の処理（必要に応じて）
    },
    
    refreshTransactions(transaction) {
      this.$router.push({
        path: `/input/${transaction.transactionId}`
      })
    },
    
    editTransaction(transaction) {
      this.$router.push({
        path: `/input/${transaction.transactionId}`
      })
    },
    
    async deleteTransaction(transaction) {
      if (!confirm(`この取引を削除しますか？\n\n日付: ${this.formatDate(transaction.date)}\nカテゴリ: ${transaction.category}\n金額: ${transaction.amount.toLocaleString()}円`)) {
        return
      }
      
      try {
        this.loading = true
        await ApiService.deleteTransaction(transaction.transactionId)
        this.message = '取引を削除しました'
        await this.searchTransactions() // 一覧を再読み込み
      } catch (error) {
        console.error('取引削除に失敗:', error)
        this.message = '取引削除に失敗しました'
      } finally {
        this.loading = false
        setTimeout(() => {
          this.message = ''
        }, 3000)
      }
    },
    
    formatDate(dateString) {
      const date = new Date(dateString)
      return date.toLocaleDateString('ja-JP')
    },
    
    getAccountName(transaction) {
      if (!transaction.accountType || transaction.accountType === 'cash') {
        return '現金'
      } else if (transaction.accountType === 'bank') {
        const account = this.bankAccounts.find(acc => acc.accountId === transaction.accountId)
        return account ? account.bankName : '銀行口座'
      } else if (transaction.accountType === 'credit') {
        return 'クレジットカード'
      }
      return '-'
    }
  }
}
</script>

<style scoped>
.transaction-list-view {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.search-section {
  background-color: #f8f9fa;
  padding: 1.5rem;
  border-radius: 4px;
  margin-bottom: 2rem;
}

.search-controls {
  display: flex;
  gap: 1rem;
  align-items: end;
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

.form-input, .form-select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-width: 120px;
}

.btn-search {
  background-color: #3498db;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  height: fit-content;
}

.btn-search:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

.btn-search:hover:not(:disabled) {
  background-color: #2980b9;
}

.transactions-section {
  margin-top: 2rem;
}

.btn-edit {
  background-color: #27ae60;
  color: white;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  margin-right: 0.5rem;
}

.btn-edit:hover {
  background-color: #229954;
}

.btn-delete {
  background-color: #e74c3c;
  color: white;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.btn-delete:hover {
  background-color: #c0392b;
}

.btn-refresh-row {
  background-color: #27ae60;
  color: white;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.btn-refresh-row:hover {
  background-color: #229954;
}

.summary {
  margin-bottom: 1rem;
  color: #666;
  font-size: 0.9rem;
}

.no-data {
  text-align: center;
  color: #666;
  padding: 2rem;
}

.transactions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.transactions-table th,
.transactions-table td {
  padding: 0.75rem;
  text-align: left;
  border: 1px solid #e0e0e0;
}

.transactions-table th {
  background-color: #f5f5f5;
  font-weight: bold;
}

.transaction-row:hover {
  background-color: #f8f9fa;
}

.amount {
  text-align: right;
  font-family: 'Courier New', monospace;
  font-weight: bold;
}

.amount.income {
  color: #27ae60;
}

.amount.expense {
  color: #e74c3c;
}

.type.income {
  color: #27ae60;
  font-weight: bold;
}

.type.expense {
  color: #e74c3c;
  font-weight: bold;
}
</style>