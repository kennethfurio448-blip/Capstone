(function () {
    "use strict";

    const supabaseUrl =
        "https://agztgijxasjypmrndvyj.supabase.co";

    const supabasePublishableKey =
        "sb_publishable_4JmtsAj-OqKIl3r-MdWy2A_Cr-RUtIk";

    const persistenceKey = "medtrackAuthPersistence";

    function usePersistentStorage() {
        return localStorage.getItem(persistenceKey) === "local";
    }

    const authStorage = {
        getItem: function (key) {
            const storage = usePersistentStorage()
                ? localStorage
                : sessionStorage;

            return storage.getItem(key);
        },

        setItem: function (key, value) {
            const useLocalStorage = usePersistentStorage();
            const primaryStorage = useLocalStorage
                ? localStorage
                : sessionStorage;

            const secondaryStorage = useLocalStorage
                ? sessionStorage
                : localStorage;

            primaryStorage.setItem(key, value);
            secondaryStorage.removeItem(key);
        },

        removeItem: function (key) {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        }
    };

    function setSessionPersistence(rememberUser) {
        if (rememberUser) {
            localStorage.setItem(persistenceKey, "local");
            sessionStorage.removeItem(persistenceKey);
        } else {
            localStorage.removeItem(persistenceKey);
            sessionStorage.setItem(persistenceKey, "session");
        }
    }

    function clearSessionPersistence() {
        localStorage.removeItem(persistenceKey);
        sessionStorage.removeItem(persistenceKey);
    }

    if (!window.supabase || !window.supabase.createClient) {
        throw new Error("The Supabase JavaScript library failed to load.");
    }

    window.medtrackSupabase = window.supabase.createClient(
        supabaseUrl,
        supabasePublishableKey,
        {
            auth: {
                storage: authStorage,
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        }
    );

    window.medtrackSessionStorage = {
        setPersistence: setSessionPersistence,
        clearPersistence: clearSessionPersistence
    };
})();
