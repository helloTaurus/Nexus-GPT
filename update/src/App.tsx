import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Navbar, Footer } from './components/layout';
import { ApplyModal } from './components/features/ApplyModal';
import { useIOReveal } from './hooks/useIOReveal';

// Public Pages
import {
  LandingPage,
  AboutUsPage,
  ProductDetailPage,
  BlogPage,
  CareersPage,
  GalleryPage,
  NotFoundPage,
} from './pages/public';

// Auth Pages
import { LoginPage, RegisterPage } from './pages/auth';

// Portal Pages (Staff Self-Service)
import {
  StaffDashboardPage,
  StaffLeavePage,
  StaffExpensesPage,
  StaffAppraisalsPage,
  StaffProfilePage,
} from './pages/portal';

// Admin Pages (HRMS & Governance)
import {
  AdminDashboardPage,
  EmployeeDirectoryPage,
  LeaveApprovalPage,
  ExpenseApprovalPage,
  AppraisalCalibrationPage,
  AuditLogsPage,
  CmsPortalPage,
} from './pages/admin';

export type AppRoute =
  // Public
  | 'home'
  | 'about'
  | '/about'
  | 'blog'
  | '/blog'
  | 'careers'
  | '/careers'
  | 'gallery'
  | '/gallery'
  | 'product-detail'
  | '/product-detail'
  | '404'
  | '/404'
  // Auth
  | '/auth/login'
  | '/auth/register'
  | 'login'
  | 'register'
  // Portal
  | '/portal/dashboard'
  | '/portal/leave'
  | '/portal/expenses'
  | '/portal/appraisals'
  | '/portal/profile'
  // Admin
  | '/admin/dashboard'
  | '/admin/employees'
  | '/admin/leave-approvals'
  | '/admin/expense-approvals'
  | '/admin/appraisals'
  | '/admin/audit-logs'
  | '/admin/cms'
  | 'cms';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('home');
  const [selectedProductId, setSelectedProductId] = useState<string>('suremoney-loan');
  const [attemptedRoute, setAttemptedRoute] = useState<string>('');

  // Fast-track apply modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultProduct, setModalDefaultProduct] = useState<string | undefined>(undefined);
  const [modalDefaultAmount, setModalDefaultAmount] = useState<number | undefined>(undefined);
  const [modalDefaultTenure, setModalDefaultTenure] = useState<number | undefined>(undefined);

  // Trigger intersection observer reveal animation on viewport entry
  useIOReveal('.io-reveal');

  // Synchronize state from window.location.hash
  const handleUrlChange = useCallback(() => {
    const rawHash = window.location.hash;
    const cleanHash = rawHash.replace(/^#\/?/, '').replace(/\/+$/, '');

    if (!cleanHash || cleanHash === 'home') {
      setCurrentRoute('home');
      return;
    }

    const path = cleanHash.startsWith('/') ? cleanHash : `/${cleanHash}`;

    // 1. Auth routes (preserve canonical /auth/ namespace)
    if (path === '/auth/login' || path === '/login') {
      setCurrentRoute('/auth/login');
      return;
    }
    if (path === '/auth/register' || path === '/register') {
      setCurrentRoute('/auth/register');
      return;
    }

    // 2. Staff Portal routes
    if (path === '/portal' || path === '/portal/dashboard') {
      setCurrentRoute('/portal/dashboard');
      return;
    }
    if (path === '/portal/leave') {
      setCurrentRoute('/portal/leave');
      return;
    }
    if (path === '/portal/expenses') {
      setCurrentRoute('/portal/expenses');
      return;
    }
    if (path === '/portal/appraisals') {
      setCurrentRoute('/portal/appraisals');
      return;
    }
    if (path === '/portal/profile') {
      setCurrentRoute('/portal/profile');
      return;
    }

    // 3. Admin routes
    if (path === '/admin' || path === '/admin/dashboard') {
      setCurrentRoute('/admin/dashboard');
      return;
    }
    if (path === '/admin/employees') {
      setCurrentRoute('/admin/employees');
      return;
    }
    if (path === '/admin/leave-approvals') {
      setCurrentRoute('/admin/leave-approvals');
      return;
    }
    if (path === '/admin/expense-approvals') {
      setCurrentRoute('/admin/expense-approvals');
      return;
    }
    if (path === '/admin/appraisals') {
      setCurrentRoute('/admin/appraisals');
      return;
    }
    if (path === '/admin/audit-logs') {
      setCurrentRoute('/admin/audit-logs');
      return;
    }
    if (path === '/admin/cms' || path === '/cms') {
      setCurrentRoute('/admin/cms');
      return;
    }

    // 4. Public Pages
    if (path === '/about') {
      setCurrentRoute('about');
      return;
    }
    if (path === '/blog') {
      setCurrentRoute('blog');
      return;
    }
    if (path === '/careers') {
      setCurrentRoute('careers');
      return;
    }
    if (path === '/gallery') {
      setCurrentRoute('gallery');
      return;
    }

    // 5. Product Detail
    if (cleanHash.startsWith('product-detail/')) {
      const prodId = cleanHash.split('/')[1] || 'suremoney-loan';
      setSelectedProductId(prodId);
      setCurrentRoute('product-detail');
      return;
    }
    if (path.startsWith('/product-detail')) {
      const parts = path.split('/');
      const prodId = parts[2] || 'suremoney-loan';
      setSelectedProductId(prodId);
      setCurrentRoute('product-detail');
      return;
    }

    // 6. Section anchors
    if (['leadership', 'partners', 'about-products'].includes(cleanHash)) {
      setCurrentRoute('about');
      setTimeout(() => {
        const el = document.getElementById(cleanHash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
      return;
    }
    if (['calculator', 'contact'].includes(cleanHash)) {
      setCurrentRoute('home');
      setTimeout(() => {
        const el = document.getElementById(cleanHash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
      return;
    }

    // 7. Unmatched -> 404
    setAttemptedRoute(rawHash);
    setCurrentRoute('404');
  }, []);

  useEffect(() => {
    handleUrlChange();
    window.addEventListener('hashchange', handleUrlChange);
    return () => window.removeEventListener('hashchange', handleUrlChange);
  }, [handleUrlChange]);

  const handleOpenApply = (productName?: string, amount?: number, tenure?: number) => {
    setModalDefaultProduct(productName);
    setModalDefaultAmount(amount);
    setModalDefaultTenure(tenure);
    setModalOpen(true);
  };

  const handleNavigate = (route: string, productId?: string) => {
    // Normalization
    if (route === 'portal' || route === '/portal') {
      route = '/portal/dashboard';
    } else if (route === 'admin' || route === '/admin') {
      route = '/admin/dashboard';
    } else if (route === 'login' || route === '/auth/login' || route === '/login') {
      route = '/auth/login';
    } else if (route === 'register' || route === '/auth/register' || route === '/register') {
      route = '/auth/register';
    } else if (route === 'cms' || route === '/cms') {
      route = '/admin/cms';
    } else if (route === '/' || route === '' || route === 'home') {
      route = 'home';
    }

    if (route === 'product-detail' || route === '/product-detail') {
      const activeProd = productId || selectedProductId || 'suremoney-loan';
      setSelectedProductId(activeProd);
      setCurrentRoute('product-detail');
      window.location.hash = `product-detail/${activeProd}`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Canonical Auth Navigation
    if (route === '/auth/login' || route === '/auth/register') {
      setCurrentRoute(route as AppRoute);
      window.location.hash = route;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Portal and Admin routes
    const validPortalRoutes = [
      '/portal/dashboard',
      '/portal/leave',
      '/portal/expenses',
      '/portal/appraisals',
      '/portal/profile',
    ];
    const validAdminRoutes = [
      '/admin/dashboard',
      '/admin/employees',
      '/admin/leave-approvals',
      '/admin/expense-approvals',
      '/admin/appraisals',
      '/admin/audit-logs',
      '/admin/cms',
    ];

    if (validPortalRoutes.includes(route) || validAdminRoutes.includes(route)) {
      setCurrentRoute(route as AppRoute);
      window.location.hash = route;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Standalone Public Pages
    if (['about', 'blog', 'careers', 'gallery'].includes(route) || ['/about', '/blog', '/careers', '/gallery'].includes(route)) {
      const clean = route.replace('/', '') as AppRoute;
      setCurrentRoute(clean);
      window.location.hash = clean;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Section anchors on About
    if (route === 'about-products' || route === 'leadership' || route === 'partners') {
      setCurrentRoute('about');
      window.location.hash = 'about';
      setTimeout(() => {
        const el = document.getElementById(route);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
      return;
    }

    // Section anchors on Home
    if (route === 'home' || route === 'calculator' || route === 'contact') {
      setCurrentRoute('home');
      window.location.hash = '';
      if (route === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setTimeout(() => {
        const el = document.getElementById(route);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
      return;
    }

    // Fallback: 404
    setAttemptedRoute(route);
    setCurrentRoute('404');
    window.location.hash = route;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isPortalView = currentRoute.startsWith('/portal/');
  const isAdminView = currentRoute.startsWith('/admin/') && currentRoute !== '/admin/cms';
  const isAuthView =
    currentRoute === '/auth/login' ||
    currentRoute === '/auth/register' ||
    currentRoute === 'login' ||
    currentRoute === 'register';
  const isCmsView = currentRoute === '/admin/cms' || currentRoute === 'cms';
  const isPublicShell = !isPortalView && !isAdminView && !isAuthView && !isCmsView;

  return (
    <div className="nx-app min-h-screen bg-canvas text-ink selection:bg-action selection:text-white font-body transition-colors duration-300">
      {/* 1. Global Navbar for public pages & 404 */}
      {isPublicShell && (
        <Navbar
          onOpenApply={handleOpenApply}
          onNavigate={handleNavigate}
          currentView={currentRoute}
        />
      )}

      {/* Main Routed Content with Contextual Motion Transitions */}
      <main id="main-content" tabIndex={-1}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentRoute}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* PUBLIC PAGES */}
            {currentRoute === 'home' && (
              <LandingPage
                onOpenApply={handleOpenApply}
                onNavigate={handleNavigate}
                onScrollToCalculator={() => handleNavigate('calculator')}
              />
            )}

            {(currentRoute === 'about' || currentRoute === '/about') && (
              <AboutUsPage onOpenApply={handleOpenApply} onNavigate={handleNavigate} />
            )}

            {(currentRoute === 'product-detail' || currentRoute === '/product-detail') && (
              <ProductDetailPage
                productId={selectedProductId}
                onOpenApply={handleOpenApply}
                onNavigate={handleNavigate}
              />
            )}

            {(currentRoute === 'blog' || currentRoute === '/blog') && (
              <BlogPage onNavigate={handleNavigate} onOpenApply={handleOpenApply} />
            )}

            {(currentRoute === 'careers' || currentRoute === '/careers') && (
              <CareersPage onNavigate={handleNavigate} onOpenApply={handleOpenApply} />
            )}

            {(currentRoute === 'gallery' || currentRoute === '/gallery') && (
              <GalleryPage onNavigate={handleNavigate} onOpenApply={handleOpenApply} />
            )}

            {/* 404 NOT FOUND PAGE */}
            {(currentRoute === '404' || currentRoute === '/404') && (
              <NotFoundPage
                attemptedPath={attemptedRoute}
                onNavigate={handleNavigate}
              />
            )}

            {/* AUTH PAGES */}
            {(currentRoute === '/auth/login' || currentRoute === 'login') && (
              <LoginPage onNavigate={handleNavigate} />
            )}

            {(currentRoute === '/auth/register' || currentRoute === 'register') && (
              <RegisterPage onNavigate={handleNavigate} />
            )}

            {/* PORTAL PAGES (Staff Self-Service) */}
            {currentRoute === '/portal/dashboard' && (
              <StaffDashboardPage
                currentPath={currentRoute}
                onNavigate={handleNavigate}
              />
            )}

            {currentRoute === '/portal/leave' && (
              <StaffLeavePage currentPath={currentRoute} onNavigate={handleNavigate} />
            )}

            {currentRoute === '/portal/expenses' && (
              <StaffExpensesPage currentPath={currentRoute} onNavigate={handleNavigate} />
            )}

            {currentRoute === '/portal/appraisals' && (
              <StaffAppraisalsPage currentPath={currentRoute} onNavigate={handleNavigate} />
            )}

            {currentRoute === '/portal/profile' && (
              <StaffProfilePage currentPath={currentRoute} onNavigate={handleNavigate} />
            )}

            {/* ADMIN PAGES (HRMS & Governance) */}
            {currentRoute === '/admin/dashboard' && (
              <AdminDashboardPage
                currentPath={currentRoute}
                onNavigate={handleNavigate}
              />
            )}

            {currentRoute === '/admin/employees' && (
              <EmployeeDirectoryPage currentPath={currentRoute} onNavigate={handleNavigate} />
            )}

            {currentRoute === '/admin/leave-approvals' && (
              <LeaveApprovalPage currentPath={currentRoute} onNavigate={handleNavigate} />
            )}

            {currentRoute === '/admin/expense-approvals' && (
              <ExpenseApprovalPage currentPath={currentRoute} onNavigate={handleNavigate} />
            )}

            {currentRoute === '/admin/appraisals' && (
              <AppraisalCalibrationPage currentPath={currentRoute} onNavigate={handleNavigate} />
            )}

            {currentRoute === '/admin/audit-logs' && (
              <AuditLogsPage currentPath={currentRoute} onNavigate={handleNavigate} />
            )}

            {/* CMS PORTAL (Admin Page) */}
            {(currentRoute === '/admin/cms' || currentRoute === 'cms') && (
              <CmsPortalPage onNavigate={handleNavigate} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Global Footer on public pages & 404 */}
      {isPublicShell && (
        <Footer onOpenApply={handleOpenApply} onNavigate={handleNavigate} />
      )}

      {/* Global Fast-Track Loan Application Modal */}
      <ApplyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultProduct={modalDefaultProduct}
        defaultAmount={modalDefaultAmount}
        defaultTenure={modalDefaultTenure}
      />
    </div>
  );
}
