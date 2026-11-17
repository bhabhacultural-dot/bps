import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, db } from "./firebase.js";
import { startDailyReportNotifications } from "./daily-report-notifications.js";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function getTodayKey() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

let today = getTodayKey();
let currentClass = "";
let viewOnlyMode = false;
let editingId = null;
let currentUser = null;
let automaticAssignedClasses = [];
let unsubscribeDailyAssignments = null;

/* ================= PROFILE ================= */

async function loadProfilePhoto() {
  try {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;
    const snap = await getDoc(doc(db, "users", userId));

    if (!snap.exists()) return;

    const data = snap.data();

    console.log("PHOTO URL:", data.photo);

    const headerImg = document.getElementById("profilePic");
    const menuImg = document.getElementById("menuProfilePic");

    if (data.photo) {
      if (headerImg) headerImg.src = data.photo;
      if (menuImg) menuImg.src = data.photo;
    }

  } catch (err) {
    console.error("Profile load error:", err);
  }
}

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", () => {

  const subjectBtn = document.getElementById("subjectBtn");
  const classBtn = document.getElementById("classBtn");

  if (subjectBtn) subjectBtn.addEventListener("click", subjectMode);
  if (classBtn) classBtn.addEventListener("click", classMode);

  const teacherName = localStorage.getItem("user_name");
  const nameBox = document.getElementById("menuUserName");

  if (nameBox && teacherName) {
    nameBox.innerText = teacherName;
  }

});


/* ================= ATTENDANCE ACCESS CHECK ================= */

function showAttendanceRequiredPopup() {
    const overlay = document.createElement("div");

    Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        zIndex: "999999",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
    });

    const dialog = document.createElement("div");

    Object.assign(dialog.style, {
        width: "100%",
        maxWidth: "390px",
        background: "#fff",
        color: "#222",
        borderRadius: "16px",
        padding: "28px 22px",
        textAlign: "center",
        boxShadow: "0 15px 45px rgba(0,0,0,.2)",
        fontFamily: "inherit"
    });

    const heading = document.createElement("h3");
    heading.textContent = "Attendance Required";

    const message = document.createElement("p");
    message.textContent = "Please mark your attendance first before accessing the Daily Report.";

    Object.assign(message.style, {
        color: "#666",
        fontSize: "14px",
        lineHeight: "1.7",
        margin: "12px 0 22px"
    });

    const button = document.createElement("button");
    button.textContent = "Go to Dashboard";

    Object.assign(button.style, {
        width: "100%",
        padding: "13px",
        border: "none",
        borderRadius: "9px",
        background: "#222",
        color: "#fff",
        fontSize: "15px",
        fontWeight: "600",
        cursor: "pointer"
    });

    button.addEventListener("click", () => {
        window.location.replace("teacher-dashboard.html");
    });

    dialog.append(heading, message, button);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
}

async function hasMarkedAttendance(uid) {
    const today = getTodayKey();

    const attendanceRef = doc(db, "attendance", today);
    const attendanceSnap = await getDoc(attendanceRef);

    return attendanceSnap.exists() &&
        attendanceSnap.data()[uid] === true;
}



/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user) => {

  if (!user) return;

  currentUser = user;

  try {
    // USER PROFILE
    const userProfileSnap = await getDoc(
      doc(db, "users", user.uid)
    );

    if (!userProfileSnap.exists()) return;

    const userData = userProfileSnap.data();

    window.currentUserRole = userData.role;

    // START NOTIFICATIONS
    if (userData.role === "teacher") {
      startDailyReportNotifications();
    }

    // CHECK ATTENDANCE
    const isPresent = await hasMarkedAttendance(user.uid);

    if (!isPresent) {
      showAttendanceRequiredPopup();
      return;
    }

    document.body.classList.remove("attendance-gated");

    await loadProfilePhoto();

    const name = localStorage.getItem("user_name");
    const welcome = document.getElementById("welcomeUser");

    if (name && welcome) {
      welcome.innerText = "Welcome, " + name;
    }

// REALTIME AUTOMATIC ASSIGNMENTS
const assignmentRef = doc(
  db,
  "daily_report_assignments",
  today
);

unsubscribeDailyAssignments?.();

unsubscribeDailyAssignments = onSnapshot(
  assignmentRef,
  async (assignmentSnap) => {

    const assignments = assignmentSnap.exists()
      ? assignmentSnap.data().assignments || []
      : [];

    const updatedClasses = assignments
      .filter(item =>
        item.teacherId === user.uid &&
        item.status === "pending"
      )
      .map(item => item.className);

    const hasChanged =
      JSON.stringify(automaticAssignedClasses) !==
      JSON.stringify(updatedClasses);

    automaticAssignedClasses = updatedClasses;

    const requestedClass = new URLSearchParams(
      window.location.search
    ).get("assignedClass");

    if (
      requestedClass &&
      automaticAssignedClasses.includes(requestedClass)
    ) {
      await classMode(requestedClass);
    } else if (hasChanged && viewOnlyMode) {
      await classMode(currentClass);
    } else if (!viewOnlyMode) {
      subjectMode();
    }

  },
  (error) => {
    console.error("Assignment listener error:", error);
  }
);

  } catch (error) {
    console.error("Daily Report initialization failed:", error);
    showAttendanceRequiredPopup();
  }

});

