
let questions=[];
let answers={};

async function startQuiz(){
  const res=await fetch('questions.json');
  questions=await res.json();
  renderQuestion(0);
}

function renderQuestion(i){
  if(i>=questions.length){scoreQuiz();return;}
  const q=questions[i];

  document.getElementById("quiz").innerHTML=`
    <div class="question">
      <h3>${q.question}</h3>
      ${["A","B","C","D"].map(letter=>
        `<button onclick="answer('${q.question_id}','${letter}',${i})">
         ${letter}: ${q['option_'+letter.toLowerCase()]}
         </button>`).join("<br>")}
    </div>`;
}

function answer(id,val,i){
  answers[id]=val;
  renderQuestion(i+1);
}

function scoreQuiz(){
  let correct=0;
  const domainScores={};

  questions.forEach(q=>{
    if(!domainScores[q.domain]){
      domainScores[q.domain]={correct:0,total:0};
    }

    domainScores[q.domain].total++;

    if(answers[q.question_id]===q.correct_answer){
      correct++;
      domainScores[q.domain].correct++;
    }
  });

  let report="<h2>Assessment Results</h2>";
  report+=`Overall Score: ${correct}/${questions.length}<br><br>`;
  report+="<h3>Scores by Domain</h3>";

  Object.entries(domainScores).forEach(([domain,data])=>{
    report+=`${domain}: ${data.correct}/${data.total}<br>`;
  });

  document.getElementById("quiz").innerHTML="";
  document.getElementById("results").innerHTML=report;
}
