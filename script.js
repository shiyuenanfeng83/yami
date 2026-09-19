// ===== 导航栏滚动状态 =====
const navbar = document.querySelector(".navbar");
window.addEventListener("scroll", () => {
  navbar.classList.toggle("scrolled", window.scrollY > 30);
});

// ===== 移动端菜单 =====
const navToggle = document.getElementById("navToggle");
const navLinks = document.querySelector(".nav-links");
navToggle.addEventListener("click", () => navLinks.classList.toggle("open"));
navLinks.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => navLinks.classList.remove("open"))
);

// ===== 滚动进入动画 =====
const revealTargets = document.querySelectorAll(
  ".section-title, .profile-card, .profile-info, .tl-item, .results-col, .gal-item, .social-card"
);
revealTargets.forEach((el) => el.classList.add("reveal"));
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        io.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12 }
);
revealTargets.forEach((el) => io.observe(el));

// ===== 画廊灯箱 =====
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
document.querySelectorAll(".gal-item img").forEach((img) => {
  img.addEventListener("click", () => {
    lightboxImg.src = img.src;
    lightbox.classList.add("open");
  });
});
lightbox.addEventListener("click", () => lightbox.classList.remove("open"));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") lightbox.classList.remove("open");
});

// ===== 图片缺失时使用占位图 =====
document.querySelectorAll("img").forEach((img) => {
  img.addEventListener("error", () => {
    const c = document.createElement("canvas");
    c.width = 400;
    c.height = 520;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 400, 520);
    grad.addColorStop(0, "#2a1f42");
    grad.addColorStop(1, "#3d1f38");
    g.fillStyle = grad;
    g.fillRect(0, 0, 400, 520);
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.font = "60px serif";
    g.textAlign = "center";
    g.fillText("💣", 200, 240);
    g.font = "20px sans-serif";
    g.fillText("请将图片放入 assets 文件夹", 200, 300);
    img.src = c.toDataURL();
  });
});

// ===== 粒子背景（紫色光尘） =====
const canvas = document.getElementById("particles");
const ctx = canvas.getContext("2d");
let particles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

function createParticles() {
  const count = Math.min(70, Math.floor(window.innerWidth / 20));
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 2 + 0.5,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -Math.random() * 0.4 - 0.1,
    alpha: Math.random() * 0.5 + 0.15,
    hue: Math.random() > 0.5 ? 266 : 330, // 紫 / 粉
  }));
}
createParticles();
window.addEventListener("resize", createParticles);

function tick() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.y < -10) {
      p.y = canvas.height + 10;
      p.x = Math.random() * canvas.width;
    }
    if (p.x < -10) p.x = canvas.width + 10;
    if (p.x > canvas.width + 10) p.x = -10;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${p.alpha})`;
    ctx.fill();
  }
  requestAnimationFrame(tick);
}
tick();
