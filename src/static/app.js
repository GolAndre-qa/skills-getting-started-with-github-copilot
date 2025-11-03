document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // helper to produce initials from an email (before @)
  function getInitials(email) {
    if (!email) return "";
    const namePart = email.split("@")[0];
    const parts = namePart.split(/[._-]/).filter(Boolean);
    const initials =
      parts.length === 0
        ? namePart.slice(0, 2)
        : parts.length === 1
        ? parts[0].slice(0, 2)
        : (parts[0][0] || "") + (parts[1][0] || "");
    return initials.toUpperCase();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        // Build participants HTML
        const participantsHtml =
          details.participants && details.participants.length > 0
            ? `<ul class="participant-list">${details.participants
                .map(
                  (p) =>
                    `<li class="participant-item"><span class="participant-badge">${getInitials(
                      p
                    )}</span><span class="participant-email">${p}</span><button class="delete-participant">🗑️</button></li>`
                )
                .join("")}</ul>`
            : `<p class="no-participants">No participants yet</p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants">
            <strong>Participants:</strong>
            ${participantsHtml}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Attach event listeners to delete buttons inside this activity card
        activityCard.querySelectorAll('.delete-participant').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            const item = btn.closest('.participant-item');
            const emailSpan = item ? item.querySelector('.participant-email') : null;
            const email = emailSpan ? emailSpan.textContent.trim() : null;
            if (email) {
              // call the module-scoped removeParticipant
              removeParticipant(email);
            }
          });
        });

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        window.location.reload();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Function to show a small toast message
  function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    // Auto-hide after 3s
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  }

  // Function to remove a participant (module-scoped, not global)
  async function removeParticipant(email) {
    if (!email) return;
    console.log(`Unregistering participant: ${email}`);

    // Find participant item by comparing the .participant-email text content
    let participantItem = null;
    document.querySelectorAll('.participant-item').forEach((item) => {
      const emailSpan = item.querySelector('.participant-email');
      if (emailSpan && emailSpan.textContent.trim() === email) {
        participantItem = item;
      }
    });

    // Try to infer activity name from the surrounding .activity-card (if present)
    let activityName = null;
    if (participantItem) {
      const activityCard = participantItem.closest('.activity-card');
      if (activityCard) {
        const h4 = activityCard.querySelector('h4');
        if (h4) activityName = h4.textContent.trim();
      }
    }

    // Attempt to call backend unregister endpoint. Infer endpoint similar to signup: /activities/<name>/unregister
    if (activityName) {
      try {
        const resp = await fetch(
          `/activities/${encodeURIComponent(activityName)}/unregister?email=${encodeURIComponent(email)}`,
          { method: 'DELETE' }
        );
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.detail || 'Failed to unregister participant.');
        }
      } catch (err) {
        console.error('Error unregistering participant:', err);
        showToast('Error removing participant: ' + err.message, 'error');
        return; // don't remove from UI if backend failed
      }
    } else {
      // Fallback to older API path used elsewhere in the code (/api/unregister)
      try {
        const resp = await fetch(`/api/unregister?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.detail || 'Failed to unregister participant.');
        }
      } catch (err) {
        // Log but continue to remove from UI as a last resort
        console.warn('Fallback unregister failed (continuing to remove from UI):', err);
        showToast('Warning: backend unregister failed - removed locally', 'info');
      }
    }

    // Remove from UI if found
    if (participantItem) {
      participantItem.remove();
      showToast(`Removed ${email}`, 'success');
    } else {
      // As a final fallback, remove any item whose text includes the email
      document.querySelectorAll('.participant-item').forEach((item) => {
        if (item.textContent.includes(email)) item.remove();
      });
      showToast(`Removed ${email}`, 'success');
    }
  }

  // Initialize app
  fetchActivities();

  // Add event listener for the 'basket' button to handle member deletion functionality
  document.getElementById('basket-button').addEventListener('click', function() {
    // Logic to delete member goes here
    // Ensure to handle any errors and update the UI accordingly
});
  // Add event listener for the 'delete' button to handle member removal functionality
  document.getElementById('delete-button').addEventListener('click', function() {
    const email = prompt('Enter the email of the participant to remove:');
    if (email) {
        // Logic to remove the member goes here
        // Example: Call to backend to unregister the participant
        fetch(`/api/unregister?email=${encodeURIComponent(email)}`, { method: 'DELETE' })
            .then(response => {
        if (response.ok) {
          // Remove the participant from the UI by matching the .participant-email span text
          let removed = false;
          document.querySelectorAll('.participant-item').forEach((item) => {
            const emailSpan = item.querySelector('.participant-email');
            if (emailSpan && emailSpan.textContent.trim() === email) {
              item.remove();
              removed = true;
            }
          });
          if (!removed) {
            // fallback: remove any item whose text contains the email
            document.querySelectorAll('.participant-item').forEach((item) => {
              if (item.textContent.includes(email)) item.remove();
            });
          }
        } else {
                    throw new Error('Failed to unregister participant.');
                }
            })
            .catch(error => {
                console.error(error);
                alert('Error: ' + error.message);
            });
    }
});
});
