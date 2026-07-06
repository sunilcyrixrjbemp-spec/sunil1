from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List, Dict
from datetime import date, datetime

class UserLogin(BaseModel):
    user_id: str
    password: str
    force: Optional[bool] = False

class UserResponse(BaseModel):
    id: int
    user_id: str
    e_code: Optional[str] = None
    name: str
    user_status: str
    date_of_joining: Optional[date] = None
    date_of_birth: Optional[date] = None
    e_upkaran_id: Optional[str] = None
    grade: Optional[str] = None
    district: Optional[str] = None
    zone: Optional[str] = None
    manager: Optional[str] = None
    zonal_manager: Optional[str] = None
    coordinator: Optional[str] = None
    failed_attempt: int
    mobile_number: Optional[str] = None
    mail_id: Optional[str] = None
    designation: Optional[str] = None
    role: str
    type: Optional[str] = None
    allowed_windows: Optional[str] = None
    profile_pic_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse
    bootstrap_data: Optional[dict] = None

class ForgotPasswordRequest(BaseModel):
    user_id: str
    date_of_birth: str  # YYYY-MM-DD format (ISO)

class VerifyOTPRequest(BaseModel):
    user_id: str
    otp: str
    otp_type: str  # reset_password or unlock_account

class ResetPasswordRequest(BaseModel):
    user_id: str
    otp: str
    new_password: str
    confirm_password: str

class UnlockAccountRequest(BaseModel):
    user_id: str
    date_of_joining: str  # YYYY-MM-DD format
    date_of_birth: str    # YYYY-MM-DD format

class OTPResponse(BaseModel):
    message: str
    masked_email: str

class DropdownResponse(BaseModel):
    designations: List[str]
    zones: Dict[str, List[str]]
    roles: List[str]
    grades: List[str]

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class ProfileUpdateRequest(BaseModel):
    mobile_number: Optional[str] = None
    mail_id: Optional[str] = None
    profile_pic_url: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
    confirm_password: str

class UserCreateRequest(BaseModel):
    e_code: str
    name: str
    password: str
    role: str
    designation: str
    grade: str
    district: str
    zone: str
    manager: str
    zonal_manager: str
    coordinator: str
    mobile_number: str
    mail_id: str
    type: str
    date_of_joining: date
    date_of_birth: date
    e_upkaran_id: str
    allowed_windows: Optional[str] = "home,approval,expense,analysis,report,help,profile"

    @field_validator("date_of_joining", "date_of_birth", mode="before")
    @classmethod
    def parse_dates(cls, v):
        if not v:
            return None
        if isinstance(v, (date, datetime)):
            return v
        if isinstance(v, str):
            v_clean = v.strip()
            if not v_clean:
                return None
            formats = [
                "%Y-%m-%d",
                "%d-%m-%Y",
                "%d/%m/%Y",
                "%Y/%m/%d",
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(v_clean, fmt).date()
                except ValueError:
                    continue
            raise ValueError(f"Invalid date format: '{v}'. Expected YYYY-MM-DD, DD-MM-YYYY, or DD/MM/YYYY.")
        return v

class UserEditRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    designation: Optional[str] = None
    grade: Optional[str] = None
    district: Optional[str] = None
    zone: Optional[str] = None
    manager: Optional[str] = None
    zonal_manager: Optional[str] = None
    coordinator: Optional[str] = None
    mobile_number: Optional[str] = None
    mail_id: Optional[str] = None
    user_status: Optional[str] = None # active, locked, disabled
    type: Optional[str] = None
    allowed_windows: Optional[str] = None
    date_of_joining: Optional[date] = None
    date_of_birth: Optional[date] = None
    e_upkaran_id: Optional[str] = None
    new_user_id: Optional[str] = None
    new_e_code: Optional[str] = None
    password: Optional[str] = None
    admin_update_password: Optional[str] = None

    @field_validator("date_of_joining", "date_of_birth", mode="before")
    @classmethod
    def parse_dates(cls, v):
        if not v:
            return None
        if isinstance(v, (date, datetime)):
            return v
        if isinstance(v, str):
            v_clean = v.strip()
            if not v_clean:
                return None
            formats = [
                "%Y-%m-%d",
                "%d-%m-%Y",
                "%d/%m/%Y",
                "%Y/%m/%d",
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(v_clean, fmt).date()
                except ValueError:
                    continue
            raise ValueError(f"Invalid date format: '{v}'. Expected YYYY-MM-DD, DD-MM-YYYY, or DD/MM/YYYY.")
        return v

class HierarchyApproverSchema(BaseModel):
    id: Optional[int] = None
    level_number: int
    approver_id: int
    approver_name: Optional[str] = None
    approver_code: Optional[str] = None
    approver_role: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class HierarchyRequesterSchema(BaseModel):
    id: Optional[int] = None
    user_id: int
    user_name: Optional[str] = None
    user_code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ApprovalHierarchyResponse(BaseModel):
    id: int
    name: str
    requesters: List[HierarchyRequesterSchema]
    approvers: List[HierarchyApproverSchema]

    model_config = ConfigDict(from_attributes=True)

class ApprovalHierarchyCreateRequest(BaseModel):
    id: Optional[int] = None
    name: str
    requester_ids: List[int]
    approvers: List[Dict[str, int]] # e.g. [{"level_number": 1, "approver_id": 4}]

class BulkHierarchyRow(BaseModel):
    hierarchy_name: str
    requester_e_codes: Optional[str] = ""
    level_1_approver: Optional[str] = ""
    level_2_approver: Optional[str] = ""
    level_3_approver: Optional[str] = ""
    level_4_approver: Optional[str] = ""
    level_5_approver: Optional[str] = ""

class BulkHierarchyImportRequest(BaseModel):
    rows: List[BulkHierarchyRow]

