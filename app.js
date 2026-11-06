// ==================== SHAWON AI ====================
// Real-time Private Messenger (PeerJS)

const STORAGE_KEY = "shawon_ai_chat";
const ROLE_KEY = "shawon_ai_role";
const ROOM_KEY = "shawon_ai_room";
const AI_KEY = "shawon_ai_enabled";

let currentRole = null;
let roomCode = "shawonlove";
let messages = [];
let aiEnabled = true;
let isAway = false;
let notificationPermission = false;

let peer = null;
let conn = null;
let isConnected = false;

document.addEventListener("DOMContentLoaded", () => {
  const savedRoom = localStorage.getItem(ROOM_KEY);
  if (savedRoom) document.getElementById("room-code").value = savedRoom;

  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      notificationPermission = true;
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(p => {
        notificationPermission = p === "granted";
      });
    }
  }

  aiEnabled = localStorage.getItem(AI_KEY) !== "false";

  document.addEventListener("visibilitychange", () => {
    isAway = document.hidden;
    updateStatusUI();
  });

  document.getElementById("chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    sendMessage();
  });

  document.getElementById("message-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
});

function selectRole(role) {
  currentRole = role;
  roomCode = (document.getElementById("room-code").value || "shawonlove")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!roomCode) roomCode = "shawonlove";

  localStorage.setItem(ROLE_KEY, role);
  localStorage.setItem(ROOM_KEY, roomCode);

  startChat();
  connectPeer();
}

function startChat() {
  document.getElementById("role-screen").classList.remove("active");
  document.getElementById("chat-screen").classList.add("active");

  if (currentRole === "shawon") {
    document.getElementById("partner-name").textContent = "Partner ❤️";
    document.getElementById("partner-avatar").textContent = "👩‍❤️‍👨";
  } else {
    document.getElementById("partner-name").textContent = "Shawon 💙";
    document.getElementById("partner-avatar").textContent = "👨‍💻";
  }

  loadMessages();
  renderMessages();
  updateAIButton();
  updateStatusUI();
  scrollToBottom();
}

function connectPeer() {
  const myId = currentRole === "shawon"
    ? `shawon-${roomCode}`
    : `premika-${roomCode}-${Date.now().toString(36)}`;

  peer = new Peer(myId, { debug: 0 });

  peer.on("open", () => {
    updateStatusUI("Connecting...");
    if (currentRole === "premika") {
      const hostId = `shawon-${roomCode}`;
      conn = peer.connect(hostId, { reliable: true });
      setupConnection(conn);
    }
  });

  peer.on("connection", (incoming) => {
    if (conn && conn.open) {
      incoming.close();
      return;
    }
    conn = incoming;
    setupConnection(conn);
  });

  peer.on("error", (err) => {
    if (err.type === "peer-unavailable") {
      updateStatusUI("Waiting for partner...");
      if (currentRole === "premika") {
        setTimeout(() => {
          if (!isConnected && peer && !peer.destroyed) {
            conn = peer.connect(`shawon-${roomCode}`, { reliable: true });
            setupConnection(conn);
          }
        }, 2800);
      }
    } else {
      updateStatusUI("Connection issue");
    }
  });

  peer.on("disconnected", () => {
    isConnected = false;
    updateStatusUI("Reconnecting...");
    setTimeout(() => {
      if (peer && !peer.destroyed) peer.reconnect();
    }, 2000);
  });
}

function setupConnection(c) {
  c.on("open", () => {
    isConnected = true;
    updateStatusUI();
    c.send({ type: "hello", role: currentRole });
  });

  c.on("data", (data) => {
    if (data.type === "message") receiveMessage(data.payload);
    else if (data.type === "typing") {
      showTyping(true);
      setTimeout(() => showTyping(false), 1800);
    }
  });

  c.on("close", () => {
    isConnected = false;
    updateStatusUI("Offline");
    if (currentRole === "premika" && peer && !peer.destroyed) {
      setTimeout(() => {
        conn = peer.connect(`shawon-${roomCode}`, { reliable: true });
        setupConnection(conn);
      }, 2500);
    }
  });

  c.on("error", () => {
    isConnected = false;
    updateStatusUI("Connection issue");
  });
}

