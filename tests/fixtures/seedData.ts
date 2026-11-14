export interface SeedUser {
  id: string;
  email: string;
  password: string;
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'TERMINATED';
  profile: {
    id: string;
    staffId: string;
    firstName: string;
    lastName: string;
    gender: 'MALE' | 'FEMALE' | 'PREFER_NOT_TO_SAY';
    phone: string;
    residentialAddress: string;
    departmentId: string;
    department: string;
    designationId: string;
    designation: string;
    managerId: string | null;
    employmentType: 'FULL_TIME' | 'CONTRACT' | 'PROBATION' | 'INTERN';
    hireDate: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    emergencyContactRelationship: string;
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
    avatarUrl?: string;
  };
}

export interface SeedHoliday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  fiscalYear: number;
}

export interface SeedLeaveType {
  id: string;
  name: string;
  code: string;
  annualQuota: number;
  maxConsecutiveDays?: number;
  attachmentThresholdDays?: number;
  requiresAttachment: boolean;
  allowCarryOver: boolean;
  maxCarryOverDays: number;
}

export interface SeedExpenseCategory {
  id: string;
  name: string;
  code: string;
  maxSingleLimit: number;
  receiptRequired: boolean;
  receiptThreshold: number;
}

export interface SeedDepartment {
  id: string;
  name: string;
  code: string;
}

export interface SeedDesignation {
  id: string;
  title: string;
  departmentId: string;
  level: number;
}

export const SEED_DEPARTMENTS: SeedDepartment[] = [
  { id: 'dept-eng', name: 'Engineering', code: 'ENG' },
  { id: 'dept-cru', name: 'Credit & Risk', code: 'CRU' },
  { id: 'dept-fin', name: 'Finance', code: 'FIN' },
  { id: 'dept-hr', name: 'Human Resources', code: 'HR' },
  { id: 'dept-ops', name: 'Operations', code: 'OPS' },
  { id: 'dept-exec', name: 'Executive', code: 'EXEC' }
];

export const SEED_DESIGNATIONS: SeedDesignation[] = [
  { id: 'des-se', title: 'Senior Software Engineer', departmentId: 'dept-eng', level: 4 },
  { id: 'des-em', title: 'Engineering Manager', departmentId: 'dept-eng', level: 6 },
  { id: 'des-cro', title: 'Chief Risk Officer', departmentId: 'dept-cru', level: 9 },
  { id: 'des-ra', title: 'Risk Analyst', departmentId: 'dept-cru', level: 3 },
  { id: 'des-fo', title: 'Finance Officer', departmentId: 'dept-fin', level: 4 },
  { id: 'des-fc', title: 'Financial Controller', departmentId: 'dept-fin', level: 7 },
  { id: 'des-hrm', title: 'HR Manager', departmentId: 'dept-hr', level: 6 },
  { id: 'des-md', title: 'Managing Director', departmentId: 'dept-exec', level: 10 }
];

export const SEED_LEAVE_TYPES: SeedLeaveType[] = [
  { id: 'lt-annual', name: 'Annual Leave', code: 'ANNUAL', annualQuota: 20.0, allowCarryOver: true, maxCarryOverDays: 5.0, requiresAttachment: false },
  { id: 'lt-sick', name: 'Sick Leave', code: 'SICK', annualQuota: 12.0, allowCarryOver: false, maxCarryOverDays: 0, requiresAttachment: true, attachmentThresholdDays: 2 },
  { id: 'lt-casual', name: 'Casual Leave', code: 'CASUAL', annualQuota: 5.0, maxConsecutiveDays: 2, allowCarryOver: false, maxCarryOverDays: 0, requiresAttachment: false },
  { id: 'lt-maternity', name: 'Maternity Leave', code: 'MATERNITY', annualQuota: 84.0, allowCarryOver: false, maxCarryOverDays: 0, requiresAttachment: true },
  { id: 'lt-paternity', name: 'Paternity Leave', code: 'PATERNITY', annualQuota: 10.0, allowCarryOver: false, maxCarryOverDays: 0, requiresAttachment: true },
  { id: 'lt-bereavement', name: 'Bereavement Leave', code: 'BEREAVEMENT', annualQuota: 5.0, allowCarryOver: false, maxCarryOverDays: 0, requiresAttachment: false }
];

