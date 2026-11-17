import { auth, db } from "./firebase.js";

import {
doc,
getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


export function loadProfile(){

onAuthStateChanged(auth, async (user)=>{

if(!user) return;

const snap = await getDoc(doc(db,"users",user.uid));

if(!snap.exists()) return;

const data = snap.data();

const headerImg = document.getElementById("profilePic");
const menuImg = document.getElementById("menuProfilePic");
const nameBox = document.getElementById("menuUserName");

if(data.photo && headerImg)
headerImg.src = data.photo;

if(data.photo && menuImg)
menuImg.src = data.photo;

if(data.name && nameBox)
nameBox.innerText = data.name;

});

}