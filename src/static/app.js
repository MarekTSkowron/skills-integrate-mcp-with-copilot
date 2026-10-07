document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupContainer = document.getElementById("signup-container");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const adminStatus = document.getElementById("admin-status");
  const loginButton = document.getElementById("login-button");
  const logoutButton = document.getElementById("logout-button");
  const loginDialog = document.getElementById("login-dialog");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const cancelLoginButton = document.getElementById("cancel-login");

  let isAdmin = false;
  let messageTimeout;

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => messageDiv.classList.add("hidden"), 5000);
  }

  async function refreshAdminSession() {
    try {
      const response = await fetch("/admin/session");
      if (!response.ok) {
        throw new Error(`Session check failed (${response.status})`);
      }

      const session = await response.json();
      isAdmin = session.authenticated;
      signupContainer.classList.toggle("hidden", !isAdmin);
      loginButton.classList.toggle("hidden", isAdmin);
      logoutButton.classList.toggle("hidden", !isAdmin);
      loginButton.disabled = !session.configured;
      adminStatus.textContent = isAdmin
        ? "Staff access enabled"
        : session.configured
          ? "Staff access only"
          : "Staff login is not configured";
    } catch (error) {
      isAdmin = false;
      signupContainer.classList.add("hidden");
      loginButton.classList.remove("hidden");
      logoutButton.classList.add("hidden");
      loginButton.disabled = true;
      adminStatus.textContent = "Staff access status unavailable";
      console.error("Error checking staff session:", error);
    }
  }

  function addText(parent, tagName, text, className) {
    const element = document.createElement(tagName);
    element.textContent = text;
    if (className) {
      element.className = className;
    }
    parent.appendChild(element);
    return element;
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      if (!response.ok) {
        throw new Error(`Activity request failed (${response.status})`);
      }
      const activities = await response.json();

      activitiesList.replaceChildren();
      activitySelect.replaceChildren(new Option("-- Select an activity --", ""));

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";
        addText(activityCard, "h4", name);
        addText(activityCard, "p", details.description);
        addText(activityCard, "p", `Schedule: ${details.schedule}`);
        const spotsLeft = details.max_participants - details.participants.length;
        addText(activityCard, "p", `Availability: ${spotsLeft} spots left`);

        const participantsSection = document.createElement("div");
        participantsSection.className = "participants-container";
        addText(participantsSection, "h5", "Participants:");
        if (details.participants.length > 0) {
          const participantList = document.createElement("ul");
          participantList.className = "participants-list";
          details.participants.forEach((email) => {
            const participant = document.createElement("li");
            addText(participant, "span", email, "participant-email");
            if (isAdmin) {
              const removeButton = addText(participant, "button", "Remove", "delete-btn");
              removeButton.type = "button";
              removeButton.setAttribute("aria-label", `Remove ${email} from ${name}`);
              removeButton.dataset.activity = name;
              removeButton.dataset.email = email;
              removeButton.addEventListener("click", handleUnregister);
            }
            participantList.appendChild(participant);
          });
          participantsSection.appendChild(participantList);
        } else {
          addText(participantsSection, "p", "No participants yet");
        }
        activityCard.appendChild(participantsSection);
        activitiesList.appendChild(activityCard);

        activitySelect.add(new Option(name, name));
      });
    } catch (error) {
      activitiesList.replaceChildren();
      addText(activitiesList, "p", "Failed to load activities. Please try again later.");
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.currentTarget;
    const activity = button.dataset.activity;
    const email = button.dataset.email;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        { method: "DELETE" }
      );
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await refreshAdminSession();
        }
        showMessage(result.detail || "An error occurred", "error");
        return;
      }

      showMessage(result.message, "success");
      await fetchActivities();
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = activitySelect.value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        { method: "POST" }
      );
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await refreshAdminSession();
        }
        showMessage(result.detail || "An error occurred", "error");
        return;
      }

      showMessage(result.message, "success");
      signupForm.reset();
      await fetchActivities();
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  loginButton.addEventListener("click", () => {
    loginError.classList.add("hidden");
    loginDialog.showModal();
  });

  cancelLoginButton.addEventListener("click", () => loginDialog.close());

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.classList.add("hidden");
    const credentials = {
      username: document.getElementById("username").value,
      password: document.getElementById("password").value,
    };

    try {
      const response = await fetch("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || "Unable to log in");
      }

      await refreshAdminSession();
      if (!isAdmin) {
        throw new Error("Unable to verify the staff session");
      }
      loginForm.reset();
      loginDialog.close();
      await fetchActivities();
      showMessage("You are logged in as staff.", "success");
    } catch (error) {
      loginError.textContent = error.message;
      loginError.classList.remove("hidden");
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      const response = await fetch("/admin/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error(`Logout failed (${response.status})`);
      }
      await refreshAdminSession();
      await fetchActivities();
    } catch (error) {
      showMessage("Failed to log out. Please try again.", "error");
      console.error("Error logging out:", error);
    }
  });

  async function initialize() {
    await refreshAdminSession();
    await fetchActivities();
  }

  initialize();
});
