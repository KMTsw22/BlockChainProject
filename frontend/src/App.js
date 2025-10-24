import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WalletProvider } from './contexts/WalletContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import WalletPage from './pages/WalletPage';
import SettingsPage from './pages/SettingsPage';
import PublicWalletsPage from './pages/PublicWalletsPage';
import './App.css';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1', // 인디고 블루
    },
    secondary: {
      main: '#8b5cf6', // 보라색
    },
    background: {
      default: '#1a1a1a', // 어두운 회색
      paper: '#2a2a2a', // 중간 회색
    },
    text: {
      primary: '#f5f5f5', // 밝은 회색
      secondary: '#b0b0b0', // 중간 회색
    },
    card: {
      background: '#2a2a2a', // 카드 배경
    },
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#2a2a2a',
          border: '1px solid #404040',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#2a2a2a',
        },
      },
    },
  },
});

// AppContent 컴포넌트를 AuthProvider 내부에서 사용
const AppContent = () => {
  const { token, loading } = useAuth();

  if (loading) {
    return <div>로딩 중...</div>;
  }

  const isAuthenticated = !!token;

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/login" 
            element={
              isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              isAuthenticated ? <DashboardPage /> : <Navigate to="/login" />
            } 
          />
          <Route 
            path="/wallet" 
            element={
              isAuthenticated ? <WalletPage /> : <Navigate to="/login" />
            } 
          />
          <Route 
            path="/settings" 
            element={
              isAuthenticated ? <SettingsPage /> : <Navigate to="/login" />
            } 
          />
          <Route 
            path="/public-wallets" 
            element={<PublicWalletsPage />}
          />
          <Route 
            path="/" 
            element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} 
          />
        </Routes>
      </div>
    </Router>
  );
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <WalletProvider>
          <AppContent />
        </WalletProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
