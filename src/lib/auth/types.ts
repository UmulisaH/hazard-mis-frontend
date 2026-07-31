export type AppRole = 'admin' | 'manager' | 'safety_officer' | 'reporter';

export interface DecodedJwtPayload {
  sub: string;
  email: string;
  role: AppRole;
  exp: number;
  iat: number;
}

export interface DepartmentReference {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentUserProfile {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string;
  phone: string;
  role: AppRole;
  department: DepartmentReference | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: AppRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterEmployeeRequest {
  email: string;
  password: string;
  fullName: string;
  jobTitle: string;
  phone: string;
  institutionId: string;
  departmentId: string;
}

export interface UpdateUserRoleRequest {
  role: AppRole;
}

export interface AuthResponse {
  access_token: string;
  employee: CurrentUserProfile;
}
