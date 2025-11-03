// デバッグ用のAPI接続テスト
export const testApiConnection = async () => {
  const API_URL = import.meta.env.VITE_API_URL
  console.log('Environment API URL:', API_URL)
  
  try {
    const response = await fetch(`${API_URL}/user/initial-balance`)
    console.log('API Response Status:', response.status)
    console.log('API Response Headers:', response.headers)
    
    if (response.ok) {
      const data = await response.json()
      console.log('API Response Data:', data)
    } else {
      console.error('API Error:', response.statusText)
    }
  } catch (error) {
    console.error('Network Error:', error)
  }
}