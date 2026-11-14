export interface JobOpening {
  id: string;
  title: string;
  department: string;
  type: string;
  location: string;
  salaryRange: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
}

export const JOB_OPENINGS: JobOpening[] = [
  {
    id: 'job-1',
    title: 'Senior Credit Underwriter (Public Sector)',
    department: 'Credit Risk & Underwriting',
    type: 'Full-Time (Onsite)',
    location: 'Abuja Head Office (NICON Insurance Building)',
    salaryRange: '₦7.5M - ₦11.0M Gross Annual',
    description: 'We are seeking an experienced credit risk professional to evaluate public sector payroll lending portfolios, Remita mandates, and automated decision algorithms.',
    responsibilities: [
      'Analyze borrower financial profiles, IPPIS payment flows, and debt service coverage ratios',
      'Oversee fast-track underwriting workflows ensuring sub-15 minute decisions without compromising risk standards',
      'Collaborate with the Chief Risk Officer on policy refinement and portfolio stress-testing',
    ],
    requirements: [
      'B.Sc. in Finance, Accounting, Economics or related quantitative discipline',
      'Minimum 5 years of retail/consumer lending experience at a licensed commercial bank or microfinance institution',
      'Expert proficiency in Nigerian credit bureau reporting and Remita deductions',
    ],
  },
  {
    id: 'job-2',
    title: 'Senior Full-Stack FinTech Engineer (Node/React)',
    department: 'Fintech & Engineering',
    type: 'Full-Time (Hybrid)',
    location: 'Abuja Head Office / Hybrid',
    salaryRange: '₦9.0M - ₦14.0M Gross Annual',
    description: 'Lead engineering on our high-throughput loan origination switch, core banking APIs, and real-time NIBSS interbank integration services.',
    responsibilities: [
      'Architect robust, zero-trust backend microservices in Node.js / TypeScript with Express',
      'Build responsive client interfaces using React 19, Vite, Tailwind CSS, and Motion',
      'Implement OWASP Top 10 security standards, strict schema validation, and defensive data encryption',
    ],
    requirements: [
      'Minimum 4 years building production-grade web applications and high-throughput financial switches',
      'Demonstrated mastery of TypeScript, React, SQL/ACID databases, and cryptographic protocols',
      'Experience with Nigerian payment switches (NIBSS, Paystack, Flutterwave) is highly advantageous',
    ],
  },
  {
    id: 'job-3',
    title: 'Institutional Relationship Manager',
    department: 'Institutional Sales',
    type: 'Full-Time (Onsite)',
    location: 'Abuja Head Office',
    salaryRange: '₦6.5M - ₦9.5M Gross Annual + Performance Bonus',
    description: 'Cultivate and maintain institutional credit partnerships across Federal Ministries, Departments, and Agencies (MDAs), military formations, and corporate bodies.',
    responsibilities: [
      'Originate strategic corporate credit partnerships with employer cooperatives and staff unions',
      'Conduct executive presentations to staff welfare directors and senior command leadership',
      'Coordinate with operations teams to ensure seamless disbursement and reconciliation',
    ],
    requirements: [
      'Bachelor’s degree in Business Administration, Marketing, or relevant field',
      'Minimum 3 years track record in institutional financial sales or corporate banking',
      'Strong executive presence and established network within federal institutional establishments',
    ],
  },
];
