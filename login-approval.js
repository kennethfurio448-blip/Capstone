(function () {
    "use strict";

    const title = document.getElementById("approvalTitle");
    const description = document.getElementById("approvalDescription");
    const message = document.getElementById("approvalMessage");
    const confirmButton = document.getElementById("confirmDecision");
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    const requestId = parameters.get("request") || "";
    const token = parameters.get("token") || "";
    const decision = parameters.get("decision") || "";

    window.history.replaceState({}, "", window.location.pathname);

    function showInvalidLink() {
        title.textContent = "Invalid Approval Link";
        description.textContent = "This login approval link is incomplete or invalid.";
        message.textContent = "Request a new approval email from the MedTrack login page.";
        message.classList.add("error");
        confirmButton.hidden = true;
    }

    if (!requestId || !token || !["allow", "deny"].includes(decision)) {
        showInvalidLink();
        return;
    }

    if (decision === "allow") {
        title.textContent = "Allow MedTrack Login?";
        description.textContent = "Choose Confirm Allow only if you started the login shown in the email.";
        confirmButton.textContent = "Yes, It Was Me — Allow Login";
    } else {
        title.textContent = "Deny MedTrack Login?";
        description.textContent = "Deny this request if you did not attempt to sign in.";
        confirmButton.textContent = "No, It Wasn't Me — Deny Login";
        confirmButton.classList.add("deny");
    }

    confirmButton.addEventListener("click", async function () {
        confirmButton.disabled = true;
        message.classList.remove("error");
        message.textContent = decision === "allow" ? "Approving login…" : "Blocking login…";
        try {
            const response = await fetch("/api/login-approval", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "decide",
                    requestId: requestId,
                    token: token,
                    decision: decision
                })
            });
            const result = await response.json().catch(function () {
                return { error: "The approval service returned an invalid response." };
            });
            if (!response.ok || result.error) throw new Error(result.error || "Unable to record your decision.");
            message.textContent = result.message;
            confirmButton.hidden = true;
            description.textContent = decision === "allow"
                ? "The original browser will complete the login securely."
                : "Access was not granted and the account owner has been notified.";
        } catch (error) {
            message.textContent = error.message || "Unable to record your decision.";
            message.classList.add("error");
            confirmButton.disabled = false;
        }
    });
})();
