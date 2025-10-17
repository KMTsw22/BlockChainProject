import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const WalletContext = createContext();

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
  const { token } = useAuth();
  const [walletInfo, setWalletInfo] = useState(null);
  const [balance, setBalance] = useState({
    balance: '0',
    staked_amount: '0',
    pending_rewards: '0',
    is_staking_active: false
  });
  const [loading, setLoading] = useState(false);

  const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000', // 로컬 개발 서버
    //baseURL: process.env.REACT_APP_API_URL || '/api', // 서버리스 환경에서는 /api 사용
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // 토큰이 변경될 때마다 헤더 업데이트
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const fetchWalletInfo = useCallback(async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const response = await api.get('/wallet/info');
      setWalletInfo(response.data);
    } catch (error) {
      console.error('지갑 정보 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [token, api]);

  const fetchBalance = useCallback(async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const response = await api.get('/wallet/balance');
      setBalance(response.data);
    } catch (error) {
      console.error('잔액 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [token, api]);

  const mintTokens = async (amount) => {
    try {
      setLoading(true);
      const response = await api.post('/wallet/mint', { amount });
      await fetchBalance(); // 잔액 새로고침
      return { success: true, data: response.data };
    } catch (error) {
      console.error('토큰 발행 오류:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || '토큰 발행에 실패했습니다.' 
      };
    } finally {
      setLoading(false);
    }
  };

  const transferTokens = async (toAddress, amount) => {
    try {
      setLoading(true);
      const response = await api.post('/wallet/transfer', {
        to_address: toAddress,
        amount: amount
      });
      await fetchBalance(); // 잔액 새로고침
      return { success: true, data: response.data };
    } catch (error) {
      console.error('토큰 전송 오류:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || '토큰 전송에 실패했습니다.' 
      };
    } finally {
      setLoading(false);
    }
  };

  const stakeTokens = async (amount) => {
    try {
      setLoading(true);
      const response = await api.post('/wallet/stake', { amount });
      await fetchBalance(); // 잔액 새로고침
      return { success: true, data: response.data };
    } catch (error) {
      console.error('스테이킹 오류:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || '스테이킹에 실패했습니다.' 
      };
    } finally {
      setLoading(false);
    }
  };

  const claimRewards = async () => {
    try {
      setLoading(true);
      const response = await api.post('/wallet/claim-rewards');
      await fetchBalance(); // 잔액 새로고침
      return { success: true, data: response.data };
    } catch (error) {
      console.error('보상 청구 오류:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || '보상 청구에 실패했습니다.' 
      };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchWalletInfo();
      fetchBalance();
    }
  }, [token, fetchWalletInfo, fetchBalance]);

  const value = {
    walletInfo,
    balance,
    loading,
    fetchWalletInfo,
    fetchBalance,
    mintTokens,
    transferTokens,
    stakeTokens,
    claimRewards
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};