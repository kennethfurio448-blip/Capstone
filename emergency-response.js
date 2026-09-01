// =====================================
// MEDTRACK EMERGENCY RESPONSE
// =====================================

document.addEventListener("DOMContentLoaded", function () {

    // =====================================
    // ELEMENTS
    // =====================================

    const dashboardLink =
        document.getElementById("dashboardLink");

    const adminNavigation =
        document.getElementById("adminNavigation");

    const portalName =
        document.getElementById("portalName");

    const currentUserName =
        document.getElementById("currentUserName");

    const currentUserRole =
        document.getElementById("currentUserRole");

    const logoutButton =
        document.getElementById("logoutButton");

    const notificationButton =
        document.getElementById("notificationButton");

    const notificationCount =
        document.getElementById("notificationCount");

    const totalRequests =
        document.getElementById("totalRequests");

    const pendingRequests =
        document.getElementById("pendingRequests");

    const activeRequests =
        document.getElementById("activeRequests");

    const completedRequests =
        document.getElementById("completedRequests");

    const requestTableBody =
        document.getElementById("requestTableBody");

    const emptyState =
        document.getElementById("emptyState");

    const requestSearch =
        document.getElementById("requestSearch");

    const emergencyTypeFilter =
        document.getElementById("emergencyTypeFilter");

    const priorityFilter =
        document.getElementById("priorityFilter");

    const statusFilter =
        document.getElementById("statusFilter");

    // Request form modal
    const requestModal =
        document.getElementById("requestModal");

    const openAddModalButton =
        document.getElementById("openAddModal");

    const closeModalButton =
        document.getElementById("closeModal");

    const cancelButton =
        document.getElementById("cancelButton");

    const modalTitle =
        document.getElementById("modalTitle");

    const requestForm =
        document.getElementById("requestForm");

    const editingRequestId =
        document.getElementById("editingRequestId");

    const requestDate =
        document.getElementById("requestDate");

    const requestTime =
        document.getElementById("requestTime");

    const emergencyType =
        document.getElementById("emergencyType");

    const requestPriority =
        document.getElementById("requestPriority");

    const requestLocation =
        document.getElementById("requestLocation");

    const contactPerson =
        document.getElementById("contactPerson");

    const contactNumber =
        document.getElementById("contactNumber");

    const assignedTeam =
        document.getElementById("assignedTeam");

    const requestStatus =
        document.getElementById("requestStatus");

    const requiredResources =
        document.getElementById("requiredResources");

    const requestDescription =
        document.getElementById("requestDescription");

    const formMessage =
        document.getElementById("formMessage");

    // Complete modal
    const completeModal =
        document.getElementById("completeModal");

    const cancelComplete =
        document.getElementById("cancelComplete");

    const confirmComplete =
        document.getElementById("confirmComplete");

    // Delete modal
    const deleteModal =
        document.getElementById("deleteModal");

    const cancelDelete =
        document.getElementById("cancelDelete");

    const confirmDelete =
        document.getElementById("confirmDelete");

    let requestToComplete = null;
    let requestToDelete = null;

    // =====================================
    // LOGIN AND ROLE CHECK
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

    if (
        currentUser.role !== "admin" &&
        currentUser.role !== "staff"
    ) {
        localStorage.removeItem("medtrackCurrentUser");
        sessionStorage.removeItem("medtrackCurrentUser");

        window.location.replace("login.html");
        return;
    }

    const displayName =
        currentUser.fullname ||
        currentUser.username ||
        "MedTrack User";

    currentUserName.textContent = displayName;
    currentUserRole.textContent = currentUser.role;

    if (currentUser.role === "admin") {
        portalName.textContent = "Admin Portal";
        dashboardLink.href = "admin-dashboard.html";
        adminNavigation.style.display = "block";
    } else {
        portalName.textContent = "Staff Portal";
        dashboardLink.href = "staff-dashboard.html";
        adminNavigation.style.display = "none";
    }

    // =====================================
    // DATE AND TIME
    // =====================================

    function getCurrentDate() {
        const today = new Date();

        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function getCurrentTime() {
        const now = new Date();

        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");

        return `${hours}:${minutes}`;
    }

    function formatDateTime(dateValue, timeValue) {
        if (!dateValue) {
            return "—";
        }

        const date = new Date(
            `${dateValue}T${timeValue || "00:00"}`
        );

        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    // =====================================
    // DEFAULT REQUESTS
    // =====================================

    const defaultRequests = [
        {
            id: "RES-001",
            date: "2026-08-28",
            time: "08:30",
            type: "Medical Emergency",
            priority: "High",
            location: "Barangay Central",
            contactPerson: "Juan Dela Cruz",
            contactNumber: "09123456789",
            assignedTeam: "Response Team A",
            status: "In Progress",
            resources: "Ambulance and first aid kit",
            description: "Medical assistance requested.",
            completedAt: ""
        },
        {
            id: "RES-002",
            date: "2026-08-28",
            time: "09:15",
            type: "Flood Response",
            priority: "Critical",
            location: "Riverside Area",
            contactPerson: "Maria Santos",
            contactNumber: "09987654321",
            assignedTeam: "Rescue Team B",
            status: "Pending",
            resources: "Rescue vehicle and safety equipment",
            description: "Residents requested evacuation assistance.",
            completedAt: ""
        },
        {
            id: "RES-003",
            date: "2026-08-27",
            time: "14:00",
            type: "Road Accident",
            priority: "Medium",
            location: "National Highway",
            contactPerson: "Pedro Reyes",
            contactNumber: "09112223333",
            assignedTeam: "Response Team C",
            status: "Completed",
            resources: "Ambulance and medical equipment",
            description: "Response team provided assistance.",
            completedAt: "2026-08-27T15:20:00"
        }
    ];

    // =====================================
    // LOCAL STORAGE
    // =====================================

    function getRequests() {
        const savedRequests =
            localStorage.getItem("medtrackEmergencyRequests");

        if (!savedRequests) {
            localStorage.setItem(
                "medtrackEmergencyRequests",
                JSON.stringify(defaultRequests)
            );

            return [...defaultRequests];
        }

        try {
            const parsedRequests = JSON.parse(savedRequests);

            return Array.isArray(parsedRequests)
                ? parsedRequests
                : [];
        } catch (error) {
            return [];
        }
    }

    function saveRequests(requests) {
        localStorage.setItem(
            "medtrackEmergencyRequests",
            JSON.stringify(requests)
        );
    }

    // =====================================
    // SAFE TEXT
    // =====================================

    function escapeHTML(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    // =====================================
    // CSS CLASSES
    // =====================================

    function getStatusClass(status) {
        if (status === "Pending") {
            return "status-pending";
        }

        if (status === "In Progress") {
            return "status-in-progress";
        }

        if (status === "Completed") {
            return "status-completed";
        }

        return "status-cancelled";
    }

    function getPriorityClass(priority) {
        if (priority === "Critical") {
            return "priority-critical";
        }

        if (priority === "High") {
            return "priority-high";
        }

        if (priority === "Medium") {
            return "priority-medium";
        }

        return "priority-low";
    }

    // =====================================
    // GENERATE REQUEST ID
    // =====================================

    function generateRequestId(requests) {
        let highestNumber = 0;

        requests.forEach(function (request) {
            const number = Number(
                String(request.id).replace("RES-", "")
            );

            if (!Number.isNaN(number) && number > highestNumber) {
                highestNumber = number;
            }
        });

        return `RES-${String(highestNumber + 1).padStart(3, "0")}`;
    }

    // =====================================
    // RENDER REQUESTS
    // =====================================

    function renderRequests() {
        const requests = getRequests();

        const searchValue =
            requestSearch.value.trim().toLowerCase();

        const selectedType =
            emergencyTypeFilter.value;

        const selectedPriority =
            priorityFilter.value;

        const selectedStatus =
            statusFilter.value;

        const filteredRequests = requests.filter(function (request) {
            const matchesSearch =
                request.id.toLowerCase().includes(searchValue) ||
                request.location.toLowerCase().includes(searchValue) ||
                request.contactPerson.toLowerCase().includes(searchValue) ||
                request.assignedTeam.toLowerCase().includes(searchValue);

            const matchesType =
                selectedType === "all" ||
                request.type === selectedType;

            const matchesPriority =
                selectedPriority === "all" ||
                request.priority === selectedPriority;

            const matchesStatus =
                selectedStatus === "all" ||
                request.status === selectedStatus;

            return (
                matchesSearch &&
                matchesType &&
                matchesPriority &&
                matchesStatus
            );
        });

        requestTableBody.innerHTML = "";

        if (filteredRequests.length === 0) {
            emptyState.classList.add("show");
        } else {
            emptyState.classList.remove("show");
        }

        filteredRequests.forEach(function (request) {
            const statusClass =
                getStatusClass(request.status);

            const priorityClass =
                getPriorityClass(request.priority);

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${escapeHTML(request.id)}</td>

                <td>
                    ${escapeHTML(
                        formatDateTime(request.date, request.time)
                    )}
                </td>

                <td>${escapeHTML(request.type)}</td>

                <td>
                    <strong>${escapeHTML(request.location)}</strong>
                </td>

                <td>${escapeHTML(request.contactPerson)}</td>

                <td>${escapeHTML(request.contactNumber)}</td>

                <td>${escapeHTML(request.assignedTeam)}</td>

                <td>
                    <span class="priority-badge ${priorityClass}">
                        ${escapeHTML(request.priority)}
                    </span>
                </td>

                <td>
                    <span class="status-badge ${statusClass}">
                        ${escapeHTML(request.status)}
                    </span>
                </td>

                <td>
                    <div class="table-actions">

                        ${
                            request.status === "Pending"
                                ? `
                                    <button
                                        type="button"
                                        class="start-action"
                                        data-action="start"
                                        data-id="${escapeHTML(request.id)}"
                                        title="Start response"
                                    >
                                        <i class="fa-solid fa-play"></i>
                                    </button>
                                `
                                : ""
                        }

                        ${
                            request.status === "Pending" ||
                            request.status === "In Progress"
                                ? `
                                    <button
                                        type="button"
                                        class="complete-action"
                                        data-action="complete"
                                        data-id="${escapeHTML(request.id)}"
                                        title="Complete response"
                                    >
                                        <i class="fa-solid fa-check"></i>
                                    </button>
                                `
                                : ""
                        }

                        <button
                            type="button"
                            class="edit-button"
                            data-action="edit"
                            data-id="${escapeHTML(request.id)}"
                            title="Edit request"
                        >
                            <i class="fa-solid fa-pen"></i>
                        </button>

                        <button
                            type="button"
                            class="remove-button"
                            data-action="delete"
                            data-id="${escapeHTML(request.id)}"
                            title="Delete request"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>

                    </div>
                </td>
            `;

            requestTableBody.appendChild(row);
        });

        updateStatistics(requests);
    }

    // =====================================
    // STATISTICS
    // =====================================

    function updateStatistics(requests) {
        const pendingCount = requests.filter(function (request) {
            return request.status === "Pending";
        }).length;

        const activeCount = requests.filter(function (request) {
            return request.status === "In Progress";
        }).length;

        const completedCount = requests.filter(function (request) {
            return request.status === "Completed";
        }).length;

        const urgentCount = requests.filter(function (request) {
            return (
                request.status !== "Completed" &&
                request.status !== "Cancelled" &&
                (
                    request.priority === "Critical" ||
                    request.priority === "High"
                )
            );
        }).length;

        totalRequests.textContent = requests.length;
        pendingRequests.textContent = pendingCount;
        activeRequests.textContent = activeCount;
        completedRequests.textContent = completedCount;
        notificationCount.textContent = urgentCount;
    }

    // =====================================
    // OPEN ADD MODAL
    // =====================================

    function openAddModal() {
        requestForm.reset();

        editingRequestId.value = "";
        requestDate.value = getCurrentDate();
        requestTime.value = getCurrentTime();
        requestStatus.value = "Pending";

        modalTitle.textContent = "New Emergency Request";
        formMessage.textContent = "";

        requestModal.classList.add("show");
        emergencyType.focus();
    }

    // =====================================
    // OPEN EDIT MODAL
    // =====================================

    function openEditModal(requestId) {
        const requests = getRequests();

        const selectedRequest = requests.find(function (request) {
            return request.id === requestId;
        });

        if (!selectedRequest) {
            return;
        }

        editingRequestId.value = selectedRequest.id;
        requestDate.value = selectedRequest.date;
        requestTime.value = selectedRequest.time;
        emergencyType.value = selectedRequest.type;
        requestPriority.value = selectedRequest.priority;
        requestLocation.value = selectedRequest.location;
        contactPerson.value = selectedRequest.contactPerson;
        contactNumber.value = selectedRequest.contactNumber;
        assignedTeam.value = selectedRequest.assignedTeam;
        requestStatus.value = selectedRequest.status;
        requiredResources.value = selectedRequest.resources;
        requestDescription.value = selectedRequest.description;

        modalTitle.textContent = "Edit Emergency Request";
        formMessage.textContent = "";

        requestModal.classList.add("show");
    }

    function closeRequestModal() {
        requestModal.classList.remove("show");
        requestForm.reset();

        editingRequestId.value = "";
        formMessage.textContent = "";
    }

    // =====================================
    // SAVE OR UPDATE REQUEST
    // =====================================

    requestForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const dateValue = requestDate.value;
        const timeValue = requestTime.value;
        const typeValue = emergencyType.value;
        const priorityValue = requestPriority.value;
        const locationValue = requestLocation.value.trim();
        const contactPersonValue = contactPerson.value.trim();

        const contactNumberValue =
            contactNumber.value.trim();

        const assignedTeamValue =
            assignedTeam.value.trim();

        const statusValue = requestStatus.value;

        const resourcesValue =
            requiredResources.value.trim();

        const descriptionValue =
            requestDescription.value.trim();

        if (
            !dateValue ||
            !timeValue ||
            !typeValue ||
            !priorityValue ||
            !locationValue ||
            !contactPersonValue ||
            !contactNumberValue ||
            !assignedTeamValue ||
            !statusValue ||
            !resourcesValue ||
            !descriptionValue
        ) {
            formMessage.textContent =
                "Please complete all fields.";

            return;
        }

        const validContactNumber =
            /^[0-9+\-\s]{7,15}$/.test(contactNumberValue);

        if (!validContactNumber) {
            formMessage.textContent =
                "Please enter a valid contact number.";

            return;
        }

        const requests = getRequests();
        const editId = editingRequestId.value;

        if (editId) {
            const requestIndex = requests.findIndex(function (request) {
                return request.id === editId;
            });

            if (requestIndex !== -1) {
                const previousRequest = requests[requestIndex];

                requests[requestIndex] = {
                    ...previousRequest,
                    date: dateValue,
                    time: timeValue,
                    type: typeValue,
                    priority: priorityValue,
                    location: locationValue,
                    contactPerson: contactPersonValue,
                    contactNumber: contactNumberValue,
                    assignedTeam: assignedTeamValue,
                    status: statusValue,
                    resources: resourcesValue,
                    description: descriptionValue,
                    completedAt:
                        statusValue === "Completed"
                            ? previousRequest.completedAt ||
                              new Date().toISOString()
                            : ""
                };
            }
        } else {
            const newRequest = {
                id: generateRequestId(requests),
                date: dateValue,
                time: timeValue,
                type: typeValue,
                priority: priorityValue,
                location: locationValue,
                contactPerson: contactPersonValue,
                contactNumber: contactNumberValue,
                assignedTeam: assignedTeamValue,
                status: statusValue,
                resources: resourcesValue,
                description: descriptionValue,
                completedAt:
                    statusValue === "Completed"
                        ? new Date().toISOString()
                        : ""
            };

            requests.push(newRequest);
        }

        saveRequests(requests);
        closeRequestModal();
        renderRequests();
    });

    // =====================================
    // TABLE ACTIONS
    // =====================================

    requestTableBody.addEventListener("click", function (event) {
        const button = event.target.closest("button");

        if (!button) {
            return;
        }

        const action = button.dataset.action;
        const requestId = button.dataset.id;

        if (action === "start") {
            const requests = getRequests();

            const requestIndex = requests.findIndex(function (request) {
                return request.id === requestId;
            });

            if (requestIndex !== -1) {
                requests[requestIndex].status = "In Progress";
                saveRequests(requests);
                renderRequests();
            }
        }

        if (action === "complete") {
            requestToComplete = requestId;
            completeModal.classList.add("show");
        }

        if (action === "edit") {
            openEditModal(requestId);
        }

        if (action === "delete") {
            requestToDelete = requestId;
            deleteModal.classList.add("show");
        }
    });

    // =====================================
    // COMPLETE REQUEST
    // =====================================

    confirmComplete.addEventListener("click", function () {
        if (!requestToComplete) {
            return;
        }

        const requests = getRequests();

        const requestIndex = requests.findIndex(function (request) {
            return request.id === requestToComplete;
        });

        if (requestIndex !== -1) {
            requests[requestIndex].status = "Completed";

            requests[requestIndex].completedAt =
                new Date().toISOString();
        }

        saveRequests(requests);

        requestToComplete = null;
        completeModal.classList.remove("show");

        renderRequests();
    });

    cancelComplete.addEventListener("click", function () {
        requestToComplete = null;
        completeModal.classList.remove("show");
    });

    // =====================================
    // DELETE REQUEST
    // =====================================

    confirmDelete.addEventListener("click", function () {
        if (!requestToDelete) {
            return;
        }

        const requests = getRequests();

        const updatedRequests = requests.filter(function (request) {
            return request.id !== requestToDelete;
        });

        saveRequests(updatedRequests);

        requestToDelete = null;
        deleteModal.classList.remove("show");

        renderRequests();
    });

    cancelDelete.addEventListener("click", function () {
        requestToDelete = null;
        deleteModal.classList.remove("show");
    });

    // =====================================
    // SEARCH AND FILTERS
    // =====================================

    requestSearch.addEventListener("input", renderRequests);

    emergencyTypeFilter.addEventListener(
        "change",
        renderRequests
    );

    priorityFilter.addEventListener(
        "change",
        renderRequests
    );

    statusFilter.addEventListener(
        "change",
        renderRequests
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
        closeRequestModal
    );

    cancelButton.addEventListener(
        "click",
        closeRequestModal
    );

    requestModal.addEventListener("click", function (event) {
        if (event.target === requestModal) {
            closeRequestModal();
        }
    });

    completeModal.addEventListener("click", function (event) {
        if (event.target === completeModal) {
            requestToComplete = null;
            completeModal.classList.remove("show");
        }
    });

    deleteModal.addEventListener("click", function (event) {
        if (event.target === deleteModal) {
            requestToDelete = null;
            deleteModal.classList.remove("show");
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeRequestModal();

            requestToComplete = null;
            requestToDelete = null;

            completeModal.classList.remove("show");
            deleteModal.classList.remove("show");
        }
    });

    // =====================================
    // NOTIFICATION
    // =====================================

    notificationButton.addEventListener("click", function () {
        const requests = getRequests();

        const urgentRequests = requests.filter(function (request) {
            return (
                request.status !== "Completed" &&
                request.status !== "Cancelled" &&
                (
                    request.priority === "Critical" ||
                    request.priority === "High"
                )
            );
        });

        if (urgentRequests.length === 0) {
            alert("There are no urgent response requests.");
            return;
        }

        alert(
            `There are ${urgentRequests.length} urgent response requests.`
        );
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

    renderRequests();
});