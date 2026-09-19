(function () {
  "use strict";

  const context = window.__COE_CONTEXT__ || {};
  const user = context.user || {};
  const project = context.project;
  const intake = context.intake || {};
  const permissions = context.permissions || {};
  let recommendation = context.recommendation || null;

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

  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = String(value ?? "");
    return node.innerHTML;
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

  function wireProfileMenu() {
    const trigger = document.querySelector(".tn-user");
    if (!trigger) return;
    trigger.style.position = "relative";
    trigger.style.cursor = "pointer";
    trigger.setAttribute("role", "button");
    trigger.setAttribute("aria-expanded", "false");

    const menu = document.createElement("div");
    menu.style.cssText =
      "display:none;position:absolute;right:0;top:calc(100% + 8px);min-width:210px;background:#fff;border:1px solid var(--border);border-radius:10px;box-shadow:0 12px 30px rgba(11,31,58,.18);padding:8px;z-index:1000;color:var(--text);";
    menu.innerHTML =
      '<div style="padding:8px 10px;border-bottom:1px solid var(--border);margin-bottom:4px;">' +
      '<div class="sm semi">' +
      escapeHtml(user.name || user.email || "Signed in") +
      '</div><div class="xs muted">' +
      escapeHtml(user.email || roleLabel(user.role)) +
      "</div></div>" +
      '<button type="button" id="coe-profile-signout" style="display:flex;width:100%;align-items:center;gap:8px;border:0;background:transparent;padding:9px 10px;border-radius:7px;cursor:pointer;color:var(--red);"><i class="ti ti-logout"></i> Sign out</button>';
    trigger.appendChild(menu);

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = menu.style.display !== "none";
      menu.style.display = open ? "none" : "block";
      trigger.setAttribute("aria-expanded", String(!open));
    });
    document.addEventListener("click", () => {
      menu.style.display = "none";
      trigger.setAttribute("aria-expanded", "false");
    });
    menu.querySelector("#coe-profile-signout")?.addEventListener("click", async (event) => {
      event.stopPropagation();
      const response = await fetch("/api/auth/signout", { method: "POST" });
      if (response.ok) window.parent.location.href = "/login";
      else window.toast("Unable to sign out. Please try again.", "err");
    });
  }

  function wireNotifications() {
    const bell = document.querySelector(".tn-action");
    if (!bell) return;
    const activity = context.portfolio?.activity || [];
    const dot = bell.querySelector(".tn-notif-dot");
    if (dot && !activity.length) dot.style.display = "none";
    bell.onclick = null;
    bell.addEventListener("click", () => {
      window.nav("home");
      const title = Array.from(
        document.querySelectorAll("#pg-home .card-title")
      ).find((element) => element.textContent.trim().startsWith("Recent Activity"));
      title?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.toast(
        activity.length
          ? activity.length + " recent activity update" + (activity.length === 1 ? "" : "s")
          : "No recent activity",
        "info"
      );
    });
  }

  function setVisibility() {
    const staff = Boolean(permissions.staff);
    const hiddenForClients = ["admin", "pricing"];

    if (!staff) {
      hiddenForClients.forEach((id) => {
        const item = document.getElementById("sb-" + id);
        if (item) item.style.display = "none";
      });
      document
        .querySelectorAll("[onclick*=\"nav('pricing')\"]")
        .forEach((control) => (control.style.display = "none"));
    }

    setNavigationLock(
      "ai",
      !staff && !permissions.intelligenceReady,
      "Complete and submit the intake to generate Zinnov Intelligence."
    );
    setNavigationLock(
      "dashboard",
      !staff && !permissions.intelligenceReady,
      "Complete and submit the intake to generate project metrics."
    );
    setNavigationLock(
      "export",
      !staff && !permissions.intelligenceReady,
      "Exports become available after the intake analysis is ready."
    );
    setNavigationLock(
      "raci",
      !permissions.raciPublished && !staff,
      "RACI will unlock after the delivery team publishes assignments."
    );
    setNavigationLock(
      "exec",
      !permissions.raciPublished && !staff,
      "Execution Plan unlocks automatically when the platform admin publishes RACI."
    );
    document.querySelectorAll("[onclick*=\"nav('exec')\"]").forEach((control) => {
      if (staff || permissions.raciPublished || control.dataset.execLockWired) return;
      control.dataset.execLockWired = "true";
      control.style.opacity = "0.55";
      control.style.cursor = "not-allowed";
      control.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          window.toast(
            "Execution Plan unlocks automatically when RACI is published.",
            "info"
          );
        },
        true
      );
    });
    setWorkflowCardAccess();

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
      showIntakeLockNotice();
    }
  }

  function installNavigationGuard() {
    if (window.nav?.__coeGuarded) return;
    const originalNav = window.nav;
    if (typeof originalNav !== "function") return;
    const guardedNav = function (view) {
      if (!permissions.staff && view === "pricing") {
        window.toast("Pricing is available to the delivery team only.", "info");
        return;
      }
      if (!permissions.staff && view === "exec" && !permissions.raciPublished) {
        window.toast(
          "Execution Plan unlocks automatically when RACI is published.",
          "info"
        );
        return;
      }
      return originalNav.apply(this, arguments);
    };
    guardedNav.__coeGuarded = true;
    window.nav = guardedNav;
  }

  function setWorkflowCardAccess() {
    document.querySelectorAll("#pg-home .wf-card").forEach((card) => {
      const title = card.querySelector(".wf-title")?.textContent || "";
      if (
        !permissions.staff &&
        /pricing model|admin settings/i.test(title)
      ) {
        card.style.display = "none";
        return;
      }

      let locked = false;
      let message = "";
      if (
        /ai workplace analysis|visual recommendation dashboard/i.test(title) &&
        !permissions.staff &&
        !permissions.intelligenceReady
      ) {
        locked = true;
        message = "Complete and submit the intake to unlock this analysis.";
      }
      if (/raci assignment center/i.test(title) && !permissions.raciPublished) {
        locked = !permissions.staff;
        message = "RACI unlocks after the platform admin publishes assignments.";
      }
      if (/execution plan/i.test(title) && !permissions.raciPublished) {
        locked = !permissions.staff;
        message = "Execution Plan unlocks automatically when RACI is published.";
      }
      card.dataset.locked = locked ? "true" : "false";
      card.dataset.lockMessage = message;
      card.style.opacity = locked ? "0.55" : "";
      card.style.cursor = locked ? "not-allowed" : "";
      if (!card.dataset.lockWired) {
        card.dataset.lockWired = "true";
        card.addEventListener(
          "click",
          (event) => {
            if (card.dataset.locked !== "true") return;
            event.preventDefault();
            event.stopImmediatePropagation();
            window.toast(card.dataset.lockMessage, "info");
          },
          true
        );
      }
    });
  }

  function setNavigationLock(id, locked, message) {
    const item = document.getElementById("sb-" + id);
    if (!item) return;
    item.dataset.locked = locked ? "true" : "false";
    item.dataset.lockMessage = message;
    item.setAttribute("aria-disabled", locked ? "true" : "false");
    item.style.opacity = locked ? "0.55" : "";
    item.style.cursor = locked ? "not-allowed" : "";

    if (locked && !item.querySelector(".coe-nav-lock")) {
      const lock = document.createElement("i");
      lock.className = "ti ti-lock coe-nav-lock";
      lock.style.cssText = "margin-left:auto;font-size:12px;";
      item.appendChild(lock);
    }
    if (!locked) item.querySelector(".coe-nav-lock")?.remove();

    if (!item.dataset.lockWired) {
      item.dataset.lockWired = "true";
      item.addEventListener(
        "click",
        (event) => {
          if (item.dataset.locked !== "true") return;
          event.preventDefault();
          event.stopImmediatePropagation();
          window.toast(item.dataset.lockMessage, "info");
        },
        true
      );
    }
  }

  function lockReason() {
    if (!project) {
      return permissions.staff
        ? "<b>No project selected.</b> Create a project for a client in the team workspace, then reopen this dashboard from that project."
        : "<b>No project yet.</b> Your delivery team has not created a project for your company, so there is nothing to fill in yet.";
    }
    if (user.role === "client_viewer") {
      return "<b>View-only access.</b> Your role is client viewer, so you can read this intake but not change it. Ask the platform admin to make you a client contributor.";
    }
    if (project.status !== "draft") {
      return (
        "<b>Intake locked.</b> This intake is already " +
        String(project.status).replace("_", " ") +
        ", so it can no longer be edited. Ask the delivery team to reopen it."
      );
    }
    return "<b>Read-only.</b> You do not have permission to edit this intake.";
  }

  // Without this, every field is simply disabled with no explanation, which
  // reads as a broken form rather than a permissions state.
  function showIntakeLockNotice() {
    const body = document.querySelector("#pg-intake .pg-body");
    if (!body || document.getElementById("coe-intake-lock")) return;
    const notice = document.createElement("div");
    notice.id = "coe-intake-lock";
    notice.className = "note";
    notice.style.cssText =
      "margin-bottom:16px;border-left:3px solid #F26522;grid-column:1/-1;";
    notice.innerHTML = lockReason();
    body.prepend(notice);
  }

  function clearDemoDefaults() {
    // The prototype ships a worked example (ABC Corp / 500 HC / Dec 2025) as
    // literal value attributes. Blank them so nothing looks like real data
    // until this project's own intake is loaded over the top.
    const org = document.getElementById("bizOrg");
    if (org) org.value = "";
    const devices = document.getElementById("itDevices");
    if (devices) devices.value = "";
    const kickoff = document.getElementById("dtKickoff");
    if (kickoff) kickoff.value = "";
    const goLive = document.getElementById("dtGolive");
    if (goLive) goLive.value = "";
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
    const spaceSelections = Array.isArray(intake.requiredSpaces)
      ? intake.requiredSpaces
      : null;
    if (spaceSelections || Object.keys(intake).length) {
      document.querySelectorAll("#s4 [data-space]").forEach((label) => {
        const checkbox = label.querySelector('input[type="checkbox"]');
        const checked = Boolean(
          spaceSelections && spaceSelections.includes(label.dataset.space)
        );
        if (checkbox) checkbox.checked = checked;
        label.classList.toggle("on", checked);
      });
    }

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
      requiredSpaces: Array.from(
        document.querySelectorAll("#s4 [data-space]")
      )
        .filter((label) => label.querySelector('input[type="checkbox"]')?.checked)
        .map((label) => label.dataset.space)
        .filter(Boolean),
    };
  }

  function startProcessingAnimation() {
    const overlay = document.getElementById("procOverlay");
    const steps = ["ps1", "ps2", "ps3", "ps4"];
    steps.forEach((id) => document.getElementById(id)?.classList.remove("on"));
    overlay?.classList.add("open");
    steps.forEach((id, index) => {
      window.setTimeout(
        () => document.getElementById(id)?.classList.add("on"),
        250 + index * 750
      );
    });
    return Date.now();
  }

  async function finishProcessingAnimation(startedAt) {
    const minimumDuration = 3000;
    const remaining = minimumDuration - (Date.now() - startedAt);
    if (remaining > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, remaining));
    }
    document.getElementById("procOverlay")?.classList.remove("open");
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element && value !== undefined && value !== null) {
      element.textContent =
        typeof value === "number" ? value.toLocaleString("en-IN") : String(value);
    }
  }

  function renderPersistedRecommendation() {
    if (!recommendation?.output) return;
    const output = recommendation.output;
    const workplace = output.workplace || {};
    const infrastructure = output.infrastructure || {};
    const basis = output.basis || {};
    const schedule = output.schedule || {};
    const tenantName = context.tenant?.name || intake.org || "Client";
    const projectName = project?.name || "Project";

    const heading = document.querySelector("#pg-ai h2");
    if (heading) {
      heading.textContent =
        "Zinnov Intelligence Analysis — " +
        tenantName +
        " · " +
        projectName +
        " · HC: " +
        (basis.headcount || 0).toLocaleString("en-IN") +
        " → " +
        (basis.month24Headcount || basis.headcount || 0).toLocaleString("en-IN");
    }

    setText("aiKpiWs", workplace.workstations);
    setText("aiKpiRooms", workplace.meetingRooms);
    setText("aiKpiRoomsSub", (workplace.meetingSeats || 0) + " meeting seats");
    setText("aiKpiCollab", workplace.collaborationSeats);
    setText("aiKpiCafe", workplace.cafeSeats);
    setText("kpiHC1", basis.headcount);
    setText("kpiHC24", basis.month24Headcount);
    setText("kpiArea", workplace.dayOneAreaSqft);
    setText("kpiDev", infrastructure.devices);
    setText("kpiGolive", schedule.goLive || "To confirm");
    setText("kpiKick", schedule.kickoff ? "from " + schedule.kickoff + " kick-off" : "Kick-off to confirm");

    const riskTable = document.getElementById("aiRiskTable");
    if (riskTable) {
      const risks = output.risks || [];
      riskTable.innerHTML = risks.length
        ? risks
            .map(
              (risk) =>
                "<tr><td>" +
                escapeHtml(risk) +
                '</td><td>Planning</td><td><span class="badge bg-orange">Review</span></td><td>Confirm with the delivery team.</td></tr>'
            )
            .join("")
        : '<tr><td colspan="4">No material gaps identified from the submitted intake.</td></tr>';
    }
  }

  function installRecommendationRenderers() {
    const prototypeRenderAI = window.renderAI;
    if (typeof prototypeRenderAI === "function") {
      window.renderAI = function () {
        prototypeRenderAI();
        renderPersistedRecommendation();
      };
    }
    const prototypeRenderDashboard = window.renderDashboard;
    if (typeof prototypeRenderDashboard === "function") {
      window.renderDashboard = function () {
        prototypeRenderDashboard();
        renderPersistedRecommendation();
      };
    }
  }

  function installLazyRepository() {
    const prototypeNav = window.nav;
    if (typeof prototypeNav !== "function") return;
    let loading = null;
    const loadAssets = () => {
      if (window.__REPO) return Promise.resolve();
      if (loading) return loading;
      loading = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "/repo-assets.js";
        script.onload = resolve;
        script.onerror = () => reject(new Error("Repository assets failed to load."));
        document.body.appendChild(script);
      });
      return loading;
    };

    window.nav = function (id) {
      if (id !== "repo") return prototypeNav(id);
      window.toast("Loading repository…", "info");
      return loadAssets()
        .then(() => prototypeNav(id))
        .catch((error) =>
          window.toast(error.message || "Repository is unavailable.", "err")
        );
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
    const animationStarted = startProcessingAnimation();
    try {
      const result = await persist("POST");
      recommendation = result.recommendation || recommendation;
      context.recommendation = recommendation;
      permissions.canEdit = false;
      permissions.canSubmit = false;
      permissions.intelligenceReady = Boolean(recommendation);
      project.status = result.status || "in_review";
      await finishProcessingAnimation(animationStarted);
      window.toast("Intake submitted and Zinnov Intelligence is ready.", "ok");
      setVisibility();
      window.nav("ai");
    } catch (error) {
      await finishProcessingAnimation(animationStarted);
      window.toast(error.message || "Unable to submit intake.", "err");
    }
  }

  async function recommendationAction(method, action) {
    if (context.isDemo) {
      window.toast("This is a read-only demonstration project.", "info");
      return;
    }
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

  async function requestExport(exportType, button) {
    if (!project) {
      window.toast("Select a project before exporting.", "err");
      return;
    }
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Generating…";
    try {
      const response = await fetch("/api/dashboard/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, exportType }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Export failed.");
      const link = document.createElement("a");
      link.href = result.downloadUrl;
      link.download = result.fileName || "zinnov-export";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.toast("Export generated and downloaded.", "ok");
      await renderExportHistory();
    } catch (error) {
      window.toast(error.message || "Export failed.", "err");
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function bindExportButton(scope, pattern, exportType) {
    const button = Array.from(scope.querySelectorAll("button")).find(
      (candidate) =>
        !candidate.dataset.exportWired && pattern.test(candidate.textContent)
    );
    if (!button) return;
    button.dataset.exportWired = "true";
    button.onclick = null;
    button.addEventListener("click", () => requestExport(exportType, button));
  }

  function installPrintStyles() {
    if (document.getElementById("coe-print-styles")) return;
    const style = document.createElement("style");
    style.id = "coe-print-styles";
    style.textContent = `
      .coe-print-meta { display: none; }
      body.coe-print-mode.coe-print-ai #pg-ai .ai-panel,
      body.coe-print-mode.coe-print-exec #pg-exec .exec-tab-panel {
        display: block !important; visibility: visible !important;
      }
      @media print {
        @page { size: A4 landscape; margin: 9mm; }
        html, body { overflow: visible !important; height: auto !important; background: #fff !important; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .sidebar, .topnav, .toast-wrap, .rmodal, .lightbox { display: none !important; }
        .main { margin-left: 0 !important; width: 100% !important; height: auto !important; }
        .content { padding: 0 !important; overflow: visible !important; height: auto !important; }
        body.coe-print-mode .pg { display: none !important; }
        body.coe-print-ai #pg-ai,
        body.coe-print-dashboard #pg-dashboard,
        body.coe-print-exec #pg-exec { display: block !important; }
        body.coe-print-mode .pg-hd { position: static !important; padding: 0 0 10px !important; }
        body.coe-print-mode .pg-hd .fc-row,
        body.coe-print-mode button,
        body.coe-print-mode .tabs { display: none !important; }
        body.coe-print-mode .pg-body { padding: 0 !important; overflow: visible !important; }
        body.coe-print-mode .coe-print-meta {
          display: block !important; margin: 0 0 12px; padding: 9px 12px;
          border: 1px solid #d9e2f0; border-left: 4px solid #1255cc;
          border-radius: 6px; font-size: 10px; color: #334155;
        }
        body.coe-print-ai #pg-ai .ai-panel,
        body.coe-print-exec #pg-exec .exec-tab-panel {
          display: block !important; visibility: visible !important;
          break-before: page; page-break-before: always;
          padding-top: 6px;
        }
        body.coe-print-ai #pg-ai .ai-panel::before,
        body.coe-print-exec #pg-exec .exec-tab-panel::before {
          content: attr(data-print-title); display: block; margin: 0 0 10px;
          padding: 7px 10px; background: #0a1628; color: #fff;
          border-radius: 5px; font-size: 13px; font-weight: 700;
        }
        body.coe-print-ai #pg-ai #ai-summary,
        body.coe-print-exec #pg-exec #exec-phases {
          break-before: auto; page-break-before: auto;
        }
        body.coe-print-mode .card,
        body.coe-print-mode .chart-w,
        body.coe-print-mode table { break-inside: avoid; page-break-inside: avoid; }
        body.coe-print-mode canvas { max-width: 100% !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function resizeChartsForPrint() {
    const instances = window.Chart?.instances
      ? Object.values(window.Chart.instances)
      : [];
    instances.forEach((chart) => {
      try {
        chart.resize();
        chart.update("none");
      } catch {
        // A hidden or already-destroyed chart can be ignored.
      }
    });
  }

  function printReport(view) {
    if (!project) {
      window.toast("Select a project before printing a report.", "err");
      return;
    }
    installPrintStyles();
    window.nav(view);
    const panelTitles =
      view === "ai"
        ? {
            "ai-summary": "Executive Summary",
            "ai-workplace": "Workplace Configuration",
            "ai-resource": "Resource Provisioning",
            "ai-it": "IT Infrastructure",
            "ai-risks": "Risks and Attention Points",
            "ai-assumptions": "Assumptions",
          }
        : view === "exec"
          ? {
              "exec-phases": "Execution Phases",
              "exec-gantt": "Execution Gantt",
              "exec-handover": "Handover Workflow",
            }
          : {};
    Object.entries(panelTitles).forEach(([id, title]) => {
      document.getElementById(id)?.setAttribute("data-print-title", title);
    });
    if (view === "exec" && typeof window.initGantt === "function") {
      window.initGantt();
    }
    const page = document.getElementById("pg-" + view);
    const body = page?.querySelector(".pg-body");
    if (body && !body.querySelector(".coe-print-meta")) {
      const meta = document.createElement("div");
      meta.className = "coe-print-meta";
      meta.innerHTML =
        "<b>" +
        escapeHtml(context.tenant?.name || "Client") +
        " — " +
        escapeHtml(project.name) +
        "</b><br>Generated " +
        escapeHtml(new Date().toLocaleString()) +
        (context.isDemo ? " · Demonstration data" : "") +
        "<br><b>Required spaces:</b> " +
        escapeHtml(
          Array.isArray(intake.requiredSpaces) && intake.requiredSpaces.length
            ? intake.requiredSpaces.join(", ")
            : "Not captured"
        );
      body.prepend(meta);
    }
    document.body.classList.add("coe-print-mode", "coe-print-" + view);
    const cleanup = () => {
      document.body.classList.remove("coe-print-mode", "coe-print-" + view);
      resizeChartsForPrint();
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(() => {
      resizeChartsForPrint();
      window.setTimeout(() => window.print(), 250);
    }, 150);
  }

  function bindPrintButton(scope, pattern, view) {
    const button = Array.from(scope.querySelectorAll("button")).find(
      (candidate) =>
        !candidate.dataset.exportWired && pattern.test(candidate.textContent)
    );
    if (!button) return;
    button.dataset.exportWired = "true";
    button.onclick = null;
    button.addEventListener("click", () => printReport(view));
  }

  function wireExports() {
    const home = document.getElementById("pg-home");
    const ai = document.getElementById("pg-ai");
    const dashboard = document.getElementById("pg-dashboard");
    const raci = document.getElementById("pg-raci");
    const execution = document.getElementById("pg-exec");

    if (home) {
      bindExportButton(home, /^export excel/i, "intake_xlsx");
      bindPrintButton(home, /^generate pdf/i, "dashboard");
      bindExportButton(home, /^intake summary/i, "intake_csv");
      bindExportButton(home, /^raci export/i, "raci_xlsx");
      const raciExport = Array.from(home.querySelectorAll("button")).find(
        (button) => /^raci export/i.test(button.textContent)
      );
      if (raciExport && !permissions.staff && !permissions.raciPublished) {
        raciExport.style.display = "none";
      }
    }
    if (ai) {
      bindExportButton(ai, /^export excel/i, "intelligence_xlsx");
      bindPrintButton(ai, /^download pdf/i, "ai");
    }
    if (dashboard) {
      bindExportButton(dashboard, /^export excel/i, "dashboard_xlsx");
      bindPrintButton(dashboard, /^generate pdf/i, "dashboard");
    }
    if (raci) bindExportButton(raci, /^export raci/i, "raci_xlsx");
    if (execution) {
      bindPrintButton(execution, /download standard pdf|download pdf/i, "exec");
    }

    renderExportCenter();

    document.querySelectorAll("button").forEach((button) => {
      if (
        !button.dataset.exportWired &&
        /export|download.*pdf|generate pdf|download deck|bulk export|download inclusions|standard pdf/i.test(
          button.textContent
        )
      ) {
        button.style.display = "none";
      }
    });
  }

  let exportHistoryCache = [];
  let exportTypeFilter = "all";

  async function renderExportFilters() {
    const controls = document.querySelector("#pg-export .pg-hd .fc-row");
    if (!controls) return;
    controls.innerHTML =
      '<select class="fc" id="coe-export-project" aria-label="Export project" style="width:280px;padding:6px 10px;font-size:12px;"><option>Loading projects…</option></select>' +
      '<select class="fc" id="coe-export-type" aria-label="Export type" style="width:155px;padding:6px 10px;font-size:12px;">' +
      '<option value="all">All file types</option><option value="intake">Intake</option><option value="intelligence">Intelligence</option><option value="dashboard">Dashboard</option><option value="raci">RACI</option></select>';
    const projectSelect = document.getElementById("coe-export-project");
    const typeSelect = document.getElementById("coe-export-type");
    typeSelect.addEventListener("change", () => {
      exportTypeFilter = typeSelect.value;
      paintExportHistory();
    });
    try {
      const response = await fetch("/api/dashboard/export?scope=projects");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load projects.");
      const projects = result.projects || [];
      projectSelect.innerHTML = "";
      [
        ["Client projects", projects.filter((item) => !item.is_demo)],
        ["Demo clients", projects.filter((item) => item.is_demo)],
      ].forEach(([label, items]) => {
        if (!items.length) return;
        const group = document.createElement("optgroup");
        group.label = label;
        items.forEach((item) => {
          const option = document.createElement("option");
          const tenant = Array.isArray(item.tenants)
            ? item.tenants[0]?.name
            : item.tenants?.name;
          option.value = item.id;
          option.textContent =
            (tenant ? tenant + " — " : "") +
            item.name +
            (item.is_demo ? " (Demo)" : "");
          option.selected = Boolean(project && item.id === project.id);
          group.appendChild(option);
        });
        projectSelect.appendChild(group);
      });
      if (!projects.length) {
        projectSelect.innerHTML = "<option>No projects available</option>";
        projectSelect.disabled = true;
      }
      projectSelect.addEventListener("change", () => {
        window.parent.location.href =
          "/dashboard?project=" +
          encodeURIComponent(projectSelect.value) +
          "&view=export";
      });
    } catch (error) {
      projectSelect.innerHTML =
        "<option>" +
        escapeHtml(error.message || "Unable to load projects") +
        "</option>";
      projectSelect.disabled = true;
    }
  }

  function renderExportCenter() {
    const body = document.querySelector("#pg-export .pg-body");
    if (!body) return;
    renderExportFilters();
    const scopeMessage = permissions.staff
      ? "Select any authorized real or demonstration project above. Every file is generated from that project's current backend data."
      : "Only your selected project can be exported. Files are generated from your latest approved project data.";
    const intakeReady = Boolean(context.intake && Object.keys(context.intake).length);
    const intelligenceReady = Boolean(context.recommendation);
    const raciReady =
      Boolean(context.raci && context.raci.length) &&
      (permissions.staff || permissions.raciPublished);
    body.innerHTML =
      '<div class="card mb3"><div class="fcb"><div><div class="card-title">Project exports</div>' +
      '<div class="xs muted">' +
      escapeHtml((context.tenant?.name || "Client") + " — " + (project?.name || "No project selected")) +
      "</div></div>" +
      (context.isDemo ? '<span class="badge bg-orange">Demo data</span>' : "") +
      "</div>" +
      '<p class="sm muted mb3">' +
      escapeHtml(scopeMessage) +
      " Generated spreadsheets are stored privately; print reports are saved through your browser's Save as PDF option.</p>" +
      '<div class="g2" id="coe-export-actions" style="gap:.75rem;"></div></div>' +
      '<div class="card"><div class="card-title">Export history</div>' +
      '<div class="tbl-wrap"><table><thead><tr><th>File</th><th>Type</th><th>Status</th><th>Created</th><th></th></tr></thead>' +
      '<tbody id="coe-export-history"><tr><td colspan="5">Loading…</td></tr></tbody></table></div></div>';
    const actions = document.getElementById("coe-export-actions");
    const exportActions = [
      ["Intake Excel", "Structured workbook with all submitted inputs", "intake_xlsx", intakeReady],
      ["Intake CSV", "Portable field-by-field intake data", "intake_csv", intakeReady],
      ["Intelligence PDF", "Print the complete on-screen Intelligence report and charts", "print_ai", intelligenceReady],
      ["Intelligence Excel", "Recommendation, workplace, risk and infrastructure sheets", "intelligence_xlsx", intelligenceReady],
      ["Dashboard PDF", "Print the live management dashboard and charts", "print_dashboard", intelligenceReady],
      ["Dashboard Excel", "KPI projections and RACI status workbook", "dashboard_xlsx", intelligenceReady],
      ["RACI Excel", "Formatted published assignment matrix", "raci_xlsx", raciReady],
      ["RACI CSV", "Portable RACI assignment data", "raci_csv", raciReady],
      [
        "Execution Plan PDF",
        "Print phases, Gantt schedule, and handover workflow",
        "print_exec",
        permissions.staff || permissions.raciPublished,
      ],
    ];
    exportActions.forEach(([label, description, type, ready]) => {
      const card = document.createElement("div");
      card.className = "export-card";
      card.style.cursor = ready ? "pointer" : "not-allowed";
      card.style.opacity = ready ? "1" : ".55";
      const text = document.createElement("div");
      text.innerHTML =
        '<div class="sm semi">' +
        escapeHtml(label) +
        '</div><div class="xs muted">' +
        escapeHtml(ready ? description : "Required project data is not available yet") +
        "</div>";
      const button = document.createElement("button");
      button.className = "btn btn-outline btn-sm";
      button.textContent = ready
        ? type.startsWith("print_")
          ? "Print / Save PDF"
          : "Generate"
        : "Unavailable";
      button.disabled = !ready;
      button.dataset.exportWired = "true";
      button.addEventListener("click", () => {
        if (type.startsWith("print_")) {
          printReport(type.replace("print_", ""));
        } else {
          requestExport(type, button);
        }
      });
      card.appendChild(text);
      card.appendChild(button);
      actions.appendChild(card);
    });
    renderExportHistory();
  }

  async function renderExportHistory() {
    const tableBody = document.getElementById("coe-export-history");
    if (!tableBody || !project) return;
    try {
      const response = await fetch(
        "/api/dashboard/export?projectId=" + encodeURIComponent(project.id)
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load exports.");
      exportHistoryCache = result.exports || [];
      paintExportHistory();
    } catch (error) {
      tableBody.innerHTML =
        '<tr><td colspan="5">' +
        escapeHtml(error.message || "Unable to load exports.") +
        "</td></tr>";
    }
  }

  function paintExportHistory() {
    const tableBody = document.getElementById("coe-export-history");
    if (!tableBody) return;
    tableBody.innerHTML = "";
    const items = exportHistoryCache.filter(
      (item) =>
        exportTypeFilter === "all" ||
        item.export_type.startsWith(exportTypeFilter + "_")
    );
    if (!items.length) {
      const row = tableBody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 5;
      cell.textContent =
        exportTypeFilter === "all"
          ? "No exports generated yet."
          : "No matching exports generated yet.";
      return;
    }
    items.forEach((item) => {
        const row = tableBody.insertRow();
        [item.file_name || "Export", item.export_type.replace(/_/g, " "), item.status, relativeTime(item.created_at)].forEach(
          (text) => (row.insertCell().textContent = text)
        );
        const action = row.insertCell();
        if (item.status === "ready") {
          const button = document.createElement("button");
          button.className = "btn btn-ghost btn-sm";
          button.textContent = "Download";
          button.addEventListener("click", async () => {
            const response = await fetch(
              "/api/dashboard/export?projectId=" +
                encodeURIComponent(project.id) +
                "&exportId=" +
                encodeURIComponent(item.id)
            );
            const result = await response.json();
            if (response.ok) window.open(result.downloadUrl, "_blank");
            else window.toast(result.error || "Download failed.", "err");
          });
          action.appendChild(button);
        }
      });
  }

  function wireActions() {
    document.querySelectorAll("button").forEach((button) => {
      if (/save draft/i.test(button.textContent)) {
        button.dataset.realAction = "true";
        button.onclick = null;
        button.addEventListener("click", saveDraft);
      }
    });
    window.submitIntake = submit;
    wireExports();

    document.querySelectorAll("#pg-ai button").forEach((button) => {
      if (/edit assumptions/i.test(button.textContent)) {
        button.style.display = "none";
      }
      if (/approve & send to raci/i.test(button.textContent)) {
        if (!permissions.staff || context.isDemo) {
          button.style.display = "none";
        } else {
          button.style.display = "";
          button.innerHTML =
            '<i class="ti ti-check"></i> Approve Intelligence &amp; Proceed to RACI';
          button.onclick = null;
          button.addEventListener("click", () =>
            recommendationAction("PATCH", "approve")
          );
        }
      }
      if (
        /^send to raci/i.test(button.textContent.trim()) &&
        !permissions.staff &&
        !permissions.raciPublished
      ) {
        button.style.display = "none";
      }
      if (
        (!permissions.staff || context.isDemo) &&
        /regenerate/i.test(button.textContent)
      ) {
        button.style.display = "none";
      }
    });

    if (permissions.staff) {
      document.querySelectorAll("button").forEach((button) => {
        if (/regenerate/i.test(button.textContent)) {
          button.onclick = null;
          button.addEventListener("click", () =>
            recommendationAction("POST", "regenerate")
          );
        }
      });
    }

    // The sidebar CTA and the hero CTA must behave identically. The hero button
    // is not a .sb-new-btn, so it used to drop straight into a dead form while
    // the sidebar button correctly bounced to the workspace.
    const startIntakeButtons = new Set(document.querySelectorAll(".sb-new-btn"));
    document.querySelectorAll("button").forEach((button) => {
      if (/start new intake/i.test(button.textContent)) {
        startIntakeButtons.add(button);
      }
    });
    startIntakeButtons.forEach((button) => {
      button.onclick = null;
      button.addEventListener("click", () => {
        if (!project || context.isDemo) {
          window.parent.location.href = permissions.staff ? "/master" : "/portal";
          return;
        }
        window.nav("intake");
        window.setStep(1);
      });
    });

    if (permissions.staff) {
      const destinations = {
        "sb-admin": "/master",
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

    document.querySelectorAll("button").forEach((button) => {
      if (
        !button.dataset.realAction &&
        !button.dataset.exportWired &&
        /save|update defaults/i.test(button.textContent)
      ) {
        button.style.display = "none";
      }
    });
  }

  function renderRaci() {
    const page = document.getElementById("pg-raci");
    const tableBody = page?.querySelector("tbody");
    if (!page || !tableBody) return;

    const tenantName = context.tenant?.name || "Client";
    const subtitle = page.querySelector(".pg-hd-l p");
    if (subtitle) {
      subtitle.textContent =
        "Client: " +
        tenantName +
        " · Project: " +
        (project?.name || "No project") +
        " · " +
        (permissions.raciPublished ? "Published" : "Draft");
    }

    tableBody.innerHTML = "";
    const rows = context.raci || [];
    if (!rows.length) {
      const row = tableBody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 8;
      cell.textContent = permissions.raciPublished
        ? "No RACI assignments have been added."
        : "RACI is being prepared by the delivery team.";
      cell.style.cssText = "padding:18px;text-align:center;color:var(--muted);";
    } else {
      rows.forEach((item) => {
        const row = tableBody.insertRow();
        [
          [item.workstream, ""],
          [item.responsible || "—", item.responsible_email || ""],
          [item.accountable || "—", item.accountable_email || ""],
          [item.consulted || "—", item.consulted_email || ""],
          [item.informed || "—", item.informed_email || ""],
          [item.due_date || "—", ""],
          [String(item.status || "unassigned").replace("_", " "), ""],
        ].forEach(([value, email], index) => {
          const cell = row.insertCell();
          cell.innerHTML =
            "<div>" +
            escapeHtml(value) +
            "</div>" +
            (email
              ? '<div class="xs muted" style="margin-top:2px;">' +
                escapeHtml(email) +
                "</div>"
              : "");
          if (index === 0) cell.style.fontWeight = "700";
        });
        row.insertCell().textContent = "";
      });
    }

    page.querySelectorAll("button").forEach((button) => {
      if (
        /auto assign|notify owners|save assignments|send notifications|lock raci/i.test(
          button.textContent
        )
      ) {
        button.style.display = "none";
      }
      if (/edit raci matrix/i.test(button.textContent)) {
        if (!permissions.staff) {
          button.style.display = "none";
        } else {
          button.onclick = null;
          button.addEventListener("click", () => {
            window.parent.location.href = "/master/projects/" + project.id;
          });
        }
      }
    });
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
      stats[3].textContent = String(summary.repositoryProjects || 0);
      stats[4].textContent = String(summary.exportsGenerated || 0);
    }
    const statNotes = document.querySelectorAll("#pg-home .stat-s");
    if (statNotes[0])
      statNotes[0].textContent =
        String(summary.awaitingInputs || 0) + " awaiting inputs";
    if (statNotes[1])
      statNotes[1].textContent =
        String(summary.readyForReview || 0) + " ready for review";
    if (statNotes[2])
      statNotes[2].textContent = String(summary.overdueRaci || 0) + " overdue";
    if (statNotes[3])
      statNotes[3].textContent =
        String(summary.repositoryProjects || 0) + " published case studies";
    if (statNotes[4]) statNotes[4].textContent = "available downloads";
    renderActivity(portfolio.activity || []);

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
      const intakeRecord = Array.isArray(item.intakes)
        ? item.intakes[0]
        : item.intakes;
      const payload = intakeRecord?.payload || {};
      const headcount =
        payload.hc1 || payload.hc24
          ? String(payload.hc1 || 0) + " → " + String(payload.hc24 || payload.hc1 || 0)
          : "—";
      [
        item.is_demo ? tenantName + " (Demo)" : tenantName,
        payload.city || "—",
        headcount,
        item.status.replace("_", " "),
        relativeTime(intakeRecord?.updated_at || item.created_at),
        "—",
      ].forEach(
        (text, index) => {
          const cell = row.insertCell();
          cell.textContent = text;
          if (index === 0) cell.style.fontWeight = "700";
          if (index === 0 && item.is_demo) cell.style.color = "var(--orange)";
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

  function relativeTime(value) {
    if (!value) return "—";
    const elapsed = Date.now() - new Date(value).getTime();
    if (!Number.isFinite(elapsed) || elapsed < 0) return "Just now";
    const minutes = Math.floor(elapsed / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return minutes + " min ago";
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + " hr" + (hours === 1 ? "" : "s") + " ago";
    const days = Math.floor(hours / 24);
    return days + " day" + (days === 1 ? "" : "s") + " ago";
  }

  function renderActivity(items) {
    const title = Array.from(document.querySelectorAll("#pg-home .card-title")).find(
      (element) => element.textContent.trim().startsWith("Recent Activity")
    );
    const card = title?.parentElement;
    if (!card) return;
    card.querySelectorAll(".act-item").forEach((item) => item.remove());

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "act-item";
      empty.textContent = "No activity yet.";
      empty.style.color = "var(--muted)";
      card.appendChild(empty);
      return;
    }

    const iconByEvent = {
      "intake.submitted": ["ti-clipboard-check", "act-blue"],
      "recommendation.generated": ["ti-sparkles", "act-green"],
      "raci.published": ["ti-sitemap", "act-orange"],
      "export.generated": ["ti-download", "act-blue"],
    };
    items.forEach((item) => {
      const [icon, color] = iconByEvent[item.event_type] || [
        "ti-activity",
        "act-gray",
      ];
      const row = document.createElement("div");
      row.className = "act-item";
      const projectName = Array.isArray(item.projects)
        ? item.projects[0]?.name
        : item.projects?.name;
      row.innerHTML =
        '<div class="act-ic ' +
        color +
        '"><i class="ti ' +
        icon +
        '"></i></div><div><div class="act-txt">' +
        escapeHtml(item.summary) +
        (projectName ? " for <b>" + escapeHtml(projectName) + "</b>" : "") +
        '</div><div class="act-time">' +
        relativeTime(item.created_at) +
        "</div></div>";
      card.appendChild(row);
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

    if (context.isDemo) {
      ["#pg-home .pg-body", "#pg-ai .pg-body", "#pg-dashboard .pg-body"].forEach(
        (selector) => {
          const body = document.querySelector(selector);
          if (!body || body.querySelector(".coe-demo-notice")) return;
          const notice = document.createElement("div");
          notice.className = "note coe-demo-notice";
          notice.style.cssText =
            "margin-bottom:14px;border-left:3px solid var(--orange);";
          notice.innerHTML =
            "<b>Demonstration client.</b> " +
            escapeHtml(tenantName) +
            " is an anonymized sample kept permanently for walkthroughs. It is excluded from your portfolio totals and can be shown alongside real clients.";
          body.prepend(notice);
        }
      );
    }

  }

  function openInitialView() {
    const view = context.initialView || "home";
    if (!permissions.staff && view === "pricing") {
      window.nav("home");
      return;
    }
    if (
      !permissions.staff &&
      ["ai", "dashboard", "export"].includes(view) &&
      !permissions.intelligenceReady
    ) {
      window.nav("home");
      return;
    }
    if (
      !permissions.staff &&
      view === "raci" &&
      !permissions.raciPublished
    ) {
      window.nav("home");
      return;
    }
    if (
      !permissions.staff &&
      view === "exec" &&
      !permissions.raciPublished
    ) {
      window.nav("home");
      window.toast(
        "Execution Plan unlocks automatically when RACI is published.",
        "info"
      );
      return;
    }
    if (view !== "home") window.nav(view);
  }

  document.addEventListener("DOMContentLoaded", function () {
    setIdentity();
    wireProfileMenu();
    wireNotifications();
    hydrateIntake();
    installRecommendationRenderers();
    installLazyRepository();
    renderPersistedRecommendation();
    renderRaci();
    setProjectContext();
    installNavigationGuard();
    setVisibility();
    wireActions();
    openInitialView();
  });
})();
