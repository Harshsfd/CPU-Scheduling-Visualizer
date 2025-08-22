/* =========================
   CPU Scheduling Simulator
   Author: HARSHSFD
========================= */

let processes = [];
let editIndex = -1;

// DOM elements
const processID = document.getElementById("processID");
const arrivalTime = document.getElementById("arrivalTime");
const burstTime = document.getElementById("burstTime");
const btnAddProcess = document.getElementById("btnAddProcess");
const tblProcessList = document.getElementById("tblProcessList").querySelector("tbody");
const resetBtn = document.getElementById("resetBtn");
const algorithmSelector = document.getElementById("algorithmSelector");
const timeQuantumWrap = document.getElementById("timeQuantumWrap");
const timeQuantumInput = document.getElementById("timeQuantum");

const btnCalculate = document.getElementById("btnCalculate");
const tblResults = document.getElementById("tblResults").querySelector("tbody");
const ganttChart = document.getElementById("ganttChart");

const avgTAT = document.getElementById("avgTurnaroundTime");
const avgWT = document.getElementById("avgWaitingTime");
const throughput = document.getElementById("throughput");

const btnPDF = document.getElementById("btnDownloadPDF");
const btnCSV = document.getElementById("btnDownloadCSV");
const toggleTheme = document.getElementById("toggleTheme");

/* =========================
   Theme Toggle
========================= */
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
  toggleTheme.textContent = "☀️ Light Mode";
}

toggleTheme.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  if (document.body.classList.contains("dark")) {
    toggleTheme.textContent = "☀️ Light Mode";
    localStorage.setItem("theme", "dark");
  } else {
    toggleTheme.textContent = "🌙 Dark Mode";
    localStorage.setItem("theme", "light");
  }
});

/* =========================
   Add / Update Process
========================= */
btnAddProcess.addEventListener("click", () => {
  const pid = processID.value.trim();
  const at = arrivalTime.value.trim();
  const bt = burstTime.value.trim();

  if (!pid || !at || !bt) {
    alert("⚠️ Please fill all fields!");
    return;
  }

  const proc = {
    pid: `P${pid}`,
    arrival: parseInt(at),
    burst: parseInt(bt),
  };

  if (editIndex === -1) {
    processes.push(proc);
  } else {
    processes[editIndex] = proc;
    editIndex = -1;
    btnAddProcess.textContent = "➕ Add / Update Process";
  }

  clearInputs();
  renderProcessTable();
});

function clearInputs() {
  processID.value = "";
  arrivalTime.value = "";
  burstTime.value = "";
}

