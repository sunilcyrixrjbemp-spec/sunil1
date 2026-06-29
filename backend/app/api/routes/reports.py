from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.config.database import get_db
import openpyxl
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/monthly/{month}")
async def get_monthly_report(month: str, db: Session = Depends(get_db)):
    """Get monthly report"""
    return {"report": {}}

@router.get("/mis-dashboard")
async def get_mis_dashboard_data(db: Session = Depends(get_db)):
    """
    Returns advanced aggregated MIS analytics from rj_penalties table:
    - Daily logged calls
    - Daily closed calls
    - FTFR % (Closed within 24 hours)
    - Equipment-wise penalty
    - Per day penalty (Total sum of per_day_penalty)
    - DI/District wise penalty
    - Coordinator-wise penalty
    - Zone-wise penalty (derived from users mapping or raw fields)
    - Attend penalty (Total sum of attend_penalty)
    """
    try:
        # Check if table exists
        table_exists = db.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='rj_penalties'"
        )).fetchone()
        
        if not table_exists:
            return {
                "success": False,
                "message": "Penalty database not seeded yet.",
                "stats": {}
            }

        # 1. Total Metrics
        totals = db.execute(text("""
            SELECT 
                COUNT(*) as total_calls,
                SUM(CASE WHEN complaint_status = 'Final Closed' OR status = 'Closed' THEN 1 ELSE 0 END) as closed_calls,
                SUM(CASE WHEN is_ftfr = 1 THEN 1 ELSE 0 END) as ftfr_calls,
                SUM(attend_penalty) as total_attend_penalty,
                SUM(delay_penalty) as total_delay_penalty,
                SUM(total_penalty) as total_penalty,
                SUM(per_day_penalty) as total_per_day_penalty
            FROM rj_penalties
        """)).fetchone()
        
        total_calls = totals[0] or 0
        closed_calls = totals[1] or 0
        ftfr_calls = totals[2] or 0
        total_attend = totals[3] or 0.0
        total_delay = totals[4] or 0.0
        total_net_penalty = totals[5] or 0.0
        total_per_day = totals[6] or 0.0
        
        ftfr_percentage = (ftfr_calls * 100.0 / closed_calls) if closed_calls > 0 else 0.0

        # 2. Daily call activity (Last 15 days)
        daily_logged = db.execute(text("""
            SELECT SUBSTR(complaint_raise_date, 1, 10) as day, COUNT(*) as count 
            FROM rj_penalties 
            WHERE complaint_raise_date IS NOT NULL AND complaint_raise_date != ''
            GROUP BY day ORDER BY day DESC LIMIT 15
        """)).fetchall()
        
        daily_closed = db.execute(text("""
            SELECT SUBSTR(complaint_close_date, 1, 10) as day, COUNT(*) as count 
            FROM rj_penalties 
            WHERE complaint_close_date IS NOT NULL AND complaint_close_date != ''
            GROUP BY day ORDER BY day DESC LIMIT 15
        """)).fetchall()

        # 3. Equipment-wise Penalty (Top 8)
        equip_penalty = db.execute(text("""
            SELECT equipment_name, SUM(total_penalty) as total
            FROM rj_penalties
            WHERE equipment_name IS NOT NULL AND equipment_name != ''
            GROUP BY equipment_name
            ORDER BY total DESC LIMIT 8
        """)).fetchall()

        # 4. District / DI wise Penalty (Top 8)
        district_penalty = db.execute(text("""
            SELECT district_name, SUM(total_penalty) as total
            FROM rj_penalties
            WHERE district_name IS NOT NULL AND district_name != ''
            GROUP BY district_name
            ORDER BY total DESC LIMIT 8
        """)).fetchall()

        # 5. Coordinator-wise Penalty (Top 8)
        coord_penalty = db.execute(text("""
            SELECT coordinator_name, SUM(total_penalty) as total
            FROM rj_penalties
            WHERE coordinator_name IS NOT NULL AND coordinator_name != ''
            GROUP BY coordinator_name
            ORDER BY total DESC LIMIT 8
        """)).fetchall()

        # 6. Zone-wise Penalty (Map from district to users or default fallback)
        # Ajmer -> Ajmer, Jaipur -> Jaipur, Udaipur -> Udaipur, Jodhpur -> Jodhpur, Bikaner -> Bikaner, Kota -> Kota
        zone_penalty = db.execute(text("""
            SELECT 
                CASE 
                    WHEN district_name IN ('Ajmer', 'Bhilwara', 'Nagaur', 'Tonk') THEN 'Ajmer'
                    WHEN district_name IN ('Jaipur', 'Alwar', 'Dausa', 'Jhunjhunu', 'Sikar') THEN 'Jaipur'
                    WHEN district_name IN ('Jodhpur', 'Barmer', 'Jaisalmer', 'Jalore', 'Pali', 'Sirohi') THEN 'Jodhpur'
                    WHEN district_name IN ('Bikaner', 'Churu', 'Hanumangarh', 'Sri Ganganagar') THEN 'Bikaner'
                    WHEN district_name IN ('Kota', 'Baran', 'Bundi', 'Jhalawar') THEN 'Kota'
                    WHEN district_name IN ('Udaipur', 'Banswara', 'Chittorgarh', 'Dungarpur', 'Rajsamand') THEN 'Udaipur'
                    ELSE 'Other'
                END as zone_name,
                SUM(total_penalty) as total
            FROM rj_penalties
            WHERE district_name IS NOT NULL AND district_name != ''
            GROUP BY zone_name
            ORDER BY total DESC
        """)).fetchall()

        return {
            "success": True,
            "summary": {
                "total_calls": total_calls,
                "closed_calls": closed_calls,
                "ftfr_percentage": round(ftfr_percentage, 1),
                "total_attend_penalty": round(total_attend, 1),
                "total_delay_penalty": round(total_delay, 1),
                "total_penalty": round(total_net_penalty, 1),
                "total_per_day_penalty": round(total_per_day, 1)
            },
            "daily_activity": {
                "logged": [{"day": r[0], "count": r[1]} for r in daily_logged],
                "closed": [{"day": r[0], "count": r[1]} for r in daily_closed]
            },
            "breakdown": {
                "equipment": [{"name": r[0], "penalty": round(r[1], 1)} for r in equip_penalty],
                "district": [{"name": r[0], "penalty": round(r[1], 1)} for r in district_penalty],
                "coordinator": [{"name": r[0], "penalty": round(r[1], 1)} for r in coord_penalty],
                "zone": [{"name": r[0], "penalty": round(r[1], 1)} for r in zone_penalty]
            }
        }
    except Exception as e:
        logger.error(f"Error fetching MIS dashboard metrics: {str(e)}")
        return {
            "success": False,
            "message": f"Server query error: {str(e)}"
        }

