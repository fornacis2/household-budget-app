import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import InitialSetup from './views/InitialSetup.vue'
import TransactionInput from './views/TransactionInput.vue'
import BalanceView from './views/BalanceView.vue'
import CategoryManagement from './views/CategoryManagement.vue'
import BankAccountManagement from './views/BankAccountManagement.vue'
import BankTransferInput from './views/BankTransferInput.vue'
import CreditCardManagement from './views/CreditCardManagement.vue'
import DailyBalanceManagement from './views/DailyBalanceManagement.vue'
import WeeklyReportView from './views/WeeklyReportView.vue'
import YearlyReportView from './views/YearlyReportView.vue'
import TransactionListView from './views/TransactionListView.vue'

const routes = [
  { path: '/', redirect: '/setup' },
  { path: '/setup', component: InitialSetup },
  { path: '/input/:transactionId?', component: TransactionInput },
  { path: '/balance', component: BalanceView },
  { path: '/categories', component: CategoryManagement },
  { path: '/bank-accounts', component: BankAccountManagement },
  { path: '/bank-transfer', component: BankTransferInput },
  { path: '/credit-cards', component: CreditCardManagement },
  { path: '/daily-balances', component: DailyBalanceManagement },
  { path: '/reports/weekly', component: WeeklyReportView },
  { path: '/reports/yearly', component: YearlyReportView },
  { path: '/transactions', component: TransactionListView }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

createApp(App).use(router).mount('#app')