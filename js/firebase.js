// js/firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDc4djTLkd04UTQRj3oYqN5UnnSRpJ7VUw",
  authDomain: "homework-system-2025.firebaseapp.com",
  projectId: "homework-system-2025",
  storageBucket: "homework-system-2025.firebasestorage.app",
  messagingSenderId: "452765209034",
  appId: "1:452765209034:web:a348ce8fa63adba3243f33",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);