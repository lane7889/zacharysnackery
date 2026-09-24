// Zachary's Snackery ordering experience
// Uses the same Firebase project already used by the website's review section.
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, doc, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBcG04pspfGCJL_uFON8AZKeu-GtGjap9g",
  authDomain: "zachary-s-snackery.firebaseapp.com",
  projectId: "zachary-s-snackery",
  storageBucket: "zachary-s-snackery.firebasestorage.app",
  messagingSenderId: "240859823237",
  appId: "1:240859823237:web:f1608d6ba3d9ef05bf7dec"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const BUSINESS_EMAIL = "zacharyssnackery@gmail.com";
const PUBLIC_SERVICE_AREA = "Orlando / Dr. Phillips, FL 32836";
const LOCAL_RADIUS_MILES = 25;

const state = {
  fulfillment: "local",
  localDozens: 1,
  shippingBoxes: 1,
  localMix: 1,
  shipMix: 1,
  selectedFlavors: ["snickerdoodle"],
  shippingSixFlavor: "gingersnap",
  flavors: { snickerdoodle: 12, crinkle: 0, gingersnap: 0 }
};

const flavorNames = {
  snickerdoodle: "Snickerdoodles",
  crinkle: "Chocolate Crinkles",
  gingersnap: "Gingersnaps"
};

const $ = (id) => document.getElementById(id);
const form = $("native-order-form");
const flavorKeys = Object.keys(flavorNames);

function totalCookies() {
  return state.fulfillment === "shipping" ? state.shippingBoxes * 20 : state.localDozens * 12;
}

function price() {
  return state.fulfillment === "shipping" ? state.shippingBoxes * 25 : state.localDozens * 14;
}

function allowedMixCount() {
  return state.fulfillment === "shipping" ? state.shipMix : state.localMix;
}

function validMixOptions() {
  const total = totalCookies();
  if (state.fulfillment === "shipping") {
    // Shipping boxes contain 20 cookies. Two flavors split 10/10; three flavors split 7/7/6 per box.
    return { 1: true, 2: total >= 20, 3: total >= 20 };
  }
  return { 1: true, 2: total >= 12 && total % 6 === 0, 3: total >= 12 && total % 4 === 0 };
}

function normalizeSelectedFlavors() {
  const mix = allowedMixCount();
  state.selectedFlavors = state.selectedFlavors.filter(k => flavorKeys.includes(k));
  while (state.selectedFlavors.length > mix) state.selectedFlavors.pop();
  for (const key of flavorKeys) {
    if (state.selectedFlavors.length >= mix) break;
    if (!state.selectedFlavors.includes(key)) state.selectedFlavors.push(key);
  }
}

function splitQuantities() {
  const total = totalCookies();
  const mix = allowedMixCount();
  normalizeSelectedFlavors();
  const active = state.selectedFlavors.slice(0, mix);
  const next = { snickerdoodle: 0, crinkle: 0, gingersnap: 0 };

  if (mix === 1) {
    next[active[0]] = total;
  } else if (mix === 2) {
    if (state.fulfillment === "shipping") {
      // 20-cookie shipping boxes can always be split evenly between two chosen flavors.
      next[active[0]] = total / 2;
      next[active[1]] = total / 2;
    } else {
      const units = total / 6;
      if (!Number.isInteger(units) || units < 2) return null;
      const aUnits = Math.ceil(units / 2);
      next[active[0]] = aUnits * 6;
      next[active[1]] = total - next[active[0]];
    }
  } else {
    if (state.fulfillment === "shipping") {
      // Each 20-cookie shipping box is 7 + 7 + 6. The customer chooses which flavor gets 6.
      if (!active.includes(state.shippingSixFlavor)) state.shippingSixFlavor = active[active.length - 1];
      active.forEach(k => next[k] = (k === state.shippingSixFlavor ? 6 : 7) * state.shippingBoxes);
    } else {
      if (total % 4 !== 0) return null;
      const units = total / 4;
      if (units < 3) return null;
      const base = Math.floor(units / 3);
      const rem = units % 3;
      active.forEach((k, i) => next[k] = (base + (i < rem ? 1 : 0)) * 4);
    }
  }
  return next;
}

