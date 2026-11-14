import { AtomicJsonStore } from './store/AtomicJsonStore.ts';
import type { UserAccount, EmployeeProfile } from './types.ts';
import { PasswordService } from '../services/passwordService.ts';
import { superadminConfig } from '../config/env.ts';

export class UserRepository {
  constructor(private store: AtomicJsonStore<UserAccount>) {}

  public static createDefaultSeed(): UserAccount[] {
    const nameParts = (superadminConfig.NAME || 'Super Administrator').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Super';
    const lastName = nameParts.slice(1).join(' ') || 'Admin';

    return [
      {
        id: 'usr-superadmin-01',
        email: superadminConfig.EMAIL,
        passwordHash: PasswordService.hashPassword(superadminConfig.PASSWORD),
        role: 'ADMIN',
        status: 'ACTIVE',
        profile: {
          id: 'emp-superadmin-01',
          staffId: superadminConfig.STAFF_ID,
          firstName,
          lastName,
          gender: 'PREFER_NOT_TO_SAY',
          phone: '+2348000000000',
          residentialAddress: 'Nexus Executive Suite, Victoria Island, Lagos',
          departmentId: 'dept-exec',
          department: 'Executive Governance',
          designationId: 'des-md',
          designation: 'HR & System Admin - Executive Chamber',
          managerId: null,
          employmentType: 'FULL_TIME',
          hireDate: '2026-01-01',
          emergencyContactName: 'Nexus Governance Council',
          emergencyContactPhone: '+2348000000000',
          emergencyContactRelationship: 'Executive Board',
          bankName: 'Nexus Central Treasury',
          bankAccountNumber: '0000000000',
          bankAccountName: superadminConfig.NAME
        }
      }
    ];
  }

  public async initialize(): Promise<void> {
    await this.store.initialize();
  }

  public findById(id: string): UserAccount | null {
    return this.store.getById(id) || this.store.find(u => u.profile.id === id) || null;
  }

  public findByEmail(email: string): UserAccount | null {
    const canonical = email.trim().toLowerCase();
    return this.store.find(u => u.email.toLowerCase() === canonical) || null;
  }

  public findByStaffId(staffId: string): UserAccount | null {
    const sId = staffId.trim().toUpperCase();
    return this.store.find(u => u.profile.staffId.toUpperCase() === sId) || null;
  }

  public findAll(filter: { search?: string; departmentId?: string; page?: number; limit?: number } = {}): {
    profiles: Array<EmployeeProfile & { role?: UserAccount['role']; status?: UserAccount['status'] }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } {
    let users = this.store.getAll();

    if (filter.search) {
      const q = filter.search.toLowerCase();
      users = users.filter(
        u =>
          u.profile.firstName.toLowerCase().includes(q) ||
          u.profile.lastName.toLowerCase().includes(q) ||
          u.profile.staffId.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }

    if (filter.departmentId) {
      users = users.filter(u => u.profile.departmentId === filter.departmentId);
    }

    const total = users.length;
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, filter.limit || 10);
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = users.slice(startIndex, startIndex + limit).map(u => ({
      ...u.profile,
      role: u.role,
      status: u.status
    }));

    return {
      profiles: paginated,
      total,
      page,
      limit,
      totalPages
    };
  }

  public findDirectReports(managerProfileId: string): EmployeeProfile[] {
    return this.store
      .filter(u => u.profile.managerId === managerProfileId)
      .map(u => u.profile);
  }

  public async create(user: UserAccount): Promise<UserAccount> {
    return this.store.save(user);
  }

  public async update(id: string, updates: Partial<UserAccount>): Promise<UserAccount> {
    const user = this.findById(id);
    if (!user) throw new Error(`User not found: ${id}`);
    Object.assign(user, updates);
    await this.store.save(user);
    return user;
  }

  public async updateProfile(userId: string, profileUpdates: Partial<EmployeeProfile>): Promise<EmployeeProfile> {
    const user = this.findById(userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    Object.assign(user.profile, profileUpdates);
    await this.store.save(user);
    return user.profile;
  }

  public getAllUsers(): UserAccount[] {
    return this.store.getAll();
  }

  public async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  public async reset(): Promise<void> {
    await this.store.reset();
  }
}
