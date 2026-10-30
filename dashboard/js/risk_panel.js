/**
 * ChangeGuard Pre-Deploy Change-Risk Analysis Panel Controller
 */

let sampleDiffs = {};

document.addEventListener("DOMContentLoaded", () => {
  initRiskPanel();
});

async function initRiskPanel() {
  const btnAnalyze = document.getElementById("btnAnalyzeRisk");
  const diffInput = document.getElementById("diffTextInput");
  const commitInput = document.getElementById("commitMessageInput");

  // Load sample diffs from risk engine
  try {
    const res = await fetch(`${window.CONFIG.RISK_ENGINE_URL}/risk/samples`);
    if (res.ok) {
      sampleDiffs = await res.json();
      loadSample("unbounded_query");
    }
  } catch (e) {
    // offline fallback
  }

  // Sample pill buttons
  document.getElementById("btnSampleQuery")?.addEventListener("click", () => {
    setActivePill("btnSampleQuery");
    loadSample("unbounded_query");
  });

  document.getElementById("btnSampleMemory")?.addEventListener("click", () => {
    setActivePill("btnSampleMemory");
    loadSample("memory_leak_buffer");
  });

  document.getElementById("btnSampleDocs")?.addEventListener("click", () => {
    setActivePill("btnSampleDocs");
    loadSample("safe_docs");
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
      btnAnalyze.innerHTML = `<span class="btn-icon">⚡</span> Run AI Change-Risk Analysis`;
      btnAnalyze.disabled = false;
    }
  });
}

function setActivePill(btnId) {
  document.querySelectorAll(".sample-pills .pill-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(btnId)?.classList.add("active");
}

function loadSample(key) {
  const sample = sampleDiffs[key];
  if (!sample) return;

  const diffInput = document.getElementById("diffTextInput");
  const commitInput = document.getElementById("commitMessageInput");

  if (diffInput) diffInput.value = sample.diff.trim();
  if (commitInput) commitInput.value = sample.commit_message;
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
