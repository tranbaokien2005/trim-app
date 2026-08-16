import api from './api';
import * as SecureStore from 'expo-secure-store';

export const register = (userData) => {
  return fetch('http://192.168.68.108:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  })
    .then((response) =>
      response.json().then((data) => ({ response, data }))
    )
    .then(({ response, data }) => {
      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }
      return data; // { accessToken, refreshToken, user }
    });
};

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
