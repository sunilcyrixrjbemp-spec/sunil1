from datetime import date
import logging
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.password_history import PasswordHistory
from app.utils.security import get_password_hash

logger = logging.getLogger(__name__)

def seed_admin_user(db: Session):
    """Seed initial Admin user according to client requirements"""
    from sqlalchemy import text
    
    # Run dynamic manager/zonal_manager/coordinator code-to-name cleanup
    try:
        db.execute(text("""
            UPDATE users 
            SET manager = (SELECT name FROM users AS u WHERE LOWER(u.user_id) = LOWER(users.manager)) 
            WHERE manager IN (SELECT user_id FROM users) OR LOWER(manager) = 'admin'
        """))
        db.execute(text("""
            UPDATE users 
            SET zonal_manager = (SELECT name FROM users AS u WHERE LOWER(u.user_id) = LOWER(users.zonal_manager)) 
            WHERE zonal_manager IN (SELECT user_id FROM users) OR LOWER(zonal_manager) = 'admin'
        """))
        db.execute(text("""
            UPDATE users 
            SET coordinator = (SELECT name FROM users AS u WHERE LOWER(u.user_id) = LOWER(users.coordinator)) 
            WHERE coordinator IN (SELECT user_id FROM users) OR LOWER(coordinator) = 'admin'
        """))
        db.commit()
    except Exception as e:
        logger.warning(f"Error performing manager cleanup migrations: {str(e)}")
        db.rollback()

    admin_id = "Admin"
    existing_admin = db.query(User).filter(User.user_id == admin_id).first()
    
    if not existing_admin:
        logger.info(f"Seeding admin user '{admin_id}' into database...")
        
        # Admin credentials and info requested
        raw_password = "Sunil@9784"
        hashed = get_password_hash(raw_password)
        
        admin = User(
            user_id=admin_id,
            name="Admin System",
            hashed_password=hashed,
            user_status="active",
            date_of_joining=date(2025, 1, 13),  # 13-01-2025
            date_of_birth=date(2003, 7, 10),    # 10-07-2003
            e_upkaran_id=None,                  # Khali chod dena
            grade="A",
            district="All",
            zone="All",
            manager="Admin System",
            zonal_manager="Admin System",
            coordinator="Admin System",
            failed_attempt=0,
            mobile_number="9876543210",
            mail_id="admin@cyrixhealthcare.com",
            designation="Admin",
            role="Admin",
            type="System",
            allowed_windows="home,admin,approval,expense,analysis,report,help,profile"
        )
        db.add(admin)
        db.flush()  # Populates admin.id
        
        # Add to password history
        pwd_hist = PasswordHistory(
            user_id=admin.id,
            hashed_password=hashed
        )
        db.add(pwd_hist)
        
        # Add to user_roles table
        from app.models.user_role import UserRole
        role_entry = UserRole(
            user_id=admin.user_id,
            role="Admin"
        )
        db.add(role_entry)
        
        db.commit()
        logger.info(f"Admin user '{admin_id}' successfully seeded.")
    else:
        logger.info(f"Admin user '{admin_id}' already exists. Ensuring roles entry exists...")
        from app.models.user_role import UserRole
        existing_role = db.query(UserRole).filter(UserRole.user_id == admin_id, UserRole.role == "Admin").first()
        if not existing_role:
            logger.info("Seeding missing Admin role entry...")
            role_entry = UserRole(
                user_id=admin_id,
                role="Admin"
            )
            db.add(role_entry)
            db.commit()
            logger.info("Admin role entry successfully seeded.")
        else:
            logger.info("Admin role entry already exists.")

def seed_approval_levels(db: Session):
    """Seed initial default approval hierarchies if none exist"""
    from app.models.approval_hierarchy import ApprovalHierarchy
    count = db.query(ApprovalHierarchy).count()
    if count == 0:
        logger.info("Seeding default approval hierarchy...")
        default_hq = ApprovalHierarchy(name="General Flow")
        db.add(default_hq)
        db.commit()
        logger.info("Default approval hierarchy seeded successfully.")

