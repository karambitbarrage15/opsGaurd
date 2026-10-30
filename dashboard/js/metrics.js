/**
 * ChangeGuard Live Metrics & Chaos Engineering Studio
 */

document.addEventListener("DOMContentLoaded", () => {
  initChaosButtons();
  startMetricsPoller();
});

function initChaosButtons() {
  const btnLatency = document.getElementById("btnChaosLatency");
  const btnError = document.getElementById("btnChaosError");
  const btnMemory = document.getElementById("btnChaosMemory");
  const btnReset = document.getElementById("btnChaosReset");

  if (btnLatency) {
    btnLatency.addEventListener("click", async () => {
      await fetch(`${window.CONFIG.TELEMETRY_URL}/chaos/latency?ms=2500`, { method: "POST" });
      updateChaosUI();
    });
  }

  if (btnError) {
    btnError.addEventListener("click", async () => {
      await fetch(`${window.CONFIG.TELEMETRY_URL}/chaos/error-rate?rate=0.50`, { method: "POST" });
      updateChaosUI();
    });
  }

  if (btnMemory) {
    btnMemory.addEventListener("click", async () => {
      await fetch(`${window.CONFIG.TELEMETRY_URL}/chaos/memory-leak?mb=150`, { method: "POST" });
      updateChaosUI();
    });
  }

  if (btnReset) {
    btnReset.addEventListener("click", async () => {
      await fetch(`${window.CONFIG.TELEMETRY_URL}/chaos/reset`, { method: "POST" });
      updateChaosUI();
    });
  }
}

async function updateChaosUI() {
  try {
    const res = await fetch(`${window.CONFIG.TELEMETRY_URL}/chaos/status`);
    if (res.ok) {
      const data = await res.json();
      const stateEl = document.getElementById("activeChaosState");
      const countEl = document.getElementById("chaosIncidentCount");

      if (data.is_degraded) {
        window.isSystemDegraded = true;
        let desc = [];
        if (data.latency_ms > 0) desc.push(`Latency +${data.latency_ms}ms`);
        if (data.error_rate > 0) desc.push(`Errors ${data.error_rate * 100}%`);
        if (data.leaked_memory_mb > 50) desc.push(`Memory +${data.leaked_memory_mb}MB`);

        if (stateEl) {
          stateEl.innerHTML = `<span style="color: var(--accent-rose);">${desc.join(" | ")}</span>`;
        }
        // Show incident notification badge on Agent tab
        const badge = document.getElementById("agentIncidentBadge");
        if (badge) badge.style.display = "inline-block";
      } else {
        window.isSystemDegraded = false;
        if (stateEl) {
          stateEl.innerHTML = `<span style="color: var(--accent-emerald);">Baseline Healthy</span>`;
        }
        const badge = document.getElementById("agentIncidentBadge");
        if (badge) badge.style.display = "none";
      }

      if (countEl) {
        countEl.innerText = data.active_incidents ? data.active_incidents.length : 0;
      }
    }
  } catch (e) {
    // service maybe starting up
  }
}

function startMetricsPoller() {
  async function poll() {
    try {
      // 1. Fetch latest telemetry
      const res = await fetch(`${window.CONFIG.TELEMETRY_URL}/telemetry/latest?limit=8`);
      if (res.ok) {
        const data = await res.json();
        renderTelemetryTable(data.records || []);
      }

      // 2. Fetch chaos & health status
      const healthRes = await fetch(`${window.CONFIG.TELEMETRY_URL}/health`);
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        const chaos = healthData.chaos_state || {};

        // Calculate dynamic display numbers
        const baseLatency = chaos.latency_ms > 0 ? (chaos.latency_ms + 42) : 42;
        const baseErrors = chaos.error_rate > 0 ? (chaos.error_rate * 100) : 0.0;
        const baseMem = chaos.leaked_memory_mb ? (142 + chaos.leaked_memory_mb) : 142;

        const valLatency = document.getElementById("valLatency");
        const barLatency = document.getElementById("barLatency");
        const valErrorRate = document.getElementById("valErrorRate");
        const trendError = document.getElementById("trendErrorRate");
        const valMemory = document.getElementById("valMemory");
        const barMemory = document.getElementById("barMemory");

        if (valLatency) valLatency.innerHTML = `${Math.round(baseLatency)} <span class="stat-unit">ms</span>`;
        if (barLatency) {
          const pct = Math.min(100, Math.round((baseLatency / 3000) * 100));
          barLatency.style.width = `${pct}%`;
          barLatency.className = baseLatency > 1000 ? "stat-bar danger-bar" : (baseLatency > 200 ? "stat-bar warn-bar" : "stat-bar");
        }

        if (valErrorRate) valErrorRate.innerHTML = `${baseErrors.toFixed(1)} <span class="stat-unit">%</span>`;
        if (trendError) {
          trendError.className = baseErrors > 0 ? "stat-trend negative" : "stat-trend neutral";
          trendError.innerText = baseErrors > 0 ? `↑ Elevated 5xx faults` : "0 failures";
        }

        if (valMemory) valMemory.innerHTML = `${Math.round(baseMem)} <span class="stat-unit">MB</span>`;
        if (barMemory) {
          const memPct = Math.min(100, Math.round((baseMem / 1000) * 100));
          barMemory.style.width = `${memPct}%`;
          barMemory.className = baseMem > 500 ? "stat-bar danger-bar" : "stat-bar info-bar";
        }

        updateChaosUI();
      }
    } catch (e) {
      // connecting
    }
  }

  poll();
  setInterval(poll, 2000);
}

function renderTelemetryTable(records) {
  const tbody = document.getElementById("telemetryBody");
  if (!tbody || !records.length) return;

  tbody.innerHTML = "";
  records.slice(-8).reverse().forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${r.vin}</strong></td>
      <td>${r.fleet_id}</td>
      <td>${r.speed_kmh} km/h</td>
      <td>
        <span style="color: ${r.battery_pct > 30 ? 'var(--accent-emerald)' : 'var(--accent-rose)'}">
          ${r.battery_pct}%
        </span>
      </td>
      <td><code>${r.firmware_version}</code></td>
      <td><span style="color: var(--accent-cyan); font-weight:600;">38ms</span></td>
    `;
    tbody.appendChild(tr);
  });
}
