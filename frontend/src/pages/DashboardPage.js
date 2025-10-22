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
  AccountBalanceWallet as AccountBalanceWalletIcon,
  TrendingUp as TrendingUpIcon,
  Security as SecurityIcon,
  MonetizationOn as TokenIcon,
  Logout as LogoutIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { useNavigate } from 'react-router-dom';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const { balance, walletInfo, fetchBalance, loading, welcomeBonusStatus } = useWallet();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatBalance = (balance) => {
    // balance가 이미 포맷된 문자열이므로 그대로 반환
    return balance || '0.00';
  };

  // 새로고침 함수
  const handleRefresh = async () => {
    try {
      console.log('🔄 지갑 정보 새로고침 중...');
      await fetchBalance();
      console.log('✅ 지갑 정보 새로고침 완료');
    } catch (error) {
      console.error('❌ 새로고침 실패:', error);
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)',
      py: 4
    }}>
      <Container maxWidth="lg">
        <Box sx={{ 
          mb: 4, 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between', 
          alignItems: { xs: 'center', md: 'flex-start' },
          gap: 2
        }}>
          <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
            <Typography 
              variant="h4" 
              component="h1" 
              gutterBottom 
              sx={{ 
                color: 'white', 
                fontWeight: 'bold',
                fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
                wordBreak: 'break-word'
              }}
            >
              🎉 환영합니다, {user?.name}님!
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                color: 'rgba(255,255,255,0.8)',
                fontSize: { xs: '0.9rem', md: '1rem' }
              }}
            >
              블록체인 지갑에 오신 것을 환영합니다
            </Typography>
          </Box>
          
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: 2
          }}>
            <Button
              variant="contained"
              color="error"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              sx={{ 
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 'bold',
                minWidth: { xs: '140px', sm: '160px' },
                height: { xs: '44px', sm: '48px' },
                fontSize: { xs: '0.9rem', sm: '1rem' },
                px: 3,
                py: 1.5
              }}
            >
              로그아웃
            </Button>
          </Box>
        </Box>

      <Grid container spacing={3}>
        {/* 왼쪽 컬럼: 계정 정보 + 지갑 정보 */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* 계정 정보 카드 */}
            <Card sx={{ 
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(10px)',
              background: 'rgba(45,45,45,0.8)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <Box sx={{ 
                    p: 1.5, 
                    borderRadius: 2, 
                    background: 'linear-gradient(45deg, #667eea, #764ba2)',
                    mr: 2
                  }}>
                    <AccountBalanceWalletIcon sx={{ color: 'white' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'white' }}>
                    계정 정보
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ flex: 1, minWidth: 200, p: 2, borderRadius: 2, backgroundColor: '#2a2a2a', border: '1px solid #444' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      이메일
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#ffffff', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                      {user?.email || '로딩 중...'}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ flex: 1, minWidth: 200, p: 2, borderRadius: 2, backgroundColor: '#2a2a2a', border: '1px solid #444' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      소셜 계정
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <Chip 
                        label={`${user?.provider?.toUpperCase() || 'GOOGLE'} 계정`} 
                        color="primary" 
                        size="small"
                        sx={{ 
                          borderRadius: 2,
                          fontWeight: 'bold',
                          background: 'linear-gradient(45deg, #667eea, #764ba2)'
                        }}
                      />
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* 지갑 정보 카드 */}
            <Card sx={{ 
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(10px)',
              background: 'rgba(45,45,45,0.8)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <Box sx={{ 
                    p: 1.5, 
                    borderRadius: 2, 
                    background: 'linear-gradient(45deg, #667eea, #764ba2)',
                    mr: 2
                  }}>
                    <WalletIcon sx={{ color: 'white' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'white' }}>
                    지갑 정보
                  </Typography>
                </Box>
                
                <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 1, fontWeight: 'medium' }}>
                  지갑 주소
                </Typography>
                <Typography 
                  variant="body1" 
                  sx={{ 
                    fontFamily: 'monospace', 
                    backgroundColor: '#2a2a2a', 
                    padding: { xs: 1, md: 2 }, 
                    borderRadius: 2,
                    wordBreak: 'break-all',
                    color: '#ffffff',
                    border: '1px solid #444',
                    fontSize: { xs: '0.8rem', sm: '0.9rem' },
                    lineHeight: 1.4
                  }}
                >
                  {walletInfo?.address || '로딩 중...'}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Grid>

        {/* 오른쪽 컬럼: 토큰 잔액 */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            backdropFilter: 'blur(10px)',
            background: 'rgba(45,45,45,0.8)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ 
                    p: 1.5, 
                    borderRadius: 2, 
                    background: 'linear-gradient(45deg, #667eea, #764ba2)',
                    mr: 2
                  }}>
                    <TokenIcon sx={{ color: 'white' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'white' }}>
                    토큰 잔액
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {welcomeBonusStatus?.pending === true && welcomeBonusStatus?.message && (
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: '#4fc3f7', 
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                        backgroundColor: 'rgba(79, 195, 247, 0.1)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #4fc3f7'
                      }}
                    >
                      {welcomeBonusStatus.message}
                    </Typography>
                  )}
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={handleRefresh}
                    disabled={loading}
                    size="small"
                    sx={{
                      color: 'white',
                      borderColor: 'rgba(255,255,255,0.3)',
                      '&:hover': {
                        borderColor: 'rgba(255,255,255,0.5)',
                        backgroundColor: 'rgba(255,255,255,0.1)'
                      }
                    }}
                  >
                    새로고침
                  </Button>
                </Box>
              </Box>
              
              <Box sx={{ mb: 3, p: 2, borderRadius: 2, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                  보유 토큰
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {formatBalance(balance.balance)} ART
                </Typography>
              </Box>
              
              <Box sx={{ mb: 2, p: 2, borderRadius: 2, backgroundColor: '#2a2a2a', border: '1px solid #444' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  스테이킹된 토큰
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                  {formatBalance(balance.staked_amount)} ART
                </Typography>
              </Box>
              
              <Box sx={{ p: 2, borderRadius: 2, backgroundColor: '#d4edda', border: '1px solid #c3e6cb' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  대기 중인 보상
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#155724' }}>
                  {formatBalance(balance.pending_rewards)} ART
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>






        {/* 빠른 액션 카드 */}
        <Grid item xs={12}>
          <Card sx={{ 
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            backdropFilter: 'blur(10px)',
            background: 'rgba(45,45,45,0.8)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: '#333', mb: 3 }}>
                🚀 빠른 액션
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => navigate('/wallet')}
                    startIcon={<WalletIcon />}
                    sx={{ 
                      py: 2,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 'bold',
                      background: 'linear-gradient(45deg, #667eea, #764ba2)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #5a6fd8, #6a4190)'
                      }
                    }}
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
                    sx={{ 
                      py: 2,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 'bold'
                    }}
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
                    sx={{ 
                      py: 2,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 'bold'
                    }}
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
                    sx={{ 
                      py: 2,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 'bold'
                    }}
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
    </Box>
  );
};

export default DashboardPage;