@router.post("/upload-penalties")
async def upload_excel_penalties(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Accepts the uploaded Rajasthan Penalty-Cyrix Excel sheet,
    parses it in memory, and bulk-inserts all rows into the rj_penalties table.
    """
    if not file.filename.endswith(('.xlsx', '.xlsm')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx or .xlsm) are supported.")
        
    try:
        # Create table SQL
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS rj_penalties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sno TEXT,
            district_name TEXT,
            hospital_type TEXT,
            hospital_name TEXT,
            bar_code TEXT,
            equipment_name TEXT,
            equipment_model TEXT,
            complaint_id TEXT,
            complaint_raise_date TEXT,
            complaint_close_date TEXT,
            complaint_status TEXT,
            total_downtime REAL,
            estimated_cost REAL,
            penalty_days REAL,
            complaint_final_close TEXT,
            attend_date TEXT,
            attend_penalty REAL,
            delay_penalty REAL,
            total_penalty REAL,
            is_under_warranty TEXT,
            service_provider_name TEXT,
            status TEXT,
            equipment_type TEXT,
            asset_value REAL,
            complaint_logged_date TEXT,
            call_attend_hour_diff REAL,
            attented_per_day REAL,
            penalty_start_date TEXT,
            penalty_end_date TEXT,
            penalty_down_days REAL,
            penalty_slab REAL,
            penalty REAL,
            per_day_penalty REAL,
            total_penalty_calc REAL,
            total_per_day REAL,
            month_text TEXT,
            di_name TEXT,
            open_date TEXT,
            close_date TEXT,
            attend_delay_minutes REAL,
            same_day_close TEXT,
            standby TEXT,
            coordinator_name TEXT,
            final_close_month TEXT,
            close_month TEXT,
            eight_digit_code TEXT,
            open_days REAL,
            is_ftfr INTEGER DEFAULT 0
        );
        """
        db.execute(text(create_table_sql))
        db.execute(text("DELETE FROM rj_penalties"))
        db.commit()

        # Parse Excel from file stream
        contents = await file.read()
        import io
        from tempfile import NamedTemporaryFile
        
        # Write to temporary file so openpyxl read_only can open it
        with NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
            
        wb = openpyxl.load_workbook(tmp_path, read_only=True, data_only=True)
        if 'Penalty File' not in wb.sheetnames:
            os.unlink(tmp_path)
            raise HTTPException(status_code=400, detail="Sheet 'Penalty File' not found in workbook.")
            
        sheet = wb['Penalty File']
        rows_iter = sheet.iter_rows(values_only=True)
        headers = next(rows_iter)

        def parse_date_to_iso(val):
            if not val:
                return None
            val = str(val).strip()
            formats = [
                "%d-%b-%Y %H:%M:%S",
                "%Y-%m-%d %H:%M:%S",
                "%d-%b-%y %H:%M:%S",
                "%d-%b-%y",
                "%d-%b-%Y",
                "%Y-%m-%d"
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(val, fmt)
                except Exception:
                    continue
            return None

        def safe_float(val):
            try:
                if val is None:
                    return 0.0
                return float(val)
            except Exception:
                return 0.0

        records = []
        row_count = 0
        
        for row in rows_iter:
            if row[0] is None:
                continue
                
            raise_raw = row[8]
            close_raw = row[9]
            raise_dt = parse_date_to_iso(raise_raw)
            close_dt = parse_date_to_iso(close_raw)
            
            complaint_raise_date = raise_dt.strftime("%Y-%m-%d %H:%M:%S") if raise_dt else (str(raise_raw) if raise_raw else "")
            complaint_close_date = close_dt.strftime("%Y-%m-%d %H:%M:%S") if close_dt else (str(close_raw) if close_raw else "")
            
            is_ftfr = 0
            if raise_dt and close_dt:
                diff_hours = (close_dt - raise_dt).total_seconds() / 3600.0
                if diff_hours <= 24.0:
                    is_ftfr = 1

            rec = {
                "sno": str(row[0]),
                "district_name": str(row[1]) if row[1] is not None else "",
                "hospital_type": str(row[2]) if row[2] is not None else "",
                "hospital_name": str(row[3]) if row[3] is not None else "",
                "bar_code": str(row[4]) if row[4] is not None else "",
                "equipment_name": str(row[5]) if row[5] is not None else "",
                "equipment_model": str(row[6]) if row[6] is not None else "",
                "complaint_id": str(row[7]) if row[7] is not None else "",
                "complaint_raise_date": complaint_raise_date,
                "complaint_close_date": complaint_close_date,
                "complaint_status": str(row[10]) if row[10] is not None else "",
                "total_downtime": safe_float(row[11]),
                "estimated_cost": safe_float(row[12]),
                "penalty_days": safe_float(row[13]),
                "complaint_final_close": str(row[14]) if row[14] is not None else "",
                "attend_date": str(row[15]) if row[15] is not None else "",
                "attend_penalty": safe_float(row[16]),
                "delay_penalty": safe_float(row[17]),
                "total_penalty": safe_float(row[18]),
                "is_under_warranty": str(row[19]) if row[19] is not None else "",
                "service_provider_name": str(row[20]) if row[20] is not None else "",
                "status": str(row[21]) if row[21] is not None else "",
                "equipment_type": str(row[23]) if row[23] is not None else "",
                "asset_value": safe_float(row[24]),
                "complaint_logged_date": str(row[25]) if row[25] is not None else "",
                "call_attend_hour_diff": safe_float(row[26]),
                "attented_per_day": safe_float(row[28]) if len(row) > 28 else 0.0,
                "penalty_start_date": str(row[29]) if len(row) > 29 and row[29] is not None else "",
                "penalty_end_date": str(row[30]) if len(row) > 30 and row[30] is not None else "",
                "penalty_down_days": safe_float(row[31]) if len(row) > 31 else 0.0,
                "penalty_slab": safe_float(row[32]) if len(row) > 32 else 0.0,
                "penalty": safe_float(row[33]) if len(row) > 33 else 0.0,
                "per_day_penalty": safe_float(row[34]) if len(row) > 34 else 0.0,
                "total_penalty_calc": safe_float(row[35]) if len(row) > 35 else 0.0,
                "total_per_day": safe_float(row[36]) if len(row) > 36 else 0.0,
                "month_text": str(row[41]) if len(row) > 41 and row[41] is not None else "",
                "di_name": str(row[42]) if len(row) > 42 and row[42] is not None else "",
                "open_date": str(row[43]) if len(row) > 43 and row[43] is not None else "",
                "close_date": str(row[44]) if len(row) > 44 and row[44] is not None else "",
                "attend_delay_minutes": safe_float(row[45]) if len(row) > 45 else 0.0,
                "same_day_close": str(row[46]) if len(row) > 46 and row[46] is not None else "",
                "standby": str(row[48]) if len(row) > 48 and row[48] is not None else "",
                "coordinator_name": str(row[49]) if len(row) > 49 and row[49] is not None else "",
                "final_close_month": str(row[50]) if len(row) > 50 and row[50] is not None else "",
                "close_month": str(row[51]) if len(row) > 51 and row[51] is not None else "",
                "eight_digit_code": str(row[52]) if len(row) > 52 and row[52] is not None else "",
                "open_days": safe_float(row[53]) if len(row) > 53 else 0.0,
                "is_ftfr": is_ftfr
            }
            records.append(rec)
            row_count += 1
            
            # Batch execute insert query to keep memory usage low (stay under SQLite 999 parameter limit)
            if len(records) >= 20:
                columns = list(records[0].keys())
                col_str = ", ".join(columns)
                val_placeholders = []
                params = {}
                for r_idx, r in enumerate(records):
                    row_placeholders = []
                    for k in columns:
                        param_name = f"{k}_{r_idx}"
                        row_placeholders.append(f":{param_name}")
                        params[param_name] = r[k]
                    val_placeholders.append("(" + ", ".join(row_placeholders) + ")")
                insert_sql = f"INSERT INTO rj_penalties ({col_str}) VALUES " + ", ".join(val_placeholders)
                db.execute(text(insert_sql), params)
                db.commit()
                records = []
                
        if records:
            columns = list(records[0].keys())
            col_str = ", ".join(columns)
            val_placeholders = []
            params = {}
            for r_idx, r in enumerate(records):
                row_placeholders = []
                for k in columns:
                    param_name = f"{k}_{r_idx}"
                    row_placeholders.append(f":{param_name}")
                    params[param_name] = r[k]
                val_placeholders.append("(" + ", ".join(row_placeholders) + ")")
            insert_sql = f"INSERT INTO rj_penalties ({col_str}) VALUES " + ", ".join(val_placeholders)
            db.execute(text(insert_sql), params)
            db.commit()
            
        os.unlink(tmp_path)
        return {
            "success": True,
            "message": f"Successfully parsed and synced {row_count} rows of Rajasthan Penalty Cyrix logs."
        }
    except Exception as e:
        logger.error(f"Error parsing uploaded Excel file: {str(e)}")
        return {
            "success": False,
            "message": f"Failed to upload: {str(e)}"
        }

@router.post("/upload-master-data")
async def upload_excel_master_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Accepts the uploaded Rajasthan Penalty-Cyrix Excel sheet,
    parses sheets ('DI Name List', 'Asset Value', 'Critical Equipment', 'Main Hospital'),
    and seeds respective tables (di_name_list, facility_details, asset_value_master, critical_equipment, main_hospitals).
    """
    if not file.filename.endswith(('.xlsx', '.xlsm')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx or .xlsm) are supported.")
        
    try:
        # Create tables SQL
        create_tables_sql = [
            """CREATE TABLE IF NOT EXISTS di_name_list (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                district_name VARCHAR(200),
                hospital_name VARCHAR(255),
                di_name VARCHAR(200),
                coordinator_name VARCHAR(200),
                zone_name VARCHAR(200)
            );""",
            """CREATE TABLE IF NOT EXISTS facility_details (
                facility_name VARCHAR(200) PRIMARY KEY,
                district_name VARCHAR(100),
                facility_incharge VARCHAR(100),
                dm_name VARCHAR(100),
                coordinator_name VARCHAR(100),
                facility_type VARCHAR(50),
                zone_name VARCHAR(50)
            );""",
            """CREATE TABLE IF NOT EXISTS asset_value_master (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                equipment_name VARCHAR(255) UNIQUE,
                rmsc_tender_cost FLOAT
            );""",
            """CREATE TABLE IF NOT EXISTS critical_equipment (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                equipment_name VARCHAR(255) UNIQUE,
                classification VARCHAR(100)
            );""",
            """CREATE TABLE IF NOT EXISTS main_hospitals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hospital_name VARCHAR(255) UNIQUE,
                hospital_type VARCHAR(200),
                sla_category VARCHAR(200)
            );"""
        ]
        
        for sql in create_tables_sql:
            db.execute(text(sql))
        db.commit()

        # Parse Excel from file stream
        contents = await file.read()
        from tempfile import NamedTemporaryFile
        import os
        
        with NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
            
        wb = openpyxl.load_workbook(tmp_path, read_only=True, data_only=True)
        
        # 1. Sync di_name_list and facility_details
        if 'DI Name List' in wb.sheetnames:
            sheet_di = wb['DI Name List']
            rows_di = sheet_di.iter_rows(values_only=True)
            next(rows_di) # skip header
            
            di_list_rows = []
            facility_details_map = {}
            for row in rows_di:
                if row[0] is None:
                    continue
                dist_name = str(row[0]).strip()
                hosp_name = str(row[1]).strip() if row[1] is not None else ""
                di_name = str(row[2]).strip() if row[2] is not None else ""
                coord_name = str(row[3]).strip() if row[3] is not None else ""
                zone_name = str(row[4]).strip() if row[4] is not None else ""
                
                di_list_rows.append({
                    "district_name": dist_name, "hospital_name": hosp_name,
                    "di_name": di_name, "coordinator_name": coord_name, "zone_name": zone_name
                })
                
                fac_type = "PHC"
                hosp_upper = hosp_name.upper()
                if "CHC" in hosp_upper: fac_type = "CHC"
                elif "DH" in hosp_upper or "DISTRICT HOSPITAL" in hosp_upper: fac_type = "DH"
                elif "SUB CENTER" in hosp_upper or "SUBCENTER" in hosp_upper or "SC" in hosp_upper: fac_type = "Sub-Center"
                elif "MEDICAL COLLEGE" in hosp_upper or "MEDICAL HOSPITAL" in hosp_upper: fac_type = "Medical College"
                
                if hosp_name and hosp_name not in facility_details_map:
                    facility_details_map[hosp_name] = {
                        "facility_name": hosp_name, "district_name": dist_name,
                        "facility_incharge": di_name, "dm_name": di_name, "coordinator_name": coord_name,
                        "facility_type": fac_type, "zone_name": zone_name
                    }
            
            # Insert DI Name List (execute row-by-row because D1 driver doesn't support executemany)
            db.execute(text("DELETE FROM di_name_list"))
            for item in di_list_rows:
                db.execute(text("""
                    INSERT INTO di_name_list (district_name, hospital_name, di_name, coordinator_name, zone_name)
                    VALUES (:district_name, :hospital_name, :di_name, :coordinator_name, :zone_name)
                """), item)
            
            # Insert Facility Details (execute row-by-row because D1 driver doesn't support executemany)
            db.execute(text("DELETE FROM facility_details"))
            for item in facility_details_map.values():
                db.execute(text("""
                    INSERT INTO facility_details (facility_name, district_name, facility_incharge, dm_name, coordinator_name, facility_type, zone_name)
                    VALUES (:facility_name, :district_name, :facility_incharge, :dm_name, :coordinator_name, :facility_type, :zone_name)
                """), item)
            db.commit()
            
        # 2. Sync asset_value_master
        if 'Asset Value' in wb.sheetnames:
            sheet_asset = wb['Asset Value']
            rows_asset = sheet_asset.iter_rows(values_only=True)
            next(rows_asset)
            
            seen_assets = set()
            asset_rows = []
            for row in rows_asset:
                if row[0] is None:
                    continue
                equip_name = str(row[0]).strip()
                try:
                    cost = float(row[1]) if row[1] is not None else 0.0
                except Exception:
                    cost = 0.0
                if equip_name not in seen_assets:
                    seen_assets.add(equip_name)
                    asset_rows.append({"equipment_name": equip_name, "rmsc_tender_cost": cost})
                    
            db.execute(text("DELETE FROM asset_value_master"))
            for item in asset_rows:
                db.execute(text("""
                    INSERT INTO asset_value_master (equipment_name, rmsc_tender_cost)
                    VALUES (:equipment_name, :rmsc_tender_cost)
                """), item)
            db.commit()
            
        # 3. Sync critical_equipment
        if 'Critical Equipment' in wb.sheetnames:
            sheet_crit = wb['Critical Equipment']
            rows_crit = sheet_crit.iter_rows(values_only=True)
            next(rows_crit)
            
            seen_crit = set()
            crit_rows = []
            for row in rows_crit:
                if row[0] is None:
                    continue
                equip_name = str(row[0]).strip()
                classification = str(row[1]).strip() if row[1] is not None else "Critical"
                if equip_name not in seen_crit:
                    seen_crit.add(equip_name)
                    crit_rows.append({"equipment_name": equip_name, "classification": classification})
                    
            db.execute(text("DELETE FROM critical_equipment"))
            for item in crit_rows:
                db.execute(text("""
                    INSERT INTO critical_equipment (equipment_name, classification)
                    VALUES (:equipment_name, :classification)
                """), item)
            db.commit()
            
        # 4. Sync main_hospitals
        if 'Main Hospital' in wb.sheetnames:
            sheet_main = wb['Main Hospital']
            rows_main = sheet_main.iter_rows(values_only=True)
            next(rows_main)
            
            seen_main = set()
            main_rows = []
            for row in rows_main:
                if row[0] is None:
                    continue
                hosp_name = str(row[0]).strip()
                hosp_type = str(row[1]).strip() if row[1] is not None else ""
                sla_category = str(row[4]).strip() if row[4] is not None else "MCH"
                if hosp_name not in seen_main:
                    seen_main.add(hosp_name)
                    main_rows.append({"hospital_name": hosp_name, "hospital_type": hosp_type, "sla_category": sla_category})
                    
            db.execute(text("DELETE FROM main_hospitals"))
            for item in main_rows:
                db.execute(text("""
                    INSERT INTO main_hospitals (hospital_name, hospital_type, sla_category)
                    VALUES (:hospital_name, :hospital_type, :sla_category)
                """), item)
            db.commit()
            
        os.unlink(tmp_path)
        return {
            "success": True,
            "message": "Successfully parsed and seeded all master data sheets (DI List, Assets, Main Hospitals)."
        }
    except Exception as e:
        logger.error(f"Error parsing master Excel sheets: {str(e)}")
        return {
            "success": False,
            "message": f"Failed to upload master data: {str(e)}"
        }
