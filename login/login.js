const loginForm = document.getElementById("loginForm");
const formMessage = document.getElementById("formMessage");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const rememberMeInput = document.getElementById("rememberMe");
const togglePasswordButton = document.getElementById("togglePassword");
const forgotPasswordLink = document.querySelector(".forgot-password");
const recoveryModal = document.getElementById("recoveryModal");
const closeRecoveryButton = document.getElementById("closeRecovery");
const recoveryRequestForm = document.getElementById("recoveryRequestForm");
const recoveryVerifyForm = document.getElementById("recoveryVerifyForm");
const recoveryEmailInput = document.getElementById("recoveryEmail");
const recoveryRequestMessage = document.getElementById("recoveryRequestMessage");
const recoveryDestination = document.getElementById("recoveryDestination");
const recoveryOtpInput = document.getElementById("recoveryOtp");
const newPasswordInput = document.getElementById("newPassword");
const confirmNewPasswordInput = document.getElementById("confirmNewPassword");
const recoveryVerifyMessage = document.getElementById("recoveryVerifyMessage");
const resendRecoveryButton = document.getElementById("resendRecoveryCode");
const resetPasswordButton = document.getElementById("resetPasswordButton");

let recoveryChallengeId = "";
let recoveryCooldownTimer = null;

function showMessage(message, type) {
    formMessage.textContent = message;
    formMessage.className = `form-message ${type}`;
}

if (new URLSearchParams(window.location.search).get("reason") === "session-expired") {
    showMessage(
        "Your session ended after 30 minutes of inactivity. Please sign in again.",
        "error"
    );
    window.history.replaceState({}, "", window.location.pathname);
}

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

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const identifier = emailInput.value.trim();
    const password = passwordInput.value;
    const rememberMe = rememberMeInput.checked;
    const submitButton = loginForm.querySelector("button[type='submit']");

    if (!identifier || !password) {
        showMessage("Please enter your email or username and password.", "error");
        return;
    }

    submitButton.disabled = true;
    showMessage("Signing in...", "success");
    try {
        const profile = await window.medtrackAuth.signIn(identifier, password, rememberMe);
        passwordInput.value = "";
        showMessage("Login successful. Redirecting...", "success");
        window.medtrackAuth.redirectToDashboard(profile);
    } catch (error) {
        showMessage(error.message || "Unable to sign in.", "error");
        submitButton.disabled = false;
    }
});

async function functionErrorMessage(error) {
    const response = error && error.context;
    if (response && typeof response.clone === "function") {
        try {
            const data = await response.clone().json();
            if (data && data.error) return data.error;
        } catch (parseError) {
            console.error("Unable to read OTP error response:", parseError);
        }
    }
    return (error && error.message) || "Unable to complete password recovery.";
}

async function invokeOtp(action, values) {
    const result = await window.medtrackSupabase.functions.invoke("otp-auth", {
        body: { action: action, ...(values || {}) }
    });
    if (result.error) throw new Error(await functionErrorMessage(result.error));
    if (result.data && result.data.error) throw new Error(result.data.error);
    return result.data || {};
}

function startRecoveryCooldown(seconds) {
    clearInterval(recoveryCooldownTimer);
    let remaining = Number(seconds) || 60;
    resendRecoveryButton.disabled = true;
    resendRecoveryButton.innerHTML = `Resend Code (<span id="recoveryCooldown">${remaining}</span>s)`;
    recoveryCooldownTimer = setInterval(function () {
        remaining -= 1;
        const display = document.getElementById("recoveryCooldown");
        if (display) display.textContent = Math.max(0, remaining);
        if (remaining <= 0) {
            clearInterval(recoveryCooldownTimer);
            resendRecoveryButton.disabled = false;
            resendRecoveryButton.textContent = "Resend Code";
        }
    }, 1000);
}

function closeRecovery() {
    clearInterval(recoveryCooldownTimer);
    recoveryModal.classList.remove("show");
    recoveryModal.setAttribute("aria-hidden", "true");
    recoveryRequestForm.reset();
    recoveryVerifyForm.reset();
    recoveryOtpInput.disabled = false;
    newPasswordInput.disabled = false;
    confirmNewPasswordInput.disabled = false;
    resetPasswordButton.disabled = false;
    recoveryRequestForm.hidden = false;
    recoveryVerifyForm.hidden = true;
    recoveryRequestMessage.textContent = "";
    recoveryVerifyMessage.textContent = "";
    recoveryChallengeId = "";
}

