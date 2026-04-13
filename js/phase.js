
function currentPhaseId(){
  return Number(document.body.dataset.phase);
}

function renderPhase(){
  const phaseId = currentPhaseId();
  const phase = getPhaseById(phaseId);
  const phaseState = state.phases[phaseId];

  document.getElementById("phase-title").textContent = `Fase ${phase.id}. ${phase.title}`;
  document.getElementById("phase-summary").textContent = phase.summary;
  document.getElementById("student-name-chip").textContent = state.studentName || "Sin nombre";
  document.getElementById("attempts-chip").textContent = phaseId === 1
    ? `Test mapa: ${phaseState.mapQuizPassed ? 'superado' : 'pendiente'}`
    : `Intentos test: ${phaseState.testAttempts}/2`;

  document.getElementById("theory-list").innerHTML = phase.theory.map(item => `<li>${item}</li>`).join("");
  document.getElementById("phase-status").textContent = phaseCompleted(phaseId) ? "Fase completada" : "En progreso";

  if(phaseId === 1){
    renderMapSection();
    renderMapQuiz();
    document.getElementById("practice-card").classList.add("hidden");
    document.getElementById("teacher-card").classList.remove("hidden");
  } else {
    document.getElementById("teacher-card").classList.remove("hidden");
    const activity = document.getElementById("map-wrap");
    if(activity){
      activity.classList.remove("hidden");
      activity.innerHTML = '<div class="note">En esta fase la actividad principal es la práctica para EVAGD y el test aleatorio de 10 preguntas tras la validación docente.</div>';
    }
    renderPractice(phase);
    renderTeacherUnlock(phaseId);
    renderPhaseTest(phase);
  }

  renderTeacherPanel();
  renderFooter();
}

function renderPractice(phase){
  const phaseState = state.phases[phase.id];
  document.getElementById("practice-title").textContent = phase.practiceTitle;
  document.getElementById("practice-prompt").textContent = phase.practicePrompt;
  document.getElementById("practice-guide").innerHTML = phase.practiceGuide.map(item => `<li>${item}</li>`).join("");
  const box = document.getElementById("practice-done-box");
  box.checked = !!phaseState.practiceSubmitted;
  box.addEventListener("change", (e) => {
    phaseState.practiceSubmitted = e.target.checked;
    saveState();
    syncTestAvailability();
  });
}

function renderTeacherUnlock(phaseId){
  const phaseState = state.phases[phaseId];
  const status = document.getElementById("teacher-status");
  status.textContent = phaseState.teacherValidated
    ? `Fase validada el ${phaseState.practiceValidationDate || 'hoy'}`
    : "Introduce el código docente tras subir la práctica al EVAGD.";
  syncTestAvailability();
}

function validateTeacherCode(){
  const phaseId = currentPhaseId();
  const phaseState = state.phases[phaseId];
  const input = document.getElementById("teacher-code-input");
  const info = document.getElementById("teacher-status");
  const typed = (input.value || "").trim();
  if(typed === getTeacherCode()){
    phaseState.teacherValidated = true;
    phaseState.practiceValidationDate = new Date().toLocaleDateString("es-ES");
    phaseState.testUnlocked = true;
    saveState();
    info.textContent = `Código correcto. Fase validada el ${phaseState.practiceValidationDate}. Ya puedes hacer el test.`;
    input.value = "";
    syncTestAvailability();
  } else {
    info.textContent = "Código no válido. Revisa la fecha o solicita el código actualizado al docente.";
  }
}

function syncTestAvailability(){
  const phaseId = currentPhaseId();
  const phaseState = state.phases[phaseId];
  const testCard = document.getElementById("test-card");
  const ready = phaseState.practiceSubmitted && phaseState.teacherValidated;
  testCard.classList.toggle("locked", !ready);
  document.getElementById("test-lock-msg").textContent = ready
    ? "Test desbloqueado. Recuerda: 2 intentos y 80% para aprobar."
    : "Primero marca la práctica como entregada y valida la fase con el código docente.";
  const btn = document.getElementById("build-test-btn");
  if(btn) btn.disabled = !ready || phaseState.testAttempts >= 2 || phaseState.testPassed;
  if(phaseState.testAttempts >= 2 && !phaseState.testPassed){
    document.getElementById("test-lock-msg").textContent = "Ya has usado los 2 intentos. Revisa la corrección mostrada.";
  }
  if(phaseState.testPassed){
    document.getElementById("test-lock-msg").textContent = "Test superado. La fase ya cuenta para el certificado.";
  }
}

