const STORAGE_KEY = "cep_tema7_progress_v1";
const PASS_SCORE = 7;
const QUESTIONS_PER_TEST = 10;
const MAX_ATTEMPTS = 3;

function createDefaultState() {
  const phases = {};
  for (const phase of window.TEMA7_DATA.phases) {
    phases[phase.id] = {
      practiceDone: false,
      practiceNotes: "",
      attempts: 0,
      bestScore: 0,
      passed: false,
      currentSeed: null,
      currentAnswers: {},
      currentQuestions: []
    };
  }
  return {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    prephase: {
      mapDone: false,
      notes: "",
      mapPuzzleAnswers: ["", "", "", "", "", ""],
      mapPuzzleSolved: false
    },
    teacherVerified: false,
    phases
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    const base = createDefaultState();
    return mergeState(base, parsed);
  } catch (error) {
    console.warn("No se pudo cargar el progreso:", error);
    return createDefaultState();
  }
}

function mergeState(base, saved) {
  const merged = structuredClone(base);
  Object.assign(merged, saved || {});
  merged.prephase = { ...base.prephase, ...(saved?.prephase || {}) };
  for (const phase of window.TEMA7_DATA.phases) {
    merged.phases[phase.id] = { ...base.phases[phase.id], ...(saved?.phases?.[phase.id] || {}) };
  }
  return merged;
}

let state = loadState();

function saveState() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateProgressUI();
}

window.addEventListener("beforeunload", saveState);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveState();
});

