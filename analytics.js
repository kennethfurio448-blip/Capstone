
document.addEventListener("DOMContentLoaded", function () {
    const trendSeries = [
        ["available", "Available / Normal", "#0b2d63"],
        ["attention", "Low Stock / Borrowed / Deployed", "#f2b514"],
        ["unavailable", "For Repair / Unavailable", "#d9252a"]
    ];

    function getStoredData(key) {
        try {
            const data = JSON.parse(localStorage.getItem(key));
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return [];
        }
    }

    function updateDashboardAnalytics() {
        const supplies = getStoredData("medtrackMedicalSupplies");
        const equipment = getStoredData("medtrackMedicalEquipment");
        const mobility = getStoredData("medtrackMobilityAssets");
        const borrowing = getStoredData("medtrackBorrowTransactions");

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const lowStockItems = supplies.filter(function (item) {
            return Number(item.quantity) <= Number(item.lowStockLevel);
        });

        const expiredItems = supplies.filter(function (item) {
            if (!item.expirationDate) {
                return false;
            }

            const expirationDate = new Date(
                item.expirationDate + "T00:00:00"
            );

            return expirationDate < today;
        });

        const overdueItems = borrowing.filter(function (item) {
            if (!item.dueDate || item.status === "Returned") {
                return false;
            }

            const dueDate = new Date(item.dueDate + "T00:00:00");
            return dueDate < today;
        });

        const statusAlerts = equipment.concat(mobility).filter(function (item) {
            return ["missing", "damaged", "for repair"].includes(
                String(item.status || "").toLowerCase()
            );
        });

        const totalAlerts =
            lowStockItems.length +
            expiredItems.length +
            overdueItems.length +
            statusAlerts.length;

        const availableMobility = mobility.filter(function (item) {
            return String(item.status || "").toLowerCase() ===
                "available";
        });

        setText("supplyTotal", supplies.length);
        setText("equipmentTotal", equipment.length);
        setText("mobilityTotal", mobility.length);
        setText("alertTotal", totalAlerts);
        setText("availableMobilityTotal", availableMobility.length);
        setText("lowStockTotal", lowStockItems.length);
        updateNotificationCount(totalAlerts);

        displayInventoryAlerts(
            lowStockItems,
            expiredItems,
            overdueItems,
            statusAlerts
        );
        displayRecentActivity(borrowing);
        void updateInventoryDistribution();
        void updateInventoryTrends();
    }

    function setText(elementId, value) {
        const element = document.getElementById(elementId);

        if (element) {
            element.textContent = value;
        }
    }

    function updateNotificationCount(totalAlerts) {
        const badge = document.getElementById("notificationCount");
        const button = document.querySelector(".notification-button");

        if (badge) {
            badge.textContent = totalAlerts > 99 ? "99+" : totalAlerts;
            badge.hidden = totalAlerts === 0;
        }

        if (button) {
            button.dataset.alertCount = String(totalAlerts);
            button.setAttribute(
                "aria-label",
                totalAlerts === 0
                    ? "No active inventory alerts"
                    : `View ${totalAlerts} active inventory ${
                        totalAlerts === 1 ? "alert" : "alerts"
                    }`
            );
        }
    }

    function inventoryStatusGroups() {
        const supplies = getStoredData("medtrackMedicalSupplies");
        const equipment = getStoredData("medtrackMedicalEquipment");
        const mobility = getStoredData("medtrackMobilityAssets");
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        function emptyValues() {
            return { available: 0, attention: 0, unavailable: 0 };
        }

        function normalized(value) {
            return String(value || "").trim().toLowerCase();
        }

        function classifyAsset(item) {
            const status = normalized(item.status);
            const condition = normalized(item.condition);
            const hasQuantity = item.quantity !== undefined && item.quantity !== null;
            const unavailableStatuses = [
                "for repair", "under maintenance", "damaged", "missing",
                "unavailable", "out of service"
            ];
            const activeStatuses = [
                "borrowed", "assigned", "deployed", "in use"
            ];

            if (
                (hasQuantity && Number(item.quantity) <= 0) ||
                unavailableStatuses.includes(status) ||
                ["damaged", "poor", "missing"].includes(condition)
            ) {
                return "unavailable";
            }
            if (activeStatuses.includes(status)) return "attention";
            return "available";
        }

        const supplyValues = emptyValues();
        supplies.forEach(function (item) {
            const quantity = Number(item.quantity || 0);
            const threshold = Number(item.lowStockLevel || 0);
            const expiration = item.expirationDate
                ? new Date(`${item.expirationDate}T00:00:00`)
                : null;

            if (
                quantity <= 0 ||
                (expiration && !Number.isNaN(expiration.getTime()) && expiration < today)
            ) {
                supplyValues.unavailable += 1;
            } else if (quantity <= threshold) {
                supplyValues.attention += 1;
            } else {
                supplyValues.available += 1;
            }
        });

        const equipmentValues = emptyValues();
        equipment.forEach(function (item) {
            equipmentValues[classifyAsset(item)] += 1;
        });

        const mobilityValues = emptyValues();
        mobility.forEach(function (item) {
            mobilityValues[classifyAsset(item)] += 1;
        });

        return [
            { label: "Medical Supplies", values: supplyValues },
            { label: "Medical Equipment", values: equipmentValues },
            { label: "Mobility", values: mobilityValues }
        ];
    }

    function updateInventoryTrends() {
        const chart = document.getElementById("inventoryTrendChart");
        const status = document.getElementById("inventoryTrendStatus");

        if (!chart || !status) return;
        status.classList.remove("error");
        const groups = inventoryStatusGroups();
        renderTrendChart(chart, groups);

        const total = groups.reduce(function (groupTotal, group) {
            return groupTotal + trendSeries.reduce(function (seriesTotal, series) {
                return seriesTotal + Number(group.values[series[0]] || 0);
            }, 0);
        }, 0);

        status.textContent = total === 0
            ? "No registered inventory records are available."
            : `${total.toLocaleString()} registered inventory ` +
                `${total === 1 ? "record" : "records"}, grouped by current status.`;
    }

    async function updateInventoryDistribution() {
        const chart = document.getElementById("inventoryDistributionChart");
        const legend = document.getElementById("inventoryDistributionLegend");
        const status = document.getElementById("inventoryDistributionStatus");
        const totalElement = document.getElementById("inventoryDistributionTotal");
        if (!chart || !legend || !status || !totalElement || !window.medtrackData) return;

        try {
            const totals = await window.medtrackData.loadInventoryDistribution();
            const segments = [
                ["Medical Supplies", Number(totals.medicalSupplies || 0), "#d9252a", "fa-kit-medical"],
                ["Medical Equipment", Number(totals.medicalEquipment || 0), "#ff7900", "fa-stethoscope"],
                ["Mobility Assets", Number(totals.mobilityAssets || 0), "#176fd1", "fa-wheelchair"]
            ];
            const total = segments.reduce((sum, item) => sum + item[1], 0);
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("viewBox", "0 0 340 340");
            let startAngle = -90;

            segments.forEach(function (segment) {
                const percentage = total ? segment[1] / total * 100 : 0;
                if (!percentage) return;

                const endAngle = startAngle + percentage * 3.6;
                const path = appendSvg(svg, "path", {
                    d: createPieSlicePath(170, 170, 145, startAngle, endAngle),
                    fill: segment[2],
                    stroke: "#ffffff",
                    "stroke-width": 2
                });
                const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
                title.textContent = `${segment[0]}: ${segment[1]} (${percentage.toFixed(1)}%)`;
                path.appendChild(title);

                if (percentage >= 8) {
                    const labelAngle = startAngle + (endAngle - startAngle) / 2;
                    const labelPosition = polarPoint(170, 170, 92, labelAngle);
                    const label = appendSvg(svg, "text", {
                        x: labelPosition.x,
                        y: labelPosition.y,
                        "text-anchor": "middle",
                        "dominant-baseline": "middle",
                        "font-size": 22,
                        "font-weight": 800,
                        fill: "#ffffff"
                    });
                    label.textContent = `${percentage.toFixed(1)}%`;
                }

                startAngle = endAngle;
            });

            if (!total) {
                appendSvg(svg, "circle", { cx: 170, cy: 170, r: 145, fill: "#e5e7eb" });
                const emptyLabel = appendSvg(svg, "text", {
                    x: 170, y: 170, "text-anchor": "middle",
                    "dominant-baseline": "middle", "font-size": 18,
                    "font-weight": 700, fill: "#6b7280"
                });
                emptyLabel.textContent = "No inventory data";
            }

            totalElement.textContent = total.toLocaleString();
            chart.replaceChildren(svg);
            chart.setAttribute(
                "aria-label",
                `Inventory distribution: ${segments.map(function (segment) {
                    const percentage = total ? segment[1] / total * 100 : 0;
                    return `${segment[0]} ${segment[1]} records, ${percentage.toFixed(1)} percent`;
                }).join("; ")}`
            );
            legend.replaceChildren(...segments.map(function (segment) {
                const percentage = total ? segment[1] / total * 100 : 0;
                const row = document.createElement("div");
                row.className = "distribution-legend-item";
                const swatch = document.createElement("span");
                swatch.className = "distribution-swatch";
                swatch.style.backgroundColor = segment[2];
                const icon = document.createElement("i");
                icon.className = `fa-solid ${segment[3]}`;
                icon.setAttribute("aria-hidden", "true");
                swatch.appendChild(icon);
                const name = document.createElement("span");
                name.className = "distribution-category";
                name.textContent = segment[0];
                const value = document.createElement("strong");
                value.className = "distribution-value";
                const count = document.createElement("span");
                count.textContent = segment[1].toLocaleString();
                const percentageLabel = document.createElement("small");
                percentageLabel.textContent = `${percentage.toFixed(1)}%`;
                percentageLabel.style.color = segment[2];
                percentageLabel.style.backgroundColor = `${segment[2]}14`;
                value.append(count, percentageLabel);
                row.append(swatch, name, value);
                return row;
            }));
            status.textContent = "Live totals from the inventory database.";
        } catch (error) {
            chart.replaceChildren();
            legend.replaceChildren();
            status.classList.add("error");
            status.textContent = "Inventory totals could not be loaded.";
        }
    }

    function polarPoint(centerX, centerY, radius, angle) {
        const radians = angle * Math.PI / 180;
        return {
            x: centerX + radius * Math.cos(radians),
            y: centerY + radius * Math.sin(radians)
        };
    }

    function createPieSlicePath(centerX, centerY, radius, startAngle, endAngle) {
        const start = polarPoint(centerX, centerY, radius, startAngle);
        const end = polarPoint(centerX, centerY, radius, endAngle);
        if (endAngle - startAngle >= 359.999) {
            const midpoint = polarPoint(centerX, centerY, radius, startAngle + 180);
            return [
                `M ${centerX} ${centerY}`,
                `L ${start.x} ${start.y}`,
                `A ${radius} ${radius} 0 1 1 ${midpoint.x} ${midpoint.y}`,
                `A ${radius} ${radius} 0 1 1 ${end.x} ${end.y}`,
                "Z"
            ].join(" ");
        }
        const largeArc = endAngle - startAngle > 180 ? 1 : 0;
        return [
            `M ${centerX} ${centerY}`,
            `L ${start.x} ${start.y}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`,
            "Z"
        ].join(" ");
    }

    function renderTrendChart(container, buckets) {
        const svgNamespace = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNamespace, "svg");
        const width = 760;
        const height = 360;
        const margin = { top: 35, right: 24, bottom: 68, left: 58 };
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        svg.setAttribute("aria-hidden", "true");

        const values = buckets.flatMap(function (bucket) {
            return trendSeries.map(function (series) {
                return Number(bucket.values[series[0]] || 0);
            });
        });
        const maximum = values.length > 0 ? Math.max(...values) : 0;
        const roundedMaximum = niceMaximum(Math.max(maximum, 1));

        for (let index = 0; index <= 4; index += 1) {
            const value = roundedMaximum * (4 - index) / 4;
            const y = margin.top + plotHeight * index / 4;
            appendSvg(svg, "line", {
                x1: margin.left,
                y1: y,
                x2: width - margin.right,
                y2: y,
                class: "chart-grid"
            });
            const label = appendSvg(svg, "text", {
                x: margin.left - 8,
                y: y + 4,
                "text-anchor": "end",
                class: "chart-axis-label"
            });
            label.textContent = String(Math.round(value));
        }

        const axisTitle = appendSvg(svg, "text", {
            x: 16,
            y: margin.top + plotHeight / 2,
            transform: `rotate(-90 16 ${margin.top + plotHeight / 2})`,
            "text-anchor": "middle",
            class: "chart-axis-title"
        });
        axisTitle.textContent = "Number of records";

        if (maximum === 0) {
            const empty = appendSvg(svg, "text", {
                x: width / 2,
                y: height / 2,
                class: "chart-empty"
            });
            empty.textContent = "No registered inventory records";
        }

        const groupWidth = plotWidth / buckets.length;
        const groupGap = Math.min(10, groupWidth * 0.05);
        const barWidth = Math.min(46, (groupWidth * 0.72 - groupGap * 2) / 3);

        buckets.forEach(function (bucket, bucketIndex) {
            const barsWidth = barWidth * trendSeries.length +
                groupGap * (trendSeries.length - 1);
            const groupStart = margin.left + bucketIndex * groupWidth +
                (groupWidth - barsWidth) / 2;

            trendSeries.forEach(function (series, seriesIndex) {
                const value = Number(bucket.values[series[0]] || 0);
                const barHeight = value / roundedMaximum * plotHeight;
                const x = groupStart + seriesIndex * (barWidth + groupGap);
                const y = margin.top + plotHeight - barHeight;
                const rectangle = appendSvg(svg, "rect", {
                    x: x,
                    y: y,
                    width: barWidth,
                    height: value > 0 ? Math.max(barHeight, 2) : 0,
                    fill: series[2],
                    rx: 3
                });
                const title = document.createElementNS(svgNamespace, "title");
                title.textContent = `${bucket.label}: ${series[1]} ${value}`;
                rectangle.appendChild(title);

                if (value > 0) {
                    const valueLabel = appendSvg(svg, "text", {
                        x: x + barWidth / 2,
                        y: Math.max(margin.top - 5, y - 8),
                        "text-anchor": "middle",
                        class: "chart-value-label"
                    });
                    valueLabel.textContent = value.toLocaleString();
                }
            });

            const label = appendSvg(svg, "text", {
                x: margin.left + bucketIndex * groupWidth + groupWidth / 2,
                y: height - 30,
                "text-anchor": "middle",
                class: "chart-category-label"
            });
            label.textContent = bucket.label;
        });

        container.style.minWidth = "680px";
        container.replaceChildren(svg);
        container.setAttribute(
            "aria-label",
            buckets.map(function (bucket) {
                return `${bucket.label}: ${trendSeries.map(function (series) {
                    return `${series[1]} ${bucket.values[series[0]] || 0}`;
                }).join(", ")}`;
            }).join("; ")
        );
        renderTrendLegend();
    }

    function appendSvg(parent, tagName, attributes) {
        const element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            tagName
        );

        Object.entries(attributes).forEach(function (entry) {
            element.setAttribute(entry[0], String(entry[1]));
        });
        parent.appendChild(element);
        return element;
    }

    function niceMaximum(value) {
        const roughStep = Math.max(value, 1) / 4;
        const magnitude = 10 ** Math.floor(Math.log10(roughStep));
        const step = Math.ceil(roughStep / magnitude) * magnitude;
        return step * 4;
    }

    function renderTrendLegend() {
        const legend = document.getElementById("inventoryTrendLegend");

        if (!legend) {
            return;
        }

        legend.replaceChildren(...trendSeries.map(function (series) {
            const item = document.createElement("span");
            const swatch = document.createElement("span");
            const label = document.createElement("span");

            item.className = "trend-legend-item";
            swatch.className = "trend-legend-swatch";
            swatch.style.backgroundColor = series[2];
            label.textContent = series[1];
            item.append(swatch, label);
            return item;
        }));
    }

    function displayInventoryAlerts(
        lowStockItems,
        expiredItems,
        overdueItems,
        statusAlerts
    ) {
        const container =
            document.getElementById("inventoryAlerts");

        if (!container) {
            return;
        }

        const alerts = [];

        lowStockItems.forEach(function (item) {
            alerts.push(`
                <div class="alert-item">
                    <div class="alert-icon danger">
                        <i class="fa-solid fa-arrow-trend-down"></i>
                    </div>

                    <div>
                        <strong>Low Stock</strong>
                        <p>${escapeHTML(item.name)}</p>
                    </div>

                    <span class="alert-status danger-text">
                        ${Number(item.quantity)} left
                    </span>
                </div>
            `);
        });

        expiredItems.forEach(function (item) {
            alerts.push(`
                <div class="alert-item">
                    <div class="alert-icon danger">
                        <i class="fa-solid fa-calendar-xmark"></i>
                    </div>

                    <div>
                        <strong>Expired Item</strong>
                        <p>${escapeHTML(item.name)}</p>
                    </div>

                    <span class="alert-status danger-text">
                        Expired
                    </span>
                </div>
            `);
        });

        overdueItems.forEach(function (item) {
            alerts.push(`
                <div class="alert-item">
                    <div class="alert-icon information">
                        <i class="fa-solid fa-clock"></i>
                    </div>

                    <div>
                        <strong>Overdue Return</strong>
                        <p>${escapeHTML(item.itemName)}</p>
                    </div>

                    <span class="alert-status information-text">
                        Overdue
                    </span>
                </div>
            `);
        });

        statusAlerts.forEach(function (item) {
            const status = escapeHTML(item.status);
            alerts.push(`
                <div class="alert-item">
                    <div class="alert-icon danger">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <div>
                        <strong>${status}</strong>
                        <p>${escapeHTML(item.name)}</p>
                    </div>
                    <span class="alert-status danger-text">${status}</span>
                </div>
            `);
        });

        if (alerts.length === 0) {
            container.innerHTML = `
                <div class="alert-item">
                    <div class="alert-icon information">
                        <i class="fa-solid fa-circle-check"></i>
                    </div>

                    <div>
                        <strong>No active alerts</strong>
                        <p>All inventory records are currently okay.</p>
                    </div>
                </div>
            `;

            return;
        }

        container.innerHTML = alerts.slice(0, 4).join("");
    }

    function displayRecentActivity(transactions) {
        const tableBody = document.getElementById("recentActivityBody");

        if (!tableBody) {
            return;
        }

        const recentTransactions = [...transactions]
            .sort(function (first, second) {
                return activityDate(second) - activityDate(first);
            })
            .slice(0, 5);

        if (recentTransactions.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4">No inventory activity recorded yet.</td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = recentTransactions.map(function (item) {
            const returned = item.status === "Returned";
            const needsAttention = [
                "Missing",
                "Damaged",
                "For Repair"
            ].includes(item.status);
            const statusClass = returned
                ? "updated"
                : needsAttention
                    ? "pending"
                    : "borrowed";

            return `
                <tr>
                    <td>${
                        returned
                            ? "Item returned"
                            : needsAttention
                                ? "Status updated"
                                : "Item borrowed"
                    }</td>
                    <td>${escapeHTML(item.itemName)}</td>
                    <td>
                        <span class="status ${statusClass}">
                            ${escapeHTML(item.status || "Borrowed")}
                        </span>
                    </td>
                    <td>${formatActivityDate(item)}</td>
                </tr>
            `;
        }).join("");
    }

    function activityDate(item) {
        const value = item.returnDate || item.borrowDate;
        const date = value ? new Date(value + "T00:00:00") : null;

        return date && !Number.isNaN(date.getTime())
            ? date.getTime()
            : 0;
    }

    function formatActivityDate(item) {
        const timestamp = activityDate(item);

        if (!timestamp) {
            return "\u2014";
        }

        return new Date(timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    function escapeHTML(value) {
        const element = document.createElement("div");
        element.textContent = value || "Unnamed item";
        return element.innerHTML;
    }

    updateDashboardAnalytics();

    window.addEventListener("storage", updateDashboardAnalytics);

    window.addEventListener(
        "medtrack:data-ready",
        updateDashboardAnalytics
    );
    window.addEventListener(
        "medtrack:dataChanged",
        updateDashboardAnalytics
    );
    window.addEventListener(
        "medtrack:data-saved",
        updateInventoryTrends
    );
    window.addEventListener(
        "medtrack:inventory-activity",
        updateInventoryTrends
    );

    window.setInterval(function () {
        if (document.visibilityState === "visible") {
            void updateInventoryDistribution();
            void updateInventoryTrends();
        }
    }, 15 * 60 * 1000);
});
