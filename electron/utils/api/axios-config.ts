import axios from 'axios'

const axiosInstance = axios.create({
  timeout: 15000,
  withCredentials: true
})

delete (axiosInstance.defaults as any).proxy

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[Axios] Request failed:', error.message)
    if (error.code === 'ECONNABORTED') {
      console.error('[Axios] Request timeout')
    }
    return Promise.reject(error)
  }
)

export default axiosInstance
