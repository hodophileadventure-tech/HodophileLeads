import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import App from './pages/App';
import LoginPage from './pages/LoginPage';
import { useAuth } from './context/AuthContext';
import './index.css';

function Root() {
  const [mounted, setMounted] = React.useState(false);
  const { isAuthenticated } = useAuth();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Route based on authenticated user from context to avoid token-only loops
  return isAuthenticated ? <App /> : <LoginPage />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </React.StrictMode>,
);
