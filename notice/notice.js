// =============================
// PREVIEW NOTICE
// =============================

async function previewNotice(){

  const title = document.getElementById("title").value;
  const to = document.getElementById("to").value;
  const content = document.getElementById("content").value;
  const signature = document.getElementById("signature").value;
  // CURRENT DATE

const today = new Date();

const day = String(today.getDate()).padStart(2,'0');
const month = String(today.getMonth()+1).padStart(2,'0');
const year = today.getFullYear();

const dateText = `Date : ${day}/${month}/${year}`;

  const preview = document.getElementById("previewArea");

  preview.innerHTML = `
  <div class="notice-paper">
    <img src="../assets/logo.png" class="notice-header" crossorigin="anonymous">

    <h2 class="notice-title">${title}</h2>
    <p style="text-align:right;font-weight:bold;margin-top:-10px;">
${dateText}
</p>

    <p><b>${to}</b></p>
    <p style="margin-top:-10px;"><b>Greetings!!!</b></p>

    <p>${content.replace(/\n/g,"<br>")}</p>

    <p><b>Kind Regards,</b></p>
    <img src="../assets/signature.png" style="width:120px;margin:2px 0 0 -10px;">
    <p style="margin-top:-6px;"><b>Principal</b></p>
    </div>
  `;

  const element = document.querySelector(".notice-paper");

const canvas = await html2canvas(element,{
  scale:2,
  useCORS:true,
  allowTaint:true,
  backgroundColor:"#ffffff"
});

  const imgData = canvas.toDataURL("image/png");

  document.getElementById("previewImage").src = imgData;

  document.getElementById("previewModal").classList.add("show");

}



// =============================
// GENERATE PDF
// =============================

function generatePDF(){

  // ensure preview exists
  if(!document.querySelector(".notice-paper")){
    previewNotice();
  }

  const title = document.getElementById("title").value;
  const to = document.getElementById("to").value;
  const content = document.getElementById("content").value;
  const signature = document.getElementById("signature").value;

  createNoticePDF({
    title,
    to,
    content,
    signature
  });

}



// =============================
// SHARE IMAGE (A4 CANVAS)
// =============================

async function shareImage(){

  const element = document.querySelector(".notice-paper");

  if(!element){
    alert("Please click Preview first");
    return;
  }

  const canvas = await html2canvas(element,{
    scale:4,
    useCORS:true,
    backgroundColor:"#ffffff",
    width:794,
    height:1123,
    windowWidth:794
  });

  const imgData = canvas.toDataURL("image/png");

  const file = await (await fetch(imgData)).blob();

  const imageFile = new File([file],"notice.png",{type:"image/png"});

  if(navigator.share){

    navigator.share({
      files:[imageFile],
      title:"School Notice"
    });

  }else{

    const a=document.createElement("a");
    a.href=imgData;
    a.download="notice.png";
    a.click();

  }

}

function closePreview(){
  document.getElementById("previewModal").classList.remove("show");
}

window.toggleMenu = function(){

const menu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");

menu.classList.toggle("open");
overlay.classList.toggle("show");

}