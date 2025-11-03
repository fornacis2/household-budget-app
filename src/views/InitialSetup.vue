<template>
  <div class="initial-setup">
    <h2>初期設定</h2>
    <div class="setup-form">
      <div class="form-group">
        <label for="initialBalance">開始残高（円）</label>
        <input
          id="initialBalance"
          v-model.number="initialBalance"
          type="number"
          placeholder="例: 50000"
          class="form-input"
        />
      </div>
      <button @click="saveInitialBalance" class="btn-primary" :disabled="loading">
        {{ loading ? '保存中...' : '設定保存' }}
      </button>
      <div v-if="message" class="message">{{ message }}</div>
    </div>
  </div>
</template>

<script>
import ApiService from '../services/api.js'

export default {
  name: 'InitialSetup',
  data() {
    return {
      initialBalance: 0,
      message: '',
      loading: false
    }
  },
  mounted() {
    this.loadInitialBalance()
  },
  methods: {
    async loadInitialBalance() {
      try {
        this.loading = true
        const response = await ApiService.getInitialBalance()
        this.initialBalance = response.initialBalance || 0
      } catch (error) {
        console.error('初期残高の取得に失敗:', error)
        // フォールバック: ローカルストレージから取得
        const saved = localStorage.getItem('initialBalance')
        if (saved) {
          this.initialBalance = parseInt(saved)
        }
      } finally {
        this.loading = false
      }
    },
    async saveInitialBalance() {
      try {
        this.loading = true
        await ApiService.saveInitialBalance(this.initialBalance)
        // ローカルストレージにもバックアップ保存
        localStorage.setItem('initialBalance', this.initialBalance.toString())
        this.message = '初期残高を保存しました'
      } catch (error) {
        console.error('初期残高の保存に失敗:', error)
        // フォールバック: ローカルストレージに保存
        localStorage.setItem('initialBalance', this.initialBalance.toString())
        this.message = '初期残高を保存しました（ローカル）'
      } finally {
        this.loading = false
        setTimeout(() => {
          this.message = ''
        }, 3000)
      }
    }
  }
}
</script>

<style scoped>
.initial-setup {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.setup-form {
  max-width: 400px;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
  color: #333;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
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

.btn-primary:hover {
  background-color: #2980b9;
}

.message {
  margin-top: 1rem;
  padding: 0.75rem;
  background-color: #d4edda;
  color: #155724;
  border-radius: 4px;
}
</style>