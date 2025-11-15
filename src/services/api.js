// AWS API設定
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
console.log('API_BASE_URL:', API_BASE_URL)
console.log('Environment variables:', import.meta.env)

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    }

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body)
    }

    console.log('Making request to:', url)
    console.log('Request config:', config)

    try {
      const response = await fetch(url, config)
      console.log('Response status:', response.status)
      console.log('Response headers:', response.headers)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error text:', errorText)
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
      }
      
      const data = await response.json()
      console.log('Response data:', data)
      return data
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }

  // ユーザー初期設定
  async saveInitialBalance(balance) {
    return this.request('/user/initial-balance', {
      method: 'POST',
      body: { initialBalance: balance }
    })
  }

  async getInitialBalance() {
    return this.request('/user/initial-balance')
  }

  // 取引管理
  async createTransaction(transaction) {
    return this.request('/transactions', {
      method: 'POST',
      body: transaction
    })
  }

  async getTransactions() {
    return this.request('/transactions')
  }

  async deleteTransaction(transactionId) {
    return this.request(`/transactions/${transactionId}`, {
      method: 'DELETE'
    })
  }

  // 残高計算
  async getCurrentBalance() {
    return this.request('/balance')
  }

  // カテゴリ管理
  async getCategories() {
    return this.request('/categories')
  }

  async createCategory(category) {
    return this.request('/categories', {
      method: 'POST',
      body: category
    })
  }

  async updateCategory(categoryId, category) {
    return this.request(`/categories/${categoryId}`, {
      method: 'PUT',
      body: category
    })
  }

  async deleteCategory(categoryId) {
    return this.request(`/categories/${categoryId}`, {
      method: 'DELETE'
    })
  }

  // 銀行口座管理
  async getBankAccounts() {
    return this.request('/bank-accounts')
  }

  async createBankAccount(bankAccount) {
    return this.request('/bank-accounts', {
      method: 'POST',
      body: bankAccount
    })
  }

  async updateBankAccount(accountId, bankAccount) {
    return this.request(`/bank-accounts/${accountId}`, {
      method: 'PUT',
      body: bankAccount
    })
  }

  async deleteBankAccount(accountId) {
    return this.request(`/bank-accounts/${accountId}`, {
      method: 'DELETE'
    })
  }

  async bankTransfer(accountId, transferData) {
    return this.request(`/bank-accounts/${accountId}/transfer`, {
      method: 'POST',
      body: transferData
    })
  }

  // クレジットカード管理
  async getCreditCards() {
    return this.request('/credit-cards')
  }

  async addCreditCard(creditCard) {
    return this.request('/credit-cards', {
      method: 'POST',
      body: creditCard
    })
  }

  async updateCreditCard(cardId, creditCard) {
    return this.request(`/credit-cards/${cardId}`, {
      method: 'PUT',
      body: creditCard
    })
  }

  async deleteCreditCard(cardId) {
    return this.request(`/credit-cards/${cardId}`, {
      method: 'DELETE'
    })
  }
}

export default new ApiService()