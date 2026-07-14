import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as authApi from '../api/auth';
import * as usersApi from '../api/users';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // On mount: check for existing tokens and validate
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        setIsLoading(false);
        return;
      }

      // Validate token by fetching profile
      const { user: profile } = await usersApi.getProfile();
      setUser(profile);
      setIsAuthenticated(true);
    } catch (err) {
      // Token invalid or expired and refresh failed — clear everything
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email, password) {
    const data = await authApi.login(email, password);

    // Store tokens securely (NOT AsyncStorage)
    await SecureStore.setItemAsync('accessToken', data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);

    setUser(data.user);
    setIsAuthenticated(true);

    return data;
  }

  async function register(email, password) {
    // Register creates user but doesn't return tokens
    await authApi.register(email, password);

    // Auto-login after successful registration
    return await login(email, password);
  }

  async function logout() {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    setUser(null);
    setIsAuthenticated(false);
  }

  // Re-fetch profile to update coin_balance (call after unlock)
  const refreshBalance = useCallback(async () => {
    try {
      const { user: profile } = await usersApi.getProfile();
      setUser(profile);
    } catch (err) {
      // Silently fail — balance will update on next navigation
      console.warn('Failed to refresh balance:', err.message);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        login,
        register,
        logout,
        refreshBalance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
