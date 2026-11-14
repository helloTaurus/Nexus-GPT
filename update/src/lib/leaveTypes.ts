export type LeaveTypeId =
  | 'lt-annual'
  | 'lt-sick'
  | 'lt-casual'
  | 'lt-maternity'
  | 'lt-paternity'
  | 'lt-bereavement';

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  fiscalYear: number;
  allocatedDays: number;
  carriedOverDays: number;
  accruedDays: number;
  usedDays: number;
  pendingDays: number;
  availableDays: number;
}

export type LeaveRequestStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveRequest {
  id: string;
  requestNumber: string;
  employeeId: string;
  employeeName?: string;
  department?: string;
  leaveTypeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  isHalfDay: boolean;
  totalDays: number;
  reason: string;
  attachmentUrl?: string;
  status: LeaveRequestStatus;
  assignedApproverId: string;
  submittedAt: string;
  decidedAt?: string;
  decisionReason?: string;
}

export interface WorkingDaysCalculation {
  workingDays: number;
  calendarDays: number;
  holidaysEncountered: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    correlationId?: string;
    details?: any[];
  };
}

export interface EmployeeProfile {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  gender?: 'MALE' | 'FEMALE' | 'PREFER_NOT_TO_SAY';
  email?: string;
  phone: string;
  residentialAddress: string;
  departmentId?: string;
  department: string;
  designationId?: string;
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
  bvn?: string;
  nin?: string;
  avatarUrl?: string;
  workLocation?: string;
  reportingManager?: string;
}

export interface NigerianHoliday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  description: string;
}

export const SEED_NIGERIAN_HOLIDAYS_2026: NigerianHoliday[] = [
  { id: 'hol-01', name: "New Year's Day", date: '2026-01-01', dayOfWeek: 'Thursday', description: 'Civil new year' },
  { id: 'hol-02', name: 'Eid al-Fitr (Day 1)', date: '2026-03-20', dayOfWeek: 'Friday', description: 'End of Ramadan' },
  { id: 'hol-03', name: 'Eid al-Fitr (Day 2)', date: '2026-03-21', dayOfWeek: 'Saturday', description: 'Feast of Eid al-Fitr' },
  { id: 'hol-04', name: 'Good Friday', date: '2026-04-03', dayOfWeek: 'Friday', description: 'Christian Paschal Triduum' },
  { id: 'hol-05', name: 'Easter Monday', date: '2026-04-06', dayOfWeek: 'Monday', description: 'Easter public holiday' },
  { id: 'hol-06', name: "Workers' Day", date: '2026-05-01', dayOfWeek: 'Friday', description: 'May Day / International Labour Day' },
  { id: 'hol-07', name: 'Eid al-Kabir (Day 1)', date: '2026-05-27', dayOfWeek: 'Wednesday', description: 'Feast of Sacrifice' },
  { id: 'hol-08', name: 'Eid al-Kabir (Day 2)', date: '2026-05-28', dayOfWeek: 'Thursday', description: 'Second day of Sacrifice' },
  { id: 'hol-09', name: 'Democracy Day', date: '2026-06-12', dayOfWeek: 'Friday', description: 'National Democracy Day' },
  { id: 'hol-10', name: 'Independence Day', date: '2026-10-01', dayOfWeek: 'Thursday', description: '66th National Independence Anniversary' },
  { id: 'hol-11', name: 'Christmas Day', date: '2026-12-25', dayOfWeek: 'Friday', description: 'Feast of the Nativity' },
  { id: 'hol-12', name: 'Boxing Day (Observed)', date: '2026-12-28', dayOfWeek: 'Monday', description: 'Observed Boxing Day' },
];
