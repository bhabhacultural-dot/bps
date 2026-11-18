export const routes = {
  pdashboard: "principal-dashboard.html",
  notice: "notice/notice.html",
  proxy: "under-construction.html",
  timetableeditor: "timetable.html",
  pcalendar: "principal-calendar.html",
  preport:"principal-daily-report.html.html",


  timetable: "under-construction.html",
  tdashboard: "teacher-dashboard.html",
  treport:"teacher-daily-report.html",
  exam: "under-construction.html",
  attendance: "under-construction.html",
  tcalendar: "teacher-calendar.html"
};

export function go(page){
  const path = routes[page];

  if(!path){
    console.error("Route not found:", page);
    return;
  }

  window.location.href = "/" + path;
}