function buildQuestionBlock(item, idx){
  return `
    <section class="question" data-answer="${item.answer}">
      <h4>${idx + 1}. ${item.q}</h4>
      <div class="options">
        ${item.options.map((opt, i) => `
          <label class="option">
            <input type="radio" name="q${idx}" value="${i}" />
            <span>${opt}</span>
          </label>
        `).join("")}
      </div>
      <div class="small hidden explanation"></div>
    </section>
  `;
}

function renderPhaseTest(phase){
  const phaseState = state.phases[phase.id];
  document.getElementById("score-chip").textContent = `${phaseState.bestScore || 0}% mejor nota`;
  document.getElementById("result-chip").textContent = scoreToLabel(phaseState.lastScore || 0);
  document.getElementById("attempts-stat").textContent = `${phaseState.testAttempts}/2`;
}

function generatePhaseTest(){
  const phaseId = currentPhaseId();
  const phase = getPhaseById(phaseId);
  const phaseState = state.phases[phaseId];
  if(!(phaseState.practiceSubmitted && phaseState.teacherValidated)) return;
  if(phaseState.testAttempts >= 2 || phaseState.testPassed) return;

  const selected = shuffle(phase.testPool).slice(0, 10).map(item => {
    const optionsWithIndex = item.options.map((text, index) => ({text, index}));
    const shuffledOptions = shuffle(optionsWithIndex);
    const newAnswer = shuffledOptions.findIndex(opt => opt.index === item.answer);
    return {...item, options: shuffledOptions.map(opt => opt.text), answer:newAnswer};
  });

  phaseState.currentTest = selected;
  saveState();

  const container = document.getElementById("test-questions");
  container.innerHTML = selected.map(buildQuestionBlock).join("");
  document.getElementById("submit-test-btn").disabled = false;
  document.getElementById("test-feedback").textContent = "Cuestionario generado en orden aleatorio.";
}

function submitPhaseTest(){
  const phaseId = currentPhaseId();
  const phaseState = state.phases[phaseId];
  const items = phaseState.currentTest || [];
  if(!items.length) return;

  phaseState.testAttempts += 1;
  let correct = 0;
  const blocks = [...document.querySelectorAll("#test-questions .question")];
  const lastAnswers = [];

  blocks.forEach((block, idx) => {
    const chosen = block.querySelector('input[type="radio"]:checked');
    const chosenValue = chosen ? Number(chosen.value) : -1;
    const answer = items[idx].answer;
    const explanation = block.querySelector(".explanation");
    const isCorrect = chosenValue === answer;
    if(isCorrect) correct += 1;
    lastAnswers.push({chosen: chosenValue, answer});
    block.classList.add(isCorrect ? "correct" : "incorrect");
    explanation.classList.remove("hidden");
    explanation.textContent = isCorrect
      ? "Correcta. " + items[idx].explanation
      : `Incorrecta. ${items[idx].explanation}`;
  });

  const score = Math.round((correct / items.length) * 100);
  phaseState.lastScore = score;
  phaseState.bestScore = Math.max(phaseState.bestScore || 0, score);
  phaseState.lastAnswers = lastAnswers;
  phaseState.testPassed = score >= 80;
  saveState();

  document.getElementById("submit-test-btn").disabled = true;
  document.getElementById("test-feedback").textContent =
    `Resultado: ${score}% (${correct} de ${items.length}). ${phaseState.testPassed ? 'Has superado el test.' : 'No alcanzas el 80 % todavía.'}`;
  renderPhaseTest(getPhaseById(phaseId));
  syncTestAvailability();
}

function renderMapSection(){
  const wrap = document.getElementById("map-wrap");
  wrap.innerHTML = `
    <div class="note">Completa los huecos. Cada acierto se ilumina y queda fijado. Cuando completes todo, se activará el test del mapa.</div>
    <div class="map-grid">
      ${APP_DATA.mapBlanks.map(item => `
        <div class="map-item">
          <label for="${item.id}">${item.label}</label>
          <input id="${item.id}" type="text" placeholder="Escribe la palabra clave" />
          <div id="${item.id}-feedback" class="feedback"></div>
        </div>
      `).join("")}
    </div>
    <div class="quiz-actions" style="margin-top:14px">
      <button class="btn-primary" onclick="checkMap()">Comprobar mapa</button>
      <button class="btn-secondary" onclick="fillMapHint()">Pista breve</button>
    </div>
  `;
}

function fillMapHint(){
  const note = document.getElementById("map-status");
  note.textContent = "Pista: piensa en función, tipos de archivo, sistema por nombres, soporte digital y ley de protección de datos.";
}

