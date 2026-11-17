import { db } from "./firebase.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let eventMap = {};

const calendarDiv = document.getElementById("calendar");
const monthTitle = document.getElementById("monthTitle");

let currentDate = new Date();
let allEvents = [];

function getTodayLocal() {
  const now = new Date();
  return now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0") + "-" +
    String(now.getDate()).padStart(2, "0");
}

// 🔹 LOAD DATA
async function loadData() {
  const snapshot = await getDocs(collection(db, "calendarEvents"));

  allEvents = [];
  eventMap = {}; // ✅ ONLY HERE (global reset)

  snapshot.forEach(d => {
    const data = d.data();
    allEvents.push(data);
    eventMap[data.date] = data;
  });

  render();
}

// 🔹 RENDER
function render() {
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();

  const today = getTodayLocal();

  monthTitle.innerText = currentDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric"
  });

  let html = `<div class="calendar-grid">`;
  ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(day => {
  html += `<div class="day-name">${day}</div>`;
});

  const firstDay = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) html += `<div></div>`;

  for (let d = 1; d <= days; d++) {
    const dateStr = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const event = eventMap[dateStr];

    let type = "default";

    if (event) {
      type = event.type;
    } else if (new Date(dateStr).getDay() === 0) {
      type = "sunday";
    }

    const todayClass = dateStr === today ? "today" : "";

    const label = event ? "" : (type === "sunday" ? "Holiday" : "•");

    html += `
      <div class="date ${type} ${todayClass}">
        <div>${d}</div>
        <div class="date-label">${label}</div>
      </div>
    `;
  }

  html += `</div>`;
  if (calendarDiv) calendarDiv.innerHTML = html;

  renderEventList();
}

// 🔹 EVENT LIST
function renderEventList() {
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  const filtered = allEvents
    .filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  let html = `<h3>This Month</h3>`;

  if (filtered.length === 0) {
    html += `<div>No events</div>`;
  } else {
    filtered.forEach(e => {
      html += `
        <div class="event-item ${e.type}">
          ${e.date} - ${e.title}
        </div>
      `;
    });
  }

const eventList = document.getElementById("eventList");
if (eventList) eventList.innerHTML = html;
}

// 🔹 NAV
const prevBtn = document.getElementById("prevBtn");
if (prevBtn) {
  prevBtn.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    render();
  };
}

const nextBtn = document.getElementById("nextBtn");
if (nextBtn) {
  nextBtn.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    render();
  };
}
// INIT
loadData();

let touchStartX = 0;
let touchEndX = 0;

if (calendarDiv) {
  calendarDiv.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  });

  calendarDiv.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  });
}

function handleSwipe() {
  const diff = touchStartX - touchEndX;

  // threshold to avoid accidental touch
  if (Math.abs(diff) < 50) return;

  if (diff > 0) {
    // 👈 swipe left → next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  } else {
    // 👉 swipe right → previous month
    currentDate.setMonth(currentDate.getMonth() - 1);
  }

  render();
}