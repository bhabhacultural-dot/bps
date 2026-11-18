
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
collection, getDocs, doc, getDoc, updateDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { refreshDailyReportAllocation } from "./daily-report-allocation.js";

const CLASS_LIST = [
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11 PCMB",
  "Class 11 Humanities",
  "Class 12 PCMB",
  "Class 12 Humanities"
];

const DAILY_REPORT_CLASS_LIST = [
  "Class 1", "Class 2", "Class 3", "Class 4", "Class 5",
  "Class 6", "Class 7", "Class 8", "Class 9", "Class 10"
];

let teachers = [];
let classTeacherMap = {};
let savingTeachers = new Set();


onAuthStateChanged(auth, async (user) => {

  if (!user) return;

  try {

    const principalSnap = await getDoc(
      doc(db, "users", user.uid)
    );

    if (
      !principalSnap.exists() ||
      principalSnap.data().role !== "principal"
    ) {
      document.getElementById("backupMessage").textContent =
        "Access denied. Principal access only.";
      return;
    }

    await loadTeachers();

  } catch (error) {

    console.error("Backup management error:", error);

    document.getElementById("backupMessage").textContent =
      "Unable to load teacher records.";

  }

});


async function loadTeachers() {

  const snapshot = await getDocs(collection(db, "users"));

  teachers = [];

  snapshot.forEach((item) => {

    const data = item.data();

    if (data.role !== "teacher") return;

    // New field takes priority.
    // Old assigned_class remains supported.
    let assignedClasses = Array.isArray(data.assigned_classes)
      ? [...data.assigned_classes]
      : [];

    if (
      assignedClasses.length === 0 &&
      data.assigned_class
    ) {
      assignedClasses = [data.assigned_class];
    }

    teachers.push({
        
      id: item.id,
      name: data.name || "Unnamed Teacher",
      assignedClasses,
      dailyReportEligible: data.dailyReportEligible === true,
      dailyReportClasses: Array.isArray(data.dailyReportClasses)
        ? data.dailyReportClasses
        : []
    });

  });

  teachers.sort((a, b) => a.name.localeCompare(b.name));

  document.getElementById("teacherCount").textContent =
    `${teachers.length} Teachers`;

  document.getElementById("backupMessage").textContent =
    "Changes are saved automatically to Firebase.";

    classTeacherMap = {};

for (const className of CLASS_LIST) {
  const snap = await getDoc(
    doc(db, "class_settings", encodeURIComponent(className))
  );

  if (snap.exists()) {
    classTeacherMap[className] = snap.data().classTeacherId || "";
  }
}


  renderManagement();
setupDailyReportEligibility();

}


function renderManagement() {

  const classContainer = document.getElementById("classSections");

  classContainer.innerHTML = "";

  CLASS_LIST.forEach((className, index) => {

    const assigned = teachers.filter(teacher =>
      teacher.assignedClasses.includes(className)
    );

    const section = document.createElement("section");
    section.className = "class-card";

    const header = document.createElement("div");
    header.className = "class-card-header";

    const title = document.createElement("h3");
    title.textContent = className;

    const count = document.createElement("span");
    count.textContent = `${assigned.length} Assigned`;

    header.append(title, count);

    const list = document.createElement("div");
    list.className = "teacher-check-list";

    teachers.forEach(teacher => {

      const label = document.createElement("label");
      label.className = "teacher-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";

      checkbox.checked =
        teacher.assignedClasses.includes(className);

      checkbox.disabled = savingTeachers.has(teacher.id);

      const name = document.createElement("span");
      name.textContent = teacher.name;

      label.append(checkbox, name);

      checkbox.addEventListener("change", async () => {

        checkbox.disabled = true;

        await updateAssignment(
          teacher,
          className,
          checkbox.checked,
          checkbox
        );

      });

      list.appendChild(label);

    });

const teacherSelect = document.createElement("select");
teacherSelect.className = "class-teacher-select";

teacherSelect.innerHTML = `
  <option value="">None (No Class Teacher)</option>
`;

teachers.forEach(teacher => {
  const option = document.createElement("option");
  option.value = teacher.id;
  option.textContent = teacher.name;
  teacherSelect.appendChild(option);
});

teacherSelect.value = classTeacherMap[className] || "";

teacherSelect.addEventListener("change", async () => {
  const selectedTeacherId = teacherSelect.value || null;

  teacherSelect.disabled = true;

  try {
    await setDoc(
      doc(db, "class_settings", encodeURIComponent(className)),
      {
        classTeacherId: selectedTeacherId
      },
      { merge: true }
    );

    classTeacherMap[className] = selectedTeacherId || "";

    document.getElementById("backupMessage").textContent =
      selectedTeacherId
        ? `${className} assigned successfully.`
        : `${className} now has no Class Teacher.`;

    renderManagement();

    await refreshDailyReportAllocation();

  } catch (error) {
    console.error("Class Teacher Update Error:", error);

    document.getElementById("backupMessage").textContent =
      "Unable to update Class Teacher.";

  } finally {
    teacherSelect.disabled = false;
  }
});

section.append(header, teacherSelect, list);
    classContainer.appendChild(section);

  });

  renderNonClassTeachers();

}


