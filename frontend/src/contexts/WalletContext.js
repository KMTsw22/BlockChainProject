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

  const setWelcomeBonusStatus = (newStatus) => {
    setWelcomeBonusStatusState(newStatus);
    localStorage.setItem('welcome_bonus_status', JSON.stringify(newStatus));
  };

  const saveWelcomeBonusStatusToStorage = (newStatus) => {
    localStorage.setItem('welcome_bonus_status', JSON.stringify(newStatus));
  };

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

  const SEPOLIA_RPC_URL = process.env.REACT_APP_WEB3_PROVIDER || null;
  const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || null;
  
  useEffect(() => {
    if (!CONTRACT_ADDRESS) {
      console.error('필수 환경변수가 설정되지 않았습니다: REACT_APP_CONTRACT_ADDRESS');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const web3 = useMemo(() => new Web3(SEPOLIA_RPC_URL), [SEPOLIA_RPC_URL]);
  
  // eslint-disable-next-line no-unused-vars
  const waitForTransactionCompletion = async (txHash, maxAttempts = 30) => {
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const receipt = await web3.eth.getTransactionReceipt(txHash);
        if (receipt && receipt.status) {
          return receipt;
        }
      } catch (error) {
        // 트랜잭션 대기 중
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
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
    
    if (!CONTRACT_ADDRESS) {
      throw new Error('CONTRACT_ADDRESS 환경변수가 설정되지 않았습니다.');
    }
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
        const seedHash = web3.utils.keccak256(seedString);
        
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
            const apiUrl = process.env.REACT_APP_API_URL || null;
            if (!apiUrl) {
              console.error('❌ API_URL 환경변수가 설정되지 않았습니다.');
              return;
            }
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
  // eslint-disable-next-line no-unused-vars
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
  }, [token, walletInfo, artContract, CONTRACT_ADDRESS]);

  const mintTokens = async (amount) => {
    if (!token) {
      return { 
        success: false, 
        error: '인증 토큰이 없습니다. 다시 로그인해주세요.' 
      };
    }

    try {
      setLoading(true);
      
      
      const apiUrl = process.env.REACT_APP_API_URL || null;
      if (!apiUrl) {
        setLoading(false);
        return { 
          success: false, 
          error: 'API_URL 환경변수가 설정되지 않았습니다.' 
        };
      }
      const response = await fetch(`${apiUrl}/wallet/mint`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: parseInt(amount)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '토큰 발행에 실패했습니다.');
      }

      const data = await response.json();
      
      // 잔액 새로고침
      await fetchBalance();
      
      return { 
        success: true, 
        data: {
          message: data.message,
          transaction_hash: data.transaction_hash,
          amount: amount
        }
      };
    } catch (error) {
      console.error('❌ 토큰 발행 오류:', error);
      return { 
        success: false, 
        error: error.message || '토큰 발행에 실패했습니다.' 
      };
    } finally {
      setLoading(false);
    }
  };

  const transferTokens = async (toAddress, amount) => {
    if (!token) {
      return { 
        success: false, 
        error: '인증 토큰이 없습니다. 다시 로그인해주세요.' 
      };
    }

    if (!walletInfo?.address || !walletInfo?.private_key) {
      return {
        success: false,
        error: '지갑 정보가 없습니다. 다시 로그인해주세요.'
      };
    }

    try {
      setLoading(true);
      
      if (!CONTRACT_ADDRESS) {
        return {
          success: false,
          error: '환경변수가 설정되지 않았습니다. .env 파일을 확인해주세요.'
        };
      }
      
      const checksumTo = web3.utils.toChecksumAddress(toAddress);
      const checksumFrom = web3.utils.toChecksumAddress(walletInfo.address);
      
      const tokenABI = [
        {
          "constant": false,
          "inputs": [
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint256"}
          ],
          "name": "transfer",
          "outputs": [{"name": "", "type": "bool"}],
          "type": "function"
        }
      ];
      
      const tokenContract = new web3.eth.Contract(tokenABI, CONTRACT_ADDRESS);
      const amountWei = parseInt(amount) * (10 ** 5);
      const userNonce = await web3.eth.getTransactionCount(checksumFrom);
      const transaction = tokenContract.methods.transfer(checksumTo, amountWei).encodeABI();
      const gasPrice = await web3.eth.getGasPrice();
      
      const tx = {
        from: checksumFrom,
        to: CONTRACT_ADDRESS,
        data: transaction,
        gas: 100000,
        gasPrice: gasPrice,
        nonce: userNonce
      };
      
      const account = web3.eth.accounts.privateKeyToAccount(walletInfo.private_key);
      const signedTx = await account.signTransaction(tx);
      
      let rawTxHex = signedTx?.rawTransaction || signedTx?.raw || signedTx?.rawTransaction?.raw || signedTx;
      
      if (!rawTxHex) {
        console.error('트랜잭션 서명 실패: rawTransaction을 찾을 수 없습니다.', signedTx);
        throw new Error('트랜잭션 서명 실패: rawTransaction을 찾을 수 없습니다.');
      }
      
      if (typeof rawTxHex !== 'string') {
        rawTxHex = '0x' + Array.from(rawTxHex)
          .map(byte => byte.toString(16).padStart(2, '0'))
          .join('');
      }
      
      if (!rawTxHex.startsWith('0x')) {
        rawTxHex = '0x' + rawTxHex;
      }
      const apiUrl = process.env.REACT_APP_API_URL || null;
      if (!apiUrl) {
        setLoading(false);
        return { 
          success: false, 
          error: 'API_URL 환경변수가 설정되지 않았습니다.' 
        };
      }
      
      const response = await fetch(`${apiUrl}/wallet/transfer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          signed_transaction: rawTxHex
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '토큰 전송에 실패했습니다.');
      }

      const data = await response.json();
      await fetchBalance();
      
      return { 
        success: true, 
        data: {
          message: data.message || '토큰 전송이 완료되었습니다.',
          transaction_hash: data.transaction_hash,
          to_address: toAddress,
          amount: amount
        }
      };
    } catch (error) {
      console.error('❌ 토큰 전송 오류:', error);
      return { 
        success: false, 
        error: error.message || '토큰 전송에 실패했습니다.' 
      };
    } finally {
      setLoading(false);
    }
  };

  const stakeTokens = async (amount) => {
    if (!token) {
      return { 
        success: false, 
        error: '인증 토큰이 없습니다. 다시 로그인해주세요.' 
      };
    }

    try {
      setLoading(true);
      
      
      const apiUrl = process.env.REACT_APP_API_URL || null;
      if (!apiUrl) {
        setLoading(false);
        return { 
          success: false, 
          error: 'API_URL 환경변수가 설정되지 않았습니다.' 
        };
      }
      const response = await fetch(`${apiUrl}/wallet/stake`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: parseInt(amount)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '스테이킹에 실패했습니다.');
      }

      const data = await response.json();
      
      // 잔액 새로고침
      await fetchBalance();
      
      return { 
        success: true, 
        data: {
          message: data.message,
          transaction_hash: data.transaction_hash,
          amount: amount
        }
      };
    } catch (error) {
      console.error('❌ 스테이킹 오류:', error);
      return { 
        success: false, 
        error: error.message || '스테이킹에 실패했습니다.' 
      };
    } finally {
      setLoading(false);
    }
  };

  const claimRewards = async () => {
    if (!token) {
      return { 
        success: false, 
        error: '인증 토큰이 없습니다. 다시 로그인해주세요.' 
      };
    }

    try {
      setLoading(true);
      
      
      const apiUrl = process.env.REACT_APP_API_URL || null;
      if (!apiUrl) {
        setLoading(false);
        return { 
          success: false, 
          error: 'API_URL 환경변수가 설정되지 않았습니다.' 
        };
      }
      const response = await fetch(`${apiUrl}/wallet/claim-rewards`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '보상 청구에 실패했습니다.');
      }

      const data = await response.json();
      
      // 잔액 새로고침
      await fetchBalance();
      
      return { 
        success: true, 
        data: {
          message: data.message,
          transaction_hash: data.transaction_hash
        }
      };
    } catch (error) {
      console.error('❌ 보상 청구 오류:', error);
      return { 
        success: false, 
        error: error.message || '보상 청구에 실패했습니다.' 
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