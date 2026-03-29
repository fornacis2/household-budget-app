// AWS API設定
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
console.log('API_BASE_URL:', API_BASE_URL)
console.log('Environment variables:', import.meta.env)

class ApiService {
  constructor() {
    this.cache = new Map()
    this.CACHE_TTL = 30 * 60 * 1000 // 30分
  }

  isCacheValid(key) {
    const cached = this.cache.get(key)
    return cached && (Date.now() - cached.timestamp) < this.CACHE_TTL
  }

  setCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  clearCache(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  async cachedRequest(endpoint, options = {}, cacheKey = null, forceRefresh = false) {
    const key = cacheKey || endpoint
    
    if (!forceRefresh && this.isCacheValid(key)) {
      return this.cache.get(key).data
    }
    
    const data = await this.request(endpoint, options)
    this.setCache(key, data)
    return data
  }

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

  async getTransactions(startDate, endDate) {
    let endpoint = '/transactions'
    if (startDate && endDate) {
      endpoint += `?startDate=${startDate}&endDate=${endDate}`
    }
    return this.request(endpoint)
  }

  async getTransaction(transactionId) {
    return this.request(`/transactions/${transactionId}`)
  }

  async updateTransaction(transactionId, transaction) {
    return this.request(`/transactions/${transactionId}`, {
      method: 'PUT',
      body: transaction
    })
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
  async getCategories(forceRefresh = false) {
    return this.cachedRequest('/categories', {}, 'categories', forceRefresh)
  }

  async createCategory(category) {
    const result = await this.request('/categories', {
      method: 'POST',
      body: category
    })
    this.clearCache('categories')
    return result
  }

  async updateCategory(categoryId, category) {
    const result = await this.request(`/categories/${categoryId}`, {
      method: 'PUT',
      body: category
    })
    this.clearCache('categories')
    return result
  }

  async deleteCategory(categoryId) {
    const result = await this.request(`/categories/${categoryId}`, {
      method: 'DELETE'
    })
    this.clearCache('categories')
    return result
  }

  // 銀行口座管理
  async getBankAccounts(forceRefresh = false) {
    return this.cachedRequest('/bank-accounts', {}, 'bankAccounts', forceRefresh)
  }

  async createBankAccount(bankAccount) {
    const result = await this.request('/bank-accounts', {
      method: 'POST',
      body: bankAccount
    })
    this.clearCache('bankAccounts')
    return result
  }

  async updateBankAccount(accountId, bankAccount) {
    const result = await this.request(`/bank-accounts/${accountId}`, {
      method: 'PUT',
      body: bankAccount
    })
    this.clearCache('bankAccounts')
    return result
  }

  async deleteBankAccount(accountId) {
    const result = await this.request(`/bank-accounts/${accountId}`, {
      method: 'DELETE'
    })
    this.clearCache('bankAccounts')
    return result
  }

  async bankTransfer(accountId, transferData) {
    return this.request(`/bank-accounts/${accountId}/transfer`, {
      method: 'POST',
      body: transferData
    })
  }

  // クレジットカード管理
  async getCreditCards(forceRefresh = false) {
    return this.cachedRequest('/credit-cards', {}, 'creditCards', forceRefresh)
  }

  async addCreditCard(creditCard) {
    const result = await this.request('/credit-cards', {
      method: 'POST',
      body: creditCard
    })
    this.clearCache('creditCards')
    return result
  }

  async updateCreditCard(cardId, creditCard) {
    const result = await this.request(`/credit-cards/${cardId}`, {
      method: 'PUT',
      body: creditCard
    })
    this.clearCache('creditCards')
    return result
  }

  async deleteCreditCard(cardId) {
    const result = await this.request(`/credit-cards/${cardId}`, {
      method: 'DELETE'
    })
    this.clearCache('creditCards')
    return result
  }

  // 日次残高管理
  async getDailyBalances(date, startDate, endDate) {
    if (startDate && endDate) {
      // 範囲指定での読み込み
      const params = `?startDate=${startDate}&endDate=${endDate}`
      return this.request(`/daily-balances${params}`)
    } else {
      // 特定日での読み込み（既存）
      const params = date ? `?date=${date}` : ''
      return this.request(`/daily-balances${params}`)
    }
  }

  async getAccountDailyBalances(accountId, startDate, endDate) {
    let params = ''
    if (startDate && endDate) {
      params = `?startDate=${startDate}&endDate=${endDate}`
    }
    return this.request(`/daily-balances/${accountId}${params}`)
  }

  async recalculateDailyBalances(options = {}) {
    return this.request('/daily-balances/recalculate', {
      method: 'POST',
      body: options
    })
  }
}

export default new ApiService()