def run_schema_updates(db: Session):
    """Safely run ALTER TABLE statements to add new columns to the expenses table if they don't exist"""
    from sqlalchemy.exc import OperationalError
    from sqlalchemy import text
    
    columns_to_add = [
        ("expense_code", "VARCHAR(100)"),
        ("da_amount", "FLOAT DEFAULT 0.0"),
        ("hotel_amount", "FLOAT DEFAULT 0.0"),
        ("other_expense_amount", "FLOAT DEFAULT 0.0"),
        ("calls_assigned", "INTEGER DEFAULT 0"),
        ("calls_completed", "INTEGER DEFAULT 0"),
        ("pms_count", "INTEGER DEFAULT 0"),
        ("asset_tagging", "INTEGER DEFAULT 0"),
    ]
    
    for col_name, col_type in columns_to_add:
        try:
            db.execute(text(f"ALTER TABLE expenses ADD COLUMN {col_name} {col_type}"))
            db.commit()
            logger.info(f"Added column {col_name} to expenses table.")
        except Exception as e:
            db.rollback()
            err_str = str(e).lower()
            if "duplicate column name" in err_str or "already exists" in err_str:
                logger.info(f"Column {col_name} already exists in expenses table.")
            else:
                logger.warning(f"Error checking/adding column {col_name}: {str(e)}")

    # Add active_session_id column to users table
    try:
        db.execute(text("ALTER TABLE users ADD COLUMN active_session_id VARCHAR(255)"))
        db.commit()
        logger.info("Added column active_session_id to users table.")
    except Exception as e:
        db.rollback()
        err_str = str(e).lower()
        if "duplicate column name" in err_str or "already exists" in err_str:
            logger.info("Column active_session_id already exists in users table.")
        else:
            logger.warning(f"Error checking/adding active_session_id: {str(e)}")

    # Add needs_followup column to support_tickets table
    try:
        db.execute(text("ALTER TABLE support_tickets ADD COLUMN needs_followup BOOLEAN DEFAULT 0"))
        db.commit()
        logger.info("Added column needs_followup to support_tickets table.")
    except Exception as e:
        db.rollback()
        err_str = str(e).lower()
        if "duplicate column name" in err_str or "already exists" in err_str:
            logger.info("Column needs_followup already exists in support_tickets table.")
        else:
            logger.warning(f"Error checking/adding needs_followup: {str(e)}")

    # Add performance optimization indexes for SQLite and Cloudflare D1
    indexes_to_create = [
        ("idx_users_manager", "users(manager)"),
        ("idx_users_coordinator", "users(coordinator)"),
        ("idx_users_zonal_manager", "users(zonal_manager)"),
        ("idx_expenses_user_id", "expenses(user_id)"),
        ("idx_expense_itineraries_exp_id", "expense_itineraries(exp_id)"),
        ("idx_approvals_expense_id", "approvals(expense_id)"),
        ("idx_approvals_approver_id", "approvals(approver_id)"),
        ("idx_hierarchy_approvers_approver_id", "hierarchy_approvers(approver_id)"),
        ("idx_hierarchy_requesters_user_id", "hierarchy_requesters(user_id)"),
        ("idx_hierarchy_requesters_hierarchy_id", "hierarchy_requesters(hierarchy_id)"),
        ("idx_hierarchy_approvers_hierarchy_id", "hierarchy_approvers(hierarchy_id)"),
        ("idx_support_tickets_created_by_code", "support_tickets(created_by_code)"),
        ("idx_support_tickets_assigned_to_name", "support_tickets(assigned_to_name)"),
        ("idx_support_tickets_assigned_to_role", "support_tickets(assigned_to_role)"),
        ("idx_support_tickets_status", "support_tickets(status)"),
    ]
    for idx_name, idx_target in indexes_to_create:
        try:
            db.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {idx_target}"))
            db.commit()
            logger.info(f"Created index {idx_name} on {idx_target}.")
        except Exception as e:
            db.rollback()
            logger.warning(f"Error creating index {idx_name}: {str(e)}")

