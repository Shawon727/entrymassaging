// Shawon AI – Real-time + HSC 2027 BD + Media
const STORAGE_KEY="shawon_ai_chat", ROLE_KEY="shawon_ai_role", ROOM_KEY="shawon_ai_room", AI_KEY="shawon_ai_enabled";
let currentRole=null, roomCode="shawonlove", messages=[], aiEnabled=true, isAway=false, notificationPermission=false;
let peer=null, conn=null, isConnected=false, pendingMedia=null;

document.addEventListener("DOMContentLoaded",()=>{
  const sr=localStorage.getItem(ROOM_KEY);
  if(sr) document.getElementById("room-code").value=sr;
  if("Notification" in window){
    if(Notification.permission==="granted") notificationPermission=true;
    else if(Notification.permission!=="denied") Notification.requestPermission().then(p=>notificationPermission=p==="granted");
  }
  aiEnabled=localStorage.getItem(AI_KEY)!=="false";
  document.addEventListener("visibilitychange",()=>{isAway=document.hidden;updateStatusUI()});
  document.getElementById("chat-form").addEventListener("submit",e=>{e.preventDefault();sendMessage()});
  document.getElementById("message-input").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage()}});
  document.getElementById("media-input").addEventListener("change",handleMediaSelect);
  const saved=localStorage.getItem(ROLE_KEY);
  if(saved==="shawon"||saved==="premika"){currentRole=saved;roomCode=(localStorage.getItem(ROOM_KEY)||"shawonlove").toLowerCase();startChat();connectPeer()}
});

function enterWithCode(){
  const code=(document.getElementById("access-code").value||"").trim();
  roomCode=(document.getElementById("room-code").value||"shawonlove").trim().toLowerCase().replace(/[^a-z0-9]/g,"");
  if(!roomCode) roomCode="shawonlove";
  if(code==="100"){selectRole("shawon")}
  else if(code==="02"){selectRole("premika")}
  else{alert("Wrong code.\n100 = Shawon\n02 = Partner");return}
}

function selectRole(role){
  currentRole=role;
  localStorage.setItem(ROLE_KEY,role);
  localStorage.setItem(ROOM_KEY,roomCode);
  startChat();connectPeer();
}

function startChat(){
  document.getElementById("role-screen").classList.remove("active");
  document.getElementById("chat-screen").classList.add("active");
  if(currentRole==="shawon"){
    document.getElementById("partner-name").textContent="Partner ❤️";
    document.getElementById("partner-avatar").textContent="👩‍❤️‍👨";
    document.getElementById("export-btn").style.display="flex";
    document.getElementById("ai-btn").style.display="flex";
  }else{
    document.getElementById("partner-name").textContent="Shawon 💙";
    document.getElementById("partner-avatar").textContent="👨‍💻";
    document.getElementById("export-btn").style.display="none";
    document.getElementById("ai-btn").style.display="none";
  }
  loadMessages();renderMessages();updateAIButton();updateStatusUI();scrollToBottom();
}

function connectPeer(){
  const myId=currentRole==="shawon"?`shawon-${roomCode}`:`premika-${roomCode}-${Date.now().toString(36)}`;
  peer=new Peer(myId,{debug:0});
  peer.on("open",()=>{
    updateStatusUI("Connecting...");
    if(currentRole==="premika"){conn=peer.connect(`shawon-${roomCode}`,{reliable:true});setupConnection(conn)}
  });
  peer.on("connection",inc=>{if(conn&&conn.open){inc.close();return}conn=inc;setupConnection(conn)});
  peer.on("error",err=>{
    if(err.type==="peer-unavailable"){
      updateStatusUI("Waiting for partner...");
      if(currentRole==="premika") setTimeout(()=>{if(!isConnected&&peer&&!peer.destroyed){conn=peer.connect(`shawon-${roomCode}`,{reliable:true});setupConnection(conn)}},2800);
    } else updateStatusUI("Connection issue");
  });
  peer.on("disconnected",()=>{isConnected=false;updateStatusUI("Reconnecting...");setTimeout(()=>{if(peer&&!peer.destroyed)peer.reconnect()},2000)});
}

