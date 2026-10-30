/**
 * ChangeGuard Dashboard Main App Controller (Polar Theme)
 */

window.CONFIG = {
  TELEMETRY_URL: "http://localhost:8000",
  RISK_ENGINE_URL: "http://localhost:8001",
  MCP_SERVER_URL: "http://localhost:8002",
  SRE_AGENT_URL: "http://localhost:8003",
  RAG_ENGINE_URL: "http://localhost:8004"
};

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initServiceHealthCheck();
  loadPlaybooks();
});

function switchTab(targetId) {
  const tabs = document.querySelectorAll(".nav-link");
  const pages = document.querySelectorAll(".page-tab");

  tabs.forEach(t => {
    if (t.getAttribute("data-tab") === targetId) {
      t.classList.add("active");
    } else {
      t.classList.remove("active");
    }
  });

  pages.forEach(p => {
    if (p.id === targetId) {
      p.classList.add("active");
    } else {
      p.classList.remove("active");
    }
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initTabs() {
  // Nav bar links
  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach(link => {
    link.addEventListener("click", () => {
      const targetId = link.getAttribute("data-tab");
      if (targetId) switchTab(targetId);
    });
  });

  // Brand click -> home
  document.querySelector(".nav-brand")?.addEventListener("click", () => {
    switchTab("tab-home");
  });

  // Nav CTA launch -> operations
  document.getElementById("btnNavLaunch")?.addEventListener("click", () => {
    switchTab("tab-operations");
  });

  // Any element with data-tab-switch attribute
  document.querySelectorAll("[data-tab-switch]").forEach(el => {
    el.addEventListener("click", () => {
      const target = el.getAttribute("data-tab-switch");
      if (target) switchTab(target);
    });
  });
}

async function checkHealth(url) {
  try {
    const res = await fetch(`${url}/health`, { method: "GET" });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function initServiceHealthCheck() {
  const dots = {
    dotTelemetry: window.CONFIG.TELEMETRY_URL,
    dotRisk: window.CONFIG.RISK_ENGINE_URL,
    dotMcp: window.CONFIG.MCP_SERVER_URL,
    dotAgent: window.CONFIG.SRE_AGENT_URL,
    dotRag: window.CONFIG.RAG_ENGINE_URL
  };

  async function updateHealth() {
    let allHealthy = true;
    for (const [dotId, url] of Object.entries(dots)) {
      const el = document.getElementById(dotId);
      if (!el) continue;
      const isUp = await checkHealth(url);
      if (isUp) {
        el.className = "health-dot dot-live";
      } else {
        el.className = "health-dot dot-critical";
        allHealthy = false;
      }
    }

    const pill = document.getElementById("globalStatusPill");
    const text = document.getElementById("globalStatusText");
    if (!pill || !text) return;

    if (window.isSystemDegraded) {
      pill.style.background = "rgba(244, 63, 94, 0.15)";
      pill.style.borderColor = "rgba(244, 63, 94, 0.4)";
      pill.style.color = "var(--accent-rose)";
      text.innerText = "INCIDENT DEGRADATION";
    } else if (allHealthy) {
      pill.style.background = "rgba(16, 185, 129, 0.1)";
      pill.style.borderColor = "rgba(16, 185, 129, 0.3)";
      pill.style.color = "var(--accent-emerald)";
      text.innerText = "ALL SYSTEMS NORMAL";
    } else {
      pill.style.background = "rgba(16, 185, 129, 0.1)";
      pill.style.borderColor = "rgba(16, 185, 129, 0.3)";
      pill.style.color = "var(--accent-emerald)";
      text.innerText = "SYSTEM ACTIVE";
    }
  }

  updateHealth();
  setInterval(updateHealth, 5000);
}

async function loadPlaybooks() {
  const grid = document.getElementById("kbGrid");
  if (!grid) return;

  try {
    const res = await fetch(`${window.CONFIG.RAG_ENGINE_URL}/rag/postmortems`);
    if (res.ok) {
      const data = await res.json();
      grid.innerHTML = "";
      data.postmortems.forEach(doc => {
        const card = document.createElement("div");
        card.className = "playbook-flat-card";
        card.innerHTML = `
          <div class="playbook-card-head">
            <strong>${doc.title}</strong>
            <span class="tier-pill" style="color: ${doc.severity === 'P1' ? 'var(--accent-rose)' : 'var(--accent-amber)'}">${doc.severity}</span>
          </div>
          <p><strong>Root Cause:</strong> ${doc.root_cause}</p>
        `;
        grid.appendChild(card);
      });
    }
  } catch (e) {
    grid.innerHTML = `<div class="muted-text">Knowledge base engine connecting...</div>`;
  }
}
