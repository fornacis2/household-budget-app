<template>
  <div class="account-transfer-input">
    <h2>口座振替</h2>
    <div class="input-form">

      <div class="form-group">
        <label for="date">日付</label>
        <input id="date" v-model="date" type="date" class="form-input" />
      </div>

      <!-- 振替元 -->
      <div class="form-group">
        <label>振替元口座</label>
        <div class="account-row">
          <select v-model="fromAccountId" @change="onFromAccountChange" class="form-select">
            <option value="">口座を選択してください</option>
            <option value="cash">現金</option>
            <optgroup label="銀行口座">
              <option v-for="account in bankAccounts" :key="account.accountId" :value="'bank-' + account.accountId">
                {{ account.bankName }}
              </option>
            </optgroup>
            <optgroup label="クレジットカード">
              <option v-for="card in creditCards" :key="card.cardId" :value="'credit-' + card.cardId">
                {{ card.cardName }}
              </option>
            </optgroup>
          </select>
          <div v-if="showFromDate" class="inline-date">
            <label class="inline-label">引落日</label>
            <input v-model="fromWithdrawalDate" type="date" class="form-input-small" />
          </div>
        </div>
        <div v-if="showFromDate && !isFromInline" class="form-group-sub">
          <label>振替元引落日</label>
          <input v-model="fromWithdrawalDate" type="date" class="form-input" />
        </div>
      </div>

      <!-- 振替先 -->
      <div class="form-group">
        <label>振替先口座</label>
        <div class="account-row">
          <select v-model="toAccountId" @change="onToAccountChange" class="form-select">
            <option value="">口座を選択してください</option>
            <option value="cash" :disabled="fromAccountId === 'cash'">現金</option>
            <optgroup label="銀行口座">
              <option
                v-for="account in bankAccounts"
                :key="account.accountId"
                :value="'bank-' + account.accountId"
                :disabled="fromAccountId === 'bank-' + account.accountId"
              >
                {{ account.bankName }}
              </option>
            </optgroup>
            <optgroup label="クレジットカード">
              <option
                v-for="card in creditCards"
                :key="card.cardId"
                :value="'credit-' + card.cardId"
                :disabled="fromAccountId === 'credit-' + card.cardId"
              >
                {{ card.cardName }}
              </option>
            </optgroup>
          </select>
          <div v-if="showToDate" class="inline-date">
            <label class="inline-label">入金日</label>
            <input v-model="toDepositDate" type="date" class="form-input-small" />
          </div>
        </div>
        <div v-if="showToDate && !isToInline" class="form-group-sub">
          <label>振替先入金日</label>
          <input v-model="toDepositDate" type="date" class="form-input" />
        </div>
      </div>

      <div class="form-group">
        <label for="amount">金額（円）</label>
        <input id="amount" v-model.number="amount" type="number" placeholder="例: 10000" class="form-input" />
      </div>

      <div class="form-group">
        <label for="memo">備考</label>
        <input id="memo" v-model="memo" type="text" placeholder="メモ（任意）" class="form-input" />
      </div>

      <button @click="submitTransfer" class="btn-primary" :disabled="loading || !canSubmit">
        {{ loading ? '処理中...' : (isEditMode ? '取引を更新' : '取引を追加') }}
      </button>

      <div v-if="message" class="message">{{ message }}</div>
    </div>
  </div>
</template>

<script>
import { v4 as uuidv4 } from 'uuid'
import ApiService from '../services/api.js'