function resetSplit() {
  const split = splitQuantities();
  if (split) state.flavors = split;
}

function setDefaultMix() {
  const options = validMixOptions();
  const key = state.fulfillment === "shipping" ? "shipMix" : "localMix";
  if (!options[state[key]]) state[key] = 1;
  normalizeSelectedFlavors();
  resetSplit();
}

function selectFlavor(key) {
  const mix = allowedMixCount();
  const selected = state.selectedFlavors;
  const index = selected.indexOf(key);

  if (index >= 0) {
    // Don't allow fewer selected flavors than the chosen mix count.
    if (selected.length === mix) return;
    selected.splice(index, 1);
  } else if (selected.length < mix) {
    selected.push(key);
  } else {
    // Replace the oldest selected flavor so any flavor, including Gingersnaps, can be chosen.
    selected.shift();
    selected.push(key);
  }
  resetSplit();
  render();
}

function renderFlavorControls() {
  const total = totalCookies();
  const mix = allowedMixCount();
  const wrap = $("flavor-controls");
  wrap.innerHTML = "";

  flavorKeys.forEach((key) => {
    const qty = state.flavors[key] || 0;
    const isSelected = state.selectedFlavors.includes(key);
    const row = document.createElement("button");
    row.type = "button";
    row.className = `flavor-row flavor-choice ${isSelected ? "selected" : ""}`;
    row.setAttribute("aria-pressed", isSelected ? "true" : "false");
    row.innerHTML = `
      <div><strong>${flavorNames[key]}</strong><span>${isSelected ? `${qty} cookies` : "Tap to select"}</span></div>
      <div class="flavor-check" aria-hidden="true">${isSelected ? "✓" : ""}</div>`;
    row.addEventListener("click", () => selectFlavor(key));
    wrap.appendChild(row);
  });
}

function renderShippingThreeChoice() {
  const wrap = $("shipping-three-choice");
  const show = state.fulfillment === "shipping" && allowedMixCount() === 3;
  wrap.hidden = !show;
  if (!show) { wrap.innerHTML = ""; return; }
  if (!state.selectedFlavors.includes(state.shippingSixFlavor)) state.shippingSixFlavor = state.selectedFlavors[2];
  wrap.innerHTML = `<strong>Which flavor should have one less cookie?</strong><small>Each 20-cookie box is 7 + 7 + 6. Choose the flavor that gets 6.</small><div class="six-flavor-buttons"></div>`;
  const buttons = wrap.querySelector(".six-flavor-buttons");
  state.selectedFlavors.slice(0,3).forEach(key => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `six-flavor-btn ${state.shippingSixFlavor === key ? "active" : ""}`;
    btn.textContent = `${flavorNames[key]} — 6`;
    btn.addEventListener("click", () => { state.shippingSixFlavor = key; resetSplit(); render(); });
    buttons.appendChild(btn);
  });
}