function shuffle(array, rng = Math.random) {
  const clone = [...array];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function seededRandom(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}

function makeSeed() {
  return Math.floor(Date.now() * Math.random()) >>> 0;
}

function buildTestForPhase(phaseId) {
  const phase = window.TEMA7_DATA.phases.find((item) => item.id === phaseId);
  const phaseState = state.phases[phaseId];
  const seed = makeSeed();
  const rng = seededRandom(seed);
  const selected = shuffle(phase.questions, rng).slice(0, QUESTIONS_PER_TEST).map((question, index) => {
    const options = shuffle(
      [question.correct, ...question.wrongs].map((text) => ({
        text,
        isCorrect: text === question.correct
      })),
      rng
    );
    return { id: `${phaseId}_q${index + 1}`, prompt: question.prompt, explanation: question.explanation, figure: question.figure || null, options };
  });

  phaseState.currentSeed = seed;
  phaseState.currentQuestions = selected;
  phaseState.currentAnswers = {};
  saveState();
  return selected;
}

function getQuestionsForPhase(phaseId) {
  const phaseState = state.phases[phaseId];
  if (!phaseState.currentQuestions || phaseState.currentQuestions.length !== QUESTIONS_PER_TEST) {
    return buildTestForPhase(phaseId);
  }
  return phaseState.currentQuestions;
}

function completionStats() {
  const phaseEntries = Object.values(state.phases);
  const totalPhases = phaseEntries.length;
  const passedTests = phaseEntries.filter((phase) => phase.passed).length;
  const completedPractices = phaseEntries.filter((phase) => phase.practiceDone).length;
  const mapComplete = state.prephase.mapDone ? 1 : 0;
  const finished = mapComplete && passedTests === totalPhases && completedPractices === totalPhases;
  const percent = Math.round(((mapComplete + passedTests + completedPractices) / (1 + totalPhases + totalPhases)) * 100);
  return { totalPhases, passedTests, completedPractices, mapComplete, finished, percent };
}

function updateProgressUI() {
  const progressFill = document.querySelector("#globalProgressFill");
  const progressLabel = document.querySelector("#globalProgressLabel");
  if (!progressFill || !progressLabel) return;
  const stats = completionStats();
  progressFill.style.width = `${stats.percent}%`;
  progressLabel.textContent = `Progreso global: ${stats.percent}% · mapa ${stats.mapComplete ? "completado" : "pendiente"} · prácticas ${stats.completedPractices}/${stats.totalPhases} · tests ${stats.passedTests}/${stats.totalPhases}`;
}

function renderHome() {
  const app = document.querySelector("#app");
  if (!app) return;

  app.innerHTML = `
    <section class="card">
      <p class="eyebrow">Misión del alumnado</p>
      <h2 class="section-title">Aventura de aprendizaje</h2>
      <div class="intro-grid">
        <div>
          <p>Este itinerario toma como base la estructura del tema 6, pero la amplía con una estética más inmersiva, pruebas de mayor contenido, preguntas variables y progreso persistente en el navegador.</p>
          <div class="progress-bar"><span id="globalProgressFill"></span></div>
          <p id="globalProgressLabel" class="muted"></p>
        </div>
        <div class="chips">
          <span class="chip">Mapa conceptual manuscrito</span>
          <span class="chip">Prácticas por apartados</span>
          <span class="chip">Tests aleatorios amplios</span>
          <span class="chip">Figuras y diagramas</span>
          <span class="chip">Reintentos con nuevas preguntas</span>
          <span class="chip">Guardado automático</span>
        </div>
      </div>
    </section>

    <section class="card" id="aventura">
      <p class="eyebrow">Fase previa</p>
      <h2>${window.TEMA7_DATA.prephase.title}</h2>
      <p>${window.TEMA7_DATA.prephase.goal}</p>
      <div class="intro-grid">
        <article class="module">
          <h3>Indicaciones</h3>
          <ul>${window.TEMA7_DATA.prephase.instructions.map((item) => `<li>${item}</li>`).join("")}</ul>
          <p><strong>Entrega:</strong> ${window.TEMA7_DATA.prephase.deliverable}</p>
          <p><strong>Tiempo estimado:</strong> ${window.TEMA7_DATA.prephase.minutes} minutos.</p>
        </article>
        <article class="module">
          <h3>Checklist del mapa</h3>
          <ul>${window.TEMA7_DATA.prephase.checks.map((item) => `<li>${item}</li>`).join("")}</ul>
          <label class="practice__checkbox">
            <input type="checkbox" id="mapDoneCheckbox" ${state.prephase.mapDone ? "checked" : ""}/>
            <span>Confirmo que he realizado el mapa conceptual de forma manuscrita.</span>
          </label>
          <label for="mapNotes">Observaciones del estudiante o docente</label>
          <textarea id="mapNotes" rows="4" placeholder="Anota colores utilizados, relaciones añadidas o mejoras pendientes...">${escapeHtml(state.prephase.notes || "")}</textarea>
        </article>
      </div>

      <article class="module">
        <h3>Minirreto visual: completa el mapa del tema</h3>
        <p>Selecciona el concepto adecuado en cada hueco. Esto sirve como activación inicial, pero no sustituye la entrega manuscrita.</p>
        <div class="quest-map">
          ${renderPuzzleNode(0, "El cliente y su importancia")}
          ${renderPuzzleNode(1, "Motivaciones y necesidades")}
          ${renderPuzzleNode(2, "Proceso de decisión")}
          ${renderPuzzleNode(3, "Elementos de atención")}
          ${renderPuzzleNode(4, "Departamento de atención")}
          ${renderPuzzleNode(5, "Comunicación y asesoramiento")}
        </div>
        <div class="practice__actions" style="margin-top:16px">
          <button class="btn btn--secondary" id="checkPuzzleBtn">Comprobar mapa</button>
          <button class="btn btn--ghost" id="resetPuzzleBtn">Reiniciar huecos</button>
        </div>
        <p id="puzzleStatus" class="status"></p>
      </article>
    </section>
  `;

  bindPrephase();
  renderPhases(app);
  updateProgressUI();
}

function renderPuzzleNode(index, title) {
  const options = [
    "cliente",
    "motivaciones",
    "necesidades",
    "decisión de compra",
    "atención al cliente",
    "comunicación",
    "asesoramiento",
    "departamento"
  ];
  const values = state.prephase.mapPuzzleAnswers;
  return `
    <div class="map-node">
      <h4>${title}</h4>
      <p>Completa el hueco clave para activar la fase.</p>
      <select data-puzzle-index="${index}" class="puzzle-select">
        <option value="">Selecciona...</option>
        ${options.map((opt) => `<option value="${opt}" ${values[index] === opt ? "selected" : ""}>${capitalize(opt)}</option>`).join("")}
      </select>
    </div>
  `;
}

function bindPrephase() {
  const mapDone = document.querySelector("#mapDoneCheckbox");
  const mapNotes = document.querySelector("#mapNotes");
  const selects = [...document.querySelectorAll(".puzzle-select")];
  const puzzleStatus = document.querySelector("#puzzleStatus");
  const correct = ["cliente", "motivaciones", "decisión de compra", "atención al cliente", "departamento", "comunicación"];

  mapDone?.addEventListener("change", (event) => {
    state.prephase.mapDone = event.target.checked;
    saveState();
  });

  mapNotes?.addEventListener("input", (event) => {
    state.prephase.notes = event.target.value;
    saveState();
  });

  selects.forEach((select) => {
    select.addEventListener("change", (event) => {
      const index = Number(event.target.dataset.puzzleIndex);
      state.prephase.mapPuzzleAnswers[index] = event.target.value;
      saveState();
    });
  });

  document.querySelector("#checkPuzzleBtn")?.addEventListener("click", () => {
    const ok = correct.every((answer, index) => state.prephase.mapPuzzleAnswers[index] === answer);
    state.prephase.mapPuzzleSolved = ok;
    puzzleStatus.textContent = ok
      ? "Mapa activado correctamente. Ya puedes avanzar con todas las fases."
      : "Revisa algunos huecos. Piensa en el concepto principal de cada bloque.";
    puzzleStatus.className = `status ${ok ? "status--ok" : "status--warn"}`;
    saveState();
  });

  document.querySelector("#resetPuzzleBtn")?.addEventListener("click", () => {
    state.prephase.mapPuzzleAnswers = ["", "", "", "", "", ""];
    state.prephase.mapPuzzleSolved = false;
    saveState();
    renderHome();
  });

  if (state.prephase.mapPuzzleSolved) {
    puzzleStatus.textContent = "Mapa activado correctamente. Ya puedes avanzar con todas las fases.";
    puzzleStatus.className = "status status--ok";
  }
}

function renderPhases(app) {
  const tpl = document.querySelector("#phaseTemplate");
  for (const phase of window.TEMA7_DATA.phases) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.id = phase.id;
    node.querySelector(".phase__scene").textContent = phase.scene;
    node.querySelector(".phase__title").textContent = phase.title;
    node.querySelector(".phase__meta").innerHTML = `
      <span>${phase.minutes} min estimados</span>
      <span>${state.phases[phase.id].passed ? "Test superado" : "Test pendiente"}</span>
      <span>${state.phases[phase.id].practiceDone ? "Práctica entregada" : "Práctica pendiente"}</span>
    `;
    node.querySelector(".phase__summary").innerHTML = `<ul>${phase.summary.map((item) => `<li>${item}</li>`).join("")}</ul>`;
    node.querySelector(".module--practice").innerHTML = renderPractice(phase);
    node.querySelector(".module--test").innerHTML = renderTest(phase);
    app.appendChild(node);
  }
  bindPhaseEvents();
}

