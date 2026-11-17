// js/pdf.js

import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.generatePDF = async function(selectedClass, today, returnBlob = false){

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p","mm","a4");

  if(!selectedClass){
    showToast("Select Class First", "error");
    return;
  }

  try {

    const q = query(
      collection(db,"homework"),
      where("class","==",selectedClass),
      where("date","==",today),
      orderBy("period")
    );

    const snapshot = await getDocs(q);

    if(snapshot.empty){
      showToast("No data available!", "error");
      return;
    }

    let data = [];
    snapshot.forEach(docSnap=>{
      data.push(docSnap.data());
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFont("Noto_Sans_Devanagari","bold");
    doc.setFontSize(20);
    doc.text("BHABHA PUBLIC SCHOOL, JAIPUR", pageWidth/2, 18, {align:"center"});

    doc.setFontSize(10);
    doc.setFont("Noto_Sans_Devanagari","normal");
    doc.text("AFFILIATED TO CBSE DELHI", pageWidth/2, 25, {align:"center"});

    doc.setFontSize(14);
    doc.setFont("Noto_Sans_Devanagari","bold");
    doc.text("DAILY HOMEWORK REPORT", pageWidth/2, 33, {align:"center"});

    doc.setLineWidth(0.7);
    doc.line(20, 38, pageWidth-20, 38);

    const dateObj = new Date(today);

    const formattedDate = dateObj.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

    const dayName = dateObj.toLocaleDateString("en-US", {
      weekday: "long"
    });

    doc.setFontSize(12);
    doc.setFont("Noto_Sans_Devanagari","bold");
    doc.text(`${selectedClass} Homework`, 20, 48);

    doc.setFont("Noto_Sans_Devanagari","bold");
    doc.text(
      `Date: ${formattedDate} (${dayName})`,
      pageWidth - 20,
      48,
      {align:"right"}
    );

    const tableData = data.map(row => [
      row.period,
      row.subject,
      row.classwork,
      row.homework
    ]);

doc.autoTable({
  startY: 58,
  head: [["PERIOD","SUBJECT","CLASSWORK","HOMEWORK"]],
  body: tableData,
  styles:{
    font:"Noto_Sans_Devanagari"
  }
});

    const fileName = selectedClass.replace(" ","").toLowerCase()+"_homework.pdf";

    if(returnBlob){
      return doc.output("blob");
    } else {
      doc.save(fileName);
    }

  } catch(error){
    console.error(error);
    showToast("Error generating PDF", "error");
  }
};