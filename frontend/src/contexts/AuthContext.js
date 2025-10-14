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
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (provider, socialData) => {
    try {
      // 로컬 개발에서는 /auth 경로 사용
      const response = await axios.post('/auth/social-login', {
        provider,
        social_id: socialData.id,
        email: socialData.email,
        name: socialData.name,
        profile_image: socialData.picture || socialData.profile_image
      });

      const { access_token, user: userData, wallet } = response.data;
      
      // 토큰과 사용자 정보 저장
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('wallet', JSON.stringify(wallet));
      
      setToken(access_token);
      setUser(userData);
      
      return { success: true, user: userData, wallet };
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