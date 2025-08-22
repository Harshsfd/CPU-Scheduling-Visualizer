// CPU Scheduling Simulator - Improved
// Algorithms: FCFS, SJF, SRTF, RR
// Author: Harsh Bhardwaj (UI refined)

(function () {
  "use strict";

  // ---------- DOM Helpers ----------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const create = (tag, attrs = {}) => Object.assign(document.createElement(tag), attrs);

  // ---------- State ----------
  const state = {
    processList: [],
    originProcessList: []
  };

  // ---------- Elements ----------
  const algorithmSelector = $("#algorithmSelector");
  const timeQuantumWrap = $("#timeQuantumWrap");
  const timeQuantum = $("#timeQuantum");
  const processID = $("#processID");
  const arrivalTime = $("#arrivalTime");
  const burstTime = $("#burstTime");
  const btnAddProcess = $("#btnAddProcess");
  const resetBtn = $("#resetBtn");
  const btnCalculate = $("#btnCalculate");
  const tblProcessListBody = $("#tblProcessList tbody");
  const tblResultsBody = $("#tblResults tbody");
  const avgTAT = $("#avgTurnaroundTime");
  const avgWT = $("#avgWaitingTime");
  const throughput = $("#throughput");
  const ganttChart = $("#ganttChart");

  // ---------- Initialization ----------
  algorithmSelector.addEventListener("change", () => {
    timeQuantumWrap.style.display = algorithmSelector.value === "optRR" ? "block" : "none";
  });

  [processID, arrivalTime, burstTime, timeQuantum].forEach(inp => {
    inp.addEventListener("input", () => inp.classList.remove("is-invalid"));
  });

  btnAddProcess.addEventListener("click", () => {
    const pid = parseInt(processID.value, 10);
    const at = parseInt(arrivalTime.value, 10);
    const bt = parseInt(burstTime.value, 10);

    // validation
    if (Number.isNaN(pid) || Number.isNaN(at) || Number.isNaN(bt) || bt <= 0) {
      [processID, arrivalTime, burstTime].forEach(el => {
        if (!el.value || (el === burstTime && bt <= 0)) el.classList.add("is-invalid");
      });
      return;
    }

    // prevent duplicate process IDs
    if (state.processList.some(p => p.processID === pid)) {
      processID.classList.add("is-invalid");
      return;
    }

    const process = { processID: pid, arrivalTime: at, burstTime: bt };
    state.processList.push({ ...process });
    state.originProcessList.push({ ...process });
    renderProcessTable();

    processID.value = "";
    arrivalTime.value = "";
    burstTime.value = "";
  });

  resetBtn.addEventListener("click", fullReset);

  btnCalculate.addEventListener("click", () => {
    if (state.processList.length === 0) {
      alert("Please insert some processes first.");
      return;
    }
    clearOutputs();

    const algo = algorithmSelector.value;
    let result = null;

    switch (algo) {
      case "optFCFS": result = runFCFS(copyList(state.processList)); break;
      case "optSJF": result = runSJF(copyList(state.processList)); break;
      case "optSRTF": result = runSRTF(copyList(state.processList)); break;
      case "optRR":
        if (!timeQuantum.value || parseInt(timeQuantum.value, 10) <= 0) {
          timeQuantum.classList.add("is-invalid");
          alert("Please enter a valid Time Quantum (>0).");
          return;
        }
        result = runRR(copyList(state.processList), parseInt(timeQuantum.value, 10));
        break;
      default: return;
    }

    renderResultsTable(result.completed);
    renderGantt(result.timeline);
    renderMetrics(result.completed);
  });

  // ---------- Reset ----------
  function fullReset() {
    state.processList = [];
    state.originProcessList = [];
    [processID, arrivalTime, burstTime, timeQuantum].forEach(i => i.value = "");
    renderProcessTable();
    clearOutputs();
  }

  function renderProcessTable() {
    tblProcessListBody.innerHTML = "";
    if (state.processList.length === 0) {
      const tr = create("tr", { className: "table-empty" });
      const td = create("td", { colSpan: 3, className: "text-center text-muted", innerText: "No processes yet. Add some!" });
      tr.appendChild(td);
      tblProcessListBody.appendChild(tr);
      return;
    }
    state.processList
      .slice()
      .sort((a, b) => a.arrivalTime === b.arrivalTime ? a.processID - b.processID : a.arrivalTime - b.arrivalTime)
      .forEach(p => {
        const tr = create("tr");
        tr.appendChild(create("td", { innerText: p.processID }));
        tr.appendChild(create("td", { innerText: p.arrivalTime }));
        tr.appendChild(create("td", { innerText: p.burstTime }));
        tblProcessListBody.appendChild(tr);
      });
  }

  function clearOutputs() {
    tblResultsBody.innerHTML = '<tr class="table-empty"><td colspan="6" class="text-center text-muted">Run an algorithm to see results</td></tr>';
    ganttChart.innerHTML = "";
    [avgTAT, avgWT, throughput].forEach(i => i.value = "");
  }

  // ---------- Scheduling Algorithms ----------
  // FCFS
  function runFCFS(list) {
    list.sort((a, b) => a.arrivalTime - b.arrivalTime || a.processID - b.processID);
    const completed = [];
    const timeline = [];
    let time = 0;
    for (const p of list) {
      if (time < p.arrivalTime) time = p.arrivalTime;
      const start = time;
      time += p.burstTime;
      const end = time;
      completed.push({
        ...p,
        completedTime: end,
        turnAroundTime: end - p.arrivalTime,
        waitingTime: (end - p.arrivalTime) - p.burstTime
      });
      timeline.push({ pid: p.processID, start, end });
    }
    return { completed, timeline };
  }

  // SJF (Non-preemptive)
  function runSJF(list) {
    const completed = [];
    const timeline = [];
    let time = 0;
    const ready = [];
    list.sort((a, b) => a.arrivalTime - b.arrivalTime);

    while (list.length > 0 || ready.length > 0) {
      while (list.length > 0 && list[0].arrivalTime <= time) ready.push(list.shift());
      if (ready.length === 0) { time = list[0].arrivalTime; continue; }
      ready.sort((a, b) => a.burstTime - b.burstTime || a.processID - b.processID);
      const p = ready.shift();
      const start = time;
      time += p.burstTime;
      const end = time;
      completed.push({
        ...p,
        completedTime: end,
        turnAroundTime: end - p.arrivalTime,
        waitingTime: (end - p.arrivalTime) - p.burstTime
      });
      timeline.push({ pid: p.processID, start, end });
    }
    return { completed, timeline };
  }

  // SRTF (Preemptive)
  function runSRTF(list) {
    const completed = [];
    const timeline = [];
    let time = 0;
    const ready = [];
    const remaining = list.map(p => ({ ...p, remaining: p.burstTime }));
    remaining.sort((a, b) => a.arrivalTime - b.arrivalTime);
    let current = null;
    let lastSwitchTime = 0;

    while (remaining.length > 0 || ready.length > 0 || current) {
      while (remaining.length > 0 && remaining[0].arrivalTime <= time) ready.push(remaining.shift());
      if (!current) {
        if (ready.length === 0) { time = remaining[0].arrivalTime; continue; }
        ready.sort((a, b) => a.remaining - b.remaining || a.processID - b.processID);
        current = ready.shift(); lastSwitchTime = time;
      }
      current.remaining--; time++;

      if (current.remaining === 0) {
        timeline.push({ pid: current.processID, start: lastSwitchTime, end: time });
        completed.push({
          processID: current.processID,
          arrivalTime: current.arrivalTime,
          burstTime: current.burstTime,
          completedTime: time,
          turnAroundTime: time - current.arrivalTime,
          waitingTime: (time - current.arrivalTime) - current.burstTime
        });
        current = null;
      } else {
        const shortest = ready.slice().sort((a, b) => a.remaining - b.remaining)[0];
        if (shortest && shortest.remaining < current.remaining) {
          timeline.push({ pid: current.processID, start: lastSwitchTime, end: time });
          ready.push(current);
          current = null;
        }
      }
      lastSwitchTime = time;
    }
    return { completed, timeline: mergeTimeline(timeline) };
  }

  // Round Robin
  function runRR(list, tq) {
    const completed = [];
    const timeline = [];
    let time = 0;
    const remaining = list.map(p => ({ ...p, remaining: p.burstTime }));
    remaining.sort((a, b) => a.arrivalTime - b.arrivalTime);
    const ready = [];

    while (remaining.length > 0 || ready.length > 0) {
      while (remaining.length > 0 && remaining[0].arrivalTime <= time) ready.push(remaining.shift());
      if (ready.length === 0) { time = remaining[0].arrivalTime; continue; }
      const p = ready.shift();
      const exec = Math.min(tq, p.remaining);
      const start = time;
      time += exec;
      const end = time;
      p.remaining -= exec;

      while (remaining.length > 0 && remaining[0].arrivalTime <= time) ready.push(remaining.shift());
      timeline.push({ pid: p.processID, start, end });

      if (p.remaining === 0) {
        completed.push({
          processID: p.processID,
          arrivalTime: p.arrivalTime,
          burstTime: p.burstTime,
          completedTime: end,
          turnAroundTime: end - p.arrivalTime,
          waitingTime: (end - p.arrivalTime) - p.burstTime
        });
      } else ready.push(p);
    }
    return { completed, timeline: mergeTimeline(timeline) };
  }

  // ---------- Rendering ----------
  function renderResultsTable(completed) {
    tblResultsBody.innerHTML = "";
    if (completed.length === 0) {
      const tr = create("tr", { className: "table-empty" });
      tr.appendChild(create("td", { colSpan: 6, className: "text-center text-muted", innerText: "No results" }));
      tblResultsBody.appendChild(tr);
      return;
    }
    completed.sort((a, b) => a.processID - b.processID).forEach(p => {
      const tr = create("tr");
      ["processID", "arrivalTime", "burstTime", "completedTime", "waitingTime", "turnAroundTime"].forEach(k => {
        tr.appendChild(create("td", { innerText: p[k] }));
      });
      tblResultsBody.appendChild(tr);
    });
  }

  function renderGantt(timeline) {
    ganttChart.innerHTML = "";
    if (timeline.length === 0) return;

    const colorMap = new Map();
    let idx = 1;
    const colorFor = pid => {
      if (!colorMap.has(pid)) { colorMap.set(pid, "c" + ((idx - 1) % 8 + 1)); idx++; }
      return colorMap.get(pid);
    };

    const unitWidth = 44;
    timeline.forEach(seg => {
      const width = Math.max(32, (seg.end - seg.start) * unitWidth);
      const block = create("div", { className: "block " + colorFor(seg.pid), innerText: "P" + seg.pid });
      block.style.minWidth = width + "px";
      block.appendChild(create("div", { className: "tick", innerText: seg.end }));
      ganttChart.appendChild(block);
    });
  }

  function renderMetrics(completed) {
    if (completed.length === 0) { [avgTAT, avgWT, throughput].forEach(i => i.value = "0"); return; }
    const totalTAT = completed.reduce((s, p) => s + p.turnAroundTime, 0);
    const totalWT = completed.reduce((s, p) => s + p.waitingTime, 0);
    const maxCT = Math.max(...completed.map(p => p.completedTime));
    avgTAT.value = (totalTAT / completed.length).toFixed(2);
    avgWT.value = (totalWT / completed.length).toFixed(2);
    throughput.value = (completed.length / maxCT).toFixed(2);
  }

  // ---------- Utils ----------
  function mergeTimeline(tl) {
    const merged = [];
    for (const seg of tl) {
      const last = merged[merged.length - 1];
      if (last && last.pid === seg.pid && last.end === seg.start) last.end = seg.end;
      else merged.push({ ...seg });
    }
    return merged;
  }
  function copyList(list) { return list.map(p => ({ ...p })); }

})();