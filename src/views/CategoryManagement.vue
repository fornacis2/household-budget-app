<template>
  <div class="category-management">
    <h2>カテゴリ管理</h2>
    
    <div class="category-sections">
      <!-- 収入カテゴリ -->
      <div class="category-section">
        <h3>収入カテゴリ</h3>
        <div class="category-list">
          <div
            v-for="category in categories.income"
            :key="category.categoryId"
            class="category-item"
          >
            <div class="category-header">
              <span class="category-name">{{ category.name }}</span>
              <div class="category-actions">
                <button @click="editCategory(category)" class="btn-edit">編集</button>
                <button @click="deleteCategory(category.categoryId)" class="btn-delete">削除</button>
              </div>
            </div>
            <div class="subcategories">
              <span
                v-for="sub in category.subcategories"
                :key="sub"
                class="subcategory-tag"
              >
                {{ sub }}
              </span>
            </div>
          </div>
        </div>
        <button @click="showAddForm('income')" class="btn-add">+ 収入カテゴリを追加</button>
      </div>

      <!-- 支出カテゴリ -->
      <div class="category-section">
        <h3>支出カテゴリ</h3>
        <div class="category-list">
          <div
            v-for="category in categories.expense"
            :key="category.categoryId"
            class="category-item"
          >
            <div class="category-header">
              <span class="category-name">{{ category.name }}</span>
              <div class="category-actions">
                <button @click="editCategory(category)" class="btn-edit">編集</button>
                <button @click="deleteCategory(category.categoryId)" class="btn-delete">削除</button>
              </div>
            </div>
            <div class="subcategories">
              <span
                v-for="sub in category.subcategories"
                :key="sub"
                class="subcategory-tag"
              >
                {{ sub }}
              </span>
            </div>
          </div>
        </div>
        <button @click="showAddForm('expense')" class="btn-add">+ 支出カテゴリを追加</button>
      </div>
    </div>

    <!-- カテゴリ追加・編集フォーム -->
    <div v-if="showForm" class="category-form-overlay">
      <div class="category-form">
        <h3>{{ editingCategory ? 'カテゴリ編集' : 'カテゴリ追加' }}</h3>
        
        <div class="form-group">
          <label>カテゴリ名</label>
          <input
            v-model="formData.name"
            type="text"
            placeholder="例: 食費"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label>内訳（カンマ区切り）</label>
          <input
            v-model="subcategoriesText"
            type="text"
            placeholder="例: 食材,外食,弁当"
            class="form-input"
          />
        </div>

        <div class="form-actions">
          <button @click="saveCategory" class="btn-primary" :disabled="loading">
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
  name: 'CategoryManagement',
  data() {
    return {
      categories: {
        income: [],
        expense: []
      },
      showForm: false,
      editingCategory: null,
      formData: {
        name: '',
        type: 'expense'
      },
      subcategoriesText: '',
      loading: false,
      message: ''
    }
  },
  mounted() {
    this.loadCategories()
  },
  methods: {
    async loadCategories() {
      try {
        this.loading = true
        const response = await ApiService.getCategories()
        this.categories = response.categories
      } catch (error) {
        console.error('カテゴリの取得に失敗:', error)
        this.message = 'カテゴリの取得に失敗しました'
      } finally {
        this.loading = false
      }
    },
    
    showAddForm(type) {
      this.editingCategory = null
      this.formData = {
        name: '',
        type: type
      }
      this.subcategoriesText = ''
      this.showForm = true
    },
    
    editCategory(category) {
      this.editingCategory = category
      this.formData = {
        name: category.name,
        type: category.type
      }
      this.subcategoriesText = category.subcategories.join(',')
      this.showForm = true
    },
    
    async saveCategory() {
      if (!this.formData.name.trim()) {
        this.message = 'カテゴリ名を入力してください'
        return
      }

      try {
        this.loading = true
        
        const categoryData = {
          ...this.formData,
          subcategories: this.subcategoriesText
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0)
        }

        if (this.editingCategory) {
          await ApiService.updateCategory(this.editingCategory.categoryId, categoryData)
          this.message = 'カテゴリを更新しました'
        } else {
          await ApiService.createCategory(categoryData)
          this.message = 'カテゴリを追加しました'
        }

        this.showForm = false
        await this.loadCategories()
      } catch (error) {
        console.error('カテゴリの保存に失敗:', error)
        this.message = 'カテゴリの保存に失敗しました'
      } finally {
        this.loading = false
        setTimeout(() => {
          this.message = ''
        }, 3000)
      }
    },
    
    async deleteCategory(categoryId) {
      if (!confirm('このカテゴリを削除しますか？')) {
        return
      }

      try {
        this.loading = true
        await ApiService.deleteCategory(categoryId)
        this.message = 'カテゴリを削除しました'
        await this.loadCategories()
      } catch (error) {
        console.error('カテゴリの削除に失敗:', error)
        this.message = 'カテゴリの削除に失敗しました'
      } finally {
        this.loading = false
        setTimeout(() => {
          this.message = ''
        }, 3000)
      }
    },
    
    cancelForm() {
      this.showForm = false
      this.editingCategory = null
    }
  }
}
</script>

<style scoped>
.category-management {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.category-sections {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
}

.category-section h3 {
  color: #2c3e50;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #ecf0f1;
}

.category-list {
  margin-bottom: 1rem;
}

.category-item {
  background: #f8f9fa;
  padding: 1rem;
  margin-bottom: 0.5rem;
  border-radius: 4px;
  border-left: 4px solid #3498db;
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.category-name {
  font-weight: bold;
  color: #2c3e50;
}

.category-actions {
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

.subcategories {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.subcategory-tag {
  background-color: #ecf0f1;
  color: #7f8c8d;
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  font-size: 0.8rem;
}

.btn-add {
  background-color: #27ae60;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
}

.category-form-overlay {
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

.category-form {
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

@media (max-width: 768px) {
  .category-sections {
    grid-template-columns: 1fr;
  }
}
</style>