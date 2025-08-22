(function () {
  "use strict";

  // Helper functions
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const create = (tag, attrs = {}) => Object.assign(document.createElement(tag), attrs);

  // Elements
  const processID = $("#processID");
  const arrivalTime = $("#arrivalTime");
  const burstTime = $("#burstTime");
  const btnAddProcess = $("#btnAddProcess");
  const resetBtn = $("#resetBtn");
  const algorithmSelector = $("#algorithmSelector");
  const timeQuantum = $("#timeQuantum");
  const timeQuantumWrap = $("#timeQuantumWrap");
  const btnCalculate = $("#btnCalculate");

  const tblProcessListBody = $("#tblProcessList tbody");
  const tblResultsBody = $("#tblResults tbody");
  const avgTAT = $("#avgTurnaroundTime");
  const avgWT = $("#avgWaitingTime");
  const throughput = $("#throughput");
  const ganttChart = $("#ganttChart");

  const toggleTheme = $("#toggleTheme");
  const btnExportCSV = $("#btnExportCSV");
  const btnExportPDF = $("#btnExportPDF");

  // State
  let processes = [];
  let editIndex = -1;

  // Show/hide Time Quantum input
  algorithmSelector.addEventListener("change", () => {
    timeQuantumWrap.style.display = algorithmSelector.value === "optRR" ? "block" : "none";
  });

  // ➕ Add or Update Process
  btnAddProcess.addEventListener("click", () => {
    const pid = parseInt(processID.value, 10);
    const at = parseInt(arrivalTime.value, 10);
    const bt = parseInt(burstTime.value, 10);

    if (isNaN(pid) || isNaN(at) || isNaN(bt) || bt <= 0) {
      alert("⚠️ Enter valid values!");
      return;
    }
    if (editIndex === -1 && processes.some(p => p.processID === pid)) {
      alert("⚠️ Duplicate Process ID not allowed!");
      return;
    }

    const proc = { processID: pid, arrivalTime: at, burstTime: bt };

    if (editIndex >= 0) {
      processes[editIndex] = proc;
      editIndex = -1;
    } else {
      processes.push(proc);
    }

    renderProcessList();
    processID.value = "";
    arrivalTime.value = "";
    burstTime.value = "";
  });

  // ✏️ Edit Process
  window.editProcess = index => {
    const p = processes[index];
    processID.value = p.processID;
    arrivalTime.value = p.arrivalTime;
    burstTime.value = p.burstTime;
    editIndex = index;
  };

  // ❌ Delete Process
  window.deleteProcess = index => {
    processes.splice(index, 1);
    renderProcessList();
  };

  // Reset
  resetBtn.addEventListener("click", () => {
    processes = [];
    renderProcessList();
    clearOutputs();
  });

  // Calculate
  btnCalculate.addEventListener("click", () => {
    if (processes.length === 0) {
      alert("⚠️ Add processes first!");
      return;
    }

    clearOutputs();

    const algo = algorithmSelector.value;
    let result;
    if (algo === "optFCFS") result = runFCFS(copy(processes));
    else if (algo === "optSJF") result = runSJF(copy(processes));
    else if (algo === "optSRTF") result = runSRTF(copy(processes));
    else if (algo === "optRR") {
      const tq = parseInt(timeQuantum.value, 10);
      if (!tq || tq <= 0) { alert("⚠️ Enter valid Time Quantum"); return; }
      result = runRR(copy(processes), tq);
    }

    renderResults(result.completed);
    renderGantt(result.timeline);
    renderMetrics(result.completed);
  });

  // --- Rendering functions ---
  function renderProcessList() {
    tblProcessListBody.innerHTML = "";
    if (processes.length === 0) {
      tblProcessListBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No processes yet</td></tr>`;
      return;
    }
    processes.forEach((p, i) => {
      const tr = create("tr");
      tr.innerHTML = `
        <td>P${p.processID}</td>
        <td>${p.arrivalTime}</td>
        <td>${p.burstTime}</td>
        <td>
          <button class="btn btn-sm btn-warning me-1" onclick="editProcess(${i})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteProcess(${i})">❌</button>
        </td>`;
      tblProcessListBody.appendChild(tr);
    });
  }

  function renderResults(completed) {
    tblResultsBody.innerHTML = "";
    completed.forEach(p => {
      const tr = create("tr");
      tr.innerHTML = `
        <td>P${p.processID}</td>
        <td>${p.arrivalTime}</td>
        <td>${p.burstTime}</td>
        <td>${p.completedTime}</td>
        <td>${p.waitingTime}</td>
        <td>${p.turnAroundTime}</td>`;
      tblResultsBody.appendChild(tr);
    });
  }

  // 🎨 Gantt Chart with animations + colors
  function renderGantt(timeline) {
    ganttChart.innerHTML = "";
    if (timeline.length === 0) {
      ganttChart.innerHTML = `<div class="text-muted">No timeline generated</div>`;
      return;
    }
    timeline.forEach((seg, idx) => {
      const block = create("div", { className: `gantt-block color-${seg.pid % 8}` });
      block.style.minWidth = (seg.end - seg.start) * 40 + "px";
      block.innerHTML = `P${seg.pid}<small>${seg.start}-${seg.end}</small>`;
      block.style.opacity = "0";
      block.style.transform = "translateY(10px)";
      ganttChart.appendChild(block);

      // Animation delay
      setTimeout(() => {
        block.style.transition = "all 0.5s ease";
        block.style.opacity = "1";
        block.style.transform = "translateY(0)";
      }, idx * 200);
    });
  }

  function renderMetrics(completed) {
    const totalTAT = completed.reduce((s, p) => s + p.turnAroundTime, 0);
    const totalWT = completed.reduce((s, p) => s + p.waitingTime, 0);
    const maxCT = Math.max(...completed.map(p => p.completedTime));
    avgTAT.value = (totalTAT / completed.length).toFixed(2);
    avgWT.value = (totalWT / completed.length).toFixed(2);
    throughput.value = (completed.length / maxCT).toFixed(2);
  }

  function clearOutputs() {
    tblResultsBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No results yet</td></tr>`;
    ganttChart.innerHTML = "";
    avgTAT.value = "";
    avgWT.value = "";
    throughput.value = "";
  }

  // --- Utils ---
  const copy = arr => arr.map(p => ({ ...p }));

  // --- Algorithms (same as before) ---
  function runFCFS(list) { /* same as your code */ }
  function runSJF(list) { /* same as your code */ }
  function runSRTF(list) { /* same as your code */ }
  function runRR(list, tq) { /* same as your code */ }

  // 🌙 Dark Mode
  toggleTheme?.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    toggleTheme.innerText = document.body.classList.contains("dark") ? "☀️ Light Mode" : "🌙 Dark Mode";
  });

  // 📤 Export CSV
  btnExportCSV?.addEventListener("click", () => {
    let csv = "ProcessID,Arrival,Burst,Completion,Waiting,TAT\n";
    [...tblResultsBody.rows].forEach(r => {
      csv += [...r.cells].map(c => c.innerText).join(",") + "\n";
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "results.csv";
    a.click();
  });

  // 📤 Export PDF (needs jsPDF & autotable in HTML)
  btnExportPDF?.addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("CPU Scheduling Results", 10, 10);
    doc.autoTable({ html: "#tblResults", startY: 20 });
    doc.save("results.pdf");
  });
})();