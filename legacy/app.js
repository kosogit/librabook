const searchInput = document.querySelector("#global-search");
const libraryRows = [...document.querySelectorAll("#library-rows tr")];
const complaintRows = [...document.querySelectorAll("#complaint-rows .complaint-row")];
const emptyLibraries = document.querySelector("#empty-libraries");
const emptyComplaints = document.querySelector("#empty-complaints");
const toast = document.querySelector("#toast");
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

function filterRows(rows, query) {
  let visibleCount = 0;
  for (const row of rows) {
    const matches = row.dataset.search.includes(query);
    row.hidden = !matches;
    if (matches) visibleCount += 1;
  }
  return visibleCount;
}

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim().toLocaleLowerCase();
  emptyLibraries.hidden = filterRows(libraryRows, query) !== 0;
  emptyComplaints.hidden = filterRows(complaintRows, query) !== 0;
});

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelector(".nav-item.active")?.classList.remove("active");
    item.classList.add("active");
    document.querySelector("#page-title").textContent = item.dataset.page;
    document.querySelector("#sidebar").classList.remove("open");
  });
});

document.querySelector("#menu-toggle").addEventListener("click", () => {
  document.querySelector("#sidebar").classList.toggle("open");
});

document.querySelector("#notifications-button").addEventListener("click", () => {
  showToast("You’re all caught up on notifications.");
});

document.querySelector("#export-button").addEventListener("click", () => {
  const rows = [
    ["Library", "Location", "Bookings", "Status"],
    ["StudyHub Library", "Kanpur, UP", "248", "Approved"],
    ["Knowledge Point", "Lucknow, UP", "186", "Pending"],
    ["The Study Zone", "Varanasi, UP", "142", "Approved"],
  ];
  const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const file = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = "librabook-library-report.csv";
  link.click();
  URL.revokeObjectURL(url);
  showToast("Your library report has been exported.");
});

document.querySelector("#chart-period").addEventListener("change", (event) => {
  const period = event.target.value;
  const labels = {
    week: ["Mon, 6", "Tue, 7", "Wed, 8", "Thu, 9", "Fri, 10", "Sat, 11", "Sun, 12"],
    month: ["Oct 1", "Oct 5", "Oct 9", "Oct 13", "Oct 17", "Oct 21", "Oct 25"],
    year: ["Jan", "Mar", "May", "Jul", "Sep", "Nov", "Dec"],
  };
  document.querySelectorAll(".x-labels span").forEach((label, index) => {
    label.textContent = labels[period][index];
  });
});

const bookingDialog = document.querySelector("#booking-dialog");
document.querySelector("#add-booking-button").addEventListener("click", () => bookingDialog.showModal());
document.querySelector("#confirm-booking").addEventListener("click", () => {
  const form = document.querySelector("#booking-form");
  if (!form.reportValidity()) return;
  const name = new FormData(form).get("student");
  bookingDialog.close();
  form.reset();
  showToast(`Booking created for ${name}.`);
});

document.querySelectorAll(".upgrade-button,.profile-button,.date-button,.row-more").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    showToast("This action is not available in the demo.");
  });
});
