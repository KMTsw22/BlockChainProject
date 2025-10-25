import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Button,
  Snackbar
} from '@mui/material';
import { Settings as SettingsIcon, Wallet as WalletIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const SettingsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showWalletPublic, setShowWalletPublic] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // 사용자 설정 불러오기
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiUrl}/user/settings`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('설정을 불러오는데 실패했습니다');
        }

        const data = await response.json();
        setShowWalletPublic(data.show_wallet_public || false);
        setWalletAddress(data.wallet_address || '주소 없음');
        setUserName(data.name || '');
        setUserEmail(data.email || '');
        setLoading(false);
      } catch (error) {
        console.error('설정 불러오기 오류:', error);
        setError(error.message || '설정을 불러오는데 실패했습니다');
        setLoading(false);
      }
    };

    fetchSettings();
  }, [navigate]);

  // 설정 변경 처리
  const handleToggleWalletPublic = async (event) => {
    const newValue = event.target.checked;
    
    try {
      setSaving(true);
      setError('');

      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';

      const response = await fetch(`${apiUrl}/user/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          show_wallet_public: newValue
        })
      });

      if (!response.ok) {
        throw new Error('설정 저장에 실패했습니다');
      }

      const data = await response.json();
      setShowWalletPublic(newValue);
      setSnackbarMessage(newValue ? '지갑 주소가 공개됩니다' : '지갑 주소가 비공개됩니다');
      setSnackbarOpen(true);
      setSaving(false);
    } catch (error) {
      console.error('설정 저장 오류:', error);
      setError(error.message || '설정 저장에 실패했습니다');
      setSaving(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <SettingsIcon sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            계정 설정
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* 사용자 정보 카드 */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <WalletIcon sx={{ mr: 1 }} />
              내 정보
            </Typography>
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                이름
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {userName}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                이메일
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {userEmail}
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary">
                지갑 주소
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  fontFamily: 'monospace', 
                  fontSize: '0.9rem',
                  wordBreak: 'break-all'
                }}
              >
                {walletAddress}
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* 공개 설정 카드 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <VisibilityIcon sx={{ mr: 1 }} />
              공개 설정
            </Typography>
            <Divider sx={{ my: 2 }} />

            <FormControlLabel
              control={
                <Switch
                  checked={showWalletPublic}
                  onChange={handleToggleWalletPublic}
                  disabled={saving}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    지갑 주소 공개
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    공개 게시판에 내 지갑 주소를 표시합니다
                  </Typography>
                </Box>
              }
            />

            {saving && (
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  저장 중...
                </Typography>
              </Box>
            )}

            {showWalletPublic && (
              <Alert severity="info" sx={{ mt: 2 }}>
                💡 지갑 주소가 공개되면 다른 사용자들이 게시판에서 볼 수 있습니다.
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* 하단 버튼 */}
        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/dashboard')}
            fullWidth
          >
            대시보드로 돌아가기
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate('/public-wallets')}
            fullWidth
          >
            공개 지갑 게시판 보기
          </Button>
        </Box>
      </Paper>

      {/* 스낵바 알림 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
};

export default SettingsPage;


