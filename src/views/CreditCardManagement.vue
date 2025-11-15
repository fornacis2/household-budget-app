<template>
  <div class="credit-card-management">
    <h2>クレジットカード管理</h2>
    
    <!-- カード登録フォーム -->
    <div class="card-form">
      <h3>新しいクレジットカードを登録</h3>
      <div class="form-group">
        <label for="cardName">カード名</label>
        <input
          id="cardName"
          v-model="newCard.cardName"
          type="text"
          placeholder="例: 楽天カード"
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label for="withdrawalAccount">引落口座</label>
        <select
          id="withdrawalAccount"
          v-model="newCard.withdrawalAccountId"
          class="form-select"
        >
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
        <label for="closingDay">締め日</label>
        <select
          id="closingDay"
          v-model="newCard.closingDay"
          class="form-select"
        >
          <option value="">締め日を選択してください</option>
          <option v-for="day in 31" :key="day" :value="day">
            {{ day }}日
          </option>
        </select>
      </div>

      <div class="form-group">
        <label for="withdrawalMonth">引落月</label>
        <select
          id="withdrawalMonth"
          v-model="newCard.withdrawalMonth"
          class="form-select"
        >
          <option value="">引落月を選択してください</option>
          <option value="current">当月</option>
          <option value="next">翌月</option>
          <option value="after_next">翌々月</option>
        </select>
      </div>

      <div class="form-group">
        <label for="withdrawalDay">引落日</label>
        <select
          id="withdrawalDay"
          v-model="newCard.withdrawalDay"
          class="form-select"
        >
          <option value="">引落日を選択してください</option>
          <option v-for="day in 31" :key="day" :value="day">
            {{ day }}日
          </option>
        </select>
      </div>

      <button 
        @click="addCreditCard" 
        class="btn-primary"
        :disabled="loading || !canAddCard"
      >
        {{ loading ? '登録中...' : 'カード登録' }}
      </button>
    </div>

    <!-- 登録済みカード一覧 -->
    <div class="card-list">
      <h3>登録済みクレジットカード</h3>
      <div v-if="creditCards.length === 0" class="no-cards">
        登録されたクレジットカードがありません
      </div>
      <div v-else>
        <div
          v-for="card in creditCards"
          :key="card.cardId"
          class="card-item"
        >
          <div class="card-info">
            <h4>{{ card.cardName }}</h4>
            <p>引落口座: {{ getBankName(card.withdrawalAccountId) }}</p>
            <p>締め日: {{ card.closingDay }}日</p>
            <p>引落月: {{ getWithdrawalMonthText(card.withdrawalMonth) }}</p>
            <p>引落日: {{ card.withdrawalDay }}日</p>
          </div>
          <div class="card-actions">
            <button 
              @click="deleteCreditCard(card.cardId)" 
              class="btn-danger"
              :disabled="loading"
            >
              削除
            </button>
          </div>
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
      loading: false,
      message: ''
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
      await Promise.all([
        this.loadCreditCards(),
        this.loadBankAccounts()
      ])
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
          withdrawalMonth: this.newCard.withdrawalMonth,
          withdrawalDay: parseInt(this.newCard.withdrawalDay)
        })
        
        this.message = 'クレジットカードを登録しました'
        this.resetForm()
        await this.loadCreditCards()
        
      } catch (error) {
        console.error('クレジットカード登録に失敗:', error)
        this.message = 'クレジットカード登録に失敗しました'
      } finally {
        this.loading = false
        setTimeout(() => {
          this.message = ''
        }, 3000)
      }
    },

    async deleteCreditCard(cardId) {
      if (!confirm('このクレジットカードを削除しますか？')) {
        return
      }

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
        setTimeout(() => {
          this.message = ''
        }, 3000)
      }
    },

    getBankName(accountId) {
      const account = this.bankAccounts.find(acc => acc.accountId === accountId)
      return account ? account.bankName : '不明'
    },

    getWithdrawalMonthText(withdrawalMonth) {
      const monthMap = {
        'current': '当月',
        'next': '翌月',
        'after_next': '翌々月'
      }
      return monthMap[withdrawalMonth] || '不明'
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

.card-form {
  background-color: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
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

.form-select {
  background-color: white;
  cursor: pointer;
}

.btn-primary {
  background-color: #3498db;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.btn-primary:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

.btn-danger {
  background-color: #e74c3c;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-danger:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

.card-list {
  margin-top: 2rem;
}

.no-cards {
  text-align: center;
  color: #666;
  padding: 2rem;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.card-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 1rem;
  background-color: #fff;
}

.card-info h4 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
}

.card-info p {
  margin: 0.25rem 0;
  color: #666;
  font-size: 0.9rem;
}

.message {
  margin-top: 1rem;
  padding: 0.75rem;
  background-color: #d4edda;
  color: #155724;
  border-radius: 4px;
}
</style>