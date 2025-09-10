// Login.jsx
import { useState } from 'react';
import { IoLockClosed, IoMail, IoPerson, IoEye, IoEyeOff, IoKey } from 'react-icons/io5';
import './Login.css';

function Login({ isOpen, onClose, onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [data, setData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // OTP / reset states
  const [otp, setOtp] = useState('');
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [tempUserData, setTempUserData] = useState(null);

  function handleChange(e) {
    setData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleOtpChange(e) {
    setOtp(e.target.value);
  }

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  const resendOtp = async () => {
    setError('');
    if (!tempUserData || !tempUserData.email) {
      setError('No email found to resend OTP to.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/users/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: tempUserData.email })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || 'Resend failed');
      alert('New OTP sent to your email.');
    } catch (err) {
      setError(err.message || 'Failed to resend OTP.');
      console.error('Resend OTP error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot password -> request OTP
  const handleForgotPassword = async () => {
    if (!data.email) {
      setError('Please enter your email address first');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/users/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to request reset OTP');
      }
      setTempUserData({ email: data.email });
      setShowOtpForm(true);
      setIsLogin(true);
      alert('Password reset OTP sent to your email. Enter OTP and new password below.');
    } catch (err) {
      setError(err.message || 'Failed to send password reset OTP. Please try again.');
      console.error('Forgot password error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!tempUserData || !tempUserData.email) {
      setError('No email found for password reset.');
      return false;
    }
    if (!otp) {
      setError('Please enter the OTP.');
      return false;
    }
    if (!data.password) {
      setError('Please enter a new password.');
      return false;
    }

    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:5000/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: tempUserData.email,
          otp,
          newPassword: data.password
        })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.message || 'Reset failed');
      }

      alert('Password reset successfully! Please login with your new password.');
      // Reset UI to login
      setIsLogin(true);
      setShowOtpForm(false);
      setTempUserData(null);
      setData({ username: '', email: '', password: '' });
      setOtp('');
      return true;
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try again.');
      console.error('Reset password error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Main submit that handles login/register/verify/ reset flows depending on state
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // LOGIN (normal)
      if (isLogin && !showOtpForm) {
        const response = await fetch('http://localhost:5000/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email, password: data.password })
        });
        const result = await response.json();
        if (response.ok) {
          localStorage.setItem('Ruser', result.user.username);
          localStorage.setItem('id',result.user.id)
          localStorage.setItem('token', result.token);
          onLoginSuccess({
            username: result.user.username,
            email: result.user.email,
            token: result.token
          });
          onClose && onClose();
        } else {
          setError(result.error || result.message || 'Login failed');
        }
      }
      // PASSWORD RESET (OTP form shown while isLogin === true)
      else if (isLogin && showOtpForm) {
        await handlePasswordReset();
      }
      // REGISTER step1 (request OTP)
      else if (!isLogin && !showOtpForm) {
        const response = await fetch('http://localhost:5000/api/users/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: data.username,
            email: data.email,
            password: data.password,
            action: 'request_otp'
          })
        });
        const result = await response.json();
        if (response.ok) {
          setTempUserData({ ...data });
          setShowOtpForm(true);
          alert('OTP sent to your email. Please check and enter it below.');
        } else {
          setError(result.error || result.message || 'Registration failed');
        }
      }
      // REGISTER step2 (verify OTP)
      else if (!isLogin && showOtpForm) {
        const response = await fetch('http://localhost:5000/api/users/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: tempUserData.email,
            otp
          })
        });
        const result = await response.json();
        if (response.ok) {
          alert('Registration successful! Please login.');
          setIsLogin(true);
          setShowOtpForm(false);
          setData({ username: '', email: '', password: '' });
          setOtp('');
        } else {
          setError(result.error || result.message || 'OTP verification failed');
        }
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Auth error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="auth-overlay">
      <div className="dl-aurora-bg">
        <div className="dl-aurora dl-aurora-1"></div>
        <div className="dl-aurora dl-aurora-2"></div>
        <div className="dl-aurora dl-aurora-3"></div>
      </div>

      <div className="auth-modal dl-card">
        {error && <div className="auth-error dl-error">{error}</div>}

        <div className="auth-form">
          <h2 className="dl-title">
            {isLogin ? 'LOGIN' : showOtpForm ? 'VERIFY OTP' : 'CREATE ACCOUNT'}
          </h2>
          <p className="auth-subtitle dl-subtitle">
            {isLogin ? (showOtpForm ? 'Enter OTP and new password' : 'Enter your credentials to continue')
              : showOtpForm ? 'Enter the OTP sent to your email' : 'Register to gain access to the system'}
          </p>

          <form onSubmit={handleSubmit}>
            {/* Username for signup */}
            {!isLogin && !showOtpForm && (
              <div className="auth-input-box dl-input">
                <span className="auth-icon dl-icon"><IoPerson /></span>
                <input
                  type="text"
                  name="username"
                  value={data.username}
                  onChange={handleChange}
                  placeholder="Username"
                  disabled={isLoading}
                  required
                />
                <div className="dl-underline"></div>
              </div>
            )}

            {/* Email */}
            {!(!isLogin && showOtpForm) && (
              <div className="auth-input-box dl-input">
                <span className="auth-icon dl-icon"><IoMail /></span>
                <input
                  type="email"
                  name="email"
                  value={data.email}
                  onChange={handleChange}
                  placeholder="Email address"
                  disabled={isLoading || showOtpForm}
                  required
                />
                <div className="dl-underline"></div>
              </div>
            )}

            {/* Password / new password */}
            {((!showOtpForm) || (isLogin && showOtpForm) || (!isLogin && !showOtpForm)) && (
              <div className="auth-input-box dl-input">
                <span className="auth-icon dl-icon"><IoLockClosed /></span>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={data.password}
                  onChange={handleChange}
                  placeholder={isLogin ? (showOtpForm ? "New password" : "Password") : "Create Password"}
                  disabled={isLoading}
                  required
                />
                <span className="password-toggle dl-toggle" onClick={togglePasswordVisibility}>
                  {showPassword ? <IoEyeOff /> : <IoEye />}
                </span>
                <div className="dl-underline"></div>
              </div>
            )}

            {/* OTP */}
            {showOtpForm && (
              <>
                <div className="auth-input-box dl-input">
                  <span className="auth-icon dl-icon"><IoKey /></span>
                  <input
                    type="text"
                    name="otp"
                    value={otp}
                    onChange={handleOtpChange}
                    placeholder="Enter OTP"
                    disabled={isLoading}
                    required
                    maxLength="6"
                  />
                  <div className="dl-underline"></div>
                </div>

                <div className="auth-otp-resend">
                  <button
                    type="button"
                    className="dl-link"
                    onClick={resendOtp}
                    disabled={isLoading}
                  >
                    Resend OTP
                  </button>
                </div>
              </>
            )}

            {/* Login options */}
            {isLogin && !showOtpForm && (
              <div className="auth-options">
                <label className="auth-remember dl-checkbox">
                  <input type="checkbox" disabled={isLoading} />
                  <span className="dl-checkmark"></span>
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  className="auth-forgot dl-link"
                  onClick={handleForgotPassword}
                  disabled={isLoading}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              className={`auth-btn dl-btn ${isLoading ? 'loading' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="auth-spinner dl-spinner"></span>
              ) : (
                <span className="dl-btn-text">
                  {isLogin
                    ? showOtpForm ? 'RESET PASSWORD' : 'LOGIN'
                    : showOtpForm ? 'VERIFY OTP' : 'REGISTER'
                  }
                  <span className="dl-btn-arrow">→</span>
                </span>
              )}
            </button>

            {!showOtpForm && (
              <div className="auth-switch">
                <p className="dl-switch-text">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}
                  <button
                    type="button"
                    className="auth-switch-btn dl-switch-btn"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setError('');
                      setShowOtpForm(false);
                      setTempUserData(null);
                      setData({ username: '', email: '', password: '' });
                      setOtp('');
                    }}
                    disabled={isLoading}
                  >
                    {isLogin ? 'SIGN UP' : 'SIGN IN'}
                  </button>
                </p>
              </div>
            )}

            {showOtpForm && (
              <div className="auth-back">
                <button
                  type="button"
                  className="dl-link"
                  onClick={() => {
                    setShowOtpForm(false);
                    setError('');
                    setTempUserData(null);
                    setOtp('');
                  }}
                  disabled={isLoading}
                >
                  ← Back to {isLogin ? 'login' : 'registration'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
