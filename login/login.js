
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
const loginApprovalPanel = document.getElementById("loginApprovalPanel");
const loginApprovalDestination = document.getElementById("loginApprovalDestination");
const loginApprovalStatus = document.getElementById("loginApprovalStatus");
const loginApprovalCountdown = document.getElementById("loginApprovalCountdown");
const resendLoginApprovalButton = document.getElementById("resendLoginApproval");
const cancelLoginApprovalButton = document.getElementById("cancelLoginApproval");
const trustDeviceInput = document.getElementById("trustDevice");

let recoveryChallengeId = "";
let recoveryCooldownTimer = null;
let pendingLogin = null;
let pendingPassword = "";
let loginApprovalPollTimer = null;
let loginApprovalClockTimer = null;
let loginApprovalFinalizing = false;

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

async function invokeLoginApproval(action, values) {
    const response = await fetch("/api/login-approval", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action, ...(values || {}) })
    });
    const data = await response.json().catch(function () {
        return { error: "The login approval service returned an invalid response." };
    });
    if (!response.ok || data.error) {
        const error = new Error(data.error || "Unable to complete login approval.");
        error.retryAfter = Number(data.retryAfter) || 0;
        throw error;
    }
    return data;
}

function stopLoginApprovalTimers() {
    clearInterval(loginApprovalPollTimer);
    clearInterval(loginApprovalClockTimer);
    loginApprovalPollTimer = null;
    loginApprovalClockTimer = null;
}

function resetLoginApproval() {
    stopLoginApprovalTimers();
    pendingLogin = null;
    pendingPassword = "";
    loginApprovalFinalizing = false;
    trustDeviceInput.checked = false;
    loginApprovalPanel.hidden = true;
    loginForm.hidden = false;
    loginForm.querySelector("button[type='submit']").disabled = false;
    passwordInput.value = "";
    passwordInput.focus();
}

function updateLoginApprovalClock() {
    if (!pendingLogin) return;
    const seconds = Math.max(0, Math.ceil((pendingLogin.expiresAt - Date.now()) / 1000));
    const minutes = Math.floor(seconds / 60);
    loginApprovalCountdown.textContent = `${minutes}:${String(seconds % 60).padStart(2, "0")}`;

    const resendSeconds = Math.max(0, Math.ceil((pendingLogin.resendAt - Date.now()) / 1000));
    resendLoginApprovalButton.disabled = resendSeconds > 0 || loginApprovalFinalizing;
    resendLoginApprovalButton.textContent = resendSeconds > 0
        ? `Resend Email (${resendSeconds}s)`
        : "Resend Email";

    if (seconds === 0) {
        loginApprovalStatus.textContent = "This login request has expired. Access was not granted.";
        loginApprovalStatus.classList.add("error");
        clearInterval(loginApprovalClockTimer);
        loginApprovalClockTimer = null;
        checkLoginApproval();
    }
}

async function finishApprovedLogin() {
    if (!pendingLogin || loginApprovalFinalizing) return;
    loginApprovalFinalizing = true;
    loginApprovalStatus.textContent = "Approval received. Securing your session…";
    resendLoginApprovalButton.disabled = true;
    try {
        const result = await invokeLoginApproval("finalize", {
            requestId: pendingLogin.requestId,
            browserSecret: pendingLogin.browserSecret,
            password: pendingPassword,
            trustDevice: trustDeviceInput.checked
        });
        pendingPassword = "";
        const profile = await window.medtrackAuth.completeApprovedLogin(
            result.session,
            pendingLogin.rememberMe
        );
        stopLoginApprovalTimers();
        loginApprovalStatus.textContent = "Login approved. Redirecting…";
        window.medtrackAuth.redirectToDashboard(profile);
    } catch (error) {
        pendingPassword = "";
        loginApprovalStatus.textContent = error.message || "Unable to complete the approved login.";
        loginApprovalStatus.classList.add("error");
        stopLoginApprovalTimers();
    }
}

