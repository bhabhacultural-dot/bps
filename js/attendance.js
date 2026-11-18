
import { db, auth } from "./firebase.js";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { refreshDailyReportAllocation } from "./daily-report-allocation.js";

let teacherCache = [];

// LOCAL DATE HELPER
function getTodayDate() {
  const date = new Date();
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 10);
}

// LOAD ATTENDANCE PAGE
async function loadAttendancePage() {
  try {
    const table = document.getElementById("attendanceTable");
    if (!table) return;

    if (teacherCache.length === 0) {
      const usersSnap = await getDocs(collection(db, "users"));

      usersSnap.forEach(docSnap => {
        const data = docSnap.data();

        if (data.role === "teacher") {
          teacherCache.push({
            id: docSnap.id,
            ...data
          });
        }
      });
    }

    const today = getTodayDate();
    const attRef = doc(db, "attendance", today);
    const attSnap = await getDoc(attRef);

    const presentMap = attSnap.exists()
      ? attSnap.data()
      : {};

    table.innerHTML = "";

    teacherCache.forEach(data => {
      const id = data.id;

const value = presentMap[id] === true;


      const statusText =
        value === true ? "Present" :
        value === false ? "Absent" :
        "Not Marked";

      const statusClass =
        value === true ? "green" :
        value === false ? "red" :
        "orange";

      const nextValue = value !== true;

      const tr = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.textContent = data.name || id;

      const subjectCell = document.createElement("td");
      subjectCell.textContent = data.subject || "-";

      const statusCell = document.createElement("td");
      const statusTag = document.createElement("span");

      statusTag.className = `tag ${statusClass}`;
      statusTag.textContent = statusText;

      statusCell.appendChild(statusTag);

      const actionCell = document.createElement("td");
      const button = document.createElement("button");

      button.textContent = nextValue
        ? "Mark Present ✅"
        : "Mark Absent ❌";

      button.dataset.nextValue = String(nextValue);

      button.addEventListener("click", event => {
        window.toggleAttendance(event, id);
      });

      actionCell.appendChild(button);

      tr.append(
        nameCell,
        subjectCell,
        statusCell,
        actionCell
      );

      table.appendChild(tr);
    });

  } catch (err) {
    console.error("Load Attendance Error:", err);
  }
}

// PRINCIPAL: TOGGLE ATTENDANCE
window.toggleAttendance = async (e, teacherId) => {
  try {
    if (!confirm("Are you sure?")) return;

    const btn = e.target;
    const row = btn.closest("tr");
    const statusTag = row.querySelector(".tag");

    const nextValue = btn.dataset.nextValue === "true";

    const today = getTodayDate();
    const ref = doc(db, "attendance", today);

    // Initialize all teachers as absent
    const attendanceDefaults = {};

    teacherCache.forEach(teacher => {
      attendanceDefaults[teacher.id] = false;
    });

    // Preserve existing attendance
    const snap = await getDoc(ref);

    const currentAttendance = snap.exists()
      ? snap.data()
      : {};

    const updatedAttendance = {
      ...attendanceDefaults,
      ...currentAttendance,
      [teacherId]: nextValue
    };

    // Save attendance
    await setDoc(ref, updatedAttendance);

    // Update UI
    if (nextValue) {
      statusTag.textContent = "Present";
      statusTag.className = "tag green";

      btn.textContent = "Mark Absent ❌";
      btn.dataset.nextValue = "false";

    } else {
      statusTag.textContent = "Absent";
      statusTag.className = "tag red";

      btn.textContent = "Mark Present ✅";
      btn.dataset.nextValue = "true";
    }

    // Trigger allocation
    try {
      await refreshDailyReportAllocation();
    } catch (allocationError) {
      console.error(
        "Daily Report Allocation Error:",
        allocationError
      );
    }

  } catch (err) {
    console.error("Toggle Error:", err);
    alert("Unable to update attendance.");
  }
};

// TEACHER: MARK PRESENT
export async function markPresent() {
  try {
    const user = auth.currentUser;

    if (!user) {
      alert("Not logged in");
      return;
    }

    const today = getTodayDate();
    const ref = doc(db, "attendance", today);

    // Fetch all teachers to initialize daily attendance
    const usersSnap = await getDocs(collection(db, "users"));

    const attendanceDefaults = {};

    usersSnap.forEach(d => {
      if (d.data().role === "teacher") {
        attendanceDefaults[d.id] = false;
      }
    });

    // Preserve existing attendance and fill missing teachers as absent
    const snap = await getDoc(ref);
    const currentAttendance = snap.exists() ? snap.data() : {};

    const updatedAttendance = {
      ...attendanceDefaults,
      ...currentAttendance,
      [user.uid]: true
    };

    await setDoc(ref, updatedAttendance);

    // Trigger daily report allocation immediately
    await refreshDailyReportAllocation();

    alert("Marked Present ✅");

  } catch (err) {
    console.error("Mark Present Error:", err);
    alert("Unable to mark attendance.");
  }
}

// INITIALIZE
document.addEventListener("DOMContentLoaded", () => {
  loadAttendancePage();
});

// BACK BUTTON
window.goBack = () => {
  window.history.back();
};