function renderPractice(phase) {
  const phaseState = state.phases[phase.id];
  return `
    <h4>Práctica guiada</h4>
    <p>${phase.practice.intro}</p>
    <ol>${phase.practice.parts.map((part) => `<li>${part}</li>`).join("")}</ol>
    <p><strong>Entrega:</strong> ${phase.practice.evidence}</p>
    <p><strong>Rúbrica:</strong> ${phase.practice.rubric.join(" · ")}</p>
    <label class="practice__checkbox">
      <input type="checkbox" data-practice="${phase.id}" ${phaseState.practiceDone ? "checked" : ""}/>
      <span>Confirmo que he realizado y entregado esta práctica de forma manuscrita.</span>
    </label>
    <label for="note_${phase.id}">Notas de seguimiento</label>
    <textarea id="note_${phase.id}" data-practice-note="${phase.id}" rows="4" placeholder="Resumen de la práctica, dudas o indicaciones del docente...">${escapeHtml(phaseState.practiceNotes || "")}</textarea>

    <div class="module" style="margin-top:14px">
      <h5>Recursos sugeridos</h5>
      <div class="resource-list">
        ${phase.resources.map((item) => `<a href="${item.url}" target="_blank" rel="noopener noreferrer"><span>${item.label}</span><strong>↗</strong></a>`).join("")}
      </div>
    </div>
  `;
}