function sendMessage() {
  const input = document.getElementById("message-input");
  const text = input.value.trim();
  if (!text) return;

  const msg = {
    id: Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    text,
    sender: currentRole,
    time: new Date().toISOString(),
    isAI: false
  };

  messages.push(msg);
  saveMessages();
  renderMessages();
  scrollToBottom();
  input.value = "";

  if (conn && conn.open) {
    conn.send({ type: "message", payload: msg });
  } else {
    updateStatusUI("Partner not connected");
  }

  if (aiEnabled && (currentRole === "premika" || isAway)) {
    setTimeout(() => aiReply(text), 900 + Math.random() * 1400);
  }
}

function receiveMessage(msg) {
  if (messages.find(m => m.id === msg.id)) return;
  messages.push(msg);
  saveMessages();
  renderMessages();
  scrollToBottom();

  if (document.hidden && notificationPermission) {
    const title = msg.sender === "shawon" ? "Shawon 💙" : "Partner ❤️";
    new Notification(title, {
      body: msg.text,
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💙</text></svg>",
      tag: "shawon-ai"
    });
  }
}

function aiReply(userText) {
  showTyping(true);
  setTimeout(() => {
    showTyping(false);
    const reply = generateAIReply(userText);
    const msg = {
      id: Date.now() + "-ai",
      text: reply,
      sender: currentRole === "premika" ? "shawon" : "premika",
      time: new Date().toISOString(),
      isAI: true
    };
    messages.push(msg);
    saveMessages();
    renderMessages();
    scrollToBottom();
    if (conn && conn.open) conn.send({ type: "message", payload: msg });
  }, 600 + Math.random() * 800);
}

