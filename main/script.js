let processes = [];
let ganttChartData = [];

// Input fields
const processID = document.getElementById("processID");
const arrivalTime = document.getElementById("arrivalTime");
const burstTime = document.getElementById("burstTime");
const algorithmSelector = document.getElementById("algorithmSelector");
const timeQuantum = document.getElementById("timeQuantum");

// Buttons
const btnAddProcess = document.getElementById("btnAddProcess");
const btnCalculate = document.getElementById("btnCalculate");
const resetBtn = document.getElementById("resetBtn");
const toggleTheme = document.getElementById("toggleTheme");
const btnExportCSV = document.getElementById("btnExportCSV");
const btnExportPDF = document.getElementById("btnExportPDF");

// Table
const tblProcessList = document.querySelector("#tblProcessList tbody");
const tblResults = document.querySelector("#tblResults tbody");
const ganttChart = document.getElementById("ganttChart");

// Metrics
const avgTurnaroundTime = document.getElementById("avgTurnaroundTime");
const avgWaitingTime = document.getElementById("avgWaitingTime");
const throughput = document.getElementById("throughput");

let editIndex = -1; // track editing process

// 🎯 Render Process List
function renderProcessList() {
  tblProcessList.innerHTML = "";
  processes.forEach((p, index) => {
    tblProcessList.innerHTML += `
      <tr>
        <td>P${p.processID}</td>
        <td>${p.arrivalTime}</td>
        <td>${p.burstTime}</td>
        <td>
          <button class="btn btn-warning btn-sm" onclick="editProcess(${index})">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="removeProcess(${index})">❌ Delete</button>
        </td>
      </tr>`;
  });
}

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

  const process = { processID: pid, arrivalTime: at, burstTime: bt };

  if (editIndex >= 0) {
    processes[editIndex] = process; // update
    editIndex = -1;
  } else {
    processes.push(process); // add
  }

  renderProcessList();
  processID.value = "";
  arrivalTime.value = "";
  burstTime.value = "";
});

// ✏️ Edit Process
function editProcess(index) {
  const p = processes[index];
  processID.value = p.processID;
  arrivalTime.value = p.arrivalTime;
  burstTime.value = p.burstTime;
  editIndex = index;
}

// ❌ Delete Process
function removeProcess(index) {
  processes.splice(index, 1);
  renderProcessList();
}

// 🔄 Reset
resetBtn.addEventListener("click", () => {
  processes = [];
  ganttChartData = [];
  renderProcessList();
  tblResults.innerHTML = "";
  ganttChart.innerHTML = "";
  avgTurnaroundTime.value = 0;
  avgWaitingTime.value = 0;
  throughput.value = 0;
});

// 🎨 Generate Gantt Chart
function renderGanttChart() {
  ganttChart.innerHTML = "";
  ganttChartData.forEach((g, i) => {
    const block = document.createElement("div");
    block.className = `gantt-block color-${g.processID % 8}`;
    block.innerHTML = `P${g.processID}<small>${g.start}-${g.end}</small>`;
    ganttChart.appendChild(block);
  });
}

// 📊 Calculate Button
btnCalculate.addEventListener("click", () => {
  if (processes.length === 0) {
    alert("⚠️ Add at least one process!");
    return;
  }

  const algo = algorithmSelector.value;
  if (algo === "optRR" && (!timeQuantum.value || timeQuantum.value <= 0)) {
    alert("⚠️ Enter valid Time Quantum for RR!");
    return;
  }

  let results = [];
  ganttChartData = [];

  switch (algo) {
    case "optFCFS": results = fcfs(); break;
    case "optSJF": results = sjf(); break;
    case "optSRTF": results = srtf(); break;
    case "optRR": results = rr(parseInt(timeQuantum.value)); break;
  }

  displayResults(results);
  renderGanttChart();
});

// 🖥️ Display Results
function displayResults(results) {
  tblResults.innerHTML = "";
  let totalWT = 0, totalTAT = 0;

  results.forEach(r => {
    totalWT += r.waitingTime;
    totalTAT += r.turnaroundTime;
    tblResults.innerHTML += `
      <tr>
        <td>P${r.processID}</td>
        <td>${r.arrivalTime}</td>
        <td>${r.burstTime}</td>
        <td>${r.completionTime}</td>
        <td>${r.waitingTime}</td>
        <td>${r.turnaroundTime}</td>
      </tr>`;
  });

  avgWaitingTime.value = (totalWT / results.length).toFixed(2);
  avgTurnaroundTime.value = (totalTAT / results.length).toFixed(2);
  throughput.value = (results.length / Math.max(...results.map(r => r.completionTime))).toFixed(2);
}

