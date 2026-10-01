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

        function render(resetPage = false) {
            if (resetPage) page = 1;
            const rows = Array.from(body.rows);
            const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
            page = Math.min(page, pageCount);
            const start = (page - 1) * PAGE_SIZE;
            const end = start + PAGE_SIZE;

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

        new MutationObserver(queueRender).observe(body, { childList: true });
        render();
    }

    document.addEventListener("DOMContentLoaded", function () {
        document.querySelectorAll(".table-wrapper table").forEach(enhanceTable);
    });
})();
