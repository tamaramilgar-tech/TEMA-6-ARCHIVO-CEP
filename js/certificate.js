
function renderCertificate(){
  const total = APP_DATA.phases.length;
  const completed = completedCount();
  const pct = Math.round((completed / total) * 100);
  const passed = completed === total;

  document.getElementById("cert-student").textContent = state.studentName || "Sin nombre indicado";
  document.getElementById("cert-date").textContent = new Date().toLocaleDateString("es-ES");
  document.getElementById("cert-completed").textContent = `${completed} de ${total} fases validadas`;
  document.getElementById("cert-score").textContent = `${pct}% de itinerario completado`;
  const badge = document.getElementById("cert-result");
  badge.textContent = passed ? "APTO / SUPERADO" : "NO APTO / EN PROCESO";
  badge.className = "result-badge " + (passed ? "pass" : "fail");

  document.getElementById("cert-table").innerHTML = APP_DATA.phases.map(phase => {
    const p = state.phases[phase.id];
    const score = phase.id === 1 ? (p.mapQuizScore || 0) : (p.bestScore || 0);
    const status = phaseCompleted(phase.id) ? "Completada" : "Pendiente";
    return `<tr>
      <td>Fase ${phase.id}</td>
      <td>${phase.title}</td>
      <td>${score}%</td>
      <td>${status}</td>
    </tr>`;
  }).join("");

  renderTeacherPanel();
  renderFooter();
}
document.addEventListener("DOMContentLoaded", renderCertificate);
