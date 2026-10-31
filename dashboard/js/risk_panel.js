/**
 * ChangeGuard Pre-Deploy Change-Risk Analysis Panel Controller
 */

const LOCAL_SAMPLE_DIFFS = {
  "unbounded_query": {
    "title": "Unbounded Query & Sync Sleep",
    "commit_message": "feat(telemetry): add batch historical vehicle lookups",
    "diff": `diff --git a/services/telemetry_service/app/telemetry.py b/services/telemetry_service/app/telemetry.py
--- a/services/telemetry_service/app/telemetry.py
+++ b/services/telemetry_service/app/telemetry.py
@@ -35,6 +35,14 @@ class TelemetryStore:
     def get_vehicle_history(self, vin: str):
+        # Query all records without index or pagination
+        query = "SELECT * FROM vehicle_events WHERE vin = '" + vin + "'"
+        import time
+        time.sleep(2.5) # Wait for buffer flush
+        cursor.execute(query)
+        return cursor.fetchall()`
  },
  "memory_leak_buffer": {
    "title": "Memory Buffer Leak",
    "commit_message": "perf(cache): store uncompressed vehicle coordinates in memory",
    "diff": `diff --git a/services/telemetry_service/app/telemetry.py b/services/telemetry_service/app/telemetry.py
--- a/services/telemetry_service/app/telemetry.py
+++ b/services/telemetry_service/app/telemetry.py
@@ -12,4 +12,12 @@
+global_coordinate_cache = []
+
 def ingest(telemetry):
+    # Store uncompressed coordinates indefinitely
+    chunk = bytearray(50 * 1024 * 1024) # 50MB chunk
+    global_coordinate_cache.append(chunk)
     return {"status": "stored"}`
  },
  "hardcoded_secrets": {
    "title": "API Key Leak & No SSL",
    "commit_message": "feat(auth): integrate third-party fleet telemetry sync client",
    "diff": `diff --git a/services/telemetry_service/app/auth_sync.py b/services/telemetry_service/app/auth_sync.py
--- a/services/telemetry_service/app/auth_sync.py
+++ b/services/telemetry_service/app/auth_sync.py
@@ -10,6 +10,14 @@
+import requests
+
+# Sync vehicle credentials with partner cloud
+PARTNER_API_KEY = "sk_live_9948271048201948201"
+
 def sync_partner_telemetry(payload):
+    headers = {"Authorization": f"Bearer {PARTNER_API_KEY}"}
+    # Bypass SSL verification in staging
+    response = requests.post("https://api.partner-fleets.com/sync", json=payload, headers=headers, verify=False)
+    return response.json()`
  },
  "destructive_migration": {
    "title": "Destructive Table Drop (SQL)",
    "commit_message": "refactor(db): drop legacy telemetry archive tables",
    "diff": `diff --git a/services/telemetry_service/migrations/004_drop_legacy_tables.sql b/services/telemetry_service/migrations/004_drop_legacy_tables.sql
--- a/services/telemetry_service/migrations/004_drop_legacy_tables.sql
+++ b/services/telemetry_service/migrations/004_drop_legacy_tables.sql
@@ -1,5 +1,8 @@
--- Clean up legacy partitioned tables
+-- Drop obsolete table containing active telemetry backups
+DROP TABLE vehicle_historical_events;
+
+-- Modify core vehicle registration table
+ALTER TABLE vehicle_fleets DROP COLUMN region_code;`
  },
  "missing_timeout": {
    "title": "External HTTP Call with No Timeout",
    "commit_message": "feat(gps): fetch geocoding reverse lookup from external provider",
    "diff": `diff --git a/services/telemetry_service/app/geocoder.py b/services/telemetry_service/app/geocoder.py
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
+            return resp.json()`
  },
  "safe_feature_pagination": {
    "title": "Optimized Paginated Index Query",
    "commit_message": "feat(telemetry): add paginated recent vehicle ping lookup",
    "diff": `diff --git a/services/telemetry_service/app/telemetry.py b/services/telemetry_service/app/telemetry.py
--- a/services/telemetry_service/app/telemetry.py
+++ b/services/telemetry_service/app/telemetry.py
@@ -40,6 +40,11 @@ class TelemetryStore:
+    def get_recent_vehicle_pings(self, vin: str, max_records: int = 10):
+        # Fetch recent records with strict pagination and index hint
+        stmt = "SELECT timestamp, speed_mph, battery_pct FROM events WHERE vin = :vin ORDER BY timestamp DESC LIMIT :limit"
+        return self.db.execute(stmt, {"vin": vin, "limit": max_records})`
  },
  "safe_docs": {
    "title": "Safe Documentation & Typo Fix",
    "commit_message": "docs(readme): update API endpoint documentation and telemetry examples",
    "diff": `diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -10,3 +10,5 @@
-### Old Telemetry Specs
+### Connected-Vehicle Telemetry Specifications
+All requests require standard JSON payload with VIN and GPS coordinates.`
  }
};