function setupConnection(c){
  c.on("open",()=>{isConnected=true;updateStatusUI();c.send({type:"hello",role:currentRole})});
  c.on("data",data=>{
    if(data.type==="message") receiveMessage(data.payload);
    else if(data.type==="typing"){showTyping(true);setTimeout(()=>showTyping(false),1800)}
  });
  c.on("close",()=>{
    isConnected=false;updateStatusUI("Offline");
    if(currentRole==="premika"&&peer&&!peer.destroyed) setTimeout(()=>{conn=peer.connect(`shawon-${roomCode}`,{reliable:true});setupConnection(conn)},2500);
  });
  c.on("error",()=>{isConnected=false;updateStatusUI("Connection issue")});
}

function handleMediaSelect(e){
  const file=e.target.files[0];
  if(!file) return;
  if(file.size>2.5*1024*1024){alert("File too large. Max ~2.5 MB");e.target.value="";return}
  const reader=new FileReader();
  reader.onload=()=>{
    pendingMedia={data:reader.result,type:file.type.startsWith("video")?"video":"image",name:file.name};
    const prev=document.getElementById("media-preview");
    const img=document.getElementById("preview-img");
    img.src=pendingMedia.type==="image"?pendingMedia.data:"";
    prev.style.display="flex";
    if(pendingMedia.type==="video") img.alt="Video selected";
  };
  reader.readAsDataURL(file);
  e.target.value="";
}

function removeMedia(){
  pendingMedia=null;
  document.getElementById("media-preview").style.display="none";
  document.getElementById("preview-img").src="";
}

function sendMessage(){
  const input=document.getElementById("message-input");
  const text=input.value.trim();
  if(!text&&!pendingMedia) return;
  const msg={
    id:Date.now()+"-"+Math.random().toString(36).slice(2,7),
    text:text||"",
    sender:currentRole,
    time:new Date().toISOString(),
    isAI:false,
    media:pendingMedia?{data:pendingMedia.data,type:pendingMedia.type}:null
  };
  messages.push(msg);saveMessages();renderMessages();scrollToBottom();
  input.value="";removeMedia();
  if(conn&&conn.open) conn.send({type:"message",payload:msg});
  else updateStatusUI("Partner not connected");
  if(aiEnabled&&(currentRole==="premika"||isAway)&&text) setTimeout(()=>aiReply(text),900+Math.random()*1400);
}

function receiveMessage(msg){
  if(messages.find(m=>m.id===msg.id)) return;
  messages.push(msg);saveMessages();renderMessages();scrollToBottom();
  if(document.hidden&&notificationPermission){
    const title=msg.sender==="shawon"?"Shawon 💙":"Partner ❤️";
    new Notification(title,{body:msg.text||(msg.media?"📷 Media":""),tag:"shawon-ai"});
  }
}

function aiReply(userText){
  showTyping(true);
  setTimeout(()=>{
    showTyping(false);
    const reply=generateAIReply(userText);
    const msg={id:Date.now()+"-ai",text:reply,sender:currentRole==="premika"?"shawon":"premika",time:new Date().toISOString(),isAI:true};
    messages.push(msg);saveMessages();renderMessages();scrollToBottom();
    if(conn&&conn.open) conn.send({type:"message",payload:msg});
  },600+Math.random()*800);
}

