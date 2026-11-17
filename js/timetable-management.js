import { db } from "./firebase.js";
import {
  collection, getDocs, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const periods = [0,1,2,3,4,5,6,7];
const DEFAULT_TIMING = {
  0: { startTime: "10:15", endTime: "11:00" },
  1: { startTime: "08:00", endTime: "08:55" },
  2: { startTime: "08:55", endTime: "09:35" },
  3: { startTime: "09:35", endTime: "10:15" },
  4: { startTime: "11:20", endTime: "12:00" },
  5: { startTime: "12:00", endTime: "12:40" },
  6: { startTime: "12:40", endTime: "13:15" },
  7: { startTime: "13:15", endTime: "13:50" }
};

// 🔹 Load teachers
async function loadTeachers() {
  const snap = await getDocs(collection(db, "users"));
  const select = document.getElementById("teacherSelect");

  snap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.role === "teacher") {
      const opt = document.createElement("option");
      opt.value = docSnap.id;
      opt.textContent = data.name || docSnap.id;
      select.appendChild(opt);
    }
  });
}

// 🔹 Create empty table
function createTable() {
  const tbody = document.querySelector("#timetable tbody");
  tbody.innerHTML = "";

  days.forEach(day => {
    const tr = document.createElement("tr");

    let rowHTML = `<td>${day}</td>`;

    periods.forEach(p => {
      rowHTML += `
<td>
  <input placeholder="Class" data-day="${day}" data-period="${p}" class="class"/>
  <input placeholder="Subject/Free" data-day="${day}" data-period="${p}" class="subject"/>
</td>
      `;
    });

    tr.innerHTML = rowHTML;
    tbody.appendChild(tr);
  });
}

function applyFreeHighlight() {
  const subjects = document.querySelectorAll(".subject");

  subjects.forEach(input => {
    const td = input.closest("td");

    // 🔥 INITIAL CHECK (yeh missing tha)
    const value = input.value.toLowerCase().trim();

    if (value === "free") {
      td.classList.add("free-cell");
    } else {
      td.classList.remove("free-cell");
    }

    // 🔥 LIVE CHANGE
    input.addEventListener("input", () => {
      const val = input.value.toLowerCase().trim();

      if (val === "free") {
        td.classList.add("free-cell");
      } else {
        td.classList.remove("free-cell");
      }
    });
  });
}

// 🔹 Load timetable
window.loadTimetable = async function () {
  const teacherId = document.getElementById("teacherSelect").value;
  if (!teacherId) return alert("Select teacher");

  const ref = doc(db, "timetable", teacherId);
  const snap = await getDoc(ref);

  createTable();

  if (!snap.exists()) return;

  const data = snap.data();

  dataLoop:
  for (let day of days) {
    const arr = data[day] || [];

    for (let item of arr) {
      const inputs = document.querySelectorAll(
        `[data-day="${day}"][data-period="${item.period}"]`
      );

      if (item.free) {
        inputs[1].value = "free";
      } else {
        inputs[0].value = item.class;
        inputs[1].value = item.subject;
      }
      const data = snap.data();

      const timing = data.periodTiming || DEFAULT_TIMING;

      periods.forEach(p => {
        const startInput = document.querySelector(`.start-time[data-period="${p}"]`);
        const endInput = document.querySelector(`.end-time[data-period="${p}"]`);

        if (startInput) startInput.value = timing[p]?.startTime || "";
        if (endInput) endInput.value = timing[p]?.endTime || "";
      });
      

    }

  }
        applyFreeHighlight();

};

// 🔹 Save timetable
window.saveTimetable = async function () {
  const confirmSave = confirm("Are you sure you want to save this timetable?");

  if (!confirmSave) return;

  const teacherId = document.getElementById("teacherSelect").value;
  if (!teacherId) return alert("Select teacher");

  let finalData = {};
  let periodTiming = {};

  periods.forEach(p => {
    const start = document.querySelector(`.start-time[data-period="${p}"]`)?.value || "";
    const end = document.querySelector(`.end-time[data-period="${p}"]`)?.value || "";

    periodTiming[p] = {
      startTime: start,
      endTime: end
    };
  });

  days.forEach(day => {
    finalData[day] = [];

    periods.forEach(p => {
      const cls = document.querySelector(
        `.class[data-day="${day}"][data-period="${p}"]`
      ).value;

      const sub = document.querySelector(
        `.subject[data-day="${day}"][data-period="${p}"]`
      ).value;

      if (!cls && !sub) return;

      if (sub.toLowerCase() === "free") {
        finalData[day].push({ period: p, free: true });
      } else {
        finalData[day].push({
          period: p,
          class: cls,
          subject: sub
        });
      }
    });
  });

  await setDoc(doc(db, "timetable", teacherId), {
    ...finalData,
    periodTiming
  });

  alert("Saved successfully ✅");
};


window.resetToDefault = function () {

  periods.forEach(p => {
    const start = document.querySelector(`.start-time[data-period="${p}"]`);
    const end = document.querySelector(`.end-time[data-period="${p}"]`);

    if (start) start.value = DEFAULT_TIMING[p].startTime;
    if (end) end.value = DEFAULT_TIMING[p].endTime;
  });

};

// 🔹 CSV upload reuse
window.uploadCSV = async function () {
  alert("CSV logic reuse kar sakte ho previous wala");
};

// init
loadTeachers();
createTable();
applyFreeHighlight();

document.getElementById("teacherSelect").addEventListener("change", () => {
  if (confirm("Load timetable for this teacher? Unsaved changes will be lost.")) {
    loadTimetable();
  }
});


