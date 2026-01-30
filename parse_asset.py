import urllib.request
import json

# 获取资产信息
url = "http://localhost:8000/api/v1/assets/search?query=SN456789123"
response = urllib.request.urlopen(url)
data = json.loads(response.read())

# 显示资产详细信息
if data:
    asset = data[0]  # 取第一个结果
    print("资产详细信息:")
    print("=" * 50)
    print(f"SN: {asset['sn']}")
    print(f"品牌: {asset['brand']}")
    print(f"型号: {asset['model']}")
    print(f"BMC IP: {asset['bmc_ip']}")
    print(f"使用人: {asset['user']}")
    print(f"系统IP: {asset['system_ip']}")
    print(f"状态: {asset['status']}")
    print(f"部门: {asset.get('department', '未指定')}")
    print("=" * 50)
else:
    print("未找到资产")