import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  IdentificationCard,
  Bank,
  Phone,
  EnvelopeSimple,
  ShieldCheck,
  CheckCircle,
  WarningCircle,
  MapPin,
  Lock,
  LockKey,
  Eye,
  EyeSlash,
} from '@phosphor-icons/react';
import { PortalLayout } from '../../components/layout/PortalLayout';
import { Button, Card, Input, Skeleton } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import type { EmployeeProfile } from '../../lib/leaveTypes';

export interface StaffProfilePageProps {
  currentPath?: string;
  onNavigate: (path: string) => void;
}

export const StaffProfilePage: React.FC<StaffProfilePageProps> = ({
  currentPath = '/portal/profile',
  onNavigate,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);

  // Raw server profile
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);

  // Editable Form State
  const [formData, setFormData] = useState({
    phone: '',
    residentialAddress: '',
    bankName: '',
    bankAccountNumber: '',
    bankAccountName: '',
    bvn: '',
    nin: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
  });

  // Inline Field Validation Errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordCorrelationId, setPasswordCorrelationId] = useState<string | null>(null);

  // Fetch profile on mount
  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setErrorMessage(null);

    api.profile
      .get()
      .then((data) => {
        if (!isCurrent) return;
        setProfile(data);
        setFormData({
          phone: data.phone || '',
          residentialAddress: data.residentialAddress || '',
          bankName: data.bankName || '',
          bankAccountNumber: data.bankAccountNumber || '',
          bankAccountName: data.bankAccountName || '',
          bvn: data.bvn || '',
          nin: data.nin || '',
          emergencyContactName: data.emergencyContactName || '',
          emergencyContactPhone: data.emergencyContactPhone || '',
          emergencyContactRelationship: data.emergencyContactRelationship || '',
        });
      })
      .catch((err: any) => {
        if (!isCurrent) return;
        if (err.status === 401) {
          onNavigate('/auth/login');
          return;
        }
        setErrorMessage(err.message || 'Failed to retrieve employee profile docket.');
        if (err.correlationId) setCorrelationId(err.correlationId);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [onNavigate]);

  const handleNubanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only accept numeric digits, capped at 10 digits
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    setFormData((prev) => ({ ...prev, bankAccountNumber: digitsOnly }));
    
    if (digitsOnly.length > 0 && digitsOnly.length < 10) {
      setFieldErrors((prev) => ({
        ...prev,
        bankAccountNumber: `Nigerian NUBAN account number must be exactly 10 digits (${digitsOnly.length}/10 entered)`,
      }));
    } else {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.bankAccountNumber;
        return next;
      });
    }
  };

  const handleBvnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 11);
    setFormData((prev) => ({ ...prev, bvn: digitsOnly }));
    if (digitsOnly.length > 0 && digitsOnly.length < 11) {
      setFieldErrors((prev) => ({
        ...prev,
        bvn: `BVN must be exactly 11 digits (${digitsOnly.length}/11 entered)`,
      }));
    } else {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.bvn;
        return next;
      });
    }
  };

  const handleNinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 11);
    setFormData((prev) => ({ ...prev, nin: digitsOnly }));
    if (digitsOnly.length > 0 && digitsOnly.length < 11) {
      setFieldErrors((prev) => ({
        ...prev,
        nin: `NIN must be exactly 11 digits (${digitsOnly.length}/11 entered)`,
      }));
    } else {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.nin;
        return next;
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setCorrelationId(null);

    // Validate NUBAN format
    const errors: Record<string, string> = {};
    if (formData.bankAccountNumber && !/^\d{10}$/.test(formData.bankAccountNumber)) {
      errors.bankAccountNumber = 'Nigerian NUBAN account number must be exactly 10 digits';
    }
    if (formData.bvn && !/^\d{11}$/.test(formData.bvn)) {
      errors.bvn = 'BVN must be exactly 11 digits';
    }
    if (formData.nin && !/^\d{11}$/.test(formData.nin)) {
      errors.nin = 'NIN must be exactly 11 digits';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      // Clean payload: strictly send ONLY editable fields (preventing 403 FORBIDDEN on restricted fields)
      const payload = {
        phone: formData.phone.trim(),
        residentialAddress: formData.residentialAddress.trim(),
        bankName: formData.bankName.trim(),
        bankAccountNumber: formData.bankAccountNumber.trim(),
        bankAccountName: formData.bankAccountName.trim(),
        ...(formData.bvn ? { bvn: formData.bvn.trim() } : {}),
        ...(formData.nin ? { nin: formData.nin.trim() } : {}),
        emergencyContactName: formData.emergencyContactName.trim(),
        emergencyContactPhone: formData.emergencyContactPhone.trim(),
        emergencyContactRelationship: formData.emergencyContactRelationship.trim(),
      };

      const updated = await api.profile.update(payload);
      setProfile(updated);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 4000);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
        if (err.correlationId) setCorrelationId(err.correlationId);
        if (err.code === 'INVALID_NUBAN') {
          setFieldErrors((prev) => ({
            ...prev,
            bankAccountNumber: err.message,
          }));
        }
      } else {
        setErrorMessage(err.message || 'An unexpected error occurred while saving profile.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);
    setPasswordCorrelationId(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Password confirmation does not match your new password.');
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError('New password must differ from your current password.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordSuccess(
        'Your portal password has been updated cleanly. Any other active sessions have been signed out for security.'
      );
      setTimeout(() => setPasswordSuccess(null), 6000);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setPasswordError(err.message);
        if (err.correlationId) setPasswordCorrelationId(err.correlationId);
      } else {
        setPasswordError(err?.message || 'Unable to update password at this time.');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const fullName = profile
    ? `${profile.firstName} ${profile.lastName}`
    : 'David Alabi';
  const staffId = profile?.staffId || 'NX-EMP-0142';

  return (
    <PortalLayout
      currentPath={currentPath}
      onNavigate={onNavigate}
      userRole={profile?.designation || undefined}
      userName={fullName}
      staffId={staffId}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-ink font-display">
            Staff Profile &amp; KYC Registry
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            Manage your employee contact information, emergency contacts, and Nigerian NUBAN banking details.
          </p>
        </div>
      </div>

      {/* Success Notification Banner */}
      <AnimatePresence>
        {isSaved && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 rounded-[7px] bg-[#E6F7F1] dark:bg-[#16382F] text-[#007B58] dark:text-[#69D3B0] border border-[#007B58]/30 text-xs font-semibold flex items-center gap-2.5 shadow-sm"
          >
            <CheckCircle className="w-5 h-5 shrink-0" weight="fill" />
            <span>
              Staff profile and Nigerian banking KYC details successfully updated and logged in the immutable audit registry.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Notification Banner */}
      {errorMessage && (
        <div className="p-4 rounded-[7px] bg-[#FFEDEF] dark:bg-[#40262E] text-[#B52F38] dark:text-[#FFACA9] border border-[#B52F38]/20 text-xs font-medium flex items-start gap-2.5 shadow-sm">
          <WarningCircle className="w-5 h-5 shrink-0 mt-0.5 text-danger" weight="fill" />
          <div className="space-y-1">
            <span className="font-semibold block">{errorMessage}</span>
            {correlationId && (
              <span className="block text-[11px] font-mono-nums opacity-80">
                Correlation ID: {correlationId}
              </span>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-6">
          <Card variant="surface" padding="md">
            <Skeleton height={24} width="220px" className="mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Skeleton height={56} />
              <Skeleton height={56} />
              <Skeleton height={56} />
              <Skeleton height={56} />
              <Skeleton height={56} />
              <Skeleton height={56} />
            </div>
          </Card>
          <Card variant="surface" padding="md">
            <Skeleton height={24} width="220px" className="mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton height={44} />
              <Skeleton height={44} />
              <Skeleton height={44} />
              <Skeleton height={44} />
            </div>
          </Card>
          <Card variant="surface" padding="md">
            <Skeleton height={24} width="220px" className="mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Skeleton height={44} />
              <Skeleton height={44} />
              <Skeleton height={44} />
            </div>
          </Card>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: Employment Details (Read-only) */}
          <Card variant="surface" padding="md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <IdentificationCard className="w-5 h-5 text-brand" />
                <h3 className="text-base font-semibold text-ink font-display">
                  Official Employment Credentials
                </h3>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-subtle text-muted border border-rule flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>Read-Only Official Record</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-sans">
              <div className="p-3.5 rounded-[7px] bg-subtle border border-rule">
                <span className="text-muted block text-[10px] uppercase font-semibold">Staff Identity</span>
                <span className="font-bold text-ink font-mono-nums">{profile?.staffId}</span>
              </div>
              <div className="p-3.5 rounded-[7px] bg-subtle border border-rule">
                <span className="text-muted block text-[10px] uppercase font-semibold">Designation</span>
                <span className="font-semibold text-ink">{profile?.designation}</span>
              </div>
              <div className="p-3.5 rounded-[7px] bg-subtle border border-rule">
                <span className="text-muted block text-[10px] uppercase font-semibold">Department</span>
                <span className="font-semibold text-ink">{profile?.department}</span>
              </div>
              <div className="p-3.5 rounded-[7px] bg-subtle border border-rule">
                <span className="text-muted block text-[10px] uppercase font-semibold">Employment Type</span>
                <span className="font-semibold text-ink uppercase">{profile?.employmentType || 'FULL_TIME'}</span>
              </div>
              <div className="p-3.5 rounded-[7px] bg-subtle border border-rule">
                <span className="text-muted block text-[10px] uppercase font-semibold">Hire Date</span>
                <span className="font-mono-nums font-semibold text-ink">{profile?.hireDate || '2024-02-01'}</span>
              </div>
              <div className="p-3.5 rounded-[7px] bg-subtle border border-rule">
                <span className="text-muted block text-[10px] uppercase font-semibold">Work Station</span>
                <span className="font-semibold text-ink">{profile?.workLocation || 'Abuja Head Office (NICON Building)'}</span>
              </div>
            </div>
          </Card>

          {/* Section 2: Contact Information */}
          <Card variant="surface" padding="md">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-brand" />
              <h3 className="text-base font-semibold text-ink font-display">
                Personal &amp; Contact Details
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                value={profile?.firstName || ''}
                disabled
                helperText="Official HR record (non-editable)"
              />
              <Input
                label="Last Name"
                value={profile?.lastName || ''}
                disabled
                helperText="Official HR record (non-editable)"
              />
              <Input
                label="Corporate Email Address"
                type="email"
                value={profile?.email || `${profile?.firstName?.toLowerCase()}.${profile?.lastName?.toLowerCase()}@nexusfinance.ng`}
                leftIcon={<EnvelopeSimple className="w-4 h-4" />}
                disabled
                helperText="Single Sign-On corporate email (non-editable)"
              />
              <Input
                label="Personal Mobile Phone Number"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                leftIcon={<Phone className="w-4 h-4" />}
                placeholder="+234 800 000 0000"
                required
              />
              <div className="sm:col-span-2">
                <Input
                  label="Residential Physical Address"
                  value={formData.residentialAddress}
                  onChange={(e) => setFormData({ ...formData, residentialAddress: e.target.value })}
                  leftIcon={<MapPin className="w-4 h-4" />}
                  placeholder="Plot, Street Name, District, City, State"
                  required
                />
              </div>
            </div>
          </Card>

          {/* Section 3: Bank & Settlement Details */}
          <Card variant="surface" padding="md">
            <div className="flex items-center gap-2 mb-4">
              <Bank className="w-5 h-5 text-brand" />
              <h3 className="text-base font-semibold text-ink font-display">
                Nigerian NUBAN Settlement Bank &amp; KYC
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Settlement Financial Institution"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                placeholder="e.g. Access Bank PLC, GTBank"
                required
              />
              <Input
                label="10-Digit NUBAN Account"
                value={formData.bankAccountNumber}
                onChange={handleNubanChange}
                maxLength={10}
                className="font-mono-nums"
                placeholder="0123456789"
                error={fieldErrors.bankAccountNumber}
                helperText="Validated strictly to 10 numeric digits"
                required
              />
              <Input
                label="Account Beneficiary Name"
                value={formData.bankAccountName}
                onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value })}
                placeholder="Account name as registered with bank"
                required
              />
              <Input
                label="Bank Verification Number (BVN)"
                value={formData.bvn}
                onChange={handleBvnChange}
                maxLength={11}
                className="font-mono-nums"
                placeholder="11-digit BVN"
                error={fieldErrors.bvn}
                helperText="11 numeric digits"
              />
              <Input
                label="National Identity Number (NIN)"
                value={formData.nin}
                onChange={handleNinChange}
                maxLength={11}
                className="font-mono-nums"
                placeholder="11-digit NIN"
                error={fieldErrors.nin}
                helperText="11 numeric digits"
              />
            </div>
          </Card>

          {/* Section 4: Emergency Contact */}
          <Card variant="surface" padding="md">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-brand" />
              <h3 className="text-base font-semibold text-ink font-display">
                Emergency Contact &amp; Next of Kin
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Contact Full Name"
                value={formData.emergencyContactName}
                onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                placeholder="Next of kin full name"
                required
              />
              <Input
                label="Emergency Phone"
                type="tel"
                value={formData.emergencyContactPhone}
                onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                placeholder="+234 800 000 0000"
                required
              />
              <Input
                label="Relationship"
                value={formData.emergencyContactRelationship}
                onChange={(e) => setFormData({ ...formData, emergencyContactRelationship: e.target.value })}
                placeholder="e.g. Spouse, Father, Sister"
                required
              />
            </div>
          </Card>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting}
            >
              Save Profile Changes
            </Button>
          </div>
        </form>
      )}

      {!isLoading && (
        <form onSubmit={handlePasswordChange} className="mt-6">
          <Card variant="surface" padding="md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <LockKey className="w-5 h-5 text-brand" />
                <div>
                  <h3 className="text-base font-semibold text-ink font-display">
                    Account Security &amp; Password Reset
                  </h3>
                  <p className="text-xs text-muted">
                    Update your sign-in password independently. Requires your current password to authorize rotation.
                  </p>
                </div>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-accent-soft text-brand border border-brand/25 self-start sm:self-center">
                Self-Service Security
              </span>
            </div>

            <AnimatePresence>
              {passwordSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-4 p-3.5 rounded-[7px] bg-[#E6F7F1] dark:bg-[#16382F] text-[#007B58] dark:text-[#69D3B0] border border-[#007B58]/30 text-xs font-semibold flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4 shrink-0" weight="fill" />
                  <span>{passwordSuccess}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {passwordError && (
              <div className="mb-4 p-3.5 rounded-[7px] bg-[#FFEDEF] dark:bg-[#40262E] text-[#B52F38] dark:text-[#FFACA9] border border-[#B52F38]/20 text-xs font-medium flex items-start gap-2">
                <WarningCircle className="w-4 h-4 shrink-0 mt-0.5 text-danger" weight="fill" />
                <div className="space-y-0.5">
                  <span className="font-semibold block">{passwordError}</span>
                  {passwordCorrelationId && (
                    <span className="block text-[11px] font-mono-nums opacity-80">
                      Correlation ID: {passwordCorrelationId}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full rounded-[7px] bg-subtle text-ink border border-rule hover:border-brand/40 px-3.5 py-2.5 text-sm pr-10 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-3 text-muted hover:text-ink cursor-pointer"
                    aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  >
                    {showCurrentPassword ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted">
                  Newly onboarded staff default: <code className="font-mono-nums">TemporaryPass123!</code>
                </p>
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
                    className="w-full rounded-[7px] bg-subtle text-ink border border-rule hover:border-brand/40 px-3.5 py-2.5 text-sm pr-10 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-3 text-muted hover:text-ink cursor-pointer"
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  >
                    {showNewPassword ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted">At least 8 characters required</p>
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
                    placeholder="Re-enter new password"
                    className="w-full rounded-[7px] bg-subtle text-ink border border-rule hover:border-brand/40 px-3.5 py-2.5 text-sm pr-10 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-muted hover:text-ink cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                  >
                    {showConfirmPassword ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmNewPassword.length > 0 && confirmNewPassword !== newPassword && (
                  <p className="text-[11px] text-danger font-medium">Passwords do not match</p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 mt-4 border-t border-rule">
              <button
                type="button"
                onClick={() => onNavigate('/auth/login')}
                className="text-xs text-brand font-semibold hover:underline cursor-pointer text-left"
              >
                Forgot your current password? Use OTP recovery on Sign-In &rarr;
              </button>
              <Button
                variant="secondary"
                type="submit"
                isLoading={isChangingPassword}
                leftIcon={<LockKey className="w-4 h-4" />}
              >
                Update Portal Password
              </Button>
            </div>
          </Card>
        </form>
      )}
    </PortalLayout>
  );
};
