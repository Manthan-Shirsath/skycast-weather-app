import httpx
import json

def verify_trends():
    client = httpx.Client(timeout=10.0)

    print("=== Testing /api/trends Endpoints ===")
    for r in ["24h", "7d", "30d"]:
        res = client.get(f"http://127.0.0.1:8000/api/trends?city=Pune&range={r}")
        print(f"GET /api/trends?city=Pune&range={r} -> HTTP {res.status_code}")
        data = res.json()
        print("  Status field:", data.get("status"))
        print("  Message:", data.get("message"))
        print("  Count:", data.get("count"))
        print("  Disclaimer:", data.get("disclaimer"))

    print("\n=== Testing Comparison Query ===")
    res_comp = client.get("http://127.0.0.1:8000/api/trends?city=Pune&range=24h&compareWith=Mumbai")
    print(f"GET /api/trends?city=Pune&compareWith=Mumbai -> HTTP {res_comp.status_code}")
    data_comp = res_comp.json()
    print("  City:", data_comp.get("city"))
    print("  Comparison present:", data_comp.get("comparison") is not None)

    print("\n=== Testing Non-existent City (Zero Data State) ===")
    res_empty = client.get("http://127.0.0.1:8000/api/trends?city=NonExistentPlaceXYZ&range=24h")
    print(f"GET /api/trends?city=NonExistentPlaceXYZ -> HTTP {res_empty.status_code}")
    data_empty = res_empty.json()
    print("  Status:", data_empty.get("status"))
    print("  Message:", data_empty.get("message"))
    print("  Count:", data_empty.get("count"))

if __name__ == "__main__":
    verify_trends()
