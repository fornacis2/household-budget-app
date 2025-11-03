import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import InitialSetup from './views/InitialSetup.vue'
import TransactionInput from './views/TransactionInput.vue'
import BalanceView from './views/BalanceView.vue'
import CategoryManagement from './views/CategoryManagement.vue'
import BankAccountManagement from './views/BankAccountManagement.vue'
import BankTransferInput from './views/BankTransferInput.vue'
import ReportView from './views/ReportView.vue'

const routes = [
  { path: '/', redirect: '/setup' },
  { path: '/setup', component: InitialSetup },
  { path: '/input', component: TransactionInput },
  { path: '/balance', component: BalanceView },
  { path: '/categories', component: CategoryManagement },
  { path: '/bank-accounts', component: BankAccountManagement },
  { path: '/bank-transfer', component: BankTransferInput },
  { path: '/report', component: ReportView }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

createApp(App).use(router).mount('#app')