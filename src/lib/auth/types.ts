export type AppRole = 'Admin' | 'Safety Officer' | 'Reporter';

export interface DecodedJwtPayload {
  sub: string;
  email: string;
  is_safety_officer: boolean;
  is_admin: boolean;
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
  isSafetyOfficer: boolean;
  isAdmin: boolean;
  department: DepartmentReference | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  isSafetyOfficer: boolean;
  isAdmin: boolean;
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
  isAdmin: boolean;
}

export interface AuthResponse {
  access_token: string;
  employee: CurrentUserProfile;
}
