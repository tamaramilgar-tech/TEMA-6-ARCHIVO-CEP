
function renderHome(){
  const nameInput = document.getElementById("student-name");
  nameInput.value = state.studentName || "";
  nameInput.addEventListener("input", (e) => {
    updateStudentName(e.target.value);
    document.querySelectorAll(".student-name-live").forEach(el => el.textContent = state.studentName || "tu nombre");
  });

  document.querySelectorAll(".student-name-live").forEach(el => el.textContent = state.studentName || "tu nombre");

  const completed = completedCount();
  const pct = Math.round((completed / APP_DATA.phases.length) * 100);
  document.getElementById("progress-value").style.setProperty("--value", pct + "%");
  document.getElementById("progress-num").textContent = completed;
  document.getElementById("progress-total").textContent = APP_DATA.phases.length;
  document.getElementById("progress-text").textContent = `${pct}% completado`;

  const phaseGrid = document.getElementById("phase-grid");
  phaseGrid.innerHTML = APP_DATA.phases.map(phase => {
    const p = state.phases[phase.id];
    const passed = phaseCompleted(phase.id);
    const attemptLabel = phase.id === 1
      ? `${p.mapQuizScore || 0}% mapa`
      : `${p.bestScore || 0}% mejor nota`;
    const gateLabel = p.teacherValidated ? "Validada" : "Pendiente de validación";
    return `
      <article class="card phase-card">
        <div class="phase-index">${phase.id}</div>
        <div class="meta">
          <span class="pill ${passed ? 'ok' : 'warn'}">${passed ? 'Fase completada' : gateLabel}</span>
          <span class="pill">${attemptLabel}</span>
        </div>
        <h3>Fase ${phase.id}. ${phase.title}</h3>
        <p>${phase.summary}</p>
        <div class="quiz-actions" style="margin-top:auto">
          <a class="button btn-primary" href="fases/fase${phase.id}.html">Entrar en la fase</a>
        </div>
      </article>
    `;
  }).join("");

  renderTeacherPanel();
  renderFooter();
}
document.addEventListener("DOMContentLoaded", renderHome);
