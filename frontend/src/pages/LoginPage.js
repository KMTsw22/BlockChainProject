import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Google as GoogleIcon, Lock as LockIcon } from '@mui/icons-material';
import Web3 from 'web3';

// 결정론적 지갑 생성 함수
const generateDeterministicWallet = (socialId, password) => {
  const web3 = new Web3();
  const seed = `${socialId}_${password}`;
  const account = web3.eth.accounts.create(seed);
  return account.address;
};

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordDialog, setPasswordDialog] = useState({
    open: false,
    social_id: '',
    isNewUser: false,
    mnemonic: '',
    showMnemonic: false
  });
  const [passwordError, setPasswordError] = useState('');

  // OAuth 콜백 처리
  const handleOAuthCallback = async (code) => {
    try {
      setLoading(true);
      setError('');
      console.log('🔵 OAuth code 받음, 백엔드로 전송 중...');
      
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const result = await fetch(`${apiUrl}/auth/google/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code })
      });

      if (!result.ok) {
        throw new Error('서버 인증 실패');
      }

      const data = await result.json();
      console.log('🔍 백엔드 응답:', data);

      // JWT 토큰 저장
      localStorage.setItem('token', data.access_token);
      
      // 신규/기존 사용자 판단
      const isNewUser = data.is_new_user === true;
      const socialId = String(data.user.id);

      // 비밀번호 다이얼로그 표시
      setPasswordDialog({
        open: true,
        social_id: socialId,
        isNewUser: isNewUser,
        mnemonic: '',
        showMnemonic: false
      });
      setLoading(false);
      
    } catch (error) {
      console.error('❌ OAuth 콜백 오류:', error);
      setError(error.message || 'Google 로그인 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  
  // URL에서 OAuth code 확인
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      console.log('🔵 OAuth code 발견:', code);
      // URL 정리
      window.history.replaceState({}, document.title, window.location.pathname);
      // 콜백 처리
      handleOAuthCallback(code);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGoogleLogin = () => {
    console.log('🔵 Google OAuth 로그인 시작');
    
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '642921295-hbu979qt4a2ndq1ucpf4j8v83kmfs8mk.apps.googleusercontent.com';
    const redirectUri = window.location.origin + '/login'; // /login으로 콜백
    const scope = 'openid email profile';
    const state = btoa(JSON.stringify({ timestamp: Date.now(), returnPath: window.location.pathname }));
    
    // OAuth 2.0 Authorization URL 생성
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${encodeURIComponent(state)}&` +
      `access_type=online&` +
      `prompt=select_account`;
    
    console.log('🔵 Redirect URI:', redirectUri);
    console.log('🔵 OAuth URL로 리다이렉트');
    
    // Google OAuth 페이지로 리다이렉트
    window.location.href = authUrl;
  };


  const handleKakaoLogin = async () => {
    setError('Kakao SDK 설정이 필요합니다.');
  };


  const handlePasswordDialogChange = (field) => (event) => {
    setPasswordDialog(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    
    // 비밀번호 입력 시 오류 메시지 초기화
    if (field === 'password') {
      setPasswordError('');
    }
  };

  const handlePasswordDialogSubmit = async () => {
    // 비밀번호 필수 검증
    if (!passwordDialog.password || passwordDialog.password.trim() === '') {
      setPasswordError('❌ 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');
    setPasswordError('');

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      
      // 디버깅: 전송할 데이터 확인
      console.log('🔍 전송할 데이터:', {
        social_id: passwordDialog.social_id,
        password: passwordDialog.password
      });
      console.log('🔍 passwordDialog 전체:', passwordDialog);
      
      // 지갑 주소 생성 (결정론적)
      const walletAddress = generateDeterministicWallet(passwordDialog.social_id, passwordDialog.password);
      console.log('🔍 생성된 지갑 주소:', walletAddress);
      
      // 비밀번호로 지갑 생성/복구
      const passwordResult = await fetch(`${apiUrl}/auth/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          social_id: passwordDialog.social_id,
          password: passwordDialog.password,  // 사용자가 입력한 비밀번호 사용
          wallet_address: walletAddress  // 생성된 지갑 주소 전송
        })
      });

      if (!passwordResult.ok) {
        const errorData = await passwordResult.json();
        
        // 비밀번호 오류인 경우 특별한 처리
        if (passwordResult.status === 401) {
          setPasswordError('❌ 비밀번호가 일치하지 않습니다. 올바른 비밀번호를 입력해주세요.');
        } else {
          setError(errorData.detail || '지갑 생성에 실패했습니다');
        }
        
        setLoading(false);
        return;
      }

      const passwordData = await passwordResult.json();
      
      // 백엔드에서 error 필드가 있는 경우 (비밀번호 오류)
      if (passwordData.error && passwordData.status_code === 401) {
        setPasswordError('❌ 비밀번호가 일치하지 않습니다. 올바른 비밀번호를 입력해주세요.');
        setLoading(false);
        return;
      }
      
      // 토큰과 사용자 정보 저장
      localStorage.setItem('access_token', passwordData.access_token);
      localStorage.setItem('user', JSON.stringify(passwordData.user));
      localStorage.setItem('user_password', passwordDialog.password); // 비밀번호 저장
      localStorage.setItem('is_existing_wallet', passwordData.is_existing_wallet); // 지갑 상태 저장
      
      console.log('✅ 로그인 성공! 토큰 저장 완료');
      console.log('🚀 대시보드로 이동 중...');
      
      // 다이얼로그 닫기
      setPasswordDialog({ open: false, social_id: '', isNewUser: false, mnemonic: '', showMnemonic: false });
      
      // 로딩 종료
      setLoading(false);
      
      // 페이지 새로고침으로 AuthContext 업데이트
      window.location.href = '/dashboard';
      
    } catch (error) {
      console.error('지갑 생성 오류:', error);
      setError(error.message || '지갑 생성 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const handlePasswordDialogClose = () => {
    setPasswordDialog({ open: false, social_id: '', isNewUser: false, mnemonic: '', showMnemonic: false });
    setError('');
    setPasswordError('');
  };

  const handleMnemonicConfirm = () => {
    // 시드 구문 확인 후 다이얼로그 닫기
    setPasswordDialog({ open: false, social_id: '', isNewUser: false, mnemonic: '', showMnemonic: false });
    window.location.href = '/dashboard';
  };


  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #2a2a2a 0%, #404040 100%)',
          padding: 2
        }}
      >
        <Paper
          elevation={10}
          sx={{
            padding: 4,
            borderRadius: 3,
            textAlign: 'center',
            width: '100%',
            maxWidth: 400
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom color="primary">
            🚀 소셜 지갑
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Google 로그인 후 비밀번호로 지갑을 연동하세요
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<GoogleIcon />}
              onClick={handleGoogleLogin}
              disabled={loading}
              sx={{
                backgroundColor: '#db4437',
                '&:hover': {
                  backgroundColor: '#c23321',
                },
                py: 1.5
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Google로 로그인'}
            </Button>

            <Button
              variant="contained"
              size="large"
              onClick={handleKakaoLogin}
              sx={{
                backgroundColor: '#fee500',
                color: '#3c1e1e',
                '&:hover': {
                  backgroundColor: '#fdd835',
                },
                py: 1.5
              }}
            >
              🟡 Kakao SDK 설정 필요
            </Button>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
            Google 로그인 후 비밀번호를 입력하면 지갑이 자동으로 연동됩니다
          </Typography>
        </Paper>
      </Box>

      {/* 비밀번호 입력 다이얼로그 */}
      <Dialog 
        open={passwordDialog.open} 
        onClose={handlePasswordDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LockIcon color={passwordError ? "error" : "primary"} />
            <Typography variant="h6" color={passwordError ? "error" : "inherit"}>
              {passwordError 
                ? '❌ 비밀번호가 틀렸습니다' 
                : passwordDialog.showMnemonic 
                  ? '시드 구문 백업' 
                  : passwordDialog.isNewUser 
                    ? '지갑 생성' 
                    : '지갑 로그인'
              }
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {passwordDialog.showMnemonic ? (
            // 시드 구문 표시
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                🔐 <strong>중요:</strong> 다음 12단어를 안전한 곳에 보관하세요. 이 단어들을 잃어버리면 지갑에 영원히 접근할 수 없습니다.
              </Typography>
              
              <TextField
                fullWidth
                label="시드 구문 (12단어)"
                value={passwordDialog.mnemonic}
                multiline
                rows={3}
                variant="outlined"
                margin="normal"
                InputProps={{
                  readOnly: true,
                  sx: { fontFamily: 'monospace', fontSize: '14px' }
                }}
                sx={{ mb: 2 }}
              />
              
              <Alert severity="warning" sx={{ mb: 2 }}>
                ⚠️ 이 시드 구문을 스크린샷으로 찍거나 디지털로 저장하지 마세요. 종이에 적어서 안전한 곳에 보관하세요.
              </Alert>
            </Box>
          ) : (
            // 비밀번호 입력 폼
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {passwordDialog.isNewUser 
                  ? "새로운 지갑을 생성합니다. 비밀번호를 설정해주세요."
                  : "기존 지갑에 로그인합니다. 비밀번호를 입력해주세요."}
              </Typography>
              
              <TextField
                fullWidth
                label="비밀번호"
                type="password"
                value={passwordDialog.password}
                onChange={handlePasswordDialogChange('password')}
                variant="outlined"
                margin="normal"
                placeholder={passwordDialog.isNewUser 
                  ? "새 지갑 비밀번호를 입력하세요" 
                  : "기존 지갑 비밀번호를 입력하세요"
                }
                helperText={passwordDialog.isNewUser 
                  ? "새 지갑의 비밀번호를 입력하세요" 
                  : "기존 지갑의 비밀번호를 입력하세요"
                }
                error={!!passwordError}
              />
              
              {/* 비밀번호 오류 메시지 */}
              {passwordError && (
                <Typography variant="body2" color="error" sx={{ mt: 1, mb: 2 }}>
                  {passwordError}
                </Typography>
              )}
              
              {passwordDialog.isNewUser && !passwordError && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  💡 비밀번호는 지갑 복구에 사용됩니다. 안전한 비밀번호를 설정하세요.
                </Alert>
              )}
              
              {passwordError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  ❌ 비밀번호가 틀렸습니다. 올바른 비밀번호를 입력해주세요.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {passwordDialog.showMnemonic ? (
            <Button 
              onClick={handleMnemonicConfirm}
              variant="contained"
              color="primary"
            >
              시드 구문을 안전하게 보관했습니다
            </Button>
          ) : (
            <>
              <Button onClick={handlePasswordDialogClose}>
                취소
              </Button>
              <Button 
                onClick={handlePasswordDialogSubmit}
                variant="contained"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <LockIcon />}
              >
                {loading 
                  ? (passwordDialog.isNewUser ? '지갑 생성 중...' : '로그인 중...') 
                  : (passwordDialog.isNewUser ? '지갑 생성' : '로그인')
                }
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default LoginPage;
