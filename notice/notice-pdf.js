// =======================================================
// CREATE NOTICE PDF
// =======================================================

async function createNoticePDF(data){

  const { jsPDF } = window.jspdf;

  // Create A4 portrait PDF
  const pdf = new jsPDF("p","mm","a4");

  // Page width & height helpers
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();



  // =======================================================
  // SCHOOL HEADER LOGO
  // =======================================================

  // Load school logo from assets folder
  const img = new Image();
  img.src = "../assets/logo.png";

  await new Promise(resolve=>{
    img.onload = resolve;
  });

  /*
  Position Control
  ----------------
  X = 20   (left margin)
  Y = 10   (top margin)
  Width = 170
  Height = 35
  */
  pdf.addImage(img,"PNG",20,10,170,35);



  // =======================================================
  // NOTICE TITLE
  // =======================================================

  pdf.setFont("helvetica","bold");
  pdf.setFontSize(16);

  /*
  Title position
  --------------
  X = center of page
  Y = 50
  */
  pdf.text(data.title, pageWidth / 2, 50, { align: "center" });


  // Calculate title width to draw underline
  const textWidth = pdf.getTextWidth(data.title);

  // Starting X position for underline
  const startX = (pageWidth - textWidth) / 2;

  /*
  Underline position
  ------------------
  Y = 51 (just below title)
  */
  pdf.setLineWidth(0.5);
  pdf.line(startX, 51, startX + textWidth, 51);



  // =======================================================
  // CURRENT DATE (RIGHT SIDE)
  // =======================================================

  const today = new Date();

  const day = String(today.getDate()).padStart(2,'0');
  const month = String(today.getMonth()+1).padStart(2,'0');
  const year = today.getFullYear();

  const dateText = `Date : ${day}/${month}/${year}`;

  pdf.setFontSize(12);
  pdf.setFont("helvetica","bold");

  /*
  Date position control
  ---------------------
  X = pageWidth - 20  (right margin)
  Y = 60
  */
  pdf.text(dateText, pageWidth - 20, 60, { align: "right" });



  // =======================================================
  // RECEIVER (TO)
  // =======================================================

  pdf.setFontSize(12);
  pdf.setFont("helvetica","bold");

  /*
  Receiver position
  -----------------
  X = 20
  Y = 70
  */
  pdf.text(data.to,20,70);



  // =======================================================
  // GREETINGS LINE
  // =======================================================

  /*
  Greeting position
  -----------------
  X = 20
  Y = 76
  */
  pdf.text("Greetings!",20,76);



  // =======================================================
  // BODY CONTENT
  // =======================================================

  pdf.setFont("helvetica","normal");

  // Starting Y position of body text
  let y = 90;

  /*
  Text width control
  ------------------
  170 = printable width
  (A4 width - margins)
  */
  const lines = pdf.splitTextToSize(data.content,170);

  lines.forEach(line => {

    // Auto page break protection
    if (y > pageHeight - 40) {

      pdf.addPage();

      // Reset Y position for next page
      y = 30;
    }

    pdf.text(line,20,y);

    // Line spacing
    y += 6;

  });



  // =======================================================
  // SIGNATURE SECTION
  // =======================================================

  const signatureLines = data.signature.split("\n");

  // Space before signature block
  y += 10;

  pdf.setFont("helvetica","bold");



  // -------------------------------------------------------
  // KIND REGARDS
  // -------------------------------------------------------

  /*
  Position control
  ----------------
  X = 20
  Y = dynamic (depends on body length)
  */
  pdf.text(signatureLines[0],20,y);

  // Space between text and signature image
  y += 8;



  // -------------------------------------------------------
  // SIGNATURE IMAGE
  // -------------------------------------------------------

  const signResponse = await fetch("../assets/signature.png");
  const signBlob = await signResponse.blob();

  const reader = new FileReader();

  const signBase64 = await new Promise(resolve=>{
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(signBlob);
  });

  /*
  Signature image control
  -----------------------
  X = 16   (adjust left/right)
  Y = dynamic
  Width = 35
  Height = 15
  */
  pdf.addImage(signBase64,"PNG",16,y,35,15);

  // Space after signature image
  y += 18;



  // -------------------------------------------------------
  // PRINCIPAL TEXT
  // -------------------------------------------------------

  pdf.setFont("helvetica","bold");

  /*
  Position control
  ----------------
  X = 20
  Y = dynamic
  */
  pdf.text(signatureLines[1],20,y);



  // =======================================================
  // SAVE PDF
  // =======================================================

  pdf.save("notice.pdf");

}