// 🧮 Algorithms
function fcfs() {
  let time = 0, results = [];
  const sorted = [...processes].sort((a, b) => a.arrivalTime - b.arrivalTime);
  sorted.forEach(p => {
    time = Math.max(time, p.arrivalTime);
    const start = time;
    time += p.burstTime;
    ganttChartData.push({ processID: p.processID, start, end: time });
    results.push({
      ...p,
      completionTime: time,
      turnaroundTime: time - p.arrivalTime,
      waitingTime: time - p.arrivalTime - p.burstTime
    });
  });
  return results;
}

function sjf() {
  let time = 0, results = [], ready = [], procs = [...processes];
  procs.sort((a, b) => a.arrivalTime - b.arrivalTime);

  while (procs.length > 0 || ready.length > 0) {
    while (procs.length > 0 && procs[0].arrivalTime <= time) {
      ready.push(procs.shift());
    }
    if (ready.length === 0) { time++; continue; }

    ready.sort((a, b) => a.burstTime - b.burstTime);
    const p = ready.shift();
    const start = time;
    time += p.burstTime;
    ganttChartData.push({ processID: p.processID, start, end: time });
    results.push({
      ...p,
      completionTime: time,
      turnaroundTime: time - p.arrivalTime,
      waitingTime: time - p.arrivalTime - p.burstTime
    });
  }
  return results;
}

function srtf() {
  let time = 0, results = [], ready = [], procs = processes.map(p => ({ ...p, remaining: p.burstTime }));
  procs.sort((a, b) => a.arrivalTime - b.arrivalTime);

  while (procs.length > 0 || ready.length > 0) {
    while (procs.length > 0 && procs[0].arrivalTime <= time) {
      ready.push(procs.shift());
    }
    if (ready.length === 0) { time++; continue; }

    ready.sort((a, b) => a.remaining - b.remaining);
    const p = ready[0];
    const start = time;
    p.remaining--;
    time++;
    if (p.remaining === 0) {
      p.completionTime = time;
      p.turnaroundTime = time - p.arrivalTime;
      p.waitingTime = p.turnaroundTime - p.burstTime;
      results.push(p);
      ready.shift();
    }
    ganttChartData.push({ processID: p.processID, start, end: time });
  }
  return results;
}

function rr(q) {
  let time = 0, results = [], ready = [], procs = processes.map(p => ({ ...p, remaining: p.burstTime }));
  procs.sort((a, b) => a.arrivalTime - b.arrivalTime);

  while (procs.length > 0 || ready.length > 0) {
    while (procs.length > 0 && procs[0].arrivalTime <= time) {
      ready.push(procs.shift());
    }
    if (ready.length === 0) { time++; continue; }

    const p = ready.shift();
    const start = time;
    const exec = Math.min(q, p.remaining);
    time += exec;
    p.remaining -= exec;
    ganttChartData.push({ processID: p.processID, start, end: time });
    if (p.remaining > 0) {
      while (procs.length > 0 && procs[0].arrivalTime <= time) {
        ready.push(procs.shift());
      }
      ready.push(p);
    } else {
      p.completionTime = time;
      p.turnaroundTime = time - p.arrivalTime;
      p.waitingTime = p.turnaroundTime - p.burstTime;
      results.push(p);
    }
  }
  return results;
}

// 🌙 Dark Mode
toggleTheme.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  toggleTheme.innerText = document.body.classList.contains("dark") ? "☀️ Light Mode" : "🌙 Dark Mode";
});

// 📤 Export CSV
btnExportCSV.addEventListener("click", () => {
  let csv = "ProcessID,ArrivalTime,BurstTime,CompletionTime,WaitingTime,TurnaroundTime\n";
  [...tblResults.rows].forEach(row => {
    let cols = [...row.cells].map(cell => cell.innerText);
    csv += cols.join(",") + "\n";
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "results.csv";
  a.click();
});

// 📤 Export PDF
btnExportPDF.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("CPU Scheduling Results", 10, 10);
  doc.autoTable({ html: "#tblResults", startY: 20 });
  doc.save("results.pdf");
});