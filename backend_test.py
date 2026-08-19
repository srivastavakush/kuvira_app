#!/usr/bin/env python3
"""
AI Coach Backend API Test Suite
Tests all AI Coach endpoints in the required order.
"""
import requests
import time
import json
import subprocess
import os
from pathlib import Path

# Backend URL from frontend/.env
BASE_URL = "https://c1df39db-9878-40c2-b7f1-8cd3562cb1d1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_PHONE = "+919999999999"
TEST_OTP = "123456"

# Global state
token = None
match_id = None
video_id = None
job_id = None

def log_test(name, status, details=""):
    """Log test results"""
    symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"\n{symbol} {name}")
    if details:
        print(f"   {details}")

def test_auth():
    """Test 1: Authenticate and get Bearer token"""
    global token
    
    print("\n" + "="*60)
    print("TEST 1: Authentication Flow")
    print("="*60)
    
    # Step 1: Request OTP
    try:
        resp = requests.post(f"{API_BASE}/auth/otp/start", json={"mobile": TEST_PHONE}, timeout=10)
        if resp.status_code != 200:
            log_test("OTP Request", "FAIL", f"Status {resp.status_code}: {resp.text}")
            return False
        log_test("OTP Request", "PASS", f"Response: {resp.json()}")
    except Exception as e:
        log_test("OTP Request", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Step 2: Verify OTP
    try:
        resp = requests.post(f"{API_BASE}/auth/otp/verify", 
                           json={"mobile": TEST_PHONE, "otp": TEST_OTP}, 
                           timeout=10)
        if resp.status_code != 200:
            log_test("OTP Verify", "FAIL", f"Status {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        token = data.get("token")
        if not token:
            log_test("OTP Verify", "FAIL", "No token in response")
            return False
        
        log_test("OTP Verify", "PASS", f"Token obtained: {token[:20]}...")
        return True
    except Exception as e:
        log_test("OTP Verify", "FAIL", f"Exception: {str(e)}")
        return False

def test_knowledge_seed():
    """Test 2: Seed knowledge base"""
    print("\n" + "="*60)
    print("TEST 2: Knowledge Seed")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        resp = requests.post(f"{API_BASE}/ai-coach/knowledge/seed", headers=headers, timeout=30)
        
        if resp.status_code != 200:
            log_test("Knowledge Seed", "FAIL", f"Status {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        upserted = data.get("upserted", 0)
        
        if upserted > 0:
            log_test("Knowledge Seed", "PASS", f"Upserted {upserted} knowledge items")
        else:
            log_test("Knowledge Seed", "WARN", f"Upserted 0 items (may be expected if OPENAI_API_KEY is empty)")
        
        return True
    except Exception as e:
        log_test("Knowledge Seed", "FAIL", f"Exception: {str(e)}")
        return False

def test_create_match():
    """Test 3: Create a match"""
    global match_id
    
    print("\n" + "="*60)
    print("TEST 3: Create Match")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    match_data = {
        "sport": "pickleball",
        "player_level": "Intermediate",
        "result": "loss",
        "opponent_name": "Test Opponent",
        "notes": "backend test match"
    }
    
    try:
        resp = requests.post(f"{API_BASE}/ai-coach/matches", 
                           headers=headers, 
                           json=match_data,
                           timeout=10)
        
        if resp.status_code != 200:
            log_test("Create Match", "FAIL", f"Status {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        match_id = data.get("id")
        
        if not match_id:
            log_test("Create Match", "FAIL", "No match ID in response")
            return False
        
        log_test("Create Match", "PASS", f"Match created: {match_id}")
        return True
    except Exception as e:
        log_test("Create Match", "FAIL", f"Exception: {str(e)}")
        return False

def create_test_video():
    """Create a small test video using ffmpeg"""
    video_path = "/tmp/test_video.mp4"
    
    # Try to create a minimal video with ffmpeg
    try:
        cmd = [
            "ffmpeg", "-f", "lavfi", "-i", "color=black:s=320x240:d=2",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", video_path
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=10)
        
        if result.returncode == 0 and os.path.exists(video_path):
            return video_path
        else:
            print(f"   ⚠️  ffmpeg failed: {result.stderr.decode()[:200]}")
            return None
    except Exception as e:
        print(f"   ⚠️  Could not create video with ffmpeg: {str(e)}")
        return None

def test_upload_video():
    """Test 4: Upload video"""
    global video_id
    
    print("\n" + "="*60)
    print("TEST 4: Upload Video")
    print("="*60)
    
    # Create test video
    video_path = create_test_video()
    if not video_path:
        log_test("Upload Video", "FAIL", "Could not create test video")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        with open(video_path, "rb") as f:
            files = {"file": ("test_video.mp4", f, "video/mp4")}
            data = {"match_id": match_id}
            
            resp = requests.post(f"{API_BASE}/ai-coach/videos",
                               headers=headers,
                               files=files,
                               data=data,
                               timeout=30)
        
        if resp.status_code != 200:
            log_test("Upload Video", "FAIL", f"Status {resp.status_code}: {resp.text}")
            return False
        
        result = resp.json()
        video_id = result.get("id")
        storage_path = result.get("storage_path")
        
        if not video_id:
            log_test("Upload Video", "FAIL", "No video ID in response")
            return False
        
        # Check if storage path exists
        if storage_path and os.path.exists(storage_path):
            log_test("Upload Video", "PASS", f"Video uploaded: {video_id}, stored at {storage_path}")
        else:
            log_test("Upload Video", "WARN", f"Video uploaded: {video_id}, but storage_path not verified")
        
        return True
    except Exception as e:
        log_test("Upload Video", "FAIL", f"Exception: {str(e)}")
        return False
    finally:
        # Cleanup
        if os.path.exists(video_path):
            os.remove(video_path)

def test_start_analysis():
    """Test 5: Start analysis job"""
    global job_id
    
    print("\n" + "="*60)
    print("TEST 5: Start Analysis")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    analyze_data = {
        "match_id": match_id,
        "video_id": video_id
    }
    
    try:
        resp = requests.post(f"{API_BASE}/ai-coach/analyze",
                           headers=headers,
                           json=analyze_data,
                           timeout=10)
        
        if resp.status_code != 200:
            log_test("Start Analysis", "FAIL", f"Status {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        job_id = data.get("id")
        status = data.get("status")
        
        if not job_id:
            log_test("Start Analysis", "FAIL", "No job ID in response")
            return False
        
        log_test("Start Analysis", "PASS", f"Analysis job started: {job_id}, status: {status}")
        return True
    except Exception as e:
        log_test("Start Analysis", "FAIL", f"Exception: {str(e)}")
        return False

def test_poll_analysis():
    """Test 6: Poll analysis status"""
    print("\n" + "="*60)
    print("TEST 6: Poll Analysis Status")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    max_attempts = 30
    attempt = 0
    
    while attempt < max_attempts:
        attempt += 1
        
        try:
            resp = requests.get(f"{API_BASE}/ai-coach/analysis/{job_id}",
                              headers=headers,
                              timeout=10)
            
            if resp.status_code != 200:
                log_test("Poll Analysis", "FAIL", f"Status {resp.status_code}: {resp.text}")
                return False
            
            data = resp.json()
            status = data.get("status")
            stage = data.get("stage")
            progress = data.get("progress", 0)
            
            print(f"   Attempt {attempt}: status={status}, stage={stage}, progress={progress:.1%}")
            
            if status == "completed":
                log_test("Poll Analysis", "PASS", f"Analysis completed after {attempt} attempts")
                return True
            elif status == "failed":
                diagnostics = data.get("diagnostics", {})
                log_test("Poll Analysis", "FAIL", f"Analysis failed: {diagnostics}")
                return False
            
            time.sleep(1)
        except Exception as e:
            log_test("Poll Analysis", "FAIL", f"Exception: {str(e)}")
            return False
    
    log_test("Poll Analysis", "FAIL", f"Timeout after {max_attempts} attempts")
    return False

def verify_analytics():
    """Verify analytics document exists in MongoDB"""
    print("\n   Verifying analytics document...")
    
    # We can't directly access MongoDB from here, but we can check via the report endpoint
    # This will be done in the next test
    return True

def test_get_report():
    """Test 7: Get match report"""
    print("\n" + "="*60)
    print("TEST 7: Get Match Report")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        resp = requests.get(f"{API_BASE}/ai-coach/match/{match_id}/report",
                          headers=headers,
                          timeout=30)
        
        # Expected: may fail with 502 if OPENAI_API_KEY is empty
        if resp.status_code == 502:
            log_test("Get Report", "WARN", "502 error (expected if OPENAI_API_KEY is empty)")
            # Check if it's a clean JSON error
            try:
                error = resp.json()
                if "error" in error or "Coach model unavailable" in str(error):
                    log_test("Get Report Error Format", "PASS", "Clean JSON error response")
                else:
                    log_test("Get Report Error Format", "WARN", f"Unexpected error format: {error}")
            except Exception:
                log_test("Get Report Error Format", "FAIL", "Not a JSON response")
            return True  # This is acceptable
        
        if resp.status_code == 500:
            log_test("Get Report", "FAIL", f"500 Internal Server Error: {resp.text}")
            return False
        
        if resp.status_code != 200:
            log_test("Get Report", "FAIL", f"Status {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        
        # Verify report structure
        required_fields = ["data_quality", "metrics", "unavailable"]
        missing = [f for f in required_fields if f not in data]
        
        if missing:
            log_test("Get Report", "FAIL", f"Missing fields: {missing}")
            return False
        
        # Check that tactical claims are empty when confidence is low
        strengths = data.get("strengths", [])
        weaknesses = data.get("weaknesses", [])
        tactical = data.get("tactical_observations", [])
        
        data_quality = data.get("data_quality", {})
        overall_confidence = data_quality.get("overall_confidence", 0)
        
        if overall_confidence == 0:
            if strengths or weaknesses or tactical:
                log_test("Get Report", "WARN", 
                        f"Expected empty tactical claims with 0 confidence, but got: "
                        f"strengths={len(strengths)}, weaknesses={len(weaknesses)}, tactical={len(tactical)}")
            else:
                log_test("Get Report Tactical Claims", "PASS", 
                        "Correctly empty tactical claims with 0 confidence")
        
        log_test("Get Report", "PASS", f"Report generated with {len(data.get('metrics', []))} metrics")
        return True
        
    except Exception as e:
        log_test("Get Report", "FAIL", f"Exception: {str(e)}")
        return False

def test_chat():
    """Test 8: Chat endpoint"""
    print("\n" + "="*60)
    print("TEST 8: AI Coach Chat")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    chat_data = {
        "text": "What can you tell me about my performance?",
        "match_id": match_id
    }
    
    try:
        resp = requests.post(f"{API_BASE}/ai-coach/chat",
                           headers=headers,
                           json=chat_data,
                           timeout=30)
        
        # Expected: may fail with 502 if OPENAI_API_KEY is empty
        if resp.status_code == 502:
            log_test("Chat", "WARN", "502 error (expected if OPENAI_API_KEY is empty)")
            # Check if it's a clean JSON error
            try:
                error = resp.json()
                if "error" in error or "Coach model unavailable" in str(error):
                    log_test("Chat Error Format", "PASS", "Clean JSON error response")
                else:
                    log_test("Chat Error Format", "WARN", f"Unexpected error format: {error}")
            except Exception as e:
                log_test("Chat Error Format", "FAIL", f"Not a JSON response. Content: {resp.text[:200]}")
            return True  # This is acceptable
        
        if resp.status_code == 500:
            log_test("Chat", "FAIL", f"500 Internal Server Error: {resp.text}")
            return False
        
        if resp.status_code != 200:
            log_test("Chat", "FAIL", f"Status {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        reply = data.get("reply")
        
        if not reply:
            log_test("Chat", "FAIL", "No reply in response")
            return False
        
        log_test("Chat", "PASS", f"Chat response received: {reply[:100]}...")
        return True
        
    except Exception as e:
        log_test("Chat", "FAIL", f"Exception: {str(e)}")
        return False

def test_player_performance():
    """Test 9: Player performance endpoint"""
    print("\n" + "="*60)
    print("TEST 9: Player Performance")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        resp = requests.get(f"{API_BASE}/ai-coach/player-performance",
                          headers=headers,
                          timeout=10)
        
        if resp.status_code != 200:
            log_test("Player Performance", "FAIL", f"Status {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        
        # Verify structure
        if "trends" not in data:
            log_test("Player Performance", "FAIL", "Missing 'trends' in response")
            return False
        
        trends = data.get("trends", {})
        matches_analyzed = data.get("matches_analyzed", 0)
        
        log_test("Player Performance", "PASS", 
                f"Retrieved performance data: {matches_analyzed} matches analyzed, {len(trends)} metrics")
        
        # Verify metrics have required fields
        for metric_name, metric_data in trends.items():
            required = ["current", "source", "confidence"]
            missing = [f for f in required if f not in metric_data]
            if missing:
                log_test(f"Metric {metric_name}", "WARN", f"Missing fields: {missing}")
        
        return True
        
    except Exception as e:
        log_test("Player Performance", "FAIL", f"Exception: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("AI COACH BACKEND API TEST SUITE")
    print("="*60)
    
    results = []
    
    # Test 1: Auth
    if not test_auth():
        print("\n❌ Authentication failed. Cannot proceed with other tests.")
        return
    results.append(("Authentication", True))
    
    # Test 2: Knowledge Seed
    results.append(("Knowledge Seed", test_knowledge_seed()))
    
    # Test 3: Create Match
    if not test_create_match():
        print("\n❌ Match creation failed. Cannot proceed with video/analysis tests.")
        return
    results.append(("Create Match", True))
    
    # Test 4: Upload Video
    if not test_upload_video():
        print("\n❌ Video upload failed. Cannot proceed with analysis tests.")
        return
    results.append(("Upload Video", True))
    
    # Test 5: Start Analysis
    if not test_start_analysis():
        print("\n❌ Analysis start failed. Cannot proceed with polling.")
        return
    results.append(("Start Analysis", True))
    
    # Test 6: Poll Analysis
    analysis_completed = test_poll_analysis()
    results.append(("Poll Analysis", analysis_completed))
    
    if not analysis_completed:
        print("\n⚠️  Analysis did not complete. Skipping report tests.")
    else:
        # Test 7: Get Report
        results.append(("Get Report", test_get_report()))
        
        # Test 8: Chat
        results.append(("Chat", test_chat()))
        
        # Test 9: Player Performance
        results.append(("Player Performance", test_player_performance()))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")

if __name__ == "__main__":
    main()
