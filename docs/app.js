const $ = (id) => document.getElementById(id);
const categories = ["Food", "Travel", "Education", "Entertainment", "Other"];
const categoryMeta = {
  Food: { emoji: "🍜", color: "#f29b38" },
  Travel: { emoji: "🚌", color: "#5294e8" },
  Education: { emoji: "📚", color: "#8b70ed" },
  Entertainment: { emoji: "🎬", color: "#e96c9b" },
  Other: { emoji: "✨", color: "#22a982" }
};
let token = localStorage.getItem("pt_token");
let currentUser = null;
let expenses = [];
let toastTimer;

const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(n) || 0);
const localDateString = (date = new Date()) => {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, "0"), d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const formatDate = (value) => new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const monthKey = (value) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (key) => {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && token) {
    logout(false);
    throw new Error(data.message || "Your session expired. Please log in again.");
  }
  if (!response.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

function showAlert(element, message, success = false) {
  element.textContent = message;
  element.classList.remove("hidden", "success");
  if (success) element.classList.add("success");
}
function hideAlert(element) { element.classList.add("hidden"); }
function showToast(message) {
  $("toast").textContent = message;
  $("toast").classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.add("hidden"), 2600);
}
function switchTab(tab) {
  $("loginForm").classList.toggle("hidden", tab !== "login");
  $("signupForm").classList.toggle("hidden", tab !== "signup");
  $("loginTabBtn").classList.toggle("active", tab === "login");
  $("signupTabBtn").classList.toggle("active", tab === "signup");
  hideAlert($("authAlert"));
}
function togglePassword(id, button) {
  const input = $(id);
  input.type = input.type === "password" ? "text" : "password";
  button.textContent = input.type === "password" ? "Show" : "Hide";
}
function setScreen(loggedIn) {
  $("authScreen").classList.toggle("hidden", loggedIn);
  $("dashboardScreen").classList.toggle("hidden", !loggedIn);
}
function logout(showMessage = true) {
  token = null;
  currentUser = null;
  expenses = [];
  localStorage.removeItem("pt_token");
  setScreen(false);
  if (showMessage) showToast("You have been logged out.");
}

async function handleAuth(event, mode) {
  event.preventDefault();
  hideAlert($("authAlert"));
  const payload = mode === "signup"
    ? { name: $("signupName").value.trim(), email: $("signupEmail").value.trim(), password: $("signupPassword").value }
    : { email: $("loginEmail").value.trim(), password: $("loginPassword").value };
  const button = event.submitter;
  if (button) { button.disabled = true; button.textContent = mode === "signup" ? "Creating account…" : "Logging in…"; }
  try {
    const data = await api(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify(payload) });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem("pt_token", token);
    event.target.reset();
    await openDashboard();
  } catch (error) {
    showAlert($("authAlert"), error.message);
  } finally {
    if (button) { button.disabled = false; button.innerHTML = mode === "signup" ? 'Create account <span>→</span>' : 'Log in <span>→</span>'; }
  }
}

async function openDashboard() {
  setScreen(true);
  $("userName") && ($("userName").textContent = currentUser.name);
  $("sidebarUserName").textContent = currentUser.name;
  $("avatarInitial").textContent = currentUser.name.trim().charAt(0).toUpperCase() || "U";
  $("todayLabel").textContent = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  $("date").value = localDateString();
  await loadExpenses();
}

async function loadExpenses() {
  const data = await api("/api/expenses");
  expenses = data.expenses || [];
  renderDashboard();
}

function renderDashboard() {
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const now = new Date();
  const thisMonth = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthSum = thisMonth.reduce((sum, e) => sum + Number(e.amount), 0);
  $("overallTotal").textContent = money(total);
  $("monthTotal").textContent = money(monthSum);
  $("monthCaption").textContent = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  $("expenseCount").textContent = expenses.length.toLocaleString("en-IN");
  $("averageExpense").textContent = money(expenses.length ? total / expenses.length : 0);
  renderCategories(total);
  renderDistribution(total);
  renderMonthly();
  renderTransactions();
}

