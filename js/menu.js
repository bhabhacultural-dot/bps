import { go } from "./router.js";

export function loadMenu(){

  const role = localStorage.getItem("role");

  const menu = document.getElementById("menuItems");

  if(!menu) return;

  if(role === "principal"){

menu.innerHTML = `

<a onclick="go('pdashboard')" data-title="Dashboard">
Dashboard
</a>

<a onclick="go('preport')" data-title="Daily Report">
Daily Report
</a>

<a onclick="go('notice')" data-title="Notice Generator">
Notice Generator
</a>

<a onclick="go('proxy')" data-title="Proxy System">
Proxy System
</a>

<a onclick="go('exam')" data-title="Examination">
Examination
</a>

<a onclick="go('pcalendar')" data-title="School Calendar">
School Calendar
</a>

<a onclick="go('timetableeditor')" data-title="Timetable">
Timetable Editor
</a>

<a onclick="logout()" class="logout-link">
Logout
</a>

`;
  }

  else{

menu.innerHTML = `

<a onclick="go('tdashboard')" data-title="Dashboard">
Dashboard
</a>

<a onclick="go('treport')" data-title="Daily Report">
Daily Report
</a>

<a onclick="go('timetable')" data-title="Timetable">
Timetable
</a>

<a onclick="go('exam')" data-title="Examination">
Examination
</a>

<a onclick="go('tcalendar')" data-title="calendar">
School Calendar
</a>

<a onclick="go('attendance')" data-title="Attendance">
Attendance
</a>

<a onclick="logout()" class="logout-link">
Logout
</a>

`;

  }

}

window.go = go;


