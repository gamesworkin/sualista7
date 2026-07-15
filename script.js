/* ============================================================
   Catálogo Retro - script.js
   HTML + CSS + JS puro com Firebase (Auth + Realtime Database)
   SDK Modular via CDN.
   Substitua as credenciais em `firebaseConfig` pelas suas.
============================================================ */
// ------------------------------------------------------------
// IMPORTS FIREBASE (SDK Modular)
// ------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase, ref, onValue, set, push, update, remove, get, child,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
// ============================================================
// CONFIG FIREBASE (substitua pelas suas credenciais)
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyBvdW06QiHlJA5glUKtucX6hL8LdvlTPME",
  authDomain: "sua-lista-e6ef3.firebaseapp.com",
  databaseURL: "https://sua-lista-e6ef3-default-rtdb.firebaseio.com",
  projectId: "sua-lista-e6ef3",
  storageBucket: "sua-lista-e6ef3.firebasestorage.app",
  messagingSenderId: "689656568290",
  appId: "1:689656568290:web:8f82257c9bb23f8b1481bb"
};
const ADMIN_EMAIL = "admin@admin.com";
// ============================================================
// ESTADO GLOBAL
// ============================================================
const state = {
  games: [],
  categories: [],
  platforms: [],
  banners: [],
  settings: {},
  currentUser: null,
  isAdmin: false,
  filters: { search: "", category: "", platform: "", year: "", genre: "", sort: "recent" },
};
let app, auth, db;
// ============================================================
// UTILS
// ============================================================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const escapeHtml = (str = "") =>
  String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function showLoading() { $("#loading").classList.add("show"); }