function generateAIReply(text){
  const t=text.toLowerCase();
  // Study help
  if(/newton|force|inertia|f\s*=\s*ma/.test(t)) return "Newton 2nd law: F = ma. Force equals mass times acceleration. Unit is Newton (N).";
  if(/kinetic|potential|energy|½mv|mgh/.test(t)) return "KE = ½mv², PE = mgh. Work-energy theorem: net work = change in KE.";
  if(/ohm|resistance|current|voltage|v\s*=\s*ir/.test(t)) return "Ohm's law: V = IR. Power P = VI = I²R = V²/R.";
  if(/photosynthesis|calvin|chlorophyll/.test(t)) return "Photosynthesis: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂. Light reaction in thylakoid, Calvin cycle in stroma.";
  if(/mitosis|meiosis|cell division/.test(t)) return "Mitosis: 2 identical diploid cells. Meiosis: 4 haploid gametes. Crossing over in prophase I.";
  if(/differentiate|d\/dx|derivative/.test(t)) return "d/dx(xⁿ)=nxⁿ⁻¹. Product rule, chain rule important. Practice maxima-minima problems.";
  if(/integrate|∫|integration/.test(t)) return "∫xⁿ dx = xⁿ⁺¹/(n+1)+C. Learn substitution and by-parts well for HSC.";
  if(/hello|hi|hey|assalam|আসসালাম|হ্যালো|হাই/.test(t)) return pick(["Hey 💙 How are you?","Hi love ❤️ Missed you","Hello 😘 What are you doing?"]);
  if(/love|miss|ভালোবাসি|মনে|মিস/.test(t)) return pick(["I love you so much ❤️","You mean everything to me 🥺","Thinking about you all day 💙"]);
  if(/how are|কেমন|কি খবর/.test(t)) return pick(["I'm good, especially now 😊 How about you?","Happy to talk with you 💙"]);
  if(/night|good night|শুভ রাত্রি|ঘুম/.test(t)) return pick(["Good night 🌙 Sweet dreams","Sleep well... I'll be here 💙"]);
  if(/exam|hsc|পড়|পড়া|study|পরীক্ষা/.test(t)) return pick(["You can do it! Focus on formulas + past papers 📚","Study smart. I'm proud of you 💙","Take short breaks, stay consistent."]);
  return pick(["Hmm tell me more ❤️","Really? 🥺","I'm listening... 💙","That made me smile 😊","You're so cute 😍","Miss you 🥺","Keep talking ❤️","Aww 💙"]);
}
function pick(a){return a[Math.floor(Math.random()*a.length)]}

function getStorage(){return currentRole==="shawon"?localStorage:sessionStorage}
function loadMessages(){const r=getStorage().getItem(STORAGE_KEY);messages=r?JSON.parse(r):[]}
function saveMessages(){getStorage().setItem(STORAGE_KEY,JSON.stringify(messages))}

function renderMessages(){
  const c=document.getElementById("messages");
  if(!messages.length){c.innerHTML=`<div class="empty-state"><div class="big">💙</div><div>No messages yet</div><p>Say something sweet...</p></div>`;return}
  c.innerHTML=messages.map(m=>{
    const isMe=m.sender===currentRole;
    let mediaHtml="";
    if(m.media){
      if(m.media.type==="image") mediaHtml=`<img class="media-img" src="${m.media.data}" alt="img" onclick="window.open(this.src)"/>`;
      else if(m.media.type==="video") mediaHtml=`<video class="media-video" src="${m.media.data}" controls playsinline></video>`;
    }
    return `<div class="message ${isMe?"me":"other"}">${m.isAI?'<span class="ai-tag">🤖 AI</span>':""}${mediaHtml}${escapeHtml(m.text||"")}<span class="time">${formatTime(m.time)}</span></div>`;
  }).join("");
}
function formatTime(iso){return new Date(iso).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
function escapeHtml(t){const d=document.createElement("div");d.textContent=t;return d.innerHTML}
function scrollToBottom(){const el=document.getElementById("messages");setTimeout(()=>el.scrollTop=el.scrollHeight,40)}
function showTyping(s){document.getElementById("typing").style.display=s?"block":"none";if(s)scrollToBottom()}
function updateStatusUI(force=null){
  const st=document.getElementById("status-text"),dot=document.getElementById("status-dot");
  if(!st) return;
  if(force){st.textContent=force;dot.className="dot";return}
  if(isConnected){st.textContent=isAway?"Away":"Online";dot.className="dot "+(isAway?"away":"online")}
  else{st.textContent="Waiting...";dot.className="dot"}
}
function toggleEmoji(){const p=document.getElementById("emoji-picker");p.style.display=p.style.display==="none"?"grid":"none"}
function addEmoji(e){const i=document.getElementById("message-input");i.value+=e;i.focus();document.getElementById("emoji-picker").style.display="none"}
function toggleAI(){aiEnabled=!aiEnabled;localStorage.setItem(AI_KEY,aiEnabled);updateAIButton()}
function updateAIButton(){const b=document.getElementById("ai-btn");if(b){b.classList.toggle("active",aiEnabled);b.title=aiEnabled?"AI On":"AI Off"}}
function exportChat(){
  if(!messages.length){alert("No messages");return}
  const text=messages.map(m=>`[${formatTime(m.time)}] ${m.sender==="shawon"?"Shawon":"Partner"}${m.isAI?" [AI]":""}: ${m.text||"[media]"}`).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"text/plain"}));a.download=`shawon-ai-${new Date().toISOString().slice(0,10)}.txt`;a.click();
}
function clearMyChat(){if(confirm("Clear all messages?")){messages=[];saveMessages();renderMessages()}}
document.addEventListener("click",e=>{
  const p=document.getElementById("emoji-picker"),b=document.querySelector(".emoji-btn");
  if(p&&!p.contains(e.target)&&e.target!==b) p.style.display="none";
});

