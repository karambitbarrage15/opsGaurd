"""
ChangeGuard Pre-Deployment Change-Risk Analysis Engine API.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import logging

from app.diff_parser import DiffParser
from app.blast_radius import BlastRadiusAnalyzer
from app.scorer import RiskScorer

logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "service": "risk-engine", "message": "%(message)s"}'
)
logger = logging.getLogger("changeguard.risk_engine")

app = FastAPI(
    title="ChangeGuard - Change-Risk Analysis Engine",
    description="Analyzes Pull Requests and diffs for blast-radius, deployment safety, and regression risks",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RiskAnalysisRequest(BaseModel):
    diff: str = Field(..., description="Git unified diff text")
    commit_message: Optional[str] = Field(default="Update telemetry pipeline")
    author: Optional[str] = Field(default="engineer@automotive.io")
    branch: Optional[str] = Field(default="feature/telemetry-optimization")

SAMPLE_DIFFS = {
    "unbounded_query": {
        "title": "Unbounded Query & Sync Sleep",
        "commit_message": "feat(telemetry): add batch historical vehicle lookups",
        "diff": """diff --git a/services/telemetry_service/app/telemetry.py b/services/telemetry_service/app/telemetry.py
--- a/services/telemetry_service/app/telemetry.py
+++ b/services/telemetry_service/app/telemetry.py
@@ -35,6 +35,14 @@ class TelemetryStore:
     def get_vehicle_history(self, vin: str):
+        # Query all records without index or pagination
+        query = "SELECT * FROM vehicle_events WHERE vin = '" + vin + "'"
+        import time
+        time.sleep(2.5) # Wait for buffer flush
+        cursor.execute(query)
+        return cursor.fetchall()
"""
    },
    "memory_leak_buffer": {
        "title": "Memory Buffer Leak",
        "commit_message": "perf(cache): store uncompressed vehicle coordinates in memory",
        "diff": """diff --git a/services/telemetry_service/app/telemetry.py b/services/telemetry_service/app/telemetry.py
--- a/services/telemetry_service/app/telemetry.py
+++ b/services/telemetry_service/app/telemetry.py
@@ -12,4 +12,12 @@
+global_coordinate_cache = []
+
 def ingest(telemetry):
+    # Store uncompressed coordinates indefinitely
+    chunk = bytearray(50 * 1024 * 1024) # 50MB chunk
+    global_coordinate_cache.append(chunk)
     return {"status": "stored"}
"""
    },
    "hardcoded_secrets": {
        "title": "API Key Leak & No SSL",
        "commit_message": "feat(auth): integrate third-party fleet telemetry sync client",
        "diff": """diff --git a/services/telemetry_service/app/auth_sync.py b/services/telemetry_service/app/auth_sync.py
--- a/services/telemetry_service/app/auth_sync.py
+++ b/services/telemetry_service/app/auth_sync.py
@@ -10,6 +10,14 @@
+import requests
+
+# Sync vehicle credentials with partner cloud
+PARTNER_API_KEY = "sk_live_9948271048201948201"
+
+def sync_partner_telemetry(payload):
+    headers = {"Authorization": f"Bearer {PARTNER_API_KEY}"}
+    # Bypass SSL verification in staging
+    response = requests.post("https://api.partner-fleets.com/sync", json=payload, headers=headers, verify=False)
+    return response.json()
"""
    },
    "destructive_migration": {
        "title": "Destructive Table Drop (SQL)",
        "commit_message": "refactor(db): drop legacy telemetry archive tables",
        "diff": """diff --git a/services/telemetry_service/migrations/004_drop_legacy_tables.sql b/services/telemetry_service/migrations/004_drop_legacy_tables.sql
--- a/services/telemetry_service/migrations/004_drop_legacy_tables.sql
+++ b/services/telemetry_service/migrations/004_drop_legacy_tables.sql
@@ -1,5 +1,8 @@
--- Clean up legacy partitioned tables
+-- Drop obsolete table containing active telemetry backups
+DROP TABLE vehicle_historical_events;
+
+-- Modify core vehicle registration table
+ALTER TABLE vehicle_fleets DROP COLUMN region_code;
"""
    },
    "missing_timeout": {
        "title": "External HTTP Call with No Timeout",
        "commit_message": "feat(gps): fetch geocoding reverse lookup from external provider",
        "diff": """diff --git a/services/telemetry_service/app/geocoder.py b/services/telemetry_service/app/geocoder.py
--- a/services/telemetry_service/app/geocoder.py
+++ b/services/telemetry_service/app/geocoder.py
@@ -8,6 +8,13 @@
+import httpx
+
+def reverse_geocode(lat: float, lon: float):
+    # Blocking external network call with no timeout
+    client = httpx.Client(timeout=None)
+    while True:
+        resp = client.get(f"https://maps-api.external.com/v1/reverse?lat={lat}&lon={lon}")
+        if resp.status_code == 200:
+            return resp.json()
"""
    },
    "safe_feature_pagination": {
        "title": "Optimized Paginated Index Query",
        "commit_message": "feat(telemetry): add paginated recent vehicle ping lookup",
        "diff": """diff --git a/services/telemetry_service/app/telemetry.py b/services/telemetry_service/app/telemetry.py
