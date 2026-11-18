import { db } from "./firebase.js";
import { auth } from "./firebase.js"; // ✅ FIX: auth import added

import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let teacherCache = [];

// 🔹 Date helper (single definition)
function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

    // 🔥 LOAD PAGE
    async function loadAttendancePage() {
      try {
        const table = document.getElementById("attendanceTable");
        if (!table) return; // ✅ safety

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

    const presentMap = attSnap.exists() ? attSnap.data() : {};

    table.innerHTML = "";

teacherCache.forEach(data => {

  const id = data.id;
  const isPresent = !!presentMap[id];

  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td>${data.name || id}</td>
    <td>${data.subject || "-"}</td>
    <td>
      <span class="tag ${isPresent ? "green" : "red"}">
        ${isPresent ? "Present" : "Absent"}
      </span>
    </td>
    <td>
      <button onclick="toggleAttendance(event, '${id}')">
        ${isPresent ? "Mark Absent ❌" : "Mark Present ✅"}
      </button>
    </td>
  `;

  table.appendChild(tr);
});

  } catch (err) {
    console.error("Load Attendance Error:", err);
  }
}

// 🔥 TOGGLE FUNCTION (principal side)
window.toggleAttendance = async (e, teacherId) => {
  try {
    if (!confirm("Are you sure?")) return;

    const btn = e.target;
    const row = btn.closest("tr");
    const statusTag = row.querySelector(".tag");

    // 🔥 CURRENT STATE DOM से लो
    const isPresent = statusTag.innerText === "Present";

    const today = getTodayDate();
    const ref = doc(db, "attendance", today);

    await setDoc(ref, {
      [teacherId]: !isPresent
    }, { merge: true });

    // 🔥 UI UPDATE
    if (isPresent) {
      statusTag.innerText = "Absent";
      statusTag.className = "tag red";
      btn.innerText = "Mark Present ✅";
    } else {
      statusTag.innerText = "Present";
      statusTag.className = "tag green";
      btn.innerText = "Mark Absent ❌";
    }

  } catch (err) {
    console.error("Toggle Error:", err);
  }
};

// 🔥 MARK PRESENT (teacher side)
export async function markPresent() {
  try {
    const user = auth.currentUser;

    if (!user) {
      alert("Not logged in");
      return;
    }

    const today = getTodayDate();
    const ref = doc(db, "attendance", today);

    const snap = await getDoc(ref);

    if (snap.exists() && snap.data()[user.uid]) {
      alert("Already marked present");
      return;
    }

    await setDoc(ref, {
      [user.uid]: true
    }, { merge: true });

    alert("Marked Present ✅");

    location.reload(); // refresh UI

  } catch (err) {
    console.error("Mark Present Error:", err);
  }
}

// 🔥 INIT (safe)
document.addEventListener("DOMContentLoaded", () => {
  loadAttendancePage();
});

// 🔙 BACK BUTTON
window.goBack = () => {
  window.history.back();
};