// =====================================
// MEDTRACK MANAGE USERS
// ADMIN ONLY
// =====================================

document.addEventListener("DOMContentLoaded", function () {

    // =====================================
    // ELEMENTS
    // =====================================

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

    // User modal
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

    const formMessage =
        document.getElementById("formMessage");

    // Delete modal
    const deleteModal =
        document.getElementById("deleteModal");

    const cancelDelete =
        document.getElementById("cancelDelete");

    const confirmDelete =
        document.getElementById("confirmDelete");

    let userToDelete = null;

    // =====================================
    // CURRENT ADMIN
    // =====================================

    function getCurrentUser() {
        const savedUser =
            localStorage.getItem("medtrackCurrentUser") ||
            sessionStorage.getItem("medtrackCurrentUser");

        if (!savedUser) {
            return null;
        }

        try {
            return JSON.parse(savedUser);
        } catch (error) {
            return null;
        }
    }

    const currentUser = getCurrentUser();

    if (!currentUser) {
        window.location.replace("login.html");
        return;
    }

    // Staff cannot access Manage Users
    if (currentUser.role !== "admin") {
        window.location.replace("staff-dashboard.html");
        return;
    }

    currentUserName.textContent =
        currentUser.fullname ||
        currentUser.username ||
        "Administrator";

    // =====================================
    // ACCOUNT STORAGE
    // =====================================

    function generateUserCode(accounts) {
        let highestNumber = 0;

        accounts.forEach(function (account) {
            const number = Number(
                String(account.userId || "").replace("USR-", "")
            );

            if (!Number.isNaN(number) && number > highestNumber) {
                highestNumber = number;
            }
        });

        return `USR-${String(highestNumber + 1).padStart(3, "0")}`;
    }

    function getAccounts() {
        const savedAccounts =
            localStorage.getItem("medtrackAccounts");

        if (!savedAccounts) {
            return [];
        }

        try {
            const accounts = JSON.parse(savedAccounts);

            if (!Array.isArray(accounts)) {
                return [];
            }

            let accountChanged = false;

            accounts.forEach(function (account, index) {
                if (!account.userId) {
                    account.userId =
                        `USR-${String(index + 1).padStart(3, "0")}`;

                    accountChanged = true;
                }

                if (!account.status) {
                    account.status = "active";
                    accountChanged = true;
                }

                if (!account.createdAt) {
                    account.createdAt =
                        new Date().toISOString();

                    accountChanged = true;
                }
            });

            if (accountChanged) {
                saveAccounts(accounts);
            }

            return accounts;
        } catch (error) {
            return [];
        }
    }

    function saveAccounts(accounts) {
        localStorage.setItem(
            "medtrackAccounts",
            JSON.stringify(accounts)
        );
    }

    // =====================================
    // SAFE TEXT AND DATE
    // =====================================

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

    // =====================================
    // RENDER ACCOUNTS
    // =====================================

    function renderAccounts() {
        const accounts = getAccounts();

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

                <td>${escapeHTML(account.email)}</td>

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
                            ${isCurrentAccount ? "disabled" : ""}
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
                            ${isCurrentAccount ? "disabled" : ""}
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

    // =====================================
    // STATISTICS
    // =====================================

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

    // =====================================
    // OPEN ADD USER
    // =====================================

    function openAddModal() {
        userForm.reset();

        editingUserId.value = "";
        accountStatusInput.value = "active";
        modalTitle.textContent = "Add User";
        formMessage.textContent = "";

        passwordInput.required = true;
        confirmPasswordInput.required = true;

        userModal.classList.add("show");
        fullnameInput.focus();
    }

    // =====================================
    // OPEN EDIT USER
    // =====================================

    function openEditModal(userId) {
        const accounts = getAccounts();

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
        roleInput.value = account.role;
        accountStatusInput.value = account.status;

        passwordInput.value = "";
        confirmPasswordInput.value = "";

        passwordInput.required = false;
        confirmPasswordInput.required = false;

        // Current Admin cannot disable or demote their own account
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

        passwordInput.required = false;
        confirmPasswordInput.required = false;
    }

    // =====================================
    // SAVE USER
    // =====================================

    userForm.addEventListener("submit", function (event) {
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

        const accounts = getAccounts();

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

        if (usernameValue.length < 4) {
            formMessage.textContent =
                "Username must contain at least 4 characters.";

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

        if (passwordValue && passwordValue.length < 6) {
            formMessage.textContent =
                "Password must contain at least 6 characters.";

            return;
        }

        if (passwordValue !== confirmPasswordValue) {
            formMessage.textContent =
                "Passwords do not match.";

            return;
        }

        if (editId) {
            const accountIndex = accounts.findIndex(function (account) {
                return String(account.id) === String(editId);
            });

            if (accountIndex !== -1) {
                accounts[accountIndex] = {
                    ...accounts[accountIndex],
                    fullname: fullnameValue,
                    username: usernameValue,
                    email: emailValue,
                    role: roleValue,
                    status: statusValue
                };

                if (passwordValue) {
                    accounts[accountIndex].password =
                        passwordValue;
                }

                // Update the current session if Admin edited themselves
                if (String(editId) === String(currentUser.id)) {
                    updateCurrentSession({
                        ...currentUser,
                        fullname: fullnameValue,
                        username: usernameValue,
                        email: emailValue
                    });

                    currentUserName.textContent =
                        fullnameValue;
                }
            }
        } else {
            const newAccount = {
                id: Date.now(),
                userId: generateUserCode(accounts),
                fullname: fullnameValue,
                username: usernameValue,
                email: emailValue,
                role: roleValue,
                password: passwordValue,
                status: statusValue,
                createdAt: new Date().toISOString()
            };

            accounts.push(newAccount);
        }

        saveAccounts(accounts);
        closeUserModal();
        renderAccounts();
    });

    function updateCurrentSession(updatedUser) {
        if (localStorage.getItem("medtrackCurrentUser")) {
            localStorage.setItem(
                "medtrackCurrentUser",
                JSON.stringify(updatedUser)
            );
        }

        if (sessionStorage.getItem("medtrackCurrentUser")) {
            sessionStorage.setItem(
                "medtrackCurrentUser",
                JSON.stringify(updatedUser)
            );
        }
    }

    // =====================================
    // TABLE ACTIONS
    // =====================================

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

    // Enable or disable account
    function toggleAccountStatus(userId) {
        const accounts = getAccounts();

        const accountIndex = accounts.findIndex(function (account) {
            return String(account.id) === String(userId);
        });

        if (accountIndex === -1) {
            return;
        }

        accounts[accountIndex].status =
            accounts[accountIndex].status === "active"
                ? "disabled"
                : "active";

        saveAccounts(accounts);
        renderAccounts();
    }

    // =====================================
    // DELETE USER
    // =====================================

    confirmDelete.addEventListener("click", function () {
        if (!userToDelete) {
            return;
        }

        if (String(userToDelete) === String(currentUser.id)) {
            userToDelete = null;
            deleteModal.classList.remove("show");
            return;
        }

        const accounts = getAccounts();

        const updatedAccounts = accounts.filter(function (account) {
            return String(account.id) !== String(userToDelete);
        });

        saveAccounts(updatedAccounts);

        userToDelete = null;
        deleteModal.classList.remove("show");

        renderAccounts();
    });

    cancelDelete.addEventListener("click", function () {
        userToDelete = null;
        deleteModal.classList.remove("show");
    });

    // =====================================
    // SEARCH AND FILTERS
    // =====================================

    userSearch.addEventListener("input", renderAccounts);
    roleFilter.addEventListener("change", renderAccounts);

    accountStatusFilter.addEventListener(
        "change",
        renderAccounts
    );

    // =====================================
    // MODAL CONTROLS
    // =====================================

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
            closeUserModal();

            userToDelete = null;
            deleteModal.classList.remove("show");
        }
    });

    // =====================================
    // LOGOUT
    // =====================================

    logoutButton.addEventListener("click", function () {
        const confirmLogout = confirm(
            "Are you sure you want to log out?"
        );

        if (!confirmLogout) {
            return;
        }

        localStorage.removeItem("medtrackCurrentUser");
        sessionStorage.removeItem("medtrackCurrentUser");

        window.location.replace("login.html");
    });

    // =====================================
    // INITIAL DISPLAY
    // =====================================

    renderAccounts();
});