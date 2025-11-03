<template>
  <div class="bank-account-management">
    <h2>銀行口座管理</h2>
    
    <!-- 口座一覧 -->
    <div class="accounts-section">
      <h3>登録済み口座</h3>
      <div class="accounts-grid">
        <div
          v-for="account in bankAccounts"
          :key="account.accountId"
          class="account-card"
        >
          <div class="account-header">
            <h4>{{ account.bankName }}</h4>
            <div class="account-actions">
              <button @click="editAccount(account)" class="btn-edit">編集</button>
              <button @click="deleteAccount(account.accountId)" class="btn-delete">削除</button>
            </div>
          </div>
          <div class="account-balance">
            残高: ¥{{ account.balance.toLocaleString() }}
          </div>

        </div>
      </div>
      
      <button @click="showAccountForm" class="btn-add">+ 新しい口座を追加</button>
    </div>

    <!-- 口座追加・編集フォーム -->
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
      this.formData = {
        bankName: '',
        initialBalance: 0,
        balance: 0
      }
      this.showForm = true
    },
    
    editAccount(account) {
      this.editingAccount = account
      this.formData = {
        bankName: account.bankName,
        balance: account.balance
      }
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
        setTimeout(() => {
          this.message = ''
        }, 3000)
      }
    },
    
    async deleteAccount(accountId) {
      if (!confirm('この口座を削除しますか？')) {
        return
      }

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
        setTimeout(() => {
          this.message = ''
        }, 3000)
      }
    },
    
    cancelForm() {
      this.showForm = false
      this.editingAccount = null
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

.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.account-card {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid #3498db;
}

.account-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.account-header h4 {
  margin: 0;
  color: #2c3e50;
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

.account-balance {
  font-size: 1.2rem;
  font-weight: bold;
  color: #27ae60;
  margin-bottom: 1rem;
}

.transfer-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-deposit, .btn-withdraw {
  flex: 1;
  padding: 0.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.btn-deposit {
  background-color: #27ae60;
  color: white;
}

.btn-withdraw {
  background-color: #e67e22;
  color: white;
}

.btn-add {
  background-color: #3498db;
  color: white;
  padding: 1rem 2rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
  font-size: 1rem;
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

.account-info {
  background-color: #ecf0f1;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  color: #2c3e50;
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