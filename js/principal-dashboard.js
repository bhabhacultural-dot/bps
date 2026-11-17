import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


import {
  collection,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
  deleteDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";



import { generateProxies } from "./proxy-engine.js";


import { startDailyReportNotifications } from "./daily-report-notifications.js";

// 🔹 Helpers
function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function getDayName() {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

// 🔥 GLOBAL
let isGenerating = false;
let currentProxyId = null;
let isManualEdit = false;

// 🔥 START AFTER LOGIN
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.log("Not logged in ❌");
    return;
  }

  console.log("Logged in ✅", user.uid);

  const principalSnap = await getDoc(doc(db, "users", user.uid));

  if (!principalSnap.exists() || principalSnap.data().role !== "principal") {
    console.log("Principal access required");
    return;
  }

  window.currentUserRole = "principal";

  startDailyReportNotifications();

  await loadDashboard();

});

// 🔥 MAIN
async function loadDashboard() {
  const usersSnapshot = await getDocs(collection(db, "users"));

  let totalTeachers = 0;
  let usersList = [];

  usersSnapshot.forEach((docSnap) => {
    const data = docSnap.data();

    if (data.role === "teacher") {
      totalTeachers++;

      usersList.push({
        id: docSnap.id,
        name: data.name || docSnap.id,
        subject: data.subject || "-"
      });
    }
  });

  document.getElementById("totalTeachers").innerText = totalTeachers;

await loadAttendance(usersList);
await loadProxies(usersList);
await calculateTotalClasses(usersList);

}

