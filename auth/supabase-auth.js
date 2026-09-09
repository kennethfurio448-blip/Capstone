(function () {
    "use strict";

    const client = window.medtrackSupabase;
    const sessionStorageManager = window.medtrackSessionStorage;
    const scriptUrl = new URL(document.currentScript.src);
    const projectRootUrl = new URL("../", scriptUrl);
    const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
    const ACTIVITY_WRITE_INTERVAL_MS = 15 * 1000;
    const SESSION_ACTIVITY_KEY = "medtrackLastActivityAt";
    const PAGE_ROLE_RULES = Object.freeze({
        "admin-dashboard.html": ["admin"],
        "staff-dashboard.html": ["staff"],
        "manage-users.html": ["admin"],
        "reports.html": ["admin"],
        "audit-logs.html": ["admin"],
        "settings.html": ["admin"],
        "available-items.html": ["admin", "staff"],
        "medical-supplies.html": ["admin", "staff"],
        "medical-equipment.html": ["admin", "staff"],
        "mobility.html": ["admin", "staff"],
        "borrow-return.html": ["admin", "staff"],
        "emergency-response.html": ["admin", "staff"]
    });

    let guardedRoles = null;
    let pageShowGuardInstalled = false;
    let sessionTimeoutInstalled = false;
    let sessionTimeoutTimer = null;
    let lastActivityWrite = 0;
    let pendingLoginReason = "";

    function projectUrl(path) {
        return new URL(path, projectRootUrl).href;
    }

    function loginUrl() {
        return projectUrl("login/login.html");
    }

    function loginRedirectUrl(reason) {
        const target = new URL(loginUrl());
        if (reason) target.searchParams.set("reason", reason);
        return target.href;
    }

    function dashboardUrl(role) {
        return projectUrl(
            role === "admin"
                ? "admin-dashboard.html"
                : "staff-dashboard.html"
        );
    }

    function normalizeProfile(user, profile) {
        return {
            id: user.id,
            email: user.email || "",
            fullname: profile.full_name,
            username: profile.username,
            role: profile.role,
            status: profile.status
        };
    }

    async function loadProfile(user) {
        const result = await client
            .from("profiles")
            .select("full_name, username, role, status")
            .eq("id", user.id)
            .single();

        if (result.error) {
            console.error("Supabase profile lookup failed:", result.error);
            throw new Error(
                `Profile lookup failed: ${result.error.message}`
            );
        }

        return normalizeProfile(user, result.data);
    }

    async function getAuthenticatedProfile() {
        const result = await client.auth.getUser();
        const user = result.data && result.data.user;

        if (result.error || !user) {
            return null;
        }

        return loadProfile(user);
    }

    async function signOut() {
        try {
            const auditResult = await client.rpc(
                "medtrack_record_auth_event",
                { p_action: "Logout" }
            );

            if (auditResult.error) {
                console.error(
                    "Unable to record logout audit event:",
                    auditResult.error
                );
            }
        } catch (auditError) {
            console.error(
                "Unable to record logout audit event:",
                auditError
            );
        }

        try {
            await client.auth.signOut({ scope: "local" });
        } finally {
            if (
                window.medtrackData &&
                typeof window.medtrackData.clearSensitiveCache === "function"
            ) {
                window.medtrackData.clearSensitiveCache();
            } else {
                [
                    "medtrackMedicalSupplies",
                    "medtrackMedicalEquipment",
                    "medtrackMobilityAssets",
                    "medtrackBorrowTransactions",
                    "medtrackEmergencyRequests",
                    "medtrackAccounts",
                    "medtrackAuditLogs"
                ].forEach(function (key) {
                    localStorage.removeItem(key);
                    sessionStorage.removeItem(key);
                });
            }

            sessionStorageManager.clearPersistence();
            sessionStorage.removeItem(SESSION_ACTIVITY_KEY);
        }
    }

    async function signOutAndRedirect(reason) {
        pendingLoginReason = reason || "";
        await signOut();
        window.location.replace(loginRedirectUrl(pendingLoginReason));
    }

    function redirectToDashboard(profile) {
        window.location.replace(dashboardUrl(profile.role));
    }

    function preparePageShell(profile) {
        const dashboardLink = document.getElementById("dashboardLink");
        const portalName = document.getElementById("portalName");
        const adminNavigation = document.getElementById("adminNavigation");
        const currentUserName = document.getElementById("currentUserName");
        const sidebar = document.querySelector(".sidebar");

        if (dashboardLink) {
            dashboardLink.href = dashboardUrl(profile.role);
        }

        if (portalName) {
            portalName.textContent = profile.role === "admin"
                ? "Admin Portal"
                : "Staff Portal";
        }

        if (adminNavigation) {
            adminNavigation.hidden = profile.role !== "admin";
        }

        if (currentUserName) {
            currentUserName.textContent =
                profile.fullname || profile.username || "MedTrack User";
        }

        document.documentElement.dataset.medtrackRole = profile.role;

        if (sidebar) {
            try {
                sidebar.scrollTop = Number(
                    sessionStorage.getItem("medtrackSidebarScroll") || 0
                );
            } catch (error) {
                console.error("Unable to restore sidebar position:", error);
            }
        }
    }

    function installNavigationOptimizations() {
        document.addEventListener("pointerover", function (event) {
            const link = event.target instanceof Element
                ? event.target.closest("a[href]")
                : null;

            if (!link || link.dataset.prefetched === "true") {
                return;
            }

            const target = new URL(link.href, window.location.href);

            if (
                target.origin !== window.location.origin ||
                !target.pathname.toLowerCase().endsWith(".html")
            ) {
                return;
            }

            link.dataset.prefetched = "true";
            const prefetch = document.createElement("link");
            prefetch.rel = "prefetch";
            prefetch.href = target.href;
            document.head.appendChild(prefetch);
        });

        document.addEventListener("click", function (event) {
            const link = event.target instanceof Element
                ? event.target.closest("a.nav-item[href]")
                : null;

            if (!link || event.defaultPrevented) {
                return;
            }

            const sidebar = document.querySelector(".sidebar");

            if (sidebar) {
                try {
                    sessionStorage.setItem(
                        "medtrackSidebarScroll",
                        String(sidebar.scrollTop)
                    );
                } catch (error) {
                    console.error("Unable to save sidebar position:", error);
                }
            }
        });
    }

    function currentPageRoles(requestedRoles) {
        const pageName = decodeURIComponent(
            window.location.pathname.split("/").pop() || ""
        ).toLowerCase();
        const configuredRoles = PAGE_ROLE_RULES[pageName];

        if (configuredRoles) {
            return [...configuredRoles];
        }

        return [...requestedRoles];
    }

    function recordSessionActivity() {
        const now = Date.now();
        if (now - lastActivityWrite < ACTIVITY_WRITE_INTERVAL_MS) return;
        lastActivityWrite = now;
        sessionStorage.setItem(SESSION_ACTIVITY_KEY, String(now));
    }

    async function enforceSessionTimeout() {
        const lastActivity = Number(
            sessionStorage.getItem(SESSION_ACTIVITY_KEY) || Date.now()
        );

        if (Date.now() - lastActivity < INACTIVITY_TIMEOUT_MS) return;

        if (sessionTimeoutTimer) {
            clearInterval(sessionTimeoutTimer);
            sessionTimeoutTimer = null;
        }

        await signOutAndRedirect("session-expired");
    }

    function installSessionTimeout() {
        if (sessionTimeoutInstalled) return;
        sessionTimeoutInstalled = true;

        if (!sessionStorage.getItem(SESSION_ACTIVITY_KEY)) {
            recordSessionActivity();
        }

        ["pointerdown", "keydown", "touchstart", "scroll"].forEach(
            function (eventName) {
                window.addEventListener(eventName, recordSessionActivity, {
                    passive: true
                });
            }
        );

        document.addEventListener("visibilitychange", function () {
            if (document.visibilityState === "visible") {
                enforceSessionTimeout();
            }
        });

        sessionTimeoutTimer = setInterval(enforceSessionTimeout, 30 * 1000);
    }

    function passwordPolicyError(password) {
        const value = String(password || "");

        if (value.length < 12) {
            return "Password must contain at least 12 characters.";
        }
        if (value.length > 128) {
            return "Password must not exceed 128 characters.";
        }
        if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
            return "Password must include uppercase, lowercase, and a number.";
        }

        return "";
    }

    async function requireRoles(allowedRoles) {
        const permittedRoles = currentPageRoles(allowedRoles);
        guardedRoles = permittedRoles;

        try {
            const profile = await getAuthenticatedProfile();

            if (!profile) {
                window.location.replace(loginUrl());
                return null;
            }

            if (
                profile.status !== "active" ||
                !["admin", "staff"].includes(profile.role)
            ) {
                await signOutAndRedirect();
                return null;
            }

            if (!permittedRoles.includes(profile.role)) {
                redirectToDashboard(profile);
                return null;
            }

            preparePageShell(profile);
            document.body.hidden = false;
            installPageShowGuard();
            installSessionTimeout();
            return profile;
        } catch (error) {
            console.error("Supabase page guard failed:", error);
            window.location.replace(loginUrl());
            return null;
        }
    }

    function installPageShowGuard() {
        if (pageShowGuardInstalled) {
            return;
        }

        pageShowGuardInstalled = true;

        window.addEventListener("pageshow", function (event) {
            if (event.persisted && guardedRoles) {
                requireRoles(guardedRoles);
            }
        });
    }

    async function signIn(email, password, rememberUser) {
        sessionStorageManager.setPersistence(rememberUser);

        const result = await client.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (result.error) {
            const message = String(result.error.message || "").toLowerCase();
            if (
                message.includes("invalid login credentials") ||
                message.includes("invalid credentials")
            ) {
                throw new Error("Email or password is incorrect.");
            }
            if (message.includes("rate limit") || message.includes("too many")) {
                throw new Error("Too many sign-in attempts. Please try again later.");
            }
            throw new Error("Unable to sign in securely. Please try again.");
        }

        try {
            const profile = await loadProfile(result.data.user);

            if (profile.status !== "active") {
                throw new Error("This account is disabled.");
            }

            if (!["admin", "staff"].includes(profile.role)) {
                throw new Error("This account has an invalid role.");
            }

            const auditResult = await client.rpc(
                "medtrack_record_auth_event",
                { p_action: "Login" }
            );

            if (auditResult.error) {
                console.error(
                    "Unable to record login audit event:",
                    auditResult.error
                );
            }

            return profile;
        } catch (error) {
            await signOut();
            throw error;
        }
    }

    async function redirectAuthenticatedUser() {
        try {
            const profile = await getAuthenticatedProfile();

            if (
                profile &&
                profile.status === "active" &&
                ["admin", "staff"].includes(profile.role)
            ) {
                redirectToDashboard(profile);
                return true;
            }
        } catch (error) {
            console.error("Existing session validation failed:", error);
        }

        return false;
    }

    client.auth.onAuthStateChange(function (event) {
        if (event === "SIGNED_OUT" && guardedRoles) {
            window.location.replace(loginRedirectUrl(pendingLoginReason));
        }
    });

    installNavigationOptimizations();

    window.medtrackAuth = {
        client: client,
        requireRoles: requireRoles,
        signIn: signIn,
        signOut: signOut,
        signOutAndRedirect: signOutAndRedirect,
        redirectToDashboard: redirectToDashboard,
        redirectAuthenticatedUser: redirectAuthenticatedUser,
        getAuthenticatedProfile: getAuthenticatedProfile,
        passwordPolicyError: passwordPolicyError
    };
})();
