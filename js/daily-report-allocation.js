
import { db } from "./firebase.js";


import {
  collection,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CLASS_LIST = [
  "Class 1", "Class 2", "Class 3", "Class 4", "Class 5",
  "Class 6", "Class 7", "Class 8", "Class 9", "Class 10",
  "Class 11 PCMB", "Class 11 Humanities",
  "Class 12 PCMB", "Class 12 Humanities"
];

function todayKey() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

let stopAttendanceListener = null;

export async function startDailyReportAllocation() {
  if (stopAttendanceListener) return;

  const today = todayKey();
  const attendanceRef = doc(db, "attendance", today);

  stopAttendanceListener = onSnapshot(attendanceRef, async snapshot => {
    try {
      const attendance = snapshot.exists() ? snapshot.data() : {};

      // Missing UID means Not Marked, not Absent.
      await allocateDailyReports(attendance, today);
    } catch (error) {
      console.error("Daily report allocation error:", error);
    }
  });
}

export async function refreshDailyReportAllocation() {
  const today = todayKey();

  const attendanceSnap = await getDoc(
    doc(db, "attendance", today)
  );

  const attendance = attendanceSnap.exists()
    ? attendanceSnap.data()
    : {};

  await allocateDailyReports(attendance, today);
}



export function stopDailyReportAllocation() {
  if (stopAttendanceListener) {
    stopAttendanceListener();
    stopAttendanceListener = null;
  }
}


async function allocateDailyReports(attendance, today) {
  const usersSnap = await getDocs(collection(db, "users"));

  const teachers = usersSnap.docs
    .filter(d => d.data().role === "teacher")
    .map(d => ({
      id: d.id,
      name: d.data().name || d.id,
      eligible: d.data().dailyReportEligible === true,
      present: attendance[d.id] === true,
      explicitlyAbsent: attendance[d.id] === false
    }));

  const settings = await Promise.all(
    CLASS_LIST.map(async className => {
      const snap = await getDoc(
        doc(db, "class_settings", encodeURIComponent(className))
      );

      return {
        className,
        classTeacherId: snap.exists()
          ? snap.data().classTeacherId || ""
          : ""
      };
    })
  );

  const classTeacherMap = Object.fromEntries(
    settings.map(s => [s.className, s.classTeacherId])
  );

  const absentClasses = settings.filter(s => {
    const teacher = teachers.find(t => t.id === s.classTeacherId);
    return teacher?.explicitlyAbsent === true;
  });

  const classTeacherIds = new Set(
    Object.values(classTeacherMap).filter(Boolean)
  );

  const eligibleNCTs = teachers.filter(t =>
    t.eligible &&
    t.present &&
    !classTeacherIds.has(t.id)
  );

  const availableClassTeachers = teachers.filter(t =>
    t.present &&
    classTeacherIds.has(t.id)
  );

  const assignmentRef = doc(db, "daily_report_assignments", today);

  await runTransaction(db, async transaction => {
    // READ PHASE
    const assignmentSnap = await transaction.get(assignmentRef);

    const oldData = assignmentSnap.exists()
      ? assignmentSnap.data()
      : {};

    const oldAssignments = Array.isArray(oldData.assignments)
      ? oldData.assignments
      : [];

    const history = Array.isArray(oldData.history)
      ? [...oldData.history]
      : [];

    const allCandidates = [
      ...eligibleNCTs,
      ...availableClassTeachers
    ];

    const workloadRefs = new Map();
    const workloadData = new Map();

    for (const teacher of allCandidates) {
      const ref = doc(db, "daily_report_workload", teacher.id);
      workloadRefs.set(teacher.id, ref);

      const snap = await transaction.get(ref);

      const data = snap.exists() ? snap.data() : {};

      workloadData.set(teacher.id, {
        totalAssignedReports: Number(data.totalAssignedReports) || 0,
        totalCompletedReports: Number(data.totalCompletedReports) || 0,
        lastAssignedAt: Number(data.lastAssignedAt) || 0
      });
    }

    // CALCULATION PHASE
    const usedToday = new Map();
    const result = [];
    const assignedClasses = new Set();
    const workloadTouched = new Set();

    const now = Date.now();

    // Preserve valid existing assignments.
    for (const old of oldAssignments) {
      // Never cancel or reassign an already completed report.
if (old.status === "completed") {
  if (!assignedClasses.has(old.className)) {
    result.push(old);
    assignedClasses.add(old.className);

    usedToday.set(
      old.teacherId,
      (usedToday.get(old.teacherId) || 0) + 1
    );
  }

  continue;
}

      const stillAbsent = absentClasses.some(
        c => c.className === old.className
      );

      const isNCT = eligibleNCTs.some(
        t => t.id === old.teacherId
      );

      const isClassTeacher = availableClassTeachers.some(
        t => t.id === old.teacherId
      );

      const limit = isNCT ? 2 : 1;
      const currentCount = usedToday.get(old.teacherId) || 0;

      let reason = "";

const teacher = teachers.find(t => t.id === old.teacherId);

if (!stillAbsent) {
  reason = "class_teacher_no_longer_absent";
} else if (!teacher?.present) {
  reason = "assigned_teacher_not_present";
}
      
      else if (!isNCT && !isClassTeacher) {
        reason = "teacher_no_longer_eligible";
      } else if (assignedClasses.has(old.className)) {
        reason = "duplicate_class_assignment";
      } else if (currentCount >= limit) {
        reason = "daily_assignment_limit";
      }

      if (reason) {
        history.push({
          ...old,
          status: "cancelled",
          cancelledAt: now,
          cancellationReason: reason
        });

        continue;
      }

      result.push(old);
      assignedClasses.add(old.className);

      usedToday.set(
        old.teacherId,
        currentCount + 1
      );
    }

    // Fair workload sorting.
    function workloadSort(a, b) {
      const wa = workloadData.get(a.id);
      const wb = workloadData.get(b.id);

      if (wa.totalAssignedReports !== wb.totalAssignedReports) {
        return wa.totalAssignedReports - wb.totalAssignedReports;
      }

      const todayA = usedToday.get(a.id) || 0;
      const todayB = usedToday.get(b.id) || 0;

      if (todayA !== todayB) {
        return todayA - todayB;
      }

      return wa.lastAssignedAt - wb.lastAssignedAt;
    }

    function assignTeacher(className, pool, limit) {
      const candidates = pool
        .filter(t =>
          (usedToday.get(t.id) || 0) < limit
        )
        .sort(workloadSort);

      const selected = candidates[0];

      if (!selected) return false;

      const workload = workloadData.get(selected.id);
      const assignedAt = Date.now();

      workload.totalAssignedReports += 1;
      workload.lastAssignedAt = assignedAt;

      workloadTouched.add(selected.id);

      usedToday.set(
        selected.id,
        (usedToday.get(selected.id) || 0) + 1
      );

      result.push({
        className,
        teacherId: selected.id,
        teacherName: selected.name,
        assignedAt,
        status: "pending",
        source: pool === eligibleNCTs
          ? "nct"
          : "class_teacher"
      });

      assignedClasses.add(className);

      return true;
    }

    // PRIORITY 1: NCT, maximum 2 assignments.
    for (const item of absentClasses) {
      if (assignedClasses.has(item.className)) continue;

      assignTeacher(item.className, eligibleNCTs, 2);
    }

    // PRIORITY 2: Class Teachers, maximum 1 assignment.
    for (const item of absentClasses) {
      if (assignedClasses.has(item.className)) continue;

      assignTeacher(
        item.className,
        availableClassTeachers,
        1
      );
    }

    // WRITE PHASE
    // Only write workload documents when a new assignment is made.
    for (const teacherId of workloadTouched) {
      transaction.set(
        workloadRefs.get(teacherId),
        workloadData.get(teacherId),
        { merge: true }
      );
    }

    transaction.set(assignmentRef, {
      date: today,
      assignments: result,
      history,
      updatedAt: Date.now()
    });
  });
}