function generateAIReply(text) {
  const lower = text.toLowerCase();
  if (/hello|hi|hey|assalam|আসসালাম|হ্যালো|হাই/.test(lower)) {
    return pick(["Hey 💙 How are you?", "Hi love ❤️ Missed you", "Hello 😘 What are you doing?"]);
  }
  if (/love|miss|ভালোবাসি|মনে|মিস/.test(lower)) {
    return pick(["I love you so much ❤️", "You mean everything to me 🥺", "Thinking about you all day 💙"]);
  }
  if (/how are|কেমন|কি খবর/.test(lower)) {
    return pick(["I'm good, especially now 😊 How about you?", "A bit busy earlier, happy to talk now 💙"]);
  }
  if (/night|good night|শুভ রাত্রি|ঘুম/.test(lower)) {
    return pick(["Good night 🌙 Sweet dreams", "Sleep well... I'll be here 💙"]);
  }
  return pick([
    "Hmm tell me more ❤️", "Really? 🥺", "I'm listening... 💙",
    "That made me smile 😊", "You're so cute 😍", "Miss you 🥺",
    "Keep talking like this ❤️", "Aww 💙"
  ]);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getStorage() {
  return currentRole === "shawon" ? localStorage : sessionStorage;
}

function loadMessages() {
  const raw = getStorage().getItem(STORAGE_KEY);
  messages = raw ? JSON.parse(raw) : [];
}

function saveMessages() {
  getStorage().setItem(STORAGE_KEY, JSON.stringify(messages));
}

function renderMessages() {
  const container = document.getElementById("messages");
  if (messages.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="big">💙</div>
        <div>No messages yet</div>
        <p>Say something sweet...</p>
      </div>`;
    return;
  }

  container.innerHTML = messages.map(m => {
    const isMe = m.sender === currentRole;
    return `
      <div class="message ${isMe ? "me" : "other"}">
        ${m.isAI ? '<span class="ai-tag">🤖 AI</span>' : ""}
        ${escapeHtml(m.text)}
        <span class="time">${formatTime(m.time)}</span>
      </div>`;
  }).join("");
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function scrollToBottom() {
  const el = document.getElementById("messages");
  setTimeout(() => { el.scrollTop = el.scrollHeight; }, 40);
}

function showTyping(show) {
  document.getElementById("typing").style.display = show ? "block" : "none";
  if (show) scrollToBottom();
}

function updateStatusUI(force = null) {
  const statusText = document.getElementById("status-text");
  const dot = document.getElementById("status-dot");
  if (!statusText) return;

  if (force) {
    statusText.textContent = force;
    dot.className = "dot";
    return;
  }

  if (isConnected) {
    statusText.textContent = isAway ? "Away" : "Online";
    dot.className = "dot " + (isAway ? "away" : "online");
  } else {
    statusText.textContent = "Waiting...";
    dot.className = "dot";
  }
}

function toggleEmoji() {
  const picker = document.getElementById("emoji-picker");
  picker.style.display = picker.style.display === "none" ? "grid" : "none";
}

function addEmoji(emoji) {
  const input = document.getElementById("message-input");
  input.value += emoji;
  input.focus();
  document.getElementById("emoji-picker").style.display = "none";
}

function toggleAI() {
  aiEnabled = !aiEnabled;
  localStorage.setItem(AI_KEY, aiEnabled);
  updateAIButton();
}

function updateAIButton() {
  const btn = document.getElementById("ai-btn");
  if (btn) {
    btn.classList.toggle("active", aiEnabled);
    btn.title = aiEnabled ? "AI On" : "AI Off";
  }
}

function exportChat() {
  if (messages.length === 0) {
    alert("No messages to export");
    return;
  }
  const text = messages.map(m => {
    const who = m.sender === "shawon" ? "Shawon" : "Partner";
    return `[${formatTime(m.time)}] ${who}${m.isAI ? " [AI]" : ""}: ${m.text}`;
  }).join("\n");

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `shawon-ai-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
}

function clearMyChat() {
  if (confirm("Clear all messages? This cannot be undone.")) {
    messages = [];
    saveMessages();
    renderMessages();
  }
}

document.addEventListener("click", (e) => {
  const picker = document.getElementById("emoji-picker");
  const btn = document.querySelector(".emoji-btn");
  if (picker && !picker.contains(e.target) && e.target !== btn) {
    picker.style.display = "none";
  }
});

// ========== STUDY MODE (HSC) ==========
const studyNotes = {
  physics: [
    {
      title: "Newton’s Laws of Motion",
      tag: "Chapter 3",
      body: "1st Law (Inertia): An object remains at rest or in uniform motion unless acted upon by an external force.\n2nd Law: F = ma\n3rd Law: For every action there is an equal and opposite reaction.",
      formula: "F = m × a",
      progress: 85
    },
    {
      title: "Work, Energy & Power",
      tag: "Chapter 4",
      body: "Work done W = F·s·cosθ. Kinetic Energy KE = ½mv². Potential Energy PE = mgh. Power P = W/t.",
      formula: "KE = ½ mv²",
      progress: 72
    },
    {
      title: "Circular Motion",
      tag: "Important",
      body: "Centripetal force Fc = mv²/r. Angular velocity ω = θ/t. Linear velocity v = rω.",
      formula: "Fc = mv² / r",
      progress: 60
    }
  ],
  chemistry: [
    {
      title: "Periodic Table Trends",
      tag: "Chapter 1",
      body: "Atomic radius decreases across a period, increases down a group. Electronegativity increases across a period. Ionization energy follows the same pattern.",
      formula: "Z_eff = Z − S",
      progress: 90
    },
    {
      title: "Chemical Bonding",
      tag: "Chapter 2",
      body: "Ionic bond: transfer of electrons. Covalent bond: sharing of electrons. Metallic bond: sea of electrons. VSEPR theory predicts molecular shape.",
      formula: "Octet Rule",
      progress: 78
    },
    {
      title: "Acid-Base Equilibrium",
      tag: "Chapter 5",
      body: "pH = −log[H⁺]. Strong acids fully dissociate. Buffer solutions resist pH change. Henderson-Hasselbalch equation is useful for buffers.",
      formula: "pH = pKa + log([A⁻]/[HA])",
      progress: 55
    }
  ],
  biology: [
    {
      title: "Cell Structure",
      tag: "Chapter 1",
      body: "Prokaryotic vs Eukaryotic cells. Mitochondria = powerhouse. Nucleus contains DNA. Ribosomes synthesize proteins. Plasma membrane is selectively permeable.",
      formula: "DNA → RNA → Protein",
      progress: 88
    },
    {
      title: "Photosynthesis",
      tag: "Chapter 4",
      body: "6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂. Light reaction in thylakoid. Dark reaction (Calvin cycle) in stroma. Chlorophyll absorbs light.",
      formula: "6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂",
      progress: 70
    },
    {
      title: "Human Digestive System",
      tag: "Chapter 6",
      body: "Mouth → Esophagus → Stomach → Small intestine → Large intestine. Enzymes: Amylase, Pepsin, Lipase, Trypsin. Absorption mainly in ileum.",
      formula: "Enzymes lower activation energy",
      progress: 65
    }
  ],
  math: [
    {
      title: "Differentiation",
      tag: "Calculus",
      body: "d/dx (xⁿ) = n xⁿ⁻¹. Product rule, Quotient rule, Chain rule. Applications: rate of change, maxima/minima.",
      formula: "d/dx (uv) = u dv/dx + v du/dx",
      progress: 75
    },
    {
      title: "Integration",
      tag: "Calculus",
      body: "∫ xⁿ dx = xⁿ⁺¹/(n+1) + C. Definite integrals give area under curve. Integration by parts and substitution are key techniques.",
      formula: "∫ u dv = uv − ∫ v du",
      progress: 58
    },
    {
      title: "Matrices & Determinants",
      tag: "Algebra",
      body: "Matrix multiplication is not commutative. Determinant of 2×2 and 3×3. Inverse of matrix using adjoint. Cramer’s rule for linear equations.",
      formula: "A⁻¹ = (1/|A|) adj(A)",
      progress: 80
    }
  ]
};

let studyTapCount = 0;
let studyTapTimer = null;

function enterStudyMode() {
  document.getElementById("chat-screen").classList.remove("active");
  document.getElementById("study-screen").classList.add("active");
  document.title = "HSC 2026 Prep";
  switchStudyTab(document.querySelector(".study-tab.active") || document.querySelector(".study-tab"));
  
  // Show secret hint briefly
  const hint = document.getElementById("secret-hint");
  hint.classList.add("show");
  setTimeout(() => hint.classList.remove("show"), 3500);
}

function exitStudyMode() {
  document.getElementById("study-screen").classList.remove("active");
  document.getElementById("chat-screen").classList.add("active");
  document.title = "Shawon AI";
  studyTapCount = 0;
}

function switchStudyTab(btn) {
  document.querySelectorAll(".study-tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  const tab = btn.dataset.tab;
  renderStudyNotes(tab);
}

function renderStudyNotes(subject) {
  const notes = studyNotes[subject] || [];
  const container = document.getElementById("study-content");
  container.innerHTML = notes.map(n => `
    <div class="note-card">
      <h3>${n.title} <span class="tag">${n.tag}</span></h3>
      <p>${n.body.replace(/\n/g, "<br>")}</p>
      <div class="formula">${n.formula}</div>
      <div class="progress-bar"><span style="width:${n.progress}%"></span></div>
    </div>
  `).join("");
}

// Triple tap progress ring to exit
document.addEventListener("DOMContentLoaded", () => {
  const ring = document.querySelector(".study-progress-ring");
  if (ring) {
    ring.addEventListener("click", () => {
      studyTapCount++;
      if (studyTapTimer) clearTimeout(studyTapTimer);
      studyTapTimer = setTimeout(() => { studyTapCount = 0; }, 900);
      if (studyTapCount >= 3) {
        exitStudyMode();
      }
    });
  }
});