export default {
  name: 'AccountTransferInput',
  data() {
    const today = new Date().toISOString().split('T')[0]
    return {
      date: today,
      fromAccountId: '',
      fromWithdrawalDate: today,
      toAccountId: '',
      toDepositDate: today,
      amount: 0,
      memo: '',
      bankAccounts: [],
      creditCards: [],
      loading: false,
      message: '',
      isFromInline: true,
      isToInline: true,
      isEditMode: false,
      transferGroupId: null,
      existingTransactionIds: []
    }
  },
  computed: {
    showFromDate() {
      return this.fromAccountId && this.fromAccountId !== 'cash'
    },
    showToDate() {
      return this.toAccountId && this.toAccountId !== 'cash'
    },
    canSubmit() {
      return this.fromAccountId && this.toAccountId && this.amount > 0
    }
  },
  async mounted() {
    await this.loadData()
    const groupId = this.$route.params.transferGroupId
    if (groupId) {
      this.isEditMode = true
      this.transferGroupId = groupId
      await this.loadExistingTransfer(groupId)
    }
  },
  methods: {
    async loadData() {
      const [bankRes, cardRes] = await Promise.all([
        ApiService.getBankAccounts(),
        ApiService.getCreditCards()
      ])
      this.bankAccounts = bankRes.bankAccounts || []
      this.creditCards = cardRes.creditCards || []
    },

    async loadExistingTransfer(groupId) {
      try {
        // 全取引から transferGroupId が一致する2件を取得
        // 日付範囲を広めに取得するため直近1年分を検索
        const today = new Date()
        const startDate = new Date(today)
        startDate.setFullYear(startDate.getFullYear() - 2)
        const res = await ApiService.getTransactions(
          startDate.toISOString().split('T')[0],
          today.toISOString().split('T')[0]
        )
        const all = res.transactions || []
        const pair = all.filter(t => t.transferGroupId === groupId)
        if (pair.length < 2) return

        this.existingTransactionIds = pair.map(t => t.transactionId)

        const fromTx = pair.find(t => t.type === 'expense')
        const toTx = pair.find(t => t.type === 'income')
        if (!fromTx || !toTx) return

        this.date = fromTx.date
        this.amount = fromTx.amount
        this.memo = fromTx.memo || ''

        // 振替元口座
        if (fromTx.accountType === 'cash') {
          this.fromAccountId = 'cash'
        } else if (fromTx.accountType === 'bank') {
          this.fromAccountId = 'bank-' + fromTx.accountId
          this.fromWithdrawalDate = fromTx.withdrawalDate || fromTx.date
        } else if (fromTx.accountType === 'credit') {
          this.fromAccountId = 'credit-' + fromTx.accountId
          this.fromWithdrawalDate = fromTx.withdrawalDate || fromTx.date
        }

        // 振替先口座
        if (toTx.accountType === 'cash') {
          this.toAccountId = 'cash'
        } else if (toTx.accountType === 'bank') {
          this.toAccountId = 'bank-' + toTx.accountId
          this.toDepositDate = toTx.withdrawalDate || toTx.date
        } else if (toTx.accountType === 'credit') {
          this.toAccountId = 'credit-' + toTx.accountId
          this.toDepositDate = toTx.withdrawalDate || toTx.date
        }
      } catch (error) {
        console.error('口座振替データの取得に失敗:', error)
      }
    },

    async onFromAccountChange() {
      await this.calcFromDate()
    },

    async onToAccountChange() {
      await this.calcToDate()
    },

    async calcFromDate() {
      if (!this.showFromDate) return
      if (this.fromAccountId.startsWith('bank-')) {
        this.fromWithdrawalDate = this.date
      } else if (this.fromAccountId.startsWith('credit-')) {
        const cardId = this.fromAccountId.replace('credit-', '')
        const card = this.creditCards.find(c => c.cardId === cardId)
        if (card) this.fromWithdrawalDate = await this.calcCreditDate(card, this.date)
      }
    },

    async calcToDate() {
      if (!this.showToDate) return
      if (this.toAccountId.startsWith('bank-')) {
        this.toDepositDate = this.date
      } else if (this.toAccountId.startsWith('credit-')) {
        const cardId = this.toAccountId.replace('credit-', '')
        const card = this.creditCards.find(c => c.cardId === cardId)
        if (card) this.toDepositDate = await this.calcCreditDate(card, this.date)
      }
    },

    async calcCreditDate(card, txDateStr) {
      const txDate = new Date(txDateStr)
      const txDay = txDate.getDate()
      let targetMonth = txDate.getMonth()
      let targetYear = txDate.getFullYear()

      if (txDay > card.closingDay) targetMonth += 1
      targetMonth += card.withdrawalMonth

      while (targetMonth > 11) { targetMonth -= 12; targetYear += 1 }

      let withdrawalDay = card.withdrawalDay
      const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate()
      if (withdrawalDay > lastDay) withdrawalDay = lastDay

      const dateStr = `${targetYear}-${(targetMonth + 1).toString().padStart(2, '0')}-${withdrawalDay.toString().padStart(2, '0')}`
      const adjusted = await this.adjustToBusinessDay(new Date(dateStr + 'T12:00:00.000Z'))
      return adjusted.toISOString().split('T')[0]
    },

    async adjustToBusinessDay(date) {
      const d = new Date(date)
      while (true) {
        const dow = d.getDay()
        if (dow === 0 || dow === 6) { d.setDate(d.getDate() + 1); continue }
        const dateStr = d.toISOString().split('T')[0]
        const isHoliday = await this.isJapaneseHoliday(dateStr)
        if (isHoliday) { d.setDate(d.getDate() + 1); continue }
        break
      }
      return d
    },

    async isJapaneseHoliday(dateStr) {
      try {
        const year = dateStr.substring(0, 4)
        const res = await fetch(`https://holidays-jp.github.io/api/v1/${year}/date.json`)
        const holidays = await res.json()
        return holidays.hasOwnProperty(dateStr)
      } catch {
        return false
      }
    },

    parseAccount(accountKey) {
      if (accountKey === 'cash') return { accountType: 'cash', accountId: null }
      if (accountKey.startsWith('bank-')) return { accountType: 'bank', accountId: accountKey.replace('bank-', '') }
      if (accountKey.startsWith('credit-')) return { accountType: 'credit', accountId: accountKey.replace('credit-', '') }
      return { accountType: 'cash', accountId: null }
    },

    async submitTransfer() {
      if (!this.canSubmit) return

      const transferGroupId = uuidv4()
      const fromAccount = this.parseAccount(this.fromAccountId)
      const toAccount = this.parseAccount(this.toAccountId)

      const fromTx = {
        type: 'expense',
        category: '口座振替',
        subcategory: '',
        amount: this.amount,
        date: this.date,
        memo: this.memo,
        accountType: fromAccount.accountType,
        accountId: fromAccount.accountId,
        withdrawalDate: this.showFromDate ? this.fromWithdrawalDate : null,
        transferGroupId
      }

      const toTx = {
        type: 'income',
        category: '口座振替',
        subcategory: '',
        amount: this.amount,
        date: this.date,
        memo: this.memo,
        accountType: toAccount.accountType,
        accountId: toAccount.accountId,
        withdrawalDate: this.showToDate ? this.toDepositDate : null,
        transferGroupId
      }

      try {
        this.loading = true
        if (this.isEditMode) {
          // 既存2件を削除してから新規2件を登録（transferGroupIdを引き継ぐ）
          for (const id of this.existingTransactionIds) {
            await ApiService.deleteTransaction(id)
          }
        }
        await ApiService.createTransaction(fromTx)
        await ApiService.createTransaction(toTx)
        this.message = this.isEditMode ? '口座振替を更新しました' : '口座振替を登録しました'
        if (this.isEditMode) {
          setTimeout(() => { this.$router.push('/transactions') }, 1000)
        } else {
          this.resetForm()
        }
      } catch (error) {
        console.error('口座振替の登録に失敗:', error)
        this.message = '口座振替の登録に失敗しました'
      } finally {
        this.loading = false
        setTimeout(() => { this.message = '' }, 3000)
      }
    },

    resetForm() {
      const today = new Date().toISOString().split('T')[0]
      this.date = today
      this.fromAccountId = ''
      this.fromWithdrawalDate = today
      this.toAccountId = ''
      this.toDepositDate = today
      this.amount = 0
      this.memo = ''
    }
  }
}
</script>

<style scoped>
.account-transfer-input {
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

.form-group-sub {
  margin-top: 0.75rem;
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
  background-color: white;
}

.account-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.account-row .form-select {
  flex: 1;
}

.inline-date {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
}

.inline-label {
  font-size: 0.85rem;
  font-weight: bold;
  color: #555;
  margin-bottom: 0;
}

.form-input-small {
  padding: 0.75rem 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  width: 140px;
}

.btn-primary {
  background-color: #27ae60;
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