function renderTest(phase) {
  const phaseState = state.phases[phase.id];
  const questions = getQuestionsForPhase(phase.id);
  return `
    <h4>Test variable de fase</h4>
    <p>Banco amplio de preguntas, respuestas mezcladas y contenido relacionado. Cada intento genera una combinación nueva. Debes acertar al menos <strong>${PASS_SCORE}</strong> de ${QUESTIONS_PER_TEST}.</p>
    <p class="muted">Intentos usados: ${phaseState.attempts}/${MAX_ATTEMPTS} · Mejor nota: ${phaseState.bestScore}/${QUESTIONS_PER_TEST}</p>
    ${questions.map((question, qIndex) => `
      <div class="question" data-question="${question.id}">
        <h5>${qIndex + 1}. ${question.prompt}</h5>
        ${question.figure ? `<div class="figure">${question.figure}</div>` : ""}
        <div class="options">
          ${question.options.map((option, oIndex) => `
            <button type="button" class="option ${phaseState.currentAnswers[question.id] === option.text ? "is-selected" : ""}" data-option-for="${question.id}" data-value="${encodeURIComponent(option.text)}">
              ${String.fromCharCode(65 + oIndex)}. ${option.text}
            </button>
          `).join("")}
        </div>
        <p class="muted hidden" data-expl="${question.id}"></p>
      </div>
    `).join("")}
    <div class="test__actions" style="margin-top:14px">
      <button class="btn btn--primary" data-submit-test="${phase.id}" ${phaseState.attempts >= MAX_ATTEMPTS && !phaseState.passed ? "disabled" : ""}>Corregir test</button>
      <button class="btn btn--ghost" data-regenerate-test="${phase.id}" ${phaseState.attempts >= MAX_ATTEMPTS && !phaseState.passed ? "disabled" : ""}>Cambiar preguntas</button>
    </div>
    <p class="status ${phaseState.passed ? "status--ok" : "status--warn"}" id="status_${phase.id}">
      ${phaseState.passed ? "Test superado. Puedes conservar esta nota o seguir practicando desde el panel docente." : phaseState.attempts >= MAX_ATTEMPTS ? "Intentos agotados. Usa el panel docente si necesitas reiniciar." : "Aún no superado."}
    </p>
  `;
}