async function checkLoginApproval() {
    if (!pendingLogin || loginApprovalFinalizing) return;
    try {
        const result = await invokeLoginApproval("status", {
            requestId: pendingLogin.requestId,
            browserSecret: pendingLogin.browserSecret
        });
        if (result.status === "approved") {
            await finishApprovedLogin();
        } else if (["denied", "expired", "completed"].includes(result.status)) {
            loginApprovalStatus.textContent = result.status === "denied"
                ? "This login was denied. Access was not granted."
                : "This login request is no longer available.";
            loginApprovalStatus.classList.add("error");
            stopLoginApprovalTimers();
        }
    } catch (error) {
        loginApprovalStatus.textContent = error.message || "Unable to check approval status.";
        loginApprovalStatus.classList.add("error");
    }
}

function showPendingLogin(result, password, rememberMe) {
    pendingPassword = password;
    pendingLogin = {
        requestId: result.requestId,
        browserSecret: result.browserSecret,
        rememberMe: rememberMe,
        expiresAt: Date.now() + Number(result.expiresIn || 600) * 1000,
        resendAt: Date.now() + Number(result.resendAfter || 60) * 1000
    };
    loginApprovalDestination.textContent = result.maskedDestination;
    loginApprovalStatus.textContent = "Waiting for your approval…";
    loginApprovalStatus.classList.remove("error");
    loginForm.hidden = true;
    loginApprovalPanel.hidden = false;
    updateLoginApprovalClock();
    loginApprovalClockTimer = setInterval(updateLoginApprovalClock, 1000);
    loginApprovalPollTimer = setInterval(checkLoginApproval, 3000);
}

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = emailInput.value
        .trim()
        .toLowerCase();

    const password = passwordInput.value;
    const rememberMe = rememberMeInput.checked;
    const submitButton = loginForm.querySelector("button[type='submit']");

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
        const result = await invokeLoginApproval("begin", {
            email: email,
            password: password,
            rememberMe: rememberMe
        });

        if (result.status === "completed" && result.session) {
            const profile = await window.medtrackAuth.completeApprovedLogin(result.session, rememberMe);
            passwordInput.value = "";
            showMessage("Trusted device verified. Redirecting…", "success");
            window.medtrackAuth.redirectToDashboard(profile);
            return;
        }

        showMessage("", "success");
        showPendingLogin(result, password, rememberMe);
    } catch (error) {
        showMessage(
            error.message || "Unable to sign in.",
            "error"
        );

        submitButton.disabled = false;
    }
});

resendLoginApprovalButton.addEventListener("click", async function () {
    if (!pendingLogin) return;
    resendLoginApprovalButton.disabled = true;
    loginApprovalStatus.classList.remove("error");
    loginApprovalStatus.textContent = "Sending a new approval email…";
    try {
        const result = await invokeLoginApproval("resend", {
            requestId: pendingLogin.requestId,
            browserSecret: pendingLogin.browserSecret
        });
        pendingLogin.expiresAt = Date.now() + Number(result.expiresIn || 600) * 1000;
        pendingLogin.resendAt = Date.now() + Number(result.resendAfter || 60) * 1000;
        loginApprovalStatus.textContent = "A new approval email was sent.";
        updateLoginApprovalClock();
    } catch (error) {
        if (error.retryAfter) pendingLogin.resendAt = Date.now() + error.retryAfter * 1000;
        loginApprovalStatus.textContent = error.message || "Unable to resend the approval email.";
        loginApprovalStatus.classList.add("error");
        updateLoginApprovalClock();
    }
});

cancelLoginApprovalButton.addEventListener("click", async function () {
    if (pendingLogin) {
        try {
            await invokeLoginApproval("cancel", {
                requestId: pendingLogin.requestId,
                browserSecret: pendingLogin.browserSecret
            });
        } catch (error) {
            console.error("Unable to cancel the pending login:", error);
        }
    }
    resetLoginApproval();
});

document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && pendingLogin) checkLoginApproval();
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
    recoveryEmailInput.value = emailInput.value.trim().toLowerCase();
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
