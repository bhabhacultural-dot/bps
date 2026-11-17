// ================= IMPORTS =================

import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ================= DOM READY =================

document.addEventListener("DOMContentLoaded", () => {
  

  // ================= PANEL REFERENCES =================

  const front = document.querySelector(".flip-front");
  const back = document.querySelector(".flip-back");
  const signupSide = document.querySelector(".flip-signup");

  // Default login visible
  if(front) front.classList.add("active");


  // ================= PASSWORD TOGGLE =================

// ================= PASSWORD TOGGLE =================

const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

if (togglePassword && passwordInput) {
  togglePassword.addEventListener("click", (e) => {
    e.preventDefault();

    const isPassword = passwordInput.type === "password";

    passwordInput.type = isPassword ? "text" : "password";
    togglePassword.textContent = isPassword ? "🙈" : "👁";
  });
}

  // ================= PANEL SWITCHING =================

  const forgotLink = document.getElementById("forgotPasswordLink");
  const backToLogin = document.getElementById("backToLogin");
  const signupLink = document.getElementById("signupLink");
  const backFromSignup = document.getElementById("backFromSignup");

  if(forgotLink){
    forgotLink.addEventListener("click", (e)=>{
      e.preventDefault();
      front.classList.remove("active");
      back.classList.add("active");
    });
  }

  if(backToLogin){
    backToLogin.addEventListener("click", (e)=>{
      e.preventDefault();
      back.classList.remove("active");
      front.classList.add("active");
    });
  }

  if(signupLink){
    signupLink.addEventListener("click", (e)=>{
      e.preventDefault();
      front.classList.remove("active");
      signupSide.classList.add("active");
    });
  }

  if(backFromSignup){
    backFromSignup.addEventListener("click", (e)=>{
      e.preventDefault();
      signupSide.classList.remove("active");
      front.classList.add("active");
    });
  }


// ================= LOGIN BUTTON =================

const loginBtn = document.getElementById("loginBtn");
const emailInput = document.getElementById("email");

if (loginBtn) {
    loginBtn.addEventListener("click", login);
}

if (emailInput) {
    emailInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            passwordInput.focus();
        }
    });
}

if (passwordInput) {
    passwordInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            loginBtn.click();
        }
    });
}

const googleBtn = document.getElementById("googleLoginBtn");

if (googleBtn) {
    googleBtn.addEventListener("click", loginWithGoogle);
}


  // ================= RESET PASSWORD BUTTON =================

  const resetBtn = document.getElementById("resetBtn");

  if(resetBtn){
    resetBtn.addEventListener("click", async ()=>{

      const email = document.getElementById("resetEmail").value.trim();

      if(!email){
        showToast("Please enter email", "error");
        return;
      }

      try{
        await sendPasswordResetEmail(auth, email);
        showToast("Reset link sent to your email", "success");

        back.classList.remove("active");
        front.classList.add("active");

      } catch(err){
        showToast(err.message, "error");
      }
    });
  }


  // ================= SIGNUP BUTTON =================

  const signupBtn = document.getElementById("signupBtn");

  if(signupBtn){
    signupBtn.addEventListener("click", async ()=>{

      const name = document.getElementById("signupName").value.trim();
      const email = document.getElementById("signupEmail").value.trim();
      const password = document.getElementById("signupPassword").value.trim();

      if(!name || !email || !password){
        showToast("Fill all fields", "error");
        return;
      }

      try{
        const userCredential =
          await createUserWithEmailAndPassword(auth, email, password);

        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
          name: name,
          role: "teacher",
          assigned_class: ""
        });

        showToast("Account created successfully", "success");

        signupSide.classList.remove("active");
        front.classList.add("active");

      } catch(err){
        showToast(err.message, "error");
      }
    });
  }


  // ================= REMEMBER EMAIL =================

  const savedEmail = localStorage.getItem("savedEmail");

  if(savedEmail){
    const emailInput = document.getElementById("email");
    const rememberCheck = document.getElementById("rememberMe");

    if(emailInput) emailInput.value = savedEmail;
    if(rememberCheck) rememberCheck.checked = true;
  }

});


// ================= LOGIN FUNCTION =================

