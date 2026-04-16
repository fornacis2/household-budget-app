<template>
  <div id="app">
    <nav class="navbar">
      <div class="nav-links">
        <router-link to="/reports/weekly" class="nav-orange">週別レポート</router-link>
        <router-link to="/reports/yearly" class="nav-orange">年別レポート</router-link>
        <router-link to="/balance" class="nav-orange">残高確認</router-link>
        <router-link to="/transactions" class="nav-orange">取引データ</router-link>
        <router-link to="/input" class="nav-blue">取引入力</router-link>
        <router-link to="/bank-transfer" class="nav-blue">預金・引出</router-link>
        <router-link to="/categories" class="nav-green">カテゴリ管理</router-link>
        <router-link to="/bank-accounts" class="nav-green">銀行口座</router-link>
        <router-link to="/credit-cards" class="nav-green">クレジットカード</router-link>
        <router-link to="/setup" class="nav-green">初期設定</router-link>
        <router-link to="/daily-balances" class="nav-green">日次残高</router-link>
      </div>
    </nav>
    <main>
      <router-view />
    </main>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #f5f5f5;
}

.navbar {
  background-color: #2c3e50;
  color: white;
  padding: 0.5rem 1rem;
  display: flex;
  align-items: center;
}

.nav-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.nav-links a {
  color: white;
  text-decoration: none;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  transition: opacity 0.2s;
  font-size: 0.9rem;
}

.nav-links a:hover {
  opacity: 0.8;
}

.nav-orange {
  background-color: #e67e22;
}

.nav-orange.router-link-active {
  background-color: #ca6f1e;
}

.nav-blue {
  background-color: #2980b9;
}

.nav-blue.router-link-active {
  background-color: #1f618d;
}

.nav-green {
  background-color: #27ae60;
}

.nav-green.router-link-active {
  background-color: #1e8449;
}

main {
  padding: 2rem;
  margin: 0 auto;
}
</style>