export const SEED_EXPENSE_CATEGORIES: SeedExpenseCategory[] = [
  { id: 'cat-trav', name: 'Travel & Mileage', code: 'EXP-TRAV', maxSingleLimit: 200000, receiptRequired: true, receiptThreshold: 5000 },
  { id: 'cat-hosp', name: 'Client Hospitality & Sales', code: 'EXP-HOSP', maxSingleLimit: 150000, receiptRequired: true, receiptThreshold: 5000 },
  { id: 'cat-office', name: 'Office Supplies & Stationeries', code: 'EXP-OFFICE', maxSingleLimit: 50000, receiptRequired: true, receiptThreshold: 5000 },
  { id: 'cat-telco', name: 'Internet & Telecommunications', code: 'EXP-TELCO', maxSingleLimit: 30000, receiptRequired: true, receiptThreshold: 5000 },
  { id: 'cat-train', name: 'Training & Professional Development', code: 'EXP-TRAIN', maxSingleLimit: 500000, receiptRequired: true, receiptThreshold: 5000 },
  { id: 'cat-ops', name: 'Branch Petty Operations', code: 'EXP-OPS', maxSingleLimit: 100000, receiptRequired: true, receiptThreshold: 5000 }
];

export const SEED_NIGERIAN_HOLIDAYS_2026: SeedHoliday[] = [
  { id: 'hol-01', name: "New Year's Day", date: '2026-01-01', fiscalYear: 2026 },
  { id: 'hol-02', name: 'Eid al-Fitr Day 1', date: '2026-03-20', fiscalYear: 2026 },
  { id: 'hol-03', name: 'Eid al-Fitr Day 2', date: '2026-03-21', fiscalYear: 2026 },
  { id: 'hol-04', name: 'Good Friday', date: '2026-04-03', fiscalYear: 2026 },
  { id: 'hol-05', name: 'Easter Monday', date: '2026-04-06', fiscalYear: 2026 },
  { id: 'hol-06', name: "Workers' Day", date: '2026-05-01', fiscalYear: 2026 },
  { id: 'hol-07', name: 'Eid al-Kabir Day 1', date: '2026-05-27', fiscalYear: 2026 },
  { id: 'hol-08', name: 'Eid al-Kabir Day 2', date: '2026-05-28', fiscalYear: 2026 },
  { id: 'hol-09', name: 'Democracy Day', date: '2026-06-12', fiscalYear: 2026 },
  { id: 'hol-10', name: 'Independence Day', date: '2026-10-01', fiscalYear: 2026 },
  { id: 'hol-11', name: 'Christmas Day', date: '2026-12-25', fiscalYear: 2026 },
  { id: 'hol-12', name: 'Boxing Day', date: '2026-12-28', fiscalYear: 2026 } // Observed Monday
];

