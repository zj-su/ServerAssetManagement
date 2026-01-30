import requests

def test_assets_api():
    url = "http://localhost:8000/api/v1/assets/"
    params = {
        "status_filter": "in_storage,in_use,maintenance"
    }
    
    try:
        response = requests.get(url, params=params)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_assets_api()