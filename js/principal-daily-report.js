// ================= AUTH GUARD =================

import { auth } from "./firebase.js";

auth.onAuthStateChanged(user=>{
  if(!user){
    window.location.href = "index.html";
  }
});


// ================= IMPORTS =================

import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let today = new Date().toISOString().split("T")[0];

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

async function loadProfile(){

  const userId = localStorage.getItem("user_id");

  if(!userId) return;

  const snap = await getDoc(doc(db,"users",userId));

  if(!snap.exists()) return;

  const data = snap.data();

  // name
  const nameBox = document.getElementById("menuUserName");
  if(nameBox){
    nameBox.innerText = data.name;
  }

  // photo
  const headerImg = document.getElementById("profilePic");
  const menuImg = document.getElementById("menuProfilePic");

  if(data.photo && headerImg){
    headerImg.src = data.photo;
  }

  if(data.photo && menuImg){
    menuImg.src = data.photo;
  }

}


// ================= DOM READY =================

window.addEventListener("load", () => {
  

const dateEl = document.getElementById("dateFilter");

if (dateEl) {
  dateEl.value = today;
}
  
  const filterBtn = document.getElementById("filterBtn");
  if (filterBtn) {
    filterBtn.addEventListener("click", loadPrincipalData);
  }

  const pdfBtn = document.getElementById("pdfBtn");
  if (pdfBtn) {
    pdfBtn.addEventListener("click", generatePrincipalPDF);
  }

  loadTeachersDropdown();   
  loadPrincipalData();      

  const name = localStorage.getItem("user_name");
  const nameBox = document.getElementById("menuUserName");
  loadProfile();
  setPageTitle();

  if(nameBox){
    nameBox.innerText = name;
  }

});

 // 👇 For Dynammic Header

function setPageTitle(){

const path = window.location.pathname;

const title = document.getElementById("pageTitle");

if(!title) return;

if(path.includes("principal-daily-report.html")){
title.innerText = "Daily Report";
}

if(path.includes("notice")){
title.innerText = "Notice Generator";
}

if(path.includes("proxy")){
title.innerText = "Proxy System";
}

if(path.includes("timetable")){
title.innerText = "Timetable";
}

}

// ================= LOAD TEACHERS DROPDOWN =================

async function loadTeachersDropdown(){

  const teacherFilter = document.getElementById("teacherFilter");
  if (!teacherFilter) return;

  try{

    const q = query(
      collection(db,"users"),
      where("role","==","teacher")
    );

    const snapshot = await getDocs(q);

    teacherFilter.innerHTML = `<option value="All">All Teachers</option>`;

    let teachers = [];

    snapshot.forEach(docSnap=>{
      teachers.push({
        id: docSnap.id,
        name: docSnap.data().name
      });
    });

    // Sort alphabetically
    teachers.sort((a,b)=>a.name.localeCompare(b.name));

    teachers.forEach(t=>{
      teacherFilter.innerHTML += `
        <option value="${t.id}">${t.name}</option>
      `;
    });

  } catch(error){
    console.error("Dropdown error:", error);
  }
}


// ================= LOAD DATA =================

