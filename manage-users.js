
document.addEventListener("DOMContentLoaded", async function () {


    const currentUserName =
        document.getElementById("currentUserName");

    const logoutButton =
        document.getElementById("logoutButton");

    const totalUsers =
        document.getElementById("totalUsers");

    const totalAdmins =
        document.getElementById("totalAdmins");

    const totalStaff =
        document.getElementById("totalStaff");

    const activeUsers =
        document.getElementById("activeUsers");

    const usersTableBody =
        document.getElementById("usersTableBody");

    const emptyState =
        document.getElementById("emptyState");

    const userSearch =
        document.getElementById("userSearch");

    const roleFilter =
        document.getElementById("roleFilter");

    const accountStatusFilter =
        document.getElementById("accountStatusFilter");

    const userModal =
        document.getElementById("userModal");

    const openAddModalButton =
        document.getElementById("openAddModal");

    const closeModalButton =
        document.getElementById("closeModal");

    const cancelButton =
        document.getElementById("cancelButton");

    const modalTitle =
        document.getElementById("modalTitle");

    const userForm =
        document.getElementById("userForm");

    const editingUserId =
        document.getElementById("editingUserId");

    const fullnameInput =
        document.getElementById("fullname");

    const usernameInput =
        document.getElementById("username");

    const emailInput =
        document.getElementById("email");

    const roleInput =
        document.getElementById("role");

    const accountStatusInput =
        document.getElementById("accountStatus");

    const passwordInput =
        document.getElementById("password");

    const confirmPasswordInput =
        document.getElementById("confirmPassword");

    const passwordHelp =
        document.getElementById("passwordHelp");

    const formMessage =
        document.getElementById("formMessage");

    const saveUserButton =
        userForm.querySelector("button[type='submit']");

    const otpModal = document.getElementById("otpModal");
    const otpForm = document.getElementById("otpForm");
    const otpCodeInput = document.getElementById("otpCode");
    const otpDestination = document.getElementById("otpDestination");
    const otpMessage = document.getElementById("otpMessage");
    const cancelOtpButton = document.getElementById("cancelOtp");
    const resendCodeButton = document.getElementById("resendRegistrationCode");
    const verifyRegistrationButton = document.getElementById("verifyRegistrationButton");

    const deleteModal =
        document.getElementById("deleteModal");

    const cancelDelete =
        document.getElementById("cancelDelete");

    const confirmDelete =
        document.getElementById("confirmDelete");

    let userToDelete = null;
    let accounts = [];
    let pendingRegistration = null;
    let registrationChallengeId = "";
    let cooldownTimer = null;


    const currentUser =
        await window.medtrackAuth.requireRoles(["admin"]);

    if (!currentUser) {
        return;
    }

    currentUserName.textContent =
        currentUser.fullname ||
        currentUser.username ||
        "Administrator";


    async function getFunctionErrorMessage(error) {
        const response = error && error.context;

        if (response && typeof response.clone === "function") {
            try {
                const responseBody =
                    await response.clone().json();

                if (responseBody && responseBody.error) {
                    return responseBody.error;
                }
            } catch (parseError) {
                console.error(
                    "Unable to read the account-admin error response:",
                    parseError
                );
            }
        }

        return (
            (error && error.message) ||
            "Unable to complete the account operation."
        );
    }

    async function invokeAccountAdmin(action, values) {
        const result =
            await window.medtrackSupabase.functions.invoke(
                "dynamic-worker",
                {
                    body: {
                        action: action,
                        ...(values || {})
                    }
                }
            );

        if (result.error) {
            throw new Error(
                await getFunctionErrorMessage(result.error)
            );
        }

        if (result.data && result.data.error) {
            throw new Error(result.data.error);
        }

        return result.data || {};
    }

    async function invokeOtp(action, values) {
        const result = await window.medtrackSupabase.functions.invoke(
            "otp-auth",
            { body: { action: action, ...(values || {}) } }
        );

        if (result.error) {
            throw new Error(await getFunctionErrorMessage(result.error));
        }

        if (result.data && result.data.error) {
            throw new Error(result.data.error);
        }

        return result.data || {};
    }

    function maskEmail(value) {
        const parts = String(value || "").split("@");
        if (parts.length !== 2) return "—";
        return parts[0].slice(0, 2) + "***@" + parts[1];
    }

    function startCooldown(seconds) {
        clearInterval(cooldownTimer);
        let remaining = Number(seconds) || 60;
        resendCodeButton.disabled = true;
        resendCodeButton.innerHTML = `Resend Code (<span id="registrationCooldown">${remaining}</span>s)`;

        cooldownTimer = setInterval(function () {
            remaining -= 1;
            const display = document.getElementById("registrationCooldown");
            if (display) display.textContent = Math.max(0, remaining);
            if (remaining <= 0) {
                clearInterval(cooldownTimer);
                resendCodeButton.disabled = false;
                resendCodeButton.textContent = "Resend Code";
            }
        }, 1000);
    }

    async function loadAccounts() {
        const result =
            await invokeAccountAdmin("list");

        accounts = Array.isArray(result.users)
            ? result.users
            : [];

        renderAccounts();
    }


    function escapeHTML(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function formatDate(dateValue) {
        if (!dateValue) {
            return "—";
        }

        const date = new Date(dateValue);

        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }


    function renderAccounts() {
        const searchValue =
            userSearch.value.trim().toLowerCase();

        const selectedRole =
            roleFilter.value;

        const selectedStatus =
            accountStatusFilter.value;

        const filteredAccounts = accounts.filter(function (account) {
            const matchesSearch =
                account.fullname.toLowerCase().includes(searchValue) ||
                account.username.toLowerCase().includes(searchValue) ||
                account.email.toLowerCase().includes(searchValue) ||
                account.userId.toLowerCase().includes(searchValue);

            const matchesRole =
                selectedRole === "all" ||
                account.role === selectedRole;

            const matchesStatus =
                selectedStatus === "all" ||
                account.status === selectedStatus;

            return (
                matchesSearch &&
                matchesRole &&
                matchesStatus
            );
        });

        usersTableBody.innerHTML = "";

        if (filteredAccounts.length === 0) {
            emptyState.classList.add("show");
        } else {
            emptyState.classList.remove("show");
        }

        filteredAccounts.forEach(function (account) {
            const isCurrentAccount =
                String(account.id) === String(currentUser.id);

            const roleClass =
                account.role === "admin"
                    ? "role-admin"
                    : "role-staff";

            const statusClass =
                account.status === "active"
                    ? "status-active"
                    : "status-disabled";

            const toggleTitle =
                account.status === "active"
                    ? "Disable account"
                    : "Enable account";

            const toggleIcon =
                account.status === "active"
                    ? "fa-user-lock"
                    : "fa-user-check";

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${escapeHTML(account.userId)}</td>

                <td>
                    <strong>${escapeHTML(account.fullname)}</strong>
                    ${
                        isCurrentAccount
                            ? "<small> (You)</small>"
                            : ""
                    }
                </td>

                <td>${escapeHTML(account.username)}</td>

                <td title="Masked for privacy">${escapeHTML(maskEmail(account.email))}</td>

                <td>
                    <span class="role-badge ${roleClass}">
                        ${escapeHTML(account.role)}
                    </span>
                </td>

                <td>
                    <span class="account-status ${statusClass}">
                        ${escapeHTML(account.status)}
                    </span>
                </td>

                <td>${escapeHTML(
                    formatDate(account.createdAt)
                )}</td>

                <td>
                    <div class="table-actions">

                        <button
                            type="button"
                            class="toggle-button"
                            data-action="toggle"
                            data-id="${escapeHTML(account.id)}"
                            title="${toggleTitle}"
                            ${
                                isCurrentAccount ? "disabled" : ""
                            }
                        >
                            <i class="fa-solid ${toggleIcon}"></i>
                        </button>

                        <button
                            type="button"
                            class="edit-button"
                            data-action="edit"
                            data-id="${escapeHTML(account.id)}"
                            title="Edit account"
                        >
                            <i class="fa-solid fa-pen"></i>
                        </button>

                        <button
                            type="button"
                            class="remove-button"
                            data-action="delete"
                            data-id="${escapeHTML(account.id)}"
                            title="Delete account"
                            ${
                                isCurrentAccount ? "disabled" : ""
                            }
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>

                    </div>
                </td>
            `;

            usersTableBody.appendChild(row);
        });

        updateStatistics(accounts);
    }


    function updateStatistics(accounts) {
        const admins = accounts.filter(function (account) {
            return account.role === "admin";
        }).length;

        const staff = accounts.filter(function (account) {
            return account.role === "staff";
        }).length;

        const active = accounts.filter(function (account) {
            return account.status === "active";
        }).length;

        totalUsers.textContent = accounts.length;
        totalAdmins.textContent = admins;
        totalStaff.textContent = staff;
        activeUsers.textContent = active;
    }


    function openAddModal() {
        userForm.reset();

        editingUserId.value = "";
        accountStatusInput.value = "active";
        accountStatusInput.disabled = true;
        modalTitle.textContent = "Add User";
        formMessage.textContent = "";

        passwordInput.disabled = false;
        confirmPasswordInput.disabled = false;
        emailInput.disabled = false;
        passwordInput.required = true;
        confirmPasswordInput.required = true;
        passwordHelp.textContent = "Use 12+ characters with uppercase, lowercase, and a number. Account creation continues after OTP verification.";

        userModal.classList.add("show");
        fullnameInput.focus();
    }


    function openEditModal(userId) {
        const account = accounts.find(function (item) {
            return String(item.id) === String(userId);
        });

        if (!account) {
            return;
        }

        editingUserId.value = account.id;
        fullnameInput.value = account.fullname;
        usernameInput.value = account.username;
        emailInput.value = account.email;
        emailInput.disabled = true;
        roleInput.value = account.role;
        accountStatusInput.value = account.status;

        passwordInput.value = "";
        confirmPasswordInput.value = "";

        passwordInput.disabled = true;
        confirmPasswordInput.disabled = true;
        passwordInput.required = false;
        confirmPasswordInput.required = false;
        passwordHelp.textContent = "Passwords can only be reset by the account owner through OTP verification on the login page.";

        const isCurrentAccount =
            String(account.id) === String(currentUser.id);

        roleInput.disabled = isCurrentAccount;
        accountStatusInput.disabled = isCurrentAccount;

        modalTitle.textContent = "Edit User";
        formMessage.textContent = "";

        userModal.classList.add("show");
        fullnameInput.focus();
    }

    function closeUserModal() {
        userModal.classList.remove("show");
        userForm.reset();

        editingUserId.value = "";
        formMessage.textContent = "";

        roleInput.disabled = false;
        accountStatusInput.disabled = false;

        passwordInput.disabled = false;
        confirmPasswordInput.disabled = false;
        emailInput.disabled = false;
        passwordInput.required = false;
        confirmPasswordInput.required = false;
        passwordHelp.textContent = "Use 12+ characters with uppercase, lowercase, and a number. Account creation continues after OTP verification.";
    }


    userForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const fullnameValue =
            fullnameInput.value.trim();

        const usernameValue =
            usernameInput.value.trim();

        const emailValue =
            emailInput.value.trim().toLowerCase();

        const passwordValue =
            passwordInput.value;

        const confirmPasswordValue =
            confirmPasswordInput.value;

        const editId =
            editingUserId.value;

        const existingAccount = accounts.find(function (account) {
            return String(account.id) === String(editId);
        });

        const roleValue =
            roleInput.disabled && existingAccount
                ? existingAccount.role
                : roleInput.value;

        const statusValue =
            accountStatusInput.disabled && existingAccount
                ? existingAccount.status
                : accountStatusInput.value;

        if (
            !fullnameValue ||
            !usernameValue ||
            !emailValue ||
            !roleValue ||
            !statusValue
        ) {
            formMessage.textContent =
                "Please complete all required fields.";

            return;
        }

        if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/i.test(emailValue)) {
            formMessage.textContent = "Please enter a valid Gmail address.";
            return;
        }

        if (!/^[a-z0-9._ -]{4,32}$/i.test(usernameValue)) {
            formMessage.textContent =
                "Username must contain 4 to 32 letters, numbers, spaces, periods, underscores, or hyphens.";

            return;
        }

        const duplicateUsername = accounts.some(function (account) {
            return (
                account.username.toLowerCase() ===
                    usernameValue.toLowerCase() &&
                String(account.id) !== String(editId)
            );
        });

        if (duplicateUsername) {
            formMessage.textContent =
                "That username is already registered.";

            return;
        }

        const duplicateEmail = accounts.some(function (account) {
            return (
                account.email.toLowerCase() === emailValue &&
                String(account.id) !== String(editId)
            );
        });

        if (duplicateEmail) {
            formMessage.textContent =
                "That email address is already registered.";

            return;
        }

        if (!editId && !passwordValue) {
            formMessage.textContent =
                "Please enter a password.";

            return;
        }

        const passwordError = passwordValue
            ? window.medtrackAuth.passwordPolicyError(passwordValue)
            : "";

        if (passwordError) {
            formMessage.textContent = passwordError;

            return;
        }

        if (passwordValue !== confirmPasswordValue) {
            formMessage.textContent =
                "Passwords do not match.";

            return;
        }

        saveUserButton.disabled = true;
        formMessage.textContent = editId
            ? "Updating account securely..."
            : "Creating account securely...";

        try {
            const values = {
                email: emailValue,
                fullName: fullnameValue,
                username: usernameValue,
                role: roleValue,
                status: statusValue
            };

            if (passwordValue) {
                values.password = passwordValue;
            }

            if (editId) {
                values.userId = editId;
                await invokeAccountAdmin("update", values);
                await loadAccounts();
                closeUserModal();
            } else {
                values.password = passwordValue;
                const response = await invokeOtp("request-registration", values);
                pendingRegistration = values;
                registrationChallengeId = response.challengeId;
                otpDestination.textContent = response.maskedDestination;
                otpCodeInput.value = "";
                otpMessage.textContent = "";
                userModal.classList.remove("show");
                otpModal.classList.add("show");
                startCooldown(response.resendAfter);
                otpCodeInput.focus();
            }
        } catch (error) {
            formMessage.textContent =
                error.message ||
                "Unable to save the account.";
        } finally {
            saveUserButton.disabled = false;
        }
    });

    otpForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const otp = otpCodeInput.value.trim();
        if (!/^\d{6}$/.test(otp) || !pendingRegistration || !registrationChallengeId) {
            otpMessage.textContent = "Enter the six-digit verification code.";
            return;
        }

        verifyRegistrationButton.disabled = true;
        otpMessage.textContent = "Verifying code securely...";
        try {
            await invokeOtp("verify-registration", {
                ...pendingRegistration,
                challengeId: registrationChallengeId,
                otp: otp
            });
            pendingRegistration = null;
            registrationChallengeId = "";
            clearInterval(cooldownTimer);
            otpModal.classList.remove("show");
            closeUserModal();
            await loadAccounts();
        } catch (error) {
            otpMessage.textContent = error.message || "Unable to verify the code.";
            otpCodeInput.select();
        } finally {
            verifyRegistrationButton.disabled = false;
            saveUserButton.disabled = false;
        }
    });

    resendCodeButton.addEventListener("click", async function () {
        if (!registrationChallengeId) return;
        resendCodeButton.disabled = true;
        otpMessage.textContent = "Sending a new code...";
        try {
            const response = await invokeOtp("resend", { challengeId: registrationChallengeId });
            otpMessage.textContent = `A new code was sent to ${response.maskedDestination}.`;
            startCooldown(response.resendAfter);
        } catch (error) {
            otpMessage.textContent = error.message || "Unable to resend the code.";
            resendCodeButton.disabled = false;
        }
    });

    cancelOtpButton.addEventListener("click", function () {
        clearInterval(cooldownTimer);
        otpModal.classList.remove("show");
        userModal.classList.add("show");
        saveUserButton.disabled = false;
    });


    usersTableBody.addEventListener("click", function (event) {
        const button = event.target.closest("button");

        if (!button || button.disabled) {
            return;
        }

        const action = button.dataset.action;
        const userId = button.dataset.id;

        if (action === "edit") {
            openEditModal(userId);
        }

        if (action === "toggle") {
            toggleAccountStatus(userId);
        }

        if (action === "delete") {
            userToDelete = userId;
            deleteModal.classList.add("show");
        }
    });

    async function toggleAccountStatus(userId) {
        const account = accounts.find(function (account) {
            return String(account.id) === String(userId);
        });

        if (!account) {
            return;
        }

        const nextStatus =
            account.status === "active"
                ? "disabled"
                : "active";

        try {
            await invokeAccountAdmin("set-status", {
                userId: userId,
                status: nextStatus
            });

            await loadAccounts();
        } catch (error) {
            alert(
                error.message ||
                "Unable to change the account status."
            );
        }
    }


    confirmDelete.addEventListener("click", async function () {
        if (!userToDelete) {
            return;
        }

        if (String(userToDelete) === String(currentUser.id)) {
            userToDelete = null;
            deleteModal.classList.remove("show");
            return;
        }

        confirmDelete.disabled = true;

        try {
            await invokeAccountAdmin("delete", {
                userId: userToDelete
            });

            userToDelete = null;
            deleteModal.classList.remove("show");
            await loadAccounts();
        } catch (error) {
            alert(
                error.message ||
                "Unable to delete the account."
            );
        } finally {
            confirmDelete.disabled = false;
        }
    });

    cancelDelete.addEventListener("click", function () {
        userToDelete = null;
        deleteModal.classList.remove("show");
    });


    userSearch.addEventListener("input", renderAccounts);
    roleFilter.addEventListener("change", renderAccounts);

    accountStatusFilter.addEventListener(
        "change",
        renderAccounts
    );


    openAddModalButton.addEventListener(
        "click",
        openAddModal
    );

    closeModalButton.addEventListener(
        "click",
        closeUserModal
    );

    cancelButton.addEventListener(
        "click",
        closeUserModal
    );

    userModal.addEventListener("click", function (event) {
        if (event.target === userModal) {
            closeUserModal();
        }
    });

    deleteModal.addEventListener("click", function (event) {
        if (event.target === deleteModal) {
            userToDelete = null;
            deleteModal.classList.remove("show");
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            if (otpModal.classList.contains("show")) {
                otpModal.classList.remove("show");
                userModal.classList.add("show");
                saveUserButton.disabled = false;
                return;
            }
            closeUserModal();

            userToDelete = null;
            deleteModal.classList.remove("show");
        }
    });


    logoutButton.addEventListener("click", async function () {
        const confirmLogout = confirm(
            "Are you sure you want to log out?"
        );

        if (!confirmLogout) {
            return;
        }

        await window.medtrackAuth.signOutAndRedirect();
    });


    try {
        await loadAccounts();
    } catch (error) {
        console.error("Unable to load Supabase accounts:", error);
        alert(
            error.message ||
            "Unable to load the account list."
        );
        renderAccounts();
    }
});