// 🔹 Attendance
async function loadAttendance(users) {


  // 🔥 PRELOAD ALL TIMETABLES
  const ttSnapAll = await getDocs(collection(db, "timetable"));

  let timetableMap = {};

  ttSnapAll.forEach(d => {
    timetableMap[d.id] = d.data();
  });

  const today = getTodayDate();
  const ref = doc(db, "attendance", today);

  const snap = await getDoc(ref);

  let presentMap = snap.exists() ? snap.data() : {};
  let absentList = [];

  users.forEach(u => {
    if (!presentMap[u.id]) {
      absentList.push(u);
    }
  });
  absentList.sort((a, b) => a.name.localeCompare(b.name));

  
  const absentBox = document.getElementById("absentTeachers");
  if (absentBox) absentBox.innerText = absentList.length;

  const proxySnap = await getDocs(
    collection(db, "proxies", today, "list")
  );

  let proxyMap = {};

  proxySnap.forEach(docSnap => {
    const p = docSnap.data();

    if (!proxyMap[p.originalTeacher]) {
      proxyMap[p.originalTeacher] = [];
    }

    proxyMap[p.originalTeacher].push(p);
  });

    const table = document.getElementById("absenteesTable");
    if (!table) return;   
    table.innerHTML = "";

for (let t of absentList) {

  // 🔥 SUBJECT FROM TIMETABLE (SAFE)
let subjectText = "-";
let subjectTooltip = "";

const scheduleRaw = timetableMap[t.id]?.[getDayName()];
const schedule = Array.isArray(scheduleRaw) ? scheduleRaw : [];

const validPeriodsSub = schedule.filter(p => 
  p && p.period !== undefined && !p.free && p.class
);

const subjects = validPeriodsSub.map(p => p.subject).filter(Boolean);

const uniqueSubjects = [...new Set(subjects)];

subjectText = uniqueSubjects.join(", ") || "-";
subjectTooltip = uniqueSubjects.join(", ");


  let status = "Pending";
  let color = "red";

  const proxies = proxyMap[t.id] || [];

  const total = proxies.length;
  const assigned = proxies.filter(p => p.proxyTeacher !== "NOT_AVAILABLE").length;

  if (total === 0) {
    status = "Pending";
    color = "red";
  }
  else if (assigned === 0) {
    status = "Not Available";
    color = "orange";
  }
  else if (assigned < total) {
    status = `Partial (${assigned}/${total})`;
    color = "blue";
  }
  else {
    status = "Full Assigned";
    color = "green";
  }

  // 🔥 PERIOD CALCULATION (SAFE)
let missed = 0;
let missedList = [];

const validPeriods = schedule.filter(p =>
  p && p.period !== undefined && !p.free && p.class
);

missed = validPeriods.length;
missedList = validPeriods.map(p => `P${p.period}`);


  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td>${t.name}</td>
    <td title="${subjectTooltip}">
  ${subjectText}
</td>
    <td title="${missedList.length ? missedList.join(", ") : 'No periods'}">
      ${missed || "-"}
    </td>
    <td><span class="tag ${color}">${status}</span></td>
  `;

  table.appendChild(tr);
}
}

// 🔹 Load proxies
async function loadProxies(users) {

  const today = getTodayDate();

  const snap = await getDocs(
    collection(db, "proxies", today, "list")
  );

  const table = document.getElementById("proxyTable");
  table.innerHTML = "";

  if (snap.empty) {
    table.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:20px;">
          ✅ All classes running smoothly, No proxies needed today.
        </td>
      </tr>
    `;
    document.getElementById("totalProxies").innerText = 0;
    return;
  }

  let proxyList = [];
  let uniqueSet = new Set();

  // 🔥 STEP 1: collect data
  snap.forEach(docSnap => {
    const p = docSnap.data();

    proxyList.push({
      ...p,
      docId: docSnap.id
    });

    if (p.proxyTeacher !== "NOT_AVAILABLE") {
      uniqueSet.add(p.originalTeacher + "_" + p.period);
    }
  });

  // 🔥 STEP 2: SORT (A → Z by original teacher name)
  proxyList.sort((a, b) => {
    const nameA = users.find(u => u.id === a.originalTeacher)?.name || "";
    const nameB = users.find(u => u.id === b.originalTeacher)?.name || "";
    return nameA.localeCompare(nameB);
  });

  // 🔥 STEP 3: render
  proxyList.forEach(p => {

    const original = users.find(u => u.id === p.originalTeacher);
    const proxy = users.find(u => u.id === p.proxyTeacher);

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${p.period}</td>
      <td>${p.class}</td>
      <td>${original?.name || p.originalTeacher}</td>
      <td>${proxy?.name || p.proxyTeacher}</td>
      <td>
        <button onclick="editProxy('${p.docId}', ${p.period})">
          Edit
        </button>
      </td>
    `;

    table.appendChild(tr);
  });

  // 🔥 STEP 4: count
  document.getElementById("totalProxies").innerText = uniqueSet.size;
}

// 🔥 LISTENER
function listenAttendance(usersList) {
  const today = getTodayDate();
  const ref = doc(db, "attendance", today);

    let lastRun = 0;

    onSnapshot(ref, async (snap) => {

        const now = Date.now();
      if (now - lastRun < 5000) return; // 🛑 5 sec gap

      lastRun = now;


      if (!snap.exists()) return;

      if (isGenerating) return;

      isGenerating = true;

      console.log("🔄 Attendance changed");

      if (isManualEdit) {
        console.log("⛔ Skipped auto generation (manual edit)");
        isManualEdit = false;
        isGenerating = false;
        return;
      }

      setProxyStatus("⏳ Generating proxies", "loading");

      await generateProxies();

      // 🔥 small delay to ensure DB sync
      await new Promise(r => setTimeout(r, 200));

      await loadProxies(usersList);
      await loadAttendance(usersList);

      setProxyStatus("✅ Proxies updated", "success");

      setTimeout(() => setProxyStatus(""), 2000);

      isGenerating = false;
    });
}

// 🔥 CLEAR


// 🔥 MANUAL BUTTON
window.runProxy = async () => {

  setProxyStatus("⏳ Generating proxies", "loading");

  await generateProxies();   // 🔥 ONLY THIS
  await loadDashboard();

  setProxyStatus("✅ Proxies generated", "success");

  setTimeout(() => {
    setProxyStatus("");
  }, 2000);
};

// 🔥 EDIT PROXY (FINAL CLEAN)
window.editProxy = async (proxyId, period) => {

  currentProxyId = proxyId;

  const today = getTodayDate();

  const usersSnap = await getDocs(collection(db, "users"));
  const attSnap = await getDoc(doc(db, "attendance", today));
  const presentMap = attSnap.exists() ? attSnap.data() : {};

  const proxySnap = await getDocs(collection(db, "proxies", today, "list"));

  let proxyCountMap = {};
  proxySnap.forEach(d => {
    const p = d.data();
    proxyCountMap[p.proxyTeacher] = (proxyCountMap[p.proxyTeacher] || 0) + 1;
  });

  let available = [];

      // 🔥 PRELOAD ONCE
    const ttSnapAll = await getDocs(collection(db, "timetable"));
    let timetableMap = {};
    ttSnapAll.forEach(d => timetableMap[d.id] = d.data());

    const logsSnap = await getDocs(collection(db, "proxyLogs"));
    let logsMap = {};
    logsSnap.forEach(d => logsMap[d.id] = d.data());

  for (let docSnap of usersSnap.docs) {

    const data = docSnap.data();
    if (data.role !== "teacher") continue;

    const id = docSnap.id;

    if (!presentMap[id]) continue;

    let schedule = timetableMap[id]?.[getDayName()] || [];

    if (!schedule || schedule.length === 0) continue;

    const slot = schedule.find(p => p.period === period);

    const cls = slot?.class?.trim();

    const isFree = slot && slot.period && (
      slot.free ||
      cls === "free" ||
      cls === "Free" ||
      cls === "FREE" ||
      cls === "-"
    );

    if (!isFree) continue;

    const freeCount = schedule.filter(s => {
      if (!s || !s.period) return false;   // 🔥 IMPORTANT

      const cls = s?.class?.trim();

      return (
        s.free ||
        cls === "free" ||
        cls === "Free" ||
        cls === "FREE" ||
        cls === "-"
      );
    }).length;

    const logData = logsMap[id] || {};

    const dailyLog = logData.dailyLog || {};

    // 🔥 calculate last 7 days
    let last7Days = 0;
    const todayDate = new Date();

    for (let date in dailyLog) {
      const d = new Date(date);
      const diff = (todayDate - d) / (1000 * 60 * 60 * 24);

      if (diff <= 7) {
        last7Days += dailyLog[date];
      }
    }

      const teacherObj = {
        id,
        name: data.name || id,
        freeCount,
        todayProxy: proxyCountMap[id] || 0,
        last7Days
      };

      // 🔥 add score
      teacherObj.score = calculateScoreUI(teacherObj, period);

      available.push(teacherObj);

  }

  // 🔥 SMART SORT
  available.sort((a, b) => b.score - a.score);

  const tbody = document.getElementById("proxyModalTable");

    if (available.length === 0) {

    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:20px;">
          <div style="color:#e74c3c; font-weight:600;">
            No Teacher Available
          </div>
          <div style="font-size:12px; color:#777;">
            All teachers are busy or already assigned
          </div>
        </td>
      </tr>
    `;

    document.getElementById("proxyModal").style.display = "flex";
    return;
  }

  // 🔥 REMOVE OPTION (top row)
const removeRow = document.createElement("tr");

removeRow.innerHTML = `
  <td colspan="6" style="text-align:center; padding:10px;">
    <button style="background:#e74c3c; color:white; padding:8px 16px; border:none; border-radius:6px;"
      onclick="removeProxy()">
      ❌ Remove Proxy
    </button>
  </td>
`;


tbody.appendChild(removeRow);

  tbody.innerHTML = "";

  let first = true;

  for (let t of available) {

    const isFirst = first; // 🔥 store पहले
    const isOverloaded = t.todayProxy >= t.freeCount;
    const badge = first ? "⭐ Best Choice" : (t.score < 0 ? "⚠️ Overloaded" : "");
    first = false;

    const tr = document.createElement("tr");

      let scoreColor = "#555"; // default

        if (t.score >= 30) {
          scoreColor = "#27ae60"; // 🟢 green
        } else if (t.score >= 0) {
          scoreColor = "#f39c12"; // 🟡 yellow
        } else {
          scoreColor = "#e74c3c"; // 🔴 red
        }

    tr.innerHTML = `
      <td style="min-width:220px; max-width:220px;">
        <div style="font-weight:500;">
          ${t.name}
        </div>
        <div style="font-size:12px; margin-top:2px; color:${t.score < 0 ? '#e74c3c' : '#27ae60'}; white-space:nowrap;">
          ${badge}
        </div>
      </td>
      <td style="text-align:center; width:60px;">
        ${t.freeCount}
      </td>
      <td style="text-align:center; width:60px;">
      ${t.todayProxy} ${t.todayProxy >= 2 ? "⚠️" : ""}
      </td>
      <td style="text-align:center; width:60px;">
      ${t.last7Days}
      </td>
      <td style="color:${scoreColor}; font-weight:600; text-align:center; width:60px;" >
        ${t.score}
      </td>
      <td>
      <button onclick="${isOverloaded ? '' : `selectProxy('${t.id}')`}">
        ${isOverloaded ? "Full ❌" : "Select"}
      </button>
      </td>
    `;
    
    if (isFirst) {
      tr.style.background = "#eafaf1"; // light green
    }

    tbody.appendChild(tr);
  }

  document.getElementById("proxyModal").style.display = "flex";

  function calculateScoreUI(t, period) {
  let score = 0;

  score += 50; // free

  if (t.todayProxy === 1) score -= 40;
  if (t.todayProxy >= 2) score -= 100;

  score -= t.last7Days * 10;

  return score;
}
  
  
};

// 🔥 SELECT
window.selectProxy = async (teacherId) => {

  isManualEdit = true;

  const today = getTodayDate();

  const ref = doc(db, "proxies", today, "list", currentProxyId);


  // 🔹 GET OLD DATA
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const oldData = snap.data();
  const oldTeacher = oldData.proxyTeacher;

  // 🔥 UPDATE NEW PROXY
    await setDoc(ref, {
      proxyTeacher: teacherId,
      isManual: true
    }, { merge: true });
    
  // 🔥 REFRESH UI
  const usersSnapshot = await getDocs(collection(db, "users"));

  let usersList = [];

  usersSnapshot.forEach((docSnap) => {
    const data = docSnap.data();

    if (data.role === "teacher") {
      usersList.push({
        id: docSnap.id,
        name: data.name || docSnap.id,
        subject: data.subject || "-"
      });
    }
  });

  closeProxyModal();

  await loadProxies(usersList);
  await loadAttendance(usersList); 

};

window.removeProxy = async () => {

  const today = getTodayDate();

  const ref = doc(db, "proxies", today, "list", currentProxyId);

  await setDoc(ref, {
    proxyTeacher: "NOT_AVAILABLE",
    isManual: true
  }, { merge: true });

  closeProxyModal();

  // 🔄 refresh UI
  const usersSnapshot = await getDocs(collection(db, "users"));

  let usersList = [];

  usersSnapshot.forEach((docSnap) => {
    const data = docSnap.data();

    if (data.role === "teacher") {
      usersList.push({
        id: docSnap.id,
        name: data.name || docSnap.id
      });
    }
  });

  await loadProxies(usersList);
  await loadAttendance(usersList);
};

// 🔥 CLOSE
window.closeProxyModal = () => {
  document.getElementById("proxyModal").style.display = "none";
};


function setProxyStatus(text, type = "") {
  const el = document.getElementById("proxyStatus");
  if (!el) return;

  el.innerText = text;
  el.className = "proxy-status " + type;
}


async function calculateTotalClasses(users) {

  const ttSnapAll = await getDocs(collection(db, "timetable"));

    let timetableMap = {};

    ttSnapAll.forEach(d => {
      timetableMap[d.id] = d.data();
    });

  const day = getDayName();
  let total = 0;

    for (let u of users) {

      const schedule = timetableMap[u.id]?.[day] || [];

      const classes = schedule.filter(p => p && !p.free && p.class);

      total += classes.length;
    }
  document.getElementById("totalClasses").innerText = total;
}




// 🔥 FINALIZE DAY (END OF DAY)
async function finalizeDay() {

  const today = getTodayDate();

  // 🔥 CHECK if already finalized
  const metaRef = doc(db, "system", "meta");
  const metaSnap = await getDoc(metaRef);

  const lastFinalized = metaSnap.exists() ? metaSnap.data().lastFinalizedDate : null;

  if (lastFinalized === today) {
    console.log("⚠️ Already finalized today");
    return;
  }

  const snap = await getDocs(collection(db, "proxyLogs"));



    // 🔥 STEP 1: count proxies ONLY ONCE (loop के बाहर)
    const proxySnap = await getDocs(collection(db, "proxies", today, "list"));

    let countMap = {};

    proxySnap.forEach(doc => {
      const p = doc.data();
      if (p.proxyTeacher !== "NOT_AVAILABLE") {
        countMap[p.proxyTeacher] = (countMap[p.proxyTeacher] || 0) + 1;
      }
    });


    // 🔥 STEP 2: अब loop
    for (let d of snap.docs) {

      const data = d.data();

      // 🔥 use pre-calculated count
      const todayCount = countMap[d.id] || 0;

      let dailyLog = data.dailyLog || {};

      // 🔥 add today entry
 dailyLog[today] = todayCount;

      // 🔥 remove old (>7 days)
      const now = new Date();

      for (let date in dailyLog) {
        const dDate = new Date(date);
        const diff = (now - dDate) / (1000 * 60 * 60 * 24);

        if (diff > 7) {
          delete dailyLog[date];
        }
      }

      await setDoc(d.ref, {
        todayProxies: 0,
        dailyLog
      }, { merge: true });
    }

  // 🔥 SAVE FINALIZED DATE
  await setDoc(metaRef, {
    lastFinalizedDate: today
  }, { merge: true });

  console.log("✅ Day finalized");
}

// 🔥 AUTO FINALIZE (every minute check)
setInterval(async () => {

  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // ⏰ Time set: 2:00 PM (change kar sakta hai) format = 24 hours
  if (hours === 14 && minutes === 0) {
    console.log("⏳ Auto finalize triggered");
    await finalizeDay();
  }

}, 60000);


// 🔗 make it usable in HTML button
window.finalizeDay = finalizeDay;

window.goToAttendance = () => {
  window.location.href = "attendance.html";
};

window.goToTimetable = () => {
  window.location.href = "timetable.html";
};


window.printFullReport = async () => {

  const today = new Date().toISOString().split("T")[0];

  const snap = await getDocs(collection(db, "proxies", today, "list"));

  let grouped = {};

  snap.forEach(doc => {
    const p = doc.data();

    if (!grouped[p.originalTeacher]) {
      grouped[p.originalTeacher] = [];
    }

    grouped[p.originalTeacher].push(p);
  });

  const html = generateFullReportHTML(grouped);

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.print();
};


window.downloadFullReport = async () => {

  const today = new Date().toISOString().split("T")[0];

  const snap = await getDocs(collection(db, "proxies", today, "list"));

  let grouped = {};

  snap.forEach(doc => {
    const p = doc.data();

    if (!grouped[p.originalTeacher]) {
      grouped[p.originalTeacher] = [];
    }

    grouped[p.originalTeacher].push(p);
  });

  const html = generateFullReportHTML(grouped);

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();

  setTimeout(() => {
    win.print(); // user can save as PDF
  }, 500);
};


// 🔥 FULL REPORT PRINT
window.printFullReport = async () => {

  const today = new Date().toISOString().split("T")[0];

  // 🔹 USERS (for name mapping)
  const usersSnap = await getDocs(collection(db, "users"));
  let userMap = {};

  usersSnap.forEach(doc => {
    const data = doc.data();
    userMap[doc.id] = data.name || doc.id;
  });

  // 🔹 PROXIES
  const snap = await getDocs(collection(db, "proxies", today, "list"));

  let grouped = {};

  snap.forEach(doc => {
    const p = doc.data();

    const teacherName = userMap[p.originalTeacher] || p.originalTeacher;
    const proxyName = userMap[p.proxyTeacher] || p.proxyTeacher;

    if (!grouped[teacherName]) {
      grouped[teacherName] = [];
    }

    grouped[teacherName].push({
      ...p,
      proxyTeacherName: proxyName
    });
  });

  const html = generateFullReportHTML(grouped);

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.print();
};



// 🔥 DOWNLOAD (PDF via print)
window.downloadFullReport = async () => {

  const today = new Date().toISOString().split("T")[0];

  const usersSnap = await getDocs(collection(db, "users"));
  let userMap = {};

  usersSnap.forEach(doc => {
    const data = doc.data();
    userMap[doc.id] = data.name || doc.id;
  });

  const snap = await getDocs(collection(db, "proxies", today, "list"));

  let grouped = {};

  snap.forEach(doc => {
    const p = doc.data();

    const teacherName = userMap[p.originalTeacher] || p.originalTeacher;
    const proxyName = userMap[p.proxyTeacher] || p.proxyTeacher;

    if (!grouped[teacherName]) {
      grouped[teacherName] = [];
    }

    grouped[teacherName].push({
      ...p,
      proxyTeacherName: proxyName
    });
  });

  const html = generateFullReportHTML(grouped);

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();

  setTimeout(() => {
    win.print(); // Save as PDF
  }, 500);
};



// 🔥 HTML TEMPLATE (FINAL)
function generateFullReportHTML(grouped) {

  let content = "";

  for (let teacher in grouped) {

    let rows = "";

    grouped[teacher].forEach((p, i) => {
      rows += `
        <tr>
          <td>${i + 1}</td>
          <td>${p.period}</td>
          <td>${p.class}</td>
          <td>${p.proxyTeacherName}</td>
          <td></td>
        </tr>
      `;
    });

    content += `
      <div class="teacher-block">
        <div class="teacher-title">Absent Teacher: ${teacher}</div>

        <table>
          <thead>
            <tr>
              <th>Sr.No</th>
              <th>Period</th>
              <th>Class</th>
              <th>Assigned Teacher</th>
              <th>Signature</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString();
  const dayStr = today.toLocaleDateString("en-US", { weekday: "long" });

  return `
  <html>
  <head>
    <title>Substitution Report</title>

    <style>
      body {
        font-family: Arial;
        padding: 20px;
      }

      h2, h3 {
        text-align: center;
        margin: 4px;
      }

      /* 🔥 DATE ROW */
      .date-row {
        display: flex;
        justify-content: space-between;
        margin-top: 10px;
        font-weight: 500;
      }

      /* 🔥 TEACHER TITLE LEFT ALIGN */
      .teacher-title {
        text-align: left;
        font-weight: 600;
        margin-top: 25px;
      }

      /* 🔥 TABLE FIX */
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
        table-layout: fixed; /* ✅ SAME WIDTH FIX */
      }

      th, td {
        border: 1px solid black;
        padding: 8px;
        text-align: center;
        word-wrap: break-word;
      }

      /* 🔥 COLUMN WIDTH FIX (IMPORTANT) */
      th:nth-child(1), td:nth-child(1) { width: 10%; }
      th:nth-child(2), td:nth-child(2) { width: 15%; }
      th:nth-child(3), td:nth-child(3) { width: 15%; }
      th:nth-child(4), td:nth-child(4) { width: 40%; }
      th:nth-child(5), td:nth-child(5) { width: 20%; }

    </style>
  </head>

  <body>

    <h2>BHABHA PUBLIC SCHOOL, JAIPUR</h2>
    <h3>AFFILIATED TO CBSE DELHI</h3>
    <h3>Substitution Report</h3>

    <div class="date-row">
      <div>Date: ${dateStr}</div>
      <div>Day: ${dayStr}</div>
    </div>

    ${content}

  </body>
  </html>
  `;
}