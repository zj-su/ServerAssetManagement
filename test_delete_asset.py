import requests
import json

# API基础URL
BASE_URL = "http://localhost:8000/api/v1"

def test_delete_asset():
    """测试删除资产功能"""
    try:
        # 首先获取所有资产，选择第一个进行删除
        response = requests.get(f"{BASE_URL}/assets")
        if response.status_code == 200:
            assets = response.json()
            if len(assets) > 0:
                asset_to_delete = assets[0]
                asset_id = asset_to_delete['id']
                print(f"准备删除资产: {asset_to_delete['sn']} (ID: {asset_id})")
                
                # 尝试删除资产
                delete_response = requests.delete(f"{BASE_URL}/assets/{asset_id}")
                if delete_response.status_code == 204:
                    print("✓ 资产删除成功!")
                else:
                    print(f"✗ 资产删除失败: {delete_response.status_code}")
                    print(delete_response.text)
            else:
                print("没有可删除的资产")
        else:
            print(f"获取资产列表失败: {response.status_code}")
            
    except Exception as e:
        print(f"删除资产时发生错误: {str(e)}")

if __name__ == "__main__":
    test_delete_asset()