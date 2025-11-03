<template>
  <div class="balance-view">
    <!-- 口座選択 -->
    <div class="account-selector">
      <h2>残高確認</h2>
      <div class="form-group">
        <label for="selectedAccount">口座選択</label>
        <select
          id="selectedAccount"
          v-model="selectedAccount"
          @change="onAccountChange"
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
        </select>
      </div>
    </div>

    <!-- 残高表示 -->
    <div class="balance-card">
      <h3>{{ balanceTitle }}</h3>
      <div class="balance-amount" :class="{ negative: currentBalance < 0 }">
        ¥{{ currentBalance.toLocaleString() }}
      </div>
    </div>

    <!-- 取引履歴 -->
    <div class="transactions-section">
      <h3>{{ transactionTitle }}</h3>
      <div v-if="filteredTransactions.length === 0" class="no-transactions">
        取引履歴がありません
      </div>
      <div v-else class="transactions-list">
        <div
          v-for="transaction in sortedTransactions"
          :key="transaction.transactionId || transaction.id"
          class="transaction-item"
          :class="transaction.type"
        >
          <div class="transaction-info">
            <div class="transaction-category">
              {{ transaction.category }}
              <span v-if="transaction.subcategory">/ {{ transaction.subcategory }}</span>
            </div>
            <div class="transaction-memo" v-if="transaction.memo">
              {{ transaction.memo }}
            </div>
            <div class="transaction-date">{{ formatDate(transaction.date) }}</div>
          </div>
          <div class="transaction-amounts">
            <div class="transaction-amount" :class="transaction.type">
              取引額: {{ transaction.type === 'income' ? '+' : '-' }}¥{{ transaction.amount.toLocaleString() }}
            </div>
            <div class="balance-after">
              取引後残高: ¥{{ calculateBalanceAfter(transaction).toLocaleString() }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import ApiService from '../services/api.js'

export default {
  name: 'BalanceView',
  data() {
    return {
      selectedAccount: 'cash',
      initialBalance: 0,
      transactions: [],
      bankAccounts: [],
      loading: false
    }
  },
  computed: {
    balanceTitle() {
      if (this.selectedAccount === 'cash') {
        return '現金残高'
      } else {
        const account = this.bankAccounts.find(acc => acc.accountId === this.selectedAccount)
        return account ? `${account.bankName} 残高` : '銀行口座残高'
      }
    },
    transactionTitle() {
      if (this.selectedAccount === 'cash') {
        return '現金取引履歴'
      } else {
        const account = this.bankAccounts.find(acc => acc.accountId === this.selectedAccount)
        return account ? `${account.bankName} 取引履歴` : '銀行口座取引履歴'
      }
    },
    currentBalance() {
      if (this.selectedAccount === 'cash') {
        // 現金残高計算
        const income = this.filteredTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0)
        
        const expense = this.filteredTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0)
        
        return this.initialBalance + income - expense
      } else {
        // 銀行口座残高
        const account = this.bankAccounts.find(acc => acc.accountId === this.selectedAccount)
        return account ? account.balance : 0
      }
    },
    filteredTransactions() {
      if (this.selectedAccount === 'cash') {
        // 現金取引（accountTypeがないまたはcash）
        return this.transactions.filter(t => !t.accountType || t.accountType === 'cash')
      } else {
        // 銀行口座取引
        return this.transactions.filter(t => 
          t.accountType === 'bank' && t.accountId === this.selectedAccount
        )
      }
    },
    sortedTransactions() {
      return [...this.filteredTransactions].sort((a, b) => 
        new Date(b.createdAt || b.timestamp || b.date) - new Date(a.createdAt || a.timestamp || a.date)
      )
    }
  },
  mounted() {
    this.loadData()
    this.loadBankAccounts()
  },
  methods: {
    async loadData() {
      try {
        this.loading = true
        
        // 初期残高取得
        const balanceResponse = await ApiService.getInitialBalance()
        this.initialBalance = balanceResponse.initialBalance || 0
        
        // 取引一覧取得
        const transactionsResponse = await ApiService.getTransactions()
        this.transactions = transactionsResponse.transactions || []
        
      } catch (error) {
        console.error('データの取得に失敗:', error)
        
        // フォールバック: ローカルストレージから取得
        const savedBalance = localStorage.getItem('initialBalance')
        if (savedBalance) {
          this.initialBalance = parseInt(savedBalance)
        }
        
        const savedTransactions = localStorage.getItem('transactions')
        if (savedTransactions) {
          this.transactions = JSON.parse(savedTransactions)
        }
      } finally {
        this.loading = false
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
    
    onAccountChange() {
      // 口座変更時の処理（必要に応じて）
    },
    formatDate(dateString) {
      const date = new Date(dateString)
      return date.toLocaleDateString('ja-JP')
    },
    
    calculateBalanceAfter(transaction) {
      if (this.selectedAccount === 'cash') {
        // 現金の場合：時系列で残高を計算
        const transactionDate = new Date(transaction.createdAt || transaction.timestamp || transaction.date)
        
        let balance = this.initialBalance
        
        // 対象取引より古い取引を時系列順で処理
        const olderTransactions = this.filteredTransactions
          .filter(t => {
            const tDate = new Date(t.createdAt || t.timestamp || t.date)
            return tDate <= transactionDate
          })
          .sort((a, b) => {
            const aDate = new Date(a.createdAt || a.timestamp || a.date)
            const bDate = new Date(b.createdAt || b.timestamp || b.date)
            return aDate - bDate
          })
        
        // 対象取引まで順次計算
        for (const t of olderTransactions) {
          if (t.type === 'income') {
            balance += t.amount
          } else {
            balance -= t.amount
          }
          
          // 対象取引に到達したら残高を返す
          if (t.transactionId === transaction.transactionId || t.id === transaction.id) {
            return balance
          }
        }
        
        return balance
      } else {
        // 銀行口座の場合：現在の残高から逆算
        const account = this.bankAccounts.find(acc => acc.accountId === this.selectedAccount)
        if (!account) return 0
        
        let balance = account.balance
        const transactionDate = new Date(transaction.createdAt || transaction.timestamp || transaction.date)
        
        // 対象取引より新しい取引を逆算で引く
        const newerTransactions = this.filteredTransactions
          .filter(t => {
            const tDate = new Date(t.createdAt || t.timestamp || t.date)
            return tDate > transactionDate
          })
          .sort((a, b) => {
            const aDate = new Date(a.createdAt || a.timestamp || a.date)
            const bDate = new Date(b.createdAt || b.timestamp || b.date)
            return bDate - aDate // 新しい順
          })
        
        // 新しい取引から逆算で引く
        for (const t of newerTransactions) {
          if (t.type === 'income') {
            balance -= t.amount
          } else {
            balance += t.amount
          }
        }
        
        return balance
      }
    }
  }
}
</script>

<style scoped>
.balance-view {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.account-selector {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
  color: #333;
}

.form-select {
  width: 100%;
  max-width: 300px;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  background-color: white;
  cursor: pointer;
}

.balance-card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  text-align: center;
}

.balance-amount {
  font-size: 2.5rem;
  font-weight: bold;
  color: #27ae60;
  margin-top: 1rem;
}

.balance-amount.negative {
  color: #e74c3c;
}

.transactions-section {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.no-transactions {
  text-align: center;
  color: #666;
  padding: 2rem;
}

.transactions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.transaction-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border: 1px solid #eee;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.transaction-item:hover {
  background-color: #f8f9fa;
}

.transaction-info {
  flex: 1;
}

.transaction-category {
  font-weight: bold;
  margin-bottom: 0.25rem;
}

.transaction-memo {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.transaction-date {
  color: #999;
  font-size: 0.8rem;
}

.transaction-amounts {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.transaction-amount {
  font-size: 1rem;
  font-weight: bold;
}

.transaction-amount.income {
  color: #27ae60;
}

.transaction-amount.expense {
  color: #e74c3c;
}

.balance-after {
  font-size: 0.9rem;
  color: #666;
  font-weight: normal;
}
</style>