async function login(){

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const remember = document.getElementById("rememberMe")?.checked;

  if(!email || !password){
    showToast("Enter email and password", "error");
    return;
  }

  try{

    // 🔐 SET PERSISTENCE BASED ON CHECKBOX
    if(remember){
      await setPersistence(auth, browserLocalPersistence);
      localStorage.setItem("savedEmail", email);
    } else {
      await setPersistence(auth, browserSessionPersistence);
      localStorage.removeItem("savedEmail");
    }

    const userCredential =
      await signInWithEmailAndPassword(auth, email, password);

    const user = userCredential.user;

    const userDoc = await getDoc(doc(db, "users", user.uid));

    if(!userDoc.exists()){
      showToast("User profile not found", "error");
      return;
    }

    const profile = userDoc.data();

    localStorage.setItem("role", profile.role);
    localStorage.setItem("assigned_class", profile.assigned_class || "");
    localStorage.setItem("user_id", user.uid);
    localStorage.setItem("user_name", profile.name);
    localStorage.setItem("user_photo", profile.photo || "assets/default-avatar.png");


localStorage.setItem(
  "canAccessProxy",
  profile.canAccessProxy || false
);

localStorage.setItem(
  "canViewAllReports",
  profile.canViewAllReports || false
);



localStorage.setItem(
  "canAccessPrincipalTimetable",
  profile.canAccessPrincipalTimetable || false
);



    if(profile.role === "principal"){
      window.location.href = "principal-dashboard.html";
    } else {
      window.location.href = "teacher-dashboard.html";
    }

  } catch(err){
    showToast(err.message, "error");
  }
}

// ================= LOGOUT =================

export async function logout(){
  try{
    await signOut(auth);
    localStorage.clear();
    window.location.replace("/index.html");
  } catch(err){
    showToast("Logout failed", "error");
  }
}

window.logout = logout;

// ================= AUTH STATE GUARD =================

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


onAuthStateChanged(auth, async (user) => {

    const currentPage = window.location.pathname.split("/").pop();
    const isLoginPage = currentPage === "index.html" || currentPage === "";

    // Not logged in
    if (!user) {
        if (!isLoginPage) {
            window.location.replace("index.html");
        }
        return;
    }

    try {
        // Fetch logged-in user's profile
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (!userDoc.exists()) {
            if (!isLoginPage) {
                window.location.replace("index.html");
            }
            return;
        }

        const profile = userDoc.data();
        const isPrincipal = profile.role === "principal";

        // Redirect from login page based on role
        if (isLoginPage) {
            window.location.replace(
                isPrincipal
                    ? "principal-dashboard.html"
                    : "teacher-dashboard.html"
            );
            return;
        }

        // Principal accessing teacher dashboard
        if (isPrincipal && currentPage === "teacher-dashboard.html") {
            window.location.replace("principal-dashboard.html");
            return;
        }

        // Teacher accessing principal pages
        if (
            !isPrincipal &&
            (
                currentPage === "principal-dashboard.html" ||
                currentPage === "principal-daily-report.html"
            )
        ) {
            window.location.replace("teacher-dashboard.html");
            return;
        }

    } catch (error) {
        console.error("Auth State Guard Error:", error);
    }

});


// ================= TOAST FUNCTION =================

function showToast(message, type="success"){

  const toast = document.getElementById("toast");

  toast.textContent = message;
  toast.className = "";
  toast.classList.add(type);
  toast.classList.add("show");

  setTimeout(()=>{
    toast.classList.remove("show");
  },3000);
}





async function loginWithGoogle() {

  try {

const remember = document.getElementById("rememberMe")?.checked;

await setPersistence(
  auth,
  remember ? browserLocalPersistence : browserSessionPersistence
);

const provider = new GoogleAuthProvider();

const result = await signInWithPopup(auth, provider);

    const user = result.user;

    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {

      await setDoc(userRef, {
        name: user.displayName || "",
        role: "teacher",
        assigned_class: "",
        photo: user.photoURL || ""
      });

    }

    const profileSnap = await getDoc(userRef);
    const profile = profileSnap.data();

    localStorage.setItem("role", profile.role);
    localStorage.setItem("assigned_class", profile.assigned_class || "");
    localStorage.setItem("user_id", user.uid);
    localStorage.setItem("user_name", profile.name);
    localStorage.setItem(
      "user_photo",
      profile.photo || "assets/default-avatar.png"
    );

localStorage.setItem(
  "canAccessProxy",
  profile.canAccessProxy || false
);

localStorage.setItem(
  "canViewAllReports",
  profile.canViewAllReports || false
);



    if (profile.role === "principal") {
      window.location.href = "principal-dashboard.html";
    } else {
      window.location.href = "teacher-dashboard.html";
    }

  } catch (err) {
    showToast(err.message, "error");
  }
}
