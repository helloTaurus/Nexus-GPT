export interface LeadershipMember {
  name: string;
  role: string;
  department?: string;
  image?: string;
  formerBackground: string;
  bio?: string;
  fullBio?: string;
  education?: string[];
  careerHighlights?: string[];
  coreResponsibilities?: string[];
}

export interface NexusProduct {
  id: string;
  name: string;
  badge: string;
  tagline: string;
  description: string;
  turnaroundTime: string;
  rateInfo: string;
  maxAmount: string;
  tenure: string;
  keyBenefit: string;
  requirements: string[];
}

export interface FaqItem {
  question: string;
  answer: string;
  category?: string;
}

export interface TestimonialItem {
  quote: string;
  author: string;
  role: string;
  organization: string;
  avatar?: string;
  rating?: number;
}