--- a/services/telemetry_service/app/telemetry.py
+++ b/services/telemetry_service/app/telemetry.py
@@ -40,6 +40,11 @@ class TelemetryStore:
+    def get_recent_vehicle_pings(self, vin: str, max_records: int = 10):
+        # Fetch recent records with strict pagination and index hint
+        stmt = "SELECT timestamp, speed_mph, battery_pct FROM events WHERE vin = :vin ORDER BY timestamp DESC LIMIT :limit"
+        return self.db.execute(stmt, {"vin": vin, "limit": max_records})
"""
    },
    "safe_docs": {
        "title": "Safe Documentation & Typo Fix",
        "commit_message": "docs(readme): update API endpoint documentation and telemetry examples",
        "diff": """diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -10,3 +10,5 @@
-### Old Telemetry Specs
+### Connected-Vehicle Telemetry Specifications
+All requests require standard JSON payload with VIN and GPS coordinates.
"""
    }
}

@app.get("/health")
def health():
    return {"status": "healthy", "service": "risk-engine", "version": "1.0.0"}

@app.post("/risk/analyze")
def analyze_risk(payload: RiskAnalysisRequest):
    if not payload.diff.strip():
        raise HTTPException(status_code=400, detail="Diff cannot be empty")

    # 1. Parse Diff
    diff_data = DiffParser.parse(payload.diff)

    # 2. Evaluate Blast Radius & Topology
    blast_radius = BlastRadiusAnalyzer.evaluate(diff_data["categories"], diff_data["files"])

    # 3. Score Risk
    score_report = RiskScorer.evaluate(diff_data, payload.diff, payload.commit_message)

    logger.info(f"Analyzed PR change: score={score_report['risk_score']} tier={score_report['risk_tier']}")

    return {
        "commit_message": payload.commit_message,
        "author": payload.author,
        "branch": payload.branch,
        "diff_metrics": {
            "total_files": diff_data["total_files"],
            "added_lines": diff_data["total_added"],
            "deleted_lines": diff_data["total_deleted"],
            "categories": diff_data["categories"],
            "files": diff_data["files"]
        },
        "blast_radius": blast_radius,
        "risk_assessment": score_report
    }

@app.get("/risk/samples")
def get_samples():
    return SAMPLE_DIFFS

@app.post("/github/webhook")
def github_webhook(payload: Dict[str, Any]):
    """
    Receives GitHub Pull Request Webhooks (event: pull_request).
    Analyzes the PR diff, computes deployment risk, and returns
    automated PR comment markdown for GitHub Actions / Bots.
    """
    pr = payload.get("pull_request", {})
    action = payload.get("action", "opened")
    repo = payload.get("repository", {}).get("full_name", "automotive-io/changeguard")
    pr_number = pr.get("number") or payload.get("number", 101)
    title = pr.get("title") or payload.get("commit_message", "PR Update")
    author = pr.get("user", {}).get("login") or payload.get("author", "developer")
    branch = pr.get("head", {}).get("ref") or payload.get("branch", "feature/pr-update")
    
    # Extract diff if provided, or fallback to sample
    diff_text = payload.get("diff") or pr.get("diff")
    if not diff_text:
        diff_text = SAMPLE_DIFFS["unbounded_query"]["diff"]

    diff_data = DiffParser.parse(diff_text)
    blast_radius = BlastRadiusAnalyzer.evaluate(diff_data["categories"], diff_data["files"])
    score_report = RiskScorer.evaluate(diff_data, diff_text, title)

    tier = score_report["risk_tier"]
    score = score_report["risk_score"]
    status_icon = "🛑" if tier == "CRITICAL" else ("⚠️" if tier == "HIGH" else "✅")

    # Build GitHub PR Comment Markdown
    markdown_comment = f"""## {status_icon} ChangeGuard AI Pre-Deploy Risk Gate
**Repository:** `{repo}` | **PR:** `#{pr_number}` | **Branch:** `{branch}`

### 📊 Safety Evaluation: **{score_report['approval_status']}** (Score: {score}/100 - {tier} RISK)
> {score_report['summary']}

#### 🔍 Identified Risk Factors:
"""
    for f in score_report.get("risk_factors", []):
        markdown_comment += f"- **{f['factor']}** ({f['weight']}): {f['detail']}\n"

    markdown_comment += f"""
#### 💥 Blast Radius & Downstream Topology:
- **Criticality:** `{blast_radius['criticality_level']}`
- **Affected Services:** `{', '.join(blast_radius['affected_services'])}`
- **Fleet Impact:** `{blast_radius['estimated_fleet_impact_pct']}%`

#### 📋 Deployment Strategy:
- **Recommended Canary:** `{score_report['canary_strategy']}`
"""
    for rec in score_report.get("recommendations", []):
        markdown_comment += f"- [ ] {rec}\n"

    logger.info(f"[GITHUB_WEBHOOK] Processed PR #{pr_number} from {author} on {repo}: {score_report['approval_status']}")

    return {
        "status": "success",
        "event": "pull_request",
        "action": action,
        "pr_number": pr_number,
        "repository": repo,
        "author": author,
        "risk_assessment": score_report,
        "blast_radius": blast_radius,
        "github_comment_markdown": markdown_comment
    }
