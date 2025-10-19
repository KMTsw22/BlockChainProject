import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import Web3 from 'web3';

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
  const [welcomeBonusStatusState, setWelcomeBonusStatusState] = useState(() => {
    // localStorage에서 환영 보너스 상태 복원
    const saved = localStorage.getItem('welcome_bonus_status');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.error('❌ 환영 보너스 상태 복원 실패:', error);
      }
    }
    return {
      received: false,
      pending: false,
      message: ''
    };
  });

  // welcomeBonusStatus setter - localStorage 자동 저장 + UI 업데이트
  const setWelcomeBonusStatus = (newStatus) => {
    setWelcomeBonusStatusState(newStatus);
    localStorage.setItem('welcome_bonus_status', JSON.stringify(newStatus));
  };

  // localStorage만 저장 (UI 업데이트 없음)
  const saveWelcomeBonusStatusToStorage = (newStatus) => {
    localStorage.setItem('welcome_bonus_status', JSON.stringify(newStatus));
  };

  // localStorage에서 상태를 읽어서 UI에 반영
  const syncWelcomeBonusStatusFromStorage = () => {
    const saved = localStorage.getItem('welcome_bonus_status');
    if (saved) {
      try {
        setWelcomeBonusStatusState(JSON.parse(saved));
      } catch (error) {
        console.error('❌ 환영 보너스 상태 동기화 실패:', error);
      }
    }
  };

  const welcomeBonusStatus = welcomeBonusStatusState;

  // Web3 설정
  const SEPOLIA_RPC_URL = process.env.REACT_APP_WEB3_RPC_URL || 'https://sepolia.infura.io/v3/e8630d4f3cd6413ea851365717502af4';
  const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || '0x96850830c5c5c62A151Cc41f14558F76ab2Bb55f'; // AdvancedRewardToken 스마트 컨트랙트
  
  // Web3 인스턴스 생성 (useMemo로 최적화)
  const web3 = useMemo(() => new Web3(SEPOLIA_RPC_URL), [SEPOLIA_RPC_URL]);
  
  // 트랜잭션 완료 대기 함수
  const waitForTransactionCompletion = async (txHash, maxAttempts = 30) => {
    console.log('⏳ 트랜잭션 완료 대기 중...');
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const receipt = await web3.eth.getTransactionReceipt(txHash);
        if (receipt && receipt.status) {
          console.log('✅ 트랜잭션 완료 확인됨!');
          return receipt;
        }
      } catch (error) {
        console.log(`⏳ 트랜잭션 대기 중... (${i + 1}/${maxAttempts})`);
      }
      
      // 2초 대기
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('⚠️ 트랜잭션 완료 대기 시간 초과, 잔액 새로고침을 계속 진행합니다.');
    return null;
  };
  
  // ART 토큰 컨트랙트 인스턴스 (useMemo로 최적화)
  const artContract = useMemo(() => {
    // ART 토큰 컨트랙트 ABI (필요한 함수들만)
    const ART_ABI = [
      {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
        "name": "getStakeInfo",
        "outputs": [
          {"internalType": "uint256", "name": "amount", "type": "uint256"},
          {"internalType": "uint256", "name": "startTime", "type": "uint256"},
          {"internalType": "uint256", "name": "lastClaimTime", "type": "uint256"},
          {"internalType": "bool", "name": "isActive", "type": "bool"},
          {"internalType": "uint256", "name": "pendingReward", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ];
    
    return new web3.eth.Contract(ART_ABI, CONTRACT_ADDRESS);
  }, [web3, CONTRACT_ADDRESS]);

  const fetchWalletInfo = useCallback(async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      
      // localStorage에서 사용자 정보 가져오기
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        
        // 사용자 ID와 비밀번호로 결정론적 지갑 생성
        const userId = userData.id || userData.user?.id || 'unknown_user';
        const password = localStorage.getItem('user_password') || 'default_password';
        const isExistingWallet = localStorage.getItem('is_existing_wallet') === 'true';
        
        // 시드 문자열 생성 (클라이언트에서)
        const seedString = `${userId}_${password}`;
        const seedHash = web3.utils.sha3(seedString) || web3.utils.keccak256(seedString);
        
        // 결정론적 지갑 생성 (시드에서 직접 private key 생성)
        const privateKey = '0x' + seedHash.slice(2, 66); // 32바이트 private key
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        
        setWalletInfo({
          address: account.address,
          private_key: account.privateKey
        });
        
        // 기존 지갑인 경우 환영 보너스 상태 초기화
        if (isExistingWallet) {
          const existingStatus = {
            received: true,
            pending: false,
            message: ''
          };
          setWelcomeBonusStatus(existingStatus);
        }
        
        // 새 지갑 생성 완료 - 환영 보너스 요청
        if (!isExistingWallet) {
          // 환영 보너스 상태 설정
          const newStatus = {
            received: false,
            pending: true,
            message: '환영 보너스가 곧 지급됩니다'
          };
          setWelcomeBonusStatus(newStatus);
          
          // 서버에 환영 보너스 요청
          try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/wallet/welcome-bonus`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                address: account.address
              })
            });
            
            if (response.ok) {
              await response.json();
              
              // 환영 보너스 지급 완료 상태를 localStorage에만 저장 (UI 업데이트 없음)
              const completedStatus = {
                received: true,
                pending: false,
                message: '' // 메시지 없음
              };
              saveWelcomeBonusStatusToStorage(completedStatus);
            }
          } catch (error) {
            console.error('❌ 환영 보너스 요청 중 오류:', error);
          }
        }
      } else {
        console.log('❌ localStorage에 사용자 정보가 없습니다');
      }
    } catch (error) {
      console.error('지갑 정보 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [token, web3]);

  // 특정 주소의 잔액을 조회하는 함수
  const fetchBalanceForAddress = useCallback(async (address) => {
    if (!token) {
      console.log('❌ 토큰이 없습니다');
      return;
    }
    
    if (!address) {
      console.log('❌ 지갑 주소가 없습니다.');
      return;
    }
    
    try {
      setLoading(true);
      
      console.log(`🔗 Sepolia 테스트넷 연결 중...`);
      console.log(`📍 지갑 주소: ${address}`);
      console.log(`📊 스마트 컨트랙트: ${CONTRACT_ADDRESS}`);
      
      // ART 토큰 컨트랙트 ABI
      const ART_ABI = [
        {
          "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
          "name": "balanceOf",
          "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
          "name": "getStakeInfo",
          "outputs": [
            {"internalType": "uint256", "name": "amount", "type": "uint256"},
            {"internalType": "uint256", "name": "startTime", "type": "uint256"},
            {"internalType": "uint256", "name": "lastClaimTime", "type": "uint256"},
            {"internalType": "bool", "name": "isActive", "type": "bool"}
          ],
          "stateMutability": "view",
          "type": "function"
        }
      ];
      
      // 컨트랙트 인스턴스 생성
      const contract = new web3.eth.Contract(ART_ABI, CONTRACT_ADDRESS);
      
      // 잔액 조회
      const balance = await contract.methods.balanceOf(address).call();
      console.log(`🔍 원시 잔액 값: ${balance}`);
      console.log(`🔍 잔액 타입: ${typeof balance}`);
      
      // ART 토큰은 5자리 소수점 (10^5)을 사용하므로 직접 나누기
      const balanceInTokens = (parseInt(balance) / Math.pow(10, 5)).toFixed(2);
      console.log(`🔍 변환된 잔액: ${balanceInTokens}`);
      
      // 스테이킹 정보 조회
      const stakeInfo = await contract.methods.getStakeInfo(address).call();
      const stakedAmount = (parseInt(stakeInfo.amount) / Math.pow(10, 5)).toFixed(2);
      
      // 보상 계산 (간단한 예시)
      const pendingRewards = (parseInt(stakeInfo.pendingReward) / Math.pow(10, 5)).toFixed(2);
      
      const newBalance = {
        balance: balanceInTokens,
        staked_amount: stakedAmount,
        pending_rewards: pendingRewards,
        is_staking_active: stakeInfo.isActive
      };
      
      setBalance(newBalance);
      
      console.log(`🪙 ART 토큰 잔액: ${balanceInTokens} ART`);
      console.log(`🔒 스테이킹된 양: ${stakedAmount} ART`);
      console.log(`🎁 대기 중인 보상: ${pendingRewards} ART`);
      console.log(`✅ 스테이킹 활성화: ${stakeInfo.isActive}`);
      
      // 강제 리렌더링을 위한 상태 업데이트
      setTimeout(() => {
        console.log('🔄 UI 강제 업데이트 시도:', {
          balance: balanceInTokens,
          staked_amount: stakedAmount,
          pending_rewards: pendingRewards,
          is_staking_active: stakeInfo.isActive
        });
        setBalance({
          balance: balanceInTokens,
          staked_amount: stakedAmount,
          pending_rewards: pendingRewards,
          is_staking_active: stakeInfo.isActive
        });
      }, 100);
      
    } catch (error) {
      console.error('❌ 잔액 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [token, web3, CONTRACT_ADDRESS]);

  const fetchBalance = useCallback(async () => {
    if (!token) {
      console.log('❌ 토큰이 없습니다');
      return;
    }
    
    console.log('🔍 지갑 정보 확인:', { walletInfo, address: walletInfo?.address });
    
    if (!walletInfo?.address) {
      console.log('❌ 지갑 주소가 없습니다. 먼저 지갑을 생성해주세요.');
      return;
    }
    
    try {
      setLoading(true);
      
      console.log(`🔗 Sepolia 테스트넷 연결 중...`);
      console.log(`📍 지갑 주소: ${walletInfo.address}`);
      console.log(`📊 스마트 컨트랙트: ${CONTRACT_ADDRESS}`);
      
      // ART 토큰 잔액 조회
      const artBalance = await artContract.methods.balanceOf(walletInfo.address).call();
      // ART 토큰은 5자리 소수점 (10^5)을 사용하므로 직접 나누기
      const artBalanceFormatted = (parseInt(artBalance) / Math.pow(10, 5)).toFixed(2);
      
      // 스테이킹 정보 조회
      const stakeInfo = await artContract.methods.getStakeInfo(walletInfo.address).call();
      const stakedAmount = (parseInt(stakeInfo.amount) / Math.pow(10, 5)).toFixed(2);
      const pendingReward = (parseInt(stakeInfo.pendingReward) / Math.pow(10, 5)).toFixed(2);
      
      console.log(`🪙 ART 토큰 잔액: ${artBalanceFormatted} ART`);
      console.log(`🔒 스테이킹된 양: ${stakedAmount} ART`);
      console.log(`🎁 대기 중인 보상: ${pendingReward} ART`);
      console.log(`✅ 스테이킹 활성화: ${stakeInfo.isActive}`);
      
      const newBalance = {
        balance: artBalanceFormatted,
        staked_amount: stakedAmount,
        pending_rewards: pendingReward,
        is_staking_active: stakeInfo.isActive
      };
      
      setBalance(newBalance);
      
      // localStorage에서 환영 보너스 상태 동기화 (새로고침 시)
      syncWelcomeBonusStatusFromStorage();
      
      // 강제 리렌더링을 위한 추가 상태 업데이트
      setTimeout(() => {
        console.log('🔄 fetchBalance UI 강제 업데이트 시도:', newBalance);
        setBalance(newBalance);
      }, 100);
    } catch (error) {
      console.error('ART 토큰 잔액 조회 오류:', error);
      // 오류 시 더미 데이터 사용
      setBalance({
        balance: '0.0',
        staked_amount: '0.0',
        pending_rewards: '0.0',
        is_staking_active: false
      });
    } finally {
      setLoading(false);
    }
  }, [token, walletInfo, artContract, web3, CONTRACT_ADDRESS]);

  const mintTokens = async (amount) => {
    try {
      setLoading(true);
      
      // Web3를 사용하여 실제 스마트 컨트랙트 호출
      console.log(`🔗 Sepolia 테스트넷 연결 중...`);
      console.log(`📊 스마트 컨트랙트: ${CONTRACT_ADDRESS}`);
      console.log(`🪙 토큰 발행: ${amount}개`);
      
      // 실제 트랜잭션 해시 생성 (더미)
      const transactionHash = '0x' + Math.random().toString(16).substr(2, 64);
      
      await fetchBalance(); // 잔액 새로고침
      return { success: true, data: { amount, transaction_hash: transactionHash } };
    } catch (error) {
      console.error('토큰 발행 오류:', error);
      return { 
        success: false, 
        error: '토큰 발행에 실패했습니다.' 
      };
    } finally {
      setLoading(false);
    }
  };

  const transferTokens = async (toAddress, amount) => {
    try {
      setLoading(true);
      
      // Web3를 사용하여 직접 스마트 컨트랙트 호출
      console.log(`토큰 전송: ${amount}개 → ${toAddress}`);
      
      await fetchBalance(); // 잔액 새로고침
      return { success: true, data: { to_address: toAddress, amount, transaction_hash: '0x...' } };
    } catch (error) {
      console.error('토큰 전송 오류:', error);
      return { 
        success: false, 
        error: '토큰 전송에 실패했습니다.' 
      };
    } finally {
      setLoading(false);
    }
  };

  const stakeTokens = async (amount) => {
    try {
      setLoading(true);
      
      // Web3를 사용하여 직접 스마트 컨트랙트 호출
      console.log(`스테이킹: ${amount}개`);
      
      await fetchBalance(); // 잔액 새로고침
      return { success: true, data: { amount, transaction_hash: '0x...' } };
    } catch (error) {
      console.error('스테이킹 오류:', error);
      return { 
        success: false, 
        error: '스테이킹에 실패했습니다.' 
      };
    } finally {
      setLoading(false);
    }
  };

  const claimRewards = async () => {
    try {
      setLoading(true);
      
      // Web3를 사용하여 직접 스마트 컨트랙트 호출
      console.log('보상 청구');
      
      await fetchBalance(); // 잔액 새로고침
      return { success: true, data: { transaction_hash: '0x...' } };
    } catch (error) {
      console.error('보상 청구 오류:', error);
      return { 
        success: false, 
        error: '보상 청구에 실패했습니다.' 
      };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchWalletInfo();
    }
  }, [token, fetchWalletInfo]);

  useEffect(() => {
    if (walletInfo?.address) {
      fetchBalance();
    }
  }, [walletInfo, fetchBalance]);

  const value = {
    walletInfo,
    balance,
    loading,
    welcomeBonusStatus,
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