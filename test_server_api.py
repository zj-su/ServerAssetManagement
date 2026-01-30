import requests
import json

# API基础URL
BASE_URL = "http://localhost:8000/api/v1"

def test_create_server():
    """测试创建服务器"""
    server_data = {
        "hostname": "test-server-001",
        "ip_address": "192.168.1.110",
        "mac_address": "00:11:22:33:44:66",
        "bmc_ip": "192.168.1.210",
        "cpu_model": "Intel Xeon Platinum",
        "cpu_cores": 16,
        "memory_gb": 64,
        "disk_info": '{"ssd": "2TB"}',
        "status": "offline"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/servers",
            headers={"Content-Type": "application/json"},
            data=json.dumps(server_data)
        )
        
        if response.status_code == 200:
            print("✓ 服务器创建成功!")
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
            return response.json()['id']
        else:
            print(f"✗ 服务器创建失败: {response.status_code}")
            print(response.text)
            return None
            
    except Exception as e:
        print(f"✗ 创建服务器时发生错误: {str(e)}")
        return None

def test_get_servers():
    """测试获取服务器列表"""
    try:
        response = requests.get(f"{BASE_URL}/servers")
        
        if response.status_code == 200:
            print("\n✓ 服务器列表获取成功!")
            servers = response.json()
            print(f"总共 {len(servers)} 台服务器:")
            for server in servers:
                print(f"  - {server['hostname']} ({server['ip_address']}) - 状态: {server['status']}")
        else:
            print(f"✗ 获取服务器列表失败: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"✗ 获取服务器列表时发生错误: {str(e)}")

def test_update_server(server_id):
    """测试更新服务器"""
    if not server_id:
        print("无法更新服务器：没有有效的服务器ID")
        return
        
    update_data = {
        "hostname": "updated-test-server-001",
        "ip_address": "192.168.1.111",
        "status": "online"
    }
    
    try:
        response = requests.put(
            f"{BASE_URL}/servers/{server_id}",
            headers={"Content-Type": "application/json"},
            data=json.dumps(update_data)
        )
        
        if response.status_code == 200:
            print("\n✓ 服务器更新成功!")
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        else:
            print(f"✗ 服务器更新失败: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"✗ 更新服务器时发生错误: {str(e)}")

def test_delete_server(server_id):
    """测试删除服务器"""
    if not server_id:
        print("无法删除服务器：没有有效的服务器ID")
        return
        
    try:
        response = requests.delete(f"{BASE_URL}/servers/{server_id}")
        
        if response.status_code == 204:  # 删除成功无返回内容
            print("\n✓ 服务器删除成功!")
        elif response.status_code == 200:
            print("\n✓ 服务器删除成功!")
            print(response.json())
        else:
            print(f"✗ 服务器删除失败: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"✗ 删除服务器时发生错误: {str(e)}")

if __name__ == "__main__":
    print("测试服务器API...")
    
    # 创建服务器
    server_id = test_create_server()
    
    # 获取服务器列表
    test_get_servers()
    
    # 更新服务器
    test_update_server(server_id)
    
    # 再次获取服务器列表查看更新效果
    test_get_servers()
    
    # 删除服务器
    test_delete_server(server_id)
    
    # 再次获取服务器列表查看删除效果
    test_get_servers()