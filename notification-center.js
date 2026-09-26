(function () {
    "use strict";

    const DROPDOWN_ID = "medtrackNotificationDropdown";
    const BORROWABLE_ITEM_TYPES = new Set([
        "Medical Equipment",
        "Mobility Asset"
    ]);
    let dropdown = null;
    let activeButton = null;
    let refreshTimer = null;

    function storedArray(key) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(value) ? value : [];
        } catch (error) {
            console.error(`Unable to read ${key} notifications:`, error);
            return [];
        }
    }

    function text(value, fallback = "") {
        const normalized = String(value ?? "").trim();
        return normalized || fallback;
    }

    function number(value) {
        const normalized = Number(value);
        return Number.isFinite(normalized) ? normalized : 0;
    }

    function localDate(value, endOfDay) {
        const normalized = text(value);
        if (!normalized) return null;

        const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
        const parsed = new Date(
            dateOnly
                ? `${normalized}T${endOfDay ? "23:59:59" : "00:00:00"}`
                : normalized
        );
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function detectionTimestamp(record) {
        return localDate(
            record.serverUpdatedAt || record.updatedAt || record.createdAt,
            false
        ) || new Date();
    }

    function notificationLink(page, searchId, query) {
        const parameters = new URLSearchParams({
            search: searchId,
            query: query
        });
        return `${page}?${parameters.toString()}`;
    }

    function buildNotifications() {
        const notifications = [];
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        storedArray("medtrackMedicalSupplies").forEach(function (supply) {
            const id = text(supply.id);
            const name = text(supply.name, id || "Medical supply");
            const quantity = number(supply.quantity);
            const threshold = Math.max(0, number(supply.lowStockLevel));
            const unit = text(supply.unit, "units");
            const href = notificationLink(
                "medical-supplies.html",
                "supplySearch",
                id || name
            );

            if (quantity <= threshold) {
                notifications.push({
                    id: `low-stock:${id || name}`,
                    type: "low-stock",
                    icon: "fa-box-open",
                    label: "Low stock",
                    message: `${name} has ${quantity} ${unit} remaining (minimum ${threshold}).`,
                    timestamp: detectionTimestamp(supply),
                    href: href
                });
            }

            const expiration = localDate(supply.expirationDate, true);
            if (expiration && expiration < startOfToday) {
                notifications.push({
                    id: `expired:${id || name}`,
                    type: "expired",
                    icon: "fa-calendar-xmark",
                    label: "Expired supply",
                    message: `${name} expired on ${expiration.toLocaleDateString()}.`,
                    timestamp: expiration,
                    href: href
                });
            }
        });

        storedArray("medtrackBorrowTransactions").forEach(function (record) {
            if (!BORROWABLE_ITEM_TYPES.has(text(record.itemType))) {
                return;
            }

            const status = text(record.status).toLowerCase();
            const dueDate = localDate(record.dueDate, true);
            if (
                !dueDate ||
                dueDate >= startOfToday ||
                ["returned", "available", "cancelled"].includes(status)
            ) {
                return;
            }

            const id = text(record.id);
            const itemName = text(record.itemName, "Borrowed item");
            const borrower = text(record.borrower, "the borrower");
            notifications.push({
                id: `overdue:${id || itemName}`,
                type: "overdue",
                icon: "fa-clock",
                label: "Overdue item",
                message: `${itemName}, borrowed by ${borrower}, was due ${dueDate.toLocaleDateString()}.`,
                timestamp: dueDate,
                href: notificationLink(
                    "borrow-return.html",
                    "transactionSearch",
                    id || itemName
                )
            });
        });

        return notifications.sort(function (left, right) {
            const priority = { expired: 3, overdue: 2, "low-stock": 1 };
            const priorityDifference = priority[right.type] - priority[left.type];
            return priorityDifference || right.timestamp - left.timestamp;
        });
    }

    function formatTimestamp(value) {
        return new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }).format(value);
    }

    function ensureDropdown() {
        if (dropdown) return dropdown;

        dropdown = document.createElement("section");
        dropdown.id = DROPDOWN_ID;
        dropdown.className = "notification-dropdown";
        dropdown.setAttribute("aria-label", "Notifications");
        dropdown.hidden = true;
        dropdown.innerHTML = [
            '<div class="notification-dropdown-header">',
            '  <div><strong>Notifications</strong><span id="notificationDropdownSummary"></span></div>',
            '  <button type="button" class="notification-close" aria-label="Close notifications">&times;</button>',
            '</div>',
            '<div class="notification-list" id="notificationDropdownList"></div>'
        ].join("");
        document.body.appendChild(dropdown);

        dropdown.querySelector(".notification-close").addEventListener(
            "click",
            closeDropdown
        );
        return dropdown;
    }

    function renderDropdown(notifications) {
        const panel = ensureDropdown();
        const summary = panel.querySelector("#notificationDropdownSummary");
        const list = panel.querySelector("#notificationDropdownList");
        summary.textContent = notifications.length
            ? `${notifications.length} item${notifications.length === 1 ? "" : "s"} need attention`
            : "You're all caught up";
        list.replaceChildren();

        if (notifications.length === 0) {
            const empty = document.createElement("div");
            empty.className = "notification-empty";
            empty.innerHTML = '<i class="fa-solid fa-circle-check" aria-hidden="true"></i><p>No current notifications.</p>';
            list.appendChild(empty);
            return;
        }

        notifications.forEach(function (notification) {
            const link = document.createElement("a");
            link.className = `notification-item notification-${notification.type}`;
            link.href = notification.href;

            const icon = document.createElement("span");
            icon.className = "notification-item-icon";
            icon.innerHTML = `<i class="fa-solid ${notification.icon}" aria-hidden="true"></i>`;

            const content = document.createElement("span");
            content.className = "notification-item-content";

            const label = document.createElement("strong");
            label.textContent = notification.label;

            const message = document.createElement("span");
            message.className = "notification-message";
            message.textContent = notification.message;

            const timestamp = document.createElement("time");
            timestamp.dateTime = notification.timestamp.toISOString();
            timestamp.textContent = formatTimestamp(notification.timestamp);

            content.append(label, message, timestamp);
            link.append(icon, content);
            list.appendChild(link);
        });
    }

    function positionDropdown() {
        if (!dropdown || dropdown.hidden || !activeButton) return;
        const buttonBounds = activeButton.getBoundingClientRect();
        const panelWidth = Math.min(390, window.innerWidth - 24);
        const left = Math.max(
            12,
            Math.min(window.innerWidth - panelWidth - 12, buttonBounds.right - panelWidth)
        );
        dropdown.style.width = `${panelWidth}px`;
        dropdown.style.left = `${left}px`;
        dropdown.style.top = `${Math.min(window.innerHeight - 100, buttonBounds.bottom + 10)}px`;
    }

    function closeDropdown() {
        if (!dropdown || dropdown.hidden) return;
        dropdown.hidden = true;
        if (activeButton) {
            activeButton.setAttribute("aria-expanded", "false");
            activeButton.focus({ preventScroll: true });
        }
        activeButton = null;
    }

    function toggleDropdown(button) {
        const panel = ensureDropdown();
        if (!panel.hidden && activeButton === button) {
            closeDropdown();
            return;
        }

        if (activeButton && activeButton !== button) {
            activeButton.setAttribute("aria-expanded", "false");
        }

        activeButton = button;
        renderDropdown(buildNotifications());
        panel.hidden = false;
        button.setAttribute("aria-expanded", "true");
        positionDropdown();
        panel.querySelector(".notification-close").focus();
    }

    function refreshBadges() {
        const notifications = buildNotifications();
        document.querySelectorAll(".notification-button").forEach(function (button) {
            const badge = button.querySelector("span");
            if (badge) {
                badge.textContent = String(notifications.length);
                badge.hidden = notifications.length === 0;
            }
            button.type = "button";
            button.setAttribute("aria-haspopup", "dialog");
            button.setAttribute("aria-controls", DROPDOWN_ID);
            button.setAttribute("aria-expanded", "false");
            button.setAttribute(
                "aria-label",
                notifications.length
                    ? `Open ${notifications.length} notifications`
                    : "Open notifications"
            );
        });

        if (dropdown && !dropdown.hidden) {
            renderDropdown(notifications);
            positionDropdown();
        }
    }

    function scheduleRefresh() {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(refreshBadges, 0);
    }

    document.addEventListener("click", function (event) {
        const button = event.target instanceof Element
            ? event.target.closest(".notification-button")
            : null;

        if (button) {
            event.preventDefault();
            event.stopImmediatePropagation();
            toggleDropdown(button);
            return;
        }

        if (
            dropdown &&
            !dropdown.hidden &&
            (!(event.target instanceof Element) ||
                !event.target.closest(".notification-dropdown"))
        ) {
            closeDropdown();
        }
    }, true);

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && dropdown && !dropdown.hidden) {
            event.preventDefault();
            closeDropdown();
        }
    });

    window.addEventListener("resize", positionDropdown);
    window.addEventListener("scroll", positionDropdown, true);
    window.addEventListener("storage", scheduleRefresh);
    window.addEventListener("medtrack:data-ready", scheduleRefresh);
    window.addEventListener("medtrack:inventory-changed", scheduleRefresh);
    document.addEventListener("DOMContentLoaded", function () {
        refreshBadges();
        window.setTimeout(refreshBadges, 750);
    });
})();
