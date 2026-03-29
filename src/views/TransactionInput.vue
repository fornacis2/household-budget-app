<template>
  <div class="transaction-input">
    <h2>{{ isEditMode ? '取引編集' : '取引入力' }}</h2>
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
          <option
            v-for="card in creditCards"
            :key="card.cardId"
            :value="card.cardId"
          >
            {{ card.cardName }} (クレジットカード)
          </option>
        </select>
      </div>

      <!-- 引落日表示（現金以外） -->
      <div v-if="selectedAccountId !== 'cash'" class="form-group">
        <label for="withdrawalDate">引落日</label>
        <input
          id="withdrawalDate"
          v-model="withdrawalDate"
          type="date"
          class="form-input"
        />
        <small class="date-help">引落日を変更できます</small>
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

      <button @click="submitTransaction" class="btn-primary" :disabled="loading">
        {{ loading ? '保存中...' : (isEditMode ? '取引を更新' : '取引を追加') }}
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
    const today = new Date().toISOString().split('T')[0]
    console.log('TransactionInput初期化 - 今日の日付:', today)
    
    return {
      transactionType: 'expense',
      amount: 0,
      category: '',
      subcategory: '',
      memo: '',
      date: today,
      selectedAccountId: 'cash',
      withdrawalDate: today,
      message: '',
      loading: false,
      categories: {
        income: [],
        expense: []
      },
      bankAccounts: [],
      creditCards: [],
      selectedCategory: null,
      isEditMode: false,
      transactionId: null
    }
  },
  async mounted() {
    this.transactionId = this.$route.params.transactionId
    this.isEditMode = !!this.transactionId
    
    console.log('TransactionInput mounted - 編集モード:', this.isEditMode, 'ID:', this.transactionId)
    console.log('初期日付値:', this.date)
    
    await Promise.all([
      this.loadCategories(),
      this.loadBankAccounts(),
      this.loadCreditCards()
    ])
    
    if (this.isEditMode) {
      await this.loadTransaction()
    }
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
    },
    async date() {
      await this.updateWithdrawalDate()
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
    
    async onAccountChange() {
      await this.updateWithdrawalDate()
    },
    
    async updateWithdrawalDate() {
      if (this.selectedAccountId === 'cash') {
        return
      }
      
      if (this.isBankAccount()) {
        // 銀行口座：取引日と同じ
        this.withdrawalDate = this.date
      } else if (this.isCreditCard()) {
        // クレジットカード：引落日を計算
        await this.calculateCreditCardWithdrawalDate()
      }
    },
    
    isBankAccount() {
      return this.bankAccounts.some(account => account.accountId === this.selectedAccountId)
    },
    
    isCreditCard() {
      return this.creditCards.some(card => card.cardId === this.selectedAccountId)
    },
    
    async calculateCreditCardWithdrawalDate() {
      const card = this.creditCards.find(c => c.cardId === this.selectedAccountId)
      if (!card) return
      
      console.log('=== クレジットカード引落日計算開始 ===')
      console.log('取引日:', this.date)
      console.log('カード設定:', card)
      
      const txDate = new Date(this.date)
      const txYear = txDate.getFullYear()
      const txMonth = txDate.getMonth()
      const txDay = txDate.getDate()
      
      console.log('取引年月日:', { txYear, txMonth, txDay })
      
      let targetMonth = txMonth
      let targetYear = txYear
      
      // 締め日判定
      console.log('締め日判定:', txDay, '>', card.closingDay)
      if (txDay > card.closingDay) {
        targetMonth += 1
        console.log('締め日後のため翌月に変更')
      }
      
      console.log('締め日判定後:', { targetMonth, targetYear })
      
      // 引落月を加算
      targetMonth += card.withdrawalMonth
      console.log('引落月加算後:', { targetMonth, targetYear })
      
      // 年をまたぐ場合の調整
      while (targetMonth > 11) {
        targetMonth -= 12
        targetYear += 1
        console.log('年またぎ調整:', { targetMonth, targetYear })
      }
      
      // 引落日を設定
      let withdrawalDay = card.withdrawalDay
      const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
      console.log('月末日数:', lastDayOfMonth, '引落日:', withdrawalDay)
      
      if (withdrawalDay > lastDayOfMonth) {
        withdrawalDay = lastDayOfMonth
        console.log('月末調整後の引落日:', withdrawalDay)
      }
      
      // タイムゾーンの影響を完全に避けるため、日付文字列をそのまま使用
      const dateString = `${targetYear}-${(targetMonth + 1).toString().padStart(2, '0')}-${withdrawalDay.toString().padStart(2, '0')}`
      console.log('作成した日付文字列:', dateString)
      
      // 営業日調整のためにDateオブジェクトを作成（UTC時刻で）
      const calculatedDate = new Date(dateString + 'T12:00:00.000Z') // 正午UTC = 日本時間21時
      console.log('営業日調整用Date:', calculatedDate)
      
      // 土日祝日の場合は翌平日に調整
      const adjustedDate = await this.adjustToBusinessDay(calculatedDate)
      console.log('営業日調整後:', adjustedDate.toISOString().split('T')[0])
      
      // 最終的な引落日は文字列で直接設定
      this.withdrawalDate = adjustedDate.toISOString().split('T')[0]
      console.log('最終的な引落日:', this.withdrawalDate)
      console.log('=== クレジットカード引落日計算終了 ===')
    },
    
    async adjustToBusinessDay(date) {
      const targetDate = new Date(date)
      console.log('営業日調整開始:', targetDate.toISOString().split('T')[0])
      
      while (true) {
        const dayOfWeek = targetDate.getDay()
        const dateString = targetDate.toISOString().split('T')[0]
        
        console.log('チェック中の日付:', dateString, '曜日:', dayOfWeek)
        
        // 土日(6)または日曜日(0)の場合
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          console.log('土日のため翌日へ')
          targetDate.setDate(targetDate.getDate() + 1)
          continue
        }
        
        // 祝日チェック
        const isHoliday = await this.isJapaneseHoliday(dateString)
        console.log('祝日チェック結果:', isHoliday)
        
        if (isHoliday) {
          console.log('祝日のため翌日へ')
          targetDate.setDate(targetDate.getDate() + 1)
          continue
        }
        
        console.log('営業日確定:', dateString)
        break
      }
      
      return targetDate
    },
    
    async isJapaneseHoliday(dateString) {
      try {
        const year = dateString.substring(0, 4)
        console.log('祝日API呼び出し:', `https://holidays-jp.github.io/api/v1/${year}/date.json`)
        const response = await fetch(`https://holidays-jp.github.io/api/v1/${year}/date.json`)
        const holidays = await response.json()
        console.log('祝日データ:', holidays)
        const result = holidays.hasOwnProperty(dateString)
        console.log(`${dateString}の祝日判定:`, result)
        return result
      } catch (error) {
        console.error('祝日APIエラー:', error)
        return false // API失敗時は祝日ではないとみなす
      }
    },
    resetCategorySelection() {
      this.category = ''
      this.subcategory = ''
      this.selectedCategory = null
    },
    async loadTransaction() {
      try {
        const response = await ApiService.getTransaction(this.transactionId)
        const transaction = response.transaction
        
        this.transactionType = transaction.type
        this.amount = transaction.amount
        this.category = transaction.category
        this.subcategory = transaction.subcategory || ''
        this.memo = transaction.memo || ''
        this.date = transaction.date
        this.selectedAccountId = transaction.accountId || 'cash'
        this.withdrawalDate = transaction.withdrawalDate || this.date
        
        // カテゴリ選択を更新
        this.onCategoryChange()
      } catch (error) {
        console.error('取引データの読み込みに失敗:', error)
        this.message = '取引データの読み込みに失敗しました'
      }
    },
    
    async submitTransaction() {
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
      
      // 現金以外の場合は引落日を追加
      if (this.selectedAccountId !== 'cash') {
        transaction.withdrawalDate = this.withdrawalDate
      }

      try {
        this.loading = true
        
        if (this.isEditMode) {
          await ApiService.updateTransaction(this.transactionId, transaction)
          this.message = '取引を更新しました'
          setTimeout(() => {
            this.$router.push('/transactions')
          }, 1000)
        } else {
          await ApiService.createTransaction(transaction)
          this.message = '取引を追加しました'
          this.resetForm()
        }
      } catch (error) {
        console.error('取引の保存に失敗:', error)
        this.message = this.isEditMode ? '取引の更新に失敗しました' : '取引の追加に失敗しました'
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
      this.withdrawalDate = new Date().toISOString().split('T')[0]
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