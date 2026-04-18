<template>
  <div class="credit-card-management">
    <h2>クレジットカード管理</h2>

    <div class="card-section">
      <h3>登録済みクレジットカード</h3>
      <div v-if="creditCards.length === 0" class="no-cards">
        登録されたクレジットカードがありません
      </div>
      <div v-else class="card-list">
        <div
          v-for="(card, index) in creditCards"
          :key="card.cardId"
          class="card-item"
        >
          <div class="sort-buttons">
            <button @click="moveUp(index)" class="btn-sort" :disabled="index === 0">↑</button>
            <button @click="moveDown(index)" class="btn-sort" :disabled="index === creditCards.length - 1">↓</button>
          </div>
          <div class="card-info">
            <span class="card-name">{{ card.cardName }}</span>
            <span class="card-detail">引落: {{ getBankName(card.withdrawalAccountId) }}</span>
            <span class="card-detail">締め日: {{ card.closingDay }}日</span>
            <span class="card-detail">引落: {{ getWithdrawalMonthText(card.withdrawalMonth) }}{{ card.withdrawalDay }}日</span>
          </div>
          <div class="card-actions">
            <button @click="deleteCard(card.cardId)" class="btn-delete" :disabled="loading">削除</button>
          </div>
        </div>
      </div>
      <div class="section-footer">
        <button @click="showAddForm" class="btn-add">+ クレジットカードを追加</button>
        <button @click="updateSortOrder" class="btn-update" :disabled="loading">順序を更新</button>
      </div>
    </div>

    <!-- 登録フォーム（モーダル） -->
    <div v-if="showForm" class="form-overlay">
      <div class="form-modal">
        <h3>クレジットカードを追加</h3>

        <div class="form-group">
          <label>カード名</label>
          <input
            v-model="newCard.cardName"
            type="text"
            placeholder="例: 楽天カード"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label>引落口座</label>
          <select v-model="newCard.withdrawalAccountId" class="form-select">
            <option value="">引落口座を選択してください</option>
            <option
              v-for="account in bankAccounts"
              :key="account.accountId"
              :value="account.accountId"
            >
              {{ account.bankName }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>締め日</label>
          <select v-model="newCard.closingDay" class="form-select">
            <option value="">締め日を選択してください</option>
            <option v-for="day in 31" :key="day" :value="day">{{ day }}日</option>
          </select>
        </div>

        <div class="form-group">
          <label>引落月</label>
          <select v-model="newCard.withdrawalMonth" class="form-select">
            <option value="">引落月を選択してください</option>
            <option value="current">当月</option>
            <option value="next">翌月</option>
            <option value="after_next">翌々月</option>
          </select>
        </div>

        <div class="form-group">
          <label>引落日</label>
          <select v-model="newCard.withdrawalDay" class="form-select">
            <option value="">引落日を選択してください</option>
            <option v-for="day in 31" :key="day" :value="day">{{ day }}日</option>
          </select>
        </div>

        <div class="form-actions">
          <button @click="addCreditCard" class="btn-primary" :disabled="loading || !canAddCard">
            {{ loading ? '登録中...' : 'カード登録' }}
          </button>
          <button @click="cancelForm" class="btn-secondary">キャンセル</button>
        </div>
      </div>
    </div>

    <div v-if="message" class="message">{{ message }}</div>
  </div>
</template>

<script>
import ApiService from '../services/api.js'

export default {
  name: 'CreditCardManagement',
  data() {
    return {
      newCard: {
        cardName: '',
        withdrawalAccountId: '',
        closingDay: '',
        withdrawalMonth: '',
        withdrawalDay: ''
      },
      creditCards: [],
      bankAccounts: [],
      showForm: false,
      loading: false,
      message: '',
      withdrawalMonthMap: {
        'current': 0,
        'next': 1,
        'after_next': 2
      },
      withdrawalMonthText: {
        0: '当月',
        1: '翌月',
        2: '翌々月'
      }
    }
  },
  computed: {
    canAddCard() {
      return this.newCard.cardName &&
             this.newCard.withdrawalAccountId &&
             this.newCard.closingDay &&
             this.newCard.withdrawalMonth &&
             this.newCard.withdrawalDay
    }
  },
  mounted() {
    this.loadData()
  },
  methods: {
    async loadData() {
      await Promise.all([this.loadCreditCards(), this.loadBankAccounts()])
    },

    async loadCreditCards() {
      try {
        const response = await ApiService.getCreditCards()
        this.creditCards = response.creditCards || []
      } catch (error) {
        console.error('クレジットカードの取得に失敗:', error)
        this.message = 'クレジットカードの取得に失敗しました'
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

    showAddForm() {
      this.resetForm()
      this.showForm = true
    },

    cancelForm() {
      this.showForm = false
      this.resetForm()
    },

    async addCreditCard() {
      if (!this.canAddCard) {
        this.message = '全ての項目を入力してください'
        return
      }

      try {
        this.loading = true
        await ApiService.addCreditCard({
          cardName: this.newCard.cardName,
          withdrawalAccountId: this.newCard.withdrawalAccountId,
          closingDay: parseInt(this.newCard.closingDay),
          withdrawalMonth: this.withdrawalMonthMap[this.newCard.withdrawalMonth],
          withdrawalDay: parseInt(this.newCard.withdrawalDay)
        })
        this.message = 'クレジットカードを登録しました'
        this.showForm = false
        this.resetForm()
        await this.loadCreditCards()
      } catch (error) {
        console.error('クレジットカード登録に失敗:', error)
        this.message = 'クレジットカード登録に失敗しました'
      } finally {
        this.loading = false
        setTimeout(() => { this.message = '' }, 3000)
      }
    },

    async deleteCard(cardId) {
      if (!confirm('このクレジットカードを削除しますか？')) return

      try {
        this.loading = true
        await ApiService.deleteCreditCard(cardId)
        this.message = 'クレジットカードを削除しました'
        await this.loadCreditCards()
      } catch (error) {
        console.error('クレジットカード削除に失敗:', error)
        this.message = 'クレジットカード削除に失敗しました'
      } finally {
        this.loading = false
        setTimeout(() => { this.message = '' }, 3000)
      }
    },

    moveUp(index) {
      if (index === 0) return
      const tmp = this.creditCards[index - 1]
      this.creditCards[index - 1] = this.creditCards[index]
      this.creditCards[index] = tmp
    },

    moveDown(index) {
      if (index === this.creditCards.length - 1) return
      const tmp = this.creditCards[index + 1]
      this.creditCards[index + 1] = this.creditCards[index]
      this.creditCards[index] = tmp
    },

    async updateSortOrder() {
      try {
        this.loading = true
        await Promise.all(
          this.creditCards.map((card, index) =>
            ApiService.updateCreditCard(card.cardId, { sortOrder: index + 1 })
          )
        )
        this.message = '順序を更新しました'
      } catch (error) {
        console.error('順序の更新に失敗:', error)
        this.message = '順序の更新に失敗しました'
      } finally {
        this.loading = false
        setTimeout(() => { this.message = '' }, 3000)
      }
    },

    getBankName(accountId) {
      const account = this.bankAccounts.find(acc => acc.accountId === accountId)
      return account ? account.bankName : '不明'
    },

    getWithdrawalMonthText(withdrawalMonth) {
      return this.withdrawalMonthText[withdrawalMonth] || '不明'
    },

    resetForm() {
      this.newCard = {
        cardName: '',
        withdrawalAccountId: '',
        closingDay: '',
        withdrawalMonth: '',
        withdrawalDay: ''
      }
    }
  }
}
</script>

<style scoped>
.credit-card-management {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.card-section h3 {
  color: #2c3e50;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #ecf0f1;
}

.card-list {
  margin-bottom: 1rem;
}

.card-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #f8f9fa;
  padding: 0.75rem 1rem;
  margin-bottom: 0.5rem;
  border-radius: 4px;
  border-left: 4px solid #9b59b6;
}

.sort-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.btn-sort {
  padding: 0.1rem 0.3rem;
  border: 1px solid #bdc3c7;
  border-radius: 3px;
  background-color: #ecf0f1;
  cursor: pointer;
  font-size: 0.75rem;
  line-height: 1;
}

.btn-sort:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-sort:hover:not(:disabled) {
  background-color: #bdc3c7;
}

.card-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.card-name {
  font-weight: bold;
  color: #2c3e50;
  min-width: 120px;
}

.card-detail {
  font-size: 0.9rem;
  color: #666;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-delete {
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.8rem;
  background-color: #e74c3c;
  color: white;
}

.btn-delete:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

.no-cards {
  text-align: center;
  color: #666;
  padding: 2rem;
  background-color: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.section-footer {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.btn-add {
  background-color: #27ae60;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  flex: 1;
}

.btn-update {
  background-color: #3498db;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  flex: 1;
}

.btn-update:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

.form-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.form-modal {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
}

.form-input, .form-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  background-color: white;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn-primary {
  background-color: #3498db;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-primary:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #95a5a6;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.message {
  margin-top: 1rem;
  padding: 0.75rem;
  background-color: #d4edda;
  color: #155724;
  border-radius: 4px;
}
</style>
