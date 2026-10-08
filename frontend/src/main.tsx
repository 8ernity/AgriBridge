import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import { App } from './App';
import './index.css';
import './auth.css';

interface GlobalErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  GlobalErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): GlobalErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Global Error Boundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#0f1115',
          color: '#ffffff',
          fontFamily: 'sans-serif'
        }}>
          <div style={{
            maxWidth: 520,
            width: '100%',
            background: '#1c1e22',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '1rem',
            padding: '2rem',
            textAlign: 'center'
          }}>
            <h2 style={{ color: '#fbbf24', marginTop: 0 }}>Application Recovered</h2>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{
                background: '#9acd32',
                color: '#141f00',
                border: 'none',
                padding: '0.65rem 1.5rem',
                borderRadius: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: '#0f1115',
      color: '#ffffff',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        maxWidth: 520,
        width: '100%',
        background: '#1c1e22',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '1rem',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <h2 style={{ color: '#fbbf24', marginTop: 0 }}>Clerk Configuration Required</h2>
        <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
          The latest update integrated Clerk Authentication. Please add your Clerk Publishable Key in <code>frontend/.env</code>:
        </p>
        <pre style={{
          background: '#0b0d0e',
          padding: '0.85rem 1rem',
          borderRadius: '0.5rem',
          color: '#10b981',
          fontSize: '0.85rem',
          textAlign: 'left',
          overflowX: 'auto',
          marginBottom: '1.25rem'
        }}>
          VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
        </pre>
        <p style={{ color: '#6b7280', fontSize: '0.82rem' }}>
          You can get your Publishable Key from <a href="https://dashboard.clerk.com" target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>dashboard.clerk.com</a>.
        </p>
      </div>
    </div>
  );
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
          <App />
        </ClerkProvider>
      </GlobalErrorBoundary>
    </React.StrictMode>,
  );
}
