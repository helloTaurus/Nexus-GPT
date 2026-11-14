export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: 'Fintech & Credit' | 'SME Growth' | 'Wealth & Treasury' | 'Regulatory & Policy';
  author: string;
  authorRole: string;
  readTime: string;
  excerpt: string;
  content: string;
  image: string;
  date: string;
}

export const INITIAL_BLOG_POSTS: BlogPost[] = [
  {
    id: 'post-1',
    title: 'Algorithmic Underwriting: The Architecture Behind 15-Minute Liquidity',
    slug: 'algorithmic-underwriting-15-minute-liquidity',
    category: 'Fintech & Credit',
    author: 'Immanuel Igomu',
    authorRole: 'Group Head IT & Innovation',
    readTime: '5 min read',
    excerpt: 'How modern NIBSS switch integrations and real-time biometric verification eliminate manual paper delays in consumer credit.',
    content: `In traditional Nigerian banking architectures, loan fulfillment often requires multi-day committee reviews, branch visits, and physical form lodgement. At Nexus Finance, we engineered an institutional credit scoring rail from first principles.\n\nBy interfacing securely with the Nigerian Interbank Settlement System (NIBSS) and verifying Bank Verification Numbers (BVN) in real-time, our decision engines assess salary flows, cash volatility, and debt service ratios in under 180 seconds.\n\nThis algorithmic model prevents human bias while maintaining disciplined non-performing loan ratios strictly below international benchmark tolerances.`,
    image: './assets/nexus/naira_1000_stacks.jpg',
    date: 'November 2, 2026',
  },
  {
    id: 'post-2',
    title: 'Preserving Capital in Volatile Markets: Why Fixed Yield Beats Speculation',
    slug: 'preserving-capital-in-volatile-markets',
    category: 'Wealth & Treasury',
    author: 'David Nwokeukwu',
    authorRole: 'Chief Risk Officer',
    readTime: '4 min read',
    excerpt: 'An institutional perspective on why high-yield, asset-backed deposit structures protect family offices and corporate treasuries.',
    content: `With inflation and currency fluctuations influencing market sentiment across West Africa, savvy institutional investors prioritize capital preservation over speculative equity plays.\n\nNexus Finance Fixed Deposit Vaults offer contracted, non-volatile returns up to 15.5% APY. Backed by diversified collateralized credit assets and institutional governance, our treasury products deliver predictable yield that outpaces conventional savings instruments.`,
    image: './assets/nexus/gold_vault.jpg',
    date: 'October 28, 2026',
  },
  {
    id: 'post-3',
    title: 'SME Working Capital: Navigating Supply Chain Seasonality in Retail Hubs',
    slug: 'sme-working-capital-supply-chain-seasonality',
    category: 'SME Growth',
    author: 'Oluwatosin Ogunleye',
    authorRole: 'Chief Service Officer',
    readTime: '6 min read',
    excerpt: 'Practical cash flow management doctrines for market traders, import distributors, and growing retail enterprises.',
    content: `Retail traders in major commercial clusters often face temporary liquidity shortages during high-demand restocking windows. The lag between customer receivable collection and supplier advance payments can choke growth.\n\nOur Shop-Owned Loan and Invoice Discounting facilities provide flexible, short-tenure advances that allow business operators to capture bulk purchasing discounts without pledging real estate collateral.`,
    image: './assets/nexus/entrepreneur.webp',
    date: 'October 15, 2026',
  },
];
