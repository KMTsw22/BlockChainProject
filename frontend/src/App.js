import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';
import { WalletProvider } from './contexts/WalletContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import WalletPage from './pages/WalletPage';
import './App.css';

const theme = createTheme({
  palette: {
    primary: {
      main: '#667eea',
    },
    secondary: {
      main: '#764ba2',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  },
});

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 토큰 확인
    const token = localStorage.getItem('access_token');
    if (token) {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return <div>로딩 중...</div>;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <WalletProvider>
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
                  path="/" 
                  element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} 
                />
              </Routes>
            </div>
          </Router>
        </WalletProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
