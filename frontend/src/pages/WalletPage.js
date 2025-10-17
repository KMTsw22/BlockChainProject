import React, { useState } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Box,
  TextField,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress
} from '@mui/material';
import {
  AccountBalanceWallet as WalletIcon,
  Send as SendIcon,
  TrendingUp as TrendingUpIcon,
  MonetizationOn as TokenIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useWallet } from '../contexts/WalletContext';

const WalletPage = () => {
  const { 
    balance, 
    walletInfo, 
    loading, 
    fetchBalance, 
    mintTokens, 
    transferTokens, 
    stakeTokens, 
    claimRewards 
  } = useWallet();
  const [mintAmount, setMintAmount] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [stakeAmount, setStakeAmount] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');

  const formatBalance = (balance) => {
    return (parseFloat(balance) / Math.pow(10, 5)).toFixed(2);
  };

  const showMessage = (msg, type = 'info') => {
    setMessage(msg);
    setMessageType(type);
  };

  const handleMint = async () => {
    if (!mintAmount || mintAmount <= 0) {
      showMessage('올바른 수량을 입력해주세요.', 'error');
      return;
    }

    const result = await mintTokens(parseInt(mintAmount));
    if (result.success) {
      showMessage(result.data.message, 'success');
      setMintAmount('');
    } else {
      showMessage(result.error, 'error');
    }
  };

  const handleTransfer = async () => {
    if (!transferTo || !transferAmount || transferAmount <= 0) {
      showMessage('올바른 정보를 입력해주세요.', 'error');
      return;
    }

    const result = await transferTokens(transferTo, parseInt(transferAmount));
    if (result.success) {
      showMessage(result.data.message, 'success');
      setTransferTo('');
      setTransferAmount('');
    } else {
      showMessage(result.error, 'error');
    }
  };

  const handleStake = async () => {
    if (!stakeAmount || stakeAmount < 1000) {
      showMessage('최소 1000 토큰 이상 스테이킹해야 합니다.', 'error');
      return;
    }

    const result = await stakeTokens(parseInt(stakeAmount));
    if (result.success) {
      showMessage(result.data.message, 'success');
      setStakeAmount('');
    } else {
      showMessage(result.error, 'error');
    }
  };

  const handleClaimRewards = async () => {
    const result = await claimRewards();
    if (result.success) {
      showMessage(result.data.message, 'success');
    } else {
      showMessage(result.error, 'error');
    }
  };

  const openDialog = (type) => {
    setDialogType(type);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setMintAmount('');
    setTransferTo('');
    setTransferAmount('');
    setStakeAmount('');
  };

  const renderDialogContent = () => {
    switch (dialogType) {
      case 'mint':
        return (
          <Box>
            <TextField
              fullWidth
              label="발행할 토큰 수량"
              type="number"
              value={mintAmount}
              onChange={(e) => setMintAmount(e.target.value)}
              margin="normal"
            />
          </Box>
        );
      case 'transfer':
        return (
          <Box>
            <TextField
              fullWidth
              label="받는 주소"
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              margin="normal"
            />
            <TextField
              fullWidth
              label="전송할 토큰 수량"
              type="number"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              margin="normal"
            />
          </Box>
        );
      case 'stake':
        return (
          <Box>
            <TextField
              fullWidth
              label="스테이킹할 토큰 수량"
              type="number"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              margin="normal"
              helperText="최소 1000 토큰 이상"
            />
          </Box>
        );
      default:
        return null;
    }
  };

  const handleDialogAction = () => {
    switch (dialogType) {
      case 'mint':
        handleMint();
        break;
      case 'transfer':
        handleTransfer();
        break;
      case 'stake':
        handleStake();
        break;
      default:
        break;
    }
    closeDialog();
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          💰 지갑 관리
        </Typography>
        <Typography variant="body1" color="text.secondary">
          토큰을 발행, 전송, 스테이킹하고 보상을 받아보세요.
        </Typography>
      </Box>

      {message && (
        <Alert 
          severity={messageType} 
          sx={{ mb: 2 }}
          onClose={() => setMessage('')}
        >
          {message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* 지갑 정보 */}
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
                  color: '#000000',
                  padding: 1, 
                  borderRadius: 1,
                  wordBreak: 'break-all',
                  mb: 2
                }}
              >
                {walletInfo?.wallet?.address || '로딩 중...'}
              </Typography>
              
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchBalance}
                disabled={loading}
                fullWidth
              >
                잔액 새로고침
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* 토큰 잔액 */}
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

        {/* 토큰 액션 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🚀 토큰 액션
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => openDialog('mint')}
                    startIcon={<TokenIcon />}
                    disabled={loading}
                  >
                    토큰 발행
                  </Button>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => openDialog('transfer')}
                    startIcon={<SendIcon />}
                    disabled={loading}
                  >
                    토큰 전송
                  </Button>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => openDialog('stake')}
                    startIcon={<TrendingUpIcon />}
                    disabled={loading}
                  >
                    스테이킹
                  </Button>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleClaimRewards}
                    startIcon={<TokenIcon />}
                    disabled={loading}
                    color="success"
                  >
                    보상 청구
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 다이얼로그 */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogType === 'mint' && '토큰 발행'}
          {dialogType === 'transfer' && '토큰 전송'}
          {dialogType === 'stake' && '토큰 스테이킹'}
        </DialogTitle>
        <DialogContent>
          {renderDialogContent()}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>취소</Button>
          <Button 
            onClick={handleDialogAction} 
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : '확인'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default WalletPage;
