// Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
  import { getDatabase } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";

  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyABo8kwTsbJoPMpROSnUb2eMXtJrVRtAV4",
    authDomain: "gen-lang-client-0571190893.firebaseapp.com",
    projectId: "gen-lang-client-0571190893",
    storageBucket: "gen-lang-client-0571190893.firebasestorage.app",
    messagingSenderId: "240181632802",
    appId: "1:240181632802:web:95180d37dd28b9cc520f7b"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const database = getDatabase(app);

  export { database } ;