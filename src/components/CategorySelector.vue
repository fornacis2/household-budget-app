<template>
  <div class="category-selector">
    <div class="form-group">
      <label>大分類</label>
      <select
        v-model="selectedCategory"
        @change="onCategoryChange"
        class="form-select"
      >
        <option value="">カテゴリを選択してください</option>
        <option
          v-for="category in availableCategories"
          :key="category.categoryId"
          :value="category"
        >
          {{ category.name }}
        </option>
      </select>
    </div>

    <div class="form-group" v-if="selectedCategory && selectedCategory.subcategories.length > 0">
      <label>内訳</label>
      <select
        v-model="selectedSubcategory"
        @change="onSubcategoryChange"
        class="form-select"
      >
        <option value="">内訳を選択してください</option>
        <option
          v-for="sub in selectedCategory.subcategories"
          :key="sub"
          :value="sub"
        >
          {{ sub }}
        </option>
      </select>
    </div>

    <div class="form-group" v-else-if="selectedCategory">
      <label>内訳（任意）</label>
      <input
        v-model="customSubcategory"
        @input="onCustomSubcategoryChange"
        type="text"
        placeholder="内訳を入力（省略可）"
        class="form-input"
      />
    </div>
  </div>
</template>

<script>
export default {
  name: 'CategorySelector',
  props: {
    transactionType: {
      type: String,
      required: true
    },
    categories: {
      type: Object,
      required: true
    },
    modelValue: {
      type: Object,
      default: () => ({ category: '', subcategory: '' })
    }
  },
  emits: ['update:modelValue'],
  data() {
    return {
      selectedCategory: null,
      selectedSubcategory: '',
      customSubcategory: ''
    }
  },
  computed: {
    availableCategories() {
      return this.categories[this.transactionType] || []
    }
  },
  watch: {
    transactionType() {
      this.resetSelection()
    },
    modelValue: {
      handler(newValue) {
        if (newValue.category) {
          this.selectedCategory = this.availableCategories.find(cat => cat.name === newValue.category)
          this.selectedSubcategory = newValue.subcategory
          this.customSubcategory = newValue.subcategory
        }
      },
      immediate: true
    }
  },
  methods: {
    onCategoryChange() {
      this.selectedSubcategory = ''
      this.customSubcategory = ''
      this.emitChange()
    },
    
    onSubcategoryChange() {
      this.customSubcategory = this.selectedSubcategory
      this.emitChange()
    },
    
    onCustomSubcategoryChange() {
      this.selectedSubcategory = this.customSubcategory
      this.emitChange()
    },
    
    emitChange() {
      this.$emit('update:modelValue', {
        category: this.selectedCategory?.name || '',
        subcategory: this.selectedSubcategory || this.customSubcategory || ''
      })
    },
    
    resetSelection() {
      this.selectedCategory = null
      this.selectedSubcategory = ''
      this.customSubcategory = ''
      this.emitChange()
    }
  }
}
</script>

<style scoped>
.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
  color: #333;
}

.form-input, .form-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.form-select {
  background-color: white;
  cursor: pointer;
}
</style>