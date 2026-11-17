
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
      dailyReportEligible: data.dailyReportEligible === true
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

teacherSelect.innerHTML = `<option value="">Select Class Teacher</option>`;

assigned.forEach(teacher => {
  const option = document.createElement("option");
  option.value = teacher.id;
  option.textContent = teacher.name;
  teacherSelect.appendChild(option);
});

teacherSelect.value = classTeacherMap[className] || "";

teacherSelect.addEventListener("change", async () => {
  try {
    await setDoc(
      doc(db, "class_settings", encodeURIComponent(className)),
      { classTeacherId: teacherSelect.value }
    );

    classTeacherMap[className] = teacherSelect.value;

    document.getElementById("backupMessage").textContent =
      `${className} class teacher updated successfully.`;
  } catch (error) {
    console.error(error);
    document.getElementById("backupMessage").textContent =
      "Unable to update class teacher.";
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
