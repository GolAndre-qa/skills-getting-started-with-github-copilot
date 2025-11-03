import os
import sys

# Ensure src/ is on path so we can import app.py
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

import app as myapp
from fastapi.testclient import TestClient

client = TestClient(myapp.app)


def test_get_activities():
    r = client.get("/activities")
    assert r.status_code == 200
    data = r.json()
    # basic sanity: some known activity exists
    assert "Chess Club" in data


def test_signup_and_unregister_activity():
    email = "testuser@example.com"
    activity = "Chess Club"

    # Clean up if leftover from previous runs
    if email in myapp.activities[activity]["participants"]:
        myapp.activities[activity]["participants"].remove(email)

    # Signup
    r = client.post(f"/activities/{activity}/signup?email={email}")
    assert r.status_code == 200
    assert email in myapp.activities[activity]["participants"]

    # Unregister via activity-specific endpoint
    r = client.delete(f"/activities/{activity}/unregister?email={email}")
    assert r.status_code == 200
    assert email not in myapp.activities[activity]["participants"]


def test_api_unregister_fallback():
    email = "fallback@example.com"
    activity = "Programming Class"

    # Ensure clean start
    if email in myapp.activities[activity]["participants"]:
        myapp.activities[activity]["participants"].remove(email)

    # Signup
    r = client.post(f"/activities/{activity}/signup?email={email}")
    assert r.status_code == 200
    assert email in myapp.activities[activity]["participants"]

    # Use fallback API to remove from any activity
    r = client.delete(f"/api/unregister?email={email}")
    assert r.status_code == 200

    # Verify removed from all activities
    for details in myapp.activities.values():
        assert email not in details.get("participants", [])


def test_unregister_nonexistent_activity_returns_404():
    r = client.delete("/activities/Nonexistent/unregister?email=noone@example.com")
    assert r.status_code == 404
