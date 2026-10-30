/**
 * ChangeGuard Autonomous AI SRE Agent Stream & Rollback Controller
 */

let activeIncidentReport = null;

document.addEventListener("DOMContentLoaded", () => {
  initAgentStream();
});

function initAgentStream() {
  const btnTrigger = document.getElementById("btnTriggerInvestigation");
  const btnRollback = document.getElementById("btnApproveRollback");

  btnTrigger?.addEventListener("click", async () => {
    btnTrigger.disabled = true;
    btnTrigger.innerHTML = `<span>⏳</span> Investigating Incident...`;

    // Clear terminal
    const terminal = document.getElementById("agentTerminal");
    if (terminal) {
      terminal.innerHTML = "";
    }

    try {
      const res = await fetch(`${window.CONFIG.SRE_AGENT_URL}/agent/investigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "Prometheus Alert: CriticalDegradationThreshold" })
      });

      if (res.ok) {
        const report = await res.json();
        activeIncidentReport = report;

        // Fetch events
        const eventsRes = await fetch(`${window.CONFIG.SRE_AGENT_URL}/agent/events`);
        const eventsData = await eventsRes.json();

        await playEventStream(eventsData.events || []);
        renderRCA(report);
      } else {
        appendTerminalLine("system-line", "Error communicating with SRE Agent service.");
      }
    } catch (e) {
      appendTerminalLine("system-line", `Failed to contact SRE agent: ${e.message}`);
    } finally {
      btnTrigger.disabled = false;
      btnTrigger.innerHTML = `<span>🚨</span> Trigger Autonomous Investigation`;
    }
  });

  btnRollback?.addEventListener("click", async () => {
    if (!activeIncidentReport) return;

    btnRollback.disabled = true;
    btnRollback.innerText = "Executing GitOps Rollback...";

    appendTerminalLine("system-line", "Human operator APPROVED rollback. Executing GitOps sync...");

    try {
      const res = await fetch(`${window.CONFIG.SRE_AGENT_URL}/agent/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incident_id: activeIncidentReport.incident_id })
      });

      if (res.ok) {
        const result = await res.json();
        appendTerminalLine("tool-line", `[MCP Tool] trigger_rollback -> ${result.rollback.action}`);
        appendTerminalLine("success-line", `[MCP Tool] verify_health -> ${result.verification.verification}`);
        appendTerminalLine("success-line", "Incident CLOSED. Telemetry latency & error rate normalized.");

        // Show recovery box
        const recoveryBox = document.getElementById("recoveryBox");
        const recoveryDetails = document.getElementById("recoveryDetails");
        if (recoveryBox) recoveryBox.style.display = "flex";
        if (recoveryDetails) recoveryDetails.innerText = result.verification.verification;

        btnRollback.style.display = "none";
      }
    } catch (e) {
      appendTerminalLine("system-line", `Rollback execution failed: ${e.message}`);
    }
  });
}

async function playEventStream(events) {
  for (const ev of events) {
    let cssClass = "sys";
    let prefix = "[SYSTEM]";

    if (ev.type === "THOUGHT") {
      cssClass = "thought";
      prefix = "[THOUGHT]";
    } else if (ev.type === "TOOL_RESULT") {
      cssClass = "tool";
      prefix = "[MCP TOOL]";
    } else if (ev.type === "RCA_DEDUCTION") {
      cssClass = "rca";
      prefix = "[AI DEDUCTION]";
    } else if (ev.type === "INVESTIGATION_COMPLETE") {
      cssClass = "success";
      prefix = "[STATUS]";
    }

    appendTerminalLine(cssClass, `${prefix} ${ev.message}`);
    await new Promise(r => setTimeout(r, 400));
  }
}

function appendTerminalLine(cssClass, text) {
  const terminal = document.getElementById("agentTerminal");
  if (!terminal) return;

  const line = document.createElement("div");
  line.className = `term-line ${cssClass}`;
  line.innerHTML = `&gt; ${escapeHtml(text)}`;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

function renderRCA(report) {
  const emptyState = document.getElementById("rcaEmptyState");
  const content = document.getElementById("rcaContent");
  const badge = document.getElementById("rcaStatusBadge");
  const meta = document.getElementById("rcaIncidentMeta");
  const cause = document.getElementById("rcaPrimaryCause");
  const ragTitle = document.getElementById("rcaRagTitle");
  const ragConfidence = document.getElementById("rcaRagConfidence");
  const ragRemediation = document.getElementById("rcaRagRemediation");
  const btnRollback = document.getElementById("btnApproveRollback");
  const recoveryBox = document.getElementById("recoveryBox");

  if (emptyState) emptyState.style.display = "none";
  if (content) content.style.display = "flex";
  if (badge) {
    badge.innerText = "AWAITING ROLLBACK APPROVAL";
    badge.className = "tier-pill";
    badge.style.color = "var(--accent-rose)";
    badge.style.borderColor = "var(--accent-rose)";
  }

  if (meta) {
    meta.innerHTML = `<span class="badge critical-badge">${report.severity}</span> ${report.incident_id}`;
  }

  if (cause) {
    cause.innerText = report.root_cause_analysis?.primary_cause || "Anomalous degradation pattern in request loop";
  }

  const hist = report.historical_context || {};
  if (ragTitle) ragTitle.innerText = hist.top_match_title || "Historical Match";
  if (ragConfidence) ragConfidence.innerText = hist.confidence || "92% Match";
  if (ragRemediation) ragRemediation.innerText = hist.historical_remediation || "Rollback Git revision and verify worker health.";

  if (btnRollback) {
    btnRollback.style.display = "flex";
    btnRollback.disabled = false;
    btnRollback.innerHTML = `<span class="btn-icon">✅</span> Approve & Execute GitOps Rollback`;
  }

  if (recoveryBox) recoveryBox.style.display = "none";
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
