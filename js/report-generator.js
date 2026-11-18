import { auth, db } from "./firebase.js";

import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


function getTodayKey() {
  const date = new Date();
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 10);
}


/* LOAD TEMPLATE - SINGLE SHARED PROMISE */

let reportTemplatePromise = null;

function loadReportTemplate() {
  if (!reportTemplatePromise) {
    reportTemplatePromise = (async () => {
      const container = document.getElementById("reportContainer");

      if (!container) {
        throw new Error("Report container not found.");
      }

      const response = await fetch("/components/homework-report.html");

      if (!response.ok) {
        throw new Error(
          `Report template loading failed: ${response.status}`
        );
      }

      container.innerHTML = await response.text();

      const requiredElements = [
        "reportPage",
        "reportBody",
        "className",
        "teacherName",
        "reportDate",
        "reportDay"
      ];

      for (const id of requiredElements) {
        if (!document.getElementById(id)) {
          throw new Error(`Report template element missing: ${id}`);
        }
      }

      return document.getElementById("reportPage");
    })();
  }

  return reportTemplatePromise;
}

document.addEventListener("DOMContentLoaded", () => {
  loadReportTemplate().catch(error => {
    console.error("Report template initialization error:", error);
  });
});




/* COMMON FUNCTION (DATA FILL) */

async function prepareReport(selectedClass) {
  await loadReportTemplate();

  const element = document.getElementById("reportPage");

  if (!element) {
    throw new Error("Report page is not ready.");
  }

  const today = getTodayKey()

  const q = query(
    collection(db,"homework"),
    where("class","==",selectedClass),
    where("date","==",today),
    orderBy("period")
  );

  const snap = await getDocs(q);

  const tbody = document.getElementById("reportBody");
  tbody.innerHTML = "";

  snap.forEach(doc=>{
    const row = doc.data();

    tbody.innerHTML += `
      <tr>
        <td>${row.period}</td>
        <td>${row.subject}</td>
        <td>${row.classwork}</td>
        <td>${row.homework}</td>
      </tr>
    `;
  });

  document.getElementById("className").innerText =
    selectedClass + " Homework";

const settingsSnap = await getDoc(
  doc(db, "class_settings", encodeURIComponent(selectedClass))
);

let classTeacherName = "Not Assigned";

if (settingsSnap.exists()) {
  const teacherId = settingsSnap.data().classTeacherId;

  if (teacherId) {
    const teacherSnap = await getDoc(doc(db, "users", teacherId));

    if (teacherSnap.exists()) {
      classTeacherName = teacherSnap.data().name || "Not Assigned";
    }
  }
}

document.getElementById("teacherName").innerText =
  "Class Teacher : " + classTeacherName;

  const d = new Date();

  document.getElementById("reportDate").innerText =
    "Date : " + d.toLocaleDateString("en-GB");

  document.getElementById("reportDay").innerText =
    "Day : " + d.toLocaleDateString("en-US",{weekday:"long"});

  await new Promise(r => setTimeout(r, 300));

  return element;
}



/* DOWNLOAD PNG */


window.generateReportImage = async function(selectedClass) {

    try {
        const today = getTodayKey();

        // Check today's entries for this class
        const q = query(
            collection(db, "homework"),
            where("class", "==", selectedClass),
            where("date", "==", today)
        );

        const snap = await getDocs(q);

        const filledPeriods = new Set(
            snap.docs.map(docSnap => docSnap.data().period)
        );

        const missingPeriods = [];

        for (let i = 0; i <= 7; i++) {
            const periodName = `Period ${i}`;

            if (!filledPeriods.has(periodName)) {
                missingPeriods.push(periodName);
            }
        }

        // Show confirmation if periods are missing
        if (missingPeriods.length > 0) {
            const shouldDownload = await showMissingPeriodsDialog(
                missingPeriods,
                "Download Anyway"
            );

            if (!shouldDownload) return;
        }

        // Generate and download report
        const element = await prepareReport(selectedClass);

        const canvas = await html2canvas(element, {
            scale: 3,
            backgroundColor: "#ffffff"
        });

        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = "homework.png";
        link.click();

    } catch (error) {
        console.error("Download report error:", error);
        alert("Unable to download report. Please try again.");
    }
};



