import requests
import json

# 测试API是否正常工作
try:
    response = requests.get("http://localhost:8000/")
    print(f"API根路径响应: {response.status_code}")
    print(f"响应内容: {response.json()}")
except Exception as e:
    print(f"测试API根路径时出错: {e}")

# 测试资产API
try:
    response = requests.get("http://localhost:8000/api/v1/assets")
    print(f"\n资产列表API响应: {response.status_code}")
    if response.status_code == 200:
        assets = response.json()
        print(f"当前资产数量: {len(assets)}")
        for asset in assets:
            print(f"  - SN: {asset['sn']}, 型号: {asset['model']}, 状态: {asset['status']}")
    else:
        print(f"获取资产列表失败: {response.text}")
except Exception as e:
    print(f"测试资产API时出错: {e}")

# 添加一个测试资产
test_asset = {
    "sn": "TEST123456",
    "model": "Test Server Model",
    "brand": "TestBrand",
    "bmc_ip": "192.168.1.100",
    "user": "测试用户",
    "system_ip": "192.168.10.10",
    "system_username": "testuser",
    "system_password": "testpass",
    "u_position": "1-2",
    "u_height": 2,
    "purchase_date": "2023-01-01T00:00:00",
    "warranty_expiry": "2026-01-01T00:00:00",
    "status": "idle",
    "location": "测试机柜-U1",
    "department": "测试部"
}

try:
    print("\n尝试添加测试资产...")
    response = requests.post(
        "http://localhost:8000/api/v1/assets",
        headers={"Content-Type": "application/json"},
        data=json.dumps(test_asset)
    )
    print(f"添加资产响应: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"成功添加资产: {result['sn']}")
    else:
        print(f"添加资产失败: {response.text}")
except Exception as e:
    print(f"添加资产时出错: {e}")