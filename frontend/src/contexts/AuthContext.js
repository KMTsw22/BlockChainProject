import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser && storedUser !== 'undefined') {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (accessToken, userData) => {
    try {
      // Google OAuth 토큰을 사용한 로그인
      const response = await axios.post('/auth/google', {
        token: accessToken
      });

      const { access_token, user, wallet } = response.data;
      
      // 토큰과 사용자 정보 저장
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('wallet', JSON.stringify(wallet));
      
      setToken(access_token);
      setUser(user);
      
      return { success: true, user, wallet };
    } catch (error) {
      console.error('로그인 오류:', error);
      return { success: false, error: error.response?.data?.detail || '로그인에 실패했습니다.' };
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('wallet');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};