function bindPhaseEvents() {
  document.querySelectorAll("[data-practice]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const phaseId = event.target.dataset.practice;
      state.phases[phaseId].practiceDone = event.target.checked;
      saveState();
      refresh();
    });
  });

  document.querySelectorAll("[data-practice-note]").forEach((textarea) => {
    textarea.addEventListener("input", (event) => {
      const phaseId = event.target.dataset.practiceNote;
      state.phases[phaseId].practiceNotes = event.target.value;
      saveState();
    });
  });

  document.querySelectorAll("[data-option-for]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const qid = event.currentTarget.dataset.optionFor;
      const value = decodeURIComponent(event.currentTarget.dataset.value);
      const phaseId = qid.split("_q")[0];
      state.phases[phaseId].currentAnswers[qid] = value;
      saveState();
      updateQuestionSelection(qid, value);
    });
  });

  document.querySelectorAll("[data-submit-test]").forEach((button) => {
    button.addEventListener("click", () => submitTest(button.dataset.submitTest));
  });

  document.querySelectorAll("[data-regenerate-test]").forEach((button) => {
    button.addEventListener("click", () => {
      const phaseId = button.dataset.regenerateTest;
      if (state.phases[phaseId].attempts >= MAX_ATTEMPTS && !state.phases[phaseId].passed) return;
      buildTestForPhase(phaseId);
      refresh();
    });
  });
}

function updateQuestionSelection(questionId, selectedValue) {
  document.querySelectorAll(`[data-option-for="${questionId}"]`).forEach((button) => {
    button.classList.toggle("is-selected", decodeURIComponent(button.dataset.value) === selectedValue);
  });
}

function submitTest(phaseId) {
  const phase = window.TEMA7_DATA.phases.find((item) => item.id === phaseId);
  const phaseState = state.phases[phaseId];
  if (phaseState.attempts >= MAX_ATTEMPTS && !phaseState.passed) return;

  const questions = getQuestionsForPhase(phaseId);
  let score = 0;

  phaseState.attempts += 1;

  for (const question of questions) {
    const selected = phaseState.currentAnswers[question.id];
    const correctOption = question.options.find((option) => option.isCorrect);
    const questionWrap = document.querySelector(`[data-question="${question.id}"]`);
    const explanation = questionWrap?.querySelector(`[data-expl="${question.id}"]`);

    question.options.forEach((option) => {
      const button = questionWrap?.querySelector(`[data-option-for="${question.id}"][data-value="${encodeURIComponent(option.text)}"]`);
      if (!button) return;
      button.classList.remove("is-correct", "is-wrong");
      if (option.isCorrect) button.classList.add("is-correct");
      if (selected === option.text && !option.isCorrect) button.classList.add("is-wrong");
    });

    if (selected === correctOption.text) score += 1;
    if (explanation) {
      explanation.classList.remove("hidden");
      explanation.textContent = `Respuesta correcta: ${correctOption.text}. ${question.explanation}`;
    }
  }

  phaseState.bestScore = Math.max(phaseState.bestScore, score);
  if (score >= PASS_SCORE) phaseState.passed = true;

  const status = document.querySelector(`#status_${phaseId}`);
  if (status) {
    status.textContent = phaseState.passed
      ? `Test superado con ${score}/${QUESTIONS_PER_TEST}. Mejor nota registrada: ${phaseState.bestScore}/${QUESTIONS_PER_TEST}.`
      : `Resultado: ${score}/${QUESTIONS_PER_TEST}. ${phaseState.attempts < MAX_ATTEMPTS ? "Puedes reintentar con nuevas preguntas." : "Se agotaron los intentos disponibles."}`;
    status.className = `status ${phaseState.passed ? "status--ok" : score >= PASS_SCORE - 1 ? "status--warn" : "status--bad"}`;
  }

  saveState();
  updateProgressUI();
}

function refresh(scrollToTop = false) {
  const anchor = scrollToTop ? 0 : window.scrollY;
  renderHome();
  if (!scrollToTop) window.scrollTo({ top: anchor });
}

