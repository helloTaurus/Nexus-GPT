export type GalleryFolder = 'Office' | 'CSR' | 'Store Marketing' | 'Store Operations' | 'Executive Summits';

export interface GalleryItem {
  id: string;
  title: string;
  category: GalleryFolder;
  description: string;
  imageUrl: string;
  date: string;
  location: string;
}

export const INITIAL_GALLERY_ITEMS: GalleryItem[] = [
  {
    id: 'gal-1',
    title: 'Executive Boardroom & Risk Committee Session',
    category: 'Office',
    description: 'Quarterly asset-liability and risk calibration committee convenes at our NICON Insurance Building executive chambers.',
    imageUrl: './assets/nexus/team/henrietta_okolo.webp',
    date: 'October 2026',
    location: 'Abuja Head Office',
  },
  {
    id: 'gal-2',
    title: 'Women Entrepreneurs Empowerment Workshop (NWEL)',
    category: 'CSR',
    description: 'Nexus Finance Human Capital team hosting financial literacy and working capital guidance for female retail traders.',
    imageUrl: './assets/nexus/entrepreneur.webp',
    date: 'September 2026',
    location: 'Garki International Market Hub',
  },
  {
    id: 'gal-3',
    title: 'Institutional Liquidity & Fintech Partnership Summit',
    category: 'Executive Summits',
    description: 'Bilateral coordination summit with national interbank payment switch partners and regulatory advisors.',
    imageUrl: './assets/nexus/corporate_salary_exec.jpg',
    date: 'August 2026',
    location: 'Transcorp Hilton, Abuja',
  },
  {
    id: 'gal-4',
    title: 'Insured Asset Custody & Bullion Inspection Depot',
    category: 'Store Operations',
    description: 'Operational depot showcasing physical security apparatus and vehicle appraisal inspection zones.',
    imageUrl: './assets/nexus/hero_car.jpg',
    date: 'July 2026',
    location: 'Nexus Logistics Depot, Abuja',
  },
];
