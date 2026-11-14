import { ReferenceServer } from '../fixtures/referenceServer.ts';
import { TestClient } from './testClient.ts';

let globalRefServer: ReferenceServer | null = null;

export function getReferenceServer(): ReferenceServer {
  if (!globalRefServer) {
    globalRefServer = new ReferenceServer();
  }
  return globalRefServer;
}

export function resetTestState(): void {
  if (globalRefServer) {
    globalRefServer.resetState();
  }
}

export async function createTestClient(): Promise<TestClient> {
  const liveUrl = process.env.API_BASE_URL;
  if (liveUrl) {
    return new TestClient(liveUrl, null);
  }
  const refServer = getReferenceServer();
  return new TestClient('', refServer);
}

export type SeedUserKey = 'admin' | 'manager' | 'employee' | 'chioma' | 'finance' | 'depthead' | 'inactive';

const USER_CREDENTIALS: Record<SeedUserKey, { email: string; pass: string }> = {
  admin: { email: 'admin@nexusfinance.ng', pass: 'AdminPassword123!' },
  manager: { email: 'manager@nexusfinance.ng', pass: 'ManagerPassword123!' },
  employee: { email: 'employee@nexusfinance.ng', pass: 'EmployeePassword123!' },
  chioma: { email: 'chioma.okonkwo@nexusfinance.ng', pass: 'ChiomaPassword123!' },
  finance: { email: 'finance@nexusfinance.ng', pass: 'FinancePassword123!' },
  depthead: { email: 'depthead@nexusfinance.ng', pass: 'DeptHeadPassword123!' },
  inactive: { email: 'inactive@nexusfinance.ng', pass: 'InactivePassword123!' }
};

export async function createAuthenticatedClient(role: SeedUserKey = 'employee'): Promise<TestClient> {
  const client = await createTestClient();
  const creds = USER_CREDENTIALS[role];
  const res = await client.login(creds.email, creds.pass);
  if (res.status !== 200) {
    throw new Error(`Failed to authenticate as ${role}: status ${res.status} - ${JSON.stringify(res.body)}`);
  }
  return client;
}
