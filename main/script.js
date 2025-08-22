/* =========================
   CPU Scheduling Simulator
   Final Script.js
   ========================= */

let processes = [];
let ganttData = [];
let editIndex = null;

/* ========== DOM Elements ========== */
const processID = document.getElementById("processID");
const arrivalTime = document.getElementById("arrivalTime");
const burstTime = document.getElementById("burstTime");
const btnAddProcess = document.getElementById("btnAddProcess");
const resetBtn = document.getElementById("resetBtn");
const tblProcessList = document.querySelector("#tblProcessList tbody");
const tblResults = document.querySelector("#tblResults tbody");
const algorithmSelector = document.getElementById("algorithmSelector");
const timeQuantumWrap = document.getElementById("timeQuantumWrap");
const timeQuantumInput = document.getElementById("timeQuantum");
const avgTurnaroundTime = document.getElementById("avgTurnaroundTime");
const avgWaitingTime = document.getElementById("avgWaitingTime");
const throughput = document.getElementById("throughput");
const ganttChart = document.getElementById("ganttChart");
const btnCalculate = document.getElementById("btnCalculate");
const btnDownloadPDF = document.getElementById("btnDownloadPDF");
const btnDownloadCSV = document.getElementById("btnDownloadCSV");
const toggleTheme = document.getElementById("toggleTheme");

/* ========== Theme Toggle ========== */
toggleTheme.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  toggleTheme.textContent = document.body.classList.contains("dark") ? "☀️ Light Mode" : "🌙 Dark Mode";
});

/* ========== Show/Hide Time Quantum ========== */
algorithmSelector.addEventListener("change", () => {
  timeQuantumWrap.style.display = algorithmSelector.value === "optRR" ? "block" : "none";
});

/* ========== Add / Update Process ========== */
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

  const newProcess = { processID: pid, arrivalTime: at, burstTime: bt };

  if (editIndex !== null) {
    processes[editIndex] = newProcess;
    editIndex = null;
  } else {
    processes.push(newProcess);
  }

  renderProcessList();

  processID.value = "";
  arrivalTime.value = "";
  burstTime.value = "";
});

/* ========== Reset All ========== */
resetBtn.addEventListener("click", () => {
  processes = [];
  ganttData = [];
  editIndex = null;
  renderProcessList();
  tblResults.innerHTML = `<tr class="table-empty"><td colspan="6" class="text-center text-muted">Run an algorithm to see results</td></tr>`;
  ganttChart.innerHTML = "";
  avgTurnaroundTime.value = "";
  avgWaitingTime.value = "";
  throughput.value = "";
});

/* ========== Render Process List ========== */
function renderProcessList() {
  if (processes.length === 0) {
    tblProcessList.innerHTML = `<tr class="table-empty"><td colspan="4" class="text-center text-muted">No processes yet. Add some!</td></tr>`;
    return;
  }
  tblProcessList.innerHTML = "";
  processes.forEach((p, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>P${p.processID}</td>
      <td>${p.arrivalTime}</td>
      <td>${p.burstTime}</td>
      <td>
        <button class="btn btn-sm btn-warning me-1" onclick="editProcess(${i})">✏️ Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProcess(${i})">🗑️ Delete</button>
      </td>
    `;
    tblProcessList.appendChild(tr);
  });
}

window.editProcess = function(i) {
  const p = processes[i];
  processID.value = p.processID;
  arrivalTime.value = p.arrivalTime;
  burstTime.value = p.burstTime;
  editIndex = i;
};

window.deleteProcess = function(i) {
  processes.splice(i, 1);
  renderProcessList();
};

/* ========== Scheduling Algorithms ========== */
function calculate() {
  if (processes.length === 0) {
    alert("⚠️ Add some processes first!");
    return;
  }

  const algo = algorithmSelector.value;
  const q = parseInt(timeQuantumInput.value, 10);
  let results = [];

  switch (algo) {
    case "optFCFS": results = runFCFS(); break;
    case "optSJF": results = runSJF(); break;
    case "optSRTF": results = runSRTF(); break;
    case "optRR":
      if (isNaN(q) || q <= 0) {
        alert("⚠️ Enter valid Time Quantum!");
        return;
      }
      results = runRR(q);
      break;
  }

  renderResults(results);
}

/* ========== FCFS ========== */
function runFCFS() {
  let time = 0;
  let res = [];
  ganttData = [];
  const arr = [...processes].sort((a,b)=>a.arrivalTime-b.arrivalTime);

  arr.forEach(p=>{
    if (time < p.arrivalTime) time = p.arrivalTime;
    let start = time;
    time += p.burstTime;
    ganttData.push({pid:p.processID,start,end:time});
    res.push({
      ...p,
      completionTime: time,
      turnaroundTime: time - p.arrivalTime,
      waitingTime: time - p.arrivalTime - p.burstTime
    });
  });
  return res;
}

/* ========== SJF (Non-preemptive) ========== */
function runSJF() {
  let time = 0, res = [], gantt = [];
  let arr = [...processes].sort((a,b)=>a.arrivalTime-b.arrivalTime);
  ganttData = [];
  while(arr.length){
    let available = arr.filter(p=>p.arrivalTime<=time);
    if (available.length===0){
      time=arr[0].arrivalTime;
      continue;
    }
    available.sort((a,b)=>a.burstTime-b.burstTime);
    let p=available[0];
    arr.splice(arr.indexOf(p),1);
    let start=time;
    time+=p.burstTime;
    ganttData.push({pid:p.processID,start,end:time});
    res.push({...p,completionTime:time,turnaroundTime:time-p.arrivalTime,waitingTime:time-p.arrivalTime-p.burstTime});
  }
  return res;
}

/* ========== SRTF (Preemptive) ========== */
function runSRTF(){
  let time=0,res=[],ganttDataLocal=[],remain=[...processes].map(p=>({...p,rt:p.burstTime}));
  ganttData=[];
  while(remain.some(p=>p.rt>0)){
    let available=remain.filter(p=>p.arrivalTime<=time && p.rt>0);
    if(available.length===0){time++;continue;}
    available.sort((a,b)=>a.rt-b.rt);
    let p=available[0];
    let start=time;
    time++;
    p.rt--;
    if(p.rt===0){
      p.completionTime=time;
      p.turnaroundTime=time-p.arrivalTime;
      p.waitingTime=p.turnaroundTime-p.burstTime;
      res.push(p);
    }
    let last=ganttData[ganttData.length-1];
    if(last && last.pid===p.processID) last.end=time;
    else ganttData.push({pid:p.processID,start,end:time});
  }
  return res;
}

/* ========== Round Robin ========== */
function runRR(q){
  let time=0,res=[],queue=[],remain=[...processes].map(p=>({...p,rt:p.burstTime}));
  ganttData=[];
  remain.sort((a,b)=>a.arrivalTime-b.arrivalTime);
  queue.push(remain[0]);
  let i=1;
  while(queue.length){
    let p=queue.shift();
    if(time<p.arrivalTime){time=p.arrivalTime;}
    let exec=Math.min(q,p.rt);
    ganttData.push({pid:p.processID,start:time,end:time+exec});
    time+=exec;
    p.rt-=exec;
    if(p.rt>0){
      while(i<remain.length && remain[i].arrivalTime<=time){
        queue.push(remain[i]); i++;
      }
      queue.push(p);
    }else{
      p.completionTime=time;
      p.turnaroundTime=time-p.arrivalTime;
      p.waitingTime=p.turnaroundTime-p.burstTime;
      res.push(p);
    }
    while(i<remain.length && remain[i].arrivalTime<=time){
      queue.push(remain[i]); i++;
    }
  }
  return res;
}

/* ========== Render Results ========== */
function renderResults(results){
  if(results.length===0)return;
  tblResults.innerHTML="";
  let totalTAT=0,totalWT=0;
  results.forEach(p=>{
    totalTAT+=p.turnaroundTime; totalWT+=p.waitingTime;
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>P${p.processID}</td>
      <td>${p.arrivalTime}</td>
      <td>${p.burstTime}</td>
      <td>${p.completionTime}</td>
      <td>${p.waitingTime}</td>
      <td>${p.turnaroundTime}</td>`;
    tblResults.appendChild(tr);
  });
  avgTurnaroundTime.value=(totalTAT/results.length).toFixed(2);
  avgWaitingTime.value=(totalWT/results.length).toFixed(2);
  throughput.value=(results.length/Math.max(...results.map(p=>p.completionTime))).toFixed(2);

  renderGantt();
}

