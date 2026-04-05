import requests
import time

BASE_URL = "http://localhost:8001"

def wait_for_server():
    print("Waiting for server to start...")
    for _ in range(30):
        try:
            r = requests.get(f"{BASE_URL}/docs")
            if r.status_code == 200:
                print("Server is up!")
                return True
        except requests.exceptions.ConnectionError:
            time.sleep(2)
    return False

def test_multilingual():
    print("Running Multilingual Test...")
    r = requests.get(f"{BASE_URL}/api/search", params={"query": "elecciones política"})
    assert r.status_code == 200, f"Failed: {r.status_code}"
    print("Multilingual Test: PASS")

def test_self_healing():
    print("Running Self-Healing Test...")
    r = requests.get(f"{BASE_URL}/api/search", params={"query": "asdfghjkl"})
    assert r.status_code == 200, f"Failed: {r.status_code}"
    data = r.json()
    assert data.get("status") == "404_SEMANTIC", "Status missing or wrong"
    assert "suggestions" in data, "Suggestions missing"
    assert len(data["suggestions"]) == 3, "Should have 3 suggestions"
    print("Self-Healing Test: PASS")

def test_extreme_clustering():
    print("Running Extreme Clustering Test (k=100)...")
    r = requests.get(f"{BASE_URL}/api/clusters", params={"k": 100})
    assert r.status_code == 200, f"Failed: {r.status_code}"
    print("Extreme Clustering Test: PASS")

def test_network_recalculation():
    print("Running Network Recalculation Test...")
    r = requests.post(f"{BASE_URL}/api/network", json={"exclude_nodes": ["AutoModerator"]})
    assert r.status_code == 200, f"Failed: {r.status_code}"
    data = r.json()
    nodes = data.get("nodes", [])
    author_ids = [n["id"] for n in nodes]
    assert "AutoModerator" not in author_ids, "AutoModerator was not excluded properly!"
    print("Network Recalculation Test: PASS")

if __name__ == "__main__":
    if wait_for_server():
        test_multilingual()
        test_self_healing()
        test_extreme_clustering()
        test_network_recalculation()
        print("ALL EDGE CASES PASSED")
    else:
        print("Test failed: Server did not start.")
        exit(1)
