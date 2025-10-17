import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  TextField,
  Tabs,
  Tab,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Google as GoogleIcon, Lock as LockIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [passwordForm, setPasswordForm] = useState({
    social_id: '',
    password: ''
  });
  const [passwordDialog, setPasswordDialog] = useState({
    open: false,
    social_id: '',
    password: '',
    isNewUser: false
  });

  const handleGoogleCallback = useCallback(async (response) => {
    setLoading(true);
    setError('');
    
    try {
      // 서버로 ID 토큰 전송하여 사용자 정보 조회
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const result = await fetch(`${apiUrl}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: response.credential
        })
      });

      if (!result.ok) {
        throw new Error('서버 인증 실패');
      }

      const data = await result.json();
      
      // 신규 사용자인지 확인 (wallet 정보가 없으면 신규)
      const isNewUser = !data.wallet || !data.wallet.address;
      
      // 비밀번호 입력/설정 다이얼로그 표시
      setPasswordDialog({
        open: true,
        social_id: data.user.id.split('_')[1], // Google ID 추출
        password: '',
        isNewUser: isNewUser
      });
      setLoading(false);
      
    } catch (error) {
      console.error('Google 로그인 오류:', error);
      setError(error.message || 'Google 로그인 중 오류가 발생했습니다.');
      setLoading(false);
    }
  }, [login, navigate]);

  useEffect(() => {
    // Google Identity Services 초기화
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID || '642921295-hbu979qt4a2ndq1ucpf4j8v83kmfs8mk.apps.googleusercontent.com',
        callback: handleGoogleCallback
      });
    }
  }, [handleGoogleCallback]);

  const handleGoogleLogin = () => {
    if (!process.env.REACT_APP_GOOGLE_CLIENT_ID) {
      setError('Google OAuth 클라이언트 ID가 설정되지 않았습니다.');
      return;
    }
    
    if (window.google) {
      window.google.accounts.id.prompt();
    } else {
      setError('Google 서비스가 로드되지 않았습니다.');
    }
  };

  const handlePasswordLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const result = await fetch(`${apiUrl}/auth/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(passwordForm)
      });

      if (!result.ok) {
        const errorData = await result.json();
        throw new Error(errorData.detail || '비밀번호 로그인 실패');
      }

      const data = await result.json();
      
      // 토큰과 사용자 정보 저장
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('wallet', JSON.stringify(data.wallet));
      
      // AuthContext 상태 업데이트
      window.location.reload();
      
    } catch (error) {
      console.error('비밀번호 로그인 오류:', error);
      setError(error.message || '비밀번호 로그인 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const handleKakaoLogin = async () => {
    setError('Kakao SDK 설정이 필요합니다.');
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setError('');
  };

  const handlePasswordFormChange = (field) => (event) => {
    setPasswordForm(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handlePasswordDialogChange = (field) => (event) => {
    setPasswordDialog(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handlePasswordDialogSubmit = async () => {
    if (!passwordDialog.password) {
      setError('비밀번호를 입력해주세요');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      
      // 단일 API로 통합 (서버에서 스마트 컨트랙트 자동 확인)
      const passwordResult = await fetch(`${apiUrl}/auth/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          social_id: passwordDialog.social_id,
          password: passwordDialog.password
        })
      });

      if (!passwordResult.ok) {
        const errorData = await passwordResult.json();
        throw new Error(errorData.detail || '비밀번호 처리에 실패했습니다');
      }

      const passwordData = await passwordResult.json();
      
      // 토큰과 사용자 정보 저장
      localStorage.setItem('access_token', passwordData.access_token);
      localStorage.setItem('user', JSON.stringify(passwordData.user));
      localStorage.setItem('wallet', JSON.stringify(passwordData.wallet));
      
      // 계좌 상태 확인 (선택사항)
      if (passwordData.account_status === 'new') {
        console.log('🆕 새 계좌가 생성되었습니다');
      } else {
        console.log('✅ 기존 계좌에 로그인했습니다');
      }
      
      // 다이얼로그 닫기
      setPasswordDialog({ open: false, social_id: '', password: '', isNewUser: false });
      
      // AuthContext 상태 업데이트
      window.location.reload();
      
    } catch (error) {
      console.error('비밀번호 처리 오류:', error);
      setError(error.message || '비밀번호 처리 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const handlePasswordDialogClose = () => {
    setPasswordDialog({ open: false, social_id: '', password: '', isNewUser: false });
    setError('');
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
            <LockIcon color="primary" />
            <Typography variant="h6">
              {passwordDialog.isNewUser ? '비밀번호 설정' : '지갑 연동'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {passwordDialog.isNewUser 
              ? '지갑 보안을 위해 비밀번호를 설정해주세요. 이 비밀번호는 지갑 복구에 사용됩니다.'
              : '지갑을 연동하기 위해 비밀번호를 입력해주세요'
            }
          </Typography>
          
          <TextField
            fullWidth
            label="비밀번호"
            type="password"
            value={passwordDialog.password}
            onChange={handlePasswordDialogChange('password')}
            placeholder={passwordDialog.isNewUser 
              ? "새 비밀번호를 입력하세요" 
              : "설정한 비밀번호를 입력하세요"
            }
            variant="outlined"
            margin="normal"
            autoFocus
          />
          
          {passwordDialog.isNewUser && (
            <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
              ⚠️ 비밀번호를 잊어버리면 지갑에 접근할 수 없습니다. 안전한 곳에 보관하세요.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePasswordDialogClose}>
            취소
          </Button>
          <Button 
            onClick={handlePasswordDialogSubmit}
            variant="contained"
            disabled={loading || !passwordDialog.password}
            startIcon={loading ? <CircularProgress size={20} /> : <LockIcon />}
          >
            {loading 
              ? (passwordDialog.isNewUser ? '설정 중...' : '연동 중...') 
              : (passwordDialog.isNewUser ? '비밀번호 설정' : '지갑 연동')
            }
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default LoginPage;
