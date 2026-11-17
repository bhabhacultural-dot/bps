
import { auth, db } from "./firebase.js";

import {
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let stopAssignmentListener = null;

const STYLE_ID = "daily-report-notification-style";

function addNotificationStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;

  style.textContent = `
    .daily-report-notification {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-left: 4px solid #e0a800;
      border-radius: 10px;
      padding: 14px 16px;
      margin: 12px 0;
      box-shadow: 0 4px 16px rgba(0,0,0,.07);
      color: #222;
    }

    .daily-report-notification h4 {
      margin: 0 0 7px;
      font-size: 15px;
    }

    .daily-report-notification p {
      margin: 4px 0;
      font-size: 13px;
      color: #555;
    }

    .daily-report-notification button {
      margin-top: 10px;
      padding: 9px 15px;
      background: #d9a300;
      color: #111;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
    }

    .daily-report-notification button:hover {
      background: #c49100;
    }
  `;

  document.head.appendChild(style);
}

function getTodayKey() {
  const date = new Date();
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 10);
}

function renderNotifications(assignments, user) {
  addNotificationStyles();

  const isPrincipal = user.role === "principal";

const containerId = isPrincipal
  ? "dailyReportAlert"
  : document.getElementById("dailyReportShareAlert")
    ? "dailyReportShareAlert"
    : "dailyReportAssignmentAlert";

  const container = document.getElementById(containerId);

  if (!container) return;

  container.innerHTML = "";

  const relevantAssignments = assignments.filter(item => {
    if (item.status !== "pending") return false;

    if (isPrincipal) return true;

    return item.teacherId === user.uid;
  });

  if (!relevantAssignments.length) return;

  const heading = document.createElement("h4");
  heading.textContent = isPrincipal
    ? "Daily Report Assignments"
    : "Your Daily Report Responsibility";

  const card = document.createElement("div");
  card.className = "daily-report-notification";

  card.appendChild(heading);

  relevantAssignments.forEach(item => {
    const row = document.createElement("div");

    const description = document.createElement("p");

    description.textContent = isPrincipal
      ? `${item.className} → ${item.teacherName || item.teacherId}`
      : `You are assigned to prepare and share the ${item.className} daily report.`;

    row.appendChild(description);

    if (!isPrincipal) {
      const button = document.createElement("button");

      button.textContent = "Open Daily Report";

      button.addEventListener("click", () => {
        const url = new URL(
          "teacher-daily-report.html",
          window.location.href
        );

        url.searchParams.set("assignedClass", item.className);

        window.location.href = url.toString();
      });

      row.appendChild(button);
    }

    card.appendChild(row);
  });

  container.appendChild(card);
}

export function startDailyReportNotifications() {
  if (stopAssignmentListener) return;

  const user = auth.currentUser;

  if (!user) return;

  stopAssignmentListener = onSnapshot(
    doc(db, "daily_report_assignments", getTodayKey()),

    snapshot => {
      const profileRole = window.currentUserRole;

      if (!profileRole) return;

      const data = snapshot.exists()
        ? snapshot.data()
        : {};

      renderNotifications(
        Array.isArray(data.assignments) ? data.assignments : [],
        {
          uid: user.uid,
          role: profileRole
        }
      );
    },

    error => {
      console.error(
        "Daily report notification error:",
        error
      );
    }
  );
}

export function stopDailyReportNotifications() {
  if (stopAssignmentListener) {
    stopAssignmentListener();
    stopAssignmentListener = null;
  }
}
