import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress
} from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      
      // 구글 로그인 시뮬레이션 (실제로는 Google OAuth 사용)
      const mockGoogleData = {
        id: 'google_' + Math.random().toString(36).substr(2, 9),
        email: 'user@gmail.com',
        name: 'Google User',
        picture: 'https://via.placeholder.com/150'
      };
      
      const result = await login('google', mockGoogleData);
      
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('구글 로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleKakaoLogin = async () => {
    try {
      setLoading(true);
      setError('');
      
      // 카카오 로그인 시뮬레이션 (실제로는 Kakao SDK 사용)
      const mockKakaoData = {
        id: 'kakao_' + Math.random().toString(36).substr(2, 9),
        email: 'user@kakao.com',
        name: 'Kakao User',
        profile_image: 'https://via.placeholder.com/150'
      };
      
      const result = await login('kakao', mockKakaoData);
      
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('카카오 로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
            구글 또는 카카오 계정으로 로그인하면<br />
            자동으로 지갑이 생성됩니다!
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
              disabled={loading}
              sx={{
                backgroundColor: '#fee500',
                color: '#3c1e1e',
                '&:hover': {
                  backgroundColor: '#fdd835',
                },
                py: 1.5
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : '🟡 Kakao로 로그인'}
            </Button>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
            로그인하면 새로운 지갑이 자동으로 생성됩니다
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage;
