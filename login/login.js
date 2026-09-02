// =====================================
// MEDTRACK LOGIN
// =====================================

const loginForm = document.getElementById("loginForm");
const formMessage = document.getElementById("formMessage");

const emailInput = document.getElementById("email");
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
loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = emailInput.value
        .trim()
        .toLowerCase();

    const password = passwordInput.value;
    const rememberMe = rememberMeInput.checked;
    const submitButton = loginForm.querySelector("button[type='submit']");

    // Check empty fields
    if (!email || !password) {
        showMessage(
            "Please enter your email and password.",
            "error"
        );

        return;
    }

    submitButton.disabled = true;
    showMessage("Signing in...", "success");

    try {
        const profile = await window.medtrackAuth.signIn(
            email,
            password,
            rememberMe
        );

        showMessage("Login successful. Redirecting...", "success");
        window.medtrackAuth.redirectToDashboard(profile);
    } catch (error) {
        showMessage(
            error.message || "Unable to sign in.",
            "error"
        );

        submitButton.disabled = false;
    }
});

// Forgot password message
forgotPasswordLink.addEventListener("click", function (event) {
    event.preventDefault();

    showMessage(
        "Password recovery is not available yet.",
        "error"
    );
});

window.medtrackAuth.redirectAuthenticatedUser();
