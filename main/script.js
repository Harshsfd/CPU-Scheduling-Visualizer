// script.js — robust, debug-friendly, fully working
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  // ---- small helpers ----
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from((ctx || document).querySelectorAll(sel));
  const create = (tag, attrs = {}) => Object.assign(document.createElement(tag), attrs);
  const toInt = v => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : NaN;
  };
  const isNonNeg = n => Number.isInteger(n) && n >= 0;
  const isPos = n => Number.isInteger(n) && n > 0;
  const fixNum = (n, d = 2) => (typeof n === "number" && isFinite(n) ? n.toFixed(d) : "");

  // ---- elements (guarded) ----
  const processID = $("#processID");
  const arrivalTime = $("#arrivalTime");
  const burstTime = $("#burstTime");
  const btnAddProcess = $("#btnAddProcess");
  const resetBtn = $("#resetBtn");
  const algorithmSelector = $("#algorithmSelector");
  const timeQuantumWrap = $("#timeQuantumWrap");
  const timeQuantum = $("#timeQuantum");
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

  // sanity checks:
  if (!processID || !arrivalTime || !burstTime || !btnAddProcess) {
    console.error("Critical inputs/buttons missing in DOM. Check IDs in main.html");
  }
  if (!tblProcessListBody || !tblResultsBody) {
    console.error("Tables (tblProcessList or tblResults) missing. Check main.html");
  }

  // ---- state ----
  let processes = []; // array of {processID, arrivalTime, burstTime}
  let editingPID = null; // when editing, store the original PID
  let lastRun = { completed: [], timeline: [], algo: null, tq: null };

  // ---- theme init ----
  try {
    const saved = localStorage.getItem("cpu-sim-theme");
    if (saved === "dark") document.body.classList.add("dark");
    if (toggleTheme) {
      toggleTheme.textContent = document.body.classList.contains("dark") ? "☀️ Light Mode" : "🌙 Dark Mode";
      toggleTheme.addEventListener("click", () => {
        const isDark = document.body.classList.toggle("dark");
        localStorage.setItem("cpu-sim-theme", isDark ? "dark" : "light");
        toggleTheme.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
      });
    }
  } catch (e) {
    console.warn("Theme init failed:", e);
  }

  // ---- show/hide time quantum ----
  if (algorithmSelector && timeQuantumWrap) {
    const updateTQ = () => {
      timeQuantumWrap.style.display = (algorithmSelector.value === "optRR") ? "block" : "none";
    };
    algorithmSelector.addEventListener("change", updateTQ);
    updateTQ();
  }

  // ---- render process list ----
  function renderProcessList() {
    if (!tblProcessListBody) return;
    tblProcessListBody.innerHTML = "";

    if (!processes.length) {
      const tr = create("tr", { className: "table-empty" });
      tr.innerHTML = `<td colspan="4" class="text-center text-muted">No processes yet. Add some!</td>`;
      tblProcessListBody.appendChild(tr);
      return;
    }

    // For display, sort by arrivalTime then PID (but we will reference original indices by PID)
    const sorted = processes.slice().sort((a, b) => a.arrivalTime - b.arrivalTime || a.processID - b.processID);

    sorted.forEach(proc => {
      const tr = create("tr");
      tr.innerHTML = `
        <td>P${proc.processID}</td>
        <td>${proc.arrivalTime}</td>
        <td>${proc.burstTime}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-primary btn-edit">✏️</button>
          <button class="btn btn-sm btn-outline-danger btn-del">🗑️</button>
        </td>
      `;
      // attach using dataset PID to locate original index when clicked
      tr.querySelector(".btn-edit").dataset.pid = proc.processID;
      tr.querySelector(".btn-del").dataset.pid = proc.processID;
      tblProcessListBody.appendChild(tr);
    });

    // bind actions (delegation-like)
    $$(".btn-edit", tblProcessListBody).forEach(btn => {
      btn.onclick = () => {
        const pid = toInt(btn.dataset.pid);
        const idx = processes.findIndex(p => p.processID === pid);
        if (idx === -1) return console.warn("Edit: PID not found", pid);
        const p = processes[idx];
        processID.value = p.processID;
        arrivalTime.value = p.arrivalTime;
        burstTime.value = p.burstTime;
        editingPID = p.processID;
        if (btnAddProcess) btnAddProcess.textContent = "✏️ Update Process";
      };
    });
    $$(".btn-del", tblProcessListBody).forEach(btn => {
      btn.onclick = () => {
        const pid = toInt(btn.dataset.pid);
        processes = processes.filter(p => p.processID !== pid);
        // if editing that PID, cancel edit
        if (editingPID === pid) {
          editingPID = null;
          if (btnAddProcess) btnAddProcess.textContent = "➕ Add / Update Process";
          processID.value = "";
          arrivalTime.value = "";
          burstTime.value = "";
        }
        renderProcessList();
        clearOutputs();
      };
    });
  }

  // ---- add / update process ----
  if (btnAddProcess) {
    btnAddProcess.addEventListener("click", () => {
      try {
        const pid = toInt(processID.value);
        const at = toInt(arrivalTime.value);
        const bt = toInt(burstTime.value);

        if (!isNonNeg(pid)) return alert("⚠️ Enter valid Process ID (0 or positive integer).");
        if (!isNonNeg(at)) return alert("⚠️ Enter valid Arrival Time (0 or positive integer).");
        if (!isPos(bt)) return alert("⚠️ Enter valid Burst Time (> 0).");

        if (editingPID === null) {
          // adding
          if (processes.some(p => p.processID === pid)) {
            return alert("⚠️ Duplicate Process ID not allowed!");
          }
          processes.push({ processID: pid, arrivalTime: at, burstTime: bt });
        } else {
          // updating existing (find it)
          const idx = processes.findIndex(p => p.processID === editingPID);
          if (idx === -1) {
            alert("⚠️ The process you were editing no longer exists.");
            editingPID = null;
            return renderProcessList();
          }
          // if PID changed ensure not duplicate
          if (pid !== editingPID && processes.some(p => p.processID === pid)) {
            return alert("⚠️ Another process with this Process ID already exists.");
          }
          processes[idx] = { processID: pid, arrivalTime: at, burstTime: bt };
          editingPID = null;
          btnAddProcess.textContent = "➕ Add / Update Process";
        }

        // reset inputs
        processID.value = "";
        arrivalTime.value = "";
        burstTime.value = "";

        renderProcessList();
        clearOutputs();
      } catch (err) {
        console.error("Add/Update process error:", err);
        alert("An error occurred while adding/updating the process. See console for details.");
      }
    });
  }

  // ---- reset ----
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      processes = [];
      editingPID = null;
      if (btnAddProcess) btnAddProcess.textContent = "➕ Add / Update Process";
      renderProcessList();
      clearOutputs();
    });
  }

  // ---- calculate button ----
  if (btnCalculate) {
    btnCalculate.addEventListener("click", () => {
      try {
        if (!processes.length) return alert("⚠️ Add at least one process.");

        // clear old outputs
        clearOutputs();

        const algo = (algorithmSelector && algorithmSelector.value) || "optFCFS";
        let res = null;
        if (algo === "optFCFS") res = runFCFS(copy(processes));
        else if (algo === "optSJF") res = runSJF(copy(processes));
        else if (algo === "optSRTF") res = runSRTF(copy(processes));
        else if (algo === "optRR") {
          const tq = toInt(timeQuantum && timeQuantum.value);
          if (!isPos(tq)) return alert("⚠️ Enter valid Time Quantum (> 0).");
          res = runRR(copy(processes), tq);
        } else return alert("⚠️ Unknown algorithm selected.");

        // show
        lastRun.completed = res.completed;
        lastRun.timeline = res.timeline;
        lastRun.algo = algo;
        lastRun.tq = (algo === "optRR") ? toInt(timeQuantum.value) : null;

        renderResults(res.completed);
        renderGantt(res.timeline);
        renderMetrics(res.completed);
      } catch (err) {
        console.error("Calculation failed:", err);
        alert("Calculation failed. See console for details.");
      }
    });
  }

  // ---- render results / metrics / gantt / clear ----
  function renderResults(completed) {
    if (!tblResultsBody) return;
    tblResultsBody.innerHTML = "";
    if (!completed.length) {
      const tr = create("tr", { className: "table-empty" });
      tr.innerHTML = `<td colspan="6" class="text-center text-muted">No results</td>`;
      tblResultsBody.appendChild(tr);
      return;
    }
    completed.forEach(p => {
      const tr = create("tr");
      tr.innerHTML = `
        <td>P${p.processID}</td>
        <td>${p.arrivalTime}</td>
        <td>${p.burstTime}</td>
        <td>${p.completedTime}</td>
        <td>${p.waitingTime}</td>
        <td>${p.turnaroundTime}</td>
      `;
      tblResultsBody.appendChild(tr);
    });
  }

  function renderMetrics(completed) {
    const metrics = computeMetrics(completed);
    if (avgTAT) avgTAT.value = fixNum(metrics.avgTAT);
    if (avgWT) avgWT.value = fixNum(metrics.avgWT);
    if (throughput) throughput.value = fixNum(metrics.throughput);
  }

  function renderGantt(timeline) {
    if (!ganttChart) return;
    ganttChart.innerHTML = "";
    if (!timeline || !timeline.length) {
      ganttChart.innerHTML = `<div class="text-muted">No timeline generated</div>`;
      return;
    }

    // Merge adjacent same-PID segments
    const merged = [];
    for (const s of timeline) {
      if (!merged.length) merged.push({ ...s });
      else {
        const last = merged[merged.length - 1];
        if (last.pid === s.pid && last.end === s.start) {
          last.end = s.end;
        } else merged.push({ ...s });
      }
    }

    merged.forEach((seg, i) => {
      const block = create("div", { className: "gantt-block" });
      // color
      if (typeof seg.pid === "number") block.style.background = getColor(seg.pid);
      else block.style.background = "#94a3b8"; // idle color
      const widthPx = Math.max((seg.end - seg.start) * 36, 56);
      block.style.minWidth = widthPx + "px";
      block.innerHTML = `${(typeof seg.pid === "number") ? "P" + seg.pid : "Idle"} <small>(${seg.start}-${seg.end})</small>`;
      // animate in
      block.style.opacity = 0;
      block.style.transform = "translateY(6px)";
      ganttChart.appendChild(block);
      setTimeout(() => {
        block.style.transition = "all .32s ease";
        block.style.opacity = 1;
        block.style.transform = "translateY(0)";
      }, i * 60);
    });
  }

  function clearOutputs() {
    if (tblResultsBody) tblResultsBody.innerHTML = `<tr class="table-empty"><td colspan="6" class="text-center text-muted">Run an algorithm to see results</td></tr>`;
    if (ganttChart) ganttChart.innerHTML = "";
    if (avgTAT) avgTAT.value = "";
    if (avgWT) avgWT.value = "";
    if (throughput) throughput.value = "";
    lastRun = { completed: [], timeline: [], algo: null, tq: null };
  }

  // ---- algorithms (robust versions) ----

  // helper to create result object (no rem field)
  function finalizeResult(p, completionTime) {
    const tat = completionTime - p.arrivalTime;
    const wt = tat - p.burstTime;
    return {
      processID: p.processID,
      arrivalTime: p.arrivalTime,
      burstTime: p.burstTime,
      completedTime: completionTime,
      waitingTime: wt,
      turnaroundTime: tat
    };
  }

  function runFCFS(list) {
    list.sort((a, b) => a.arrivalTime - b.arrivalTime || a.processID - b.processID);
    let time = 0;
    const completed = [];
    const timeline = [];
    for (const p of list) {
      if (time < p.arrivalTime) {
        timeline.push({ pid: "IDLE", start: time, end: p.arrivalTime });
        time = p.arrivalTime;
      }
      const start = time;
      time += p.burstTime;
      const end = time;
      completed.push(finalizeResult(p, end));
      timeline.push({ pid: p.processID, start, end });
    }
    return { completed, timeline };
  }

  function runSJF(list) {
    list.sort((a, b) => a.arrivalTime - b.arrivalTime || a.processID - b.processID);
    let time = 0;
    const completed = [];
    const timeline = [];
    const ready = [];

    while (list.length || ready.length) {
      while (list.length && list[0].arrivalTime <= time) ready.push(list.shift());
      if (!ready.length) {
        // idle to next arrival
        const next = list[0].arrivalTime;
        timeline.push({ pid: "IDLE", start: time, end: next });
        time = next;
        continue;
      }
      ready.sort((a, b) => a.burstTime - b.burstTime || a.arrivalTime - b.arrivalTime || a.processID - b.processID);
      const p = ready.shift();
      const start = time;
      time += p.burstTime;
      const end = time;
      completed.push(finalizeResult(p, end));
      timeline.push({ pid: p.processID, start, end });
    }
    return { completed, timeline };
  }

  function runSRTF(list) {
    // preemptive shortest remaining
    list = list.map(p => ({ ...p, rem: p.burstTime }));
    list.sort((a, b) => a.arrivalTime - b.arrivalTime || a.processID - b.processID);
    let time = 0;
    const ready = [];
    const timeline = [];
    const completed = [];
    let current = null;
    let lastStart = 0;

    while (list.length || ready.length || current) {
      while (list.length && list[0].arrivalTime <= time) ready.push(list.shift());
      if (!current) {
        if (!ready.length) {
          // idle to next arrival
          const next = list[0].arrivalTime;
          timeline.push({ pid: "IDLE", start: time, end: next });
          time = next;
          continue;
        }
        ready.sort((a, b) => a.rem - b.rem || a.arrivalTime - b.arrivalTime || a.processID - b.processID);
        current = ready.shift();
        lastStart = time;
      }
      // run one unit
      current.rem--;
      time++;
      // arrivals may appear at this time
      while (list.length && list[0].arrivalTime <= time) ready.push(list.shift());
      // finished?
      if (current.rem === 0) {
        timeline.push({ pid: current.processID, start: lastStart, end: time });
        completed.push(finalizeResult(current, time));
        current = null;
      } else {
        // check preempt
        if (ready.length && ready.some(r => r.rem < current.rem)) {
          timeline.push({ pid: current.processID, start: lastStart, end: time });
          ready.push(current);
          current = null;
        }
      }
    }
    return { completed, timeline };
  }

  function runRR(list, tq) {
    list = list.map(p => ({ ...p, rem: p.burstTime }));
    list.sort((a, b) => a.arrivalTime - b.arrivalTime || a.processID - b.processID);
    let time = 0;
    const ready = [];
    const timeline = [];
    const completed = [];

    while (list.length || ready.length) {
      while (list.length && list[0].arrivalTime <= time) ready.push(list.shift());
      if (!ready.length) {
        const next = list[0].arrivalTime;
        timeline.push({ pid: "IDLE", start: time, end: next });
        time = next;
        continue;
      }
      const p = ready.shift();
      const exec = Math.min(tq, p.rem);
      const start = time;
      time += exec;
      const end = time;
      p.rem -= exec;
      timeline.push({ pid: p.processID, start, end });
      // new arrivals during this quantum
      while (list.length && list[0].arrivalTime <= time) ready.push(list.shift());
      if (p.rem === 0) {
        completed.push(finalizeResult(p, end));
      } else {
        ready.push(p);
      }
    }
    return { completed, timeline };
  }

  // ---- utilities ----
  function copy(arr) { return arr.map(x => ({ ...x })); }

  function computeMetrics(completed) {
    if (!completed.length) return { avgTAT: 0, avgWT: 0, throughput: 0 };
    const totalTAT = completed.reduce((s, p) => s + p.turnaroundTime, 0);
    const totalWT = completed.reduce((s, p) => s + p.waitingTime, 0);
    const maxCT = Math.max(...completed.map(p => p.completedTime));
    return {
      avgTAT: totalTAT / completed.length,
      avgWT: totalWT / completed.length,
      throughput: completed.length / (maxCT || 1)
    };
  }

  // color generator (safe)
  const COLORS = ["#2563eb","#10b981","#a855f7","#f59e0b","#ef4444","#14b8a6","#6366f1","#f97316"];
  function getColor(pid) {
    if (typeof pid !== "number") return "#64748b";
    return COLORS[Math.abs(pid) % COLORS.length];
  }

  // ---- export: CSV (works even without jspdf) ----
  if (btnDownloadCSV) {
    btnDownloadCSV.addEventListener("click", () => {
      try {
        if (!lastRun.completed || !lastRun.completed.length) return alert("⚠️ Run an algorithm first to export.");
        const rows = [];
        rows.push(["CPU Scheduling Results"]);
        rows.push(["Algorithm", algoName(lastRun.algo, lastRun.tq)]);
        rows.push(["Generated", new Date().toLocaleString()]);
        rows.push([]);
        rows.push(["Process ID","Arrival","Burst","Completion","Waiting","Turnaround"]);
        lastRun.completed.forEach(p => rows.push([`P${p.processID}`, p.arrivalTime, p.burstTime, p.completedTime, p.waitingTime, p.turnaroundTime]));
        rows.push([]);
        const m = computeMetrics(lastRun.completed);
        rows.push(["Average Turnaround Time", fixNum(m.avgTAT)]);
        rows.push(["Average Waiting Time", fixNum(m.avgWT)]);
        rows.push(["Throughput", fixNum(m.throughput)]);
        rows.push([]);
        rows.push(["Gantt Timeline", timelineToText(lastRun.timeline)]);
        rows.push([]);
        rows.push(["Generated by Harshsfd", "https://www.linkedin.com/in/harshsfd"]);

        const csv = rows.map(r => r.map(cell => {
          // escape comma/quotes
          const s = String(cell ?? "");
          if (s.includes(",") || s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
          return s;
        }).join(",")).join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = create("a", { href: url, download: "results.csv" });
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("CSV export failed:", err);
        alert("CSV export failed (see console).");
      }
    });
  }

  // ---- export: PDF (requires jspdf + autotable loaded in HTML) ----
  if (btnDownloadPDF) {
    btnDownloadPDF.addEventListener("click", () => {
      try {
        if (!lastRun.completed || !lastRun.completed.length) return alert("⚠️ Run an algorithm first to export.");
        if (!window.jspdf || !window.jspdf.jsPDF) {
          alert("⚠️ jsPDF not loaded. Ensure you included jspdf and jspdf-autotable scripts in HTML.");
          return;
        }
        const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
        doc.setFontSize(16);
        doc.text("CPU Scheduling Results", 14, 16);
        doc.setFontSize(11);
        doc.text(`Algorithm: ${algoName(lastRun.algo, lastRun.tq)}`, 14, 24);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

        // Prepare data for autoTable
        const head = [["Process ID","Arrival","Burst","Completion","Waiting","Turnaround"]];
        const body = lastRun.completed.map(p => [`P${p.processID}`, p.arrivalTime, p.burstTime, p.completedTime, p.waitingTime, p.turnaroundTime]);

        doc.autoTable({
          head,
          body,
          startY: 36,
          theme: "grid",
          headStyles: { fillColor: [37,99,235], textColor: 255, halign: "center" },
          styles: { fontSize: 10 }
        });

        const metrics = computeMetrics(lastRun.completed);
        let y = doc.lastAutoTable.finalY + 8;
        doc.setFontSize(12);
        doc.text("Metrics:", 14, y);
        doc.setFontSize(10);
        y += 6;
        doc.text(`Average Turnaround Time: ${fixNum(metrics.avgTAT)}`, 16, y);
        y += 6;
        doc.text(`Average Waiting Time: ${fixNum(metrics.avgWT)}`, 16, y);
        y += 6;
        doc.text(`Throughput: ${fixNum(metrics.throughput)}`, 16, y);

        // Gantt timeline (text)
        y += 10;
        doc.setFontSize(11);
        doc.text("Gantt Chart:", 14, y);
        y += 6;
        const gantText = timelineToText(lastRun.timeline);
        const lines = doc.splitTextToSize(gantText, 180);
        doc.setFontSize(10);
        doc.text(lines, 16, y);

        // Footer (clickable link if supported)
        const footerY = 287;
        try {
          if (typeof doc.textWithLink === "function") {
            doc.setTextColor(0, 0, 200);
            doc.textWithLink("Generated by Harshsfd", 14, footerY, { url: "https://www.linkedin.com/in/harshsfd" });
            doc.setTextColor(0,0,0);
          } else {
            // fallback: text + invisible clickable area
            doc.setTextColor(0, 0, 200);
            doc.text("Generated by Harshsfd", 14, footerY);
            // approximate link rectangle
            doc.link(14, footerY - 4, 50, 6, { url: "https://www.linkedin.com/in/harshsfd" });
            doc.setTextColor(0,0,0);
          }
        } catch (e) {
          // ignore
          doc.text("Generated by Harshsfd", 14, footerY);
        }

        doc.save("results.pdf");
      } catch (err) {
        console.error("PDF export failed:", err);
        alert("PDF export failed (see console).");
      }
    });
  }

  // ---- utilities used by exports ----
  function algoName(code, tq) {
    switch (code) {
      case "optFCFS": return "First Come First Served (FCFS)";
      case "optSJF": return "Shortest Job First (SJF)";
      case "optSRTF": return "Shortest Remaining Time First (SRTF)";
      case "optRR": return `Round Robin (TQ=${tq || "?"})`;
      default: return code || "";
    }
  }

  function timelineToText(timeline) {
    if (!timeline || !timeline.length) return "";
    return timeline.map(s => {
      return (typeof s.pid === "number" ? `P${s.pid}` : "Idle") + ` (${s.start}-${s.end})`;
    }).join(" → ");
  }

  // ---- initial render ----
  (function init() {
    try {
      renderProcessList();
      clearOutputs();
    } catch (e) {
      console.error("Initialization error:", e);
    }
  })();

  // ---- small helper: deep copy ----
  function copy(arr) {
    return arr.map(o => ({ ...o }));
  }

  // ---- debug exposed helpers (optional) ----
  window.__cpuSim = {
    processes,
    getLastRun: () => lastRun,
    renderProcessList,
    runFCFS, runSJF, runSRTF, runRR
  };

}); // DOMContentLoaded end