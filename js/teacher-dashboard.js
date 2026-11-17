import { db, auth } from "./firebase.js";

import { startDailyReportNotifications } from "./daily-report-notifications.js";

import { refreshDailyReportAllocation } from "./daily-report-allocation.js";

import {
  doc,
  getDoc,
  collection,
  getDocs,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔹 FORMAT TIME
function formatTime(t) {
  if (!t) return "";

  let [h, m] = t.split(":");
  h = parseInt(h);

  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;

  return `${h}:${m} ${ampm}`;
}

// 🔹 DATE HELPERS
function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function getTodayDay() {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

// 🔹 AUTH
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  console.log("✅ Logged in:", user.uid);

  // 🔥 USER NAME
  const userSnap = await getDoc(doc(db, "users", user.uid));

if (userSnap.exists()) {
  const userData = userSnap.data();
  const name = userData.name || "Teacher";

  window.currentUserRole = userData.role;

  const welcomeEl = document.getElementById("welcomeText");
  if (welcomeEl) {
    welcomeEl.innerText = `Welcome, ${name}`;
  }

  if (userData.role === "teacher") {
    startDailyReportNotifications();
  }
}

  // 🔥 BUTTON
  const btn = document.getElementById("markBtn");
  if (btn) {
    btn.onclick = () => markAttendance(user.uid);
  }

  await checkAttendance(user.uid);

  const { timetable, timing } = await loadTimetable(user.uid);
  await loadProxyAndRender(user.uid, timetable, timing);
});

// 🔹 ATTENDANCE CHECK
async function checkAttendance(uid) {
  try {
    const today = getTodayDate();
    const ref = doc(db, "attendance", today);

    const snap = await getDoc(ref);

    const statusEl = document.getElementById("statusText");
    const statusIcon = document.getElementById("statusIcon");
    const btn = document.getElementById("markBtn");

    if (!statusEl) return;

    if (btn) {
      btn.onclick = () => {

        const popup = document.getElementById("confirmPopup");
        const yes = document.getElementById("confirmYes");
        const no = document.getElementById("confirmNo");

        if (!popup || !yes || !no) return;

        popup.style.display = "flex";

        yes.onclick = async () => {
          popup.style.display = "none";

          await markAttendance(uid);
          await checkAttendance(uid);
        };

        no.onclick = () => {
          popup.style.display = "none";
        };
      };
    }

    if (snap.exists() && snap.data()[uid]) {
      statusEl.innerText = "Present";
      statusIcon.innerText = "✔";
      statusIcon.className = "status-icon green";

      if (btn) {
        btn.disabled = true;
        btn.innerText = "Already Marked";
        btn.style.opacity = "0.6";
        btn.style.backgroundColor = "grey";
        btn.style.cursor = "not-allowed";
      }

    } else {
      statusEl.innerText = "Not Marked";
      statusIcon.innerText = "❌";
      statusIcon.className = "status-icon red";

      if (btn) {
        btn.disabled = false;
        btn.innerText = "Mark Present";
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
      }
    }

  } catch (err) {
    console.error("Attendance error:", err);
  }
}

// 🔹 MARK ATTENDANCE
async function markAttendance(uid) {
  try {
    const today = getTodayDate();
    const ref = doc(db, "attendance", today);

    // Initialize all teachers as absent, only if missing
    const usersSnap = await getDocs(collection(db, "users"));
    const attendanceSnap = await getDoc(ref);

    const defaults = {};

    usersSnap.forEach(d => {
      if (d.data().role === "teacher") {
        defaults[d.id] = false;
      }
    });

    const current = attendanceSnap.exists()
      ? attendanceSnap.data()
      : {};

    await setDoc(ref, {
      ...defaults,
      ...current,
      [uid]: true
    });

    // Trigger allocation immediately
    await refreshDailyReportAllocation();

    console.log("✅ Attendance marked and report allocation triggered");

    await checkAttendance(uid);

  } catch (err) {
    console.error("❌ Mark error:", err);
  }
}

// 🔹 LOAD TIMETABLE
async function loadTimetable(uid) {

  const today = getTodayDay();

  try {
    const ttSnap = await getDoc(doc(db, "timetable", uid));

    if (!ttSnap.exists()) {
      const container = document.getElementById("periodContainer");
      container.innerHTML = "<p style='text-align:center'>No timetable found</p>";

      return { timetable: [], timing: {} };
    }

    const data = ttSnap.data();

    let timetable = data[today] || [];
    let timing = data.periodTiming || {};

    return { timetable, timing };

  } catch (err) {
    console.error("Timetable error:", err);
    return { timetable: [], timing: {} };
  }
}

// 🔹 LOAD PROXY + RENDER UI
async function loadProxyAndRender(uid, timetable, timing) {

  const todayDate = getTodayDate();
  const proxyRef = collection(db, "proxies", todayDate, "list");

  const snap = await getDocs(proxyRef);

  let proxyMap = {};

  snap.forEach(docSnap => {
    const p = docSnap.data();

    if (p.proxyTeacher === uid) {
      proxyMap[p.period] = p;
    }
  });

  const container = document.getElementById("periodContainer");
  container.innerHTML = "";

  timetable.sort((a, b) => a.period - b.period);

  timetable.forEach(row => {

    const proxy = proxyMap[row.period];
    const t = timing[row.period];

    const timeText = t
      ? `${formatTime(t.startTime)} - ${formatTime(t.endTime)}`
      : "";

    let type = "regular";
    let content = "";

    if (proxy) {
      type = "proxy";
      content = `
        <div class="period-top">
          <span>Period ${row.period}</span>
          <span>${timeText}</span>
        </div>
        <div class="period-bottom">
          Class: ${proxy.class} (Proxy)<br>
          Subject: ${proxy.subject || "-"}
        </div>
      `;
    }
    else if (row.free || row.class?.toLowerCase() === "free") {
      type = "free";
      content = `
        <div class="period-top">
          <span>Period ${row.period}</span>
          <span>${timeText}</span>
        </div>
        <div class="period-bottom">
          Free Period 🎉
        </div>
      `;
    }
    else {
      content = `
        <div class="period-top">
          <span>Period ${row.period}</span>
          <span>${timeText}</span>
        </div>
        <div class="period-bottom">
          Class: ${row.class}<br>
          Subject: ${row.subject}
        </div>
      `;
    }

    const div = document.createElement("div");
    div.className = `period-card ${type}`;
    div.innerHTML = content;

    container.appendChild(div);
  });
}

// 🔹 DAY BADGE
const dayEl = document.getElementById("dayBadge");

if (dayEl) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long"
  });

  dayEl.innerText = today;
}