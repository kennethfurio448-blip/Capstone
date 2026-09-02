(function () {
    "use strict";

    const client = window.medtrackSupabase;
    const sessionStorageManager = window.medtrackSessionStorage;
    const scriptUrl = new URL(document.currentScript.src);
    const projectRootUrl = new URL("../", scriptUrl);

    let guardedRoles = null;
    let pageShowGuardInstalled = false;

    function projectUrl(path) {
        return new URL(path, projectRootUrl).href;
    }

    function loginUrl() {
        return projectUrl("login/login.html");
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
            await client.auth.signOut({ scope: "local" });
        } finally {
            sessionStorageManager.clearPersistence();
        }
    }

    async function signOutAndRedirect() {
        await signOut();
        window.location.replace(loginUrl());
    }

    function redirectToDashboard(profile) {
        window.location.replace(dashboardUrl(profile.role));
    }

    async function requireRoles(allowedRoles) {
        guardedRoles = [...allowedRoles];

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

            if (!allowedRoles.includes(profile.role)) {
                redirectToDashboard(profile);
                return null;
            }

            document.body.hidden = false;
            installPageShowGuard();
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
            throw result.error;
        }

        try {
            const profile = await loadProfile(result.data.user);

            if (profile.status !== "active") {
                throw new Error("This account is disabled.");
            }

            if (!["admin", "staff"].includes(profile.role)) {
                throw new Error("This account has an invalid role.");
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
            window.location.replace(loginUrl());
        }
    });

    window.medtrackAuth = {
        client: client,
        requireRoles: requireRoles,
        signIn: signIn,
        signOut: signOut,
        signOutAndRedirect: signOutAndRedirect,
        redirectToDashboard: redirectToDashboard,
        redirectAuthenticatedUser: redirectAuthenticatedUser,
        getAuthenticatedProfile: getAuthenticatedProfile
    };
})();