function checkMap(){
  let hits = 0;
  APP_DATA.mapBlanks.forEach(item => {
    const input = document.getElementById(item.id);
    const fb = document.getElementById(item.id + "-feedback");
    const ok = normalizeText(input.value) === normalizeText(item.answer);
    if(ok){
      hits += 1;
      input.disabled = true;
      input.style.borderColor = "#49bb86";
      input.style.background = "#f2fbf6";
      fb.textContent = "Correcto";
      fb.className = "feedback ok";
    }else{
      input.style.borderColor = "#e58e8e";
      input.style.background = "#fff6f6";
      fb.textContent = "Revisa este concepto";
      fb.className = "feedback bad";
    }
  });
  const done = hits === APP_DATA.mapBlanks.length;
  state.phases[1].mapCompleted = done;
  saveState();
  document.getElementById("map-status").textContent = done
    ? "Mapa completado. Ya puedes generar el test del mapa."
    : `Has acertado ${hits} de ${APP_DATA.mapBlanks.length}. Corrige los que faltan.`;
  document.getElementById("map-build-btn").disabled = !done;
}

function renderMapQuiz(){
  const p = state.phases[1];
  document.getElementById("map-build-btn").disabled = !p.mapCompleted || p.mapQuizPassed;
  document.getElementById("map-submit-btn").disabled = true;
  document.getElementById("teacher-card").classList.remove("hidden");
  syncMapTeacherBlock();
}

function generateMapQuiz(){
  const selected = shuffle(APP_DATA.mapTestPool).slice(0, 5).map(item => {
    const optionsWithIndex = item.options.map((text, index) => ({text, index}));
    const shuffledOptions = shuffle(optionsWithIndex);
    const newAnswer = shuffledOptions.findIndex(opt => opt.index === item.answer);
    return {...item, options: shuffledOptions.map(opt => opt.text), answer:newAnswer};
  });
  state.phases[1].currentMapQuiz = selected;
  saveState();
  document.getElementById("map-quiz-questions").innerHTML = selected.map(buildQuestionBlock).join("");
  document.getElementById("map-submit-btn").disabled = false;
  document.getElementById("map-quiz-status").textContent = "Test del mapa generado.";
}

function submitMapQuiz(){
  const p = state.phases[1];
  const items = p.currentMapQuiz || [];
  if(!items.length) return;
  let correct = 0;
  const blocks = [...document.querySelectorAll("#map-quiz-questions .question")];
  blocks.forEach((block, idx) => {
    const chosen = block.querySelector('input[type="radio"]:checked');
    const chosenValue = chosen ? Number(chosen.value) : -1;
    const answer = items[idx].answer;
    const explanation = block.querySelector(".explanation");
    const isCorrect = chosenValue === answer;
    if(isCorrect) correct += 1;
    block.classList.add(isCorrect ? "correct" : "incorrect");
    explanation.classList.remove("hidden");
    explanation.textContent = isCorrect
      ? "Correcta. " + items[idx].explanation
      : `Incorrecta. ${items[idx].explanation}`;
  });
  const score = Math.round((correct / items.length) * 100);
  p.mapQuizScore = score;
  p.mapQuizPassed = score >= 80;
  saveState();
  document.getElementById("map-submit-btn").disabled = true;
  document.getElementById("map-quiz-status").textContent = `Resultado del test del mapa: ${score}% (${correct}/5).`;
  syncMapTeacherBlock();
}

function syncMapTeacherBlock(){
  const p = state.phases[1];
  const codeWrap = document.getElementById("map-teacher-lock");
  const btn = document.getElementById("map-validate-btn");
  const input = document.getElementById("map-teacher-code");
  const msg = document.getElementById("map-teacher-status");
  if(!codeWrap) return;
  codeWrap.classList.toggle("locked", !(p.mapCompleted && p.mapQuizPassed));
  btn.disabled = !(p.mapCompleted && p.mapQuizPassed) || p.teacherValidated;
  input.disabled = !(p.mapCompleted && p.mapQuizPassed) || p.teacherValidated;
  msg.textContent = p.teacherValidated
    ? `Fase 1 validada el ${p.practiceValidationDate || 'hoy'}.`
    : (p.mapCompleted && p.mapQuizPassed ? "Introduce el código docente para validar la fase 1." : "Primero completa el mapa y supera el test del mapa con al menos un 80 %.");
}

function validateMapTeacherCode(){
  const p = state.phases[1];
  const typed = (document.getElementById("map-teacher-code").value || "").trim();
  const msg = document.getElementById("map-teacher-status");
  if(typed === getTeacherCode()){
    p.teacherValidated = true;
    p.practiceValidationDate = new Date().toLocaleDateString("es-ES");
    saveState();
    msg.textContent = `Código correcto. Fase 1 validada el ${p.practiceValidationDate}.`;
  } else {
    msg.textContent = "Código incorrecto.";
  }
  syncMapTeacherBlock();
}
document.addEventListener("DOMContentLoaded", renderPhase);