let sampleDiffs = { ...LOCAL_SAMPLE_DIFFS };

function setActivePill(btnId) {
  document.querySelectorAll(".scenario-pills .pill-btn, .sample-pills .pill-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(btnId)?.classList.add("active");
}

function loadSample(key, autoAnalyze = false) {
  const sample = sampleDiffs[key] || LOCAL_SAMPLE_DIFFS[key];
  if (!sample) return;

  const diffInput = document.getElementById("diffTextInput");
  const commitInput = document.getElementById("commitMessageInput");

  if (diffInput) diffInput.value = sample.diff.trim();
  if (commitInput) commitInput.value = sample.commit_message;

  if (autoAnalyze) {
    document.getElementById("btnAnalyzeRisk")?.click();
  }
}

// Expose globally for inline onclick handlers
window.setActivePill = setActivePill;
window.loadSample = loadSample;

document.addEventListener("DOMContentLoaded", () => {
  initRiskPanel();
});

async function initRiskPanel() {
  const btnAnalyze = document.getElementById("btnAnalyzeRisk");
  const diffInput = document.getElementById("diffTextInput");
  const commitInput = document.getElementById("commitMessageInput");

  // Load sample diffs from risk engine if available
  try {
    const res = await fetch(`${window.CONFIG.RISK_ENGINE_URL}/risk/samples`);
    if (res.ok) {
      const serverSamples = await res.json();
      sampleDiffs = { ...LOCAL_SAMPLE_DIFFS, ...serverSamples };
    }
  } catch (e) {
    // using LOCAL_SAMPLE_DIFFS
  }

  // Initial load
  loadSample("unbounded_query");

  // Sample pill buttons (7 Diverse Production Risk Scenarios)
  document.getElementById("btnSampleQuery")?.addEventListener("click", () => {
    setActivePill("btnSampleQuery");
    loadSample("unbounded_query", true);
  });

  document.getElementById("btnSampleMemory")?.addEventListener("click", () => {
    setActivePill("btnSampleMemory");
    loadSample("memory_leak_buffer", true);
  });

  document.getElementById("btnSampleSecrets")?.addEventListener("click", () => {
    setActivePill("btnSampleSecrets");
    loadSample("hardcoded_secrets", true);
  });

  document.getElementById("btnSampleMigration")?.addEventListener("click", () => {
    setActivePill("btnSampleMigration");
    loadSample("destructive_migration", true);
  });

  document.getElementById("btnSampleTimeout")?.addEventListener("click", () => {
    setActivePill("btnSampleTimeout");
    loadSample("missing_timeout", true);
  });

  document.getElementById("btnSamplePagination")?.addEventListener("click", () => {
    setActivePill("btnSamplePagination");
    loadSample("safe_feature_pagination", true);
  });

  document.getElementById("btnSampleDocs")?.addEventListener("click", () => {
    setActivePill("btnSampleDocs");
    loadSample("safe_docs", true);
  });

  // Run analysis button
  btnAnalyze?.addEventListener("click", async () => {
    const diff = diffInput?.value || "";
    const commitMsg = commitInput?.value || "Update telemetry pipeline";

    if (!diff.trim()) {
      alert("Please enter or select a git diff to analyze.");
      return;
    }

    btnAnalyze.innerText = "Analyzing Risk & Blast Radius...";
    btnAnalyze.disabled = true;

    try {
      const res = await fetch(`${window.CONFIG.RISK_ENGINE_URL}/risk/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diff: diff,
          commit_message: commitMsg,
          author: "engineer@automotive.io",
          branch: "main"
        })
      });

      if (res.ok) {
        const data = await res.json();
        renderRiskResults(data);
      } else {
        alert("Risk analysis error. Ensure risk-engine service is active.");
      }
    } catch (e) {
      alert(`Could not connect to risk engine at ${window.CONFIG.RISK_ENGINE_URL}`);
    } finally {
      btnAnalyze.innerHTML = `<svg class="icon-line" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path></svg> <span>Run AI Change-Risk Analysis</span>`;
      btnAnalyze.disabled = false;
    }
  });
}

function renderRiskResults(data) {
  const assessment = data.risk_assessment || {};
  const blast = data.blast_radius || {};
  const score = assessment.risk_score || 0;
  const tier = assessment.risk_tier || "LOW";

  // 1. Tier Badge
  const tierBadge = document.getElementById("riskTierBadge");
  if (tierBadge) {
    tierBadge.innerText = `${tier} RISK`;
    tierBadge.className = tier === "CRITICAL" ? "badge critical-badge" : (tier === "HIGH" ? "badge warning-badge" : "badge success-badge");
  }

  // 2. Score Circle & Fill
  const scoreNum = document.getElementById("riskScoreNumber");
  const circleFill = document.getElementById("circleFill");
  if (scoreNum) scoreNum.innerText = score;
  if (circleFill) {
    const circumference = 264;
    const offset = circumference - (circumference * score / 100);
    circleFill.style.strokeDashoffset = offset;
    circleFill.style.stroke = tier === "CRITICAL" ? "var(--accent-rose)" : (tier === "HIGH" ? "var(--accent-amber)" : "var(--accent-emerald)");
  }

  // 3. Approval Status & Canary Strategy
  const approvalTitle = document.getElementById("approvalStatusTitle");
  const approvalDesc = document.getElementById("approvalStatusDesc");
  const canaryBox = document.getElementById("canaryStrategyBox");
  const canaryVal = document.getElementById("canaryStrategyVal");

  if (approvalTitle) {
    approvalTitle.innerText = assessment.approval_status.replace(/_/g, " ");
    approvalTitle.style.color = tier === "CRITICAL" ? "var(--accent-rose)" : (tier === "HIGH" ? "var(--accent-amber)" : "var(--accent-emerald)");
  }
  if (approvalDesc) approvalDesc.innerText = assessment.summary;
  if (canaryBox && canaryVal) {
    canaryBox.style.display = "flex";
    canaryVal.innerText = assessment.canary_strategy || "Rolling Deployment";
  }

  // 4. Factors Breakdown
  const factorsList = document.getElementById("factorsList");
  if (factorsList) {
    factorsList.innerHTML = "";
    (assessment.risk_factors || []).forEach(f => {
      const item = document.createElement("div");
      item.className = "factor-flat-item";
      item.innerHTML = `
        <div>
          <strong>${f.factor}</strong>
          <div class="factor-desc">${f.detail}</div>
        </div>
        <span class="factor-wt">${f.weight}</span>
      `;
      factorsList.appendChild(item);
    });
    if (!assessment.risk_factors || !assessment.risk_factors.length) {
      factorsList.innerHTML = `<div class="muted-text">No anomalous risk patterns detected in diff.</div>`;
    }
  }

  // 5. Blast Radius Affected Services
  const affectedList = document.getElementById("affectedServicesList");
  if (affectedList) {
    affectedList.innerHTML = "";
    (blast.affected_services || []).forEach(svc => {
      const chip = document.createElement("span");
      chip.className = "service-clean-pill";
      chip.innerText = svc;
      affectedList.appendChild(chip);
    });
  }

  // 6. Recommendations
  const recsList = document.getElementById("recommendationsList");
  if (recsList) {
    recsList.innerHTML = "";
    (assessment.recommendations || []).forEach(rec => {
      const li = document.createElement("li");
      li.innerText = rec;
      recsList.appendChild(li);
    });
  }
}
