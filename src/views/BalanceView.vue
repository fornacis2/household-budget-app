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
              <span v-if="transaction.accountType === 'credit'" class="credit-indicator">(クレジット)</span>
            </div>
            <div class="transaction-memo" v-if="transaction.memo">
              {{ transaction.memo }}
            </div>
            <div class="transaction-dates">
              <div class="transaction-date">取引日: {{ formatDate(transaction.date) }}</div>
              <div v-if="transaction.withdrawalDate && transaction.withdrawalDate !== transaction.date" class="withdrawal-date">
                引落日: {{ formatDate(transaction.withdrawalDate) }}
              </div>
            </div>
          </div>
          <div class="transaction-amounts">
            <div class="transaction-amount" :class="transaction.type">
              取引額: {{ transaction.type === 'income' ? '+' : '-' }}¥{{ transaction.amount.toLocaleString() }}
            </div>
            <div class="balance-after" :class="{ 'balance-mismatch': getBalanceResult(transaction).mismatch }">
              取引後残高: ¥{{ getBalanceResult(transaction).amount.toLocaleString() }}
              <span v-if="getBalanceResult(transaction).mismatch" class="mismatch-indicator">※</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 残高不一致の説明 -->
    <div v-if="Object.keys(balanceMismatches).length > 0" class="mismatch-notice">
      <h4>⚠️ 残高不一致のお知らせ</h4>
      <p>赤字で※印が付いた残高は、計算値と日次残高テーブルの値が一致していません。</p>
      <p>日次残高管理画面から残高の再計算を実行してください。</p>
      <button @click="goToDailyBalanceManagement" class="btn-warning">
        日次残高管理へ
      </button>
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
      creditCards: [],
      loading: false,
      balanceMismatches: {},
      balanceCache: {},
      dailyBalancesCache: []
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
        // 銀行口座取引 + クレジットカード引落
        return this.transactions.filter(t => {
          // 銀行口座の直接取引
          if (t.accountType === 'bank' && t.accountId === this.selectedAccount) {
            return true
          }
          // クレジットカードの引落取引（引落口座がこの銀行口座）
          if (t.accountType === 'credit' && t.type === 'expense') {
            const creditCard = this.creditCards.find(card => card.cardId === t.accountId)
            return creditCard && creditCard.withdrawalAccountId === this.selectedAccount
          }
          return false
        })
      }
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
  async mounted() {
    await this.loadData()
    await this.loadBankAccounts()
    await this.loadCreditCards()
    await this.preloadBalances()
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
    
    async loadCreditCards() {
      try {
        const response = await ApiService.getCreditCards()
        this.creditCards = response.creditCards || []
      } catch (error) {
        console.error('クレジットカードの取得に失敗:', error)
      }
    },
    
    async onAccountChange() {
      this.balanceMismatches = {}
      this.balanceCache = {}
      await this.preloadBalances()
    },
    formatDate(dateString) {
      const date = new Date(dateString)
      return date.toLocaleDateString('ja-JP')
    },
    
    async calculateBalanceAfter(transaction) {
      const accountId = this.getAccountIdForDailyBalance()
      const updateDate = this.getUpdateDate(transaction) // 引落日を使用
      
      try {
        const previousDate = this.getPreviousDate(updateDate)
        const previousDayBalance = await this.getDailyBalanceAsync(previousDate, accountId)
        
        const sameDayTransactions = this.getSameDayTransactions(updateDate)
          .sort((a, b) => {
            const aTime = new Date(a.createdAt || a.timestamp || `${this.getUpdateDate(a)}T00:00:00`)
            const bTime = new Date(b.createdAt || b.timestamp || `${this.getUpdateDate(b)}T00:00:00`)
            return aTime - bTime
          })
        
        let calculatedBalance = previousDayBalance
        
        for (const tx of sameDayTransactions) {
          const amount = this.getTransactionAmount(tx)
          calculatedBalance += amount
          
          if ((tx.transactionId && tx.transactionId === transaction.transactionId) || 
              (tx.id && tx.id === transaction.id)) {
            
            const isLastTransaction = this.isLastTransactionOfDay(transaction, sameDayTransactions)
            
            if (isLastTransaction) {
              const dailyBalance = await this.getDailyBalanceAsync(updateDate, accountId)
              
              if (dailyBalance !== null && Math.abs(calculatedBalance - dailyBalance) > 0.01) {
                this.setBalanceMismatch(updateDate, calculatedBalance, dailyBalance)
                return { amount: dailyBalance, mismatch: true }
              }
            }
            
            return { amount: calculatedBalance, mismatch: false }
          }
        }
        
        return { amount: this.calculateBalanceAfterFallback(transaction), mismatch: false }
      } catch (error) {
        console.error('残高計算エラー:', error)
        return { amount: this.calculateBalanceAfterFallback(transaction), mismatch: false }
      }
    },
    

    
    getAccountIdForDailyBalance() {
      if (this.selectedAccount === 'cash') {
        return 'cash'
      } else {
        return `bank-${this.selectedAccount}`
      }
    },
    
    getPreviousDate(dateString) {
      const date = new Date(dateString)
      date.setDate(date.getDate() - 1)
      return date.toISOString().split('T')[0]
    },
    

    
    getSameDayTransactions(date) {
      return this.filteredTransactions.filter(t => this.getUpdateDate(t) === date)
    },
    
    async getDailyBalanceAsync(date, accountId) {
      const balancesForAccount = this.dailyBalancesCache.filter(b => b.accountId === accountId && b.date <= date)
      if (balancesForAccount.length > 0) {
        balancesForAccount.sort((a, b) => b.date.localeCompare(a.date))
        return balancesForAccount[0].balance
      }
      return this.getDefaultBalance(accountId)
    },
    
    getDefaultBalance(accountId) {
      if (accountId === 'cash') {
        return this.initialBalance
      } else {
        // 銀行口座の場合は0から開始
        return 0
      }
    },
    
    isLastTransactionOfDay(transaction, sameDayTransactions) {
      const sortedTransactions = [...sameDayTransactions]
        .sort((a, b) => {
          const aTime = new Date(a.createdAt || a.timestamp || `${a.date}T00:00:00`)
          const bTime = new Date(b.createdAt || b.timestamp || `${b.date}T00:00:00`)
          return aTime - bTime
        })
      
      const lastTransaction = sortedTransactions[sortedTransactions.length - 1]
      const targetId = transaction.transactionId || transaction.id
      const lastId = lastTransaction?.transactionId || lastTransaction?.id
      return targetId === lastId
    },
    
    setBalanceMismatch(date, calculated, daily) {
      this.balanceMismatches = this.balanceMismatches || {}
      this.balanceMismatches[date] = {
        calculated,
        daily,
        accountId: this.getAccountIdForDailyBalance()
      }
    },
    
    calculateBalanceAfterFallback(transaction) {
      // 従来の計算方式（フォールバック用）
      if (this.selectedAccount === 'cash') {
        let balance = this.initialBalance
        const transactionDate = new Date(transaction.createdAt || transaction.timestamp || transaction.date)
        
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
        
        for (const t of olderTransactions) {
          if (t.type === 'income') {
            balance += t.amount
          } else {
            balance -= t.amount
          }
          
          if (t.transactionId === transaction.transactionId || t.id === transaction.id) {
            return balance
          }
        }
        
        return balance
      } else {
        // 銀行口座の場合は現在の残高から逆算
        const account = this.bankAccounts.find(acc => acc.accountId === this.selectedAccount)
        if (!account) return 0
        
        let balance = account.balance
        const transactionDate = new Date(transaction.createdAt || transaction.timestamp || transaction.date)
        
        const newerTransactions = this.filteredTransactions
          .filter(t => {
            const tDate = new Date(t.createdAt || t.timestamp || t.date)
            return tDate > transactionDate
          })
          .sort((a, b) => {
            const aDate = new Date(a.createdAt || a.timestamp || a.date)
            const bDate = new Date(b.createdAt || b.timestamp || b.date)
            return bDate - aDate
          })
        
        for (const t of newerTransactions) {
          if (t.type === 'income') {
            balance -= t.amount
          } else {
            balance += t.amount
          }
        }
        
        return balance
      }
    },
    
    getBalanceResult(transaction) {
      const key = transaction.transactionId || transaction.id
      if (this.balanceCache[key]) {
        return this.balanceCache[key]
      }
      return { amount: this.calculateBalanceAfterFallback(transaction), mismatch: false }
    },
    
    async preloadBalances() {
      const accountId = this.getAccountIdForDailyBalance()
      
      if (this.filteredTransactions.length === 0) {
        this.dailyBalancesCache = []
        return
      }
      
      const dates = this.filteredTransactions.map(t => t.date).sort()
      const startDate = dates[0]
      const endDate = dates[dates.length - 1]
      
      try {
        const response = await ApiService.getAccountDailyBalances(accountId, startDate, endDate)
        this.dailyBalancesCache = response.balances || []
      } catch (error) {
        console.error('日次残高取得エラー:', error)
        this.dailyBalancesCache = []
      }
      
      for (const transaction of this.filteredTransactions) {
        const result = await this.calculateBalanceAfter(transaction)
        const key = transaction.transactionId || transaction.id
        this.balanceCache[key] = result
      }
    },
    
    goToDailyBalanceManagement() {
      this.$router.push('/daily-balances')
    },
    
    getUpdateDate(transaction) {
      if (transaction.accountType === 'cash') {
        return transaction.date
      }
      return transaction.withdrawalDate || transaction.date
    },
    
    getTransactionAmount(transaction) {
      if (transaction.accountType === 'credit' && transaction.type === 'expense') {
        // クレジットカードの引落は銀行口座からの支出
        return -transaction.amount
      }
      
      if (transaction.type === 'income') {
        return transaction.amount
      } else {
        return -transaction.amount
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

.transaction-dates {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.transaction-date {
  color: #999;
  font-size: 0.8rem;
}

.withdrawal-date {
  color: #e67e22;
  font-size: 0.8rem;
  font-weight: bold;
}

.credit-indicator {
  color: #9b59b6;
  font-size: 0.8rem;
  font-weight: normal;
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

.balance-after.balance-mismatch {
  color: #e74c3c !important;
  font-weight: bold;
}

.mismatch-indicator {
  color: #e74c3c;
  font-weight: bold;
  margin-left: 0.25rem;
}

.mismatch-notice {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  padding: 1.5rem;
  margin-top: 1rem;
}

.mismatch-notice h4 {
  margin: 0 0 1rem 0;
  color: #856404;
}

.mismatch-notice p {
  margin: 0.5rem 0;
  color: #856404;
}

.btn-warning {
  background-color: #f39c12;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  margin-top: 1rem;
}

.btn-warning:hover {
  background-color: #e67e22;
}
</style>