/* ================= SUBJECT MODE ================= */

function subjectMode() {

  viewOnlyMode = false;

  const formSection = document.getElementById("formSection");
  if (!formSection) return;

  formSection.innerHTML = `
<form id="homeworkForm">

<select id="period">
<option value="">Select Period</option>
${Array.from({ length: 8 }, (_, i) => `<option value="Period ${i}">Period ${i}</option>`).join("")}
</select>

<select id="class">
<option value="">Select Class</option>
<option value="Class 1">Class 1</option>
<option value="Class 2">Class 2</option>
<option value="Class 3">Class 3</option>
<option value="Class 4">Class 4</option>
<option value="Class 5">Class 5</option>
<option value="Class 6">Class 6</option>
<option value="Class 7">Class 7</option>
<option value="Class 8">Class 8</option>
<option value="Class 9">Class 9</option>
<option value="Class 10">Class 10</option>
<option value="Class 11 PCMB">Class 11 PCMB</option>
<option value="Class 11 Humanities">Class 11 Humanities</option>
<option value="Class 12 PCMB">Class 12 PCMB</option>
<option value="Class 12 Humanities">Class 12 Humanities</option>
</select>

<select id="subject">
<option value="">Select Subject</option>
</select>

<input id="otherSubject" placeholder="Enter Subject" style="display:none">

<textarea id="classwork" placeholder="Classwork"></textarea>
<textarea id="homework" placeholder="Homework"></textarea>

<button type="button" id="saveBtn">Save Entry</button>

</form>
`;

  const subjectDropdown = document.getElementById("subject");
  if (subjectDropdown) {
    subjectDropdown.addEventListener("change", (e) => {
      const other = document.getElementById("otherSubject");
      if (other) {
        other.style.display = e.target.value === "Other" ? "block" : "none";
      }
    });
  }

  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) saveBtn.addEventListener("click", saveEntry);

  loadTeacherSubjects();
  loadData();

  const actionButtons = document.getElementById("actionButtons");
  if (actionButtons) actionButtons.style.display = "none";
}

/* ================= CLASS MODE ================= */

async function classMode(preferredClass = "") {

  if (!currentUser) return;

  const snap = await getDoc(doc(db, "users", currentUser.uid));
  if (!snap.exists()) return;

  const data = snap.data();

const manualClasses = Array.isArray(data.assigned_classes)
  ? data.assigned_classes
  : (data.assigned_class ? [data.assigned_class] : []);

const assignedClasses = [
  ...new Set([
    ...manualClasses,
    ...automaticAssignedClasses
  ])
];

if (assignedClasses.length === 0) {
  showToast("You are not assigned to any class!", "error");
  return;
}

viewOnlyMode = true;

currentClass = assignedClasses.includes(preferredClass)
  ? preferredClass
  : assignedClasses[0];

window.currentReportClass = currentClass;

  const formSection = document.getElementById("formSection");
  if (formSection) {
formSection.innerHTML = `
  <h4>Class Teacher Report</h4>

<select id="reportClass">
  ${assignedClasses.map(cls =>
    `<option value="${cls}" ${cls === currentClass ? "selected" : ""}>
      ${cls}
    </option>`
  ).join("")}
</select>

  <p style="color:gray;font-size:13px">View Only Mode</p>
`;
document.getElementById("reportClass").addEventListener("change", (e) => {
currentClass = e.target.value;
window.currentReportClass = currentClass;
loadData();
});

  }

  loadData();

  const actionButtons = document.getElementById("actionButtons");
  if (actionButtons) actionButtons.style.display = "flex";

  const pdfBtn = document.getElementById("pdfBtn");
  if (pdfBtn) {
pdfBtn.onclick = async () => {
  const selectedClass = currentClass;

  await generateReportImage(selectedClass); // ensure await
};
  }

  const shareBtn = document.getElementById("shareBtn");
  if (shareBtn) {
    shareBtn.onclick = () => {
      if (typeof shareReport === "function") {
        shareReport();
      } else {
        console.error("shareReport function not loaded");
        showToast("Share system not ready", "error");
      }
    };
  }
}


