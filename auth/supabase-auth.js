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

    function createMfaGate(mode, enrollment) {
        document.body.hidden = false;

        const gate = document.createElement("div");
        gate.className = "mfa-gate";
        gate.setAttribute("role", "dialog");
        gate.setAttribute("aria-modal", "true");
        gate.setAttribute("aria-labelledby", "mfaGateTitle");

        const dialog = document.createElement("section");
        dialog.className = "mfa-dialog";

        const icon = document.createElement("div");
        icon.className = "mfa-dialog-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "\u2713";

        const title = document.createElement("h2");
        title.id = "mfaGateTitle";
        title.textContent = mode === "enroll"
            ? "Secure your administrator account"
            : "Administrator verification required";

        const description = document.createElement("p");
        description.textContent = mode === "enroll"
            ? "Scan this QR code with an authenticator app, then enter its 6-digit code."
            : "Enter the 6-digit code from your authenticator app to continue.";

        dialog.append(icon, title, description);

        if (mode === "enroll" && enrollment) {
            const qr = document.createElement("img");
            qr.className = "mfa-qr-code";
            qr.src = enrollment.totp.qr_code;
            qr.alt = "Authenticator enrollment QR code";
            dialog.appendChild(qr);

            const secretLabel = document.createElement("p");
            secretLabel.className = "mfa-secret-label";
            secretLabel.textContent = "Cannot scan? Enter this setup key:";

            const secret = document.createElement("code");
            secret.className = "mfa-secret";
            secret.textContent = enrollment.totp.secret;
            dialog.append(secretLabel, secret);
        }

        const form = document.createElement("form");
        form.className = "mfa-form";
        form.noValidate = true;

        const label = document.createElement("label");
        label.htmlFor = "mfaVerificationCode";
        label.textContent = "Verification code";

        const input = document.createElement("input");
        input.id = "mfaVerificationCode";
        input.name = "mfaVerificationCode";
        input.type = "text";
        input.inputMode = "numeric";
        input.autocomplete = "one-time-code";
        input.pattern = "[0-9]{6}";
        input.maxLength = 6;
        input.placeholder = "000000";
        input.required = true;

        const error = document.createElement("p");
        error.className = "mfa-error";
        error.setAttribute("role", "alert");
        error.hidden = true;

        const actions = document.createElement("div");
        actions.className = "mfa-actions";

        const verify = document.createElement("button");
        verify.type = "submit";
        verify.className = "mfa-primary-action";
        verify.textContent = mode === "enroll" ? "Enable and Continue" : "Verify and Continue";

        const signOutButton = document.createElement("button");
        signOutButton.type = "button";
        signOutButton.className = "mfa-secondary-action";
        signOutButton.textContent = "Sign Out";

        actions.append(verify, signOutButton);
        form.append(label, input, error, actions);
        dialog.appendChild(form);
        gate.appendChild(dialog);
        document.body.appendChild(gate);

        const pageLayout = document.querySelector(".page-layout");
        if (pageLayout) {
            pageLayout.inert = true;
            pageLayout.setAttribute("aria-hidden", "true");
        }

        function release() {
            if (pageLayout) {
                pageLayout.inert = false;
                pageLayout.removeAttribute("aria-hidden");
            }
            gate.remove();
        }

        return {
            gate,
            form,
            input,
            error,
            verify,
            signOutButton,
            release
        };
    }

    async function recordMfaEvent(action) {
        try {
            const result = await client.rpc("medtrack_record_mfa_event", {
                p_action: action
            });
            if (result.error) {
                console.error("Unable to record MFA audit event:", result.error);
            }
        } catch (error) {
            console.error("Unable to record MFA audit event:", error);
        }
    }

    async function completeMfaChallenge(factorId, mode, enrollment) {
        return new Promise(function (resolve) {
            const controls = createMfaGate(mode, enrollment);

            controls.signOutButton.addEventListener("click", async function () {
                controls.signOutButton.disabled = true;
                controls.verify.disabled = true;
                await signOutAndRedirect();
                resolve(false);
            });

            controls.form.addEventListener("submit", async function (event) {
                event.preventDefault();
                const code = controls.input.value.replace(/\D/g, "");

                if (!/^\d{6}$/.test(code)) {
                    controls.error.textContent = "Enter the complete 6-digit code.";
                    controls.error.hidden = false;
                    controls.input.focus();
                    return;
                }

                controls.error.hidden = true;
                controls.verify.disabled = true;
                controls.signOutButton.disabled = true;
                controls.verify.textContent = "Verifying...";

                let result;
                try {
                    result = await client.auth.mfa.challengeAndVerify({
                        factorId: factorId,
                        code: code
                    });
                } catch (verificationError) {
                    console.error("MFA verification failed:", verificationError);
                    result = { error: verificationError };
                }

                if (result.error) {
                    controls.error.textContent = "That code is invalid or expired. Try again.";
                    controls.error.hidden = false;
                    controls.verify.disabled = false;
                    controls.signOutButton.disabled = false;
                    controls.verify.textContent = mode === "enroll"
                        ? "Enable and Continue"
                        : "Verify and Continue";
                    controls.input.select();
                    return;
                }

                await recordMfaEvent(mode === "enroll" ? "MFA Enrolled" : "MFA Verified");
                controls.input.value = "";
                controls.release();
                resolve(true);
            });

            controls.input.addEventListener("input", function () {
                controls.input.value = controls.input.value.replace(/\D/g, "").slice(0, 6);
            });

            controls.input.focus();
        });
    }

    function installSystemDialogs() {
        let backdrop = null;
        let resolver = null;
        let returnFocus = null;

        function ensureDialog() {
            if (backdrop) return backdrop;
            backdrop = document.createElement("div");
            backdrop.className = "system-dialog-backdrop";
            backdrop.hidden = true;
            backdrop.innerHTML = [
                '<section class="system-dialog" role="alertdialog" aria-modal="true" aria-labelledby="systemDialogTitle" aria-describedby="systemDialogMessage">',
                '  <div class="system-dialog-icon" aria-hidden="true"><i class="fa-solid fa-circle-info"></i></div>',
                '  <h2 id="systemDialogTitle">MedTrack</h2>',
                '  <p id="systemDialogMessage"></p>',
                '  <div class="system-dialog-actions">',
                '    <button type="button" class="system-dialog-cancel">Cancel</button>',
                '    <button type="button" class="system-dialog-confirm">OK</button>',
                '  </div>',
                '</section>'
            ].join("");
            document.body.appendChild(backdrop);

            backdrop.querySelector(".system-dialog-cancel").addEventListener(
                "click",
                function () { finish(false); }
            );
            backdrop.querySelector(".system-dialog-confirm").addEventListener(
                "click",
                function () { finish(true); }
            );
            backdrop.addEventListener("click", function (event) {
                if (event.target === backdrop) finish(false);
            });
            return backdrop;
        }

        function finish(result) {
            if (!backdrop || backdrop.hidden) return;
            backdrop.hidden = true;
            document.body.classList.remove("system-dialog-open");
            const complete = resolver;
            resolver = null;
            if (returnFocus && document.contains(returnFocus)) {
                returnFocus.focus({ preventScroll: true });
            }
            returnFocus = null;
            if (complete) complete(result);
        }

        function open(message, options) {
            const panel = ensureDialog();
            const settings = options || {};
            if (resolver) finish(false);
            returnFocus = document.activeElement;
            panel.querySelector("#systemDialogTitle").textContent =
                settings.title || "MedTrack";
            panel.querySelector("#systemDialogMessage").textContent =
                String(message || "");
            const cancel = panel.querySelector(".system-dialog-cancel");
            const confirm = panel.querySelector(".system-dialog-confirm");
            cancel.hidden = settings.cancelText === null;
            cancel.textContent = settings.cancelText || "Cancel";
            confirm.textContent = settings.confirmText || "OK";
            panel.dataset.tone = settings.tone || "info";
            panel.hidden = false;
            document.body.classList.add("system-dialog-open");
            return new Promise(function (resolve) {
                resolver = resolve;
                confirm.focus();
            });
        }

        document.addEventListener("keydown", function (event) {
            if (!backdrop || backdrop.hidden) return;
            if (event.key === "Escape") {
                event.preventDefault();
                finish(false);
            }
        });

        return {
            alert: function (message, options) {
                return open(message, { ...options, cancelText: null });
            },
            confirm: function (message, options) {
                return open(message, options);
            }
        };
    }

    function installLogoutDialog() {
        let dialog = null;
        let triggerButton = null;

        function closeDialog() {
            if (!dialog || dialog.hidden) return;
            dialog.hidden = true;
            document.body.classList.remove("logout-dialog-open");
            if (triggerButton) {
                triggerButton.focus({ preventScroll: true });
            }
            triggerButton = null;
        }

        function ensureDialog() {
            if (dialog) return dialog;

            dialog = document.createElement("div");
            dialog.className = "logout-dialog-backdrop";
            dialog.hidden = true;
            dialog.innerHTML = [
                '<section class="logout-dialog" role="alertdialog" aria-modal="true" aria-labelledby="logoutDialogTitle" aria-describedby="logoutDialogDescription">',
                '  <div class="logout-dialog-icon" aria-hidden="true"><i class="fa-solid fa-right-from-bracket"></i></div>',
                '  <h2 id="logoutDialogTitle">Log out of MedTrack?</h2>',
                '  <p id="logoutDialogDescription">Are you sure you want to end your session?</p>',
                '  <div class="logout-dialog-actions">',
                '    <button type="button" class="logout-cancel-button">Cancel</button>',
                '    <button type="button" class="logout-confirm-button">Log Out</button>',
                '  </div>',
                '</section>'
            ].join("");
            document.body.appendChild(dialog);

            const cancelButton = dialog.querySelector(".logout-cancel-button");
            const confirmButton = dialog.querySelector(".logout-confirm-button");

            cancelButton.addEventListener("click", closeDialog);
            confirmButton.addEventListener("click", async function () {
                cancelButton.disabled = true;
                confirmButton.disabled = true;
                confirmButton.textContent = "Logging Out...";

                try {
                    await signOutAndRedirect();
                } catch (error) {
                    console.error("Unable to complete logout:", error);
                    cancelButton.disabled = false;
                    confirmButton.disabled = false;
                    confirmButton.textContent = "Log Out";
                }
            });

            dialog.addEventListener("click", function (event) {
                if (event.target === dialog) closeDialog();
            });

            return dialog;
        }

        function openDialog(button) {
            const panel = ensureDialog();
            triggerButton = button;
            panel.hidden = false;
            document.body.classList.add("logout-dialog-open");
            panel.querySelector(".logout-cancel-button").focus();
        }

        document.addEventListener("click", function (event) {
            const button = event.target instanceof Element
                ? event.target.closest(".logout-button")
                : null;

            if (!button) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            openDialog(button);
        }, true);

        document.addEventListener("keydown", function (event) {
            if (!dialog || dialog.hidden) return;

            if (event.key === "Escape") {
                event.preventDefault();
                closeDialog();
                return;
            }

            if (event.key !== "Tab") return;
            const controls = Array.from(
                dialog.querySelectorAll("button:not(:disabled)")
            );
            if (controls.length === 0) return;
            const first = controls[0];
            const last = controls[controls.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
    }

    async function ensureAdminMfa(profile) {
        if (!profile || profile.role !== "admin") return true;

        if (!navigator.onLine) {
            throw new Error("Administrator MFA verification requires an internet connection.");
        }

        const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assurance.error) throw assurance.error;
        if (assurance.data.currentLevel === "aal2") return true;

        const factors = await client.auth.mfa.listFactors();
        if (factors.error) throw factors.error;

        const verifiedFactor = (factors.data.totp || []).find(function (factor) {
            return factor.status === "verified";
        });

        if (verifiedFactor) {
            return completeMfaChallenge(verifiedFactor.id, "verify");
        }

        const enrollment = await client.auth.mfa.enroll({
            factorType: "totp",
            friendlyName: "MedTrack Administrator"
        });
        if (enrollment.error) throw enrollment.error;

        return completeMfaChallenge(
            enrollment.data.id,
            "enroll",
            enrollment.data
        );
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

            const mfaComplete = await ensureAdminMfa(profile);
            if (!mfaComplete) return null;

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

    async function signIn(identifier, password, rememberUser) {
        const response = await fetch("/api/login", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: identifier, password: password })
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

        return false;
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
    installLogoutDialog();
    window.medtrackDialog = installSystemDialogs();

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
