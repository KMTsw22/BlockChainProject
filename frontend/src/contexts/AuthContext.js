import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

// JWT 토큰 디코딩 함수
const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

// 토큰 만료 확인
const isTokenExpired = (token) => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  return Date.now() >= decoded.exp * 1000;
};

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

  // 로그아웃 함수 (useEffect보다 먼저 정의)
  const logout = () => {
    console.log('🔴 로그아웃 - localStorage 정리');
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('wallet');
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('token') || localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    
    console.log('🔍 AuthContext 초기화 - 토큰 확인');
    
    if (storedToken && storedUser && storedUser !== 'undefined') {
      // 토큰 만료 확인
      if (isTokenExpired(storedToken)) {
        console.log('⚠️ 토큰 만료됨 - localStorage 정리');
        logout();
      } else {
        console.log('✅ 유효한 토큰 발견');
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } else {
      console.log('ℹ️ 저장된 토큰 없음');
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

  // Axios interceptor 설정 (401/403 오류 시 자동 로그아웃)
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          console.log('🔴 인증 오류 감지 - 자동 로그아웃');
          logout();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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