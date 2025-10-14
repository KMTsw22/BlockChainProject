import React from 'react';
import {
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Box,
  Chip
} from '@mui/material';
import {
  AccountBalanceWallet as WalletIcon,
  TrendingUp as TrendingUpIcon,
  Security as SecurityIcon,
  MonetizationOn as TokenIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { useNavigate } from 'react-router-dom';

const DashboardPage = () => {
  const { user } = useAuth();
  const { balance, walletInfo } = useWallet();
  const navigate = useNavigate();

  const formatBalance = (balance) => {
    return (parseFloat(balance) / Math.pow(10, 5)).toFixed(2);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          🎉 환영합니다, {user?.name}님!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {user?.provider?.toUpperCase()} 계정으로 연결된 지갑이 성공적으로 생성되었습니다.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* 지갑 정보 카드 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <WalletIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">지갑 정보</Typography>
              </Box>
              
              <Typography variant="body2" color="text.secondary" gutterBottom>
                지갑 주소
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  fontFamily: 'monospace', 
                  backgroundColor: '#f5f5f5', 
                  padding: 1, 
                  borderRadius: 1,
                  wordBreak: 'break-all'
                }}
              >
                {walletInfo?.wallet?.address || '로딩 중...'}
              </Typography>
              
              <Box sx={{ mt: 2 }}>
                <Chip 
                  label={`${user?.provider?.toUpperCase()} 계정`} 
                  color="primary" 
                  size="small" 
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 토큰 잔액 카드 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TokenIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">토큰 잔액</Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  보유 토큰
                </Typography>
                <Typography variant="h5" color="primary">
                  {formatBalance(balance.balance)} ART
                </Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  스테이킹된 토큰
                </Typography>
                <Typography variant="h6">
                  {formatBalance(balance.staked_amount)} ART
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="body2" color="text.secondary">
                  대기 중인 보상
                </Typography>
                <Typography variant="h6" color="success.main">
                  {formatBalance(balance.pending_rewards)} ART
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 빠른 액션 카드 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🚀 빠른 액션
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => navigate('/wallet')}
                    startIcon={<WalletIcon />}
                  >
                    지갑 관리
                  </Button>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    variant="outlined"
                    fullWidth
                    disabled
                    startIcon={<TrendingUpIcon />}
                  >
                    토큰 발행
                  </Button>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    variant="outlined"
                    fullWidth
                    disabled
                    startIcon={<SecurityIcon />}
                  >
                    스테이킹
                  </Button>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    variant="outlined"
                    fullWidth
                    disabled
                    startIcon={<TokenIcon />}
                  >
                    토큰 전송
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* 기능 소개 카드 */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, backgroundColor: '#f8f9fa' }}>
            <Typography variant="h6" gutterBottom>
              ✨ 주요 기능
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <WalletIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="subtitle1" gutterBottom>
                    자동 지갑 생성
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    소셜 계정으로 로그인하면 자동으로 지갑이 생성됩니다
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <SecurityIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="subtitle1" gutterBottom>
                    스마트 컨트랙트 연동
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    블록체인에서 안전하게 토큰을 관리합니다
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <TrendingUpIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="subtitle1" gutterBottom>
                    스테이킹 보상
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    토큰을 스테이킹하여 보상을 받을 수 있습니다
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default DashboardPage;
