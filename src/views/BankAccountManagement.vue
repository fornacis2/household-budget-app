<template>
  <div class="bank-account-management">
    <h2>銀行口座管理</h2>

    <div class="accounts-section">
      <h3>登録済み口座</h3>
      <div class="account-list">
        <div
          v-for="(account, index) in bankAccounts"
          :key="account.accountId"
          class="account-item"
        >
          <div class="sort-buttons">
            <button @click="moveUp(index)" class="btn-sort" :disabled="index === 0">↑</button>
            <button @click="moveDown(index)" class="btn-sort" :disabled="index === bankAccounts.length - 1">↓</button>
          </div>
          <div class="account-name">{{ account.bankName }}</div>
          <div class="account-balance">¥{{ account.balance.toLocaleString() }}</div>
          <div class="account-actions">
            <button @click="editAccount(account)" class="btn-edit">編集</button>
            <button @click="deleteAccount(account.accountId)" class="btn-delete">削除</button>
          </div>
        </div>
      </div>
      <div class="section-footer">
        <button @click="showAccountForm" class="btn-add">+ 新しい口座を追加</button>
        <button @click="updateSortOrder" class="btn-update" :disabled="loading">順序を更新</button>
      </div>
    </div>

    <!-- 口座追加・編集フォーム（モーダル） -->
    <div v-if="showForm" class="form-overlay">
      <div class="form-modal">
        <h3>{{ editingAccount ? '口座編集' : '口座追加' }}</h3>

        <div class="form-group">
          <label>銀行名</label>
          <input
            v-model="formData.bankName"
            type="text"
            placeholder="例: みずほ銀行"
            class="form-input"
          />
        </div>

        <div class="form-group" v-if="!editingAccount">
          <label>開始残高（円）</label>
          <input
            v-model.number="formData.initialBalance"
            type="number"
            placeholder="例: 100000"
            class="form-input"
          />
        </div>

        <div class="form-group" v-else>
          <label>現在残高（円）</label>
          <input
            v-model.number="formData.balance"
            type="number"
            class="form-input"
          />
        </div>

        <div class="form-actions">
          <button @click="saveAccount" class="btn-primary" :disabled="loading">
            {{ loading ? '保存中...' : '保存' }}
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
  name: 'BankAccountManagement',
  data() {
    return {
      bankAccounts: [],
      showForm: false,
      editingAccount: null,
      formData: {
        bankName: '',
        initialBalance: 0,
        balance: 0
      },
      loading: false,
      message: ''
    }
  },
  mounted() {
    this.loadBankAccounts()
  },
  methods: {
    async loadBankAccounts() {
      try {
        this.loading = true
        const response = await ApiService.getBankAccounts()
        this.bankAccounts = response.bankAccounts
      } catch (error) {
        console.error('銀行口座の取得に失敗:', error)
        this.message = '銀行口座の取得に失敗しました'
      } finally {
        this.loading = false
      }
    },

    showAccountForm() {
      this.editingAccount = null
      this.formData = { bankName: '', initialBalance: 0, balance: 0 }
      this.showForm = true
    },

    editAccount(account) {
      this.editingAccount = account
      this.formData = { bankName: account.bankName, balance: account.balance }
      this.showForm = true
    },

    async saveAccount() {
      if (!this.formData.bankName.trim()) {
        this.message = '銀行名を入力してください'
        return
      }

      try {
        this.loading = true

        if (this.editingAccount) {
          await ApiService.updateBankAccount(this.editingAccount.accountId, {
            bankName: this.formData.bankName,
            balance: this.formData.balance
          })
          this.message = '口座を更新しました'
        } else {
          await ApiService.createBankAccount({
            bankName: this.formData.bankName,
            initialBalance: this.formData.initialBalance
          })
          this.message = '口座を追加しました'
        }

        this.showForm = false
        await this.loadBankAccounts()
      } catch (error) {
        console.error('口座の保存に失敗:', error)
        this.message = '口座の保存に失敗しました'
      } finally {
        this.loading = false
        setTimeout(() => { this.message = '' }, 3000)
      }
    },

    async deleteAccount(accountId) {
      if (!confirm('この口座を削除しますか？')) return

      try {
        this.loading = true
        await ApiService.deleteBankAccount(accountId)
        this.message = '口座を削除しました'
        await this.loadBankAccounts()
      } catch (error) {
        console.error('口座の削除に失敗:', error)
        this.message = '口座の削除に失敗しました'
      } finally {
        this.loading = false
        setTimeout(() => { this.message = '' }, 3000)
      }
    },

    cancelForm() {
      this.showForm = false
      this.editingAccount = null
    },

    moveUp(index) {
      if (index === 0) return
      const tmp = this.bankAccounts[index - 1]
      this.bankAccounts[index - 1] = this.bankAccounts[index]
      this.bankAccounts[index] = tmp
    },

    moveDown(index) {
      if (index === this.bankAccounts.length - 1) return
      const tmp = this.bankAccounts[index + 1]
      this.bankAccounts[index + 1] = this.bankAccounts[index]
      this.bankAccounts[index] = tmp
    },

    async updateSortOrder() {
      try {
        this.loading = true
        await Promise.all(
          this.bankAccounts.map((account, index) =>
            ApiService.updateBankAccount(account.accountId, {
              bankName: account.bankName,
              balance: account.balance,
              sortOrder: index + 1
            })
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
    }
  }
}
</script>

<style scoped>
.bank-account-management {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.accounts-section h3 {
  color: #2c3e50;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #ecf0f1;
}

.account-list {
  margin-bottom: 1rem;
}

.account-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #f8f9fa;
  padding: 0.75rem 1rem;
  margin-bottom: 0.5rem;
  border-radius: 4px;
  border-left: 4px solid #3498db;
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

.account-name {
  flex: 1;
  font-weight: bold;
  color: #2c3e50;
}

.account-balance {
  font-weight: bold;
  color: #27ae60;
  min-width: 120px;
  text-align: right;
}

.account-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-edit, .btn-delete {
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.8rem;
}

.btn-edit {
  background-color: #f39c12;
  color: white;
}

.btn-delete {
  background-color: #e74c3c;
  color: white;
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

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
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