function hideLoading() { $("#loading").classList.remove("show"); }
function showToast(msg, type = "") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast show " + type;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove("show"), 2600);
}
function confirmAction(msg) { return window.confirm(msg); }
function ytEmbedUrl(url) {
  if (!url) return "";
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : "";
}
// ============================================================
// INIT FIREBASE
// ============================================================
function initFirebase() {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
    onAuthStateChanged(auth, handleAuthChange);
    subscribeData();
  } catch (err) {
    console.error("Erro ao inicializar Firebase:", err);
    showToast("Configure o firebaseConfig no script.js", "error");
  }
}
// ============================================================
// AUTH
// ============================================================
async function login(email, password) {
  showLoading();
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error(err);
    showToast("Falha ao entrar. Verifique e-mail e senha.", "error");
  } finally { hideLoading(); }
}
async function logout() {
  await signOut(auth);
  closeAdminPanel();
  showToast("Sessão encerrada.");
}
function handleAuthChange(user) {
  state.currentUser = user;
  state.isAdmin = !!(user && user.email === ADMIN_EMAIL);
  if (user && !state.isAdmin) {
    showToast("Acesso negado.", "error");
    signOut(auth);
    return;
  }
  if (state.isAdmin) {
    closeModal("loginModal");
    openAdminPanel();
    showToast("Bem-vindo, admin!", "success");
  }
}
function checkAdmin() { return state.isAdmin && auth.currentUser?.email === ADMIN_EMAIL; }
// ============================================================
// SUBSCRIÇÕES (Realtime)
// ============================================================
function subscribeData() {
  onValue(ref(db, "jogos"), (snap) => {
    const val = snap.val() || {};
    state.games = Object.entries(val).map(([id, g]) => ({ id, ...g }));
    renderAll();
  });
  onValue(ref(db, "categorias"), (snap) => {
    const val = snap.val() || {};
    state.categories = Object.entries(val).map(([id, c]) => ({ id, ...c }));
    renderCategoriesUI();
  });
  onValue(ref(db, "plataformas"), (snap) => {
    const val = snap.val() || {};
    state.platforms = Object.entries(val).map(([id, p]) => ({ id, ...p }));
    renderPlatformsUI();
  });
  onValue(ref(db, "banners"), (snap) => {
    const val = snap.val() || {};
    state.banners = Object.entries(val).map(([id, b]) => ({ id, ...b }));
    renderBanner();
    renderAdminBanners();
  });
  onValue(ref(db, "configuracoes"), (snap) => {
    state.settings = snap.val() || {};
    applySettings();
  });
}
// ============================================================
// CONFIG UI
// ============================================================
function applySettings() {
  const s = state.settings || {};
  if (s.nome) { $("#siteName").textContent = s.nome; document.title = s.nome; }
  if (s.cor) document.documentElement.style.setProperty("--primary", s.cor);
  if (s.favicon) { const link = document.querySelector("link[rel='icon']"); if (link) link.href = s.favicon; }
  if (s.rodape) $("#footerText").textContent = s.rodape;
  const socials = $("#socials");
  socials.innerHTML = "";
  const map = { facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", twitter: "X" };
  Object.entries(map).forEach(([k, label]) => {
    if (s[k]) socials.insertAdjacentHTML("beforeend", `<a href="${escapeHtml(s[k])}" target="_blank" rel="noopener">${label}</a>`);
  });
  // preenche form config
  $("#s_nome").value = s.nome || "";
  $("#s_descricao").value = s.descricao || "";
  $("#s_logo").value = s.logo || "";
  $("#s_favicon").value = s.favicon || "";
  $("#s_cor").value = s.cor || "#e50914";
  $("#s_rodape").value = s.rodape || "";
  $("#s_facebook").value = s.facebook || "";
  $("#s_instagram").value = s.instagram || "";
  $("#s_youtube").value = s.youtube || "";
  $("#s_twitter").value = s.twitter || "";
}
// ============================================================
// FILTROS / PESQUISA
// ============================================================
function loadFilterOptions() {
  const years = [...new Set(state.games.map((g) => g.ano).filter(Boolean))].sort((a, b) => b - a);
  const genres = [...new Set(state.games.map((g) => g.genero).filter(Boolean))].sort();
  fillSelect("#filterCategory", state.categories.map((c) => c.nome), "Todas as categorias");
  fillSelect("#filterPlatform", state.platforms.map((p) => p.nome), "Todas as plataformas");
  fillSelect("#filterYear", years, "Todos os anos");
  fillSelect("#filterGenre", genres, "Todos os gêneros");
  // datalists admin
  const dlc = $("#dl_categorias"); if (dlc) dlc.innerHTML = state.categories.map((c) => `<option value="${escapeHtml(c.nome)}">`).join("");
  const dlp = $("#dl_plataformas"); if (dlp) dlp.innerHTML = state.platforms.map((p) => `<option value="${escapeHtml(p.nome)}">`).join("");
}
function fillSelect(sel, items, allLabel) {
  const el = $(sel); if (!el) return;
  const cur = el.value;
  el.innerHTML = `<option value="">${allLabel}</option>` + items.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  if (items.includes(cur)) el.value = cur;
}
function applyFilters(list) {
  const { search, category, platform, year, genre, sort } = state.filters;
  let out = list.filter((g) => g.ativo !== false);
  if (search) {
    const q = search.toLowerCase();
    out = out.filter((g) =>
      [g.titulo, g.categoria, g.plataforma, g.ano, g.genero].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }
  if (category) out = out.filter((g) => g.categoria === category);
  if (platform) out = out.filter((g) => g.plataforma === platform);
  if (year) out = out.filter((g) => String(g.ano) === String(year));
  if (genre) out = out.filter((g) => g.genero === genre);
  const byOrdem = (a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0);
  switch (sort) {
    case "az": out.sort((a, b) => (a.titulo || "").localeCompare(b.titulo || "")); break;
    case "za": out.sort((a, b) => (b.titulo || "").localeCompare(a.titulo || "")); break;
    case "old": out.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)); break;
    default: out.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || byOrdem(a, b));
  }
  return out;
}
// ============================================================
// RENDER
// ============================================================
function renderAll() {
  loadFilterOptions();
  const filtered = applyFilters(state.games);
  const recent = [...filtered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 12);
  const featured = filtered.filter((g) => g.destaque).slice(0, 12);
  const popular = filtered.filter((g) => g.popular).slice(0, 12);
  renderGrid("#gridRecent", recent);
  renderGrid("#gridFeatured", featured);
  renderGrid("#gridPopular", popular);
  renderGrid("#gridAll", filtered);
  $("#emptyState").hidden = filtered.length > 0;
  renderAdminGames();
  renderStats();
}
function renderGrid(sel, list) {
  const el = $(sel); if (!el) return;
  if (!list.length) { el.innerHTML = ""; return; }
  el.innerHTML = list.map(cardHTML).join("");
  $$(".card", el).forEach((c) => c.addEventListener("click", () => openGameModal(c.dataset.id)));
}
function cardHTML(g) {
  const cover = g.imagem || "https://via.placeholder.com/400x533/14171f/9aa3b2?text=Sem+Imagem";
  return `
    <article class="card" data-id="${g.id}" tabindex="0" role="button" aria-label="Ver detalhes de ${escapeHtml(g.titulo)}">
      <div class="card-cover" style="background-image:url('${escapeHtml(cover)}')" aria-hidden="true"></div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(g.titulo || "Sem título")}</h3>
        <div class="card-meta">
          ${g.plataforma ? `<span class="badge">${escapeHtml(g.plataforma)}</span>` : ""}
          ${g.ano ? `<span class="badge">${escapeHtml(g.ano)}</span>` : ""}
          ${g.nota ? `<span class="badge badge-accent">★ ${escapeHtml(g.nota)}</span>` : ""}
        </div>
      </div>
    </article>`;
}
function renderBanner() {
  const track = $("#bannerTrack");
  const dots = $("#bannerDots");
  const banners = state.banners.filter((b) => b.ativo !== false).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  if (!banners.length) { track.innerHTML = `<div class="banner-slide active" style="background:linear-gradient(135deg,#221024,#1a1f2c)"><div class="banner-slide-content"><h2>Bem-vindo</h2><p>Explore o catálogo completo de jogos.</p></div></div>`; dots.innerHTML = ""; return; }
  track.innerHTML = banners.map((b, i) => `
    <div class="banner-slide ${i === 0 ? "active" : ""}" style="background-image:url('${escapeHtml(b.imagem || "")}')">
      <div class="banner-slide-content">
        <h2>${escapeHtml(b.titulo || "")}</h2>
        <p>${escapeHtml(b.descricao || "")}</p>
        ${b.link ? `<a class="btn btn-primary" href="${escapeHtml(b.link)}" target="_blank" rel="noopener">${escapeHtml(b.botao || "Saiba mais")}</a>` : ""}
      </div>
    </div>`).join("");
  dots.innerHTML = banners.map((_, i) => `<button class="banner-dot ${i === 0 ? "active" : ""}" role="tab" aria-label="Slide ${i + 1}" data-i="${i}"></button>`).join("");
  $$(".banner-dot", dots).forEach((d) => d.addEventListener("click", () => setBanner(Number(d.dataset.i))));
  startBannerAuto();
}
let bannerTimer = null, bannerIdx = 0;
function setBanner(i) {
  const slides = $$(".banner-slide"); const dots = $$(".banner-dot");
  if (!slides.length) return;
  bannerIdx = (i + slides.length) % slides.length;
  slides.forEach((s, k) => s.classList.toggle("active", k === bannerIdx));
  dots.forEach((d, k) => d.classList.toggle("active", k === bannerIdx));
}
function startBannerAuto() {
  clearInterval(bannerTimer);
  bannerTimer = setInterval(() => setBanner(bannerIdx + 1), 6000);
}
function renderCategoriesUI() {
  loadFilterOptions();
  renderAll();
  const ul = $("#adminCategoriesList");
  if (ul) ul.innerHTML = state.categories.map((c) => `
    <li>
      <span>${escapeHtml(c.nome)}</span>
      <span class="row-actions">
        <button data-edit-cat="${c.id}" data-nome="${escapeHtml(c.nome)}">Editar</button>
        <button data-del-cat="${c.id}">Excluir</button>
      </span>
    </li>`).join("");
}
function renderPlatformsUI() {
  loadFilterOptions();
  renderAll();
  const ul = $("#adminPlatformsList");
  if (ul) ul.innerHTML = state.platforms.map((p) => `
    <li>
      <span>${escapeHtml(p.nome)}</span>
      <span class="row-actions">
        <button data-edit-plat="${p.id}" data-nome="${escapeHtml(p.nome)}">Editar</button>
        <button data-del-plat="${p.id}">Excluir</button>
      </span>
    </li>`).join("");
}
// ============================================================
// MODAL DETALHES
// ============================================================
function openGameModal(id) {
  const g = state.games.find((x) => x.id === id);
  if (!g) return;
  const cover = g.imagem || "https://via.placeholder.com/500x666/14171f/9aa3b2?text=Sem+Imagem";
  const gallery = (typeof g.galeria === "string" ? g.galeria.split(",") : (g.galeria || [])).map((s) => String(s).trim()).filter(Boolean);
  const yt = ytEmbedUrl(g.video);
  $("#modalBody").innerHTML = `
    <div class="modal-cover" style="background-image:url('${escapeHtml(cover)}')"></div>
    <div class="modal-info">
      <h2 id="modalTitle">${escapeHtml(g.titulo || "")}</h2>
      <div class="card-meta">
        ${g.plataforma ? `<span class="badge badge-primary">${escapeHtml(g.plataforma)}</span>` : ""}
        ${g.categoria ? `<span class="badge">${escapeHtml(g.categoria)}</span>` : ""}
        ${g.nota ? `<span class="badge badge-accent">★ ${escapeHtml(g.nota)}</span>` : ""}
      </div>
      <p>${escapeHtml(g.descricao || "")}</p>
      <div class="info-grid">
        ${infoRow("Gênero", g.genero)}
        ${infoRow("Ano", g.ano)}
        ${infoRow("Jogadores", g.jogadores)}
        ${infoRow("Idioma", g.idioma)}
        ${infoRow("Formato", g.formato)}
        ${infoRow("Tamanho", g.tamanho)}
        ${infoRow("Empresa", g.empresa)}
        ${infoRow("Desenvolvedora", g.desenvolvedora)}
        ${infoRow("Publicadora", g.publicadora)}
      </div>
    </div>
    ${yt ? `<div class="modal-video"><iframe src="${yt}" title="Trailer" allowfullscreen loading="lazy"></iframe></div>` : ""}
    ${gallery.length ? `<div class="modal-gallery">${gallery.map((src) => `<img loading="lazy" src="${escapeHtml(src)}" alt="Imagem de ${escapeHtml(g.titulo)}" />`).join("")}</div>` : ""}
  `;
  openModal("gameModal");
}
function infoRow(label, v) { return v ? `<div><strong>${label}</strong>${escapeHtml(v)}</div>` : ""; }
function openModal(id) { const el = document.getElementById(id); el.classList.add("open"); el.setAttribute("aria-hidden", "false"); }
function closeModal(id) { const el = document.getElementById(id); el.classList.remove("open"); el.setAttribute("aria-hidden", "true"); }
// ============================================================
// ADMIN - PAINEL
// ============================================================
function openAdminPanel() { const p = $("#adminPanel"); p.hidden = false; p.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; renderAdminGames(); renderStats(); renderAdminBanners(); }
function closeAdminPanel() { const p = $("#adminPanel"); p.hidden = true; p.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; }
function renderStats() {
  const s = $("#statsGrid"); if (!s) return;
  const total = state.games.length;
  const ativos = state.games.filter((g) => g.ativo !== false).length;
  const inativos = total - ativos;
  const destaques = state.games.filter((g) => g.destaque).length;
  const cats = state.categories.length;
  const plats = state.platforms.length;
  s.innerHTML = [
    ["Jogos", total], ["Ativos", ativos], ["Inativos", inativos],
    ["Destaques", destaques], ["Categorias", cats], ["Plataformas", plats],
  ].map(([label, value]) => `<div class="stat-card"><div class="label">${label}</div><div class="value">${value}</div></div>`).join("");
  const latest = [...state.games].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 6);
  const dl = $("#dashLatest"); if (dl) { dl.innerHTML = latest.map(cardHTML).join(""); $$(".card", dl).forEach((c) => c.addEventListener("click", () => openGameModal(c.dataset.id))); }
}
function renderAdminGames() {
  const tbody = $("#adminGamesBody"); if (!tbody) return;
  const list = [...state.games].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  tbody.innerHTML = list.map((g) => `
    <tr>
      <td>${escapeHtml(g.titulo || "")}</td>
      <td>${escapeHtml(g.categoria || "")}</td>
      <td>${escapeHtml(g.plataforma || "")}</td>
      <td>${escapeHtml(g.ano || "")}</td>
      <td>${g.ativo === false ? "Não" : "Sim"}</td>
      <td class="row-actions">
        <button data-edit-game="${g.id}">Editar</button>
        <button data-del-game="${g.id}">Excluir</button>
      </td>
    </tr>`).join("");
}
function renderAdminBanners() {
  const ul = $("#adminBannersList"); if (!ul) return;
  ul.innerHTML = state.banners.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map((b) => `
    <li>
      <div style="display:flex;align-items:center;gap:10px;">
        <img src="${escapeHtml(b.imagem || "")}" alt="" loading="lazy" />
        <div><strong>${escapeHtml(b.titulo || "(sem título)")}</strong><br /><small>${escapeHtml(b.descricao || "")}</small></div>
      </div>
      <div class="row-actions">
        <button data-edit-banner="${b.id}">Editar</button>
        <button data-del-banner="${b.id}">Excluir</button>
      </div>
    </li>`).join("");
}
// ============================================================
// CRUD - JOGOS
// ============================================================
function fillGameForm(g = {}) {
  $("#gameId").value = g.id || "";
  $("#g_titulo").value = g.titulo || "";
  $("#g_categoria").value = g.categoria || "";
  $("#g_plataforma").value = g.plataforma || "";
  $("#g_ano").value = g.ano || "";
  $("#g_genero").value = g.genero || "";
  $("#g_empresa").value = g.empresa || "";
  $("#g_desenvolvedora").value = g.desenvolvedora || "";
  $("#g_publicadora").value = g.publicadora || "";
  $("#g_idioma").value = g.idioma || "";
  $("#g_jogadores").value = g.jogadores || "";
  $("#g_formato").value = g.formato || "";
  $("#g_tamanho").value = g.tamanho || "";
  $("#g_nota").value = g.nota || "";
  $("#g_ordem").value = g.ordem || "";
  $("#g_imagem").value = g.imagem || "";
  $("#g_galeria").value = Array.isArray(g.galeria) ? g.galeria.join(", ") : (g.galeria || "");
  $("#g_video").value = g.video || "";
  $("#g_descricao").value = g.descricao || "";
  $("#g_destaque").checked = !!g.destaque;
  $("#g_popular").checked = !!g.popular;
  $("#g_novo").checked = !!g.novo;
  $("#g_ativo").checked = g.ativo !== false;
}
async function saveGame(e) {
  e.preventDefault();
  if (!checkAdmin()) return;
  const id = $("#gameId").value;
  const titulo = $("#g_titulo").value.trim();
  if (!titulo) return showToast("Título é obrigatório", "error");
  const data = {
    titulo,
    descricao: $("#g_descricao").value.trim(),
    categoria: $("#g_categoria").value.trim(),
    plataforma: $("#g_plataforma").value.trim(),
    ano: Number($("#g_ano").value) || null,
    genero: $("#g_genero").value.trim(),
    empresa: $("#g_empresa").value.trim(),
    desenvolvedora: $("#g_desenvolvedora").value.trim(),
    publicadora: $("#g_publicadora").value.trim(),
    idioma: $("#g_idioma").value.trim(),
    jogadores: $("#g_jogadores").value.trim(),
    formato: $("#g_formato").value.trim(),
    tamanho: $("#g_tamanho").value.trim(),
    nota: Number($("#g_nota").value) || null,
    popular: $("#g_popular").checked,
    destaque: $("#g_destaque").checked,
    novo: $("#g_novo").checked,
    ativo: $("#g_ativo").checked,
    imagem: $("#g_imagem").value.trim(),
    galeria: $("#g_galeria").value.split(",").map((s) => s.trim()).filter(Boolean),
    video: $("#g_video").value.trim(),
    ordem: Number($("#g_ordem").value) || 0,
    timestamp: id ? (state.games.find((x) => x.id === id)?.timestamp || Date.now()) : Date.now(),
  };
  showLoading();
  try {
    if (id) await update(ref(db, "jogos/" + id), data);
    else await push(ref(db, "jogos"), data);
    showToast("Jogo salvo!", "success");
    hideGameForm();
  } catch (err) { console.error(err); showToast("Erro ao salvar.", "error"); }
  finally { hideLoading(); }
}
async function deleteGame(id) {
  if (!checkAdmin()) return;
  if (!confirmAction("Excluir este jogo?")) return;
  await remove(ref(db, "jogos/" + id));
  showToast("Jogo excluído.", "success");
}
function showGameForm(g) { $("#gameFormWrapper").hidden = false; fillGameForm(g || {}); window.scrollTo({ top: 0, behavior: "smooth" }); }
function hideGameForm() { $("#gameFormWrapper").hidden = true; $("#gameForm").reset(); $("#gameId").value = ""; }
// ============================================================
// CRUD - CATEGORIAS
// ============================================================
async function saveCategory(e) {
  e.preventDefault();
  if (!checkAdmin()) return;
  const id = $("#catId").value; const nome = $("#catNome").value.trim();
  if (!nome) return;
  if (id) await update(ref(db, "categorias/" + id), { nome });
  else await push(ref(db, "categorias"), { nome });
  $("#catId").value = ""; $("#catNome").value = ""; $("#btnCancelCat").hidden = true;
  showToast("Categoria salva.", "success");
}
async function deleteCategory(id) {
  if (!checkAdmin()) return;
  if (!confirmAction("Excluir categoria?")) return;
  await remove(ref(db, "categorias/" + id));
}
// ============================================================
// CRUD - PLATAFORMAS
// ============================================================
async function savePlatform(e) {
  e.preventDefault();
  if (!checkAdmin()) return;
  const id = $("#platId").value; const nome = $("#platNome").value.trim();
  if (!nome) return;
  if (id) await update(ref(db, "plataformas/" + id), { nome });
  else await push(ref(db, "plataformas"), { nome });
  $("#platId").value = ""; $("#platNome").value = ""; $("#btnCancelPlat").hidden = true;
  showToast("Plataforma salva.", "success");
}
async function deletePlatform(id) {
  if (!checkAdmin()) return;
  if (!confirmAction("Excluir plataforma?")) return;
  await remove(ref(db, "plataformas/" + id));
}
// ============================================================
// CRUD - BANNERS
// ============================================================
async function saveBanner(e) {
  e.preventDefault();
  if (!checkAdmin()) return;
  const id = $("#bId").value;
  const data = {
    imagem: $("#b_imagem").value.trim(),
    titulo: $("#b_titulo").value.trim(),
    descricao: $("#b_descricao").value.trim(),
    botao: $("#b_botao").value.trim(),
    link: $("#b_link").value.trim(),
    ordem: Number($("#b_ordem").value) || 0,
    ativo: $("#b_ativo").checked,
  };
  if (!data.imagem) return showToast("Imagem obrigatória", "error");
  if (id) await update(ref(db, "banners/" + id), data);
  else await push(ref(db, "banners"), data);
  $("#bannerForm").reset(); $("#bId").value = "";
  showToast("Banner salvo.", "success");
}
async function deleteBanner(id) {
  if (!checkAdmin()) return;
  if (!confirmAction("Excluir banner?")) return;
  await remove(ref(db, "banners/" + id));
}
// ============================================================
// CONFIGURAÇÕES
// ============================================================
async function saveSettings(e) {
  e.preventDefault();
  if (!checkAdmin()) return;
  const data = {
    nome: $("#s_nome").value.trim(),
    descricao: $("#s_descricao").value.trim(),
    logo: $("#s_logo").value.trim(),
    favicon: $("#s_favicon").value.trim(),
    cor: $("#s_cor").value,
    rodape: $("#s_rodape").value.trim(),
    facebook: $("#s_facebook").value.trim(),
    instagram: $("#s_instagram").value.trim(),
    youtube: $("#s_youtube").value.trim(),
    twitter: $("#s_twitter").value.trim(),
  };
  await set(ref(db, "configuracoes"), data);
  showToast("Configurações salvas.", "success");
}
// ============================================================
// EVENTOS
// ============================================================
function bindEvents() {
  // Menu mobile
  $("#menuToggle").addEventListener("click", () => {
    const nav = $("#mainNav"); const isOpen = nav.classList.toggle("open");
    $("#menuToggle").setAttribute("aria-expanded", String(isOpen));
  });
  // Pesquisa
  $("#searchInput").addEventListener("input", (e) => { state.filters.search = e.target.value; renderAll(); });
  // Filtros
  ["Category", "Platform", "Year", "Genre", "Sort"].forEach((k) => {
    const key = k.toLowerCase();
    $(`#filter${k}`).addEventListener("change", (e) => { state.filters[key] = e.target.value; renderAll(); });
  });
  $("#btnClearFilters").addEventListener("click", () => {
    state.filters = { search: "", category: "", platform: "", year: "", genre: "", sort: "recent" };
    $("#searchInput").value = "";
    ["#filterCategory", "#filterPlatform", "#filterYear", "#filterGenre"].forEach((s) => ($(s).value = ""));
    $("#filterSort").value = "recent";
    renderAll();
  });
  // Modais
  $$("[data-close]").forEach((el) => el.addEventListener("click", (e) => {
    const modal = e.target.closest(".modal"); if (modal) closeModal(modal.id);
  }));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") $$(".modal.open").forEach((m) => closeModal(m.id));
  });
  // Login modal
  $("#btnAdminOpen").addEventListener("click", () => {
    if (state.isAdmin) openAdminPanel();
    else openModal("loginModal");
  });
  $("#loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    login($("#loginEmail").value.trim(), $("#loginPassword").value);
  });
  // Admin panel
  $("#btnLogout").addEventListener("click", logout);
  $("#btnAdminClose").addEventListener("click", closeAdminPanel);
  // Tabs
  $$(".tab").forEach((t) => t.addEventListener("click", () => {
    $$(".tab").forEach((x) => x.classList.remove("active"));
    $$(".tab-panel").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    $(`.tab-panel[data-panel="${t.dataset.tab}"]`).classList.add("active");
  }));
  // Games CRUD
  $("#btnNewGame").addEventListener("click", () => showGameForm(null));
  $("#btnCancelGame").addEventListener("click", hideGameForm);
  $("#gameForm").addEventListener("submit", saveGame);
  document.addEventListener("click", (e) => {
    const eg = e.target.closest("[data-edit-game]");
    if (eg) { const g = state.games.find((x) => x.id === eg.dataset.editGame); if (g) showGameForm(g); }
    const dg = e.target.closest("[data-del-game]");
    if (dg) deleteGame(dg.dataset.delGame);
    const ec = e.target.closest("[data-edit-cat]");
    if (ec) { $("#catId").value = ec.dataset.editCat; $("#catNome").value = ec.dataset.nome; $("#btnCancelCat").hidden = false; }
    const dc = e.target.closest("[data-del-cat]");
    if (dc) deleteCategory(dc.dataset.delCat);
    const ep = e.target.closest("[data-edit-plat]");
    if (ep) { $("#platId").value = ep.dataset.editPlat; $("#platNome").value = ep.dataset.nome; $("#btnCancelPlat").hidden = false; }
    const dp = e.target.closest("[data-del-plat]");
    if (dp) deletePlatform(dp.dataset.delPlat);
    const eb = e.target.closest("[data-edit-banner]");
    if (eb) {
      const b = state.banners.find((x) => x.id === eb.dataset.editBanner);
      if (b) { $("#bId").value = b.id; $("#b_imagem").value = b.imagem || ""; $("#b_titulo").value = b.titulo || "";
        $("#b_descricao").value = b.descricao || ""; $("#b_botao").value = b.botao || "";
        $("#b_link").value = b.link || ""; $("#b_ordem").value = b.ordem || 0; $("#b_ativo").checked = b.ativo !== false;
        window.scrollTo({ top: 0, behavior: "smooth" }); }
    }
    const db2 = e.target.closest("[data-del-banner]");
    if (db2) deleteBanner(db2.dataset.delBanner);
  });
  // Categoria / Plataforma / Banner / Settings
  $("#categoryForm").addEventListener("submit", saveCategory);
  $("#btnCancelCat").addEventListener("click", () => { $("#catId").value = ""; $("#catNome").value = ""; $("#btnCancelCat").hidden = true; });
  $("#platformForm").addEventListener("submit", savePlatform);
  $("#btnCancelPlat").addEventListener("click", () => { $("#platId").value = ""; $("#platNome").value = ""; $("#btnCancelPlat").hidden = true; });
  $("#bannerForm").addEventListener("submit", saveBanner);
  $("#btnCancelBanner").addEventListener("click", () => { $("#bannerForm").reset(); $("#bId").value = ""; });
  $("#settingsForm").addEventListener("submit", saveSettings);
  // Scroll top
  const btnTop = $("#btnTop");
  window.addEventListener("scroll", () => { btnTop.hidden = window.scrollY < 400; });
  btnTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  // Nav categorias/plataformas → scroll para filtros
  $$("[data-filter-nav]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector(".filters").scrollIntoView({ behavior: "smooth", block: "start" });
  }));
}
// ============================================================
// BOOT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  initFirebase();
});
