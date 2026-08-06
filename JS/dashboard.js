const userData = JSON.parse(localStorage.getItem("winebankDemoUser") || "null");

if (!userData) {
  window.location.href = "./login.html";
} else {
  document.getElementById("memberName").textContent =
    userData.firstName || "Member";

  document.getElementById("memberEmail").textContent =
    userData.email || "Not provided";

  document.getElementById("memberPhone").textContent =
    userData.phone || "Not provided";

  document.getElementById("membershipStatus").textContent =
    userData.membershipStatus || "Pending";
}

document.getElementById("logoutButton").addEventListener("click", () => {
  localStorage.removeItem("winebankDemoUser");
  window.location.href = "./login.html";
});
