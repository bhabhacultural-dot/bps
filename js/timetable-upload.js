import { db } from "./firebase.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function parseCSV(text) {
  const rows = text.split("\n").map(r => r.split(","));
  return rows;
}

window.uploadCSV = async function () {
  const file = document.getElementById("fileInput").files[0];

  if (!file) return alert("Select file");

  const text = await file.text();
  const rows = parseCSV(text);

  // Example CSV format:
  // teacherId,day,period,class,subject/free

  for (let i = 1; i < rows.length; i++) {
    const [teacherId, day, period, cls, subject] = rows[i];

    const ref = doc(db, "timetable", teacherId);

    let entry;

    if (subject === "free") {
      entry = { period: Number(period), free: true };
    } else {
      entry = {
        period: Number(period),
        class: cls,
        subject: subject
      };
    }

    await setDoc(ref, {
      [day]: [entry]
    }, { merge: true });
  }

  alert("Uploaded ✅");
};