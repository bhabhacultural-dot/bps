import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, db } from "./firebase.js";

import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let today = new Date().toISOString().split("T")[0];
let currentClass = "";
let viewOnlyMode = false;
let editingId = null;
let currentUser = null;

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

/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user) => {

  if (!user) return;

  currentUser = user;

  await loadProfilePhoto();

  const name = localStorage.getItem("user_name");
  const welcome = document.getElementById("welcomeUser");

  if (name && welcome) {
    welcome.innerText = "Welcome, " + name;
  }

  subjectMode();

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
${Array.from({ length: 9 }, (_, i) => `<option value="Period ${i}">Period ${i}</option>`).join("")}
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

async function classMode() {

  if (!currentUser) return;

  const snap = await getDoc(doc(db, "users", currentUser.uid));
  if (!snap.exists()) return;

  const data = snap.data();

  if (!data.assigned_class) {
    showToast("You are not assigned as class teacher!", "error");
    return;
  }

  viewOnlyMode = true;
  currentClass = data.assigned_class;

  const formSection = document.getElementById("formSection");
  if (formSection) {
    formSection.innerHTML = `
<h4>Viewing ${currentClass}</h4>
<p style="color:gray;font-size:13px">View Only Mode</p>
`;
  }

  loadData();

  const actionButtons = document.getElementById("actionButtons");
  if (actionButtons) actionButtons.style.display = "flex";

  const pdfBtn = document.getElementById("pdfBtn");
  if (pdfBtn) {
pdfBtn.onclick = async () => {
  const selectedClass = localStorage.getItem("assigned_class");

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


