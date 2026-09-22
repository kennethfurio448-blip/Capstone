(function () {
    "use strict";

    const client = window.medtrackSupabase;
    const sessionStorageManager = window.medtrackSessionStorage;
    const offlineStore = window.medtrackOfflineStore;
    const scriptUrl = new URL(document.currentScript.src);
    const projectRootUrl = new URL("../", scriptUrl);
    const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
    const ACTIVITY_WRITE_INTERVAL_MS = 15 * 1000;
    const SESSION_ACTIVITY_KEY = "medtrackLastActivityAt";
    const OFFLINE_PROFILE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
    const AUTH_REQUEST_TIMEOUT_MS = 10 * 1000;
    const OFFLINE_STORE_TIMEOUT_MS = 3 * 1000;
    const SENSITIVE_CACHE_KEYS = Object.freeze([
        "medtrackMedicalSupplies",
        "medtrackMedicalEquipment",
        "medtrackMobilityAssets",
        "medtrackBorrowTransactions",
        "medtrackEmergencyRequests",
        "medtrackAccounts",
        "medtrackAuditLogs"
    ]);
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
    let pendingMfaChallenge = null;

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

    function currentPageName() {
        return decodeURIComponent(
            window.location.pathname.split("/").pop() || ""
        ).toLowerCase();
    }

    function withTimeout(promise, timeoutMs, message) {
        return Promise.race([
            promise,
            new Promise(function (_, reject) {
                window.setTimeout(function () {
                    reject(new Error(message));
                }, timeoutMs);
            })
        ]);
    }

    async function loadProfile(user) {
        const result = await withTimeout(
            client
                .from("profiles")
                .select("full_name, username, role, status")
                .eq("id", user.id)
                .single(),
            AUTH_REQUEST_TIMEOUT_MS,
            "Profile lookup timed out."
        );

        if (result.error) {
            console.error("Supabase profile lookup failed:", result.error);
            throw new Error(
                `Profile lookup failed: ${result.error.message}`
            );
        }

        const profile = normalizeProfile(user, result.data);

        if (offlineStore) {
            offlineStore.saveProfile(profile).catch(function (error) {
                console.error("Unable to cache the MedTrack profile:", error);
            });
        }

        return profile;
    }

    function isNetworkError(error) {
        return !navigator.onLine || /fetch|network|load failed|offline|timed out/i.test(
            String(error && error.message || error || "")
        );
    }

    async function loadCachedProfile() {
        if (!offlineStore) return null;

        const result = await withTimeout(
            client.auth.getSession(),
            OFFLINE_STORE_TIMEOUT_MS,
            "Local session lookup timed out."
        );
        const session = result.data && result.data.session;
        const user = session && session.user;
        if (result.error || !user) return null;

        return withTimeout(
            offlineStore.loadProfile(
                user.id,
                OFFLINE_PROFILE_MAX_AGE_MS
            ),
            OFFLINE_STORE_TIMEOUT_MS,
            "Offline profile lookup timed out."
        );
    }

    async function getAuthenticatedProfile() {
        if (!navigator.onLine) {
            return loadCachedProfile();
        }

        const result = await withTimeout(
            client.auth.getUser(),
            AUTH_REQUEST_TIMEOUT_MS,
            "Authentication timed out."
        );
        const user = result.data && result.data.user;

        if (result.error || !user) {
            if (result.error && isNetworkError(result.error)) {
                return loadCachedProfile();
            }
            return null;
        }

        try {
            return await loadProfile(user);
        } catch (error) {
            if (isNetworkError(error)) {
                return loadCachedProfile();
            }
            throw error;
        }
    }

    async function clearSensitiveBrowserData() {
        if (
            window.medtrackData &&
            typeof window.medtrackData.clearSensitiveCache === "function"
        ) {
            await window.medtrackData.clearSensitiveCache();
            return;
        }

        SENSITIVE_CACHE_KEYS.forEach(function (key) {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        });

        if (offlineStore) {
            await offlineStore.clearAll();
        }
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
            await clearSensitiveBrowserData();
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
        const pageName = currentPageName();
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

    async function getMfaStatus() {
        const factorsResult = await client.auth.mfa.listFactors();
        if (factorsResult.error) throw factorsResult.error;

        const assuranceResult =
            await client.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assuranceResult.error) throw assuranceResult.error;

        const verifiedFactors = (factorsResult.data?.totp || [])
            .filter(function (factor) {
                return factor.status === "verified";
            });

        return {
            verifiedFactors: verifiedFactors,
            currentLevel:
                assuranceResult.data?.currentLevel || "aal1",
            nextLevel:
                assuranceResult.data?.nextLevel || "aal1"
        };
    }

    async function beginMfaChallenge() {
        const status = await getMfaStatus();
        const factor = status.verifiedFactors[0];

        if (!factor) {
            pendingMfaChallenge = null;
            return null;
        }

        const challengeResult = await client.auth.mfa.challenge({
            factorId: factor.id
        });
        if (challengeResult.error) throw challengeResult.error;

        pendingMfaChallenge = {
            factorId: factor.id,
            challengeId: challengeResult.data.id
        };
        return { required: true };
    }

    async function verifyMfa(code) {
        const normalizedCode = String(code || "").trim();
        if (!/^\d{6}$/.test(normalizedCode)) {
            throw new Error("Enter the six-digit authenticator code.");
        }

        if (!pendingMfaChallenge) {
            await beginMfaChallenge();
        }
        if (!pendingMfaChallenge) {
            throw new Error("No verified authenticator is available.");
        }

        const verification = await client.auth.mfa.verify({
            factorId: pendingMfaChallenge.factorId,
            challengeId: pendingMfaChallenge.challengeId,
            code: normalizedCode
        });
        if (verification.error) {
            pendingMfaChallenge = null;
            throw new Error(
                verification.error.message ||
                "The authenticator code is invalid or expired."
            );
        }

        pendingMfaChallenge = null;
        const profile = await getAuthenticatedProfile();
        if (!profile || profile.role !== "admin") {
            throw new Error("Administrator authentication is required.");
        }

        try {
            const auditResult = await client.rpc("medtrack_record_mfa_event", {
                p_action: "MFA Verified"
            });
            if (auditResult.error) {
                console.error(
                    "Unable to record MFA verification:",
                    auditResult.error
                );
            }
        } catch (auditError) {
            console.error("Unable to record MFA verification:", auditError);
        }

        return profile;
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

            if (profile.role === "admin") {
                const mfaStatus = await getMfaStatus();

                if (mfaStatus.verifiedFactors.length === 0) {
                    if (currentPageName() !== "settings.html") {
                        window.location.replace(
                            projectUrl("settings.html?reason=mfa-enrollment-required")
                        );
                        return null;
                    }
                } else if (mfaStatus.currentLevel !== "aal2") {
                    window.location.replace(
                        loginRedirectUrl("mfa-required")
                    );
                    return null;
                }
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

    async function signIn(identifier, password, rememberUser, turnstileToken) {
        const response = await fetch("/api/login", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                identifier: identifier,
                password: password,
                turnstileToken: turnstileToken || ""
            })
        });
        const data = await response.json().catch(function () {
            return { error: "The login service returned an invalid response." };
        });
        if (!response.ok || data.error) {
            throw new Error(data.error || "Unable to sign in.");
        }

        const session = data.session;
        if (!session || !session.access_token || !session.refresh_token) {
            throw new Error("The login service returned an invalid session.");
        }

        sessionStorageManager.setPersistence(rememberUser);
        const result = await client.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token
        });

        if (result.error || !result.data.user) {
            sessionStorageManager.clearPersistence();
            throw new Error("Unable to activate the login session.");
        }

        try {
            const profile = await loadProfile(result.data.user);
            if (profile.status !== "active" || !["admin", "staff"].includes(profile.role)) {
                throw new Error("This account is unavailable.");
            }

            if (profile.role === "admin") {
                const mfaStatus = await getMfaStatus();
                if (mfaStatus.verifiedFactors.length === 0) {
                    return {
                        profile: profile,
                        mfaEnrollmentRequired: true
                    };
                }
                if (mfaStatus.currentLevel !== "aal2") {
                    await beginMfaChallenge();
                    return {
                        profile: profile,
                        mfaRequired: true
                    };
                }
            }

            return { profile: profile };
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
                if (profile.role === "admin") {
                    const mfaStatus = await getMfaStatus();
                    if (mfaStatus.verifiedFactors.length === 0) {
                        window.location.replace(
                            projectUrl("settings.html?reason=mfa-enrollment-required")
                        );
                        return { redirected: true };
                    }
                    if (mfaStatus.currentLevel !== "aal2") {
                        await beginMfaChallenge();
                        return { redirected: false, mfaRequired: true };
                    }
                }

                redirectToDashboard(profile);
                return { redirected: true };
            }

            if (profile) {
                await signOut();
            } else {
                await clearSensitiveBrowserData();
            }
        } catch (error) {
            console.error("Existing session validation failed:", error);
            await client.auth.signOut({ scope: "local" });
            await clearSensitiveBrowserData();
        }

        return { redirected: false, mfaRequired: false };
    }

    client.auth.onAuthStateChange(async function (event) {
        if (event === "SIGNED_OUT") {
            await clearSensitiveBrowserData();

            if (guardedRoles) {
                window.location.replace(loginRedirectUrl(pendingLoginReason));
            }
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
        getMfaStatus: getMfaStatus,
        beginMfaChallenge: beginMfaChallenge,
        verifyMfa: verifyMfa,
        passwordPolicyError: passwordPolicyError
    };
})();
