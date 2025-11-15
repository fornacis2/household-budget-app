<template>
  <div class="transaction-input">
    <h2>取引入力</h2>
    <div class="input-form">
      <div class="form-group">
        <label>取引種別</label>
        <div class="radio-group">
          <label class="radio-label">
            <input v-model="transactionType" type="radio" value="income" />
            収入
          </label>
          <label class="radio-label">
            <input v-model="transactionType" type="radio" value="expense" />
            支出
          </label>
        </div>
      </div>

      <div class="form-group">
        <label for="date">日付</label>
        <input
          id="date"
          v-model="date"
          type="date"
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label for="amount">金額（円）</label>
        <input
          id="amount"
          v-model.number="amount"
          type="number"
          placeholder="例: 1000"
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label for="category">大分類</label>
        <select
          id="category"
          v-model="category"
          @change="onCategoryChange"
          class="form-select"
        >
          <option value="">カテゴリを選択してください</option>
          <option
            v-for="cat in availableCategories"
            :key="cat.categoryId"
            :value="cat.name"
          >
            {{ cat.name }}
          </option>
        </select>
      </div>

      <div class="form-group" v-if="availableSubcategories.length > 0">
        <label for="subcategory">内訳</label>
        <select
          id="subcategory"
          v-model="subcategory"
          class="form-select"
        >
          <option value="">内訳を選択してください</option>
          <option
            v-for="sub in availableSubcategories"
            :key="sub"
            :value="sub"
          >
            {{ sub }}
          </option>
        </select>
      </div>

      <div class="form-group" v-else-if="category">
        <label for="subcategory">内訳（任意）</label>
        <input
          id="subcategory"
          v-model="subcategory"
          type="text"
          placeholder="内訳を入力（省略可）"
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label for="accountType">取扱口座</label>
        <select
          id="accountType"
          v-model="selectedAccountId"
          class="form-select"
        >
          <option value="cash">現金</option>
          <option
            v-for="account in bankAccounts"
            :key="account.accountId"
            :value="account.accountId"
          >
            {{ account.bankName }}
          </option>
          <option
            v-for="card in creditCards"
            :key="card.cardId"
            :value="card.cardId"
          >
            {{ card.cardName }} (クレジットカード)
          </option>
        </select>
      </div>

      <div class="form-group">
        <label for="memo">備考</label>
        <input
          id="memo"
          v-model="memo"
          type="text"
          placeholder="メモ（任意）"
          class="form-input"
        />
      </div>

      <button @click="addTransaction" class="btn-primary" :disabled="loading">
        {{ loading ? '保存中...' : '取引を追加' }}
      </button>
      <div v-if="message" class="message">{{ message }}</div>
    </div>
  </div>
</template>

<script>
import ApiService from '../services/api.js'

export default {
  name: 'TransactionInput',
  data() {
    return {
      transactionType: 'expense',
      amount: 0,
      category: '',
      subcategory: '',
      memo: '',
      date: new Date().toISOString().split('T')[0],
      selectedAccountId: 'cash',
      message: '',
      loading: false,
      categories: {
        income: [],
        expense: []
      },
      bankAccounts: [],
      creditCards: [],
      selectedCategory: null
    }
  },
  mounted() {
    this.loadCategories()
    this.loadBankAccounts()
    this.loadCreditCards()
  },
  computed: {
    availableCategories() {
      return this.categories[this.transactionType] || []
    },
    availableSubcategories() {
      return this.selectedCategory?.subcategories || []
    }
  },
  watch: {
    transactionType() {
      this.resetCategorySelection()
    }
  },
  methods: {
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
    async loadCreditCards() {
      try {
        const response = await ApiService.getCreditCards()
        this.creditCards = response.creditCards || []
      } catch (error) {
        console.error('クレジットカードの取得に失敗:', error)
      }
    },
    onCategoryChange() {
      this.selectedCategory = this.availableCategories.find(cat => cat.name === this.category)
      this.subcategory = ''
    },
    resetCategorySelection() {
      this.category = ''
      this.subcategory = ''
      this.selectedCategory = null
    },
    async addTransaction() {
      if (!this.amount || !this.category) {
        this.message = '金額と大分類は必須です'
        return
      }

      const transaction = {
        type: this.transactionType,
        amount: this.amount,
        category: this.category,
        subcategory: this.subcategory,
        memo: this.memo,
        date: this.date,
        accountType: this.getAccountType(),
        accountId: this.selectedAccountId === 'cash' ? null : this.selectedAccountId
      }

      try {
        this.loading = true
        await ApiService.createTransaction(transaction)
        
        // フォールバック: ローカルストレージにも保存
        const localTransaction = {
          ...transaction,
          id: Date.now(),
          timestamp: new Date().toISOString()
        }
        const transactions = JSON.parse(localStorage.getItem('transactions') || '[]')
        transactions.push(localTransaction)
        localStorage.setItem('transactions', JSON.stringify(transactions))
        
        this.message = '取引を追加しました'
        this.resetForm()
      } catch (error) {
        console.error('取引の保存に失敗:', error)
        
        // フォールバック: ローカルストレージに保存
        const localTransaction = {
          ...transaction,
          id: Date.now(),
          timestamp: new Date().toISOString()
        }
        const transactions = JSON.parse(localStorage.getItem('transactions') || '[]')
        transactions.push(localTransaction)
        localStorage.setItem('transactions', JSON.stringify(transactions))
        
        this.message = '取引を追加しました（ローカル）'
        this.resetForm()
      } finally {
        this.loading = false
        setTimeout(() => {
          this.message = ''
        }, 3000)
      }
    },
    getAccountType() {
      if (this.selectedAccountId === 'cash') {
        return 'cash'
      }
      
      // 銀行口座かチェック
      const isBankAccount = this.bankAccounts.some(account => account.accountId === this.selectedAccountId)
      if (isBankAccount) {
        return 'bank'
      }
      
      // クレジットカードかチェック
      const isCreditCard = this.creditCards.some(card => card.cardId === this.selectedAccountId)
      if (isCreditCard) {
        return 'credit'
      }
      
      return 'cash'
    },
    resetForm() {
      this.amount = 0
      this.category = ''
      this.subcategory = ''
      this.memo = ''
      this.date = new Date().toISOString().split('T')[0]
      this.selectedAccountId = 'cash'
      this.selectedCategory = null
    }
  }
}
</script>

<style scoped>
.transaction-input {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.input-form {
  max-width: 500px;
}

.form-group {
  margin-bottom: 1.5rem;
}

.radio-group {
  display: flex;
  gap: 1rem;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
  color: #333;
}

.form-input, .form-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.form-select {
  background-color: white;
  cursor: pointer;
}

.btn-primary {
  background-color: #27ae60;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.btn-primary:hover {
  background-color: #229954;
}

.message {
  margin-top: 1rem;
  padding: 0.75rem;
  background-color: #d4edda;
  color: #155724;
  border-radius: 4px;
}
</style>