// ===== STUDY NOTES HSC 2027 BD (expanded) =====
const studyNotes={
physics:[
{title:"Newton’s Laws of Motion",tag:"Ch 3",body:"1st Law: A body remains at rest or in uniform motion unless acted by external unbalanced force (Inertia).\n2nd Law: F = ma. Rate of change of momentum proportional to force.\n3rd Law: Action-reaction equal, opposite, act on different bodies.",formula:"F = ma  |  p = mv  |  Impulse = Δp = FΔt",progress:92},
{title:"Work, Energy & Power",tag:"Ch 4",body:"W = Fs cosθ. KE = ½mv². PE = mgh. Work-Energy theorem: net work = ΔKE. Power P = W/t = Fv. 1 HP = 746 W. Conservation of mechanical energy when only conservative forces act.",formula:"KE = ½mv²  |  PE = mgh  |  P = Fv",progress:88},
{title:"Circular Motion",tag:"Ch 5",body:"Centripetal force towards centre Fc = mv²/r = mω²r. ω = 2π/T. v = rω. Banking of road: tanθ = v²/rg. Centrifugal force is pseudo force in rotating frame.",formula:"Fc = mv²/r  |  v = rω  |  ω = 2π/T",progress:84},
{title:"Gravitation",tag:"Ch 6",body:"F = GMm/r². g = GM/R². Variation of g with height & depth. Escape velocity ve = √(2gR). Orbital velocity √(GM/r). Kepler’s laws. Satellite period T = 2π√(r³/GM).",formula:"F = GMm/r²  |  ve = √(2gR)  |  g = GM/R²",progress:80},
{title:"Simple Harmonic Motion",tag:"Ch 10",body:"a = −ω²x. T (spring) = 2π√(m/k). T (pendulum) = 2π√(l/g). Total energy = ½kA² constant. Phase, amplitude, frequency important for board.",formula:"T = 2π√(m/k)  |  T = 2π√(l/g)  |  a = −ω²x",progress:78},
{title:"Current Electricity",tag:"Part2 Ch2",body:"V = IR. R = ρl/A. Series & parallel combinations. Kirchhoff’s laws. Power P = VI = I²R = V²/R. EMF, internal resistance, potentiometer principle.",formula:"V = IR  |  P = I²R  |  Req(series) = ΣR",progress:85},
{title:"Magnetic Effect of Current",tag:"Part2 Ch3",body:"Biot-Savart. Long wire B = μ₀I/(2πr). Loop centre B = μ₀I/(2r). Ampere’s law. Force on conductor F = BIl sinθ. Lorentz force. Moving coil galvanometer.",formula:"B = μ₀I/2πr  |  F = BIl sinθ",progress:74},
{title:"Electromagnetic Induction",tag:"Part2 Ch4",body:"Faraday: ε = −dφ/dt. Lenz’s law. Self & mutual inductance. Energy in inductor ½LI². AC generator, transformer (Ns/Np = Vs/Vp = Is/Ip inverse).",formula:"ε = −dφ/dt  |  ε = −L dI/dt",progress:72}
],
chemistry:[
{title:"Atomic Structure",tag:"Ch 1",body:"Z = protons, A = p+n. Quantum numbers n,l,m,s. Aufbau, Pauli, Hund. Electronic configuration important up to Z=30. de Broglie λ = h/mv. Bohr model limitations.",formula:"E = −13.6 Z²/n² eV  |  λ = h/mv",progress:93},
{title:"Periodic Table",tag:"Ch 2",body:"Modern periodic law based on atomic number. Trends: atomic radius ↓ across period, ↑ down group. IE, EA, EN increase across period. Diagonal relationship, anomalous behaviour of 2nd period.",formula:"Z_eff = Z − σ",progress:90},
{title:"Chemical Bonding",tag:"Ch 3",body:"Ionic, covalent, coordinate. VSEPR shapes. Hybridization sp, sp², sp³, sp³d, sp³d². MOT for O₂, N₂. H-bonding, van der Waals. Bond order = (Nb−Na)/2.",formula:"Bond Order = (Nb − Na)/2",progress:87},
{title:"Chemical Kinetics",tag:"Ch 4",body:"Rate = k[A]^m[B]^n. Order vs molecularity. t½ first order = 0.693/k. Arrhenius k = Ae^(−Ea/RT). Catalyst lowers activation energy. Effect of temperature.",formula:"t½ = 0.693/k  |  k = Ae^(−Ea/RT)",progress:82},
{title:"Chemical Equilibrium",tag:"Ch 5",body:"Kc, Kp. Kp = Kc(RT)^Δn. Le Chatelier’s principle. Haber & Contact process applications. Relation between Kp, Kc and degree of dissociation.",formula:"Kp = Kc(RT)^Δn",progress:80},
{title:"Acids Bases & pH",tag:"Ch 6",body:"Arrhenius, Bronsted-Lowry, Lewis. pH = −log[H⁺]. Buffer & Henderson-Hasselbalch. Salt hydrolysis. Acid-base titration curves & indicators.",formula:"pH = −log[H⁺]  |  pH = pKa + log([A⁻]/[HA])",progress:85},
{title:"Organic Fundamentals",tag:"Ch 8",body:"sp³, sp², sp hybridization. Homologous series. Functional groups. IUPAC naming. Structural & stereo isomerism. Inductive, resonance, hyperconjugation effects.",formula:"sp³ 109.5° | sp² 120° | sp 180°",progress:79},
{title:"Hydrocarbons & Haloalkanes",tag:"Ch 9",body:"Alkanes, alkenes (Markovnikov, peroxide effect), alkynes. Electrophilic addition. SN1 & SN2 of haloalkanes. Iodoform test. Preparation of CHCl₃.",formula:"Markovnikov’s Rule",progress:75}
],
biology:[
{title:"Cell Biology",tag:"Ch 1-2",body:"Prokaryote vs Eukaryote. Fluid mosaic model. Mitochondria, chloroplast, ER, Golgi, ribosome (70S/80S), lysosome. Mitosis (equational) & Meiosis (reductional). Crossing over in prophase I.",formula:"DNA → RNA → Protein",progress:95},
{title:"Photosynthesis",tag:"Ch 4",body:"6CO₂+6H₂O→C₆H₁₂O₆+6O₂. Light reaction (thylakoid): ATP, NADPH, O₂. Calvin cycle (stroma). C3 vs C4 plants. Factors: light, CO₂, temperature, water.",formula:"6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂",progress:90},
{title:"Respiration",tag:"Ch 5",body:"Glycolysis → pyruvate. Krebs cycle (matrix). ETC & oxidative phosphorylation (inner membrane). Aerobic ~36-38 ATP. Anaerobic (fermentation) only 2 ATP.",formula:"C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + Energy",progress:87},
{title:"Human Digestion",tag:"Ch 6",body:"Enzymes: amylase, pepsin, trypsin, lipase etc. Absorption in small intestine (villi). Liver (bile), pancreas (enzymes + hormones). Role of large intestine.",formula:"Enzymes lower activation energy",progress:84},
{title:"Circulation",tag:"Ch 7",body:"4-chambered heart. Double circulation. SA node pacemaker. Cardiac cycle. BP systolic/diastolic. ABO & Rh blood groups. Lymphatic system basics.",formula:"CO = Stroke Volume × Heart Rate",progress:82},
{title:"Genetics",tag:"Ch 9",body:"Mendel’s laws. Monohybrid 3:1, Dihybrid 9:3:3:1. Incomplete dominance, codominance. Sex determination XX-XY. DNA structure, replication, transcription, translation.",formula:"Monohybrid phenotypic ratio 3:1",progress:80},
{title:"Evolution",tag:"Ch 10",body:"Darwin natural selection. Evidences: fossils, homologous/analogous organs, embryology, molecular. Hardy-Weinberg. Speciation.",formula:"p² + 2pq + q² = 1",progress:74},
{title:"Ecology",tag:"Ch 13",body:"Ecosystem, food chain/web, ecological pyramid, 10% law. Biogeochemical cycles. Biodiversity. Pollution, greenhouse effect, ozone depletion. Conservation.",formula:"10% Law of energy transfer",progress:76}
],
math:[
{title:"Differentiation",tag:"Calculus",body:"d/dx(xⁿ)=nxⁿ⁻¹. Product, quotient, chain rules. Trig, exp, log derivatives. Successive differentiation. Applications: rate, maxima-minima, tangent-normal.",formula:"(uv)' = u'v + uv'  |  (sin x)' = cos x",progress:90},
{title:"Integration",tag:"Calculus",body:"Standard forms. Substitution, by parts, partial fractions. Definite integrals & properties. Area under curve. Important for board numerical problems.",formula:"∫udv = uv − ∫vdu  |  ∫eˣdx = eˣ+C",progress:85},
{title:"Matrices",tag:"Algebra",body:"Types, operations. Multiplication not commutative. Transpose, adjoint, inverse. Solving linear equations by matrix method.",formula:"A⁻¹ = (1/|A|) adj(A)",progress:87},
{title:"Determinants",tag:"Algebra",body:"Order 2 & 3. Properties. Minors, cofactors. Cramer’s rule. Area of triangle using determinants.",formula:"Area = ½|x₁(y₂−y₃)+...|",progress:83},
{title:"Probability",tag:"Stats",body:"Classical definition. Addition & multiplication theorems. Conditional probability. Independent events. Bayes’ theorem. Binomial distribution basics.",formula:"P(A∪B)=P(A)+P(B)−P(A∩B)",progress:80},
{title:"Statistics",tag:"Stats",body:"Mean, median, mode. Variance, standard deviation. Coefficient of variation. Correlation (Karl Pearson).",formula:"σ = √[Σ(x−x̄)²/n]",progress:78},
{title:"Vectors",tag:"Geometry",body:"Addition laws. Dot product a·b = |a||b|cosθ. Cross product. Scalar triple product. Applications in geometry & physics.",formula:"a·b = |a||b|cosθ  |  |a×b| = |a||b|sinθ",progress:75},
{title:"3D Geometry",tag:"Geometry",body:"Direction cosines & ratios. Line and plane equations. Angle between lines/planes. Shortest distance between skew lines. Coplanarity.",formula:"l² + m² + n² = 1",progress:70}
]
};