/* =========================
   Render Process Table
========================= */
function renderProcessTable() {
  tblProcessList.innerHTML = "";

  if (processes.length === 0) {
    tblProcessList.innerHTML = `<tr class="table-empty"><td colspan="4" class="text-center text-muted">No processes yet. Add some!</td></tr>`;
    return;
  }

  processes.forEach((p, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.pid}</td>
      <td>${p.arrival}</td>
      <td>${p.burst}</td>
      <td>
        <button class="btn btn-sm btn-warning me-1" onclick="editProcess(${i})">✏️ Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProcess(${i})">🗑 Delete</button>
      </td>
    `;
    tblProcessList.appendChild(tr);
  });
}

window.editProcess = function (i) {
  const p = processes[i];
  processID.value = p.pid.replace("P", "");
  arrivalTime.value = p.arrival;
  burstTime.value = p.burst;
  editIndex = i;
  btnAddProcess.textContent = "✏️ Update Process";
};

window.deleteProcess = function (i) {
  if (confirm("Delete this process?")) {
    processes.splice(i, 1);
    renderProcessTable();
  }
};

/* =========================
   Reset
========================= */
resetBtn.addEventListener("click", () => {
  processes = [];
  editIndex = -1;
  renderProcessTable();
  clearResults();
});

/* =========================
   Algorithm Selector
========================= */
algorithmSelector.addEventListener("change", () => {
  if (algorithmSelector.value === "optRR") {
    timeQuantumWrap.style.display = "block";
  } else {
    timeQuantumWrap.style.display = "none";
  }
});

/* =========================
   Calculate (Placeholder)
========================= */
btnCalculate.addEventListener("click", () => {
  if (processes.length === 0) {
    alert("⚠️ Please add processes first!");
    return;
  }

  // Just for demo, sort by arrival
  let results = processes.map((p, idx) => ({
    ...p,
    completion: p.arrival + p.burst + idx * 2,
    waiting: Math.max(0, idx * 2),
    tat: p.burst + Math.max(0, idx * 2),
  }));

  renderResults(results);
  renderGanttChart(results);
});

function clearResults() {
  tblResults.innerHTML = `<tr class="table-empty"><td colspan="6" class="text-center text-muted">Run an algorithm to see results</td></tr>`;
  ganttChart.innerHTML = "";
  avgTAT.value = "";
  avgWT.value = "";
  throughput.value = "";
}

/* =========================
   Render Results
========================= */
function renderResults(results) {
  tblResults.innerHTML = "";
  let totalTAT = 0, totalWT = 0;

  results.forEach((r, i) => {
    totalTAT += r.tat;
    totalWT += r.waiting;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.pid}</td>
      <td>${r.arrival}</td>
      <td>${r.burst}</td>
      <td>${r.completion}</td>
      <td>${r.waiting}</td>
      <td>${r.tat}</td>
    `;
    tblResults.appendChild(tr);
  });

  avgTAT.value = (totalTAT / results.length).toFixed(2);
  avgWT.value = (totalWT / results.length).toFixed(2);
  throughput.value = (results.length / results[results.length - 1].completion).toFixed(2);
}

/* =========================
   Gantt Chart
========================= */
function renderGanttChart(results) {
  ganttChart.innerHTML = "";
  results.forEach((r, i) => {
    const div = document.createElement("div");
    div.className = `gantt-block color-${i % 8}`;
    div.innerHTML = `${r.pid}<small>${r.completion}</small>`;
    ganttChart.appendChild(div);

    setTimeout(() => { div.style.opacity = 1; div.style.transform = "translateY(0)"; }, 100 * i);
  });
}

/* =========================
   Download PDF
========================= */
btnPDF.addEventListener("click", () => {
  if (tblResults.querySelectorAll("tr").length <= 1) {
    alert("⚠️ Please calculate results first!");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("CPU Scheduling Results", 14, 15);

  doc.autoTable({ html: "#tblResults", startY: 25 });

  doc.text(`Avg Turnaround Time: ${avgTAT.value}`, 14, doc.lastAutoTable.finalY + 10);
  doc.text(`Avg Waiting Time: ${avgWT.value}`, 14, doc.lastAutoTable.finalY + 20);
  doc.text(`Throughput: ${throughput.value}`, 14, doc.lastAutoTable.finalY + 30);

  doc.textWithLink("Generated by HARSHSFD", 14, doc.lastAutoTable.finalY + 45, {
    url: "https://www.linkedin.com/in/harshsfd",
  });

  doc.save("results.pdf");
});

/* =========================
   Download CSV
========================= */
btnCSV.addEventListener("click", () => {
  if (tblResults.querySelectorAll("tr").length <= 1) {
    alert("⚠️ Please calculate results first!");
    return;
  }

  let csv = "Process ID,Arrival,Burst,Completion,Waiting,TAT\n";
  [...tblResults.querySelectorAll("tr")].forEach(row => {
    let cols = row.querySelectorAll("td");
    if (cols.length) {
      csv += [...cols].map(c => c.innerText).join(",") + "\n";
    }
  });
  csv += `\nAvg TAT,${avgTAT.value}\nAvg WT,${avgWT.value}\nThroughput,${throughput.value}\nGenerated by,https://www.linkedin.com/in/harshsfd`;

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "results.csv";
  a.click();
});