/* ==========================================================
   Yami 个人网站 —— 站长编辑模式
   设计：内容保存在本机浏览器（IndexedDB + localStorage），
        访问者默认只能浏览，输入正确密码才能进入编辑态。
   初始密码：yami1005（进入后可在「改密码」中修改）
   ========================================================== */
(function () {
  const DEFAULT_PASSWORD = "yami1005";
  const PASS_KEY = "yami_admin_pass_hash";
  const TEXT_KEY = "yami_site_text_v1";
  const CUSTOM_KEY = "yami_site_custom_v1";
  const UNLOCK_KEY = "yami_admin_unlocked";

  /* ---------- 工具 ---------- */
  async function sha256(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- IndexedDB：存放替换后的图片 ---------- */
  const imgDB = (() => {
    let db;
    const open = () =>
      new Promise((res, rej) => {
        const req = indexedDB.open("yami_site_images", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("images");
        req.onsuccess = () => ((db = req.result), res(db));
        req.onerror = () => rej(req.error);
      });
    const tx = async (mode, fn) => {
      if (!db) await open();
      return new Promise((res, rej) => {
        const t = db.transaction("images", mode);
        const store = t.objectStore("images");
        const out = fn(store);
        t.oncomplete = () => res(out && out.result ? out.result : out);
        t.onerror = () => rej(t.error);
      });
    };
    return {
      get: async (k) => tx("readonly", (s) => s.get(k)),
      set: async (k, v) => tx("readwrite", (s) => s.put(v, k)),
      del: async (k) => tx("readwrite", (s) => s.delete(k)),
      keys: async () => tx("readonly", (s) => s.getAllKeys()),
    };
  })();

  /* ---------- 需要可编辑的文本元素 ---------- */
  const EDIT_SELECTOR = [
    ".hero-eyebrow", ".hero-name", ".hero-jp", ".hero-sub", ".hero-quote", ".tag",
    ".profile-id h3", ".profile-role", ".profile-team",
    ".info-list .k", ".info-list .v", ".profile-desc p", ".profile-photo figcaption",
    ".tl-date", ".tl-card h3", ".tl-card p",
    ".col-title", ".honor-list b", ".honor-list span",
    ".results-table th", ".results-table td",
    ".gal-item figcaption",
    ".social-card h3", ".social-card p", ".social-sub",
    ".footer p",
  ].join(",");

  let editableEls = [];

  function markEditable() {
    editableEls = $$(EDIT_SELECTOR);
    editableEls.forEach((el, i) => {
      el.dataset.editable = "true";
      el.dataset.edIdx = i;
    });
  }

  /* ---------- 图片替换 ---------- */
  function wrapImages() {
    $$("main img, .hero-art img, .profile-card img, .gal-item img, .profile-photo img").forEach(
      (img) => {
        if (img.closest(".img-wrap")) return;
        const wrap = document.createElement("div");
        wrap.className = "img-wrap";
        img.parentNode.insertBefore(wrap, img);
        wrap.appendChild(img);
        if (!img.dataset.imgKey) img.dataset.imgKey = img.getAttribute("src");
      }
    );
  }

  let fileInput;
  let currentImg = null;

  function makeFileInput() {
    fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file || !currentImg) return;
      const key = currentImg.dataset.imgKey;
      await imgDB.set(key, file);
      currentImg.src = URL.createObjectURL(file);
      flash("图片已更换，记得点「保存」");
      fileInput.value = "";
    });
  }

  /* ---------- 自定义新增照片 ---------- */
  async function addPhoto() {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.click();
    inp.addEventListener("change", async () => {
      const file = inp.files[0];
      if (!file) return;
      const key = "custom-" + Date.now();
      await imgDB.set(key, file);
      const list = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
      list.push({ key, caption: "新照片" });
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
      renderCustom();
      markEditable();
      applyText();
      flash("照片已添加");
    });
  }

  async function renderCustom() {
    $$(".gal-item[data-custom]").forEach((el) => el.remove());
    const list = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
    const gallery = $(".gallery");
    if (!gallery) return;
    for (const item of list) {
      const fig = document.createElement("figure");
      fig.className = "gal-item";
      fig.dataset.custom = item.key;
      fig.innerHTML = `<img alt="自定义照片"><figcaption></figcaption>`;
      const img = $("img", fig);
      img.dataset.imgKey = item.key;
      $("figcaption", fig).textContent = item.caption;
      const blob = await imgDB.get(item.key);
      if (blob) img.src = URL.createObjectURL(blob);
      const del = document.createElement("button");
      del.className = "img-del";
      del.textContent = "×";
      del.onclick = async (e) => {
        e.stopPropagation();
        await imgDB.del(item.key);
        let l = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
        l = l.filter((x) => x.key !== item.key);
        localStorage.setItem(CUSTOM_KEY, JSON.stringify(l));
        fig.remove();
        flash("已删除");
      };
      fig.appendChild(del);
      gallery.appendChild(fig);
    }
  }

  /* ---------- 保存 / 读取 / 清除 ---------- */
  function saveText() {
    const data = {};
    editableEls.forEach((el, i) => (data[i] = el.innerHTML));
    localStorage.setItem(TEXT_KEY, JSON.stringify({ ts: Date.now(), data }));
    // 保存自定义照片说明文字
    const list = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
    $$(".gal-item[data-custom]").forEach((fig) => {
      const it = list.find((x) => x.key === fig.dataset.custom);
      if (it) it.caption = $("figcaption", fig).textContent;
    });
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
    flash("已保存到本机 ✔");
  }

  function applyText() {
    const saved = JSON.parse(localStorage.getItem(TEXT_KEY) || "null");
    if (!saved) return;
    editableEls.forEach((el, i) => {
      if (saved.data[i] !== undefined) el.innerHTML = saved.data[i];
    });
  }

  async function applyImages() {
    const keys = (await imgDB.keys()) || [];
    $$("img[data-img-key]").forEach(async (img) => {
      const blob = await imgDB.get(img.dataset.imgKey);
      if (blob) img.src = URL.createObjectURL(blob);
    });
    return keys;
  }

  async function resetAll() {
    if (!confirm("确定要清除所有本机修改、恢复为原始内容吗？")) return;
    localStorage.removeItem(TEXT_KEY);
    localStorage.removeItem(CUSTOM_KEY);
    const keys = (await imgDB.keys()) || [];
    for (const k of keys) await imgDB.del(k);
    location.reload();
  }

  /* ---------- 导出 / 导入（用于把修改同步到线上） ---------- */
  async function exportJSON() {
    const out = { text: JSON.parse(localStorage.getItem(TEXT_KEY) || "null"), custom: [], images: {} };
    for (const item of JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]")) {
      out.custom.push(item);
    }
    const keys = (await imgDB.keys()) || [];
    for (const k of keys) {
      const blob = await imgDB.get(k);
      if (blob) out.images[k] = await blobToBase64(blob);
    }
    const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "yami-site-备份.json";
    a.click();
    flash("备份已下载（含图片，文件可能较大）");
  }
  function blobToBase64(blob) {
    return new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(blob);
    });
  }
  async function importJSON() {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json";
    inp.click();
    inp.addEventListener("change", async () => {
      const file = inp.files[0];
      if (!file) return;
      const data = JSON.parse(await file.text());
      if (data.text) localStorage.setItem(TEXT_KEY, JSON.stringify(data.text));
      if (data.custom) localStorage.setItem(CUSTOM_KEY, JSON.stringify(data.custom));
      if (data.images) {
        for (const [k, b64] of Object.entries(data.images)) {
          const blob = await (await fetch(b64)).blob();
          await imgDB.set(k, blob);
        }
      }
      location.reload();
    });
  }

  /* ---------- 工具条 ---------- */
  let bar, statusEl;
  function buildBar() {
    bar = document.createElement("div");
    bar.className = "admin-bar";
    bar.innerHTML = `
      <span class="admin-status">编辑模式</span>
      <button data-act="save">保存</button>
      <button data-act="add">添加照片</button>
      <button data-act="export">导出备份</button>
      <button data-act="import">导入备份</button>
      <button data-act="pass">改密码</button>
      <button data-act="reset" class="danger">恢复原状</button>
      <button data-act="exit">退出编辑</button>`;
    document.body.appendChild(bar);
    bar.addEventListener("click", (e) => {
      const act = e.target.dataset.act;
      if (act === "save") saveText();
      if (act === "add") addPhoto();
      if (act === "export") exportJSON();
      if (act === "import") importJSON();
      if (act === "pass") changePass();
      if (act === "reset") resetAll();
      if (act === "exit") {
        saveText();
        document.body.classList.remove("editing");
        editableEls.forEach((el) => (el.contentEditable = "false"));
        bar.classList.remove("show");
        sessionStorage.removeItem(UNLOCK_KEY);
        flash("已退出编辑模式");
      }
    });
    statusEl = $(".admin-status", bar);
  }
  let flashTimer;
  function flash(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (statusEl.textContent = "编辑模式"), 2200);
  }

  /* ---------- 密码 ---------- */
  async function getPassHash() {
    let h = localStorage.getItem(PASS_KEY);
    if (!h) {
      h = await sha256(DEFAULT_PASSWORD);
      localStorage.setItem(PASS_KEY, h);
    }
    return h;
  }
  async function changePass() {
    const old = prompt("请输入当前密码：");
    if (old === null) return;
    if ((await sha256(old)) !== (await getPassHash())) return alert("当前密码不正确");
    const np = prompt("请输入新密码（至少4位）：");
    if (!np || np.length < 4) return alert("新密码无效");
    localStorage.setItem(PASS_KEY, await sha256(np));
    alert("密码已修改，请牢记：" + np);
    flash("密码已更新");
  }

  function showLogin(onOk) {
    const modal = document.createElement("div");
    modal.className = "admin-modal open";
    modal.innerHTML = `
      <div class="admin-box">
        <h3>🔒 站长验证</h3>
        <p>仅站长可编辑，请输入管理密码</p>
        <input type="password" placeholder="管理密码" autofocus>
        <div class="admin-err"></div>
        <div class="btns"><button class="cancel">取消</button><button class="ok">进入编辑</button></div>
      </div>`;
    document.body.appendChild(modal);
    const input = $("input", modal);
    const err = $(".admin-err", modal);
    const close = () => modal.remove();
    $(".cancel", modal).onclick = close;
    modal.addEventListener("click", (e) => e.target === modal && close());
    const submit = async () => {
      const h = await sha256(input.value);
      if (h === (await getPassHash())) {
        sessionStorage.setItem(UNLOCK_KEY, "1");
        close();
        onOk();
      } else {
        err.textContent = "密码错误，无法编辑";
        input.value = "";
      }
    };
    $(".ok", modal).onclick = submit;
    input.addEventListener("keydown", (e) => e.key === "Enter" && submit());
    input.focus();
  }

  async function enterEdit() {
    document.body.classList.add("editing");
    editableEls.forEach((el) => (el.contentEditable = "true"));
    bar.classList.add("show");
    // 点击图片换图
    $$(".img-wrap").forEach((w) => {
      if (w.dataset.bound) return;
      w.dataset.bound = "1";
      w.addEventListener("click", (e) => {
        if (!document.body.classList.contains("editing")) return;
        if (e.target.closest(".img-del")) return;
        currentImg = $("img", w);
        fileInput.click();
      });
    });
    flash("已进入编辑模式");
  }

  /* ---------- 入口按钮 ---------- */
  function addEntryButton() {
    const btn = document.createElement("button");
    btn.className = "admin-entry";
    btn.textContent = "✎ 编辑";
    btn.title = "站长编辑（需密码）";
    Object.assign(btn.style, {
      position: "fixed",
      right: "18px",
      bottom: "18px",
      zIndex: "150",
      padding: "9px 16px",
      borderRadius: "999px",
      border: "1px solid rgba(178,132,255,0.35)",
      background: "rgba(20,14,32,0.85)",
      color: "#cbb8f0",
      fontSize: "0.82rem",
      cursor: "pointer",
      backdropFilter: "blur(8px)",
    });
    document.body.appendChild(btn);
    btn.addEventListener("click", () => showLogin(enterEdit));
  }

  /* ---------- 初始化 ---------- */
  async function init() {
    wrapImages();
    await renderCustom();
    markEditable();
    applyText();
    await applyImages();
    makeFileInput();
    buildBar();
    addEntryButton();
    if (sessionStorage.getItem(UNLOCK_KEY) === "1") enterEdit();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
