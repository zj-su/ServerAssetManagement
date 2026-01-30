import requests
import json

# API基础URL
BASE_URL = "http://localhost:8000/api/v1"

# 示例服务器数据
sample_servers = [
    {
        "hostname": "web-server-001",
        "ip_address": "192.168.1.101",
        "mac_address": "00:11:22:33:44:55",
        "bmc_ip": "192.168.1.201",
        "cpu_model": "Intel Xeon Silver",
        "cpu_cores": 8,
        "memory_gb": 32,
        "disk_info": '{"ssd": "1TB"}',
        "status": "online"
    },
    {
        "hostname": "db-server-001",
        "ip_address": "192.168.1.102",
        "mac_address": "00:11:22:33:44:56",
        "bmc_ip": "192.168.1.202",
        "cpu_model": "AMD EPYC 7000",
        "cpu_cores": 16,
        "memory_gb": 64,
        "disk_info": '{"ssd": "2TB", "hdd": "4TB"}',
        "status": "online"
    },
    {
        "hostname": "app-server-001",
        "ip_address": "192.168.1.103",
        "mac_address": "00:11:22:33:44:57",
        "bmc_ip": "192.168.1.203",
        "cpu_model": "Intel Xeon Gold",
        "cpu_cores": 12,
        "memory_gb": 48,
        "disk_info": '{"ssd": "512GB"}',
        "status": "maintenance"
    },
    {
        "hostname": "backup-server-001",
        "ip_address": "192.168.1.104",
        "mac_address": "00:11:22:33:44:58",
        "bmc_ip": "192.168.1.204",
        "cpu_model": "Intel Xeon Bronze",
        "cpu_cores": 4,
        "memory_gb": 16,
        "disk_info": '{"hdd": "8TB"}',
        "status": "offline"
    }
]

def add_sample_servers():
    """添加示例服务器数据"""
    print("正在添加示例服务器数据...")
    
    for i, server_data in enumerate(sample_servers, 1):
        try:
            response = requests.post(
                f"{BASE_URL}/servers",
                headers={"Content-Type": "application/json"},
                data=json.dumps(server_data)
            )
            
            if response.status_code == 200:
                print(f"✓ 成功添加服务器 {server_data['hostname']}")
            else:
                print(f"✗ 添加服务器 {server_data['hostname']} 失败: {response.status_code}")
                print(response.text)
                
        except Exception as e:
            print(f"✗ 添加服务器 {server_data['hostname']} 时发生错误: {str(e)}")
    
    print("示例数据添加完成!")

def get_servers():
    """获取所有服务器"""
    try:
        response = requests.get(f"{BASE_URL}/servers")
        if response.status_code == 200:
            servers = response.json()
            print(f"\n当前共有 {len(servers)} 台服务器:")
            for server in servers:
                print(f"- {server['hostname']} ({server['ip_address']}) - 状态: {server['status']}")
        else:
            print(f"获取服务器列表失败: {response.status_code}")
    except Exception as e:
        print(f"获取服务器列表时发生错误: {str(e)}")

if __name__ == "__main__":
    add_sample_servers()
    get_servers()