import sqlite3
import os

# 连接到SQLite数据库
db_path = os.path.join(os.path.dirname(__file__), 'backend', 'server_management.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 查询资产表
print("资产表内容:")
cursor.execute("SELECT * FROM assets;")
assets = cursor.fetchall()

# 获取列名
column_names = [description[0] for description in cursor.description]
print("列名:", column_names)
print("资产数据:")
for asset in assets:
    print(asset)

print("\n资产历史记录表内容:")
cursor.execute("SELECT * FROM asset_history;")
histories = cursor.fetchall()

# 获取列名
column_names = [description[0] for description in cursor.description]
print("列名:", column_names)
print("历史记录数据:")
for history in histories:
    print(history)

# 关闭连接
conn.close()