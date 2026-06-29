export interface LoginCredentials {
  user_id: string;
  password: string;
  force?: boolean;
}

export interface User {
  id: number;
  user_id: string;
  e_code: string | null;
  name: string;
  user_status: string; // active, locked, disabled
  date_of_joining: string | null;
  date_of_birth: string | null;
  e_upkaran_id: string | null;
  grade: string | null;
  district: string | null;
  zone: string | null;
  manager: string | null;
  zonal_manager: string | null;
  coordinator: string | null;
  mobile_number: string | null;
  mail_id: string | null;
  designation: string | null;
  role: string;
  type: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
  bootstrap_data?: any;
}

export interface OTPResponse {
  message: string;
  masked_email: string;
}

export interface DropdownData {
  designations: string[];
  zones: Record<string, string[]>;
  roles: string[];
  grades?: string[];
}

export interface ProfileUpdateRequest {
  mobile_number: string;
  mail_id: string;
  profile_pic_url?: string;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
  confirm_password: string;
}
