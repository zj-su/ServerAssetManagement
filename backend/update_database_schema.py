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
    """更新数据库表结构（与项目介绍 5.1 一致）"""
    base = Path(__file__).parent
    # 支持 backend/server_management.db 或 backend/app/server_management.db
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
        ]:
            if col_name not in asset_columns:
                print(f"添加 assets.{col_name} 字段...")
                cursor.execute(f"ALTER TABLE assets ADD COLUMN {col_name} {col_def}")
        
        # 检查receipts表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='receipts'")
        if not cursor.fetchone():
            print("创建 receipts 表...")
            cursor.execute("""
                CREATE TABLE receipts (
                    id INTEGER PRIMARY KEY,
                    receipt_number VARCHAR UNIQUE NOT NULL,
                    receipt_type VARCHAR NOT NULL,
                    operator VARCHAR NOT NULL,
                    remark TEXT,
                    asset_count INTEGER DEFAULT 0,
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """)
        
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
        
        conn.commit()
        print("✓ 数据库表结构更新完成")
        
    except Exception as e:
        print(f"✗ 更新数据库时出错: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    update_database()
