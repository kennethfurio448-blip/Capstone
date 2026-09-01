const createAccountForm = document.getElementById("createAccountForm");
const formMessage = document.getElementById("formMessage");

const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");

const togglePassword = document.getElementById("togglePassword");
const toggleConfirmPassword = document.getElementById(
    "toggleConfirmPassword"
);

function togglePasswordVisibility(input, button) {
    const icon = button.querySelector("i");

    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    }
}

togglePassword.addEventListener("click", function () {
    togglePasswordVisibility(passwordInput, togglePassword);
});

toggleConfirmPassword.addEventListener("click", function () {
    togglePasswordVisibility(
        confirmPasswordInput,
        toggleConfirmPassword
    );
});

function showMessage(message, type) {
    formMessage.textContent = message;
    formMessage.className = `form-message ${type}`;
}

createAccountForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const fullname = document
        .getElementById("fullname")
        .value.trim();

    const username = document
        .getElementById("username")
        .value.trim();

    const email = document
        .getElementById("email")
        .value.trim()
        .toLowerCase();

    const role = document.getElementById("role").value;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (
        !fullname ||
        !username ||
        !email ||
        !role ||
        !password ||
        !confirmPassword
    ) {
        showMessage("Please complete all fields.", "error");
        return;
    }

    if (username.length < 4) {
        showMessage(
            "Username must contain at least 4 characters.",
            "error"
        );
        return;
    }

    if (password.length < 6) {
        showMessage(
            "Password must contain at least 6 characters.",
            "error"
        );
        return;
    }

    if (password !== confirmPassword) {
        showMessage("Passwords do not match.", "error");
        return;
    }

    const accounts =
        JSON.parse(localStorage.getItem("medtrackAccounts")) || [];

    const usernameExists = accounts.some(function (account) {
        return (
            account.username.toLowerCase() ===
            username.toLowerCase()
        );
    });

    if (usernameExists) {
        showMessage("That username is already registered.", "error");
        return;
    }

    const emailExists = accounts.some(function (account) {
        return account.email.toLowerCase() === email;
    });

    if (emailExists) {
        showMessage("That email address is already registered.", "error");
        return;
    }

    const newAccount = {
        id: Date.now(),
        fullname: fullname,
        username: username,
        email: email,
        role: role,
        password: password,
        createdAt: new Date().toISOString()
    };

    accounts.push(newAccount);

    localStorage.setItem(
        "medtrackAccounts",
        JSON.stringify(accounts)
    );

    showMessage(
        `${role === "admin" ? "Admin" : "Staff"} account created successfully!`,
        "success"
    );

    createAccountForm.reset();

    setTimeout(function () {
        window.location.href = "login.html";
    }, 1500);
});