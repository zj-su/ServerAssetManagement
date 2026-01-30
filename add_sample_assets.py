import requests
import json
from datetime import datetime

# API基础URL
BASE_URL = "http://localhost:8000/api/v1"

# 示例资产数据
sample_assets = [
    {
        "sn": "SN123456789",
        "model": "PowerEdge R740",
        "brand": "Dell",
        "bmc_ip": "192.168.1.100",
        "user": "张三",
        "system_ip": "192.168.10.10",
        "system_username": "admin",
        "system_password": "password123",
        "u_position": "10-11",
        "u_height": 2,
        "purchase_date": "2023-01-15T00:00:00",
        "warranty_expiry": "2026-01-15T00:00:00",
        "status": "in_use",
        "location": "A机柜-U10",
        "department": "研发部"
    },
    {
        "sn": "SN987654321",
        "model": "ProLiant DL380",
        "brand": "HP",
        "bmc_ip": "192.168.1.101",
        "user": "李四",
        "system_ip": "192.168.10.11",
        "system_username": "root",
        "system_password": "root123",
        "u_position": "15-20",
        "u_height": 6,
        "purchase_date": "2022-05-20T00:00:00",
        "warranty_expiry": "2025-05-20T00:00:00",
        "status": "in_use",
        "location": "A机柜-U15",
        "department": "运维部"
    },
    {
        "sn": "SN456789123",
        "model": "ThinkSystem SR650",
        "brand": "Lenovo",
        "bmc_ip": "192.168.1.102",
        "user": "",
        "system_ip": "",
        "system_username": "",
        "system_password": "",
        "u_position": "",
        "u_height": 2,
        "purchase_date": "2023-08-10T00:00:00",
        "warranty_expiry": "2026-08-10T00:00:00",
        "status": "idle",
        "location": "仓库",
        "department": "采购部"
    }
]

def add_sample_assets():
    """添加示例资产数据"""
    print("正在添加示例资产数据...")
    
    for i, asset_data in enumerate(sample_assets, 1):
        try:
            response = requests.post(
                f"{BASE_URL}/assets",
                headers={"Content-Type": "application/json"},
                data=json.dumps(asset_data)
            )
            
            if response.status_code == 200:
                print(f"✓ 成功添加资产 {asset_data['sn']}")
            else:
                print(f"✗ 添加资产 {asset_data['sn']} 失败: {response.status_code}")
                print(response.text)
                
        except Exception as e:
            print(f"✗ 添加资产 {asset_data['sn']} 时发生错误: {str(e)}")
    
    print("示例资产数据添加完成!")

def get_assets():
    """获取所有资产"""
    try:
        response = requests.get(f"{BASE_URL}/assets")
        if response.status_code == 200:
            assets = response.json()
            print(f"\n当前共有 {len(assets)} 个资产:")
            for asset in assets:
                print(f"- {asset['sn']} ({asset['model']}) - 状态: {asset['status']}")
        else:
            print(f"获取资产列表失败: {response.status_code}")
    except Exception as e:
        print(f"获取资产列表时发生错误: {str(e)}")

if __name__ == "__main__":
    add_sample_assets()
    get_assets()