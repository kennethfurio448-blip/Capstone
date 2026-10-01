(function () {
    "use strict";

    const PAGE_SIZE = 25;

    function enhanceTable(table) {
        if (!table || table.dataset.paginationReady === "true") return;
        const body = table.tBodies[0];
        if (!body) return;
        table.dataset.paginationReady = "true";

        const controls = document.createElement("nav");
        controls.className = "table-pagination";
        controls.setAttribute("aria-label", "Table pages");
        controls.innerHTML = `
            <span class="table-page-summary"></span>
            <div>
                <button type="button" class="table-page-previous">Previous</button>
                <button type="button" class="table-page-next">Next</button>
            </div>
        `;
        const wrapper = table.closest(".table-wrapper") || table.parentElement;
        wrapper.insertAdjacentElement("afterend", controls);

        const summary = controls.querySelector(".table-page-summary");
        const previous = controls.querySelector(".table-page-previous");
        const next = controls.querySelector(".table-page-next");
        let page = 1;
        let renderQueued = false;
        let sortColumn = -1;
        let sortDirection = 1;
        let observer = null;

        function sortableValue(cell) {
            const value = cell ? cell.textContent.trim() : "";
            const numeric = Number(value.replace(/,/g, ""));
            if (value !== "" && Number.isFinite(numeric)) {
                return { type: "number", value: numeric };
            }
            const timestamp = Date.parse(value);
            if (/\d/.test(value) && Number.isFinite(timestamp)) {
                return { type: "number", value: timestamp };
            }
            return { type: "text", value: value.toLocaleLowerCase() };
        }

        function compareRows(left, right) {
            const leftValue = sortableValue(left.cells[sortColumn]);
            const rightValue = sortableValue(right.cells[sortColumn]);
            if (leftValue.type === "number" && rightValue.type === "number") {
                return (leftValue.value - rightValue.value) * sortDirection;
            }
            return leftValue.value.localeCompare(
                rightValue.value,
                undefined,
                { numeric: true, sensitivity: "base" }
            ) * sortDirection;
        }

        function sortRows(rows) {
            if (sortColumn < 0) return rows;
            const sorted = [...rows].sort(compareRows);
            if (sorted.some(function (row, index) { return row !== rows[index]; })) {
                observer.disconnect();
                const fragment = document.createDocumentFragment();
                sorted.forEach(function (row) { fragment.appendChild(row); });
                body.appendChild(fragment);
                observer.observe(body, { childList: true });
            }
            return sorted;
        }

        function updateDisplayNumbers(rows) {
            rows.forEach(function (row, index) {
                const cell = row.querySelector(".record-number");
                if (cell) cell.textContent = String(index + 1);
            });
        }

        function applyResponsiveLabels(rows) {
            const labels = Array.from(
                table.tHead ? table.tHead.rows[0].cells : []
            ).map(function (cell) {
                return cell.textContent.trim();
            });

            rows.forEach(function (row) {
                Array.from(row.cells).forEach(function (cell, index) {
                    cell.dataset.label = labels[index] || "Value";
                });
            });
        }

        function render(resetPage = false) {
            if (resetPage) page = 1;
            const rows = sortRows(Array.from(body.rows));
            updateDisplayNumbers(rows);
            const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
            page = Math.min(page, pageCount);
            const start = (page - 1) * PAGE_SIZE;
            const end = start + PAGE_SIZE;

            applyResponsiveLabels(rows);

            rows.forEach(function (row, index) {
                row.hidden = index < start || index >= end;
            });

            controls.hidden = rows.length <= PAGE_SIZE;
            summary.textContent = rows.length === 0
                ? "No records"
                : `Showing ${start + 1}–${Math.min(end, rows.length)} of ${rows.length}`;
            previous.disabled = page <= 1;
            next.disabled = page >= pageCount;
        }

        function queueRender() {
            if (renderQueued) return;
            renderQueued = true;
            queueMicrotask(function () {
                renderQueued = false;
                render(true);
            });
        }

        previous.addEventListener("click", function () {
            page -= 1;
            render();
        });
        next.addEventListener("click", function () {
            page += 1;
            render();
        });

        observer = new MutationObserver(queueRender);
        observer.observe(body, { childList: true });

        if (table.classList.contains("sortable-table") && table.tHead) {
            Array.from(table.tHead.rows[0].cells).forEach(function (header, index) {
                const label = header.textContent.trim();
                if (!label || label === "No." || label === "Actions") return;
                header.classList.add("sortable-column");
                header.tabIndex = 0;
                header.setAttribute("role", "button");
                header.setAttribute("aria-sort", "none");
                header.title = `Sort by ${label}`;

                function selectSort() {
                    if (sortColumn === index) {
                        sortDirection *= -1;
                    } else {
                        sortColumn = index;
                        sortDirection = 1;
                    }
                    Array.from(table.tHead.rows[0].cells).forEach(function (cell) {
                        if (cell.classList.contains("sortable-column")) {
                            cell.setAttribute("aria-sort", "none");
                        }
                    });
                    header.setAttribute(
                        "aria-sort",
                        sortDirection === 1 ? "ascending" : "descending"
                    );
                    render(true);
                }

                header.addEventListener("click", selectSort);
                header.addEventListener("keydown", function (event) {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectSort();
                    }
                });
            });
        }
        render();
    }

    document.addEventListener("DOMContentLoaded", function () {
        document.querySelectorAll(".table-wrapper table").forEach(enhanceTable);
    });
})();
