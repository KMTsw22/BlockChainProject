import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Public as PublicIcon,
  Wallet as WalletIcon,
  Search as SearchIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const PublicWalletsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wallets, setWallets] = useState([]);
  const [filteredWallets, setFilteredWallets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedAddress, setCopiedAddress] = useState('');

  // 공개 지갑 목록 불러오기
  const fetchPublicWallets = async () => {
    try {
      setLoading(true);
      setError('');

      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/public/wallets`);

      if (!response.ok) {
        throw new Error('공개 지갑 목록을 불러오는데 실패했습니다');
      }

      const data = await response.json();
      setWallets(data.wallets || []);
      setFilteredWallets(data.wallets || []);
      setLoading(false);
    } catch (error) {
      console.error('공개 지갑 목록 불러오기 오류:', error);
      setError(error.message || '공개 지갑 목록을 불러오는데 실패했습니다');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicWallets();
  }, []);

  // 검색 처리
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredWallets(wallets);
    } else {
      const filtered = wallets.filter(wallet => 
        wallet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        wallet.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        wallet.wallet_address.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredWallets(filtered);
    }
  }, [searchQuery, wallets]);

  // 주소 복사
  const handleCopyAddress = (address) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(''), 2000);
  };

  // 주소 축약
  const shortenAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        {/* 헤더 */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <PublicIcon sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
            <Box>
              <Typography variant="h4" component="h1">
                공개 지갑 게시판
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {filteredWallets.length}명의 사용자가 지갑 주소를 공개했습니다
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="새로고침">
              <IconButton onClick={fetchPublicWallets} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={() => navigate('/settings')}
            >
              설정
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* 검색 바 */}
        <TextField
          fullWidth
          variant="outlined"
          placeholder="이름, 이메일 또는 지갑 주소로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mb: 3 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />

        {/* 지갑 목록 */}
        {filteredWallets.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 5 }}>
            <WalletIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              {searchQuery ? '검색 결과가 없습니다' : '공개된 지갑이 없습니다'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {!searchQuery && '설정에서 지갑 주소를 공개해보세요!'}
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/settings')}
              sx={{ mt: 2 }}
            >
              설정으로 이동
            </Button>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {filteredWallets.map((wallet, index) => (
              <Grid item xs={12} md={6} key={index}>
                <Card 
                  elevation={2}
                  sx={{ 
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4
                    }
                  }}
                >
                  <CardContent>
                    {/* 사용자 정보 */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <WalletIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {wallet.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {wallet.email}
                        </Typography>
                      </Box>
                      <Chip 
                        label="공개" 
                        color="success" 
                        size="small"
                      />
                    </Box>

                    {/* 지갑 주소 */}
                    <Box 
                      sx={{ 
                        backgroundColor: 'background.default',
                        p: 2,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        지갑 주소
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Tooltip title={wallet.wallet_address}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontFamily: 'monospace',
                              fontSize: '0.85rem',
                              fontWeight: 500
                            }}
                          >
                            {shortenAddress(wallet.wallet_address)}
                          </Typography>
                        </Tooltip>
                        <Tooltip title={copiedAddress === wallet.wallet_address ? '복사됨!' : '주소 복사'}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopyAddress(wallet.wallet_address)}
                            color={copiedAddress === wallet.wallet_address ? 'success' : 'default'}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      
                      {/* 전체 주소 표시 */}
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        sx={{ 
                          display: 'block',
                          mt: 1,
                          wordBreak: 'break-all',
                          fontSize: '0.7rem'
                        }}
                      >
                        {wallet.wallet_address}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* 하단 버튼 */}
        <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/dashboard')}
            fullWidth
          >
            대시보드로 돌아가기
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default PublicWalletsPage;