async function loadPrincipalData(){

    const dateEl = document.getElementById("dateFilter");
    const classEl = document.getElementById("classFilter");
    const teacherEl = document.getElementById("teacherFilter");

    const selectedDate = dateEl ? dateEl.value : today;
    const selectedClass = classEl ? classEl.value : "All";
    const selectedTeacher = teacherEl ? teacherEl.value : "All";

  try {

    let constraints = [
      where("date", "==", selectedDate),

    ];

    if(selectedClass !== "All"){
      constraints.push(where("class", "==", selectedClass));
    }

    if(selectedTeacher !== "All"){
      constraints.push(where("teacherId", "==", selectedTeacher));
    }

    const q = query(collection(db,"homework"), ...constraints);
    const snapshot = await getDocs(q);

    let data = [];

    snapshot.forEach(docSnap=>{
      data.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    renderPrincipalTable(data);

  } catch(error){
    console.error("Load error:", error);
  }
}


// ================= RENDER TABLE =================

async function renderPrincipalTable(data){

console.log("tableBody:", document.getElementById("tableBody"));
console.log("cardView:", document.getElementById("cardView"));

const tableContainer = document.getElementById("tableBody");
const cardView = document.getElementById("cardView");

if (!tableContainer || !cardView) {
  console.error("❌ tableBody या cardView missing in HTML");
  return;
}

tableContainer.innerHTML = "";
cardView.innerHTML = "";

if(!data || data.length === 0){

  tableContainer.innerHTML =
  "<p style='text-align:center;padding:20px;'>No data found</p>";

  cardView.innerHTML =
  "<p style='text-align:center;padding:20px;'>No data found</p>";

  return;
}

  // -------- SORT --------

  data.sort((a,b)=>{
    const classA = parseInt(a.class.replace("Class ",""));
    const classB = parseInt(b.class.replace("Class ",""));
    if(classA !== classB) return classA - classB;

    const periodA = parseInt(a.period.replace("Period ",""));
    const periodB = parseInt(b.period.replace("Period ",""));
    return periodA - periodB;
  });

  // -------- GROUP BY CLASS --------

  const grouped = {};
  data.forEach(row=>{
    if(!grouped[row.class]){
      grouped[row.class] = [];
    }
    grouped[row.class].push(row);
  });

    const teacherSnapAll = await getDocs(
    query(collection(db,"users"), where("role","==","teacher"))
  );

  let classTeacherMap = {};

  teacherSnapAll.forEach(doc => {
    const data = doc.data();
    if (data.assigned_class) {
      classTeacherMap[data.assigned_class] = data.name;
    }
  });

  for(const className of Object.keys(grouped)){

    const classRows = grouped[className];

    // ===== GET CLASS TEACHER =====

let classTeacher = classTeacherMap[className] || "Not Assigned";

    // ===== CREATE SECTION BLOCK =====

let sectionHTML = `
  <div class="class-section">
    <div class="class-header">
      <h3>${className} | Class Teacher: ${classTeacher}</h3>
    </div>

        <table class="class-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Subject</th>
              <th>Teacher</th>
              <th>Classwork</th>
              <th>Homework</th>
            </tr>
          </thead>
          <tbody>
    `;

    classRows.forEach(row=>{
      sectionHTML += `
        <tr>
          <td>${row.period.replace("Period ","")}</td>
          <td>${row.subject}</td>
          <td>${row.teacherName || "N/A"}</td>
          <td>${row.classwork}</td>
          <td>${row.homework}</td>
        </tr>
      `;
    });

    sectionHTML += `
          </tbody>
        </table>
      </div>
    `;

    if (tableContainer) tableContainer.innerHTML += sectionHTML;

        let cardSection = `
      <div class="class-section">
        <div class="class-title">
          ${className} | ${classTeacher}
        </div>
    `;

    classRows.forEach(row=>{
      cardSection += `
        <div class="homework-card">
          <div><strong>Period:</strong> ${row.period.replace("Period ","")}</div>
          <div><strong>Subject:</strong> ${row.subject}</div>
          <div><strong>Teacher:</strong> ${row.teacherName || "N/A"}</div>
          <div><strong>Classwork:</strong> ${row.classwork}</div>
          <div><strong>Homework:</strong> ${row.homework}</div>
        </div>
      `;
    });

    cardSection += `</div>`;

    if (cardView) cardView.innerHTML += cardSection;
  }
}



// ================= PDF GENERATION =================

async function generatePrincipalPDF(){

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p","mm","a4");

  const dateEl = document.getElementById("dateFilter");
  const selectedDate = dateEl ? dateEl.value : today;

  try {

    const q = query(
      collection(db,"homework"),
      where("date","==",selectedDate),
      orderBy("class"),
      orderBy("period")
    );

    const snapshot = await getDocs(q);

    if(snapshot.empty){
      alert("No data available");
      return;
    }

    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(16);
    doc.text("BHABHA PUBLIC SCHOOL, JAIPUR", pageWidth/2, 20, {align:"center"});

    doc.setFontSize(12);
    doc.text("PRINCIPAL REPORT", pageWidth/2, 30, {align:"center"});

    doc.setFontSize(11);
    doc.text(`Date: ${selectedDate}`, pageWidth - 20, 40, {align:"right"});

    let tableData = [];

    snapshot.forEach(docSnap=>{
      const row = docSnap.data();
      tableData.push([
        row.class,
        row.period,
        row.subject,
        row.teacherName || "N/A",
        row.classwork,
        row.homework
      ]);
    });

    doc.autoTable({
      startY: 50,
      head: [["CLASS","PERIOD","SUBJECT","TEACHER","CLASSWORK","HOMEWORK"]],
      body: tableData,
      theme: "grid",
      styles: { fontSize: 8, overflow: "linebreak" },
      margin: { left: 15, right: 15 }
    });

    doc.save("principal_report.pdf");

  } catch(error){
    console.error(error);
  }
}

window.toggleMenu = function(){

const menu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");

menu.classList.toggle("open");
overlay.classList.toggle("show");

}