/* ========== Render Gantt Chart ========== */
function renderGantt(){
  ganttChart.innerHTML="";
  ganttData.forEach((b,i)=>{
    const div=document.createElement("div");
    div.className=`gantt-block color-${b.pid%8}`;
    div.dataset.pid=`P${b.pid}`;
    div.dataset.start=b.start;
    div.dataset.end=b.end;
    div.innerHTML=`P${b.pid}<small>${b.start}-${b.end}</small>`;
    ganttChart.appendChild(div);
    setTimeout(()=>div.style.opacity=1,30*i);
  });
}

/* ========== Download PDF ========== */
btnDownloadPDF.addEventListener("click", async ()=>{
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("CPU Scheduling Results",14,20);

  doc.autoTable({ html:"#tblResults", startY:30 });

  // Capture gantt
  const canvas = await html2canvas(ganttChart);
  const imgData = canvas.toDataURL("image/png");
  doc.addPage();
  doc.text("Gantt Chart",14,20);
  doc.addImage(imgData,"PNG",15,30,180,60);

  // Metrics
  doc.addPage();
  doc.text(`Avg TAT: ${avgTurnaroundTime.value}`,14,30);
  doc.text(`Avg WT: ${avgWaitingTime.value}`,14,40);
  doc.text(`Throughput: ${throughput.value}`,14,50);

  // Footer
  doc.setFontSize(10);
  doc.textWithLink("By Harshsfd",14,280,{url:"https://www.linkedin.com/in/harshsfd"});

  doc.save("results.pdf");
});

/* ========== Download CSV ========== */
btnDownloadCSV.addEventListener("click", ()=>{
  if(processes.length===0)return;
  let csv="Process ID,Arrival Time,Burst Time,Completion Time,Waiting Time,Turnaround Time\n";
  Array.from(tblResults.querySelectorAll("tr")).forEach(tr=>{
    let cols=tr.querySelectorAll("td");
    if(cols.length) csv+=[...cols].map(c=>c.innerText).join(",")+"\n";
  });
  csv+=`\nAverage TAT,${avgTurnaroundTime.value}`;
  csv+=`\nAverage WT,${avgWaitingTime.value}`;
  csv+=`\nThroughput,${throughput.value}`;

  let order=[];
  ganttData.forEach(b=>{order.push(`P${b.pid} (${b.start}-${b.end})`);});
  csv+=`\nGantt Chart,"${order.join(", ")}"`;
  csv+=`\nCreated By,Harshsfd (https://www.linkedin.com/in/harshsfd)`;

  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const link=document.createElement("a");
  link.href=URL.createObjectURL(blob);
  link.download="results.csv";
  link.click();
});

/* ========== Calculate Button ========== */
btnCalculate.addEventListener("click", calculate);