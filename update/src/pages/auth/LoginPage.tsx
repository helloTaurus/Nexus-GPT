import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LockKey,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  ArrowRight,
  ShieldCheck,
  ArrowLeft,
  CheckCircle,
  WarningCircle,
  Key,
} from '@phosphor-icons/react';
import { Button, Input, Card } from '../../components/ui';
import { api } from '../../lib/api';

export interface LoginPageProps {
  onNavigate: (view: string) => void;
  onLoginSuccess?: (role: string) => void;
}

type AuthViewMode = 'LOGIN' | 'RECOVER_REQUEST' | 'RECOVER_VERIFY';

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate, onLoginSuccess }) => {
  const [viewMode, setViewMode] = useState<AuthViewMode>('LOGIN');

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Self-service password recovery state
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleDemoFill = (demoRole: 'employee' | 'manager' | 'admin') => {
    setError('');
    setSuccessMsg('');
    if (demoRole === 'employee') {
      setEmail('employee@nexusfinance.ng');
      setPassword('EmployeePassword123!');
    } else if (demoRole === 'manager') {
      setEmail('manager@nexusfinance.ng');
      setPassword('ManagerPassword123!');
    } else {
      setEmail('admin@nexusfinance.ng');
      setPassword('AdminPassword123!');
    }
  };

  const openRecoveryFlow = () => {
    setError('');
    setSuccessMsg('');
    setRecoveryEmail(email.trim());
    setOtpToken('');
    setNewPassword('');
    setConfirmNewPassword('');
    setViewMode('RECOVER_REQUEST');
  };

  const returnToLogin = () => {
    setError('');
    setViewMode('LOGIN');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Please provide your corporate email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.auth.login(cleanEmail, password);
      const rawRole = res?.user?.role || 'EMPLOYEE';
      const uiRole = rawRole === 'ADMIN' ? 'Admin' : rawRole === 'MANAGER' ? 'Manager' : 'Employee';
      if (onLoginSuccess) onLoginSuccess(uiRole);

      if (rawRole === 'ADMIN' || rawRole === 'MANAGER') {
        onNavigate('/admin/dashboard');
      } else {
        onNavigate('/portal/dashboard');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to authenticate with Nexus Identity Service.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoverRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanEmail = recoveryEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your corporate Nexus email address.');
      return;
    }

    setIsLoading(true);
    try {
      await api.auth.recoverRequest(cleanEmail);
      setViewMode('RECOVER_VERIFY');
      setSuccessMsg('Verification OTP dispatched to your corporate inbox (sandbox OTP: 123456).');
    } catch (err: any) {
      setError(err?.message || 'Could not dispatch password reset verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoverVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanEmail = recoveryEmail.trim().toLowerCase();
    if (!otpToken.trim()) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Password confirmation does not match your new password.');
      return;
    }

    setIsLoading(true);
    try {
      await api.auth.recoverVerify(cleanEmail, otpToken.trim(), newPassword);
      setEmail(cleanEmail);
      setPassword('');
      setOtpToken('');
      setNewPassword('');
      setConfirmNewPassword('');
      setViewMode('LOGIN');
      setSuccessMsg('Password updated successfully. Sign in with your new password.');
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Check your OTP code and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-center items-center p-4 sm:p-6 font-sans relative">
      {/* Return to Public Site */}
      <div className="absolute top-6 left-6">
        <button
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-ink transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Nexus Finance</span>
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-[12px] bg-action text-on-action flex items-center justify-center font-bold font-display text-2xl mx-auto shadow-sm">
            {viewMode === 'LOGIN' ? 'N' : <Key className="w-6 h-6" weight="bold" />}
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-ink font-display">
            {viewMode === 'LOGIN'
              ? 'Nexus Unified Access'
              : viewMode === 'RECOVER_REQUEST'
              ? 'Reset Your Password'
              : 'Verify OTP & Reset Password'}
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            {viewMode === 'LOGIN'
              ? 'Secure self-service HRMS, expense approvals & administrative portal.'
              : viewMode === 'RECOVER_REQUEST'
              ? 'Enter your corporate email address to request a one-time reset code.'
              : `Enter the verification OTP sent to ${recoveryEmail || 'your corporate email'} and choose a new password.`}
          </p>
        </div>

        {/* Demo Fast-Switch Buttons (Login View Only) */}
        {viewMode === 'LOGIN' && (
          <div className="p-3.5 rounded-[12px] bg-subtle border border-rule space-y-2 text-xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted block">
              Quick-Fill Demo Credentials
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoFill('employee')}
                className="py-1.5 px-2 rounded-[7px] bg-surface hover:bg-accent-soft text-ink hover:text-brand font-semibold text-[11px] border border-rule transition-colors cursor-pointer text-center"
              >
                Staff Member
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('manager')}
                className="py-1.5 px-2 rounded-[7px] bg-surface hover:bg-accent-soft text-ink hover:text-brand font-semibold text-[11px] border border-rule transition-colors cursor-pointer text-center"
              >
                Lead Manager
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('admin')}
                className="py-1.5 px-2 rounded-[7px] bg-surface hover:bg-accent-soft text-ink hover:text-brand font-semibold text-[11px] border border-rule transition-colors cursor-pointer text-center"
              >
                Master Admin
              </button>
            </div>
          </div>
        )}

        {/* Form Card */}
        <Card variant="surface" padding="lg">
          <AnimatePresence mode="wait">
            {viewMode === 'LOGIN' && (
              <motion.form
                key="login-form"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                {successMsg && (
                  <div className="p-3 rounded-[7px] bg-[#E6F7F1] dark:bg-[#16382F] text-[#007B58] dark:text-[#69D3B0] text-xs font-medium border border-[#007B58]/25 flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" weight="fill" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-[7px] bg-danger-soft text-danger text-xs font-medium border border-danger/20 flex items-start gap-2">
                    <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" weight="fill" />
                    <span>{error}</span>
                  </div>
                )}

                <Input
                  label="Corporate Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. employee@nexusfinance.ng"
                  leftIcon={<EnvelopeSimple className="w-4 h-4" />}
                  required
                />

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={openRecoveryFlow}
                      className="text-[11px] text-brand font-semibold hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your corporate password"
                      className="w-full rounded-[7px] bg-subtle text-ink border border-rule hover:border-brand/40 px-3.5 py-2.5 text-sm pl-10 pr-10 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                      required
                    />
                    <LockKey className="w-4 h-4 absolute left-3 top-3 text-muted" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted hover:text-ink cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full mt-2"
                  isLoading={isLoading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Sign In to Nexus Portal
                </Button>
              </motion.form>
            )}

            {viewMode === 'RECOVER_REQUEST' && (
              <motion.form
                key="recover-request-form"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                onSubmit={handleRecoverRequest}
                className="space-y-4"
              >
                {error && (
                  <div className="p-3 rounded-[7px] bg-danger-soft text-danger text-xs font-medium border border-danger/20 flex items-start gap-2">
                    <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" weight="fill" />
                    <span>{error}</span>
                  </div>
                )}

                <Input
                  label="Corporate Email Address"
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="e.g. name@nexusfinance.ng"
                  leftIcon={<EnvelopeSimple className="w-4 h-4" />}
                  helperText="Works for both newly onboarded staff (default password TemporaryPass123!) and existing accounts."
                  required
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full mt-2"
                  isLoading={isLoading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Send Verification Code
                </Button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={returnToLogin}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </motion.form>
            )}

            {viewMode === 'RECOVER_VERIFY' && (
              <motion.form
                key="recover-verify-form"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                onSubmit={handleRecoverVerify}
                className="space-y-4"
              >
                {successMsg && (
                  <div className="p-3 rounded-[7px] bg-[#E6F7F1] dark:bg-[#16382F] text-[#007B58] dark:text-[#69D3B0] text-xs font-medium border border-[#007B58]/25 flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" weight="fill" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-[7px] bg-danger-soft text-danger text-xs font-medium border border-danger/20 flex items-start gap-2">
                    <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" weight="fill" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                      Verification OTP Code
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setViewMode('RECOVER_REQUEST');
                      }}
                      className="text-[11px] text-brand font-semibold hover:underline cursor-pointer"
                    >
                      Change email / Resend
                    </button>
                  </div>
                  <Input
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value)}
                    placeholder="Enter 6-digit OTP (e.g. 123456)"
                    className="font-mono-nums tracking-widest"
                    maxLength={12}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full rounded-[7px] bg-subtle text-ink border border-rule hover:border-brand/40 px-3.5 py-2.5 text-sm pl-10 pr-10 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                      minLength={8}
                      required
                    />
                    <LockKey className="w-4 h-4 absolute left-3 top-3 text-muted" />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-3 text-muted hover:text-ink cursor-pointer"
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      className="w-full rounded-[7px] bg-subtle text-ink border border-rule hover:border-brand/40 px-3.5 py-2.5 text-sm pl-10 pr-10 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                      minLength={8}
                      required
                    />
                    <LockKey className="w-4 h-4 absolute left-3 top-3 text-muted" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3 text-muted hover:text-ink cursor-pointer"
                      aria-label={showConfirmPassword ? 'Hide confirmation' : 'Show confirmation'}
                    >
                      {showConfirmPassword ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full mt-2"
                  isLoading={isLoading}
                  rightIcon={<CheckCircle className="w-4 h-4" />}
                >
                  Update Password &amp; Sign In
                </Button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={returnToLogin}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Cancel and Return to Sign In</span>
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="mt-6 pt-4 border-t border-rule text-center">
            <span className="text-xs text-muted">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => onNavigate('/auth/register')}
                className="text-brand font-semibold hover:underline cursor-pointer"
              >
                Register for Onboarding
              </button>
            </span>
          </div>
        </Card>

        {/* Security Assurance Footer */}
        <div className="text-center text-xs text-muted flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-brand" />
          <span>Protected with Scrypt cryptographic hashing &amp; HttpOnly sessions</span>
        </div>
      </motion.div>
    </div>
  );
};
