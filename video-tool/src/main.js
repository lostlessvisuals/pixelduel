document.body.style.background = "#111";
document.body.style.color = "#ddd";
document.body.insertAdjacentHTML("beforeend", "<div style='padding:16px;font-family:system-ui'>MAIN.JS LOADED</div>");

const el = document.querySelector("#app");
if (el) el.innerHTML = "<div style='padding:16px'>App container found.</div>";
