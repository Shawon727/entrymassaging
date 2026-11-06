// ==================== SHAWON AI ====================
// Real-time Private Messenger (PeerJS) + HSC 2027 Study Mode (BD)

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

  const savedRole = localStorage.getItem(ROLE_KEY);
  if (savedRole === "shawon" || savedRole === "premika") {
    currentRole = savedRole;
    roomCode = (localStorage.getItem(ROOM_KEY) || "shawonlove").toLowerCase();
    startChat();
    connectPeer();
  }
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
    document.getElementById("export-btn").style.display = "flex";
    document.getElementById("ai-btn").style.display = "flex";
  } else {
    document.getElementById("partner-name").textContent = "Shawon 💙";
    document.getElementById("partner-avatar").textContent = "👨‍💻";
    document.getElementById("export-btn").style.display = "none";
    document.getElementById("ai-btn").style.display = "none";
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
      conn = peer.connect(`shawon-${roomCode}`, { reliable: true });
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

// ========== STUDY MODE – HSC 2027 Bangladesh Science ==========
const studyNotes = {
  physics: [
    {
      title: "Newton’s Laws of Motion",
      tag: "Chapter 3",
      body: "1st Law (Inertia): A body remains at rest or continues in uniform motion in a straight line unless acted upon by an external unbalanced force.\n2nd Law: Rate of change of momentum is proportional to the applied force and takes place in the direction of force. F = ma.\n3rd Law: For every action there is an equal and opposite reaction. Action and reaction act on different bodies simultaneously.",
      formula: "F = ma  |  p = mv  |  Impulse = FΔt = Δp",
      progress: 90
    },
    {
      title: "Work, Energy & Power",
      tag: "Chapter 4",
      body: "Work done by constant force W = Fs cosθ. Kinetic Energy KE = ½mv². Gravitational PE = mgh. Work-Energy Theorem: Net work = ΔKE. Power P = W/t = Fv. 1 Horse Power = 746 Watt.",
      formula: "KE = ½mv²  |  PE = mgh  |  P = Fv",
      progress: 85
    },
    {
      title: "Circular Motion",
      tag: "Chapter 5",
      body: "Centripetal force Fc = mv²/r = mω²r directed towards centre. Angular velocity ω = 2π/T = 2πf. Linear velocity v = rω. Banking of roads: tanθ = v²/rg.",
      formula: "Fc = mv²/r  |  v = rω  |  ω = 2π/T",
      progress: 80
    },
    {
      title: "Gravitation",
      tag: "Chapter 6",
      body: "Newton’s law of gravitation F = GMm/r². Acceleration due to gravity g = GM/R². Variation of g with height and depth. Escape velocity ve = √(2gR) = √(2GM/R). Orbital velocity of satellite vo = √(GM/r).",
      formula: "F = GMm/r²  |  ve = √(2gR)  |  g = GM/R²",
      progress: 78
    },
    {
      title: "Simple Harmonic Motion",
      tag: "Chapter 10",
      body: "Acceleration a = −ω²x (towards mean position). Time period of spring-mass T = 2π√(m/k). Simple pendulum T = 2π√(l/g). Total energy of SHM is constant = ½kA².",
      formula: "T = 2π√(m/k)  |  T = 2π√(l/g)  |  a = −ω²x",
      progress: 75
    },
    {
      title: "Current Electricity",
      tag: "Part 2 – Ch 2",
      body: "Ohm’s law V = IR. Resistance R = ρl/A. Series: Req = R1+R2+… Parallel: 1/Req = 1/R1+1/R2+… Kirchhoff’s Current Law & Voltage Law. Power P = VI = I²R = V²/R. EMF and internal resistance.",
      formula: "V = IR  |  P = I²R  |  Req(series) = ΣR",
      progress: 82
    },
    {
      title: "Magnetic Effect of Current",
      tag: "Part 2 – Ch 3",
      body: "Biot-Savart law. Magnetic field due to long straight wire B = μ₀I/2πr. Centre of circular loop B = μ₀I/2r. Ampere’s circuital law. Force on current carrying conductor F = BIl sinθ. Lorentz force F = q(v × B).",
      formula: "B = μ₀I/2πr  |  F = BIl sinθ",
      progress: 70
    },
    {
      title: "Electromagnetic Induction",
      tag: "Part 2 – Ch 4",
      body: "Faraday’s laws. Induced EMF ε = −dφ/dt. Lenz’s law. Self inductance L and Mutual inductance M. Energy stored in inductor = ½LI². AC generator and transformer principles.",
      formula: "ε = −dφ/dt  |  ε = −L dI/dt",
      progress: 68
    }
  ],
  chemistry: [
    {
      title: "Atomic Structure",
      tag: "Chapter 1",
      body: "Atomic number Z = protons. Mass number A = protons + neutrons. Quantum numbers: principal (n), azimuthal (l), magnetic (m), spin (s). Aufbau principle, Pauli’s exclusion principle, Hund’s rule. Electronic configuration of elements up to atomic number 30 is important for HSC.",
      formula: "E = −13.6 Z²/n² eV  |  λ = h/mv (de Broglie)",
      progress: 92
    },
    {
      title: "Periodic Table & Periodicity",
      tag: "Chapter 2",
      body: "Modern periodic law: properties are periodic functions of atomic number. Periods and groups. Trends: Atomic radius decreases across a period, increases down a group. Ionization energy, Electron affinity, Electronegativity increase across a period.",
      formula: "Z_eff = Z − σ",
      progress: 88
    },
    {
      title: "Chemical Bonding",
      tag: "Chapter 3",
      body: "Ionic bond (electronegativity difference > 1.7), Covalent bond, Coordinate bond. VSEPR theory for molecular geometry. Hybridization: sp, sp², sp³, sp³d, sp³d². Molecular orbital theory (bonding & antibonding). Hydrogen bonding.",
      formula: "Bond Order = (N_b − N_a)/2",
      progress: 85
    },
    {
      title: "Chemical Kinetics",
      tag: "Chapter 4",
      body: "Rate of reaction = k [A]^m [B]^n. Order of reaction. Molecularity. Half-life of first order reaction t½ = 0.693/k. Arrhenius equation: k = Ae^(−Ea/RT). Effect of temperature and catalyst on rate.",
      formula: "t½ = 0.693/k  |  k = Ae^(−Ea/RT)",
      progress: 80
    },
    {
      title: "Chemical Equilibrium",
      tag: "Chapter 5",
      body: "Law of mass action. Equilibrium constant Kc and Kp. Relation: Kp = Kc(RT)^Δn. Le Chatelier’s principle – effect of concentration, pressure, temperature and catalyst. Application in Haber process and Contact process.",
      formula: "Kp = Kc (RT)^Δn",
      progress: 78
    },
    {
      title: "Acids, Bases & Salt",
      tag: "Chapter 6",
      body: "Arrhenius, Bronsted-Lowry and Lewis concepts. pH = −log[H⁺], pOH = −log[OH⁻], pH + pOH = 14. Buffer solution. Henderson-Hasselbalch equation. Acid-base titration and indicators. Hydrolysis of salts.",
      formula: "pH = −log[H⁺]  |  pH = pKa + log([salt]/[acid])",
      progress: 83
    },
    {
      title: "Organic Chemistry – Fundamentals",
      tag: "Chapter 8",
      body: "Hybridization of carbon (sp³, sp², sp). Homologous series. Functional groups. IUPAC nomenclature of alkanes, alkenes, alkynes, alcohols, aldehydes, ketones, carboxylic acids. Isomerism (structural & stereo). Inductive effect, Resonance, Hyperconjugation.",
      formula: "sp³ → 109.5°  |  sp² → 120°  |  sp → 180°",
      progress: 76
    },
    {
      title: "Hydrocarbons & Haloalkanes",
      tag: "Chapter 9",
      body: "Alkanes: preparation and properties. Alkenes: electrophilic addition. Alkynes: acidic hydrogen. Markovnikov’s rule and peroxide effect. Haloalkanes: nucleophilic substitution (SN1 & SN2). Preparation of chloroform and iodoform test.",
      formula: "Markovnikov’s Rule",
      progress: 72
    }
  ],
  biology: [
    {
      title: "Cell Structure & Function",
      tag: "Chapter 1",
      body: "Prokaryotic vs Eukaryotic cell. Plasma membrane – Fluid Mosaic Model (Singer & Nicolson). Cell wall (plant). Nucleus, Mitochondria (powerhouse), Chloroplast, Endoplasmic reticulum, Golgi apparatus, Ribosome (70S & 80S), Lysosome. Cell division: Mitosis and Meiosis.",
      formula: "DNA → RNA → Protein (Central Dogma)",
      progress: 94
    },
    {
      title: "Photosynthesis",
      tag: "Chapter 4",
      body: "Overall reaction: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂. Light reaction (Hill reaction) in thylakoid: photolysis of water, ATP & NADPH formation. Dark reaction (Calvin cycle) in stroma. C3 and C4 plants. Factors affecting photosynthesis.",
      formula: "6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂",
      progress: 88
    },
    {
      title: "Respiration",
      tag: "Chapter 5",
      body: "Glycolysis (cytoplasm) – glucose to pyruvate. Krebs cycle (mitochondrial matrix). Electron Transport Chain (inner membrane) – oxidative phosphorylation. Aerobic respiration yields 36-38 ATP. Anaerobic respiration (fermentation) yields only 2 ATP.",
      formula: "C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + Energy",
      progress: 85
    },
    {
      title: "Human Digestion",
      tag: "Chapter 6",
      body: "Digestive organs and glands. Enzymes: Salivary amylase, Pepsin, Trypsin, Chymotrypsin, Lipase, Pancreatic amylase, Sucrase, Lactase, Maltase. Absorption of nutrients in small intestine (villi & microvilli). Role of liver and pancreas.",
      formula: "Enzymes lower activation energy",
      progress: 82
    },
    {
      title: "Circulation & Heart",
      tag: "Chapter 7",
      body: "Structure of human heart (4 chambers). Double circulation (systemic + pulmonary). Cardiac cycle. SA node (pacemaker), AV node, Bundle of His, Purkinje fibres. Blood pressure (systolic/diastolic). Blood groups (ABO & Rh).",
      formula: "Cardiac Output = Stroke Volume × Heart Rate",
      progress: 80
    },
    {
      title: "Genetics",
      tag: "Chapter 9",
      body: "Mendel’s laws: Law of Dominance, Segregation, Independent Assortment. Monohybrid cross (3:1), Dihybrid cross (9:3:3:1). Incomplete dominance, Co-dominance. Sex determination (XX-XY). DNA structure (Watson-Crick model). Replication, Transcription, Translation.",
      formula: "Phenotypic ratio (monohybrid) = 3 : 1",
      progress: 78
    },
    {
      title: "Evolution",
      tag: "Chapter 10",
      body: "Darwin’s theory of natural selection. Evidence of evolution: palaeontological, comparative anatomy (homologous & analogous organs), embryological, molecular. Hardy-Weinberg principle. Speciation.",
      formula: "p² + 2pq + q² = 1 (Hardy-Weinberg)",
      progress: 72
    },
    {
      title: "Ecology & Environment",
      tag: "Chapter 13",
      body: "Ecosystem components (biotic & abiotic). Food chain, food web, ecological pyramid. Energy flow (10% law). Biogeochemical cycles (Carbon, Nitrogen, Water). Biodiversity. Pollution (air, water, soil). Greenhouse effect, Global warming, Ozone depletion. Conservation of nature.",
      formula: "10% Law of energy transfer",
      progress: 75
    }
  ],
  math: [
    {
      title: "Differentiation",
      tag: "Calculus",
      body: "d/dx (xⁿ) = nxⁿ⁻¹. Product rule, Quotient rule, Chain rule. Differentiation of trigonometric, inverse trigonometric, exponential and logarithmic functions. Successive differentiation. Applications: rate of change, maxima-minima, tangent-normal.",
      formula: "d/dx (uv) = u dv + v du  |  d/dx (sin x) = cos x",
      progress: 88
    },
    {
      title: "Integration",
      tag: "Calculus",
      body: "Standard integrals. Integration by substitution, by parts, by partial fractions. Definite integral as limit of sum and as area under curve. Properties of definite integrals. Application in finding area and volume.",
      formula: "∫ u dv = uv − ∫ v du  |  ∫ eˣ dx = eˣ + C",
      progress: 82
    },
    {
      title: "Matrices",
      tag: "Algebra",
      body: "Types of matrices. Addition, multiplication (not commutative). Transpose, adjoint, inverse. Singular and non-singular matrix. Solution of system of linear equations by matrix method and Cramer’s rule.",
      formula: "A⁻¹ = (1/|A|) adj(A)  |  |A| ≠ 0 for inverse",
      progress: 85
    },
    {
      title: "Determinants",
      tag: "Algebra",
      body: "Determinant of order 2 and 3. Properties of determinants. Minors and cofactors. Application in solving linear equations (Cramer’s rule). Area of triangle using determinants.",
      formula: "Area = ½ |x₁(y₂−y₃) + x₂(y₃−y₁) + x₃(y₁−y₂)|",
      progress: 80
    },
    {
      title: "Probability",
      tag: "Statistics",
      body: "Classical definition. Addition theorem, Multiplication theorem. Conditional probability. Independent events. Bayes’ theorem. Random variable. Binomial distribution.",
      formula: "P(A∪B) = P(A)+P(B)−P(A∩B)  |  P(A|B) = P(A∩B)/P(B)",
      progress: 78
    },
    {
      title: "Statistics",
      tag: "Statistics",
      body: "Measures of central tendency: Mean, Median, Mode. Measures of dispersion: Range, Variance, Standard Deviation. Coefficient of variation. Correlation (Karl Pearson).",
      formula: "σ = √[Σ(x−x̄)²/n]  |  CV = (σ/x̄)×100%",
      progress: 75
    },
    {
      title: "Vectors",
      tag: "Geometry",
      body: "Vector addition (triangle & parallelogram law). Position vector. Dot product a·b = |a||b|cosθ. Cross product a×b. Scalar triple product. Application in geometry and physics.",
      formula: "a·b = |a||b|cosθ  |  |a×b| = |a||b|sinθ",
      progress: 72
    },
    {
      title: "3D Geometry",
      tag: "Geometry",
      body: "Direction cosines and direction ratios. Equation of a straight line in space. Equation of a plane. Angle between two planes, two lines, line and plane. Shortest distance between two skew lines. Coplanarity of lines.",
      formula: "Direction cosines: l² + m² + n² = 1",
      progress: 68
    }
  ]
};

let studyTapCount = 0;
let studyTapTimer = null;

function enterStudyMode() {
  document.getElementById("chat-screen").classList.remove("active");
  document.getElementById("study-screen").classList.add("active");
  document.title = "HSC 2027 Prep";
  const activeTab = document.querySelector(".study-tab.active") || document.querySelector(".study-tab");
  switchStudyTab(activeTab);

  const hint = document.getElementById("secret-hint");
  if (hint) {
    hint.classList.add("show");
    setTimeout(() => hint.classList.remove("show"), 4000);
  }
}

function exitStudyMode() {
  document.getElementById("study-screen").classList.remove("active");
  document.getElementById("chat-screen").classList.add("active");
  document.title = "Shawon AI";
  studyTapCount = 0;
}

function switchStudyTab(btn) {
  if (!btn) return;
  document.querySelectorAll(".study-tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  renderStudyNotes(btn.dataset.tab);
}

function renderStudyNotes(subject) {
  const notes = studyNotes[subject] || [];
  const container = document.getElementById("study-content");
  if (!container) return;
  container.innerHTML = notes.map(n => `
    <div class="note-card">
      <h3>${n.title} <span class="tag">${n.tag}</span></h3>
      <p>${n.body.replace(/\n/g, "<br>")}</p>
      <div class="formula">${n.formula}</div>
      <div class="progress-bar"><span style="width:${n.progress}%"></span></div>
    </div>
  `).join("");
}

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
