import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, EnvelopeSimple, Phone, Buildings, IdentificationCard, ArrowRight, ArrowLeft, CheckCircle } from '@phosphor-icons/react';
import { Button, Input, Card } from '../../components/ui';

export interface RegisterPageProps {
  onNavigate: (view: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    department: 'Engineering',
    staffId: '',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-center items-center p-4 sm:p-6 font-sans relative">
      <div className="absolute top-6 left-6">
        <button
          onClick={() => onNavigate('/auth/login')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-ink transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Sign In</span>
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-[12px] bg-action text-on-action flex items-center justify-center font-bold font-display text-2xl mx-auto shadow-sm">
            N
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-ink font-display">
            Staff Onboarding Registration
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            Provision your employee portal credentials and link your payroll profile.
          </p>
        </div>

        <Card variant="surface" padding="lg">
          {isSubmitted ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#E6F7F1] dark:bg-[#16382F] text-[#007B58] dark:text-[#69D3B0] flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8" weight="fill" />
              </div>
              <h3 className="text-xl font-semibold text-ink font-display">
                Registration Request Received
              </h3>
              <p className="text-xs sm:text-sm text-muted max-w-md mx-auto">
                Your onboarding dossier has been forwarded to the Human Resources &amp; System Administration unit. You will receive an activation email with your single-sign-on credentials.
              </p>
              <div className="pt-2">
                <Button
                  variant="primary"
                  onClick={() => onNavigate('/auth/login')}
                >
                  Return to Login
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="e.g. David"
                  required
                />
                <Input
                  label="Last Name"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="e.g. Alabi"
                  required
                />
              </div>

              <Input
                label="Official Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g. david.alabi@nexus.ng"
                leftIcon={<EnvelopeSimple className="w-4 h-4" />}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Phone Number"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. +234 809 121 2224"
                  leftIcon={<Phone className="w-4 h-4" />}
                  required
                />
                <Input
                  label="Staff ID / Mandate"
                  value={formData.staffId}
                  onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                  placeholder="e.g. NX-EMP-0142"
                  leftIcon={<IdentificationCard className="w-4 h-4" />}
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                  Department
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full rounded-[7px] bg-subtle text-ink border border-rule hover:border-brand/40 px-3.5 py-2.5 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <option value="Credit Risk & Underwriting">Credit Risk &amp; Underwriting</option>
                  <option value="Engineering & IT">Engineering &amp; IT</option>
                  <option value="Finance & Accounts">Finance &amp; Accounts</option>
                  <option value="Human Resources">Human Resources</option>
                  <option value="Operations & Customer Experience">Operations &amp; Customer Experience</option>
                  <option value="Legal & Asset Remediation">Legal &amp; Asset Remediation</option>
                </select>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full mt-2"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Submit Registration Dossier
              </Button>
            </form>
          )}
        </Card>
      </motion.div>
    </div>
  );
};
