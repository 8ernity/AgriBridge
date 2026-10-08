import React, { useState } from 'react';
import { SignIn, SignUp } from '@clerk/react';
import { dark } from '@clerk/themes';

interface LoginPageProps {
  onGuestDemoLogin?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onGuestDemoLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const togglePanel = (toSignUp: boolean) => {
    setResetKey(prev => prev + 1);
    setIsSignUp(toSignUp);
  };

  return (
    <div className="auth-page-bg">
      <div className={`auth-wrapper ${isSignUp ? 'right-panel-active' : ''}`}>
        <div className={`auth-container ${isSignUp ? 'right-panel-active' : ''}`}>

          {/* Sign Up Form Panel (Left in DOM, animated in CSS) */}
          <div className="auth-form-container sign-up-container">
            <div className="auth-heading-box">
              <p className="auth-brand-script">
                Join the future of agricultural intelligence — smarter & greener.
              </p>
            </div>

            <div className="auth-clerk-scroll">
              {isSignUp && (
                <SignUp
                  key={`signup-${resetKey}`}
                  appearance={{
                    theme: dark,
                    elements: {
                      rootBox: "w-full flex justify-center",
                      card: "shadow-none border-0 m-0 w-full max-w-full bg-transparent",
                      footerAction: "hidden"
                    }
                  }}
                  routing="hash"
                />
              )}
            </div>

            {/* Mobile toggle link */}
            <div className="auth-mobile-toggle">
              <button
                type="button"
                onClick={() => togglePanel(false)}
                className="auth-toggle-link"
              >
                Already have an account? <span className="highlight-action">Sign In</span>
              </button>
            </div>
          </div>

          {/* Sign In Form Panel */}
          <div className="auth-form-container sign-in-container">
            <div className="auth-heading-box">
              <p className="auth-brand-script">
                Welcome back to smarter<br />crop intelligence.
              </p>
            </div>

            <div className="auth-clerk-scroll">
              {!isSignUp && (
                <SignIn
                  key={`signin-${resetKey}`}
                  appearance={{
                    theme: dark,
                    elements: {
                      rootBox: "w-full flex justify-center",
                      card: "shadow-none border-0 m-0 w-full max-w-full bg-transparent",
                      footerAction: "hidden"
                    }
                  }}
                  routing="hash"
                />
              )}

              {/* 1-Click Guest & Judge Demo button */}
              <div className="auth-demo-btn-wrap">
                <button
                  type="button"
                  onClick={onGuestDemoLogin}
                  className="auth-judge-demo-btn"
                >
                  <span>⚡ 1-CLICK GUEST & JUDGE DEMO</span>
                </button>
              </div>
            </div>

            {/* Mobile toggle link */}
            <div className="auth-mobile-toggle">
              <button
                type="button"
                onClick={() => togglePanel(true)}
                className="auth-toggle-link"
              >
                Don&apos;t have an account? <span className="highlight-action">Sign Up</span>
              </button>
            </div>
          </div>

          {/* Sliding Curved Overlay Container (Desktop) */}
          <div className="auth-overlay-container">
            <div className="auth-overlay">

              {/* Left Overlay (Revealed when Sign Up is active) */}
              <div className="auth-overlay-panel auth-overlay-left">
                <h2>Ready to Cultivate?</h2>
                <p>
                  Access field GPS polygons, real-time satellite vegetation metrics, plant pathology scanners, and localized advisory from one unified platform.
                </p>
                <button
                  type="button"
                  onClick={() => togglePanel(false)}
                  aria-label="Switch to sign in"
                >
                  Sign In
                </button>
              </div>

              {/* Right Overlay (Revealed when Sign In is active) */}
              <div className="auth-overlay-panel auth-overlay-right">
                <h2>New Here?</h2>
                <p>
                  Create an account to access precision crop analytics, AI leaf diagnostics, soil carbon tracking, and localized advisory.
                </p>
                <button
                  type="button"
                  onClick={() => togglePanel(true)}
                  aria-label="Switch to sign up"
                >
                  Sign Up
                </button>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