function setupTeacherPanel() {
  const dialog = document.querySelector("#teacherDialog");
  if (!dialog) return;

  document.addEventListener("keydown", (event) => {
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === "d") {
      dialog.showModal();
    }
  });

  document.querySelector("#closeTeacherDialog")?.addEventListener("click", () => dialog.close());

  document.querySelector("#teacherForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.querySelector("#teacherCode");
    const status = document.querySelector("#teacherStatus");
    const tools = document.querySelector("#teacherTools");
    const value = String(input.value || "").trim();

    const mm = Number(value.slice(0,2));
    const dd = Number(value.slice(2,4));
    const validFormat = /^(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{2}$/.test(value);
    if (!validFormat || Number.isNaN(mm) || Number.isNaN(dd)) {
      status.textContent = "Código no válido. Debe respetar la nomenclatura mmddaa.";
      status.className = "dialog__status status status--bad";
      tools.hidden = true;
      return;
    }
    state.teacherVerified = true;
    saveState();
    status.textContent = "Verificación correcta. Herramientas docentes activadas.";
    status.className = "dialog__status status status--ok";
    tools.hidden = false;
  });

  document.querySelector("#unlockAllBtn")?.addEventListener("click", () => {
    state.prephase.mapDone = true;
    state.prephase.mapPuzzleSolved = true;
    for (const phase of window.TEMA7_DATA.phases) {
      state.phases[phase.id].practiceDone = true;
      state.phases[phase.id].passed = true;
      state.phases[phase.id].bestScore = QUESTIONS_PER_TEST;
    }
    saveState();
    refresh();
  });

  document.querySelector("#resetAttemptsBtn")?.addEventListener("click", () => {
    for (const phase of window.TEMA7_DATA.phases) {
      state.phases[phase.id].attempts = 0;
      state.phases[phase.id].currentQuestions = [];
      state.phases[phase.id].currentAnswers = {};
    }
    saveState();
    refresh();
  });

  document.querySelector("#exportProgressBtn")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tema7-progreso.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.querySelector("#clearProgressBtn")?.addEventListener("click", () => {
    if (!confirm("¿Seguro que quieres borrar todo el progreso guardado?")) return;
    state = createDefaultState();
    saveState();
    refresh(true);
  });

  if (state.teacherVerified) {
    document.querySelector("#teacherStatus").textContent = "Verificación correcta. Herramientas docentes activadas.";
    document.querySelector("#teacherStatus").className = "dialog__status status status--ok";
    document.querySelector("#teacherTools").hidden = false;
  }
}

function setupCertificatePage() {
  const statsWrap = document.querySelector("#certificateStats");
  if (!statsWrap) return;

  const stats = completionStats();
  const avgBest = (() => {
    const totals = window.TEMA7_DATA.phases.map((phase) => state.phases[phase.id].bestScore);
    return (totals.reduce((acc, value) => acc + value, 0) / totals.length).toFixed(1);
  })();

  document.querySelector("#todayDate").textContent = new Date().toLocaleDateString("es-ES");
  document.querySelector("#completionState").textContent = stats.finished ? "Itinerario completado" : "Itinerario aún en progreso";
  statsWrap.innerHTML = `
    <article class="stat"><strong>Mapa conceptual</strong><p>${stats.mapComplete ? "Completado" : "Pendiente"}</p></article>
    <article class="stat"><strong>Prácticas manuscritas</strong><p>${stats.completedPractices}/${stats.totalPhases}</p></article>
    <article class="stat"><strong>Tests superados</strong><p>${stats.passedTests}/${stats.totalPhases}</p></article>
    <article class="stat"><strong>Mejor media de test</strong><p>${avgBest}/${QUESTIONS_PER_TEST}</p></article>
    <article class="stat"><strong>Progreso global</strong><p>${stats.percent}%</p></article>
  `;

  const studentName = document.querySelector("#studentName");
  studentName.value = localStorage.getItem("cep_tema7_student_name") || "";
  studentName.addEventListener("input", () => {
    localStorage.setItem("cep_tema7_student_name", studentName.value);
  });

  document.querySelector("#printCertificateBtn")?.addEventListener("click", () => window.print());
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

document.addEventListener("DOMContentLoaded", () => {
  renderHome();
  setupTeacherPanel();
  setupCertificatePage();
});