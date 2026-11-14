import React from 'react';
import {
  Hero,
  ProductBento,
  TrustMarquee,
  MoveMoney,
  Calculator,
  LeadershipSection,
  FAQ,
  TestimonialsSliderSection,
  LiveTickingYieldSection,
  ContactSection,
} from '../../components/features';

export interface LandingPageProps {
  onOpenApply: (productName?: string, amount?: number, tenure?: number) => void;
  onNavigate: (view: string, productId?: string) => void;
  onScrollToCalculator: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenApply,
  onNavigate,
  onScrollToCalculator,
}) => {
  return (
    <>
      {/* 1. Hero */}
      <Hero
        onOpenApply={onOpenApply}
        onScrollToCalculator={onScrollToCalculator}
        onNavigateProduct={(prodId) => onNavigate('product-detail', prodId)}
      />

      {/* 2. Product Bento Grid */}
      <ProductBento
        onSelectProduct={(prodId) => onNavigate('product-detail', prodId)}
      />

      {/* 3. Trust Marquee / Institutional Partner Strip */}
      <div id="partners">
        <TrustMarquee />
      </div>

      {/* 4. 15-Minute Prompt Liquidity */}
      <MoveMoney onOpenApply={onOpenApply} />

      {/* 5. Interactive Loan & Investment Calculator */}
      <Calculator onOpenApply={onOpenApply} />

      {/* 6. Executive Leadership Governance */}
      <LeadershipSection />

      {/* 7. Frequently Asked Questions */}
      <FAQ />

      {/* 8. Testimonials */}
      <TestimonialsSliderSection />

      {/* 9. Live Ticking Yield */}
      <LiveTickingYieldSection onOpenApply={onOpenApply} />

      {/* 10. Contact Section */}
      <ContactSection />
    </>
  );
};
