import { db } from "./firebase.js";

import {
collection,
addDoc,
query,
orderBy,
onSnapshot,
serverTimestamp,
limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";




const messagesBox = document.getElementById("chatMessages");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const userId = localStorage.getItem("user_id");
const name = localStorage.getItem("user_name");
const photo = localStorage.getItem("user_photo");


const chatRef = collection(db,"chats");


/* SEND MESSAGE */

sendBtn.addEventListener("click", sendMessage);

input.addEventListener("keypress",(e)=>{
if(e.key === "Enter") sendMessage();
});


async function sendMessage(){

const text = input.value.trim();

if(!text) return;

await addDoc(chatRef,{
text:text,
name:name,
userId:userId,
photo:photo,
timestamp:serverTimestamp()
});

input.value="";

}


/* REALTIME LISTENER */

const q = query(chatRef, orderBy("timestamp"), limit(50));

onSnapshot(q,(snapshot)=>{

  snapshot.docChanges().forEach(change => {

    if(change.type === "added"){

      const msg = change.doc.data();

      const div = document.createElement("div");

      div.className = "message";

      div.innerHTML = `
        <img src="${msg.photo || 'assets/default-avatar.png'}">
        <div class="message-content">
          <div class="message-name">${msg.name}</div>
          <div>${msg.text}</div>
        </div>
      `;

      messagesBox.appendChild(div);
    }

  });

  messagesBox.scrollTop = messagesBox.scrollHeight;

});


document.addEventListener("DOMContentLoaded",()=>{

localStorage.setItem(
"lastChatSeen",
Math.floor(Date.now()/1000)
);

});