export const SEED_USERS: SeedUser[] = [
  {
    id: 'usr-admin-01',
    email: 'admin@nexusfinance.ng',
    password: 'AdminPassword123!',
    role: 'ADMIN',
    status: 'ACTIVE',
    profile: {
      id: 'emp-admin-01',
      staffId: 'NX-0001',
      firstName: 'Folashade',
      lastName: 'Adeyemi',
      gender: 'FEMALE',
      phone: '+2348021112233',
      residentialAddress: 'Maitama District, Abuja, FCT',
      departmentId: 'dept-hr',
      department: 'Human Resources',
      designationId: 'des-hrm',
      designation: 'HR Manager',
      managerId: null,
      employmentType: 'FULL_TIME',
      hireDate: '2022-01-15',
      emergencyContactName: 'Babatunde Adeyemi',
      emergencyContactPhone: '+2348033334455',
      emergencyContactRelationship: 'Spouse',
      bankName: 'Guaranty Trust Bank',
      bankAccountNumber: '0123456789',
      bankAccountName: 'Folashade Adeyemi'
    }
  },
  {
    id: 'usr-manager-01',
    email: 'manager@nexusfinance.ng',
    password: 'ManagerPassword123!',
    role: 'MANAGER',
    status: 'ACTIVE',
    profile: {
      id: 'emp-manager-01',
      staffId: 'NX-0105',
      firstName: 'Ibrahim',
      lastName: 'Babangida',
      gender: 'MALE',
      phone: '+2348035556677',
      residentialAddress: 'Garki 2, Abuja, FCT',
      departmentId: 'dept-cru',
      department: 'Credit & Risk',
      designationId: 'des-cro',
      designation: 'Chief Risk Officer',
      managerId: 'emp-admin-01',
      employmentType: 'FULL_TIME',
      hireDate: '2023-03-01',
      emergencyContactName: 'Amina Babangida',
      emergencyContactPhone: '+2348057778899',
      emergencyContactRelationship: 'Spouse',
      bankName: 'Access Bank',
      bankAccountNumber: '0691234567',
      bankAccountName: 'Ibrahim Babangida'
    }
  },
  {
    id: 'usr-depthead-01',
    email: 'depthead@nexusfinance.ng',
    password: 'DeptHeadPassword123!',
    role: 'MANAGER',
    status: 'ACTIVE',
    profile: {
      id: 'emp-depthead-01',
      staffId: 'NX-0080',
      firstName: 'Chukwuma',
      lastName: 'Soludo',
      gender: 'MALE',
      phone: '+2348061239874',
      residentialAddress: 'Asokoro, Abuja, FCT',
      departmentId: 'dept-ops',
      department: 'Operations',
      designationId: 'des-em',
      designation: 'Operations Director',
      managerId: 'emp-admin-01',
      employmentType: 'FULL_TIME',
      hireDate: '2022-06-10',
      emergencyContactName: 'Nkechi Soludo',
      emergencyContactPhone: '+2348098765432',
      emergencyContactRelationship: 'Spouse',
      bankName: 'Zenith Bank',
      bankAccountNumber: '2019876543',
      bankAccountName: 'Chukwuma Soludo'
    }
  },
  {
    id: 'usr-employee-01',
    email: 'employee@nexusfinance.ng',
    password: 'EmployeePassword123!',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    profile: {
      id: 'emp-employee-01',
      staffId: 'NX-1042',
      firstName: 'Oluwaseun',
      lastName: 'Bakare',
      gender: 'MALE',
      phone: '+2348149998877',
      residentialAddress: 'Wuse Zone 4, Abuja, FCT',
      departmentId: 'dept-cru',
      department: 'Credit & Risk',
      designationId: 'des-ra',
      designation: 'Risk Analyst',
      managerId: 'emp-manager-01',
      employmentType: 'FULL_TIME',
      hireDate: '2024-02-01',
      emergencyContactName: 'Kemi Bakare',
      emergencyContactPhone: '+2348123456789',
      emergencyContactRelationship: 'Sister',
      bankName: 'United Bank for Africa',
      bankAccountNumber: '2087654321',
      bankAccountName: 'Oluwaseun Bakare'
    }
  },
  {
    id: 'usr-employee-02',
    email: 'chioma.okonkwo@nexusfinance.ng',
    password: 'ChiomaPassword123!',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    profile: {
      id: 'emp-employee-02',
      staffId: 'NX-1043',
      firstName: 'Chioma',
      lastName: 'Okonkwo',
      gender: 'FEMALE',
      phone: '+2348056667788',
      residentialAddress: 'Jabi District, Abuja, FCT',
      departmentId: 'dept-cru',
      department: 'Credit & Risk',
      designationId: 'des-ra',
      designation: 'Risk Analyst',
      managerId: 'emp-manager-01',
      employmentType: 'FULL_TIME',
      hireDate: '2024-04-15',
      emergencyContactName: 'Emeka Okonkwo',
      emergencyContactPhone: '+2348091112233',
      emergencyContactRelationship: 'Brother',
      bankName: 'First Bank of Nigeria',
      bankAccountNumber: '3045678901',
      bankAccountName: 'Chioma Okonkwo'
    }
  },
  {
    id: 'usr-finance-01',
    email: 'finance@nexusfinance.ng',
    password: 'FinancePassword123!',
    role: 'ADMIN',
    status: 'ACTIVE',
    profile: {
      id: 'emp-finance-01',
      staffId: 'NX-0055',
      firstName: 'Ngozi',
      lastName: 'Eze',
      gender: 'FEMALE',
      phone: '+2348074443322',
      residentialAddress: 'Central Area, Abuja, FCT',
      departmentId: 'dept-fin',
      department: 'Finance',
      designationId: 'des-fc',
      designation: 'Financial Controller',
      managerId: 'emp-admin-01',
      employmentType: 'FULL_TIME',
      hireDate: '2023-01-10',
      emergencyContactName: 'Obinna Eze',
      emergencyContactPhone: '+2348065554433',
      emergencyContactRelationship: 'Spouse',
      bankName: 'Zenith Bank',
      bankAccountNumber: '1023456789',
      bankAccountName: 'Ngozi Eze'
    }
  },
  {
    id: 'usr-inactive-01',
    email: 'inactive@nexusfinance.ng',
    password: 'InactivePassword123!',
    role: 'EMPLOYEE',
    status: 'INACTIVE',
    profile: {
      id: 'emp-inactive-01',
      staffId: 'NX-9999',
      firstName: 'Deactivated',
      lastName: 'Staff',
      gender: 'PREFER_NOT_TO_SAY',
      phone: '+2348000000000',
      residentialAddress: 'Inactive Address',
      departmentId: 'dept-ops',
      department: 'Operations',
      designationId: 'des-se',
      designation: 'Former Staff',
      managerId: 'emp-manager-01',
      employmentType: 'CONTRACT',
      hireDate: '2023-01-01',
      emergencyContactName: 'Emergency',
      emergencyContactPhone: '+2348000000001',
      emergencyContactRelationship: 'Other',
      bankName: 'Access Bank',
      bankAccountNumber: '0000000000',
      bankAccountName: 'Deactivated Staff'
    }
  }
];
