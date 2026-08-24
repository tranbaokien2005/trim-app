import api from './api';
import * as SecureStore from 'expo-secure-store';

// Goes through the shared axios instance, so BASE_URL lives in api.js only.
// Note: axios rejects on 4xx/5xx, so the backend message is on
// err.response.data.message — not err.message like the old fetch version.
export const register = (userData) =>
  api.post('/auth/register', userData).then((res) => res.data); // { accessToken, refreshToken, user }

export const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', { email, password });
    const { accessToken, refreshToken, user } = response.data;

    await SecureStore.setItemAsync('authToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);

    return { accessToken, refreshToken, user };
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const logout = async () => {
  try {
    await SecureStore.deleteItemAsync('authToken');
    return true;
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

export const getStoredToken = async () => {
  try {
    const token = await SecureStore.getItemAsync('authToken');
    return token;
  } catch (error) {
    console.error('Error retrieving token:', error);
    return null;
  }
};
