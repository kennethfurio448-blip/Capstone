(function () {
    "use strict";

    const TOUR_VERSION = "v1";
    const activeKey = "medtrack-walkthrough-active";
    const indexKey = "medtrack-walkthrough-index";
    const mutedKey = "medtrack-walkthrough-muted";
    const completedKey = "medtrack-walkthrough-completed";

    const adminSteps = [
        { page: "admin-dashboard.html", target: ".topbar", title: "Admin Dashboard", text: "This dashboard is the command center for MedTrack. It summarizes the inventory and operational information that administrators need to monitor daily." },
        { page: "admin-dashboard.html", target: ".statistics-grid", title: "Inventory Overview", text: "These summary cards provide a quick count of supplies, equipment, mobility assets, and system users. Select a card to move directly to the related records." },
        { page: "admin-dashboard.html", target: "#inventoryAlertsSection", title: "Priority Alerts", text: "Inventory alerts draw attention to issues such as low stock, unavailable assets, or approaching expiry dates so that action can be planned before operations are affected." },
        { page: "medical-supplies.html", target: "#openAddModal", title: "Medical Supplies", text: "This module records medical supply categories, quantities, expiry dates, and low-stock thresholds. Accurate entries allow MedTrack to identify shortages and expiry risks." },
        { page: "medical-supplies.html", target: "#supplySearch", title: "Find Supply Records", text: "Use search and the nearby filters to locate a supply quickly instead of reviewing every record. The table shows the current information used for inventory monitoring." },
        { page: "medical-supplies.html", target: ".supply-table", title: "Supply Actions", text: "The supply table keeps the registered inventory visible. Use its available actions only after checking the correct item, because changes update the operational stock record." },
        { page: "medical-equipment.html", target: "#openAddModal", title: "Medical Equipment", text: "Medical equipment is tracked separately from consumable supplies because equipment condition, maintenance, and operational status must be monitored throughout its service life." },
        { page: "medical-equipment.html", target: "#equipmentSearch", title: "Equipment Search and Filters", text: "Search and filter by category or status to review the equipment that is relevant to a task, inspection, or maintenance decision." },
        { page: "mobility.html", target: "#openAddModal", title: "Mobility Assets", text: "This module records vehicles and mobility assets, including their condition, assigned driver, location, and status. These details help confirm whether an asset is ready for deployment." },
        { page: "mobility.html", target: "#vehicleSearch", title: "Mobility Monitoring", text: "The search and status filters make it easier to identify available, deployed, or repair-needed assets without manually reviewing every mobility record." },
        { page: "status.html", target: "#openStatusModal", title: "Status Workflow", text: "Use Status to document borrowing, returns, deployment, and other equipment or mobility changes. Recording each change preserves an accountable history of item availability." },
        { page: "status.html", target: "#transactionSearch", title: "Status Records", text: "Search and filtering tools help users locate the correct transaction before reviewing its details or completing an allowed update." },
        { page: "available-items.html", target: "#availableItemSearch", title: "Available Items", text: "This view focuses on inventory that is currently available. It helps staff and administrators identify resources that can support a request or emergency operation." },
        { page: "available-items.html", target: ".available-items-table", title: "Borrowing Workflow", text: "Available item records can be reviewed before initiating a borrowing workflow. The system records borrower, purpose, quantity, and return details to keep inventory accountable." },
        { page: "emergency-response.html", target: "#openAddModal", title: "Emergency Response", text: "Emergency Response creates a documented record for an incident. It brings together the emergency details, assigned team, status, and resources used during the response." },
        { page: "emergency-response.html", target: ".response-table", title: "Items Used", text: "Within a response record, selected items and quantities are gathered into one Items Used list. This preserves the resources associated with the same emergency instead of creating separate records." },
        { page: "manage-users.html", target: "#openAddModal", title: "Manage Users", text: "Administrators manage authorized accounts here. User role and account status control what each person can access, supporting secure role-based operation." },
        { page: "manage-users.html", target: "#userSearch", title: "Account Review", text: "Search and filters make it possible to review specific user accounts efficiently and confirm that access remains appropriate for each role." },
        { page: "reports.html", target: "#reportType", title: "Reports", text: "Reports transform stored inventory and emergency-response information into a selected date-range view that supports monitoring, documentation, and decision-making." },
        { page: "reports.html", target: "#generateReport", title: "Generate and Export", text: "Choose the report type and date range, then generate the result. Printing and CSV export provide documented copies when they are needed for review or submission." },
        { page: "audit-logs.html", target: "#logSearch", title: "Audit Logs", text: "Audit logs provide an accountability trail of system activity. Search and filters help administrators review actions and investigate changes without altering the original records." },
        { page: "settings.html", target: "#generalSection", title: "System Settings", text: "System Settings centralizes configuration such as organizational information, warning thresholds, notifications, security, and backup options. Changes here affect how MedTrack supports operations." },
        { page: "settings.html", target: "#backupSection", title: "Backup and Restore", text: "Use backup tools carefully to protect system data. A protected backup supports recovery when a documented restore process is required." }
    ];

    const staffSteps = [
        { page: "staff-dashboard.html", target: ".topbar", title: "Staff Dashboard", text: "The Staff Dashboard provides an operational overview of the inventory information most relevant to day-to-day work." },
        { page: "staff-dashboard.html", target: ".statistics-grid", title: "Current Inventory Signals", text: "These cards summarize supplies, equipment, available mobility, and low-stock concerns so staff can prioritize the next task." },
        { page: "staff-dashboard.html", target: ".operation-grid", title: "Daily Operations", text: "These shortcuts lead to common staff workflows. They support efficient movement from monitoring information to the appropriate inventory task." },
        { page: "staff-dashboard.html", target: "#inventoryAlertsSection", title: "Items Requiring Action", text: "Alerts identify inventory conditions that may need attention. Reviewing them helps staff respond to shortages or operational issues promptly." },
        { page: "medical-supplies.html", target: "#supplySearch", title: "Medical Supplies", text: "Search and filter the medical supply inventory to find the records relevant to your task. The information shown supports accurate stock awareness." },
        { page: "medical-supplies.html", target: ".supply-table", title: "Supply Information", text: "Review the supply table before using an available action. This helps ensure that quantities, expiry information, and status are considered before an authorized update." },
        { page: "medical-equipment.html", target: "#equipmentSearch", title: "Medical Equipment", text: "This module makes equipment records searchable by category and status, helping staff review readiness and identify assets that require attention." },
        { page: "mobility.html", target: "#vehicleSearch", title: "Mobility Assets", text: "Mobility records show operational status and assignment details. Staff can use filters to locate the assets relevant to a deployment or status check." },
        { page: "status.html", target: "#openStatusModal", title: "Status Updates", text: "Status records document borrowing, returns, deployments, and other changes. Keeping this workflow current allows the team to rely on the availability shown in MedTrack." },
        { page: "available-items.html", target: "#availableItemSearch", title: "Available Items", text: "This page narrows the focus to currently usable resources. It supports faster selection of inventory for operational needs." },
        { page: "available-items.html", target: ".available-items-table", title: "Borrowing Details", text: "When a borrowing action is available, complete its required details accurately. The recorded borrower, quantity, purpose, and return information maintain accountability." },
        { page: "emergency-response.html", target: "#openAddModal", title: "Emergency Response", text: "Emergency Response records the details and resources connected to an incident. This helps the organization retain a complete operational record of the response." },
        { page: "emergency-response.html", target: ".response-table", title: "Resources Used", text: "Items used are collected with their quantities under the same emergency record. This makes the resource history clear and supports accurate post-response reporting." }
    ];

    let profile = null;
    let tour = null;

    function currentPage() {
        return window.location.pathname.split("/").pop() || "admin-dashboard.html";
    }

    function stateKey(prefix) {
        return `${prefix}:${TOUR_VERSION}:${profile && profile.id ? profile.id : document.documentElement.dataset.medtrackRole || "visitor"}`;
    }

    function getSteps() {
        return profile && profile.role === "staff" ? staffSteps : adminSteps;
    }

    function createLaunchButton() {
        const sidebar = document.querySelector(".sidebar");
        const nav = sidebar && sidebar.querySelector(".sidebar-nav");
        if (!sidebar || !nav || sidebar.querySelector(".walkthrough-launch")) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "nav-item walkthrough-launch";
        button.innerHTML = '<i class="fa-solid fa-person-chalkboard" aria-hidden="true"></i><span>System Walkthrough</span>';
        button.title = "Start system walkthrough";
        button.addEventListener("click", function () {
            startTour(0);
        });
        nav.append(button);
    }

    function clearTourElements() {
        document.querySelectorAll(".walkthrough-backdrop, .walkthrough-highlight, .walkthrough-card").forEach(function (element) {
            element.remove();
        });
    }

    function saveProgress(index) {
        sessionStorage.setItem(activeKey, "true");
        sessionStorage.setItem(indexKey, String(index));
    }

    function finishTour(mute) {
        clearTourElements();
        sessionStorage.removeItem(activeKey);
        sessionStorage.removeItem(indexKey);
        document.querySelector(".walkthrough-launch")?.classList.remove("active");
        localStorage.setItem(stateKey(completedKey), "true");
        if (mute) localStorage.setItem(stateKey(mutedKey), "true");
    }

    function positionTour(target, card, highlight) {
        const rect = target.getBoundingClientRect();
        const pad = 7;
        highlight.style.top = `${Math.max(4, rect.top - pad)}px`;
        highlight.style.left = `${Math.max(4, rect.left - pad)}px`;
        highlight.style.width = `${Math.min(window.innerWidth - 8, rect.width + pad * 2)}px`;
        highlight.style.height = `${Math.min(window.innerHeight - 8, rect.height + pad * 2)}px`;

        const cardWidth = Math.min(390, window.innerWidth - 32);
        const below = rect.bottom + 16;
        const top = below + 260 < window.innerHeight ? below : Math.max(16, rect.top - 280);
        const left = Math.min(window.innerWidth - cardWidth - 16, Math.max(16, rect.left));
        card.style.top = `${top}px`;
        card.style.left = `${left}px`;
    }

    function renderStep(index) {
        const steps = getSteps();
        const step = steps[index];
        if (!step) {
            finishTour(false);
            return;
        }

        if (step.page !== currentPage()) {
            saveProgress(index);
            window.location.assign(step.page);
            return;
        }

        const target = document.querySelector(step.target);
        if (!target) {
            const nextOnPage = steps.findIndex(function (candidate, candidateIndex) {
                return candidateIndex > index && candidate.page === currentPage() && document.querySelector(candidate.target);
            });
            renderStep(nextOnPage === -1 ? index + 1 : nextOnPage);
            return;
        }

        clearTourElements();
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

        const backdrop = document.createElement("div");
        backdrop.className = "walkthrough-backdrop";
        const highlight = document.createElement("div");
        highlight.className = "walkthrough-highlight";
        const card = document.createElement("section");
        card.className = "walkthrough-card";
        card.setAttribute("role", "dialog");
        card.setAttribute("aria-modal", "true");
        card.setAttribute("aria-label", "MedTrack system walkthrough");
        card.innerHTML = `<div class="walkthrough-card-header"><h2></h2><span class="walkthrough-step-count"></span></div><p></p><label class="walkthrough-preference"><input type="checkbox"> Don't show this tour automatically again</label><div class="walkthrough-actions"><button type="button" class="walkthrough-button secondary" data-tour="skip">Skip Tour</button><div class="walkthrough-actions-right"><button type="button" class="walkthrough-button secondary" data-tour="previous">Previous</button><button type="button" class="walkthrough-button primary" data-tour="next"></button></div></div>`;
        card.querySelector("h2").textContent = step.title;
        card.querySelector("p").textContent = step.text;
        card.querySelector(".walkthrough-step-count").textContent = `Step ${index + 1} of ${steps.length}`;
        const previous = card.querySelector('[data-tour="previous"]');
        const next = card.querySelector('[data-tour="next"]');
        previous.hidden = index === 0;
        next.textContent = index === steps.length - 1 ? "Finish" : "Next";

        card.querySelector('[data-tour="skip"]').addEventListener("click", function () {
            finishTour(card.querySelector("input").checked);
        });
        previous.addEventListener("click", function () { renderStep(index - 1); });
        next.addEventListener("click", function () {
            if (index === steps.length - 1) {
                finishTour(card.querySelector("input").checked);
            } else {
                renderStep(index + 1);
            }
        });

        document.body.append(backdrop, highlight, card);
        window.setTimeout(function () { positionTour(target, card, highlight); }, 280);
        window.addEventListener("resize", function reposition() {
            if (!document.body.contains(card)) {
                window.removeEventListener("resize", reposition);
                return;
            }
            positionTour(target, card, highlight);
        });
        tour = { index: index };
    }

    function startTour(index) {
        if (!profile || !["admin", "staff"].includes(profile.role)) return;
        localStorage.removeItem(stateKey(mutedKey));
        document.querySelector(".walkthrough-launch")?.classList.add("active");
        renderStep(index || 0);
    }

    async function initialize() {
        if (!window.medtrackAuth || !window.medtrackAuth.getAuthenticatedProfile) return;
        try {
            profile = await window.medtrackAuth.getAuthenticatedProfile();
        } catch (_error) {
            return;
        }
        if (!profile || !["admin", "staff"].includes(profile.role)) return;

        createLaunchButton();
        const activeIndex = Number(sessionStorage.getItem(indexKey));
        if (sessionStorage.getItem(activeKey) === "true" && Number.isInteger(activeIndex)) {
            document.querySelector(".walkthrough-launch")?.classList.add("active");
            window.setTimeout(function () { renderStep(activeIndex); }, 400);
            return;
        }
        if (localStorage.getItem(stateKey(completedKey)) !== "true" && localStorage.getItem(stateKey(mutedKey)) !== "true" && currentPage() === (profile.role === "staff" ? "staff-dashboard.html" : "admin-dashboard.html")) {
            window.setTimeout(function () { startTour(0); }, 900);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
}());
