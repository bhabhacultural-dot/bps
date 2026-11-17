import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, db } from "./firebase.js";

import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let today = new Date().toISOString().split("T")[0];
let currentClass = "";
let viewOnlyMode = false;
let editingId = null;
let currentUser = null;

async function loadProfilePhoto(){

const userId = auth.currentUser.uid;

const snap = await getDoc(doc(db,"users",userId));

if(!snap.exists()) return;

const data = snap.data();

console.log("PHOTO URL:", data.photo);

const headerImg = document.getElementById("profilePic");
const menuImg = document.getElementById("menuProfilePic");

if(data.photo && headerImg && menuImg){

headerImg.src = data.photo;
menuImg.src = data.photo;

}

}

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", () => {

  document.getElementById("subjectBtn").addEventListener("click", subjectMode);
  document.getElementById("classBtn").addEventListener("click", classMode);

  const teacherName = localStorage.getItem("user_name");
  const nameBox = document.getElementById("menuUserName");

  if(nameBox){
    nameBox.innerText = teacherName;
  }

});

/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user) => {

  if(!user) return;

  currentUser = user;
  await loadProfilePhoto();  

  const name = localStorage.getItem("user_name");
  const welcome = document.getElementById("welcomeUser");

  if(name && welcome){
    welcome.innerText = "Welcome, " + name;
  }

  subjectMode();

});


/* ================= SUBJECT MODE ================= */

function subjectMode(){

  viewOnlyMode = false;

  document.getElementById("formSection").innerHTML = `

<form id="homeworkForm">

<select id="period">
<option value="">Select Period</option>
${Array.from({length:9}, (_,i)=>`<option value="Period ${i}">Period ${i}</option>`).join("")}
</select>

<select id="class">
<option value="">Select Class</option>

<option value="Class 1">Class 1</option>
<option value="Class 2">Class 2</option>
<option value="Class 3">Class 3</option>
<option value="Class 4">Class 4</option>
<option value="Class 5">Class 5</option>
<option value="Class 6">Class 6</option>
<option value="Class 7">Class 7</option>
<option value="Class 8">Class 8</option>
<option value="Class 9">Class 9</option>
<option value="Class 10">Class 10</option>

<option value="Class 11 PCMB">Class 11 PCMB</option>
<option value="Class 11 Humanities">Class 11 Humanities</option>

<option value="Class 12 PCMB">Class 12 PCMB</option>
<option value="Class 12 Humanities">Class 12 Humanities</option>

</select>

<select id="subject">
<option value="">Select Subject</option>
</select>

<input id="otherSubject" placeholder="Enter Subject" style="display:none">

<textarea id="classwork" placeholder="Classwork"></textarea>
<textarea id="homework" placeholder="Homework"></textarea>

<button type="button" id="saveBtn">Save Entry</button>

</form>
`;

  document.getElementById("subject").addEventListener("change",(e)=>{
    document.getElementById("otherSubject").style.display =
      e.target.value === "Other" ? "block":"none";
  });

  document.getElementById("saveBtn").addEventListener("click", saveEntry);

  loadTeacherSubjects();

  loadData();

  document.getElementById("actionButtons").style.display = "none";

}


/* ================= CLASS MODE ================= */

async function classMode(){

  const snap = await getDoc(doc(db,"users",currentUser.uid));

  if(!snap.exists()) return;

  const data = snap.data();

  if(!data.assigned_class){
    showToast("You are not assigned as class teacher!","error");
    return;
  }

  viewOnlyMode = true;
  currentClass = data.assigned_class;

  document.getElementById("formSection").innerHTML = `
<h4>Viewing ${currentClass}</h4>
<p style="color:gray;font-size:13px">View Only Mode</p>
`;

  loadData();

  document.getElementById("actionButtons").style.display = "flex";


document.getElementById("pdfBtn").onclick = async () => {

const selectedClass = localStorage.getItem("assigned_class");

generateReportImage(selectedClass);

};

document.getElementById("shareBtn").onclick = async () => {

if(typeof shareReport === "function"){
  shareReport();
}else{
  console.error("shareReport function not loaded");
  showToast("Share system not ready","error");
}

};
}