forgotPasswordLink.addEventListener("click", function (event) {
    event.preventDefault();
    const currentIdentifier = emailInput.value.trim().toLowerCase();
    recoveryEmailInput.value = currentIdentifier.includes("@") ? currentIdentifier : "";
    recoveryModal.classList.add("show");
    recoveryModal.setAttribute("aria-hidden", "false");
    recoveryEmailInput.focus();
});

closeRecoveryButton.addEventListener("click", closeRecovery);
recoveryModal.addEventListener("click", function (event) {
    if (event.target === recoveryModal) closeRecovery();
});

recoveryRequestForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const email = recoveryEmailInput.value.trim().toLowerCase();
    const button = document.getElementById("sendRecoveryCode");

    if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/i.test(email)) {
        recoveryRequestMessage.textContent = "Enter your registered Gmail address.";
        recoveryRequestMessage.className = "form-message error";
        return;
    }

    button.disabled = true;
    recoveryRequestMessage.textContent = "Sending a secure verification code...";
    recoveryRequestMessage.className = "form-message success";
    try {
        const response = await invokeOtp("request-password-reset", { email });
        recoveryChallengeId = response.challengeId;
        recoveryDestination.textContent = response.maskedDestination;
        recoveryRequestForm.hidden = true;
        recoveryVerifyForm.hidden = false;
        startRecoveryCooldown(response.resendAfter);
        recoveryOtpInput.focus();
    } catch (error) {
        recoveryRequestMessage.textContent = error.message || "Unable to send the code.";
        recoveryRequestMessage.className = "form-message error";
    } finally {
        button.disabled = false;
    }
});

recoveryVerifyForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const otp = recoveryOtpInput.value.trim();
    const password = newPasswordInput.value;

    if (!/^\d{6}$/.test(otp)) {
        recoveryVerifyMessage.textContent = "Enter the six-digit verification code.";
        recoveryVerifyMessage.className = "form-message error";
        return;
    }
    const passwordError = window.medtrackAuth.passwordPolicyError(password);
    if (passwordError) {
        recoveryVerifyMessage.textContent = passwordError;
        recoveryVerifyMessage.className = "form-message error";
        return;
    }
    if (password !== confirmNewPasswordInput.value) {
        recoveryVerifyMessage.textContent = "The new passwords do not match.";
        recoveryVerifyMessage.className = "form-message error";
        return;
    }

    resetPasswordButton.disabled = true;
    recoveryVerifyMessage.textContent = "Verifying and resetting your password...";
    recoveryVerifyMessage.className = "form-message success";
    try {
        const response = await invokeOtp("reset-password", {
            challengeId: recoveryChallengeId,
            otp: otp,
            password: password
        });
        clearInterval(recoveryCooldownTimer);
        recoveryVerifyMessage.textContent = response.message;
        recoveryOtpInput.disabled = true;
        newPasswordInput.disabled = true;
        confirmNewPasswordInput.disabled = true;
        resetPasswordButton.disabled = true;
        setTimeout(closeRecovery, 1800);
    } catch (error) {
        recoveryVerifyMessage.textContent = error.message || "Unable to reset the password.";
        recoveryVerifyMessage.className = "form-message error";
        recoveryOtpInput.select();
        resetPasswordButton.disabled = false;
    }
});

resendRecoveryButton.addEventListener("click", async function () {
    if (!recoveryChallengeId) return;
    resendRecoveryButton.disabled = true;
    recoveryVerifyMessage.textContent = "Sending a new code...";
    try {
        const response = await invokeOtp("resend", { challengeId: recoveryChallengeId });
        recoveryDestination.textContent = response.maskedDestination;
        recoveryVerifyMessage.textContent = "A new verification code was sent.";
        recoveryVerifyMessage.className = "form-message success";
        startRecoveryCooldown(response.resendAfter);
    } catch (error) {
        recoveryVerifyMessage.textContent = error.message || "Unable to resend the code.";
        recoveryVerifyMessage.className = "form-message error";
        resendRecoveryButton.disabled = false;
    }
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && recoveryModal.classList.contains("show")) closeRecovery();
});

window.medtrackAuth.redirectAuthenticatedUser();
