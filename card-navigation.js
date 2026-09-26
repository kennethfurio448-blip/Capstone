(function () {
    "use strict";

    function ensureFilterOption(select, value, label) {
        const existingOption = Array.from(select.options).find(function (option) {
            return option.value === value;
        });

        if (existingOption) {
            return;
        }

        const option = document.createElement("option");
        option.value = value;
        option.textContent = label || value.replaceAll("|", " / ");
        option.dataset.cardGenerated = "true";
        select.appendChild(option);
    }

    function scrollToRelatedSection(card, filter) {
        const explicitTarget = card.dataset.scrollTarget;
        const target = explicitTarget
            ? document.querySelector(explicitTarget)
            : filter && filter.closest("section");

        if (target) {
            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    }

    function applyFilter(card) {
        const filterId = card.dataset.filterTarget;

        if (!filterId) {
            scrollToRelatedSection(card, null);
            return;
        }

        const filter = document.getElementById(filterId);

        if (!filter) {
            return;
        }

        if (card.dataset.preserveRelated !== "true") {
            const section = filter.closest("section");

            if (section) {
                section.querySelectorAll(
                    "select, input[type='search'], input[type='date']"
                ).forEach(function (control) {
                    if (control === filter) {
                        return;
                    }

                    if (control.tagName === "SELECT") {
                        const allOption = Array.from(control.options).find(function (option) {
                            return option.value === "all";
                        });

                        control.value = allOption ? "all" : control.options[0].value;
                        control.dispatchEvent(new Event("change", { bubbles: true }));
                    } else {
                        control.value = "";
                        control.dispatchEvent(new Event("input", { bubbles: true }));
                        control.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                });
            }
        }

        const value = card.dataset.filterValue || "all";
        const label = card.dataset.filterLabel || "";

        ensureFilterOption(filter, value, label);
        filter.value = value;
        filter.dispatchEvent(new Event("change", { bubbles: true }));

        const clickTarget = card.dataset.clickTarget;

        if (clickTarget) {
            const button = document.getElementById(clickTarget);

            if (button) {
                button.click();
            }
        }

        scrollToRelatedSection(card, filter);
    }

    function activateCard(card) {
        const href = card.dataset.href;

        if (href) {
            window.location.assign(href);
            return;
        }

        applyFilter(card);
    }

    function prepareCard(card) {
        const isLink = Boolean(card.dataset.href);

        card.tabIndex = 0;
        card.setAttribute("role", isLink ? "link" : "button");
        card.setAttribute(
            "aria-label",
            card.dataset.actionLabel || card.textContent.replace(/\s+/g, " ").trim()
        );

        card.addEventListener("click", function (event) {
            if (event.target.closest("a, button, input, select, textarea")) {
                return;
            }

            activateCard(card);
        });

        card.addEventListener("keydown", function (event) {
            if (event.key !== "Enter" && event.key !== " ") {
                return;
            }

            event.preventDefault();
            activateCard(card);
        });
    }

    function applyUrlFilter() {
        const parameters = new URLSearchParams(window.location.search);
        const filterId = parameters.get("filter");
        const value = parameters.get("value");
        const searchId = parameters.get("search");
        const query = parameters.get("query");
        let relatedControl = null;

        if (filterId && value) {
            const filter = document.getElementById(filterId);
            if (filter) {
                ensureFilterOption(filter, value, parameters.get("label") || value);
                filter.value = value;
                filter.dispatchEvent(new Event("change", { bubbles: true }));
                relatedControl = filter;
            }
        }

        if (searchId && query) {
            const search = document.getElementById(searchId);
            if (search) {
                search.value = query;
                search.dispatchEvent(new Event("input", { bubbles: true }));
                search.dispatchEvent(new Event("change", { bubbles: true }));
                relatedControl = search;
            }
        }

        if (!relatedControl) return;

        window.setTimeout(function () {
            scrollToRelatedSection({ dataset: {} }, relatedControl);
        }, 100);
    }

    document.addEventListener("DOMContentLoaded", function () {
        document.querySelectorAll(
            ".stat-card[data-href], " +
            ".stat-card[data-filter-target], " +
            ".stat-card[data-scroll-target]"
        ).forEach(prepareCard);

        applyUrlFilter();
    });
})();
