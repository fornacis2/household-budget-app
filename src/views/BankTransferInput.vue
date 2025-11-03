<template>
  <div class="bank-transfer-input">
    <h2>銀行口座 預金・引出</h2>
    
    <div class="transfer-form">
      <div class="form-group">
        <label>取引種別</label>
        <div class="radio-group">
          <label class="radio-label">
            <input v-model="transferType" type="radio" value="deposit" />
            預金
          </label>
          <label class="radio-label">
            <input v-model="transferType" type="radio" value="withdraw" />
            引出
          </label>
        </div>
      </div>

      <div class="form-group">
        <label for="bankAccount">対象口座</label>
        <select
          id="bankAccount"
          v-model="selectedAccountId"
          @change="onAccountChange"
          class="form-select"
        >
          <option value="">口座を選択してください</option>
          <option
            v-for="account in bankAccounts"
            :key="account.accountId"
            :value="account.accountId"
          >
            {{ account.bankName }} (残高: ¥{{ account.balance.toLocaleString() }})
          </option>
        </select>
      </div>

      <div class="form-group" v-if="selectedAccount">
        <div class="account-info">
          <strong>{{ selectedAccount.bankName }}</strong><br>
          現在残高: ¥{{ selectedAccount.balance.toLocaleString() }}
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
          placeholder="例: 10000"
          class="form-input"
        />
      </div>

      <div class="form-group" v-if="transferType === 'withdraw' && selectedAccount">
        <div class="balance-check" :class="{ 'insufficient': amount > selectedAccount.balance }">
          引出後残高: ¥{{ (selectedAccount.balance - (amount || 0)).toLocaleString() }}
          <span v-if="amount > selectedAccount.balance" class="error-text">
            （残高不足）
          </span>
        </div>
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

      <button 
        @click="executeTransfer" 
        class="btn-primary" 
        :disabled="loading || !canExecute"
      >
        {{ loading ? '処理中...' : (transferType === 'deposit' ? '預金実行' : '引出実行') }}
      </button>
      
      <div v-if="message" class="message">{{ message }}</div>
    </div>
  </div>
</template>

<script>
import ApiService from '../services/api.js'

export default {
  name: 'BankTransferInput',
  data() {
    return {
      transferType: 'deposit',
      selectedAccountId: '',
      amount: 0,
      memo: '',
      date: new Date().toISOString().split('T')[0],
      bankAccounts: [],
      loading: false,
      message: ''
    }
  },
  computed: {
    selectedAccount() {
      return this.bankAccounts.find(account => account.accountId === this.selectedAccountId)
    },
    canExecute() {
      if (!this.selectedAccountId || !this.amount || this.amount <= 0) {
        return false
      }
      
      if (this.transferType === 'withdraw' && this.selectedAccount) {
        return this.amount <= this.selectedAccount.balance
      }
      
      return true
    }
  },
  mounted() {
    this.loadBankAccounts()
  },
  methods: {
    async loadBankAccounts() {
      try {
        const response = await ApiService.getBankAccounts()
        this.bankAccounts = response.bankAccounts
      } catch (error) {
        console.error('銀行口座の取得に失敗:', error)
        this.message = '銀行口座の取得に失敗しました'
      }
    },

    onAccountChange() {
      // 口座変更時の処理（必要に応じて）
    },

    async executeTransfer() {
      if (!this.canExecute) {
        this.message = '入力内容を確認してください'
        return
      }

      try {
        this.loading = true
        
        await ApiService.bankTransfer(this.selectedAccountId, {
          type: this.transferType,
          amount: this.amount,
          memo: this.memo,
          date: this.date
        })
        
        this.message = `${this.transferType === 'deposit' ? '預金' : '引出'}処理が完了しました`
        
        // フォームリセット
        this.resetForm()
        
        // データ再読み込み
        await this.loadBankAccounts()
        
      } catch (error) {
        console.error('取引処理に失敗:', error)
        this.message = '取引処理に失敗しました'
      } finally {
        this.loading = false
        setTimeout(() => {
          this.message = ''
        }, 3000)
      }
    },

    resetForm() {
      this.amount = 0
      this.memo = ''
      this.date = new Date().toISOString().split('T')[0]
      // 口座選択はリセットしない（連続入力のため）
    }
  }
}
</script>

<style scoped>
.bank-transfer-input {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.transfer-form {
  max-width: 500px;
  margin-bottom: 2rem;
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

.account-info {
  background-color: #ecf0f1;
  padding: 1rem;
  border-radius: 4px;
  color: #2c3e50;
}

.balance-check {
  padding: 0.75rem;
  border-radius: 4px;
  background-color: #d4edda;
  color: #155724;
  font-weight: bold;
}

.balance-check.insufficient {
  background-color: #f8d7da;
  color: #721c24;
}

.error-text {
  color: #e74c3c;
}

.btn-primary {
  background-color: #3498db;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  width: 100%;
}

.btn-primary:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

.message {
  margin-top: 1rem;
  padding: 0.75rem;
  background-color: #d4edda;
  color: #155724;
  border-radius: 4px;
}
</style>