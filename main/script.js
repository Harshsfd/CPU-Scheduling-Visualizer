// Improved CPU Scheduling Simulator
// Uses Bootstrap 5 + vanilla JS (no jQuery dependency)
// Author: HARSHSFD (UI refined by ChatGPT)

(function(){
  "use strict";

  // ---------- DOM Helpers ----------
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
  const create = (tag, attrs={}) => Object.assign(document.createElement(tag), attrs);

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

  // ----------- Init -----------
  algorithmSelector.addEventListener("change", () => {
    timeQuantumWrap.style.display = algorithmSelector.value === "optRR" ? "block" : "none";
  });

  // Remove 'is-invalid' as user types
  [processID, arrivalTime, burstTime, timeQuantum].forEach(inp => {
    inp.addEventListener("input", () => inp.classList.remove("is-invalid"));
  });

  btnAddProcess.addEventListener("click", () => {
    const pid = parseInt(processID.value, 10);
    const at  = parseInt(arrivalTime.value, 10);
    const bt  = parseInt(burstTime.value, 10);

    // validation
    if (Number.isNaN(pid) || Number.isNaN(at) || Number.isNaN(bt) || bt <= 0){
      [processID, arrivalTime, burstTime].forEach(el => {
        if(!el.value || (el===burstTime && bt<=0)) el.classList.add("is-invalid");
      });
      return;
    }
    // unique PID check
    if (state.processList.some(p => p.processID === pid)){
      processID.classList.add("is-invalid");
      processID.setAttribute("title","Duplicate Process ID not allowed");
      return;
    }

    const process = { processID: pid, arrivalTime: at, burstTime: bt };
    state.processList.push({...process});
    state.originProcessList.push({...process});
    renderProcessTable();

    // clear inputs
    processID.value = "";
    arrivalTime.value = "";
    burstTime.value = "";
  });

  resetBtn.addEventListener("click", fullReset);

  btnCalculate.addEventListener("click", () => {
    if (state.processList.length === 0){
      alert("Please insert some processes.");
      return;
    }
    clearOutputs();

    const algo = algorithmSelector.value;
    let result = null;

    switch(algo){
      case "optFCFS": result = runFCFS(copyList(state.processList)); break;
      case "optSJF":  result = runSJF(copyList(state.processList));  break;
      case "optSRTF": result = runSRTF(copyList(state.processList)); break;
      case "optRR":
        if (!timeQuantum.value || parseInt(timeQuantum.value,10) <= 0){
          timeQuantum.classList.add("is-invalid");
          alert("Please enter a valid Time Quantum (>0).");
          return;
        }
        result = runRR(copyList(state.processList), parseInt(timeQuantum.value,10));
        break;
      default: return;
    }

    // Render
    renderResultsTable(result.completed);
    renderGantt(result.timeline);
    renderMetrics(result.completed);
  });

  function fullReset(){
    state.processList = [];
    state.originProcessList = [];
    [processID, arrivalTime, burstTime, timeQuantum].forEach(i => i.value = "");
    renderProcessTable();
    clearOutputs();
  }

  function renderProcessTable(){
    tblProcessListBody.innerHTML = "";
    if (state.processList.length === 0){
      const tr = create("tr", {className:"table-empty"});
      const td = create("td", {colSpan:3, className:"text-center text-muted", innerText:"No processes yet. Add some!"});
      tr.appendChild(td);
      tblProcessListBody.appendChild(tr);
      return;
    }
    state.processList
      .slice()
      .sort((a,b)=> a.arrivalTime===b.arrivalTime ? a.processID-b.processID : a.arrivalTime-b.arrivalTime)
      .forEach(p => {
        const tr = create("tr");
        tr.appendChild(create("td", {innerText: p.processID}));
        tr.appendChild(create("td", {innerText: p.arrivalTime}));
        tr.appendChild(create("td", {innerText: p.burstTime}));
        tblProcessListBody.appendChild(tr);
      });
  }

  function clearOutputs(){
    tblResultsBody.innerHTML = '<tr class="table-empty"><td colspan="6" class="text-center text-muted">Run an algorithm to see results</td></tr>';
    ganttChart.innerHTML = "";
    [avgTAT, avgWT, throughput].forEach(i=> i.value = "");
  }

  // ---------- Algorithms (produce {completed:[], timeline:[]}) ----------
  // timeline item: {pid, start, end}
  function runFCFS(list){
    list.sort((a,b)=> a.arrivalTime - b.arrivalTime || a.processID - b.processID);
    const completed = [];
    const timeline = [];
    let time = 0;
    for (const p of list){
      if (time < p.arrivalTime) time = p.arrivalTime;
      const start = time;
      time += p.burstTime;
      const end = time;
      completed.push({
        processID: p.processID,
        arrivalTime: p.arrivalTime,
        burstTime: p.burstTime,
        completedTime: end,
        turnAroundTime: end - p.arrivalTime,
        waitingTime: (end - p.arrivalTime) - p.burstTime
      });
      timeline.push({pid:p.processID, start, end});
    }
    return {completed, timeline};
  }

  function runSJF(list){
    const completed = [];
    const timeline = [];
    let time = 0;
    const ready = [];

    list.sort((a,b)=> a.arrivalTime - b.arrivalTime || a.processID - b.processID);
    while (list.length>0 || ready.length>0){
      while (list.length>0 && list[0].arrivalTime <= time){
        ready.push(list.shift());
      }
      if (ready.length===0){
        time = list[0].arrivalTime;
        continue;
      }
      ready.sort((a,b)=> a.burstTime - b.burstTime || a.processID - b.processID);
      const p = ready.shift();
      const start = time;
      time += p.burstTime;
      const end = time;
      completed.push({
        processID: p.processID,
        arrivalTime: p.arrivalTime,
        burstTime: p.burstTime,
        completedTime: end,
        turnAroundTime: end - p.arrivalTime,
        waitingTime: (end - p.arrivalTime) - p.burstTime
      });
      timeline.push({pid:p.processID, start, end});
    }
    return {completed, timeline};
  }

  function runSRTF(list){
    const completed = [];
    const timeline = [];
    let time = 0;
    const remaining = list.map(p=> ({...p, remaining:p.burstTime}));
    const ready = [];

    remaining.sort((a,b)=> a.arrivalTime - b.arrivalTime || a.processID - b.processID);

    let current = null;
    let lastSwitchTime = 0;

    while (remaining.length>0 || ready.length>0 || current){
      while (remaining.length>0 && remaining[0].arrivalTime <= time){
        ready.push(remaining.shift());
      }
      if (!current){
        if (ready.length===0){
          time = remaining[0].arrivalTime;
          continue;
        }
        ready.sort((a,b)=> a.remaining - b.remaining || a.processID - b.processID);
        current = ready.shift();
        lastSwitchTime = time;
      }
      // run for 1 unit
      current.remaining -= 1;
      time += 1;

      // push arriving during execution
      while (remaining.length>0 && remaining[0].arrivalTime <= time){
        ready.push(remaining.shift());
      }

      // preemption check
      if (current.remaining === 0){
        // finished
        timeline.push({pid: current.processID, start: lastSwitchTime, end: time});
        const end = time;
        completed.push({
          processID: current.processID,
          arrivalTime: current.arrivalTime,
          burstTime: current.burstTime,
          completedTime: end,
          turnAroundTime: end - current.arrivalTime,
          waitingTime: (end - current.arrivalTime) - current.burstTime
        });
        current = null;
      }else{
        // see if a shorter job has arrived
        const shortestInReady = ready.slice().sort((a,b)=> a.remaining - b.remaining || a.processID - b.processID)[0];
        if (shortestInReady && shortestInReady.remaining < current.remaining){
          timeline.push({pid: current.processID, start: lastSwitchTime, end: time});
          ready.push(current);
          current = ready.shift(); // will be shortest due to sort above if we sort again
          ready.sort((a,b)=> a.remaining - b.remaining || a.processID - b.processID);
          lastSwitchTime = time;
        }
      }
    }

    // Merge consecutive same-pid slices for a cleaner chart
    const mergedTimeline = [];
    for (const seg of timeline){
      const last = mergedTimeline[mergedTimeline.length-1];
      if (last && last.pid === seg.pid && last.end === seg.start){
        last.end = seg.end;
      }else{
        mergedTimeline.push({...seg});
      }
    }
    return {completed, timeline: mergedTimeline};
  }

  function runRR(list, tq){
    const completed = [];
    const timeline = [];
    let time = 0;
    const remaining = list.map(p=> ({...p, remaining: p.burstTime}));
    remaining.sort((a,b)=> a.arrivalTime - b.arrivalTime || a.processID - b.processID);

    const ready = [];
    while (remaining.length>0 || ready.length>0){
      while (remaining.length>0 && remaining[0].arrivalTime <= time){
        ready.push(remaining.shift());
      }
      if (ready.length===0){
        // jump to next arrival
        time = remaining[0].arrivalTime;
        continue;
      }
      const p = ready.shift();
      const exec = Math.min(tq, p.remaining);
      const start = time;
      time += exec;
      const end = time;
      p.remaining -= exec;

      // queue any arrivals during this slice
      while (remaining.length>0 && remaining[0].arrivalTime <= time){
        ready.push(remaining.shift());
      }

      timeline.push({pid:p.processID, start, end});
      if (p.remaining === 0){
        completed.push({
          processID: p.processID,
          arrivalTime: p.arrivalTime,
          burstTime: p.burstTime,
          completedTime: end,
          turnAroundTime: end - p.arrivalTime,
          waitingTime: (end - p.arrivalTime) - p.burstTime
        });
      }else{
        ready.push(p); // rotate to back
      }
    }

    // Merge consecutive segments with same pid
    const mergedTimeline = [];
    for (const seg of timeline){
      const last = mergedTimeline[mergedTimeline.length-1];
      if (last && last.pid === seg.pid && last.end === seg.start){
        last.end = seg.end;
      }else{
        mergedTimeline.push({...seg});
      }
    }
    return {completed, timeline: mergedTimeline};
  }

  // ---------- Rendering ----------
  function renderResultsTable(completed){
    tblResultsBody.innerHTML = "";
    if (completed.length === 0){
      const tr = create("tr", {className:"table-empty"});
      const td = create("td", {colSpan:6, className:"text-center text-muted", innerText:"No results"});
      tr.appendChild(td);
      tblResultsBody.appendChild(tr);
      return;
    }
    completed
      .slice()
      .sort((a,b)=> a.processID - b.processID)
      .forEach(p => {
        const tr = create("tr");
        ["processID","arrivalTime","burstTime","completedTime","waitingTime","turnAroundTime"].forEach(k => {
          tr.appendChild(create("td", {innerText: p[k]}));
        });
        tblResultsBody.appendChild(tr);
      });
  }

  function renderGantt(timeline){
    ganttChart.innerHTML = "";
    if (timeline.length===0) return;

    // Color class assignment
    const colorMap = new Map();
    let colorIdx = 1;
    const colorFor = (pid)=>{
      if (!colorMap.has(pid)){
        colorMap.set(pid, "c"+((colorIdx-1)%8+1));
        colorIdx+=1;
      }
      return colorMap.get(pid);
    };

    // scale: 1 time unit = 44px (min), responsive scroll
    const unitWidth = 44;

    // Starting tick (time of first start)
    const start0 = Math.min(...timeline.map(t=>t.start));
    const tick0 = create("div", {className:"small text-muted", innerText: start0.toString()});
    tick0.style.marginLeft = "4px";

    // blocks
    timeline.forEach((seg, idx) => {
      const width = Math.max(32, (seg.end - seg.start) * unitWidth);
      const block = create("div", {className:"block " + colorFor(seg.pid)});
      block.style.minWidth = width + "px";
      block.style.width = width + "px";
      block.innerText = "P" + seg.pid;
      const tick = create("div", {className:"tick", innerText: seg.end.toString()});
      block.appendChild(tick);
      ganttChart.appendChild(block);
    });
  }

  function renderMetrics(completed){
    if (completed.length===0){
      [avgTAT, avgWT, throughput].forEach(i=> i.value = "0");
      return;
    }
    const totalTAT = completed.reduce((s,p)=> s+p.turnAroundTime, 0);
    const totalWT  = completed.reduce((s,p)=> s+p.waitingTime, 0);
    const maxCT    = Math.max(...completed.map(p=> p.completedTime));
    avgTAT.value = (totalTAT / completed.length).toFixed(2);
    avgWT.value  = (totalWT  / completed.length).toFixed(2);
    throughput.value = (completed.length / maxCT).toFixed(2);
  }

  // ---------- Utils ----------
  function copyList(list){ return list.map(p=> ({...p})); }

})();"""

logo_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#22c55e"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="28" fill="url(#g)"/>
  <g fill="#fff">
    <circle cx="64" cy="64" r="20" opacity=".95"/>
    <circle cx="192" cy="64" r="20" opacity=".95"/>
    <circle cx="64" cy="192" r="20" opacity=".95"/>
    <circle cx="192" cy="192" r="20" opacity=".95"/>
    <rect x="76" y="76" width="104" height="104" rx="14" opacity=".95"/>
  </g>
  <text x="128" y="240" text-anchor="middle" fill="#e2e8f0" font-family="Arial, sans-serif" font-weight="700" font-size="18">OS SCHEDULER</text>
</svg>
"""

# Write files
with open(os.path.join(base, "index.html"), "w", encoding="utf-8") as f:
    f.write(index_html)

with open(os.path.join(main_dir, "main.html"), "w", encoding="utf-8") as f:
    f.write(main_html)

with open(os.path.join(main_dir, "style.css"), "w", encoding="utf-8") as f:
    f.write(style_css)

with open(os.path.join(main_dir, "script.js"), "w", encoding="utf-8") as f:
    f.write(script_js)

with open(os.path.join(main_dir, "Siet_logo.svg"), "w", encoding="utf-8") as f:
    f.write(logo_svg)

# Zip the folder for download
zip_path = "/mnt/data/OS-Scheduler-Improved.zip"
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(base):
        for name in files:
            full = os.path.join(root, name)
            arc = os.path.relpath(full, base)
            z.write(full, arcname=os.path.join("os-scheduler-improved", arc))