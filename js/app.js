import { db } from "./firebase.js";
import {
collection,
query,
orderBy,
limit,
onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


function initChatBadge(){

const badge = document.getElementById("chatBadge");
if(!badge) return;

const q = query(
collection(db,"chats"),
orderBy("timestamp","desc"),
limit(1)
);

onSnapshot(q,(snap)=>{

const lastSeen = localStorage.getItem("lastChatSeen");

snap.forEach(doc=>{

const msg = doc.data();

if(!lastSeen || msg.timestamp.seconds > lastSeen){
badge.style.display="block";
}

});

});

}

initChatBadge();

window.toggleMenu = function(){

const menu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");

menu.classList.toggle("open");
overlay.classList.toggle("show");

}



let currentVersion = null;

async function checkVersion() {
  try {
    const res = await fetch("version.json?nocache=" + Date.now());
    const data = await res.json();

    if (currentVersion === null) {
      currentVersion = data.version;
      return;
    }

    if (data.version !== currentVersion) {
      alert("New update available. Reloading...");
      location.reload();
    }
  } catch (e) {
    console.log("Version check failed");
  }
}

setInterval(checkVersion, 5000);


if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.addEventListener("load", () => {
  window.scrollTo(0, 0);
});


window.openChat = function(){
window.location.href="messages.html";
}