def seed_allowance_master(db: Session):
    """Seed default grade allowances if allowance_master is empty"""
    from app.models.allowance_master import AllowanceMaster
    count = db.query(AllowanceMaster).count()
    if count == 0:
        logger.info("Seeding default allowances...")
        grades = [
            ("A", "Bike", 4.5, 2000, 1500, 250, 400, 350, 600),
            ("B", "Bike", 4.5, 2000, 1500, 250, 400, 350, 600),
            ("C", "Bike", 4.5, 2000, 1200, 200, 350, 300, 500),
            ("D", "Bike", 4.5, 1500, 1000, 150, 300, 250, 400),
            ("E", "None", 0.0, 0, 800, 150, 250, 200, 350),
            ("F", "None", 0.0, 0, 800, 150, 250, 200, 350)
        ]
        for grade, v_type, rate, max_km, hotel_s, da_in, da_out, da_hotel, da_out_state in grades:
            allowance = AllowanceMaster(
                grade=grade,
                level="1",
                category="Field Operations",
                hotel_in_state_s=hotel_s,
                daily_in_district=da_in,
                daily_out_district=da_out,
                daily_hotel=da_hotel,
                daily_out_state=da_out_state,
                vehicle_type=v_type,
                rate_per_km=rate,
                max_km_per_month=max_km
            )
            db.add(allowance)
            db.commit()
        logger.info("Default allowances seeded successfully.")

def seed_facility_details(db: Session):
    """Seed sample facility details if empty"""
    from app.models.facility_detail import FacilityDetail
    count = db.query(FacilityDetail).count()
    if count == 0:
        logger.info("Seeding default facility details...")
        facilities = [
            ("Jodhpur HQ Office", "Jodhpur", "Dr. S. Sharma", "DM Jodhpur", "Coord Jodhpur", "Office", "Jodhpur"),
            ("Jodhpur Satellite Hospital", "Jodhpur", "Dr. A. Verma", "DM Jodhpur", "Coord Jodhpur", "DH", "Jodhpur"),
            ("Ajmer HQ Office", "Ajmer", "Dr. K. Gupta", "DM Ajmer", "Coord Ajmer", "Office", "Ajmer"),
            ("Ajmer District Hospital", "Ajmer", "Dr. R. Singh", "DM Ajmer", "Coord Ajmer", "DH", "Ajmer"),
            ("Bikaner HQ Office", "Bikaner", "Dr. P. Joshi", "DM Bikaner", "Coord Bikaner", "Office", "Bikaner"),
            ("Udaipur HQ Office", "Udaipur", "Dr. M. Sen", "DM Udaipur", "Coord Udaipur", "Office", "Udaipur"),
            ("Pali CHC", "Pali", "Dr. V. Rao", "DM Jodhpur", "Coord Pali", "CHC", "Jodhpur"),
            ("Barmer CHC", "Barmer", "Dr. S. Bhati", "DM Jodhpur", "Coord Barmer", "CHC", "Jodhpur"),
            ("Nagaur CHC", "Nagaur", "Dr. L. Choudhary", "DM Ajmer", "Coord Nagaur", "CHC", "Ajmer")
        ]
        for name, district, incharge, dm, coord, f_type, zone in facilities:
            facility = FacilityDetail(
                facility_name=name,
                district_name=district,
                facility_incharge=incharge,
                dm_name=dm,
                coordinator_name=coord,
                facility_type=f_type,
                zone_name=zone
            )
            db.add(facility)
            db.commit()
        logger.info("Default facilities seeded successfully.")

