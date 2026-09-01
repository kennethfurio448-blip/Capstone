// =====================================
// MEDTRACK LOGIN
// =====================================

const loginForm = document.getElementById("loginForm");
const formMessage = document.getElementById("formMessage");

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const rememberMeInput = document.getElementById("rememberMe");
const togglePasswordButton = document.getElementById("togglePassword");
const forgotPasswordLink = document.querySelector(".forgot-password");

// Show message
function showMessage(message, type) {
    formMessage.textContent = message;
    formMessage.className = `form-message ${type}`;
}

// Show or hide password
togglePasswordButton.addEventListener("click", function () {
    const icon = togglePasswordButton.querySelector("i");

    if (passwordInput.type === "password") {
        passwordInput.type = "text";

        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    } else {
        passwordInput.type = "password";

        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    }
});

// Login form
loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const usernameOrEmail = usernameInput.value
        .trim()
        .toLowerCase();

    const password = passwordInput.value;
    const rememberMe = rememberMeInput.checked;

    // Check empty fields
    if (!usernameOrEmail || !password) {
        showMessage(
            "Please enter your username and password.",
            "error"
        );

        return;
    }

    // Get accounts created from create-account.js
    const accounts =
        JSON.parse(localStorage.getItem("medtrackAccounts")) || [];

    if (accounts.length === 0) {
        showMessage(
            "No account found. Please create an account first.",
            "error"
        );

        return;
    }

    // Find matching account
    const matchedAccount = accounts.find(function (account) {
        const savedUsername = account.username.toLowerCase();
        const savedEmail = account.email.toLowerCase();

        const correctUsernameOrEmail =
            savedUsername === usernameOrEmail ||
            savedEmail === usernameOrEmail;

        const correctPassword =
            account.password === password;

        return correctUsernameOrEmail && correctPassword;
    });

    // Incorrect login
    if (!matchedAccount) {
        showMessage(
            "Incorrect username, email, or password.",
            "error"
        );

        return;
    }

    // Information for the currently logged-in user
    const currentUser = {
        id: matchedAccount.id,
        fullname: matchedAccount.fullname,
        username: matchedAccount.username,
        email: matchedAccount.email,
        role: matchedAccount.role,
        loginTime: new Date().toISOString()
    };

    // Clear previous login sessions
    localStorage.removeItem("medtrackCurrentUser");
    sessionStorage.removeItem("medtrackCurrentUser");

    // Remember login after browser closes
    if (rememberMe) {
        localStorage.setItem(
            "medtrackCurrentUser",
            JSON.stringify(currentUser)
        );
    } else {
        sessionStorage.setItem(
            "medtrackCurrentUser",
            JSON.stringify(currentUser)
        );
    }

    showMessage("Login successful. Redirecting...", "success");

    // Separate dashboard redirect
    setTimeout(function () {
        if (matchedAccount.role === "admin") {
            window.location.href = "admin-dashboard.html";
        } else if (matchedAccount.role === "staff") {
            window.location.href = "staff-dashboard.html";
        } else {
            showMessage("Invalid account role.", "error");
        }
    }, 1000);
});

// Forgot password message
forgotPasswordLink.addEventListener("click", function (event) {
    event.preventDefault();

    showMessage(
        "Password recovery is not available yet.",
        "error"
    );
});