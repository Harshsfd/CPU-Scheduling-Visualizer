/* ================================
   CPU Scheduling Simulator – script.js
   Works with your improved main.html & style.css
================================== */
(function () {
  "use strict";

  // ---------- Helpers ----------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const create = (tag, attrs = {}) => Object.assign(document.createElement(tag), attrs);
  const fmt = (n, d = 2) => (typeof n === "number" && isFinite(n) ? n.toFixed(d) : "");

  // ---------- Elements ----------
  const processID = $("#processID");
  const arrivalTime = $("#arrivalTime");
  const burstTime = $("#burstTime");
  const btnAddProcess = $("#btnAddProcess");
  const resetBtn = $("#resetBtn");

  const algorithmSelector = $("#algorithmSelector");
  const timeQuantumWrap = $("#timeQuantumWrap");
  const timeQuantum = $("#timeQuantum");

  const tblProcessList = $("#tblProcessList");
  const tblProcessListBody = $("#tblProcessList tbody");

  const tblResults = $("#tblResults");
  const tblResultsBody = $("#tblResults tbody");

  const avgTAT = $("#avgTurnaroundTime");
  const avgWT = $("#avgWaitingTime");
  const throughput = $("#throughput");

  const ganttChart = $("#ganttChart");

  const btnCalculate = $("#btnCalculate");
  const btnDownloadPDF = $("#btnDownloadPDF");
  const btnDownloadCSV = $("#btnDownloadCSV");

  const toggleThemeBtn = $("#toggleTheme");

  // ---------- State ----------
  /** @type {{processID:number, arrivalTime:number, burstTime:number}[]} */
  let processes = [];
  let editingPID = null; // when editing, holds original PID
  // last run cache
  let lastCompleted = [];
  let lastTimeline = [];
  let lastAlgo = "";
  let lastTQ = null;

  // ---------- Theme (Dark / Light) ----------
  initTheme();
  if (toggleThemeBtn) {
    toggleThemeBtn.addEventListener("click", () => {
      const dark = document.body.classList.toggle("dark");
      localStorage.setItem("cpu-sim-theme", dark ? "dark" : "light");
      setThemeButtonLabel();
    });
  }
  function initTheme() {
    const saved = localStorage.getItem("cpu-sim-theme");
    if (saved === "dark") document.body.classList.add("dark");
    setThemeButtonLabel();
  }
  function setThemeButtonLabel() {
    if (!toggleThemeBtn) return;
    const isDark = document.body.classList.contains("dark");
    toggleThemeBtn.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
  }

  // ---------- UI: Show/Hide Time Quantum ----------
  function updateTQVisibility() {
    timeQuantumWrap.style.display = algorithmSelector.value === "optRR" ? "block" : "none";
  }
  algorithmSelector.addEventListener("change", updateTQVisibility);
  updateTQVisibility();

  // ---------- Add / Update Process ----------
  btnAddProcess.addEventListener("click", () => {
    const pid = toInt(processID.value);
    const at = toInt(arrivalTime.value);
    const bt = toInt(burstTime.value);

    // Validate
    if (!isValidPID(pid)) return alert("⚠️ Enter a valid Process ID (non-negative integer).");
    if (!isNonNegInt(at)) return alert("⚠️ Enter a valid Arrival Time (0 or positive).");
    if (!isPosInt(bt)) return alert("⚠️ Enter a valid Burst Time (> 0).");

    if (editingPID === null) {
      // Add new
      if (processes.some(p => p.processID === pid)) {
        return alert("⚠️ Duplicate Process ID not allowed!");
      }
      processes.push({ processID: pid, arrivalTime: at, burstTime: bt });
    } else {
      // Update existing (editing)
      // If PID changed, ensure new PID not taken
      if (pid !== editingPID && processes.some(p => p.processID === pid)) {
        return alert("⚠️ This Process ID already exists. Choose a different one.");
      }
      const idx = processes.findIndex(p => p.processID === editingPID);
      if (idx >= 0) {
        processes[idx] = { processID: pid, arrivalTime: at, burstTime: bt };
      }
      editingPID = null;
      btnAddProcess.textContent = "➕ Add / Update Process";
    }

    // Reset input fields
    processID.value = "";
    arrivalTime.value = "";
    burstTime.value = "";

    // Re-render
    renderProcessList();
    clearOutputs();
  });

  // ---------- Reset ----------
  resetBtn.addEventListener("click", () => {
    processes = [];
    editingPID = null;
    btnAddProcess.textContent = "➕ Add / Update Process";
    renderProcessList();
    clearOutputs();
  });

  // ---------- Calculate ----------
  btnCalculate.addEventListener("click", () => {
    if (processes.length === 0) {
      alert("⚠️ Add processes first!");
      return;
    }
    clearOutputs();

    const algo = algorithmSelector.value;
    let res;
    if (algo === "optFCFS") res = runFCFS(copy(processes));
    else if (algo === "optSJF") res = runSJF(copy(processes));
    else if (algo === "optSRTF") res = runSRTF(copy(processes));
    else if (algo === "optRR") {
      const tq = toInt(timeQuantum.value);
      if (!isPosInt(tq)) {
        alert("⚠️ Enter valid Time Quantum (> 0)");
        return;
      }
      res = runRR(copy(processes), tq);
      lastTQ = tq;
    } else {
      alert("Unknown algorithm!");
      return;
    }

    lastAlgo = algo;
    lastCompleted = res.completed;
    lastTimeline = res.timeline;

    renderResults(lastCompleted);
    renderGantt(lastTimeline);
    renderMetrics(lastCompleted);
  });

  // ---------- Export PDF ----------
  if (btnDownloadPDF) {
    btnDownloadPDF.addEventListener("click", () => {
      if (!lastCompleted.length) {
        return alert("⚠️ Please run an algorithm before exporting.");
      }
      if (!window.jspdf || !window.jspdf.jsPDF || !window.jspdf || !window.jspdf.jsPDF) {
        return alert("jsPDF not loaded.");
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: "mm", format: "a4" });

      const title = "CPU Scheduling Results";
      const algoName = algoLabel(lastAlgo) + (lastAlgo === "optRR" ? ` (TQ=${lastTQ})` : "");

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(title, 14, 16);

      // Meta
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.text(`Algorithm: ${algoName}`, 14, 24);
      doc.text(`Processes: ${processes.length}`, 14, 30);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

      // Results Table with autoTable
      const head = [["Process ID", "Arrival", "Burst", "Completion", "Waiting", "Turnaround"]];
      const body = lastCompleted.map(p => [
        "P" + p.processID,
        String(p.arrivalTime),
        String(p.burstTime),
        String(p.completedTime),
        String(p.waitingTime),
        String(p.turnAroundTime),
      ]);

      doc.autoTable({
        head,
        body,
        startY: 42,
        theme: "grid",
        headStyles: { fillColor: [37, 99, 235], textColor: 255, halign: "center" },
        styles: { fontSize: 10 },
      });

      // Metrics
      let y = doc.lastAutoTable.finalY + 8;
      const metrics = getMetrics(lastCompleted);
      doc.setFont("helvetica", "bold");
      doc.text("Metrics:", 14, y);
      doc.setFont("helvetica", "normal");
      y += 6;
      doc.text(`Average Turnaround Time: ${fmt(metrics.avgTAT)}`, 20, y);
      y += 6;
      doc.text(`Average Waiting Time: ${fmt(metrics.avgWT)}`, 20, y);
      y += 6;
      doc.text(`Throughput: ${fmt(metrics.throughput)}`, 20, y);

      // Gantt (as text timeline)
      y += 10;
      doc.setFont("helvetica", "bold");
      doc.text("Gantt Chart:", 14, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      const timelineText = timelineToText(lastTimeline);
      const lines = doc.splitTextToSize(timelineText, 180);
      doc.text(lines, 20, y);

      // Footer with hyperlink credit
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 238);
      doc.textWithLink("Generated by Harshsfd", 14, 285, { url: "https://www.linkedin.com/in/harshsfd" });
      doc.setTextColor(0, 0, 0);

      doc.save("results.pdf");
    });
  }

  // ---------- Export CSV ----------
  if (btnDownloadCSV) {
    btnDownloadCSV.addEventListener("click", () => {
      if (!lastCompleted.length) {
        return alert("⚠️ Please run an algorithm before exporting.");
      }

      const lines = [];
      const algoName = algoLabel(lastAlgo) + (lastAlgo === "optRR" ? ` (TQ=${lastTQ})` : "");
      lines.push("CPU Scheduling Results");
      lines.push(`Algorithm,${algoName}`);
      lines.push(`Generated,${new Date().toLocaleString()}`);
      lines.push("");

      // Table
      lines.push(["Process ID","Arrival","Burst","Completion","Waiting","Turnaround"].join(","));
      lastCompleted.forEach(p => {
        lines.push(["P"+p.processID, p.arrivalTime, p.burstTime, p.completedTime, p.waitingTime, p.turnAroundTime].join(","));
      });

      // Metrics
      const m = getMetrics(lastCompleted);
      lines.push("");
      lines.push(`Average Turnaround Time,${fmt(m.avgTAT)}`);
      lines.push(`Average Waiting Time,${fmt(m.avgWT)}`);
      lines.push(`Throughput,${fmt(m.throughput)}`);

      // Gantt
      lines.push("");
      lines.push("Gantt Chart");
      lines.push(timelineToText(lastTimeline));

      // Credit
      lines.push("");
      lines.push("Generated by Harshsfd,https://www.linkedin.com/in/harshsfd");

      const csv = lines.join("\n");
      downloadFile("results.csv", "text/csv;charset=utf-8", csv);
    });
  }

  // ---------- Renderers ----------
  function renderProcessList() {
    tblProcessListBody.innerHTML = "";
    if (processes.length === 0) {
      const tr = create("tr", { className: "table-empty" });
      tr.innerHTML = `<td colspan="4" class="text-center text-muted">No processes yet. Add some!</td>`;
      tblProcessListBody.appendChild(tr);
      return;
    }

    // Sort by arrival then PID
    const sorted = processes.slice().sort((a, b) =>
      a.arrivalTime - b.arrivalTime || a.processID - b.processID
    );

    sorted.forEach(p => {
      const tr = create("tr");
      tr.innerHTML = `
        <td>P${p.processID}</td>
        <td>${p.arrivalTime}</td>
        <td>${p.burstTime}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-1 act-edit" data-pid="${p.processID}">Edit</button>
          <button class="btn btn-sm btn-outline-danger act-del" data-pid="${p.processID}">Delete</button>
        </td>
      `;
      tblProcessListBody.appendChild(tr);
    });

    // Bind actions (event delegation also fine; here direct bind)
    $$(".act-edit", tblProcessListBody).forEach(btn => {
      btn.addEventListener("click", () => {
        const pid = toInt(btn.getAttribute("data-pid"));
        const proc = processes.find(pp => pp.processID === pid);
        if (!proc) return;

        // Fill form for editing
        processID.value = proc.processID;
        arrivalTime.value = proc.arrivalTime;
        burstTime.value = proc.burstTime;
        editingPID = proc.processID;
        btnAddProcess.textContent = "✏️ Update Process";
      });
    });

    $$(".act-del", tblProcessListBody).forEach(btn => {
      btn.addEventListener("click", () => {
        const pid = toInt(btn.getAttribute("data-pid"));
        processes = processes.filter(pp => pp.processID !== pid);
        // if we were editing this one, reset
        if (editingPID === pid) {
          editingPID = null;
          btnAddProcess.textContent = "➕ Add / Update Process";
          processID.value = "";
          arrivalTime.value = "";
          burstTime.value = "";
        }
        renderProcessList();
        clearOutputs();
      });
    });
  }

  function renderResults(completed) {
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
        <td>${p.turnAroundTime}</td>
      `;
      tblResultsBody.appendChild(tr);
    });
  }

  function renderGantt(timeline) {
    ganttChart.innerHTML = "";
    if (!timeline.length) {
      ganttChart.innerHTML = `<div class="text-muted">No timeline generated</div>`;
      return;
    }

    // Merge adjacent same-pid segments to make chart cleaner
    const merged = [];
    for (const seg of timeline) {
      if (!merged.length) merged.push({ ...seg });
      else {
        const last = merged[merged.length - 1];
        if (last.pid === seg.pid && last.end === seg.start) {
          last.end = seg.end;
        } else {
          merged.push({ ...seg });
        }
      }
    }

    merged.forEach((seg, i) => {
      const isIdle = seg.pid === "IDLE";
      const pidNum = typeof seg.pid === "number" ? seg.pid : null;
      const width = Math.max((seg.end - seg.start) * 40, 56); // scale

      const block = create("div", { className: "gantt-block" });
      // color class only for numeric pids; idle gets gray
      if (pidNum !== null) {
        block.classList.add(`color-${pidNum % 8}`);
      } else {
        block.style.background = "#64748b"; // idle gray
      }
      block.style.minWidth = width + "px";
      block.style.opacity = "0";
      block.style.transform = "translateY(4px)";
      block.style.transition = "all .35s ease";

      const label = pidNum !== null ? `P${pidNum}` : "Idle";
      block.innerHTML = `${label} <small>(${seg.start}-${seg.end})</small>`;
      ganttChart.appendChild(block);

      // Animate in
      requestAnimationFrame(() => {
        setTimeout(() => {
          block.style.opacity = "1";
          block.style.transform = "translateY(0)";
        }, i * 60);
      });
    });
  }

  function renderMetrics(completed) {
    const m = getMetrics(completed);
    avgTAT.value = fmt(m.avgTAT);
    avgWT.value = fmt(m.avgWT);
    throughput.value = fmt(m.throughput);
  }

  function clearOutputs() {
    tblResultsBody.innerHTML = `<tr class="table-empty"><td colspan="6" class="text-center text-muted">Run an algorithm to see results</td></tr>`;
    ganttChart.innerHTML = "";
    avgTAT.value = "";
    avgWT.value = "";
    throughput.value = "";
    lastCompleted = [];
    lastTimeline = [];
    lastAlgo = "";
    lastTQ = null;
  }

  // ---------- Algorithms ----------
  function runFCFS(list) {
    // sort by arrival then PID
    list.sort((a, b) => a.arrivalTime - b.arrivalTime || a.processID - b.processID);
    let time = 0;
    const completed = [];
    const timeline = [];
    for (const p of list) {
      if (time < p.arrivalTime) {
        // idle time
        timeline.push({ pid: "IDLE", start: time, end: p.arrivalTime });
        time = p.arrivalTime;
      }
      const start = time;
      time += p.burstTime;
      const end = time;
      completed.push(withTimes(p, end));
      timeline.push({ pid: p.processID, start, end });
    }
    return { completed, timeline };
  }

  function runSJF(list) {
    let time = 0;
    const completed = [];
    const timeline = [];
    const ready = [];
    list.sort((a, b) => a.arrivalTime - b.arrivalTime || a.processID - b.processID);

    while (list.length || ready.length) {
      while (list.length && list[0].arrivalTime <= time) ready.push(list.shift());
      if (!ready.length) {
        // jump to next arrival (idle gap)
        const nextAt = list[0].arrivalTime;
        timeline.push({ pid: "IDLE", start: time, end: nextAt });
        time = nextAt;
        continue;
      }
      ready.sort((a, b) => a.burstTime - b.burstTime || a.arrivalTime - b.arrivalTime || a.processID - b.processID);
      const p = ready.shift();
      const start = time;
      time += p.burstTime;
      const end = time;
      completed.push(withTimes(p, end));
      timeline.push({ pid: p.processID, start, end });
    }
    return { completed, timeline };
  }

  function runSRTF(list) {
    // Preemptive SJF
    let time = 0;
    const completed = [];
    const timeline = [];
    const ready = [];
    list = list.map(p => ({ ...p, rem: p.burstTime }));
    list.sort((a, b) => a.arrivalTime - b.arrivalTime || a.processID - b.processID);

    let current = null;
    let lastStart = 0;

    while (list.length || ready.length || current) {
      // enqueue arrivals
      while (list.length && list[0].arrivalTime <= time) ready.push(list.shift());

      if (!current) {
        if (!ready.length) {
          // idle to next arrival
          const nextAt = list[0].arrivalTime;
          timeline.push({ pid: "IDLE", start: time, end: nextAt });
          time = nextAt;
          continue;
        }
        ready.sort((a, b) => a.rem - b.rem || a.arrivalTime - b.arrivalTime || a.processID - b.processID);
        current = ready.shift();
        lastStart = time;
      }

      // run 1 unit
      current.rem--;
      time++;

      // any new arrival at this time?
      while (list.length && list[0].arrivalTime <= time) ready.push(list.shift());

      // preemption check
      if (current.rem === 0) {
        // finished
        timeline.push({ pid: current.processID, start: lastStart, end: time });
        completed.push(withTimes(current, time));
        current = null;
      } else {
        // if any ready has smaller rem, preempt
        const preempt = ready.length && ready.some(p => p.rem < current.rem);
        if (preempt) {
          timeline.push({ pid: current.processID, start: lastStart, end: time });
          ready.push(current);
          current = null;
        }
      }
    }

    return { completed, timeline };
  }

  function runRR(list, tq) {
    let time = 0;
    const completed = [];
    const timeline = [];
    const ready = [];
    list = list.map(p => ({ ...p, rem: p.burstTime }));
    list.sort((a, b) => a.arrivalTime - b.arrivalTime || a.processID - b.processID);

    while (list.length || ready.length) {
      while (list.length && list[0].arrivalTime <= time) ready.push(list.shift());

      if (!ready.length) {
        // idle to next arrival
        const nextAt = list[0].arrivalTime;
        timeline.push({ pid: "IDLE", start: time, end: nextAt });
        time = nextAt;
        continue;
      }

      const p = ready.shift();
      const exec = Math.min(tq, p.rem);
      const start = time;
      time += exec;
      const end = time;
      p.rem -= exec;
      timeline.push({ pid: p.processID, start, end });

      // enqueue new arrivals during this quantum
      while (list.length && list[0].arrivalTime <= time) ready.push(list.shift());

      if (p.rem === 0) {
        completed.push(withTimes(p, end));
      } else {
        ready.push(p);
      }
    }

    return { completed, timeline };
  }

  // ---------- Utilities ----------
  function withTimes(p, completedTime) {
    const tat = completedTime - p.arrivalTime;
    const wt = tat - p.burstTime;
    return {
      processID: p.processID,
      arrivalTime: p.arrivalTime,
      burstTime: p.burstTime,
      completedTime,
      turnAroundTime: tat,
      waitingTime: wt
    };
  }

  function getMetrics(completed) {
    if (!completed.length) return { avgTAT: 0, avgWT: 0, throughput: 0 };
    const totalTAT = completed.reduce((s, p) => s + p.turnAroundTime, 0);
    const totalWT = completed.reduce((s, p) => s + p.waitingTime, 0);
    const maxCT = Math.max(...completed.map(p => p.completedTime));
    return {
      avgTAT: totalTAT / completed.length,
      avgWT: totalWT / completed.length,
      throughput: completed.length / (maxCT || 1)
    };
  }

  function timelineToText(tl) {
    if (!tl || !tl.length) return "";
    return tl
      .map(seg => `${seg.pid === "IDLE" ? "Idle" : "P" + seg.pid} (${seg.start}-${seg.end})`)
      .join(" → ");
  }

  function algoLabel(val) {
    swi