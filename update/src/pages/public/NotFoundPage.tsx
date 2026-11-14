import React from 'react';
import { motion } from 'motion/react';
import {
  House,
  ArrowLeft,
  ShieldCheck,
  User,
  WarningCircle,
} from '@phosphor-icons/react';
import { Button, Card } from '../../components/ui';

export interface NotFoundPageProps {
  attemptedPath?: string;
  onNavigate: (view: string, productId?: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  attemptedPath,
  onNavigate,
}) => {
  const displayPath = attemptedPath || (typeof window !== 'undefined' ? window.location.hash : '');

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 sm:px-6 lg:px-8 bg-canvas">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-xl text-center space-y-6"
      >
        {/* Error Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-soft text-brand border border-brand/20 text-xs font-semibold uppercase tracking-wider">
          <WarningCircle size={16} weight="fill" />
          <span>HTTP 404 &bull; Page Not Found</span>
        </div>

        {/* Display Heading */}
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl font-bold font-display text-ink tracking-tight">
            Lost in the Nexus?
          </h1>
          <p className="text-sm sm:text-base text-muted max-w-md mx-auto leading-relaxed font-sans">
            The page or resource you requested does not exist, has been moved, or is temporarily unavailable.
          </p>
        </div>

        {/* Diagnostic Path Snippet */}
        {displayPath && (
          <div className="p-3 mx-auto max-w-md rounded-[7px] bg-subtle border border-rule text-xs font-mono text-muted text-center break-all">
            Requested: <span className="text-ink font-semibold">{displayPath}</span>
          </div>
        )}

        {/* Action Controls */}
        <Card className="p-6 bg-surface border border-rule shadow-sm space-y-4 text-left">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            Recommended Recovery Paths
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="primary"
              className="w-full justify-center gap-2"
              onClick={() => onNavigate('home')}
            >
              <House size={16} weight="bold" />
              <span>Return to Home</span>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-center gap-2"
              onClick={() => onNavigate('/portal/dashboard')}
            >
              <User size={16} />
              <span>Staff Portal</span>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-center gap-2"
              onClick={() => onNavigate('/admin/dashboard')}
            >
              <ShieldCheck size={16} />
              <span>Admin Console</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-center gap-2"
              onClick={() => onNavigate('/auth/login')}
            >
              <ArrowLeft size={16} />
              <span>Sign In / Auth</span>
            </Button>
          </div>
        </Card>

        {/* Quick Links */}
        <div className="pt-2 text-xs text-muted space-x-4">
          <button
            onClick={() => onNavigate('about')}
            className="hover:text-brand hover:underline cursor-pointer"
          >
            About Us
          </button>
          <span>&bull;</span>
          <button
            onClick={() => onNavigate('careers')}
            className="hover:text-brand hover:underline cursor-pointer"
          >
            Careers
          </button>
          <span>&bull;</span>
          <button
            onClick={() => onNavigate('blog')}
            className="hover:text-brand hover:underline cursor-pointer"
          >
            News &amp; Insights
          </button>
          <span>&bull;</span>
          <button
            onClick={() => onNavigate('contact')}
            className="hover:text-brand hover:underline cursor-pointer"
          >
            Contact Support
          </button>
        </div>
      </motion.div>
    </div>
  );
};
