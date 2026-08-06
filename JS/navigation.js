const menuButton = document.querySelector(".menu-toggle");
const siteNavigation = document.querySelector(".site-nav");

if (menuButton && siteNavigation) {
  const closeMenu = () => {
    siteNavigation.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.textContent = "Menu";
    document.body.classList.remove("menu-open");
  };

  menuButton.addEventListener("click", () => {
    const isOpen = siteNavigation.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.textContent = isOpen ? "Close" : "Menu";
    document.body.classList.toggle("menu-open", isOpen);
  });

  siteNavigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) closeMenu();
  });
}
