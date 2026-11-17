import { db } from "./firebase.js";

import {
  collection, getDocs, doc, getDoc, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔹 Helpers
function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function getDayName() {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

// 🔥 FREE CHECK
function isFree(slot) {
  const cls = slot?.class?.trim();
  return (
    slot?.free === true ||
    cls === "free" ||
    cls === "Free" ||
    cls === "FREE" ||
    cls === "-"
  );
}

// 🔥 CALCULATE LAST 7 DAYS COUNT
function getLast7DaysCount(dailyLog) {
  if (!dailyLog) return 0;

  const today = new Date();
  let total = 0;

  for (let date in dailyLog) {
    const d = new Date(date);
    const diff = (today - d) / (1000 * 60 * 60 * 24);

    if (diff <= 7) {
      total += dailyLog[date];
    }
  }

  return total;
}



// 🔥 MAIN FUNCTION
export async function generateProxies() { 
  
  
  

  console.log("🚀 generateProxies called");
  const today = getTodayDate();

// 🔥 META (last saved attendance)
const metaRef = doc(db, "system", "proxyMeta");
const metaSnap = await getDoc(metaRef);
const lastAttendanceHash = metaSnap.exists() ? metaSnap.data().attendanceHash : null;

// 🔥 CURRENT ATTENDANCE
const attSnap = await getDoc(doc(db, "attendance", today));
const presentMap = attSnap.exists() ? attSnap.data() : {};

// 🔥 HASH
const currentHash = JSON.stringify(presentMap);

// 🔥 CHECK CHANGE
if (currentHash === lastAttendanceHash) {
  console.log("⏸ No attendance change → skipping proxy generation");
  return;
}
  
  
  let todayMap = {};


  const day = getDayName();


  let existingMap = {};

  const oldSnap = await getDocs(collection(db, "proxies", today, "list"));

  oldSnap.forEach(docSnap => {
    const data = docSnap.data();

    const key = String(data.originalTeacher) + "_" + String(data.period);

    if (data.isManual) {
      existingMap[key] = data;
    }
  });

  // 🔥 STEP: DELETE ALL OLD AUTO PROXIES (but keep manual)
    for (let docSnap of oldSnap.docs) {
      const data = docSnap.data();

      if (!data.isManual) {
        await deleteDoc(docSnap.ref);
      }
    }
      

  let usedMap = {};

  const usersSnap = await getDocs(collection(db, "users"));

  let teachers = [];

  // 🔥 PRELOAD ALL LOGS (IMPORTANT)
  const logsSnap = await getDocs(collection(db, "proxyLogs"));

  let logsMap = {};

  logsSnap.forEach(d => {
    logsMap[d.id] = d.data();
  });

  for (let docSnap of usersSnap.docs) {
    const data = docSnap.data();

    if (data.role === "teacher" && !data.excludeFromProxy) {

      const logData = logsMap[docSnap.id] || {};

      teachers.push({
        id: docSnap.id,
        name: data.name || docSnap.id,
        ...data,
        lastProxyPeriod: logData.lastProxyPeriod ?? null,
        dailyLog: logData.dailyLog || {},
        last7Days: getLast7DaysCount(logData.dailyLog),
        todayProxies: 0,
        freePeriods: 0,
        schedule: []
      });
    }
  }

      // 🔥 SCORE FUNCTION
    function calculateScore(t, currentPeriod) {
      let score = 0;

      if (!t.isFree) return -Infinity;

      // daily limit
      if ((todayMap[t.id] || 0) >= 2)
        
      return -Infinity;

      score += 50; // free

      if (t.todayProxies === 1) score -= 40;

      // rolling load
      score -= t.last7Days * 10;

      // avoid back-to-back
      if (t.lastProxyPeriod !== null) {
        if (Math.abs(currentPeriod - t.lastProxyPeriod) <= 1) {
          score -= 20;
        }
      }

      return score;
    }


  // 🔹 Attendance

  const absentTeachers = teachers.filter(t => !presentMap[t.id]);

  // 🔥 PRELOAD ALL TIMETABLES
    const ttSnapAll = await getDocs(collection(db, "timetable"));

    let timetableMap = {};

    ttSnapAll.forEach(d => {
      timetableMap[d.id] = d.data();
    });
  

  // 🔹 Load timetable
  for (let t of teachers) {

    const tt = timetableMap[t.id]?.[day] || [];

    t.schedule = tt;
    t.freePeriods = tt.filter(p => isFree(p)).length;
  }

  let proxies = [];

  for (let absent of absentTeachers) {

    const periods = [];

    const seen = new Set();

    for (let p of absent.schedule) {
      if (p && !p.free && !seen.has(p.period)) {
        seen.add(p.period);
        periods.push(p);
      }
    }

    for (let cls of periods) {

      const period = cls.period;

        // 🔥 DUPLICATE CHECK
        const exists = proxies.find(
          x => x.originalTeacher === absent.id && x.period === period
        );
        if (exists) continue;

      const key = String(absent.id) + "_" + String(period);

        // 🔥 STEP 3 FIX (ADD THIS BLOCK)
    if (existingMap[key]) {

    const manual = existingMap[key];

      // 🔥 अगर teacher अब absent है → ignore manual
      if (!presentMap[manual.proxyTeacher]) {
        console.log("⚠️ Manual proxy removed (teacher absent):", manual.proxyTeacher);
      } else {
        proxies.push(manual); // ✅ valid manual
        continue;
      }
    }


      // 🔥 FILTER AVAILABLE
      let available = teachers.filter(t => {

        if (!presentMap[t.id]) return false;
        if (t.id === absent.id) return false;
        if (usedMap[t.id]?.includes(period)) return false;

        const slot = t.schedule.find(p => p.period === period);
        if (!slot || !isFree(slot)) return false;

        t.isFree = true;
        return true;
      });

      if (available.length === 0) {
        proxies.push({
          period,
          class: cls.class,
          subject: cls.subject,
          originalTeacher: absent.id,
          proxyTeacher: "NOT_AVAILABLE"
        });
        continue;
      }

      // 🔥 SCORING
      let best = null;
      let bestScore = -Infinity;

      for (let t of available) {
        const score = calculateScore(t, period);

        if (score > bestScore) {
          bestScore = score;
          best = t;
        }
      }

      if (best) {

        best.todayProxies = (todayMap[best.id] || 0) + 1;
        todayMap[best.id] = best.todayProxies;

        best.lastProxyPeriod = period;

        // 🔥 UPDATE DB
        const logRef = doc(db, "proxyLogs", best.id);
      

        await setDoc(logRef, {
          lastProxyPeriod: period
        }, { merge: true });

        if (!usedMap[best.id]) usedMap[best.id] = [];
        usedMap[best.id].push(period);

        proxies.push({
          period,
          class: cls.class,
          subject: cls.subject,
          originalTeacher: absent.id,
          proxyTeacher: best.id
        });

      } else {
        proxies.push({
          period,
          class: cls.class,
          subject: cls.subject,
          originalTeacher: absent.id,
          proxyTeacher: "NOT_AVAILABLE"
        });
      }
    }
  }

  // 🔹 Save proxies
  for (let i = 0; i < proxies.length; i++) {
    const docId = proxies[i].originalTeacher + "_" + proxies[i].period;
    const ref = doc(db, "proxies", today, "list", docId);

    const key = String(proxies[i].originalTeacher) + "_" + String(proxies[i].period);

    // 🔥 अगर manual है तो preserve करो
if (existingMap[key]) {

  const manual = existingMap[key];

  // 🔥 अगर teacher अब absent है → manual discard
  if (!presentMap[manual.proxyTeacher]) {

    try {
      await setDoc(ref, {
        ...proxies[i],
        isManual: false
      });
    } catch (e) {
      console.error("🔥 FIRESTORE ERROR:", e);
    }

  } else {

    try {
      await setDoc(ref, manual); // valid manual
    } catch (e) {
      console.error("🔥 FIRESTORE ERROR:", e);
    }

  }

} else {

  try {
    await setDoc(ref, { ...proxies[i], isManual: false });
  } catch (e) {
    console.error("🔥 FIRESTORE ERROR:", e);
  }

}
  }

  console.log("✅ Proxies generated:", proxies);
  // 🔥 SAVE HASH
await setDoc(doc(db, "system", "proxyMeta"), {
  attendanceHash: currentHash
}, { merge: true });
  
}