async function updateAssignment(
  teacher,
  className,
  shouldAssign,
  checkbox
) {

  if (savingTeachers.has(teacher.id)) return;

  savingTeachers.add(teacher.id);

  const oldClasses = [...teacher.assignedClasses];

  let updatedClasses = [...oldClasses];

  if (shouldAssign) {

    if (!updatedClasses.includes(className)) {
      updatedClasses.push(className);
    }

  } else {

    updatedClasses = updatedClasses.filter(
      item => item !== className
    );

  }

  try {

    await updateDoc(doc(db, "users", teacher.id), {

      assigned_classes: updatedClasses,

      // Legacy compatibility:
      // Existing pages reading assigned_class
      // will continue to receive the first assigned class.
      assigned_class: updatedClasses[0] || ""

    });

    teacher.assignedClasses = updatedClasses;

    document.getElementById("backupMessage").textContent =
      `${teacher.name}'s assignments updated successfully.`;

    renderManagement();

  } catch (error) {

    console.error("Assignment update failed:", error);

    checkbox.checked = !shouldAssign;

    document.getElementById("backupMessage").textContent =
      `Could not update ${teacher.name}'s assignment.`;

  } finally {

    savingTeachers.delete(teacher.id);

    renderManagement();

  }

}


function renderNonClassTeachers() {

  const container = document.getElementById("nonClassTeachers");

const classTeacherIds = new Set(
  Object.values(classTeacherMap).filter(Boolean)
);

const nonClassTeachers = teachers.filter(
  teacher => !classTeacherIds.has(teacher.id)
);

  document.getElementById("nonClassCount").textContent =
    nonClassTeachers.length;

  container.innerHTML = "";

  if (nonClassTeachers.length === 0) {

    container.textContent = "All teachers have at least one class assigned.";

    return;

  }

nonClassTeachers.forEach(teacher => {
  const item = document.createElement("div");
  item.className = "non-class-teacher";

  const name = document.createElement("span");
  name.textContent = teacher.name;

  const status = document.createElement("span");
  status.textContent = teacher.assignedClasses.length
    ? `Backup: ${teacher.assignedClasses.join(", ")}`
    : "No Class Assigned";

  const eligibilityLabel = document.createElement("label");
  eligibilityLabel.className = "eligibility-control";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = teacher.dailyReportEligible;

  const eligibilityText = document.createElement("span");
  eligibilityText.textContent = teacher.dailyReportEligible
    ? "Eligible"
    : "Not Eligible";

  checkbox.addEventListener("change", async () => {
    const previousValue = teacher.dailyReportEligible;
    const newValue = checkbox.checked;

    checkbox.disabled = true;

    try {
      await updateDoc(doc(db, "users", teacher.id), {
        dailyReportEligible: newValue
      });

teacher.dailyReportEligible = newValue;

eligibilityText.textContent = newValue
  ? "Eligible"
  : "Not Eligible";

await refreshDailyReportAllocation();

document.getElementById("backupMessage").textContent =
  `${teacher.name} eligibility updated successfully. Daily report allocation refreshed.`;

    } catch (error) {
      console.error("Eligibility update failed:", error);
      checkbox.checked = previousValue;

      document.getElementById("backupMessage").textContent =
        "Could not update eligibility.";
    } finally {
      checkbox.disabled = false;
    }
  });

  eligibilityLabel.append(checkbox, eligibilityText);
  item.append(name, status, eligibilityLabel);
  container.appendChild(item);
});

}



/* =====================================
   DAILY REPORT CLASS ELIGIBILITY GUI
===================================== */

function setupDailyReportEligibility() {

  const teacherSelect = document.getElementById("eligibilityTeacher");
  const classContainer = document.getElementById("eligibilityClassList");
  const saveBtn = document.getElementById("saveEligibilityBtn");
  const message = document.getElementById("eligibilityMessage");

  if (!teacherSelect || !classContainer || !saveBtn || !message) {
    console.error("Daily Report Eligibility GUI elements missing.");
    return;
  }

  teacherSelect.innerHTML = '<option value="">Select Teacher</option>';

  teachers.forEach(teacher => {
    const option = document.createElement("option");
    option.value = teacher.id;
    option.textContent = teacher.name;
    teacherSelect.appendChild(option);
  });

  classContainer.innerHTML =
    "<p>Select a teacher to manage class access.</p>";

  saveBtn.disabled = true;
  saveBtn.onclick = null;

  teacherSelect.onchange = () => {

    const teacher = teachers.find(
      t => t.id === teacherSelect.value
    );

    classContainer.innerHTML = "";

    if (!teacher) {
      classContainer.textContent =
        "Select a teacher to manage class access.";

      saveBtn.disabled = true;
      message.textContent = "";
      return;
    }

    DAILY_REPORT_CLASS_LIST.forEach(className => {

      const label = document.createElement("label");
      label.className = "eligibility-class-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = className;
      checkbox.checked =
        teacher.dailyReportClasses.includes(className);

      const text = document.createElement("span");
      text.textContent = className;

      label.append(checkbox, text);
      classContainer.appendChild(label);

    });

    saveBtn.disabled = false;
    message.textContent = "";
  };

  saveBtn.onclick = async () => {

    const teacherId = teacherSelect.value;

    const teacher = teachers.find(
      t => t.id === teacherId
    );

    if (!teacher) return;

    const selectedClasses = Array.from(
      classContainer.querySelectorAll(
        'input[type="checkbox"]:checked'
      )
    ).map(checkbox => checkbox.value);

    saveBtn.disabled = true;
    message.textContent = "Saving changes...";

    try {

      await updateDoc(doc(db, "users", teacherId), {
        dailyReportClasses: selectedClasses
      });

      teacher.dailyReportClasses = selectedClasses;

      await refreshDailyReportAllocation();

      message.textContent =
        `${teacher.name}: ${selectedClasses.length} classes saved successfully.`;

      message.style.color = "green";

    } catch (error) {

      console.error("Daily Report Class Eligibility Error:", error);

      message.textContent =
        "Unable to save class eligibility.";

      message.style.color = "red";

    } finally {

      saveBtn.disabled = false;

    }
  };
}
