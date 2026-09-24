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
  // Current rules supplied by Zachary's Snackery:
  // local = $14/dozen; shipping = $25/20-cookie shipping box.
  return state.fulfillment === "shipping" ? state.shippingBoxes * 25 : state.localDozens * 14;
}

function allowedMixCount() {
  return state.fulfillment === "shipping" ? state.shipMix : state.localMix;
}

function splitQuantities() {
  const total = totalCookies();
  const mix = allowedMixCount();
  const active = flavorKeys.slice(0, mix);
  const next = { snickerdoodle: 0, crinkle: 0, gingersnap: 0 };

  if (mix === 1) {
    next[active[0]] = total;
  } else if (mix === 2) {
    // Two-flavor orders use 6-cookie increments. Start as evenly as possible.
    const units = Math.floor(total / 6);
    const a = Math.ceil(units / 2) * 6;
    const b = total - a;
    if (b >= 6 && b % 6 === 0) {
      next[active[0]] = a;
      next[active[1]] = b;
    } else {
      // A total that cannot be represented by two 6-cookie increments cannot use 2-flavor mix.
      return null;
    }
  } else {
    // Three-flavor orders use 4-cookie increments.
    const units = Math.floor(total / 4);
    if (total % 4 !== 0 || units < 3) return null;
    const base = Math.floor(units / 3);
    const rem = units % 3;
    active.forEach((k, i) => next[k] = (base + (i < rem ? 1 : 0)) * 4);
  }
  return next;
}

function validMixOptions() {
  const total = totalCookies();
  return {
    1: true,
    2: total >= 12 && total % 6 === 0,
    3: total >= 12 && total % 4 === 0
  };
}

function setDefaultMix() {
  const options = validMixOptions();
  const key = state.fulfillment === "shipping" ? "shipMix" : "localMix";
  if (!options[state[key]]) state[key] = 1;
  const split = splitQuantities();
  if (split) state.flavors = split;
}

function renderFlavorControls() {
  const total = totalCookies();
  const mix = allowedMixCount();
  const increment = mix === 2 ? 6 : mix === 3 ? 4 : total;
  const wrap = $("flavor-controls");
  wrap.innerHTML = "";

  flavorKeys.forEach((key) => {
    const qty = state.flavors[key] || 0;
    const row = document.createElement("div");
    row.className = `flavor-row ${qty ? "selected" : ""}`;
    row.innerHTML = `
      <div><strong>${flavorNames[key]}</strong><span>${qty ? `${qty} cookies` : "Not selected"}</span></div>
      <div class="qty-control">
        <button type="button" class="qty-btn" data-action="minus" data-flavor="${key}" ${mix === 1 || !qty ? "disabled" : ""}>−</button>
        <span>${qty}</span>
        <button type="button" class="qty-btn" data-action="plus" data-flavor="${key}" ${mix === 1 || !qty ? "disabled" : ""}>+</button>
      </div>`;
    wrap.appendChild(row);
  });

  wrap.querySelectorAll(".qty-btn").forEach(btn => btn.addEventListener("click", () => {
    const key = btn.dataset.flavor;
    const active = flavorKeys.filter(k => state.flavors[k] > 0);
    if (active.length <= 1) return;
    const other = active.find(k => k !== key && state.flavors[k] >= increment * 2);
    if (btn.dataset.action === "plus") {
      if (!other) return;
      state.flavors[key] += increment;
      state.flavors[other] -= increment;
    } else {
      if (state.flavors[key] <= increment) return;
      const receiver = active.find(k => k !== key);
      state.flavors[key] -= increment;
      state.flavors[receiver] += increment;
    }
    render();
  }));
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
  $("mix-help").textContent = allowedMixCount() === 1
    ? "All cookies will be one flavor."
    : allowedMixCount() === 2
      ? "Two flavors are divided in 6-cookie increments."
      : "Three flavors are divided in 4-cookie increments.";

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
  const split = splitQuantities();
  if (split) state.flavors = split;
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