/* ================= DUPLICATE ENTRY POPUP ================= */

function showDuplicateDialog(teacherName, period, cls) {
    document.getElementById("duplicateEntryModal")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "duplicateEntryModal";

    Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: "99999"
    });

    const dialog = document.createElement("div");

    Object.assign(dialog.style, {
        width: "100%",
        maxWidth: "400px",
        background: "#fff",
        color: "#222",
        borderRadius: "16px",
        padding: "26px 22px",
        textAlign: "center",
        boxShadow: "0 15px 45px rgba(0,0,0,.2)",
        fontFamily: "inherit"
    });

    const heading = document.createElement("h3");
    heading.textContent = "Duplicate Entry";
    heading.style.margin = "0 0 14px";

    const message = document.createElement("p");
    const boldText = (text) => {
    const strong = document.createElement("strong");
    strong.textContent = text;
    return strong;
};

message.append(
    document.createTextNode(" "),
    boldText(teacherName),
    document.createTextNode(" has already submitted an entry for "),
    boldText(period),
    document.createTextNode(", "),
    boldText(cls),
    document.createTextNode(
        ". If you think this is incorrect, please contact "
    ),
    boldText(teacherName),
    document.createTextNode(".")
);
    Object.assign(message.style, {
        fontSize: "14px",
        lineHeight: "1.7",
        color: "#555",
        overflowWrap: "anywhere",
        margin: "0"
    });

    const button = document.createElement("button");
    button.textContent = "OK";

    Object.assign(button.style, {
        width: "100%",
        marginTop: "22px",
        padding: "12px",
        border: "none",
        borderRadius: "9px",
        background: "#222",
        color: "#fff",
        fontSize: "15px",
        fontWeight: "600",
        cursor: "pointer"
    });

    button.addEventListener("click", () => overlay.remove());

    dialog.append(heading, message, button);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
}


/* ================= SAVE ENTRY ================= */

async function saveEntry() {

  const cls = document.getElementById("class")?.value;
  const period = document.getElementById("period")?.value;
  let subject = document.getElementById("subject")?.value;

  if (!cls || !period || !subject) {
    showToast("Please Select class, period and subject", "error");
    return;
  }

  if (subject === "Other") {
    subject = document.getElementById("otherSubject")?.value;
  }

  const classwork = document.getElementById("classwork")?.value.trim();
  const homework = document.getElementById("homework")?.value.trim();

  if (!classwork || !homework) {
    showToast("Enter classwork and homework", "error");
    return;
  }


try {

    // Check duplicate date + class + period
    const duplicateQuery = query(
        collection(db, "homework"),
        where("date", "==", today),
        where("class", "==", cls),
        where("period", "==", period)
    );

    const duplicateSnap = await getDocs(duplicateQuery);

    const duplicateDoc = duplicateSnap.docs.find(
        item => item.id !== editingId
    );

    if (duplicateDoc) {
        const duplicateData = duplicateDoc.data();

        showDuplicateDialog(
            duplicateData.teacherName || "Another teacher",
            period,
            cls
        );

        return;
    }

    if (editingId) {


      await updateDoc(doc(db, "homework", editingId), {
        class: cls,
        period,
        subject,
        classwork,
        homework
      });

      editingId = null;
      showToast("Entry updated successfully!", "success");

    } else {

      const userSnap = await getDoc(doc(db, "users", currentUser.uid));
      const userData = userSnap.data();

      await addDoc(collection(db, "homework"), {
        class: cls,
        period,
        subject,
        classwork,
        homework,
        teacherId: currentUser.uid,
        teacherName: userData.name,
        date: today
      });

      showToast("Entry saved successfully!", "success");
    }

    document.getElementById("homeworkForm")?.reset();
    loadData();

  } catch (e) {
    console.error(e);
    showToast("Error saving entry!", "error");
  }
}

