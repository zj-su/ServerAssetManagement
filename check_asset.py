import requests
import json

# 搜索特定资产
response = requests.get("http://localhost:8000/api/v1/assets/search?query=SN456789123")
assets = response.json()

print("搜索结果:")
print(json.dumps(assets, indent=2, ensure_ascii=False))

# 检查资产在各个分类中的情况
categories = [
    ("在线资产", "in_storage,in_use,maintenance"),
    ("资产待报废", "pending_scrap"),
    ("报废资产", "scrapped"),
    ("删除回收站", "deleted")
]

for name, status_filter in categories:
    url = f"http://localhost:8000/api/v1/assets?status_filter={status_filter}"
    response = requests.get(url)
    assets_in_category = response.json()
    print(f"\n{name} ({status_filter}):")
    print(json.dumps(assets_in_category, indent=2, ensure_ascii=False))