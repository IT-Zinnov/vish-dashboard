(function () {
  "use strict";

  const context = window.__COE_CONTEXT__ || {};
  const user = context.user || {};
  const project = context.project;
  const intake = context.intake || {};
  const permissions = context.permissions || {};

  function controlForLabel(text) {
    const label = Array.from(document.querySelectorAll("#pg-intake label")).find(
      (item) => item.textContent.trim().startsWith(text)
    );
    return label && label.closest(".fg")
      ? label.closest(".fg").querySelector("input, select, textarea")
      : null;
  }

  function setControl(control, value) {
    if (!control || value === undefined || value === null || value === "") return;
    control.value = String(value);
  }

  function initials(name) {
    return String(name || user.email || "User")
      .split(/[\s@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
  }

  function roleLabel(role) {
    const labels = {
      platform_admin: "Platform admin",
      team: "Delivery team",
      client_contributor: "Client contributor",
      client_viewer: "Client viewer",
    };
    return labels[role] || "Signed in";
  }

  function setIdentity() {
    const displayName = user.name || user.email || "Signed in";
    const avatar = document.querySelector(".tn-avatar");
    const name = document.querySelector(".tn-uname");
    const role = document.querySelector(".tn-urole");
    if (avatar) avatar.textContent = initials(displayName);
    if (name) name.textContent = displayName;
    if (role) role.textContent = roleLabel(user.role);
  }

  function setVisibility() {
    const staff = Boolean(permissions.staff);
    const published =
      project && ["published", "execution"].includes(project.status);
    const hiddenForClients = ["admin", "pricing", "export", "raci", "exec"];

    if (!staff) {
      hiddenForClients.forEach((id) => {
        const item = document.getElementById("sb-" + id);
        if (item) item.style.display = "none";
      });
      if (!published) {
        ["ai", "dashboard"].forEach((id) => {
          const item = document.getElementById("sb-" + id);
          if (item) item.style.display = "none";
        });
      }
    }

    document.querySelectorAll(".sb-divider").forEach((divider) => {
      const previous = divider.previousElementSibling;
      const next = divider.nextElementSibling;
      if (
        (!previous || previous.style.display === "none") &&
        (!next || next.style.display === "none")
      ) {
        divider.style.display = "none";
      }
    });

    const intakePage = document.getElementById("pg-intake");
    if (intakePage && !permissions.canEdit) {
      intakePage
        .querySelectorAll("input, select, textarea")
        .forEach((field) => (field.disabled = true));
      intakePage
        .querySelectorAll("button")
        .forEach((button) => {
          const text = button.textContent;
          if (/save draft|submit for/i.test(text)) button.style.display = "none";
        });
    }
  }

  function clearDemoDefaults() {
    // The prototype ships a worked example (ABC Corp / 500 HC / Dec 2025) as
    // literal value attributes. Blank them so nothing looks like real data
    // until this project's own intake is loaded over the top.
    const org = document.getElementById("bizOrg");
    if (org) org.value = "";
    const devices = document.getElementById("itDevices");
    if (devices) devices.value = "";
  }

  function hydrateIntake() {
    clearDemoDefaults();
    setControl(document.getElementById("bizOrg"), intake.org || context.tenant?.name);
    setControl(controlForLabel("Parent Company"), intake.parent);
    setControl(controlForLabel("Industry / Sector"), intake.industry);
    setControl(controlForLabel("Request Type"), intake.requestType);
    setControl(
      controlForLabel("Primary Contact Name"),
      intake.contactName || user.name
    );
    setControl(
      controlForLabel("Primary Contact Email"),
      intake.contactEmail || user.email
    );
    setControl(
      controlForLabel("Primary Business Objective"),
      intake.objective
    );
    setControl(document.getElementById("offType"), intake.officeType);
    setControl(controlForLabel("Work Model"), intake.workModel);
    setControl(controlForLabel("Operating Hours"), intake.hours);
    setControl(document.getElementById("primaryFn"), intake.primaryFn);
    setControl(document.getElementById("phasedOcc"), intake.phasedOcc);

    setControl(document.getElementById("hcDay1"), intake.hc1);
    setControl(document.getElementById("hc3"), intake.hc3);
    setControl(document.getElementById("hc6"), intake.hc6);
    setControl(document.getElementById("hc12"), intake.hc12);
    setControl(document.getElementById("hc24"), intake.hc24);
    if (intake.density) {
      const density = document.querySelector(
        'input[name="dens"][value="' + Number(intake.density) + '"]'
      );
      if (density) density.checked = true;
    }
    setControl(controlForLabel("Primary Workspace Style"), intake.workspaceStyle);
    setControl(document.getElementById("dtKickoff"), intake.kickoff);
    setControl(document.getElementById("dtGolive"), intake.golive);
    setControl(controlForLabel("Timeline Urgency"), intake.urgency);
    setControl(controlForLabel("Primary Device Type"), intake.deviceType);

    if (typeof window.applyPhasedOccupancy === "function") {
      window.applyPhasedOccupancy();
    }
    if (typeof window.syncHC === "function") window.syncHC();
    setControl(document.getElementById("itDevices"), intake.devices);
    if (typeof window.syncTimeline === "function") window.syncTimeline();
    if (typeof window.updateCompleteness === "function") {
      window.updateCompleteness();
    }
  }

  function collectIntake() {
    const value = (control) => (control ? control.value : "");
    const number = (id) => {
      const parsed = Number(value(document.getElementById(id)));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const density = document.querySelector('input[name="dens"]:checked');

    return {
      org: value(document.getElementById("bizOrg")),
      parent: value(controlForLabel("Parent Company")),
      industry: value(controlForLabel("Industry / Sector")),
      requestType: value(controlForLabel("Request Type")),
      contactName: value(controlForLabel("Primary Contact Name")),
      contactEmail: value(controlForLabel("Primary Contact Email")),
      objective: value(controlForLabel("Primary Business Objective")),
      officeType: value(document.getElementById("offType")),
      workModel: value(controlForLabel("Work Model")),
      hours: value(controlForLabel("Operating Hours")),
      primaryFn: value(document.getElementById("primaryFn")),
      phasedOcc: value(document.getElementById("phasedOcc")),
      hc1: number("hcDay1"),
      hc3: number("hc3"),
      hc6: number("hc6"),
      hc12: number("hc12"),
      hc24: number("hc24"),
      density: density ? Number(density.value) : 100,
      workspaceStyle: value(controlForLabel("Primary Workspace Style")),
      kickoff: value(document.getElementById("dtKickoff")),
      golive: value(document.getElementById("dtGolive")),
      urgency: value(controlForLabel("Timeline Urgency")),
      deviceType: value(controlForLabel("Primary Device Type")),
      devices: number("itDevices"),
    };
  }

  async function persist(method) {
    if (!project) throw new Error("Create or select a client project first.");
    if (!permissions.canEdit) throw new Error("This intake is view-only.");

    const response = await fetch("/api/dashboard/intake", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        payload: collectIntake(),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || "Unable to save intake.");
    }
    return result;
  }

  async function saveDraft() {
    try {
      await persist("PATCH");
      window.toast("Draft saved to the database.", "ok");
    } catch (error) {
      window.toast(error.message || "Unable to save intake.", "err");
    }
  }

  async function submit() {
    try {
      await persist("POST");
      permissions.canEdit = false;
      permissions.canSubmit = false;
      project.status = "submitted";
      window.toast("Intake submitted to the delivery team.", "ok");
      setVisibility();
      if (permissions.staff) {
        if (typeof window.renderAI === "function") window.renderAI();
        window.nav("ai");
      } else {
        window.nav("home");
      }
    } catch (error) {
      window.toast(error.message || "Unable to submit intake.", "err");
    }
  }

  async function recommendationAction(method, action) {
    if (!project) {
      window.toast("Create or select a project first.", "err");
      return;
    }
    try {
      const response = await fetch("/api/dashboard/recommendation", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, action }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Action failed.");
      window.toast(
        action === "approve"
          ? "Recommendation approved. Assign RACI owners next."
          : "Recommendation generated and saved.",
        "ok"
      );
      if (action === "approve") {
        window.parent.location.href = "/master/projects/" + project.id;
      }
    } catch (error) {
      window.toast(error.message || "Action failed.", "err");
    }
  }

  function wireActions() {
    document.querySelectorAll("button").forEach((button) => {
      if (/save draft/i.test(button.textContent)) {
        button.onclick = null;
        button.addEventListener("click", saveDraft);
      }
    });
    window.submitIntake = submit;

    if (permissions.staff) {
      document.querySelectorAll("button").forEach((button) => {
        if (/regenerate/i.test(button.textContent)) {
          button.onclick = null;
          button.addEventListener("click", () =>
            recommendationAction("POST", "regenerate")
          );
        }
        if (/approve & send to raci/i.test(button.textContent)) {
          button.onclick = null;
          button.addEventListener("click", () =>
            recommendationAction("PATCH", "approve")
          );
        }
      });
    }

    document.querySelectorAll(".sb-new-btn").forEach((button) => {
      button.onclick = null;
      button.addEventListener("click", () => {
        if (project) {
          window.nav("intake");
          window.setStep(1);
        } else {
          window.parent.location.href = permissions.staff ? "/master" : "/portal";
        }
      });
    });

    if (permissions.staff) {
      const destinations = {
        "sb-admin": "/master",
        "sb-raci": project ? "/master/projects/" + project.id : "/master",
      };
      Object.entries(destinations).forEach(([id, destination]) => {
        const element = document.getElementById(id);
        if (!element) return;
        element.onclick = null;
        element.addEventListener("click", () => {
          window.parent.location.href = destination;
        });
      });
    }
  }

  function showNoProjectNotice() {
    const home = document.querySelector("#pg-home .pg-body");
    if (!home) return;
    const notice = document.createElement("div");
    notice.className = "note";
    notice.style.cssText = "margin-bottom:16px;border-left:3px solid #F26522;";
    notice.innerHTML = permissions.staff
      ? "<b>No project selected.</b> Onboard a client and create a project in the team workspace, then reopen this dashboard from that project."
      : "<b>No project assigned yet.</b> Your delivery team will create your project — the intake form unlocks once they do.";
    home.prepend(notice);
  }

  function renderPortfolio() {
    const portfolio = context.portfolio || {};
    const summary = portfolio.summary || {};
    const stats = document.querySelectorAll("#pg-home .stat-v");
    if (stats.length >= 5) {
      stats[0].textContent = String(summary.activeIntakes || 0);
      stats[1].textContent = String(summary.recommendations || 0);
      stats[2].textContent = String(summary.openRaci || 0);
      stats[3].textContent = String((portfolio.projects || []).length);
      stats[4].textContent = "0";
    }
    const statNotes = document.querySelectorAll("#pg-home .stat-s");
    if (statNotes[2]) {
      statNotes[2].textContent = String(summary.overdueRaci || 0) + " overdue";
    }

    const heading = Array.from(
      document.querySelectorAll("#pg-home .fcb > div")
    ).find((element) => element.textContent.trim() === "Recent Intakes");
    const table = heading?.parentElement?.nextElementSibling?.querySelector("tbody");
    if (!table) return;
    table.innerHTML = "";

    const projects = portfolio.projects || [];
    if (!projects.length) {
      const row = table.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 7;
      cell.textContent = "No projects yet.";
      cell.style.cssText = "padding:18px;text-align:center;color:var(--muted);";
      return;
    }

    projects.forEach((item) => {
      const row = table.insertRow();
      const tenantName = item.tenants?.name || context.tenant?.name || "Client";
      [tenantName, "—", "—", item.status.replace("_", " "), "—", "—"].forEach(
        (text, index) => {
          const cell = row.insertCell();
          cell.textContent = text;
          if (index === 0) cell.style.fontWeight = "700";
        }
      );
      const action = row.insertCell();
      const button = document.createElement("button");
      button.className = "btn btn-blue btn-sm";
      button.textContent = "Open";
      button.addEventListener("click", () => {
        window.parent.location.href = "/dashboard?project=" + item.id;
      });
      action.appendChild(button);
    });
  }

  function setProjectContext() {
    renderPortfolio();
    if (!project) {
      showNoProjectNotice();
      return;
    }
    const projectName = project.name;
    const tenantName = context.tenant?.name || intake.org || "Client";
    const dashboardTitle = document.getElementById("dhTitle");
    if (dashboardTitle) {
      dashboardTitle.textContent = "Dashboard — " + tenantName + " · " + projectName;
    }

    const homeTitle = document.querySelector("#pg-home .hero-eyebrow");
    if (homeTitle && project) {
      homeTitle.textContent =
        tenantName + " · " + projectName + " · " + project.status.replace("_", " ");
    }

  }

  document.addEventListener("DOMContentLoaded", function () {
    setIdentity();
    hydrateIntake();
    setProjectContext();
    setVisibility();
    wireActions();
  });
})();