/* ================= LOAD DATA ================= */

async function loadData() {

  if (!currentUser) return;

  let q;

  if (viewOnlyMode) {
    q = query(collection(db, "homework"), where("date", "==", today), where("class", "==", currentClass));
  } else {
    q = query(collection(db, "homework"), where("date", "==", today), where("teacherId", "==", currentUser.uid));
  }

  const snapshot = await getDocs(q);

  let rows = [];

  snapshot.forEach(docSnap => {
    rows.push({ id: docSnap.id, ...docSnap.data() });
  });

  rows.sort((a, b) => {
    return parseInt(a.period.replace("Period ", "")) - parseInt(b.period.replace("Period ", ""));
  });

  let html = "";

  if (rows.length === 0) {
    html = "<p style='text-align:center;color:gray'>No entries yet</p>";
  }

  rows.forEach(d => {
    html += `
<div class="homework-card">
<div class="card-header">
${viewOnlyMode ? `${d.period} | ${d.subject} | ${d.teacherName}` : `${d.period} | ${d.class} | ${d.subject}`}
</div>
<div><b>Classwork:</b> ${escapeHTML(d.classwork)}</div>
<div><b>Homework:</b> ${escapeHTML(d.homework)}</div>

${!viewOnlyMode ? `
<div class="card-actions">
<button class="edit-btn" onclick="editEntry('${d.id}')">Edit</button>
<button class="delete-btn" onclick="deleteEntry('${d.id}')">Delete</button>
</div>` : ""}
</div>`;
  });

  const dataSection = document.getElementById("dataSection");
  if (dataSection) dataSection.innerHTML = html;
}

/* ================= DELETE ================= */

let deleteTargetId = null;

window.deleteEntry = function (id) {
  deleteTargetId = id;
  document.getElementById("confirmModal")?.classList.add("show");
};

document.getElementById("cancelDelete")?.addEventListener("click", () => {
  document.getElementById("confirmModal")?.classList.remove("show");
});

document.getElementById("confirmDelete")?.addEventListener("click", async () => {

  if (!deleteTargetId) return;

  await deleteDoc(doc(db, "homework", deleteTargetId));

  document.getElementById("confirmModal")?.classList.remove("show");

  showToast("Entry deleted successfully", "success");

  loadData();

});

/* ================= EDIT ================= */

window.editEntry = async function (id) {

  const snap = await getDoc(doc(db, "homework", id));
  if (!snap.exists()) return;

  const d = snap.data();

  editingId = id;

  document.getElementById("class").value = d.class;
  document.getElementById("period").value = d.period;
  document.getElementById("subject").value = d.subject;
  document.getElementById("classwork").value = d.classwork;
  document.getElementById("homework").value = d.homework;

  window.scrollTo({ top: 0, behavior: "smooth" });
};

/* ================= TOAST ================= */

function showToast(message, type = "success") {

  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.className = "";
  toast.classList.add(type, "show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

/* ================= SUBJECT LOAD ================= */

async function loadTeacherSubjects() {

  if (!currentUser) return;

  const subjectDropdown = document.getElementById("subject");
  if (!subjectDropdown) return;

  const userSnap = await getDoc(doc(db, "users", currentUser.uid));
  if (!userSnap.exists()) return;

  const subjects = userSnap.data().subjects || [];

  subjectDropdown.innerHTML = `<option value="">Select Subject</option>`;

  subjects.forEach(sub => {
    subjectDropdown.innerHTML += `<option value="${sub}">${sub}</option>`;
});

// Activity available for every teacher
if (!subjects.includes("Activity")) {
    subjectDropdown.innerHTML += `<option value="Activity">Activity</option>`;
}

subjectDropdown.innerHTML += `<option value="Other">Other</option>`;
}

/* ================= MENU ================= */

window.toggleMenu = function () {
  const menu = document.getElementById("sideMenu");
  const overlay = document.getElementById("overlay");

  if (menu) menu.classList.toggle("open");
  if (overlay) overlay.classList.toggle("show");
};

/* ================= ESCAPE ================= */

function escapeHTML(text) {
  return text
    ?.replace(/&/g, "&amp;")
    ?.replace(/</g, "&lt;")
    ?.replace(/>/g, "&gt;")
    ?.replace(/"/g, "&quot;")
    ?.replace(/'/g, "&#039;");
}