let studyTapCount=0, studyTapTimer=null;
function enterStudyMode(){
  document.getElementById("chat-screen").classList.remove("active");
  document.getElementById("study-screen").classList.add("active");
  document.title="HSC 2027 Prep";
  switchStudyTab(document.querySelector(".study-tab.active")||document.querySelector(".study-tab"));
  const h=document.getElementById("secret-hint");if(h){h.classList.add("show");setTimeout(()=>h.classList.remove("show"),4000)}
}
function exitStudyMode(){
  document.getElementById("study-screen").classList.remove("active");
  document.getElementById("chat-screen").classList.add("active");
  document.title="Shawon AI";studyTapCount=0;
}
function switchStudyTab(btn){if(!btn)return;document.querySelectorAll(".study-tab").forEach(t=>t.classList.remove("active"));btn.classList.add("active");renderStudyNotes(btn.dataset.tab)}
function renderStudyNotes(sub){
  const notes=studyNotes[sub]||[], c=document.getElementById("study-content");
  if(!c)return;
  c.innerHTML=notes.map(n=>`<div class="note-card"><h3>${n.title} <span class="tag">${n.tag}</span></h3><p>${n.body.replace(/\n/g,"<br>")}</p><div class="formula">${n.formula}</div><div class="progress-bar"><span style="width:${n.progress}%"></span></div></div>`).join("");
}
document.addEventListener("DOMContentLoaded",()=>{
  const ring=document.querySelector(".study-progress-ring");
  if(ring) ring.addEventListener("click",()=>{
    studyTapCount++;
    if(studyTapTimer) clearTimeout(studyTapTimer);
    studyTapTimer=setTimeout(()=>studyTapCount=0,900);
    if(studyTapCount>=3) exitStudyMode();
  });
});
