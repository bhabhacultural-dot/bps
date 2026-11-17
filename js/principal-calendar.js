import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const calendarDiv = document.getElementById("calendar");
const monthTitle = document.getElementById("monthTitle");

const modal = document.getElementById("modal");
const saveBtn = document.getElementById("saveEvent");
const deleteBtn = document.getElementById("deleteEventBtn");
const toggleBtn = document.getElementById("toggleEdit");

const monthBtn = document.getElementById("monthViewBtn");
const yearBtn = document.getElementById("yearViewBtn");

let selectedDate = null;
let selectedEventId = null;
let currentDate = new Date();
let allEvents = [];
let editMode = false;
let viewMode = "month"; // 🔥 added


function getTodayLocal() {
  const now = new Date();
  return now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0") + "-" +
    String(now.getDate()).padStart(2, "0");
}

//////////////////////////////////////////////////////
// 🔹 TOGGLE EDIT
//////////////////////////////////////////////////////

if (toggleBtn) {
  toggleBtn.onclick = () => {
    editMode = !editMode;
    toggleBtn.classList.toggle("active");
    toggleBtn.innerText = editMode ? "Edit Mode ON" : "Enable Edit";
  };
}

//////////////////////////////////////////////////////
// 🔹 VIEW MODE BUTTONS
//////////////////////////////////////////////////////

if (monthBtn && yearBtn) {
  monthBtn.onclick = () => {
    viewMode = "month";
    monthBtn.classList.add("active");
    yearBtn.classList.remove("active");
    render();
  };

  yearBtn.onclick = () => {
    viewMode = "year";
    yearBtn.classList.add("active");
    monthBtn.classList.remove("active");
    render();
  };
}

//////////////////////////////////////////////////////
// 🔹 LOAD DATA
//////////////////////////////////////////////////////

async function loadData() {
  const snapshot = await getDocs(collection(db, "calendarEvents"));

  allEvents = [];

  snapshot.forEach(d => {
    allEvents.push({
      id: d.id,
      ...d.data()
    });
  });

  render();
}

//////////////////////////////////////////////////////
// 🔹 OPEN MODAL
//////////////////////////////////////////////////////

window.openModal = (date) => {
  if (!editMode) return;

  selectedDate = date;

  const existing = allEvents.find(e => e.date === date);

  if (existing) {
    selectedEventId = existing.id;
    document.getElementById("modalTitle").innerText = "Edit Event";
    document.getElementById("eventTitle").value = existing.title;
    document.getElementById("eventType").value = existing.type;
  } else {
    selectedEventId = null;
    document.getElementById("modalTitle").innerText = "Add Event";
    document.getElementById("eventTitle").value = "";
    document.getElementById("eventType").value = "event";
  }

  modal.classList.remove("hidden");
};

//////////////////////////////////////////////////////
// 🔹 SAVE
//////////////////////////////////////////////////////

saveBtn.onclick = async () => {
  const title = document.getElementById("eventTitle").value;
  const type = document.getElementById("eventType").value;

  if (!title) return;

  // 🔥 CHECK if event already exists for this date
  const existing = allEvents.find(e => e.date === selectedDate);

  if (existing) {
    // UPDATE instead of creating duplicate
    await updateDoc(doc(db, "calendarEvents", existing.id), {
      title,
      type
    });
  } else {
    // CREATE new
    await addDoc(collection(db, "calendarEvents"), {
      date: selectedDate,
      title,
      type
    });
  }

  modal.classList.add("hidden");
  loadData();
};


//////////////////////////////////////////////////////
// 🔹 DELETE
//////////////////////////////////////////////////////

if (deleteBtn) {
  deleteBtn.onclick = async () => {
    if (!selectedEventId) {
      alert("No event to delete");
      return;
    }

    await deleteDoc(doc(db, "calendarEvents", selectedEventId));

    modal.classList.add("hidden");
    loadData();
  };
}

//////////////////////////////////////////////////////
// 🔹 CLOSE MODAL
//////////////////////////////////////////////////////

const closeBtn = document.getElementById("closeModal");
if (closeBtn) {
  closeBtn.onclick = () => {
    modal.classList.add("hidden");
  };
}

