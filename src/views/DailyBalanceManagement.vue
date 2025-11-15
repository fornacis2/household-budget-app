<template>
  <div class="daily-balance-management">
    <h2>日次残高管理</h2>
    
    <div class="controls">
      <div class="date-controls">
        <label for="targetDate">対象日:</label>
        <input
          id="targetDate"
          v-model="targetDate"
          type="date"
          class="form-input"
        />
        <button @click="loadDailyBalances" class="btn-primary" :disabled="loading">
          {{ loading ? '読み込み中...' : '残高表示' }}
        </button>
      </div>
      
      <div class="recalc-controls">
        <h3>残高再計算</h3>
        <div class="form-group">
          <label for="startDate">開始日:</label>
          <input
            id="startDate"
            v-model="recalcStartDate"
            type="date"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="endDate">終了日:</label>
          <input
            id="endDate"
            v-model="recalcEndDate"
            type="date"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="accountFilter">対象口座:</label>
          <select
            id="accountFilter"
            v-model="selectedAccountId"
            class="form-select"
          >
            <option value="">全口座</option>
            <option value="cash">現金</option>
            <option
              v-for="account in bankAccounts"
              :key="account.accountId"
              :value="`bank-${account.accountId}`"
            >
              {{ account.bankName }}
            </option>
            <option
              v-for="card in creditCards"
              :key="card.cardId"
              :value="`credit-${card.cardId}`"
            >
              {{ card.cardName }}
            </option>
          </select>
        </div>
        <button @click="recalculateBalances" class="btn-secondary" :disabled="loading || !canRecalculate">
          {{ loading ? '計算中...' : '残高再計算' }}
        </button>
      </div>
    </div>

    <div v-if="dailyBalances.length > 0" class="balance-display">
      <h3>{{ targetDate }} の残高一覧</h3>
      <div class="balance-grid">
        <div
          v-for="balance in dailyBalances"
          :key="balance.accountId"
          class="balance-item"
        >
          <div class="account-info">
            <h4>{{ getAccountName(balance.accountId) }}</h4>
            <div class="account-type">{{ getAccountType(balance.accountId) }}</div>
          </div>
          <div class="balance-info">
            <div class="balance-amount" :class="getBalanceClass(balance.accountId, balance.balance)">
              ¥{{ balance.balance.toLocaleString() }}
            </div>
            <div class="transaction-count">
              取引件数: {{ balance.transactionCount }}件
            </div>
            <div class="updated-at">
              更新: {{ formatDateTime(balance.updatedAt) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="no-data">
      {{ targetDate }} の残高データがありません
    </div>

    <div v-if="message" class="message" :class="messageType">{{ message }}</div>
  </div>
</template>

<script>
import ApiService from '../services/api.js'

export default {
  name: 'DailyBalanceManagement',
  data() {
    return {
      targetDate: new Date().toISOString().split('T')[0],
      recalcStartDate: '',
      recalcEndDate: '',
      selectedAccountId: '',
      dailyBalances: [],
      bankAccounts: [],
      creditCards: [],
      loading: false,
      message: '',
      messageType: 'success'
    }
  },
  computed: {
    canRecalculate() {
      return this.recalcStartDate && this.recalcEndDate
    }
  },
  mounted() {
    this.loadAccountData()
    this.loadDailyBalances()
  },
  methods: {
    async loadAccountData() {
      try {
        const [bankResponse, creditResponse] = await Promise.all([
          ApiService.getBankAccounts(),
          ApiService.getCreditCards()
        ])
        
        this.bankAccounts = bankResponse.bankAccounts || []
        this.creditCards = creditResponse.creditCards || []
      } catch (error) {
        console.error('口座データの取得に失敗:', error)
      }
    },

    async loadDailyBalances() {
      try {
        this.loading = true
        const response = await ApiService.getDailyBalances(this.targetDate)
        this.dailyBalances = response.balances || []
        
        if (this.dailyBalances.length === 0) {
          this.showMessage('指定日の残高データがありません', 'warning')
        }
      } catch (error) {
        console.error('日次残高の取得に失敗:', error)
        this.showMessage('日次残高の取得に失敗しました', 'error')
      } finally {
        this.loading = false
      }
    },

    async recalculateBalances() {
      if (!this.canRecalculate) {
        this.showMessage('開始日と終了日を入力してください', 'error')
        return
      }

      if (!confirm('残高を再計算しますか？既存のデータは上書きされます。')) {
        return
      }

      try {
        this.loading = true
        
        const options = {
          startDate: this.recalcStartDate,
          endDate: this.recalcEndDate
        }
        
        if (this.selectedAccountId) {
          options.accountId = this.selectedAccountId
        }

        const response = await ApiService.recalculateDailyBalances(options)
        
        this.showMessage(
          `再計算完了: ${response.processedAccounts}口座を処理しました`, 
          'success'
        )
        
        // 現在表示中の日付が再計算範囲内なら再読み込み
        if (this.targetDate >= this.recalcStartDate && this.targetDate <= this.recalcEndDate) {
          await this.loadDailyBalances()
        }
        
      } catch (error) {
        console.error('残高再計算に失敗:', error)
        this.showMessage('残高再計算に失敗しました', 'error')
      } finally {
        this.loading = false
      }
    },

    getAccountName(accountId) {
      if (accountId === 'cash') {
        return '現金'
      }
      
      if (accountId.startsWith('bank-')) {
        const originalId = accountId.replace('bank-', '')
        const account = this.bankAccounts.find(acc => acc.accountId === originalId)
        return account ? account.bankName : '不明な銀行口座'
      }
      
      if (accountId.startsWith('credit-')) {
        const originalId = accountId.replace('credit-', '')
        const card = this.creditCards.find(card => card.cardId === originalId)
        return card ? card.cardName : '不明なクレジットカード'
      }
      
      return accountId
    },

    getAccountType(accountId) {
      if (accountId === 'cash') return '現金'
      if (accountId.startsWith('bank-')) return '銀行口座'
      if (accountId.startsWith('credit-')) return 'クレジットカード'
      return '不明'
    },

    getBalanceClass(accountId, balance) {
      if (accountId.startsWith('credit-')) {
        return balance > 0 ? 'negative' : 'positive'
      }
      return balance >= 0 ? 'positive' : 'negative'
    },

    formatDateTime(dateTimeString) {
      if (!dateTimeString) return ''
      const date = new Date(dateTimeString)
      return date.toLocaleString('ja-JP')
    },

    showMessage(text, type = 'success') {
      this.message = text
      this.messageType = type
      setTimeout(() => {
        this.message = ''
      }, 5000)
    }
  }
}
</script>

<style scoped>
.daily-balance-management {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid #eee;
}

.date-controls, .recalc-controls {
  background-color: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
}

.recalc-controls h3 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
}

.form-group {
  margin-bottom: 1rem;
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

.btn-primary, .btn-secondary {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  margin-top: 1rem;
}

.btn-primary {
  background-color: #3498db;
  color: white;
}

.btn-secondary {
  background-color: #95a5a6;
  color: white;
}

.btn-primary:disabled, .btn-secondary:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

.balance-display h3 {
  margin-bottom: 1rem;
  color: #2c3e50;
}

.balance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.balance-item {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1.5rem;
  background-color: #fff;
}

.account-info h4 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
}

.account-type {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 1rem;
}

.balance-amount {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.balance-amount.positive {
  color: #27ae60;
}

.balance-amount.negative {
  color: #e74c3c;
}

.transaction-count, .updated-at {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.no-data {
  text-align: center;
  color: #666;
  padding: 2rem;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.message {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 4px;
}

.message.success {
  background-color: #d4edda;
  color: #155724;
}

.message.warning {
  background-color: #fff3cd;
  color: #856404;
}

.message.error {
  background-color: #f8d7da;
  color: #721c24;
}
</style>