function renderCategories(total) {
  const container = $("categoryCards");
  container.innerHTML = "";
  $("categoryTotal").textContent = money(total);
  categories.forEach(category => {
    const group = expenses.filter(e => e.category === category);
    const sum = group.reduce((s, e) => s + Number(e.amount), 0);
    const meta = categoryMeta[category];
    const row = document.createElement("div");
    row.className = "category-row";
    row.innerHTML = `<div class="category-emoji">${meta.emoji}</div><div><div class="category-name">${category}</div><div class="category-meta">${group.length} ${group.length === 1 ? "transaction" : "transactions"}</div></div><div class="category-amount">${money(sum)}</div>`;
    container.appendChild(row);
  });
}
function renderDistribution(total) {
  const container = $("distributionBars");
  container.innerHTML = "";
  categories.forEach(category => {
    const sum = expenses.filter(e => e.category === category).reduce((s, e) => s + Number(e.amount), 0);
    const percent = total ? sum / total * 100 : 0;
    const meta = categoryMeta[category];
    const item = document.createElement("div");
    item.className = "distribution-item";
    item.innerHTML = `<span class="name">${meta.emoji} ${category}</span><div class="bar-track"><div class="bar-fill" style="width:${percent}%;background:${meta.color}"></div></div><span class="percent">${percent.toFixed(0)}%</span>`;
    container.appendChild(item);
  });
}
function renderMonthly() {
  const map = new Map();
  expenses.forEach(e => {
    const key = monthKey(e.date);
    const groupKey = `${key}|${e.category}`;
    if (!map.has(groupKey)) map.set(groupKey, { month: key, category: e.category, count: 0, total: 0 });
    const item = map.get(groupKey);
    item.count++;
    item.total += Number(e.amount);
  });
  const rows = [...map.values()].sort((a, b) => b.month.localeCompare(a.month) || a.category.localeCompare(b.category));
  $("monthlySummaryBody").innerHTML = "";
  if (!rows.length) {
    $("monthlySummaryBody").innerHTML = '<tr><td colspan="4" class="muted">No monthly data yet.</td></tr>';
    return;
  }
  rows.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${monthLabel(item.month)}</td><td>${item.category}</td><td>${item.count}</td><td><b>${money(item.total)}</b></td>`;
    $("monthlySummaryBody").appendChild(tr);
  });
}
function renderTransactions() {
  const query = $("searchInput").value.trim().toLowerCase();
  const category = $("filterCategory").value;
  const filtered = expenses.filter(e =>
    (category === "All" || e.category === category) &&
    `${e.description} ${e.category}`.toLowerCase().includes(query)
  );
  const body = $("expenseTableBody");
  body.innerHTML = "";
  $("emptyTransactions").classList.toggle("hidden", filtered.length > 0);
  filtered.forEach(e => {
    const meta = categoryMeta[e.category] || categoryMeta.Other;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${formatDate(e.date)}</td><td class="description-cell"></td><td><span class="category-pill" style="color:${meta.color}">${meta.emoji} ${e.category}</span></td><td class="amount-cell">${money(e.amount)}</td><td><div class="row-actions"><button type="button" data-edit="${e._id}">Edit</button><button type="button" class="delete-btn" data-delete="${e._id}">Delete</button></div></td>`;
    tr.querySelector(".description-cell").textContent = e.description;
    body.appendChild(tr);
  });
}

function resetExpenseForm() {
  $("expenseForm").reset();
  $("expenseId").value = "";
  $("date").value = localDateString();
  $("expenseFormTitle").textContent = "Add an expense";
  $("expenseSubmitBtn").textContent = "＋ Add expense";
  $("cancelEditBtn").classList.add("hidden");
  hideAlert($("expenseAlert"));
}
async function submitExpense(event) {
  event.preventDefault();
  hideAlert($("expenseAlert"));
  const id = $("expenseId").value;
  const payload = {
    description: $("desc").value.trim(),
    amount: Number($("amount").value),
    date: $("date").value,
    category: $("category").value
  };
  const button = $("expenseSubmitBtn");
  button.disabled = true;
  button.textContent = id ? "Saving…" : "Adding…";
  try {
    const data = await api(id ? `/api/expenses/${id}` : "/api/expenses", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    if (id) expenses = expenses.map(e => e._id === id ? data.expense : e);
    else expenses.unshift(data.expense);
    resetExpenseForm();
    renderDashboard();
    showToast(id ? "Expense updated successfully." : "Expense added successfully.");
  } catch (error) {
    showAlert($("expenseAlert"), error.message);
  } finally {
    button.disabled = false;
    button.textContent = $("expenseId").value ? "Save changes" : "＋ Add expense";
  }
}
function startEdit(id) {
  const expense = expenses.find(e => e._id === id);
  if (!expense) return;
  $("expenseId").value = expense._id;
  $("desc").value = expense.description;
  $("amount").value = expense.amount;
  $("date").value = localDateString(new Date(expense.date));
  $("category").value = expense.category;
  $("expenseFormTitle").textContent = "Edit expense";
  $("expenseSubmitBtn").textContent = "Save changes";
  $("cancelEditBtn").classList.remove("hidden");
  $("expenseForm").scrollIntoView({ behavior: "smooth", block: "center" });
}
async function deleteExpense(id) {
  const expense = expenses.find(e => e._id === id);
  if (!expense || !confirm(`Delete "${expense.description}"? This cannot be undone.`)) return;
  try {
    await api(`/api/expenses/${id}`, { method: "DELETE" });
    expenses = expenses.filter(e => e._id !== id);
    if ($("expenseId").value === id) resetExpenseForm();
    renderDashboard();
    showToast("Expense deleted.");
  } catch (error) {
    showToast(error.message);
  }
}

$("loginForm").addEventListener("submit", e => handleAuth(e, "login"));
$("signupForm").addEventListener("submit", e => handleAuth(e, "signup"));
document.querySelectorAll("[data-tab]").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
document.querySelectorAll(".password-toggle").forEach(btn => btn.addEventListener("click", () => togglePassword(btn.dataset.target, btn)));
$("expenseForm").addEventListener("submit", submitExpense);
$("cancelEditBtn").addEventListener("click", resetExpenseForm);
$("expenseTableBody").addEventListener("click", e => {
  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-delete]");
  if (edit) startEdit(edit.dataset.edit);
  if (del) deleteExpense(del.dataset.delete);
});
$("searchInput").addEventListener("input", renderTransactions);
$("filterCategory").addEventListener("change", renderTransactions);
$("logoutBtn").addEventListener("click", () => logout());
$("logoutTopBtn").addEventListener("click", () => logout());
$("themeToggleBtn").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const dark = document.body.classList.contains("dark");
  localStorage.setItem("pt_theme", dark ? "dark" : "light");
  $("themeToggleBtn").textContent = dark ? "☀" : "☾";
});
if (localStorage.getItem("pt_theme") === "dark") {
  document.body.classList.add("dark");
  $("themeToggleBtn").textContent = "☀";
}

(async function init() {
  if (!token) return setScreen(false);
  try {
    const data = await api("/api/auth/me");
    currentUser = data.user;
    await openDashboard();
  } catch {
    logout(false);
  }
})();
