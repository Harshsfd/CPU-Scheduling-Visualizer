document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  // Helpers
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
  const toggleTheme = $("#toggleTheme");

  const tblProcessListBody = $("#tblProcessList tbody");
  const tblResultsBody = $("#tblResults tbody");
  const avgTAT = $("#avgTurnaroundTime");
  const avgWT = $("#avgWaitingTime");
  const throughput = $("#throughput");
  const ganttChart = $("#ganttChart");
  const btnCalculate = $("#btnCalculate");
  const btnDownloadPDF = $("#btnDownloadPDF");
  const btnDownloadCSV = $("#btnDownloadCSV");

  // State
  let processes = [];
  let editIndex = null;

  // Show/hide Time Quantum input
  algorithmSelector.addEventListener("change", () => {
    timeQuantumWrap.style.display = algorithmSelector.value === "optRR" ? "block" : "none";
  });

  // Add / Update process
  btnAddProcess.addEventListener("click", () => {
    const pid = parseInt(processID.value, 10);
    const at = parseInt(arrivalTime.value, 10);
    const bt = parseInt(burstTime.value, 10);

    if (isNaN(pid) || isNaN(at) || isNaN(bt) || bt <= 0) {
      alert("⚠️ Enter valid values!");
      return;
    }
    if (editIndex === null && processes.some(p => p.processID === pid)) {
      alert("⚠️ Duplicate Process ID not allowed!");
      return;
    }

    if (editIndex !== null) {
      processes[editIndex] = { processID: pid, arrivalTime: at, burstTime: bt };
      editIndex = null;
      btnAddProcess.textContent = "➕ Add / Update Process";
    } else {
      processes.push({ processID: pid, arrivalTime: at, burstTime: bt });
    }

    renderProcessList();
    processID.value = "";
    arrivalTime.value = "";
    burstTime.value = "";
  });

  // Reset
  resetBtn.addEventListener("click", () => {
    processes = [];
    editIndex = null;
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
      if (!tq || tq <= 0) {
        alert("⚠️ Enter valid Time Quantum");
        return;
      }
      result = runRR(copy(processes), tq);
    }

    renderResults(result.completed);
    renderGantt(result.timeline);
    renderMetrics(result.completed);
  });

  // Dark mode toggle
  toggleTheme.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    toggleTheme.textContent = document.body.classList.contains("dark") ? "☀️ Light Mode" : "🌙 Dark Mode";
  });

  // --- Rendering functions ---
  function renderProcessList() {
    tblProcessListBody.innerHTML = "";
    if (processes.length === 0) {
      tblProcessListBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No processes yet</td></tr>`;
      return;
    }
    processes
      .slice()
      .sort((a, b) => a.arrivalTime - b.arrivalTime || a.processID - b.processID)
      .forEach((p, idx) => {
        const tr = create("tr");
        tr.innerHTML = `
          <td>P${p.processID}</td>
          <td>${p.arrivalTime}</td>
          <td>${p.burstTime}</td>
          <td>
            <button class="btn btn-sm btn-warning me-1">✏️ Edit</button>
            <button class="btn btn-sm btn-danger">🗑️ Delete</button>
          </td>`;
        // Edit
        tr.querySelector(".btn-warning").addEventListener("click", () => {
          processID.value = p.processID;
          arrivalTime.value = p.arrivalTime;
          burstTime.value = p.burstTime;
          editIndex = idx;
          btnAddProcess.textContent = "✏️ Update Process";
        });
        // Delete
        tr.querySelector(".btn-danger").addEventListener("click", () => {
          processes.splice(idx, 1);
          renderProcessList();
        });
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

  function renderGantt(timeline) {
    ganttChart.innerHTML = "";
    if (timeline.length === 0) {
      ganttChart.innerHTML = `<div class="text-muted">No timeline generated</div>`;
      return;
    }
    timeline.forEach(seg => {
      const block = create("div", {
        className: "gantt-block animate__animated animate__fadeInUp"
      });
      block.style.backgroundColor = getColor(seg.pid);
      block.style.minWidth = (seg.end - seg.start) * 40 + "px";
      block.innerText = "P" + seg.pid + ` (${seg.start}-${seg.end})`;
      ganttChart.appendChild(block);
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
  const colors = ["#007bff","#28a745","#ffc107","#dc3545","#6f42c1","#20c997"];
  function getColor(pid) {
    return colors[pid % colors.length];
  }

  // --- Algorithms ---
  function runFCFS(list) {
    list.sort((a, b) => a.arrivalTime - b.arrivalTime);
    let time = 0, completed = [], timeline = [];
    for (let p of list) {
      if (time < p.arrivalTime) time = p.arrivalTime;
      const start = time;
      time += p.burstTime;
      const end = time;
      completed.push({ ...p, completedTime: end, turnAroundTime: end - p.arrivalTime, waitingTime: (end - p.arrivalTime) - p.burstTime });
      timeline.push({ pid: p.processID, start, end });
    }
    return { completed, timeline };
  }

  function runSJF(list) {
    let time = 0, completed = [], timeline = [], ready = [];
    list.sort((a, b) => a.arrivalTime - b.arrivalTime);
    while (list.length || ready.length) {
      while (list.length && list[0].arrivalTime <= time) ready.push(list.shift());
      if (!ready.length) { time = list[0].arrivalTime; continue; }
      ready.sort((a, b) => a.burstTime - b.burstTime);
      const p = ready.shift();
      const start = time;
      time += p.burstTime;
      const end = time;
      completed.push({ ...p, completedTime: end, turnAroundTime: end - p.arrivalTime, waitingTime: (end - p.arrivalTime) - p.burstTime });
      timeline.push({ pid: p.processID, start, end });
    }
    return { completed, timeline };
  }

  function runSRTF(list) {
    let time = 0, completed = [], timeline = [], ready = [];
    list = list.map(p => ({ ...p, rem: p.burstTime }));
    list.sort((a, b) => a.arrivalTime - b.arrivalTime);
    let current = null, lastStart = 0;
    while (list.length || ready.length || current) {
      while (list.length && list[0].arrivalTime <= time) ready.push(list.shift());
      if (!current) {
        if (!ready.length) { time = list[0].arrivalTime; continue; }
        ready.sort((a, b) => a.rem - b.rem);
        current = ready.shift();
        lastStart = time;
      }
      current.rem--; time++;
      if (current.rem === 0) {
        completed.push({ ...current, completedTime: time, turnAroundTime: time - current.arrivalTime, waitingTime: (time - current.arrivalTime) - current.burstTime });
        timeline.push({ pid: current.processID, start: lastStart, end: time });
        current = null;
      } else {
        while (list.length && list[0].arrivalTime <= time) ready.push(list.shift());
        if (ready.length && ready.some(p => p.rem < current.rem)) {
          timeline.push({ pid: current.processID, start: lastStart, end: time });
          ready.push(current);
          current = null;
        }
      }
    }
    return { completed, timeline };
  }

  function runRR(list, tq) {
    let time = 0, completed = [], timeline = [], ready = [];
    list = list.map(p => ({ ...p, rem: p.burstTime }));
    list.sort((a, b) => a.arrivalTime - b.arrivalTime);
    while (list.length || ready.length) {
      while (list.length && list[0].arrivalTime <= time) ready.push(list.shift());
      if (!ready.length) { time = list[0].arrivalTime; continue; }
      const p = ready.shift();
      const exec = Math.min(tq, p.rem);
      const start = time;
      time += exec;
      const end = time;
      p.rem -= exec;
      timeline.push({ pid: p.processID, start, end });
      if (p.rem === 0) {
        completed.push({ ...p, completedTime: end, turnAroundTime: end - p.arrivalTime, waitingTime: (end - p.arrivalTime) - p.burstTime });
      } else {
        while (list.length && list[0].arrivalTime <= time) ready.push(list.shift());
        ready.push(p);
      }
    }
    return { completed, timeline };
  }

  // --- Export PDF ---
  btnDownloadPDF.addEventListener("click", () => {
    import("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js").then(jsPDF => {
      const { jsPDF: JSPDF } = jsPDF;
      const doc = new JSPDF();

      doc.text("CPU Scheduling Results", 14, 20);
      doc.autoTable({ html: "#tblResults", startY: 30 });
      doc.text(`Avg TAT: ${avgTAT.value}`, 14, doc.lastAutoTable.finalY + 10);
      doc.text(`Avg WT: ${avgWT.value}`, 14, doc.lastAutoTable.finalY + 20);
      doc.text(`Throughput: ${throughput.value}`, 14, doc.lastAutoTable.finalY + 30);
      doc.textWithLink("Created by Harshsfd", 14, doc.lastAutoTable.finalY + 50, { url: "https://www.linkedin.com/in/harshsfd" });
      doc.save("results.pdf");
    });
  });

  // --- Export CSV ---
  btnDownloadCSV.addEventListener("click", () => {
    let csv = "Process ID,Arrival,Burst,Completion,Waiting,Turnaround\n";
    [...tblResultsBody.querySelectorAll("tr")].forEach(row => {
      const cells = row.querySelectorAll("td");
      if (cells.length) {
        csv += [...cells].map(c => c.innerText).join(",") + "\n";
      }
    });
    csv += `\nAvg TAT,${avgTAT.value}\nAvg WT,${avgWT.value}\nThroughput,${throughput.value}\nCreated by Harshsfd,https://www.linkedin.com/in/harshsfd\n`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "results.csv";
    a.click();
    URL.revokeObjectURL(url);
  });
});