function render() {
  const total = totalCookies();
  const options = validMixOptions();
  setDefaultMix();

  document.querySelectorAll("[data-fulfillment]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.fulfillment === state.fulfillment);
  });
  $("local-panel").hidden = state.fulfillment !== "local";
  $("shipping-panel").hidden = state.fulfillment !== "shipping";
  // Keep the delivery confirmation visible for clarity, but make it non-applicable for shipping.
  const localConfirm = $("local-confirm-checkbox");
  const localConfirmLabel = $("local-radius-confirm");
  const localConfirmText = $("local-confirm-text");
  const isShipping = state.fulfillment === "shipping";
  localConfirm.disabled = isShipping;
  if (isShipping) localConfirm.checked = false;
  localConfirmLabel.classList.toggle("not-applicable", isShipping);
  localConfirmText.textContent = isShipping
    ? "Not applicable if you are shipping — leave unhighlighted."
    : "I confirm my local-delivery address is within 25 miles of the Orlando / Dr. Phillips 32836 service area. Your exact bakery location is not displayed publicly.";

  $("local-dozens").textContent = state.localDozens;
  $("shipping-boxes").textContent = state.shippingBoxes;
  $("cookie-count").textContent = total;
  $("order-price").textContent = `$${price().toFixed(2)}`;
  $("summary-fulfillment").textContent = state.fulfillment === "shipping" ? "Shipping" : "Local delivery";

  document.querySelectorAll("[data-mix]").forEach(btn => {
    const n = Number(btn.dataset.mix);
    btn.disabled = !options[n];
    btn.classList.toggle("active", n === allowedMixCount());
    btn.classList.toggle("unavailable", !options[n]);
  });

  renderFlavorControls();
  renderShippingThreeChoice();
  if (allowedMixCount() === 1) {
    $("mix-help").textContent = "Choose any one flavor.";
  } else if (allowedMixCount() === 2 && state.fulfillment === "shipping") {
    $("mix-help").textContent = "Choose any two flavors. A 20-cookie shipping box splits 10 + 10.";
  } else if (allowedMixCount() === 2) {
    $("mix-help").textContent = "Choose any two flavors. Local orders are divided in 6-cookie increments.";
  } else if (state.fulfillment === "shipping") {
    $("mix-help").textContent = "All three flavors split 7 + 7 + 6 per 20-cookie box. You choose which flavor gets 6.";
  } else {
    $("mix-help").textContent = "All three flavors are divided in 4-cookie increments.";
  }

  const flavorSummary = flavorKeys.filter(k => state.flavors[k] > 0)
    .map(k => `${state.flavors[k]} ${flavorNames[k]}`).join(" · ");
  $("flavor-summary").textContent = flavorSummary;
}

// Fulfillment toggle
document.querySelectorAll("[data-fulfillment]").forEach(btn => btn.addEventListener("click", () => {
  state.fulfillment = btn.dataset.fulfillment;
  setDefaultMix();
  render();
}));

// Quantity controls
$("local-minus").addEventListener("click", () => { if (state.localDozens > 1) state.localDozens--; setDefaultMix(); render(); });
$("local-plus").addEventListener("click", () => { state.localDozens++; setDefaultMix(); render(); });
$("ship-minus").addEventListener("click", () => { if (state.shippingBoxes > 1) state.shippingBoxes--; setDefaultMix(); render(); });
$("ship-plus").addEventListener("click", () => { state.shippingBoxes++; setDefaultMix(); render(); });

document.querySelectorAll("[data-mix]").forEach(btn => btn.addEventListener("click", () => {
  if (btn.disabled) return;
  const key = state.fulfillment === "shipping" ? "shipMix" : "localMix";
  state[key] = Number(btn.dataset.mix);
  normalizeSelectedFlavors();
  resetSplit();
  render();
}));

function escapeHtml(s="") {
  return String(s).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}

