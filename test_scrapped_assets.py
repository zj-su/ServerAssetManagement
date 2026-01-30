import requests

def test_scrapped_assets_api():
    url = "http://localhost:8000/api/v1/assets/scrapped"
    
    try:
        response = requests.get(url)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_scrapped_assets_api()