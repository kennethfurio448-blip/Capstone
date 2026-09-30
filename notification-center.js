(function () {
    "use strict";

    const DROPDOWN_ID = "medtrackNotificationDropdown";
    const STATE_KEY = "medtrackNotificationState";
    const ADDITION_CACHE_KEY = "medtrackInventoryItemAdditions";
    const REMOTE_ADDITION_PAGE_SIZE = 50;
    const VISIBLE_NOTIFICATION_PAGE_SIZE = 20;
    const ALWAYS_VISIBLE_CATEGORIES = [
        "Medical Supplies",
        "Medical Equipment",
        "Mobility"
    ];
    const ALWAYS_VISIBLE_STATUSES = ["Available"];
    const STATUS_OPTIONS_BY_CATEGORY = Object.freeze({
        "Medical Supplies": [
            "Available",
            "Low stock",
            "Out of stock",
            "Expired"
        ],
        "Medical Equipment": [
            "Available",
            "Borrowed",
            "Returned",
            "Missing",
            "Damaged",
            "For Repair"
        ],
        Mobility: [
            "Available",
            "Borrowed",
            "Returned",
            "Missing",
            "Damaged",
            "For Repair"
        ]
    });
    const BORROWABLE_ITEM_TYPES = new Set([
        "Medical Equipment",
        "Mobility Asset"
    ]);
    let dropdown = null;
    let activeButton = null;
    let refreshTimer = null;
    let activeView = "active";
    let notificationUserId = null;
    let remoteSaveTimer = null;
    let additionRefreshTimer = null;
    let additionHasMore = false;
    let additionLoading = false;
    let visibleNotificationCount = VISIBLE_NOTIFICATION_PAGE_SIZE;
    const notificationFilters = {
        category: "all",
        status: "all",
        unread: false,
        date: "all"
    };

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

    function notificationState() {
        try {
            const state = JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
            return {
                readIds: Array.isArray(state.readIds) ? state.readIds : [],
                dismissed: Array.isArray(state.dismissed) ? state.dismissed : []
            };
        } catch (error) {
            return { readIds: [], dismissed: [] };
        }
    }

    function normalizedNotificationState(state) {
        const normalized = {
            readIds: Array.from(new Set(state.readIds)).slice(-1000),
            dismissed: state.dismissed.slice(-500)
        };
        const encodedSize = function () {
            return new TextEncoder().encode(JSON.stringify(normalized)).length;
        };

        while (normalized.dismissed.length > 0 && encodedSize() > 120000) {
            normalized.dismissed.shift();
        }
        while (normalized.readIds.length > 0 && encodedSize() > 120000) {
            normalized.readIds.shift();
        }
        return normalized;
    }

    function saveNotificationState(state) {
        const normalized = normalizedNotificationState(state);
        localStorage.setItem(STATE_KEY, JSON.stringify(normalized));
        scheduleRemoteStateSave(normalized);
    }

    function mergeNotificationStates(localState, remoteState) {
        const dismissed = new Map();
        [...remoteState.dismissed, ...localState.dismissed].forEach(function (item) {
            if (!item || !item.id || !item.timestamp) return;
            dismissed.set(`${item.id}@${item.timestamp}`, item);
        });
        return {
            readIds: Array.from(new Set([
                ...remoteState.readIds,
                ...localState.readIds
            ])).slice(-1000),
            dismissed: Array.from(dismissed.values()).slice(-500)
        };
    }

    function scheduleRemoteStateSave(state) {
        window.clearTimeout(remoteSaveTimer);
        if (!notificationUserId || !navigator.onLine || !window.medtrackSupabase) return;
        remoteSaveTimer = window.setTimeout(async function () {
            const result = await window.medtrackSupabase
                .from("notification_preferences")
                .upsert({
                    user_id: notificationUserId,
                    state: state,
                    updated_at: new Date().toISOString()
                }, { onConflict: "user_id" });
            if (result.error) {
                console.error("Unable to synchronize notification preferences:", result.error);
            }
        }, 350);
    }

    async function loadRemoteNotificationState() {
        if (!window.medtrackSupabase || !navigator.onLine) return;
        const userResult = await window.medtrackSupabase.auth.getUser();
        const user = userResult.data && userResult.data.user;
        if (!user) return;
        notificationUserId = user.id;

        const result = await window.medtrackSupabase
            .from("notification_preferences")
            .select("state")
            .eq("user_id", user.id)
            .maybeSingle();
        if (result.error) {
            console.error("Unable to load synchronized notification preferences:", result.error);
            return;
        }

        const remote = result.data && result.data.state
            ? result.data.state
            : { readIds: [], dismissed: [] };
        const merged = mergeNotificationStates(
            notificationState(),
            {
                readIds: Array.isArray(remote.readIds) ? remote.readIds : [],
                dismissed: Array.isArray(remote.dismissed) ? remote.dismissed : []
            }
        );
        saveNotificationState(merged);
        scheduleRefresh();
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

    function inventoryItemLink(page, searchId, itemId) {
        const parameters = new URLSearchParams({
            search: searchId,
            query: itemId,
            action: "details",
            item: itemId
        });
        return `${page}?${parameters.toString()}`;
    }

    function inventoryAdditionNotifications() {
        const seenAdditions = new Set();
        const modules = {
            medical_supplies: {
                category: "Medical Supplies",
                page: "medical-supplies.html",
                searchId: "supplySearch",
                icon: "fa-pills"
            },
            medical_equipment: {
                category: "Medical Equipment",
                page: "medical-equipment.html",
                searchId: "equipmentSearch",
                icon: "fa-suitcase-medical"
            },
            mobility_assets: {
                category: "Mobility",
                page: "mobility.html",
                searchId: "vehicleSearch",
                icon: "fa-truck-medical"
            }
        };

        return storedArray(ADDITION_CACHE_KEY).flatMap(function (event) {
            const module = modules[text(event.inventoryModule)];
            const itemId = text(event.inventoryItemId);
            const itemName = text(event.itemName, itemId || "Inventory item");
            const itemCategory = text(event.itemCategory);
            const itemStatus = canonicalNotificationStatus(
                module.category,
                event.itemStatus
            );
            const actorName = text(event.actorName, "System");
            const timestamp = localDate(event.occurredAt, false);
            const eventIdentity = text(
                event.eventKey,
                `${event.inventoryModule}:${itemId}:${event.occurredAt}`
            );

            if (
                !module ||
                !itemId ||
                !timestamp ||
                seenAdditions.has(eventIdentity)
            ) return [];

            seenAdditions.add(eventIdentity);

            const category = itemCategory
                ? `${module.category} / ${itemCategory}`
                : module.category;

            return [{
                id: `item-created:${eventIdentity}`,
                type: "item-added",
                icon: module.icon,
                label: "New inventory item",
                message: `${itemName} was added by ${actorName}. ` +
                    `Category: ${category}. Status: ${itemStatus}.`,
                category: module.category,
                status: itemStatus,
                timestamp: timestamp,
                href: inventoryItemLink(module.page, module.searchId, itemId)
            }];
        });
    }

    function canonicalNotificationStatus(category, value) {
        if (category === "Mobility") {
            return canonicalMobilityStatus(value);
        }

        const status = text(value).toLowerCase();
        if (category === "Medical Supplies") {
            if (status === "expired") return "Expired";
            if (["out of stock", "unavailable"].includes(status)) {
                return "Out of stock";
            }
            if (status === "low stock") return "Low stock";
            return "Available";
        }

        if (category === "Medical Equipment") {
            return canonicalEquipmentStatus(value);
        }

        return text(value, "Not recorded");
    }

    function canonicalEquipmentStatus(value, conditionValue) {
        const status = text(value).toLowerCase();
        const condition = text(conditionValue).toLowerCase();
        if (status === "missing" || condition === "missing") return "Missing";
        if (status === "damaged" || condition === "damaged") return "Damaged";
        if ([
            "maintenance",
            "under maintenance",
            "for repair",
            "under repair",
            "repair",
            "unavailable"
        ].includes(status)) {
            return "For Repair";
        }
        if (["borrowed", "in use", "assigned", "deployed"].includes(status)) {
            return "Borrowed";
        }
        if (status === "returned") return "Returned";
        return "Available";
    }

    function canonicalMobilityStatus(value, conditionValue) {
        const status = text(value).toLowerCase();
        const condition = text(conditionValue).toLowerCase();
        if (status === "missing" || condition === "missing") return "Missing";
        if (status === "damaged" || condition === "damaged") return "Damaged";
        if (["borrowed", "in use", "assigned", "deployed"].includes(status)) {
            return "Borrowed";
        }
        if (status === "returned") return "Returned";
        if (status === "missing") return "Missing";
        if (status === "damaged") return "Damaged";
        if ([
            "maintenance",
            "under maintenance",
            "for repair",
            "under repair",
            "repair",
            "unavailable"
        ].includes(status)) {
            return "For Repair";
        }
        return "Available";
    }

    function inventoryStatusNotifications() {
        const notifications = [];

        storedArray("medtrackMedicalEquipment").forEach(function (equipment) {
            const id = text(equipment.id);
            if (!id) return;
            const name = text(equipment.name, id);
            const status = canonicalEquipmentStatus(
                equipment.status,
                equipment.condition
            );
            notifications.push({
                id: `current-status:medical-equipment:${id}`,
                type: "inventory-status",
                icon: "fa-suitcase-medical",
                label: "Medical equipment status",
                message: `${name} is currently ${status}.`,
                category: "Medical Equipment",
                status: status,
                timestamp: detectionTimestamp(equipment),
                href: inventoryItemLink(
                    "medical-equipment.html",
                    "equipmentSearch",
                    id
                )
            });
        });

        storedArray("medtrackMobilityAssets").forEach(function (asset) {
            const id = text(asset.id);
            if (!id) return;
            const name = text(asset.name, id);
            const status = canonicalMobilityStatus(
                asset.status,
                asset.condition
            );
            notifications.push({
                id: `current-status:mobility:${id}`,
                type: "inventory-status",
                icon: "fa-truck-medical",
                label: "Mobility status",
                message: `${name} is currently ${status}.`,
                category: "Mobility",
                status: status,
                timestamp: detectionTimestamp(asset),
                href: inventoryItemLink(
                    "mobility.html",
                    "vehicleSearch",
                    id
                )
            });
        });

        return notifications;
    }

    async function loadInventoryAdditions(reset = false) {
        if (
            !navigator.onLine ||
            !window.medtrackSupabase ||
            additionLoading
        ) return;

        additionLoading = true;
        const cachedEvents = reset ? [] : storedArray(ADDITION_CACHE_KEY);
        const offset = cachedEvents.length;

        try {
            const result = await window.medtrackSupabase
                .from("inventory_activity_events")
                .select(
                    "id, event_key, inventory_module, inventory_item_id, " +
                    "occurred_at, metadata"
                )
                .eq("event_type", "item_created")
                .order("occurred_at", { ascending: false })
                .order("id", { ascending: false })
                .range(offset, offset + REMOTE_ADDITION_PAGE_SIZE - 1);

            if (result.error) {
                console.error("Unable to load new-item notifications:", result.error);
                return;
            }

            const page = (result.data || []).map(function (event) {
                const metadata = event.metadata || {};
                return {
                    id: event.id,
                    eventKey: event.event_key,
                    inventoryModule: event.inventory_module,
                    inventoryItemId: event.inventory_item_id,
                    itemName: metadata.itemName || "",
                    itemCategory: metadata.itemCategory || "",
                    itemStatus: metadata.itemStatus || "",
                    actorName: metadata.actorName || "System",
                    occurredAt: event.occurred_at
                };
            });
            const eventsByKey = new Map();

            [...cachedEvents, ...page].forEach(function (event) {
                const identity = text(
                    event.eventKey,
                    `${event.inventoryModule}:${event.inventoryItemId}:${event.occurredAt}`
                );
                if (identity) eventsByKey.set(identity, event);
            });

            additionHasMore = page.length === REMOTE_ADDITION_PAGE_SIZE;
            localStorage.setItem(
                ADDITION_CACHE_KEY,
                JSON.stringify(Array.from(eventsByKey.values()))
            );
            scheduleRefresh();
        } finally {
            additionLoading = false;
        }
    }

    function scheduleAdditionRefresh() {
        window.clearTimeout(additionRefreshTimer);
        additionRefreshTimer = window.setTimeout(function () {
            loadInventoryAdditions(true);
        }, 150);
    }

    function buildNotifications() {
        const notifications = [
            ...inventoryAdditionNotifications(),
            ...inventoryStatusNotifications()
        ];
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const serviceWindowEnd = new Date(startOfToday);
        serviceWindowEnd.setDate(serviceWindowEnd.getDate() + 30);

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

            if (quantity <= 0) {
                notifications.push({
                    id: `out-of-stock:${id || name}`,
                    type: "out-of-stock",
                    icon: "fa-box-open",
                    label: "Out of stock",
                    message: `${name} has no ${unit} remaining and needs immediate replenishment.`,
                    category: "Medical Supplies",
                    status: "Out of stock",
                    timestamp: detectionTimestamp(supply),
                    href: href
                });
            } else if (quantity <= threshold) {
                notifications.push({
                    id: `low-stock:${id || name}`,
                    type: "low-stock",
                    icon: "fa-arrow-trend-down",
                    label: "Low stock",
                    message: `${name} has ${quantity} ${unit} remaining (minimum ${threshold}).`,
                    category: "Medical Supplies",
                    status: "Low stock",
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
                    category: "Medical Supplies",
                    status: "Expired",
                    timestamp: expiration,
                    href: href
                });
            }
        });

        storedArray("medtrackMedicalEquipment").forEach(function (equipment) {
            const id = text(equipment.id);
            const name = text(equipment.name, id || "Medical equipment");
            const maintenanceType = text(
                equipment.maintenanceType,
                "Inspection"
            );
            const serviceDate = localDate(equipment.maintenanceDate, true);

            if (
                !id ||
                !serviceDate ||
                maintenanceType === "Not required"
            ) return;

            const href = inventoryItemLink(
                "medical-equipment.html",
                "equipmentSearch",
                id
            );

            if (serviceDate < startOfToday) {
                notifications.push({
                    id: `service-overdue:${id}:${equipment.maintenanceDate}`,
                    type: "service-overdue",
                    icon: "fa-screwdriver-wrench",
                    label: "Inspection/service overdue",
                    message: `${name} requires ${maintenanceType.toLowerCase()}; ` +
                        `it was scheduled for ${serviceDate.toLocaleDateString()}.`,
                    category: "Medical Equipment",
                    status: "Service overdue",
                    timestamp: serviceDate,
                    href: href
                });
            } else if (serviceDate <= serviceWindowEnd) {
                notifications.push({
                    id: `service-due:${id}:${equipment.maintenanceDate}`,
                    type: "service-due",
                    icon: "fa-calendar-check",
                    label: "Inspection/service due soon",
                    message: `${name} has ${maintenanceType.toLowerCase()} scheduled ` +
                        `for ${serviceDate.toLocaleDateString()}.`,
                    category: "Medical Equipment",
                    status: "Service due soon",
                    timestamp: serviceDate,
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
                category: text(record.itemType) === "Mobility Asset"
                    ? "Mobility"
                    : text(record.itemType, "Inventory"),
                status: "Overdue",
                timestamp: dueDate,
                href: notificationLink(
                    "status.html",
                    "transactionSearch",
                    id || itemName
                )
            });
        });

        return notifications.sort(function (left, right) {
            const priority = {
                "item-added": 5,
                "service-overdue": 5,
                "out-of-stock": 4,
                expired: 3,
                "service-due": 2,
                overdue: 2,
                "low-stock": 1,
                "inventory-status": 0
            };
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
            '<div class="notification-toolbar">',
            '  <button type="button" data-notification-view="active" class="is-active">Active</button>',
            '  <button type="button" data-notification-view="history">History</button>',
            '  <button type="button" data-notification-action="unread-all">Mark all unread</button>',
            '  <button type="button" data-notification-action="restore-all">Restore all</button>',
            '</div>',
            '<div class="notification-filters" aria-label="Notification filters">',
            '  <label>Category<select data-notification-filter="category"><option value="all">All categories</option></select></label>',
            '  <label>Status<select data-notification-filter="status"><option value="all">All statuses</option></select></label>',
            '  <label>Date<select data-notification-filter="date"><option value="all">Any date</option><option value="today">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label>',
            '  <label class="notification-unread-filter"><input type="checkbox" data-notification-filter="unread"> Unread only</label>',
            '</div>',
            '<div class="notification-list" id="notificationDropdownList"></div>'
        ].join("");
        document.body.appendChild(dropdown);

        dropdown.querySelector(".notification-close").addEventListener(
            "click",
            closeDropdown
        );
        dropdown.addEventListener("click", handleDropdownAction);
        dropdown.addEventListener("change", handleFilterChange);
        return dropdown;
    }

    function activeNotifications(notifications, state) {
        const dismissedVersions = new Set(state.dismissed.map(function (item) {
            return `${item.id}@${item.timestamp}`;
        }));
        return notifications.filter(function (notification) {
            return !dismissedVersions.has(notificationVersion(notification));
        });
    }

    function notificationVersion(notification) {
        return `${notification.id}@${notification.timestamp.toISOString()}`;
    }

    function historyNotifications(state) {
        return state.dismissed.map(function (item) {
            return {
                ...item,
                timestamp: localDate(item.timestamp, false) || new Date()
            };
        }).reverse();
    }

    function updateFilterOptions(select, values, allLabel) {
        const selected = select.value || "all";
        select.replaceChildren();
        const allOption = document.createElement("option");
        allOption.value = "all";
        allOption.textContent = allLabel;
        select.appendChild(allOption);
        values.forEach(function (value) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });
        select.value = values.includes(selected) ? selected : "all";
    }

    function synchronizeFilterControls(panel, notifications) {
        const detectedCategories = Array.from(new Set(
            notifications.map(function (item) {
                return text(item.category, "Other");
            })
        )).sort();
        const categories = Array.from(new Set([
            ...ALWAYS_VISIBLE_CATEGORIES,
            ...detectedCategories
        ]));
        const categoryStatuses =
            STATUS_OPTIONS_BY_CATEGORY[notificationFilters.category];
        const statuses = categoryStatuses
            ? [...categoryStatuses]
            : Array.from(new Set([
                ...ALWAYS_VISIBLE_STATUSES,
                ...notifications.map(function (item) {
                    return text(item.status, item.label);
                })
            ])).sort();
        const categorySelect = panel.querySelector('[data-notification-filter="category"]');
        const statusSelect = panel.querySelector('[data-notification-filter="status"]');

        updateFilterOptions(categorySelect, categories, "All categories");
        updateFilterOptions(statusSelect, statuses, "All statuses");
        if (!categories.includes(notificationFilters.category)) {
            notificationFilters.category = "all";
        }
        if (!statuses.includes(notificationFilters.status)) {
            notificationFilters.status = "all";
        }
        categorySelect.value = notificationFilters.category;
        statusSelect.value = notificationFilters.status;
        panel.querySelector('[data-notification-filter="date"]').value =
            notificationFilters.date;
        panel.querySelector('[data-notification-filter="unread"]').checked =
            notificationFilters.unread;
    }

    function filteredNotifications(notifications, state) {
        const now = new Date();
        const start = new Date(now);
        if (notificationFilters.date === "today") {
            start.setHours(0, 0, 0, 0);
        } else if (notificationFilters.date !== "all") {
            start.setDate(start.getDate() - Number(notificationFilters.date));
        }

        return notifications.filter(function (notification) {
            if (
                notificationFilters.category !== "all" &&
                text(notification.category, "Other") !== notificationFilters.category
            ) return false;
            if (
                notificationFilters.status !== "all" &&
                text(notification.status, notification.label) !== notificationFilters.status
            ) return false;
            if (
                notificationFilters.unread &&
                state.readIds.includes(notificationVersion(notification))
            ) return false;
            return notificationFilters.date === "all" || notification.timestamp >= start;
        });
    }

    function renderDropdown() {
        const panel = ensureDropdown();
        const summary = panel.querySelector("#notificationDropdownSummary");
        const list = panel.querySelector("#notificationDropdownList");
        const state = notificationState();
        const active = activeNotifications(buildNotifications(), state);
        const sourceNotifications = activeView === "history"
            ? historyNotifications(state)
            : active;
        synchronizeFilterControls(panel, sourceNotifications);
        const notifications = filteredNotifications(sourceNotifications, state);
        const unread = active.filter(function (notification) {
            return !state.readIds.includes(notificationVersion(notification));
        }).length;
        const read = active.length - unread;
        summary.textContent = activeView === "history"
            ? `${notifications.length} of ${sourceNotifications.length} dismissed`
            : (active.length
                ? `${active.length} active, ${unread} unread`
                : "You're all caught up");
        panel.querySelectorAll("[data-notification-view]").forEach(function (button) {
            button.classList.toggle("is-active", button.dataset.notificationView === activeView);
        });
        panel.querySelector('[data-notification-action="unread-all"]').hidden =
            activeView === "history" || read === 0;
        panel.querySelector('[data-notification-action="restore-all"]').hidden =
            activeView !== "history" || state.dismissed.length === 0;
        list.replaceChildren();

        if (notifications.length === 0) {
            const empty = document.createElement("div");
            empty.className = "notification-empty";
            empty.innerHTML = sourceNotifications.length
                ? '<i class="fa-solid fa-filter" aria-hidden="true"></i><p>No notifications match these filters.</p>'
                : (activeView === "history"
                    ? '<i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i><p>No notification history.</p>'
                    : '<i class="fa-solid fa-circle-check" aria-hidden="true"></i><p>No current notifications.</p>');
            list.appendChild(empty);
            if (activeView === "active" && additionHasMore) {
                const loadMore = document.createElement("button");
                loadMore.type = "button";
                loadMore.className = "notification-load-more";
                loadMore.dataset.notificationAction = "load-more";
                loadMore.textContent = "Load more";
                list.appendChild(loadMore);
            }
            return;
        }

        notifications.slice(0, visibleNotificationCount).forEach(function (notification) {
            const row = document.createElement("div");
            row.className = "notification-row";

            const link = document.createElement("a");
            link.className = `notification-item notification-${notification.type}`;
            link.href = notification.href;
            link.dataset.notificationId = notification.id;
            link.dataset.notificationVersion = notificationVersion(notification);

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
            link.addEventListener("click", function () {
                const currentState = notificationState();
                currentState.readIds.push(link.dataset.notificationVersion);
                saveNotificationState(currentState);
            });

            const action = document.createElement("button");
            action.type = "button";
            action.className = "notification-item-action";
            action.dataset.notificationAction = activeView === "history" ? "restore" : "dismiss";
            action.dataset.notificationId = notification.id;
            action.setAttribute(
                "aria-label",
                activeView === "history" ? "Restore notification" : "Dismiss notification"
            );
            action.innerHTML = activeView === "history"
                ? '<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>'
                : '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
            row.append(link, action);
            list.appendChild(row);
        });

        if (
            visibleNotificationCount < notifications.length ||
            (activeView === "active" && additionHasMore)
        ) {
            const loadMore = document.createElement("button");
            loadMore.type = "button";
            loadMore.className = "notification-load-more";
            loadMore.dataset.notificationAction = "load-more";
            loadMore.textContent = additionLoading ? "Loading..." : "Load more";
            loadMore.disabled = additionLoading;
            list.appendChild(loadMore);
        }
    }

    function handleFilterChange(event) {
        const control = event.target instanceof Element
            ? event.target.closest("[data-notification-filter]")
            : null;
        if (!control) return;
        const filter = control.dataset.notificationFilter;
        notificationFilters[filter] = filter === "unread"
            ? control.checked
            : control.value;
        visibleNotificationCount = VISIBLE_NOTIFICATION_PAGE_SIZE;
        renderDropdown();
    }

    async function loadMoreNotifications() {
        visibleNotificationCount += VISIBLE_NOTIFICATION_PAGE_SIZE;
        if (activeView === "active" && additionHasMore) {
            const state = notificationState();
            const available = filteredNotifications(
                activeNotifications(buildNotifications(), state),
                state
            ).length;
            if (visibleNotificationCount >= available) {
                await loadInventoryAdditions(false);
            }
        }
        renderDropdown();
    }

    function dismissNotification(notificationId) {
        const state = notificationState();
        const notification = buildNotifications().find(function (item) {
            return item.id === notificationId;
        });
        if (!notification) return;
        state.dismissed = state.dismissed.filter(function (item) {
            return item.id !== notificationId;
        });
        state.dismissed.push({
            ...notification,
            timestamp: notification.timestamp.toISOString(),
            dismissedAt: new Date().toISOString()
        });
        saveNotificationState(state);
    }

    function restoreNotification(notificationId) {
        const state = notificationState();
        state.dismissed = state.dismissed.filter(function (item) {
            return item.id !== notificationId;
        });
        saveNotificationState(state);
    }

    function restoreAllNotifications() {
        const state = notificationState();
        const restoredVersions = new Set(state.dismissed.map(function (item) {
            return `${item.id}@${item.timestamp}`;
        }));
        state.dismissed = [];
        state.readIds = state.readIds.filter(function (version) {
            return !restoredVersions.has(version);
        });
        saveNotificationState(state);
        activeView = "active";
        visibleNotificationCount = VISIBLE_NOTIFICATION_PAGE_SIZE;
    }

    function markAllUnread() {
        const state = notificationState();
        const activeVersions = new Set(
            activeNotifications(buildNotifications(), state).map(
                notificationVersion
            )
        );
        state.readIds = state.readIds.filter(function (version) {
            return !activeVersions.has(version);
        });
        saveNotificationState(state);
    }

    function handleDropdownAction(event) {
        const control = event.target instanceof Element
            ? event.target.closest("[data-notification-action], [data-notification-view]")
            : null;
        if (!control) return;
        event.preventDefault();
        event.stopPropagation();
        if (control.dataset.notificationView) {
            activeView = control.dataset.notificationView;
            visibleNotificationCount = VISIBLE_NOTIFICATION_PAGE_SIZE;
        } else if (control.dataset.notificationAction === "unread-all") {
            markAllUnread();
        } else if (control.dataset.notificationAction === "dismiss") {
            dismissNotification(control.dataset.notificationId);
        } else if (control.dataset.notificationAction === "restore") {
            restoreNotification(control.dataset.notificationId);
        } else if (control.dataset.notificationAction === "restore-all") {
            restoreAllNotifications();
        } else if (control.dataset.notificationAction === "load-more") {
            loadMoreNotifications();
            return;
        }
        renderDropdown();
        refreshBadges();
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
        activeView = "active";
        visibleNotificationCount = VISIBLE_NOTIFICATION_PAGE_SIZE;
        renderDropdown();
        panel.hidden = false;
        button.setAttribute("aria-expanded", "true");
        positionDropdown();
        panel.querySelector(".notification-close").focus();
    }

    function refreshBadges() {
        const state = notificationState();
        const notifications = activeNotifications(buildNotifications(), state);
        const unread = notifications.filter(function (notification) {
            return !state.readIds.includes(notificationVersion(notification));
        });
        document.querySelectorAll(".notification-button").forEach(function (button) {
            const badge = button.querySelector("span");
            if (badge) {
                badge.textContent = String(unread.length);
                badge.hidden = unread.length === 0;
            }
            button.type = "button";
            button.setAttribute("aria-haspopup", "dialog");
            button.setAttribute("aria-controls", DROPDOWN_ID);
            button.setAttribute("aria-expanded", "false");
            button.setAttribute(
                "aria-label",
                unread.length
                    ? `Open ${unread.length} unread notifications`
                    : "Open notifications"
            );
        });

        if (dropdown && !dropdown.hidden) {
            renderDropdown();
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
    window.addEventListener("online", loadRemoteNotificationState);
    window.addEventListener("medtrack:data-ready", scheduleRefresh);
    window.addEventListener("medtrack:inventory-changed", function () {
        scheduleRefresh();
        scheduleAdditionRefresh();
    });
    window.addEventListener("medtrack:inventory-activity", scheduleAdditionRefresh);
    document.addEventListener("DOMContentLoaded", function () {
        refreshBadges();
        window.setTimeout(refreshBadges, 750);
        window.setTimeout(loadRemoteNotificationState, 900);
        window.setTimeout(function () {
            loadInventoryAdditions(true);
        }, 1000);
    });
})();