/* ================= DUPLICATE ENTRY DIALOG ================= */

function showDuplicateDialog(teacherName, period, cls) {
    const existing = document.getElementById("duplicateEntryModal");
    if (existing) existing.remove();

    if (!document.getElementById("duplicateDialogStyles")) {
        const style = document.createElement("style");
        style.id = "duplicateDialogStyles";
        style.textContent = `
            .duplicate-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,.55);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                z-index: 99999;
            }
            .duplicate-dialog {
                width: 100%;
                max-width: 400px;
                background: #fff;
                color: #222;
                border-radius: 16px;
                padding: 26px 22px;
                text-align: center;
                box-shadow: 0 15px 45px rgba(0,0,0,.2);
                font-family: inherit;
            }
            .duplicate-dialog .duplicate-icon {
                width: 48px;
                height: 48px;
                margin: 0 auto 14px;
                border-radius: 50%;
                display: grid;
                place-items: center;
                background: #fff3cd;
                color: #9a6700;
                font-size: 25px;
            }
            .duplicate-dialog h3 {
                margin: 0 0 12px;
                font-size: 19px;
            }
            .duplicate-dialog p {
                margin: 0;
                line-height: 1.65;
                font-size: 14px;
                color: #555;
                overflow-wrap: anywhere;
            }
            .duplicate-dialog button {
                width: 100%;
                margin-top: 22px;
                padding: 12px;
                border: 0;
                border-radius: 9px;
                background: #222;
                color: white;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
            }
            @media(max-width: 480px) {
                .duplicate-dialog {
                    padding: 23px 18px;
                    border-radius: 14px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    const overlay = document.createElement("div");
    overlay.id = "duplicateEntryModal";
    overlay.className = "duplicate-overlay";

    const dialog = document.createElement("div");
    dialog.className = "duplicate-dialog";

    const icon = document.createElement("div");
    icon.className = "duplicate-icon";
    icon.textContent = "!";

    const heading = document.createElement("h3");
    heading.textContent = "Duplicate Entry";

    const message = document.createElement("p");
    message.textContent =
        `${teacherName} has already submitted an entry for ${period}, ${cls}. ` +
        `If you think this is incorrect, please contact ${teacherName}.`;

    const okButton = document.createElement("button");
    okButton.textContent = "OK";
    okButton.addEventListener("click", () => overlay.remove());

    dialog.append(icon, heading, message, okButton);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
}



/* ================= SAVE ENTRY ================= */

async function saveEntry(){

  const cls = document.getElementById("class").value;
  const period = document.getElementById("period").value;
  let subject = document.getElementById("subject").value;

  if(!cls || !period || !subject){
    showToast("Please Select class, period and subject","error");
    return;
  }

  if(subject==="Other"){
    subject = document.getElementById("otherSubject").value;
  }

  const classwork = document.getElementById("classwork").value.trim();
  const homework = document.getElementById("homework").value.trim();

  if(!classwork || !homework){
    showToast("Enter classwork and homework","error");
    return;
  }

try {

    // Check duplicate date + class + period
    const duplicateQuery = query(
        collection(db, "homework"),
        where("date", "==", today),
        where("class", "==", cls),
        where("period", "==", period)
    );

    const duplicateSnap = await getDocs(duplicateQuery);

    const duplicateDoc = duplicateSnap.docs.find(
        item => item.id !== editingId
    );

    if (duplicateDoc) {
        const duplicateData = duplicateDoc.data();

        showDuplicateDialog(
            duplicateData.teacherName || "Another teacher",
            period,
            cls
        );

        return;
    }

    if(editingId){

      await updateDoc(doc(db,"homework",editingId),{
        class:cls,
        period:period,
        subject:subject,
        classwork:classwork,
        homework:homework
      });

      editingId = null;

      showToast("Entry updated successfully!","success");

    }else{

      const userSnap = await getDoc(doc(db,"users",currentUser.uid));
      const userData = userSnap.data();

      await addDoc(collection(db,"homework"),{

        class:cls,
        period:period,
        subject:subject,
        classwork:classwork,
        homework:homework,
        teacherId:currentUser.uid,
        teacherName:userData.name,
        date:today

      });

      showToast("Entry saved successfully!","success");

    }

    document.getElementById("homeworkForm").reset();

    loadData();

  }catch(e){

    console.error(e);
    showToast("Error saving entry!","error");

  }

}


/* ================= LOAD DATA ================= */

async function loadData(){

  let q;

  if(viewOnlyMode){

    q = query(
      collection(db,"homework"),
      where("date","==",today),
      where("class","==",currentClass)
    );

  }else{

    q = query(
      collection(db,"homework"),
      where("date","==",today),
      where("teacherId","==",currentUser.uid)
    );

  }

  const snapshot = await getDocs(q);

  let rows=[];

  snapshot.forEach(docSnap=>{
    rows.push({
      id:docSnap.id,
      ...docSnap.data()
    });
  });

  rows.sort((a,b)=>{
    const p1=parseInt(a.period.replace("Period ",""));
    const p2=parseInt(b.period.replace("Period ",""));
    return p1-p2;
  });

  let html="";

  if(rows.length===0){
    html="<p style='text-align:center;color:gray'>No entries yet</p>";
  }

  rows.forEach(d=>{

    html+=`

<div class="homework-card">

<div class="card-header">
${viewOnlyMode
? `${d.period} | ${d.subject} | ${d.teacherName}`
: `${d.period} | ${d.class} | ${d.subject}`}
</div>

<div><b>Classwork:</b> ${escapeHTML(d.classwork)}</div>
<div><b>Homework:</b> ${escapeHTML(d.homework)}</div>

${!viewOnlyMode ? `
<div class="card-actions">
<button class="edit-btn" onclick="editEntry('${d.id}')">Edit</button>
<button class="delete-btn" onclick="deleteEntry('${d.id}')">Delete</button>
</div>`:""}

</div>
`;
  });

  document.getElementById("dataSection").innerHTML=html;

}


/* ================= DELETE ================= */

let deleteTargetId = null;

window.deleteEntry = function(id){

  deleteTargetId = id;

  document.getElementById("confirmModal").classList.add("show");

};

document.getElementById("cancelDelete").onclick = function(){

  document.getElementById("confirmModal").classList.remove("show");

};

document.getElementById("confirmDelete").onclick = async function(){

  if(!deleteTargetId) return;

  const docRef = doc(db,"homework",deleteTargetId);
await deleteDoc(docRef);

  document.getElementById("confirmModal").classList.remove("show");

  showToast("Entry deleted successfully","success");

  loadData();

};

/* ================= EDIT ================= */

window.editEntry = async function(id){

  const snap = await getDoc(doc(db,"homework",id));

  if(!snap.exists()) return;

  const d=snap.data();

  editingId=id;

  document.getElementById("class").value=d.class;
  document.getElementById("period").value=d.period;
  document.getElementById("subject").value=d.subject;
  document.getElementById("classwork").value=d.classwork;
  document.getElementById("homework").value=d.homework;

  window.scrollTo({top:0,behavior:"smooth"});

};


/* ================= TOAST ================= */

function showToast(message,type="success"){

  const toast=document.getElementById("toast");

  if(!toast) return;

  toast.textContent=message;
  toast.className="";
  toast.classList.add(type);
  toast.classList.add("show");

  setTimeout(()=>{
    toast.classList.remove("show");
  },3000);

}

async function loadTeacherSubjects(){

  const subjectDropdown = document.getElementById("subject");

  const userSnap = await getDoc(doc(db,"users",currentUser.uid));

  if(!userSnap.exists()) return;

  const userData = userSnap.data();

  const subjects = userData.subjects || [];

  subjectDropdown.innerHTML = `<option value="">Select Subject</option>`;

  subjects.forEach(sub=>{
    subjectDropdown.innerHTML += `<option value="${sub}">${sub}</option>`;
  });

  subjectDropdown.innerHTML += `<option value="Other">Other</option>`;
}

window.toggleMenu = function(){

const menu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");

menu.classList.toggle("open");
overlay.classList.toggle("show");

};

function escapeHTML(text){
return text
.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;")
.replace(/"/g,"&quot;")
.replace(/'/g,"&#039;");
}