/* SHARE */


/* ================= INCOMPLETE PERIOD DIALOG ================= */

function showMissingPeriodsDialog(missingPeriods, continueLabel = "Share Anyway") {
    return new Promise((resolve) => {

        const overlay = document.createElement("div");
        overlay.id = "missingPeriodsModal";

        Object.assign(overlay.style, {
            position: "fixed",
            inset: "0",
            zIndex: "99999",
            background: "rgba(0,0,0,.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
        });

        const dialog = document.createElement("div");

        Object.assign(dialog.style, {
            width: "100%",
            maxWidth: "420px",
            background: "#fff",
            color: "#222",
            borderRadius: "16px",
            padding: "25px",
            boxShadow: "0 15px 45px rgba(0,0,0,.2)",
            fontFamily: "inherit"
        });

        const heading = document.createElement("h3");
        heading.textContent = "Incomplete Periods";

        Object.assign(heading.style, {
            margin: "0 0 12px",
            fontSize: "20px",
            textAlign: "center"
        });

        const message = document.createElement("p");
const periodText = missingPeriods.length === 1
    ? `${missingPeriods[0]} is not filled yet.`
    : `${missingPeriods.slice(0, -1).join(", ")} and ${missingPeriods.at(-1)} are not filled yet.`;

message.append(
    document.createTextNode(" "),
    ...missingPeriods.flatMap((period, index) => {
        const strong = document.createElement("strong");
        strong.textContent = period;
        return index === 0
            ? [strong]
            : [document.createTextNode(", "), strong];
    }),
    document.createTextNode(
        ` ${missingPeriods.length === 1 ? "is" : "are"} not filled yet. Do you want to go back and complete them, or share anyway?`
    )
);
        Object.assign(message.style, {
            fontSize: "14px",
            lineHeight: "1.7",
            color: "#555",
            textAlign: "center",
            overflowWrap: "anywhere",
            margin: "0"
        });

        const buttons = document.createElement("div");

        Object.assign(buttons.style, {
            display: "flex",
            gap: "12px",
            marginTop: "24px"
        });

        const goBack = document.createElement("button");
        goBack.textContent = "Go Back";

        const stillShare = document.createElement("button");
        stillShare.textContent = continueLabel;

        [goBack, stillShare].forEach(button => {
            Object.assign(button.style, {
                flex: "1",
                minWidth: "0",
                padding: "12px 8px",
                border: "none",
                borderRadius: "9px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer"
            });
        });

        goBack.style.background = "#e9edf5";
        goBack.style.color = "#333";

        stillShare.style.background = "#4169e1";
        stillShare.style.color = "#fff";

        function closeDialog(result) {
            overlay.remove();
            resolve(result);
        }

        goBack.addEventListener("click", () => closeDialog(false));
        stillShare.addEventListener("click", () => closeDialog(true));

        buttons.append(goBack, stillShare);
        dialog.append(heading, message, buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    });
}

async function markDailyReportAssignmentCompleted(selectedClass) {
  const user = auth.currentUser;

  if (!user) {
    alert("Please log in again.");
    return;
  }

  const today = getTodayKey();

  const assignmentRef = doc(
    db,
    "daily_report_assignments",
    today
  );

  const workloadRef = doc(
    db,
    "daily_report_workload",
    user.uid
  );

  try {
    const completed = await runTransaction(db, async transaction => {
      const assignmentSnap = await transaction.get(assignmentRef);

      if (!assignmentSnap.exists()) return false;

      const data = assignmentSnap.data();

      const assignments = Array.isArray(data.assignments)
        ? [...data.assignments]
        : [];

      const index = assignments.findIndex(item =>
        item.className === selectedClass &&
        item.teacherId === user.uid &&
        item.status === "pending"
      );

      if (index === -1) return false;

      const workloadSnap = await transaction.get(workloadRef);

      const workload = workloadSnap.exists()
        ? workloadSnap.data()
        : {};

      const completedAt = Date.now();

      const completedAssignment = {
        ...assignments[index],
        status: "completed",
        completedAt,
        completionMethod: "teacher_confirmed"
      };

      assignments[index] = completedAssignment;

      const history = Array.isArray(data.history)
        ? [...data.history]
        : [];

      history.push(completedAssignment);

      transaction.set(assignmentRef, {
        assignments,
        history,
        updatedAt: completedAt
      }, { merge: true });

      transaction.set(workloadRef, {
        totalAssignedReports:
          Number(workload.totalAssignedReports) || 0,
        totalCompletedReports:
          (Number(workload.totalCompletedReports) || 0) + 1,
        lastAssignedAt:
          Number(workload.lastAssignedAt) || 0
      }, { merge: true });

      return true;
    });

    if (completed) {
      alert("Report marked as completed.");
    } else {
      alert("No pending assignment found for this class.");
    }

  } catch (error) {
    console.error("Assignment completion error:", error);
    alert("Unable to update assignment status.");
  }
}

async function hasPendingBackupAssignment(selectedClass) {
    const user = auth.currentUser;
    if (!user) return false;

    const today = getTodayKey();

    const assignmentSnap = await getDoc(
        doc(db, "daily_report_assignments", today)
    );

    if (!assignmentSnap.exists()) return false;

    const assignments = assignmentSnap.data().assignments || [];

    return assignments.some(item =>
        item.className === selectedClass &&
        item.teacherId === user.uid &&
        item.status === "pending"
    );
}

/* ================= SHARE REPORT ================= */

window.shareReport = async function() {

    try {
        const selectedClass = window.currentReportClass;

        if (!selectedClass) {
            alert("Assigned class not found!");
            return;
        }

        const today = getTodayKey();

        // Fetch today's entries for assigned class
        const q = query(
            collection(db, "homework"),
            where("class", "==", selectedClass),
            where("date", "==", today),
            orderBy("period")
        );

        const snap = await getDocs(q);

        // Check Period 0 to Period 7
        const filledPeriods = new Set(
            snap.docs.map(docSnap => docSnap.data().period)
        );

        const missingPeriods = [];

        for (let i = 0; i <= 7; i++) {
            const periodName = `Period ${i}`;

            if (!filledPeriods.has(periodName)) {
                missingPeriods.push(periodName);
            }
        }

        // Ask before sharing incomplete report
        if (missingPeriods.length > 0) {
            const shouldShare = await showMissingPeriodsDialog(
                missingPeriods
            );

            if (!shouldShare) return;
        }

        // Generate and share report
        const element = await prepareReport(selectedClass);

        const canvas = await html2canvas(element, {
            scale: 3,
            backgroundColor: "#ffffff"
        });

        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(result => {
                if (result) resolve(result);
                else reject(new Error("Report image generation failed"));
            }, "image/png");
        });

        const file = new File([blob], "report.png", {
            type: "image/png"
        });


if (!navigator.share) {
    alert("Sharing is not supported on this browser.");
    return;
}

// Check whether this browser supports sharing image files.
if (
    navigator.canShare &&
    !navigator.canShare({ files: [file] })
) {
    alert(
        "This browser cannot share report images. Please use Download Report."
    );
    return;
}

await navigator.share({
    files: [file],
    title: `Homework Report - ${selectedClass}`
});

const isBackupAssigned = await hasPendingBackupAssignment(selectedClass);

if (isBackupAssigned) {
    const confirmShared = confirm(
        `Did you successfully share the ${selectedClass} report to the class WhatsApp group?`
    );

    if (confirmShared) {
        await markDailyReportAssignmentCompleted(selectedClass);
    }
}

    } catch (error) {
        if (error.name !== "AbortError") {
            console.error("Share report error:", error);
            alert("Unable to share report. Please try again.");
        }
    }
};
