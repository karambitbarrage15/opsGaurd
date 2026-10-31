// ChangeGuard Dashboard Main App Controller (Polar Theme)
const API_HOST = window.location.hostname || "localhost";

window.CONFIG = {
  TELEMETRY_URL: `http://${API_HOST}:8000`,
  RISK_ENGINE_URL: `http://${API_HOST}:8001`,
  MCP_SERVER_URL: `http://${API_HOST}:8002`,
  SRE_AGENT_URL: `http://${API_HOST}:8003`,
  RAG_ENGINE_URL: `http://${API_HOST}:8004`
};

document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  initTabs();
  initServiceHealthCheck();
  loadPlaybooks();
  initHeroHover();
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
  document.querySelectorAll(".nav-brand, .brand-group").forEach(el => {
    el.addEventListener("click", () => switchTab("tab-home"));
  });

  // Nav CTA launch -> agent
  document.getElementById("btnNavLaunch")?.addEventListener("click", () => {
    switchTab("tab-agent");
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

/**
 * 3D Interactive Perspective Tilt on Hero Mockup (Inspired by Nodebase)
 */
function initHeroHover() {
  const wrapper = document.getElementById("heroMockupWrapper");
  const frame = document.getElementById("heroMockupFrame");
  const glare = document.getElementById("mockupGlare");

  if (!wrapper || !frame) return;

  let isHovered = false;

  wrapper.addEventListener("mouseenter", () => {
    isHovered = true;
    frame.style.transition = "transform 0.1s ease-out, box-shadow 0.3s ease, border-color 0.3s ease";
  });

  wrapper.addEventListener("mousemove", (e) => {
    if (!isHovered) return;
    const rect = wrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Smooth tilt angles (-14 to +14 deg)
    const rotateX = ((centerY - y) / centerY) * 11;
    const rotateY = ((x - centerX) / centerX) * 13;

    frame.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.025)`;

    if (glare) {
      const pctX = (x / rect.width) * 100;
      const pctY = (y / rect.height) * 100;
      glare.style.background = `radial-gradient(circle 420px at ${pctX}% ${pctY}%, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.04) 45%, transparent 75%)`;
      glare.style.opacity = "1";
    }
  });

  wrapper.addEventListener("mouseleave", () => {
    isHovered = false;
    frame.style.transition = "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.6s ease, border-color 0.4s ease";
    frame.style.transform = "rotateX(12deg) rotateY(0deg) scale(0.98)";
    if (glare) {
      glare.style.opacity = "0";
    }
  });
}

/**
 * Scafffold Theme Toggle Controller (Warm Paper Light <-> Night Paper Dark)
 */
function initThemeToggle() {
  const toggleBtn = document.getElementById("btnThemeToggle");
  let currentTheme = localStorage.getItem("opsguard-theme");
  if (!currentTheme) {
    currentTheme = "light";
    localStorage.setItem("opsguard-theme", "light");
  }
  document.documentElement.setAttribute("data-theme", currentTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const nextTheme = current === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", nextTheme);
      localStorage.setItem("opsguard-theme", nextTheme);
    });
  }
}