//////////////////////////////////////////////////////
// 🔹 RENDER SWITCH
//////////////////////////////////////////////////////

function render() {
  if (viewMode === "month") {
    renderMonth();
  } else {
    renderYear();
    
  }
}

//////////////////////////////////////////////////////
// 🔹 RENDER MONTH
//////////////////////////////////////////////////////

function renderMonth() {
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();

  const today = getTodayLocal();

  monthTitle.innerText = currentDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric"
  });

  let html = `<div class="calendar-grid">`;

  ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(d => {
    html += `<div class="day-name">${d}</div>`;
  });

  const firstDay = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) html += `<div></div>`;

  for (let d = 1; d <= days; d++) {
    const dateStr = `${y}-${String(m + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

    const event = allEvents
    .filter(e => e.date === dateStr)
    .sort((a,b)=> new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];

    let type = "default";

    if (event) {
      type = event.type;
    } else {
      const dayIndex = new Date(dateStr).getDay();
      if (dayIndex === 0) type = "sunday";
    }

    let todayClass = dateStr === today ? "today" : "";

    const label = event
      ? ""
      : (new Date(dateStr).getDay() === 0 ? "Holiday" : "•");

    html += `
      <div class="date ${type} ${todayClass}" onclick="openModal('${dateStr}')">
        <div class="date-number">${d}</div>
        <div class="date-label">${label}</div>
      </div>
    `;
  }

  html += `</div>`;
  calendarDiv.innerHTML = html;

  renderEventList();
}

//////////////////////////////////////////////////////
// 🔹 RENDER YEAR
//////////////////////////////////////////////////////

function renderYear() {
  const year = currentDate.getFullYear();

  monthTitle.innerText = year;

  let html = `<div class="year-grid">`;

  for (let m = 0; m < 12; m++) {
    const monthName = new Date(year, m).toLocaleString("en-US", { month: "short" });

    html += `<div class="year-month"><h4>${monthName}</h4>`;

    const days = new Date(year, m + 1, 0).getDate();

    for (let d = 1; d <= days; d++) {
      const dateStr = `${year}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const event = allEvents.find(e => e.date === dateStr);

      let className = "mini-date";
      if (event) className += " " + event.type;

      html += `<div class="${className}"></div>`;
    }

    html += `</div>`;
  }

  html += `</div>`;
  calendarDiv.innerHTML = html;
  renderYearEventList();
}


function renderYearEventList() {
  const year = currentDate.getFullYear();

  let html = `<h3>Yearly Events</h3>`;

  for (let m = 0; m < 12; m++) {

    const monthEvents = allEvents
      .filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() === m;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (monthEvents.length === 0) continue;

    const monthName = new Date(year, m).toLocaleString("en-US", { month: "long" });

    html += `<h4>${monthName}</h4>`;

    monthEvents.forEach(e => {
      html += `
        <div class="event-item ${e.type}">
          ${e.date} - ${e.title}
        </div>
      `;
    });
  }

  // अगर पूरे साल कोई event नहीं है
  if (html === `<h3>Yearly Events</h3>`) {
    html += `<div class="no-events">No events this year</div>`;
  }

  document.getElementById("eventList").innerHTML = html;
}


//////////////////////////////////////////////////////
// 🔹 EVENT LIST
//////////////////////////////////////////////////////

function renderEventList() {
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  const today = getTodayLocal();

  const filtered = allEvents.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  let html = `<h3>This Month Events</h3>`;

  if (filtered.length === 0) {
    html += `<div class="no-events">No events for this month</div>`;
  } else {
    filtered
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach(e => {
        const todayClass = e.date === today ? "today-event" : "";

        html += `
          <div class="event-item ${e.type} ${todayClass}">
            ${e.date} - ${e.title}
          </div>
        `;
      });
  }

  document.getElementById("eventList").innerHTML = html;
}

//////////////////////////////////////////////////////
// 🔹 NAV
//////////////////////////////////////////////////////

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

if (prevBtn) {
  prevBtn.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    render();
  };
}

if (nextBtn) {
  nextBtn.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    render();
  };
}

//////////////////////////////////////////////////////
// 🔹 INIT
//////////////////////////////////////////////////////

loadData();