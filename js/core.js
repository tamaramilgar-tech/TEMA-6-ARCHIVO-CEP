
const STORAGE_KEY = "tema6_archivo_repo_v1";

function defaultState(){
  const phases = {};
  for(const phase of APP_DATA.phases){
    phases[phase.id] = {
      practiceSubmitted:false,
      teacherValidated:false,
      practiceValidationDate:null,
      testAttempts:0,
      testPassed:false,
      bestScore:0,
      lastScore:0,
      lastAnswers:[],
      testUnlocked:false,
      mapCompleted:false,
      mapQuizPassed:false,
      mapQuizScore:0
    };
  }
  return {
    studentName:"",
    phases,
    certificateGeneratedAt:null
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return deepMerge(defaultState(), parsed);
  }catch{
    return defaultState();
  }
}

function deepMerge(base, extra){
  if(Array.isArray(base)) return Array.isArray(extra) ? extra : base;
  if(base && typeof base === "object"){
    const output = {...base};
    for(const k of Object.keys(extra || {})){
      output[k] = k in base ? deepMerge(base[k], extra[k]) : extra[k];
    }
    return output;
  }
  return extra ?? base;
}

let state = loadState();

function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function normalizeText(text){
  return (text || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function shuffle(array){
  const arr = [...array];
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getTeacherCode(){
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  return `${dd}${mm}${yyyy}`;
}

function getPhaseById(id){
  return APP_DATA.phases.find(p => p.id === Number(id));
}

function completedCount(){
  return APP_DATA.phases.filter(phase => phaseCompleted(phase.id)).length;
}

function phaseCompleted(phaseId){
  const p = state.phases[phaseId];
  if(phaseId === 1) return p.mapCompleted && p.mapQuizPassed && p.teacherValidated;
  return p.practiceSubmitted && p.teacherValidated && p.testPassed;
}

function updateStudentName(name){
  state.studentName = name.trim();
  saveState();
}

function resetAllProgress(){
  localStorage.removeItem(STORAGE_KEY);
  state = defaultState();
  location.reload();
}

function revealTeacherPanel(){
  const panel = document.getElementById("teacher-panel");
  if(panel) panel.classList.toggle("hidden");
}

document.addEventListener("keydown", (ev) => {
  if(ev.altKey && ev.shiftKey && ev.key.toLowerCase() === "d"){
    revealTeacherPanel();
  }
});

function renderTeacherPanel(){
  const panel = document.getElementById("teacher-panel");
  if(!panel) return;
  panel.innerHTML = `
    <h3>Panel docente</h3>
    <p class="small">Código de verificación del día</p>
    <input id="teacher-code-output" type="password" value="${getTeacherCode()}" readonly />
    <div class="quiz-actions" style="margin-top:12px">
      <button class="btn-secondary" onclick="toggleTeacherCode()">Mostrar / ocultar código</button>
      <button class="btn-ghost" onclick="copyTeacherCode()">Copiar</button>
    </div>
    <p class="small" style="margin-top:12px">${APP_DATA.teacherHint}</p>
  `;
}

function toggleTeacherCode(){
  const el = document.getElementById("teacher-code-output");
  if(!el) return;
  el.type = el.type === "password" ? "text" : "password";
}
function copyTeacherCode(){
  const code = getTeacherCode();
  navigator.clipboard?.writeText(code);
}

function renderFooter(){
  const year = new Date().getFullYear();
  const footer = document.getElementById("footer-year");
  if(footer) footer.textContent = year;
}

function scoreToLabel(score){
  if(score >= 80) return "Superado";
  if(score > 0) return "Pendiente";
  return "Sin intento";
}
