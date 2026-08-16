import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

let _authToken = null;
let _logoutCallback = null;
let _isRefreshing = false;
let _failedQueue = [];

export const setAuthToken = (token) => {
  _authToken = token;
};

export const setLogoutCallback = (callback) => {
  _logoutCallback = callback;
};

const processQueue = (error, token = null) => {
  _failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  _failedQueue = [];
};

const BASE_URL = 'http://192.168.68.108:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    if (_authToken) {
      config.headers.Authorization = `Bearer ${_authToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (_isRefreshing) {
      return new Promise((resolve, reject) => {
        _failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    _isRefreshing = true;

    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (!refreshToken) throw new Error('No refresh token');

      // Use axios directly to bypass this interceptor
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
      const newAccessToken = data.accessToken;

      await SecureStore.setItemAsync('authToken', newAccessToken);
      setAuthToken(newAccessToken);
      processQueue(null, newAccessToken);

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      await SecureStore.deleteItemAsync('authToken').catch(() => {});
      await SecureStore.deleteItemAsync('refreshToken').catch(() => {});
      await SecureStore.deleteItemAsync('authUser').catch(() => {});
      if (_logoutCallback) _logoutCallback();
      return Promise.reject(refreshError);
    } finally {
      _isRefreshing = false;
    }
  }
);

// ─── Smart Day Card (Tier 1) pattern endpoints ──────────────────────────

export const getPatternToday = async () => {
  const res = await api.get('/patterns/today');
  return res.data; // { success, data: { pattern, dataPointCount } }
};

export const applyPattern = async (sourceDate) => {
  const res = await api.post('/patterns/apply', { sourceDate });
  return res.data;
};

export default api;
