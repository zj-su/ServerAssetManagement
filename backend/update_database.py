import os
import sys
from sqlalchemy import create_engine, text

# 添加项目根目录到Python路径
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.core.config import settings

def update_database():
    # 创建数据库引擎
    engine = create_engine(
        settings.SQLALCHEMY_DATABASE_URI,
        connect_args={"check_same_thread": False} if "sqlite" in settings.SQLALCHEMY_DATABASE_URI else {}
    )
    
    with engine.begin() as conn:
        # 检查并添加deleted_at字段
        try:
            # 尝试查询deleted_at字段
            result = conn.execute(text("PRAGMA table_info(assets)"))
            columns = result.fetchall()
            column_names = [column[1] for column in columns]
            
            if 'deleted_at' not in column_names:
                # 添加deleted_at字段
                conn.execute(text('ALTER TABLE assets ADD COLUMN deleted_at DATETIME'))
                print("成功添加deleted_at字段到assets表")
            else:
                print("assets表已包含deleted_at字段")
        except Exception as e:
            print(f"检查或更新数据库时出错: {e}")
        
        # 将配件状态 maintenance 迁移为 idle
        try:
            result = conn.execute(text("SELECT COUNT(*) FROM assets WHERE status = 'maintenance'"))
            count = result.fetchone()[0]
            
            if count > 0:
                conn.execute(text("UPDATE assets SET status = 'idle' WHERE status = 'maintenance'"))
                print(f"成功将 {count} 条配件的状态从 maintenance 更新为 idle")
            else:
                print("没有需要迁移的 maintenance 状态配件")
        except Exception as e:
            print(f"迁移配件状态时出错: {e}")
        
        # 检查并为receipts表添加新字段：purchaser, company, receipt_date
        try:
            result = conn.execute(text("PRAGMA table_info(receipts)"))
            columns = result.fetchall()
            column_names = [column[1] for column in columns]
            
            # 添加 purchaser 字段（采购人）
            if 'purchaser' not in column_names:
                conn.execute(text('ALTER TABLE receipts ADD COLUMN purchaser VARCHAR'))
                print("成功添加 purchaser 字段到 receipts 表")
            else:
                print("receipts 表已包含 purchaser 字段")
            
            # 添加 company 字段（所属/承租公司）
            if 'company' not in column_names:
                conn.execute(text('ALTER TABLE receipts ADD COLUMN company VARCHAR'))
                print("成功添加 company 字段到 receipts 表")
            else:
                print("receipts 表已包含 company 字段")
            
            # 添加 receipt_date 字段（入库日期）
            if 'receipt_date' not in column_names:
                conn.execute(text('ALTER TABLE receipts ADD COLUMN receipt_date DATETIME'))
                print("成功添加 receipt_date 字段到 receipts 表")
            else:
                print("receipts 表已包含 receipt_date 字段")
            
            # 添加 department 字段（资产归属部门）
            if 'department' not in column_names:
                conn.execute(text('ALTER TABLE receipts ADD COLUMN department VARCHAR'))
                print("成功添加 department 字段到 receipts 表")
            else:
                print("receipts 表已包含 department 字段")
                
        except Exception as e:
            print(f"更新 receipts 表时出错: {e}")
        
        # 检查并为servers表添加receipt_id字段（关联入库单）
        try:
            result = conn.execute(text("PRAGMA table_info(servers)"))
            columns = result.fetchall()
            column_names = [column[1] for column in columns]
            
            if 'receipt_id' not in column_names:
                conn.execute(text('ALTER TABLE servers ADD COLUMN receipt_id INTEGER REFERENCES receipts(id)'))
                print("成功添加 receipt_id 字段到 servers 表")
            else:
                print("servers 表已包含 receipt_id 字段")
            
            # 添加 deleted_at 字段（软删除时间）
            if 'deleted_at' not in column_names:
                conn.execute(text('ALTER TABLE servers ADD COLUMN deleted_at DATETIME'))
                print("成功添加 deleted_at 字段到 servers 表")
            else:
                print("servers 表已包含 deleted_at 字段")
                
        except Exception as e:
            print(f"更新 servers 表时出错: {e}")
        
        # 检查并为assets表添加receipt_id字段（关联入库单）
        try:
            result = conn.execute(text("PRAGMA table_info(assets)"))
            columns = result.fetchall()
            column_names = [column[1] for column in columns]
            
            if 'receipt_id' not in column_names:
                conn.execute(text('ALTER TABLE assets ADD COLUMN receipt_id INTEGER REFERENCES receipts(id)'))
                print("成功添加 receipt_id 字段到 assets 表")
            else:
                print("assets 表已包含 receipt_id 字段")
                
        except Exception as e:
            print(f"更新 assets 表（添加 receipt_id）时出错: {e}")

if __name__ == "__main__":
    update_database()