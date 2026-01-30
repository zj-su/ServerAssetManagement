import requests
import json

# API基础URL
BASE_URL = "http://localhost:8000/api/v1"

def register_user():
    """注册管理员用户"""
    user_data = {
        "username": "admin",
        "email": "admin@example.com",
        "password": "pass123",  # 使用更短的密码
        "role": "admin"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/users/register",
            headers={"Content-Type": "application/json"},
            data=json.dumps(user_data)
        )
        
        if response.status_code == 200:
            print("✓ 用户注册成功!")
            print(response.json())
        else:
            print(f"✗ 用户注册失败: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"✗ 注册用户时发生错误: {str(e)}")

if __name__ == "__main__":
    register_user()