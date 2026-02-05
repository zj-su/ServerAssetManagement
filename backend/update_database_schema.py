#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库表结构更新脚本
为现有表添加新字段，创建新表
"""
import sqlite3
import os
from pathlib import Path

def update_database():
    """更新数据库表结构（与 app.core.config 默认路径一致：backend/server_management.db）"""
    base = Path(__file__).resolve().parent
    db_path = base / "server_management.db"
    if not db_path.exists():
        db_path = base / "app" / "server_management.db"
    if not db_path.exists():
        print("数据库文件不存在，启动应用时会自动创建")
        return
    print(f"使用数据库: {db_path}")
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        # 检查users表是否存在新字段
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        
        # 添加新字段（如果不存在）
        if 'is_ad_user' not in columns:
            print("添加 is_ad_user 字段...")
            cursor.execute("ALTER TABLE users ADD COLUMN is_ad_user BOOLEAN DEFAULT 0")
        
        if 'ad_dn' not in columns:
            print("添加 ad_dn 字段...")
            cursor.execute("ALTER TABLE users ADD COLUMN ad_dn VARCHAR")
        
        if 'display_name' not in columns:
            print("添加 display_name 字段...")
            cursor.execute("ALTER TABLE users ADD COLUMN display_name VARCHAR")
        
        if 'updated_at' not in columns:
            print("添加 updated_at 字段...")
            cursor.execute("ALTER TABLE users ADD COLUMN updated_at DATETIME")
        
        # 检查 assets 表是否缺少文档 5.1 中的字段
        cursor.execute("PRAGMA table_info(assets)")
        asset_columns = [col[1] for col in cursor.fetchall()]
        for col_name, col_def in [
            ('asset_code', 'VARCHAR'),
            ('contract_number', 'VARCHAR'),
            ('purchased_with_server_sn', 'VARCHAR'),
            ('remark', 'TEXT'),
            ('cpu_model', 'VARCHAR'),
            ('cpu_cores', 'INTEGER'),
            ('memory_gb', 'INTEGER'),
            ('disk_info', 'TEXT'),
            ('part_type', 'VARCHAR'),
            ('capacity', 'VARCHAR'),
            ('capacity_unit', 'VARCHAR'),
            ('frequency', 'VARCHAR'),
            ('frequency_unit', 'VARCHAR'),
            ('interface_type', 'VARCHAR'),
            ('spec', 'VARCHAR'),
        ]:
            if col_name not in asset_columns:
                print(f"添加 assets.{col_name} 字段...")
                cursor.execute(f"ALTER TABLE assets ADD COLUMN {col_name} {col_def}")
        # 为 asset_code 为空的资产回填配件编码 SY-PT-0001 起
        cursor.execute("PRAGMA table_info(assets)")
        asset_cols = [c[1] for c in cursor.fetchall()]
        if 'asset_code' in asset_cols:
            cursor.execute("SELECT id, asset_code FROM assets WHERE asset_code IS NULL OR asset_code = '' ORDER BY id")
            need_fill = cursor.fetchall()
            if need_fill:
                import re
                cursor.execute("SELECT asset_code FROM assets WHERE asset_code IS NOT NULL AND asset_code != '' AND asset_code LIKE 'SY-PT-%'")
                existing = [r[0] for r in cursor.fetchall()]
                numbers = []
                for ac in existing:
                    m = re.match(r"^SY-PT-(\d+)$", ac, re.IGNORECASE)
                    if m:
                        numbers.append(int(m.group(1)))
                next_num = (max(numbers) + 1) if numbers else 1
                for (aid, _) in need_fill:
                    code = f"SY-PT-{next_num:04d}"
                    cursor.execute("UPDATE assets SET asset_code = ? WHERE id = ?", (code, aid))
                    next_num += 1
                print(f"已为 {len(need_fill)} 条资产记录回填配件资产编码")
        
        # 检查receipts表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='receipts'")
        if not cursor.fetchone():
            print("创建 receipts 表...")
            cursor.execute("""
                CREATE TABLE receipts (
                    id INTEGER PRIMARY KEY,
                    receipt_number VARCHAR UNIQUE NOT NULL,
                    receipt_type VARCHAR NOT NULL,
                    status VARCHAR DEFAULT 'draft',
                    operator VARCHAR NOT NULL,
                    remark TEXT,
                    asset_count INTEGER DEFAULT 0,
                    created_at DATETIME,
                    updated_at DATETIME,
                    submitted_at DATETIME
                )
            """)
        else:
            # 为已有 receipts 表增加 status、submitted_at（业界做法：草稿→已入库）
            cursor.execute("PRAGMA table_info(receipts)")
            receipt_cols = [c[1] for c in cursor.fetchall()]
            if 'status' not in receipt_cols:
                print("添加 receipts.status 字段...")
                cursor.execute("ALTER TABLE receipts ADD COLUMN status VARCHAR DEFAULT 'draft'")
            if 'submitted_at' not in receipt_cols:
                print("添加 receipts.submitted_at 字段...")
                cursor.execute("ALTER TABLE receipts ADD COLUMN submitted_at DATETIME")
        
        # 检查receipt_items表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='receipt_items'")
        if not cursor.fetchone():
            print("创建 receipt_items 表...")
            cursor.execute("""
                CREATE TABLE receipt_items (
                    id INTEGER PRIMARY KEY,
                    receipt_id INTEGER NOT NULL,
                    asset_id INTEGER NOT NULL,
                    created_at DATETIME,
                    FOREIGN KEY (receipt_id) REFERENCES receipts(id),
                    FOREIGN KEY (asset_id) REFERENCES assets(id)
                )
            """)
        
        # 检查ad_config表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='ad_config'")
        if not cursor.fetchone():
            print("创建 ad_config 表...")
            cursor.execute("""
                CREATE TABLE ad_config (
                    id INTEGER PRIMARY KEY,
                    enabled BOOLEAN DEFAULT 0,
                    server VARCHAR,
                    domain VARCHAR,
                    base_dn VARCHAR,
                    bind_user VARCHAR,
                    bind_password VARCHAR,
                    user_search_base VARCHAR,
                    group_search_base VARCHAR,
                    use_ssl BOOLEAN DEFAULT 0,
                    use_tls BOOLEAN DEFAULT 1,
                    description TEXT,
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """)
        
        # 服务器资产表 servers：补充字段（资产编码、序列号、品牌、型号、BMC、使用人、系统账号密码、U位、部门、合同、日期、备注等）
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='servers'")
        if cursor.fetchone():
            cursor.execute("PRAGMA table_info(servers)")
            server_cols = [c[1] for c in cursor.fetchall()]
            for col_name, col_def in [
                ('asset_code', 'VARCHAR'),
                ('serial_number', 'VARCHAR'),
                ('brand', 'VARCHAR'),
                ('model', 'VARCHAR'),
                ('bmc_password', 'VARCHAR'),
                ('user_person', 'VARCHAR'),
                ('system_username', 'VARCHAR'),
                ('system_password', 'VARCHAR'),
                ('u_position', 'VARCHAR'),
                ('u_height', 'INTEGER'),
                ('department', 'VARCHAR'),
                ('contract_number', 'VARCHAR'),
                ('purchase_date', 'DATE'),
                ('warranty_expire', 'DATE'),
                ('remark', 'TEXT'),
            ]:
                if col_name not in server_cols:
                    print(f"添加 servers.{col_name} 字段...")
                    cursor.execute(f"ALTER TABLE servers ADD COLUMN {col_name} {col_def}")
            # 为 asset_code 为空的服务器回填资产编码 SY-SR-0001 起（按 id 顺序，且不覆盖已有编码）
            cursor.execute("PRAGMA table_info(servers)")
            server_cols = [c[1] for c in cursor.fetchall()]
            if 'asset_code' in server_cols:
                cursor.execute("SELECT id, asset_code FROM servers WHERE asset_code IS NULL OR asset_code = '' ORDER BY id")
                need_fill = cursor.fetchall()
                if need_fill:
                    cursor.execute("SELECT asset_code FROM servers WHERE asset_code IS NOT NULL AND asset_code != '' AND asset_code LIKE 'SY-SR-%'")
                    existing = [r[0] for r in cursor.fetchall()]
                    import re
                    numbers = []
                    for ac in existing:
                        m = re.match(r"^SY-SR-(\d+)$", ac, re.IGNORECASE)
                        if m:
                            numbers.append(int(m.group(1)))
                    next_num = (max(numbers) + 1) if numbers else 1
                    for (sid, _) in need_fill:
                        code = f"SY-SR-{next_num:04d}"
                        cursor.execute("UPDATE servers SET asset_code = ? WHERE id = ?", (code, sid))
                        next_num += 1
                    print(f"已为 {len(need_fill)} 条服务器记录回填资产编码")
            # 若原表为 NOT NULL 的 hostname/ip_address，SQLite 无法直接改，仅确保新列存在
        else:
            print("servers 表不存在，由 SQLAlchemy 创建时将包含新字段")
        
        # 检查 server_history 表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='server_history'")
        if not cursor.fetchone():
            print("创建 server_history 表...")
            cursor.execute("""
                CREATE TABLE server_history (
                    id INTEGER PRIMARY KEY,
                    server_id INTEGER,
                    date DATETIME,
                    action VARCHAR NOT NULL,
                    operator VARCHAR NOT NULL,
                    remark TEXT,
                    created_at DATETIME,
                    FOREIGN KEY (server_id) REFERENCES servers(id)
                )
            """)
        
        conn.commit()
        print("✓ 数据库表结构更新完成")
        
    except Exception as e:
        print(f"✗ 更新数据库时出错: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    update_database()
