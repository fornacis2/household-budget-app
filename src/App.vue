<template>
  <div id="app">
    <nav class="navbar">
      <h1>家計簿アプリ</h1>
      <div class="nav-links">
        <router-link to="/setup">初期設定</router-link>
        <router-link to="/input">取引入力</router-link>
        <router-link to="/balance">残高確認</router-link>
        <router-link to="/categories">カテゴリ管理</router-link>
        <router-link to="/bank-accounts">銀行口座</router-link>
        <router-link to="/bank-transfer">預金・引出</router-link>
        <router-link to="/credit-cards">クレジットカード</router-link>
        <router-link to="/report">レポート</router-link>
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
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-links {
  display: flex;
  gap: 1rem;
}

.nav-links a {
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.nav-links a:hover,
.nav-links a.router-link-active {
  background-color: #34495e;
}

main {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}
</style>