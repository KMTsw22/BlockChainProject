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
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Public as PublicIcon,
  Wallet as WalletIcon,
  Search as SearchIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';

const PublicWalletsPage = () => {
  const navigate = useNavigate();
  const { transferTokens, loading: walletLoading } = useWallet();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [wallets, setWallets] = useState([]);
  const [filteredWallets, setFilteredWallets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedAddress, setCopiedAddress] = useState('');
  
  // 송금 다이얼로그 관련 상태
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [sendAmount, setSendAmount] = useState('');

  // 공개 지갑 목록 불러오기
  const fetchPublicWallets = async () => {
    try {
      setLoading(true);
      setError('');

      const apiUrl = process.env.REACT_APP_API_URL || null;
      if (!apiUrl) {
        setError('API_URL 환경변수가 설정되지 않았습니다.');
        setLoading(false);
        return;
      }
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

  // 송금 다이얼로그 열기
  const handleOpenSendDialog = (wallet) => {
    setSelectedWallet(wallet);
    setSendDialogOpen(true);
    setSendAmount('');
    setError('');
    setSuccess('');
  };

  // 송금 다이얼로그 닫기
  const handleCloseSendDialog = () => {
    setSendDialogOpen(false);
    setSelectedWallet(null);
    setSendAmount('');
    setError('');
  };

  // 송금 처리
  const handleSendTokens = async () => {
    if (!selectedWallet || !sendAmount || sendAmount <= 0) {
      setError('올바른 금액을 입력해주세요.');
      return;
    }

    console.log('🎯 송금 다이얼로그에서 선택된 지갑:', selectedWallet);
    console.log('📥 받는 사람 주소:', selectedWallet.wallet_address);
    console.log('💰 송금량:', sendAmount);

    try {
      const result = await transferTokens(selectedWallet.wallet_address, parseInt(sendAmount));
      
      if (result.success) {
        setSuccess(`${selectedWallet.name}님에게 ${sendAmount} ART 토큰을 성공적으로 전송했습니다!`);
        handleCloseSendDialog();
        
        // 성공 메시지를 3초 후 자동 제거
        setTimeout(() => {
          setSuccess('');
        }, 3000);
      } else {
        setError(result.error || '토큰 전송에 실패했습니다.');
      }
    } catch (error) {
      console.error('송금 오류:', error);
      setError('토큰 전송 중 오류가 발생했습니다.');
    }
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
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
            {success}
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

                    {/* 송금 버튼 */}
                    <Box sx={{ mt: 2 }}>
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<SendIcon />}
                        onClick={() => handleOpenSendDialog(wallet)}
                        fullWidth
                      >
                        송금하기
                      </Button>
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

      {/* 송금 다이얼로그 */}
      <Dialog 
        open={sendDialogOpen} 
        onClose={handleCloseSendDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <SendIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">토큰 송금</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedWallet && (
            <Box sx={{ mt: 2 }}>
              {/* 받는 사람 정보 */}
              <Box sx={{ mb: 3, p: 2, backgroundColor: 'background.default', borderRadius: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  받는 사람
                </Typography>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {selectedWallet.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {selectedWallet.email}
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                    display: 'block',
                    backgroundColor: 'white',
                    color: '#000',
                    p: 1,
                    borderRadius: 0.5
                  }}
                >
                  {selectedWallet.wallet_address}
                </Typography>
              </Box>

              {/* 송금 금액 입력 */}
              <TextField
                fullWidth
                label="송금할 금액"
                type="number"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                placeholder="송금할 ART 토큰 수량을 입력하세요"
                InputProps={{
                  endAdornment: <InputAdornment position="end">ART</InputAdornment>
                }}
                helperText="송금할 토큰 수량을 입력해주세요"
                autoFocus
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={handleCloseSendDialog} disabled={walletLoading}>
            취소
          </Button>
          <Button 
            onClick={handleSendTokens}
            variant="contained"
            disabled={walletLoading || !sendAmount || sendAmount <= 0}
            startIcon={walletLoading ? <CircularProgress size={20} /> : <SendIcon />}
          >
            {walletLoading ? '전송 중...' : '송금하기'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PublicWalletsPage;

