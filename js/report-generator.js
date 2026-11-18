import { db } from "./firebase.js";
import {
collection,
query,
where,
orderBy,
getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* LOAD TEMPLATE */

async function loadReportTemplate(){
  const container = document.getElementById("reportContainer");
  if(!container) return;

  const res = await fetch("/components/homework-report.html");
  const html = await res.text();

  container.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", loadReportTemplate);



/* COMMON FUNCTION (DATA FILL) */

async function prepareReport(selectedClass){

  const element = document.getElementById("reportPage");

  const today = new Date().toISOString().split("T")[0];

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

  document.getElementById("teacherName").innerText =
    "Class Teacher : " + localStorage.getItem("user_name");

  const d = new Date();

  document.getElementById("reportDate").innerText =
    "Date : " + d.toLocaleDateString("en-GB");

  document.getElementById("reportDay").innerText =
    "Day : " + d.toLocaleDateString("en-US",{weekday:"long"});

  await new Promise(r => setTimeout(r, 300));

  return element;
}



/* DOWNLOAD PNG */

window.generateReportImage = async function(selectedClass){

  const element = await prepareReport(selectedClass);

  const canvas = await html2canvas(element,{
    scale:3,
    backgroundColor:"#ffffff"
  });

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "homework.png";
  link.click();
};



/* SHARE */

window.shareReport = async function(){

  const selectedClass = localStorage.getItem("assigned_class");

  const element = await prepareReport(selectedClass);

  const canvas = await html2canvas(element,{
    scale:3,
    backgroundColor:"#ffffff"
  });

  canvas.toBlob(async function(blob){

    const file = new File([blob],"report.png",{type:"image/png"});

    if(navigator.share){
      await navigator.share({
        files:[file],
        title:"Homework Report"
      });
    } else {
      alert("Sharing not supported");
    }

  });

};