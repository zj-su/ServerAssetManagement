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
    
    # 检查并添加deleted_at字段
    with engine.connect() as conn:
        # 查询表结构，检查是否已有deleted_at字段
        try:
            # 尝试查询deleted_at字段
            result = conn.execute(text("PRAGMA table_info(assets)"))
            columns = result.fetchall()
            column_names = [column[1] for column in columns]
            
            if 'deleted_at' not in column_names:
                # 添加deleted_at字段
                conn.execute(text('ALTER TABLE assets ADD COLUMN deleted_at DATETIME'))
                conn.commit()
                print("成功添加deleted_at字段到assets表")
            else:
                print("assets表已包含deleted_at字段")
        except Exception as e:
            print(f"检查或更新数据库时出错: {e}")

if __name__ == "__main__":
    update_database()