function orderNumber() {
  const d = new Date();
  const stamp = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  return `ZS-${stamp}-${Math.floor(1000 + Math.random()*9000)}`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $("form-status");
  status.className = "form-status";
  status.textContent = "";

  if (!form.reportValidity()) return;

  const fd = new FormData(form);
  const customer = {
    name: fd.get("name").trim(),
    email: fd.get("email").trim(),
    phone: fd.get("phone").trim(),
    address: fd.get("address").trim(),
    city: fd.get("city").trim(),
    state: fd.get("state").trim(),
    zip: fd.get("zip").trim()
  };

  if (state.fulfillment === "local" && !fd.get("local_confirm")) {
    status.className = "form-status error";
    status.textContent = "Please confirm that your delivery address is within 25 miles of the Orlando / Dr. Phillips 32836 service area.";
    return;
  }

  const id = orderNumber();
  const items = flavorKeys.filter(k => state.flavors[k] > 0).map(k => ({ flavor: flavorNames[k], quantity: state.flavors[k] }));
  const order = {
    orderNumber: id,
    customer,
    items,
    cookieCount: totalCookies(),
    total: price(),
    fulfillment: state.fulfillment,
    requestedDate: fd.get("requested_date"),
    notes: fd.get("notes").trim(),
    paymentStatus: "Awaiting confirmation",
    status: "New",
    serviceArea: PUBLIC_SERVICE_AREA,
    createdAt: serverTimestamp()
  };

  const itemLines = items.map(i => `${i.quantity} ${i.flavor}`).join("<br>");
  const plainItems = items.map(i => `${i.quantity} ${i.flavor}`).join(", ");
  const addressLine = `${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}`;

  // The Firebase Trigger Email extension watches the `mail` collection.
  // This keeps email credentials out of the public website source.
  const ownerMail = {
    to: [BUSINESS_EMAIL],
    message: {
      subject: `NEW ORDER ${id} — $${price().toFixed(2)}`,
      html: `<h2>New Zachary's Snackery Order</h2><p><strong>${escapeHtml(id)}</strong></p><p><strong>Customer:</strong> ${escapeHtml(customer.name)}<br><strong>Email:</strong> ${escapeHtml(customer.email)}<br><strong>Phone:</strong> ${escapeHtml(customer.phone)}</p><p><strong>Order:</strong><br>${itemLines}</p><p><strong>Total:</strong> $${price().toFixed(2)}<br><strong>Fulfillment:</strong> ${escapeHtml(state.fulfillment)}<br><strong>Address:</strong> ${escapeHtml(addressLine)}<br><strong>Requested date:</strong> ${escapeHtml(fd.get("requested_date"))}</p><p><strong>Notes:</strong> ${escapeHtml(fd.get("notes")) || "None"}</p><p><strong>Payment:</strong> Awaiting confirmation. Customer was told payment instructions will be sent after review.</p>`
    }
  };

  const customerMail = {
    to: [customer.email],
    message: {
      subject: `Zachary's Snackery — Order Received ${id}`,
      html: `<h2>Thanks for your order, ${escapeHtml(customer.name)}! 🍪</h2><p>We've received your order and will review it shortly.</p><p><strong>Order ${escapeHtml(id)}</strong><br>${itemLines}</p><p><strong>Total:</strong> $${price().toFixed(2)}<br><strong>Fulfillment:</strong> ${state.fulfillment === "shipping" ? "Shipping" : "Local delivery"}<br><strong>Requested date:</strong> ${escapeHtml(fd.get("requested_date"))}</p><h3>Payment</h3><p>You do not need to send payment yet. After your order is reviewed and confirmed, Zachary's Snackery will contact you with payment instructions. We accept Cash App, Venmo, and Zelle.</p>${state.fulfillment === "shipping" ? "<p>Shipping orders typically arrive 24–72 hours after shipment. Orders placed before the start of the week generally have the most efficient arrival time because shipments are sent early in the week.</p>" : ""}<p>— Zachary's Snackery</p>`
    }
  };

  const submit = $("submit-order");
  submit.disabled = true;
  submit.textContent = "Submitting…";

  try {
    const batch = writeBatch(db);
    batch.set(doc(collection(db, "orders")), order);
    batch.set(doc(collection(db, "mail")), ownerMail);
    batch.set(doc(collection(db, "mail")), customerMail);
    await batch.commit();
    sessionStorage.setItem("zs_last_order", JSON.stringify({ id, total: price(), items: plainItems, fulfillment: state.fulfillment }));
    window.location.href = `thank-you.html?order=${encodeURIComponent(id)}`;
  } catch (err) {
    console.error(err);
    status.className = "form-status error";
    status.textContent = "We couldn't submit your order. Nothing has been confirmed or charged. Please try again.";
    submit.disabled = false;
    submit.textContent = "Submit Order";
  }
});

render();
