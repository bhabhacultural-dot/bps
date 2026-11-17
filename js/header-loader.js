import { loadMenu } from "./menu.js";
import { loadProfile } from "./profile.js";

document.addEventListener("DOMContentLoaded", async () => {

  const container = document.getElementById("headerContainer");
  if(!container) return;

  // load header html
  const res = await fetch("../components/header.html");
  const html = await res.text();

  container.innerHTML = html;

  document.getElementById("pageTitle").innerText = document.title;

  // load menu
  loadMenu();

  // load profile
  loadProfile();

  // activate dynamic title
  activateMenuTitle();

});


function activateMenuTitle(){

  const titleBox = document.getElementById("pageTitle");

  // event delegation (best way)
  document.addEventListener("click", function(e){

    const link = e.target.closest("#sideMenu a[data-title]");

    if(!link) return;

    const title = link.dataset.title;

    if(titleBox){
      titleBox.innerText = title;
    }

  });

}

