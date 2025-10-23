/* assessment_hybrid_mobile_white_full_umd.jsx
   - UMD直実行（import/export不要）/ React UMD 前提 / Tailwind 前提
   - 白背景・スマホ幅（~390px）
   - 全31質問（基本チェックリスト・後期高齢者質問票統合版）
   - 未回答バリデーション / 途中保存(localStorage) / 結果サマリ（参考情報・非医療判定）
*/
const { useState, useEffect, useMemo } = React;

/* ---------------- 質問定義（全31問） ---------------- */
const QUESTIONS = [
  // --- プロフィール（LQ: 健康状態/満足度/BMI）---
  {
    id: "LQ-HEALTH",
    section: "プロフィール", domain: "健康状態",
    text: "現在の健康状態はいかがですか？",
    type: "choice", required: true,
    options: ["①よい","②まあよい","③ふつう","④あまりよくない","⑤よくない"],
    mapRisk: (v)=>["④あまりよくない","⑤よくない"].includes(v)
  },
  {
    id: "LQ-SATIS",
    section: "プロフィール", domain: "満足度",
    text: "毎日の生活に満足していますか？",
    type: "choice", required: true,
    options: ["①満足","②やや満足","③やや不満","④不満"],
    mapRisk: (v)=>["③やや不満","④不満"].includes(v)
  },
  {
    id: "LQ-BMI",
    section: "プロフィール", domain: "BMI",
    text: "身長(cm)と体重(kg)を入力してください（BMIは自動算出）",
    type: "group", required: true
  },

  // --- 生活（KCL-1,2,3 + LQ喫煙）---
  { id:"KCL-1", section:"生活", domain:"生活", text:"バスや電車で1人で外出していますか？", type:"bool", required:true, mapRisk:(v)=>v==="いいえ" },
  { id:"KCL-2", section:"生活", domain:"生活", text:"日用品の買い物をしていますか？", type:"bool", required:true, mapRisk:(v)=>v==="いいえ" },
  { id:"KCL-3", section:"生活", domain:"生活", text:"預貯金の出し入れをしていますか？", type:"bool", required:true, mapRisk:(v)=>v==="いいえ" },
  { id:"LQ-SMOKE", section:"生活", domain:"喫煙", text:"あなたはたばこを吸いますか？", type:"choice", required:true,
    options:["吸っている","吸っていない","やめた"], mapRisk:(v)=>v==="吸っている" },

  // --- 社会 ---
  { id:"KCL-4", section:"社会", domain:"社会参加", text:"友人の家を訪ねていますか？", type:"bool", required:true, mapRisk:(v)=>v==="いいえ" },
  { id:"KCL-5", section:"社会", domain:"ソーシャルサポート", text:"家族や友人の相談にのっていますか？", type:"bool", required:true, mapRisk:(v)=>v==="いいえ" },
  { id:"HB-007", section:"社会", domain:"ソーシャルサポート", text:"体調が悪いときに、身近に相談できる人がいますか", type:"bool", required:true, mapRisk:(v)=>v==="いいえ" },
  { id:"HB-008", section:"社会", domain:"社会参加", text:"ふだんから家族や友人と付き合いがありますか", type:"bool", required:true, mapRisk:(v)=>v==="いいえ" },

  // --- 運動 ---
  { id:"KCL-6",  section:"運動", domain:"運動", text:"階段を手すりや壁をつたわらずに昇っていますか？", type:"bool", required:true, mapRisk:(v)=>v==="いいえ" },
  { id:"KCL-7A", section:"運動", domain:"運動", text:"椅子から何もつかまらずに立ち上がっていますか？", type:"bool", required:true, mapRisk:(v)=>v==="いいえ" },
  { id:"KCL-8A", section:"運動", domain:"運動", text:"15分くらい続けて歩いていますか？", type:"bool", required:true, mapRisk:(v)=>v==="いいえ" },
  { id:"KCL-10", section:"運動", domain:"転倒", text:"転倒に対する不安は大きいですか？", type:"bool", required:true, mapRisk:(v)=>v==="はい" },

  // --- 運動・転倒 ---
  { id:"KCL-7B", section:"運動・転倒", domain:"運動", text:"以前に比べて歩く速度が遅くなったと思いますか？", type:"bool", required:true, mapRisk:(v)=>v==="はい" },
  { id:"KCL-8B", section:"運動・転倒", domain:"転倒", text:"この1年間に転んだことがありますか？", type:"bool", required:true, mapRisk:(v)=>v==="はい" },
  { id:"KCL-9B", section:"運動・転倒", domain:"運動", text:"ウォーキング等の運動を週1回以上していますか？", type:"bool", required:true, mapRisk:(v)=>v==="いいえ" },

  // --- 栄養 ---
  { id:"KCL-12", section:"栄養", domain:"栄養", text:"1日3食きちんと食べていますか？", type:"bool", required:true, mapRisk:(v)=>v==="いいえ" },
  { id:"KCL-11", section:"栄養", domain:"栄養", text:"6ヶ月間で2〜3kg以上の体重減少がありましたか？", type:"bool", required:true, mapRisk:(v)=>v==="はい" },

  // --- 口腔 ---
  { id:"KCL-13", section:"口腔", domain:"口腔", text:"半年前に比べて固いものが食べにくくなりましたか？", type:"bool", required:true, mapRisk:(v)=>v==="はい" },
  { id:"KCL-14", section:"口腔", domain:"口腔", text:"お茶や汁物等でむせることがありますか？", type:"bool", required:true, mapRisk:(v)=>v==="はい" },
  { id:"KCL-15", section:"口腔", domain:"口腔", text:"口の渇きが気になりますか？", type:"bool", required:true, mapRisk:(v)=>v==="はい" },

  // --- 閉じこもり ---
  { id:"KCL-16", section:"閉じこもり", domain:"閉じこもり", text:"週に1回以上は外出していますか？", type:"bool", required:true, mapRisk:(v)=>v==="いいえ" },
  { id:"KCL-17", section:"閉じこもり", domain:"閉じこもり", text:"昨年と比べて外出の回数が減っていますか？", type:"bool", required:true, mapRisk:(v)=>v==="はい" },

  // --- 認知 ---
  { id:"KCL-18", section:"認知", domain:"認知", text:"周りの人から同じことを聞くなどの物忘れがあると言われますか？", type:"bool", required:true, mapRisk:(v)=>v==="はい" },
  { id:"KCL-19", section:"認知", domain:"認知", text:"自分で電話番号を調べて電話をかけることをしていますか？", type:"bool", required:true, mapRisk:(v)=>v==="いいえ" },
  { id:"KCL-20", section:"認知", domain:"認知", text:"今日が何月何日かわからない時がありますか？", type:"bool", required:true, mapRisk:(v)=>v==="はい" },

  // --- うつ ---
  { id:"KCL-21", section:"うつ", domain:"うつ", text:"（ここ2週間）毎日の生活に充実感がない", type:"bool", required:true, mapRisk:(v)=>v==="はい" },
  { id:"KCL-22", section:"うつ", domain:"うつ", text:"（ここ2週間）以前楽しんでいたことが楽しめなくなった", type:"bool", required:true, mapRisk:(v)=>v==="はい" },
  { id:"KCL-23", section:"うつ", domain:"うつ", text:"（ここ2週間）以前は楽にできていたことが今ではおっくうに感じられる", type:"bool", required:true, mapRisk:(v)=>v==="はい" },
  { id:"KCL-24", section:"うつ", domain:"うつ", text:"（ここ2週間）自分が役に立つ人間だと思えない", type:"bool", required:true, mapRisk:(v)=>v==="はい" },
  { id:"KCL-25", section:"うつ", domain:"うつ", text:"（ここ2週間）わけもなく疲れた感じがする", type:"bool", required:true, mapRisk:(v)=>v==="はい" },
];

/* ---------------- ユーティリティ ---------------- */
const LS_KEY = "APP_HYBRID_WHITE_FULL_V1";

// 各チェックリストの設問順序を定義
const KCL_DISPLAY_ORDER = [
  "KCL-1", "KCL-2", "KCL-3", "KCL-4", "KCL-5", "KCL-6", "KCL-7A", "KCL-8A",
  "KCL-8B", // No.9 転倒
  "KCL-10", "KCL-11",
  "LQ-BMI", // No.12 BMI
  "KCL-13", "KCL-14", "KCL-15", "KCL-16", "KCL-17", "KCL-18", "KCL-19", "KCL-20",
  "KCL-21", "KCL-22", "KCL-23", "KCL-24", "KCL-25"
];

const LQ_DISPLAY_ORDER = [
  "LQ-HEALTH",       // No.1 健康状態
  "LQ-SATIS",        // No.2 生活満足度
  "KCL-12",          // No.3 食習慣
  "KCL-13",          // No.4 口腔機能
  "KCL-14",          // No.5 口腔機能
  "KCL-11",          // No.6 体重変化
  "KCL-7B",          // No.7 運動・転倒 (歩行速度)
  "KCL-8B",          // No.8 運動・転倒 (転倒歴)
  "KCL-9B",          // No.9 運動・転倒 (運動習慣)
  "KCL-18",          // No.10 認知機能
  "KCL-20",          // No.11 認知機能
  "LQ-SMOKE",        // No.12 喫煙
  "KCL-16",          // No.13 社会とのつながり (外出)
  "HB-008",          // No.14 社会とのつながり (付き合い)
  "HB-007",          // No.15 社会とのつながり (相談)
];

function calcBMI(h_cm, w_kg){
  const h = Number(h_cm)/100, w = Number(w_kg);
  if(!h || !w) return null;
  return +(w/(h*h)).toFixed(1);
}

// KCL 質問ID → 標準 1..25 の番号へマップ
const KCL_ID_TO_NO = {
  "KCL-1":1, "KCL-2":2, "KCL-3":3, "KCL-4":4, "KCL-5":5,
  "KCL-6":6, "KCL-7A":7, "KCL-8A":8,
  "KCL-8B":9,              // 転倒歴
  "KCL-10":10, "KCL-11":11,
  "KCL-12":12,             // 食習慣（+ 低BMIもここに寄与）
  "KCL-13":13, "KCL-14":14, "KCL-15":15,
  "KCL-16":16, "KCL-17":17, "KCL-18":18, "KCL-19":19, "KCL-20":20,
  "KCL-21":21, "KCL-22":22, "KCL-23":23, "KCL-24":24, "KCL-25":25,
};

// 回答 → kclOn配列（1..25）へ
function makeKclOn(answers){
  const on = [];
  for(const q of QUESTIONS){
    if(!(q.id in KCL_ID_TO_NO)) continue;
    const v = answers[q.id];
    if(v==null || v==="") continue;
    if(typeof q.mapRisk==="function" && q.mapRisk(v, answers)){
      on.push(KCL_ID_TO_NO[q.id]);
    }
  }
  // 低BMIも #12 に寄与
  const bmiV = answers["LQ-BMI"];
  const bmi = calcBMI(bmiV?.height_cm, bmiV?.weight_kg);
  if(bmi && bmi < 18.5) on.push(12);

  return Array.from(new Set(on)).sort((a,b)=>a-b);
}

// KHQ フラグ（今は未使用なら空でOK）
function makeKhqFlags(_answers){
  return {}; // 例: {5:true} を立てたいときだけ実装
}




function bySections(list){
  const map={}; list.forEach(q=>{ (map[q.section]=map[q.section]||[]).push(q); });
  return Object.entries(map).map(([name,items])=>({name,items}));
}
function getDomains(){
  // 質問リストから重複なくドメインのリストを取得する
  const domainsInOrder = [];
  const domainSet = new Set();
  QUESTIONS.forEach(q => {
    if (!domainSet.has(q.domain)) {
      domainSet.add(q.domain);
      domainsInOrder.push(q.domain);
    }
  });
  return domainsInOrder;
}
function riskCountByDomain(answers){
  const res={}; getDomains().forEach(d=>res[d]=0);
  for(const q of QUESTIONS){
    const v = answers[q.id];
    if(q.id==="LQ-BMI"){
      const bmi = calcBMI(v?.height_cm, v?.weight_kg);
      if(bmi && (bmi<18.5 || bmi>=27)) res["栄養"] = (res["栄養"]||0)+1;
      continue;
    }
    if(v==null || v==="") continue;
    if(typeof q.mapRisk==="function" && q.mapRisk(v, answers)) res[q.domain]=(res[q.domain]||0)+1;
  }
  return res;
}

function calculateScores(answers) {
  const kclCategories = {
    iadl: ["KCL-1", "KCL-2", "KCL-3", "KCL-4", "KCL-5"],
    motor: ["KCL-6", "KCL-7A", "KCL-8A", "KCL-8B", "KCL-10"],
    nutrition: ["KCL-11", "KCL-12"],
    oral: ["KCL-13", "KCL-14", "KCL-15"],
    housebound: ["KCL-16", "KCL-17"],
    cognition: ["KCL-18", "KCL-19", "KCL-20"],
    depression: ["KCL-21", "KCL-22", "KCL-23", "KCL-24", "KCL-25"],
  };

  const lqCategories = {
    healthStatus: ["LQ-HEALTH"],
    mentalHealth: ["LQ-SATIS"],
    dietary: ["KCL-12"],
    oral: ["KCL-13", "KCL-14"],
    weightChange: ["KCL-11"],
    exerciseFall: ["KCL-7B", "KCL-8B", "KCL-9B"],
    cognition: ["KCL-18", "KCL-20"],
    smoking: ["LQ-SMOKE"],
    social: ["KCL-4", "KCL-16", "HB-008"],
    support: ["KCL-5", "HB-007"],
  };

  const kclScores = { iadl: 0, motor: 0, nutrition: 0, oral: 0, housebound: 0, cognition: 0, depression: 0 };
  const lqScores = { healthStatus: 0, mentalHealth: 0, dietary: 0, oral: 0, weightChange: 0, exerciseFall: 0, cognition: 0, smoking: 0, social: 0, support: 0 };

  for (const q of QUESTIONS) {
    const v = answers[q.id];
    if (v == null || v === "") continue;

    const isRisk = q.mapRisk ? q.mapRisk(v, answers) : false;
    if (!isRisk) continue;

    for (const [category, ids] of Object.entries(kclCategories)) {
      if (ids.includes(q.id)) kclScores[category]++;
    }
    for (const [category, ids] of Object.entries(lqCategories)) {
      if (ids.includes(q.id)) lqScores[category]++;
    }
  }

  const bmiV = answers["LQ-BMI"];
  const bmi = calcBMI(bmiV?.height_cm, bmiV?.weight_kg);
  if (bmi && bmi < 18.5) {
    kclScores.nutrition++;
  }
  
  const kclTotalNoDepression = kclScores.iadl + kclScores.motor + kclScores.nutrition + kclScores.oral + kclScores.housebound + kclScores.cognition;
  const kclTotal = kclTotalNoDepression + kclScores.depression;

  return { kclScores, kclTotal, kclTotalNoDepression, lqScores };
}

const sum = (obj)=>Object.values(obj).reduce((a,b)=>a+(Number(b)||0),0);

const KCL_MAX_SCORES = {
  iadl: 5,
  motor: 5,
  nutrition: 3, // KCL-11, KCL-12, and low BMI
  oral: 3,
  housebound: 2,
  cognition: 3,
  depression: 5,
};

const LQ_MAX_SCORES = {
  healthStatus: 1,
  mentalHealth: 1,
  dietary: 1,
  oral: 2,
  weightChange: 1,
  exerciseFall: 3,
  cognition: 2,
  smoking: 1,
  social: 3,
  support: 2,
};

/* ---------------- メインApp（白背景・スマホ幅） ---------------- */
function App(){
  const [answers, setAnswers] = useState(()=>{ try{return JSON.parse(localStorage.getItem(LS_KEY)||"{}");}catch{return{}}; });
  const sections = useMemo(()=> bySections(QUESTIONS), []);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [view, setView] = useState('form'); // 'form' または 'result'

  const current = sections[sectionIndex] || {name:"",items:[]};

  useEffect(()=>{
    try{ localStorage.setItem(LS_KEY, JSON.stringify(answers)); }catch{}
  },[answers]);

  const answeredIn = (items)=>items.reduce((acc,q)=>{
    const v = answers[q.id];
    if(q.type==="group") return acc + (v?.height_cm && v?.weight_kg ? 1:0);
    return acc + (v?1:0);
  },0);

  const totalRequired = QUESTIONS.length;
  const answeredRequired = QUESTIONS.reduce((acc,q)=>acc + (q.type==="group" ? (answers[q.id]?.height_cm && answers[q.id]?.weight_kg ?1:0) : (answers[q.id]?1:0)), 0);
  const progress = Math.round(answeredRequired/totalRequired*100);
  const isComplete = answeredRequired===totalRequired;

  const cheeringMessage = useMemo(() => {
      if (progress === 0) return "さあ、始めましょう！";
      if (progress > 0 && progress <= 30) return "その調子です！";
      if (progress > 30 && progress <= 60) return "半分まできましたね！";
      if (progress > 60 && progress < 100) return "あともう少しです！頑張って！";
      if (progress === 100) return "お疲れ様でした！完璧です！";
      return "さあ、始めましょう！";
  }, [progress]);

  const canNextSection = ()=> current.items.every(q=>{
    const v=answers[q.id];
    if(q.type==="group") return Boolean(v?.height_cm && v?.weight_kg);
    return v!=null && v!=="";
  });

  const setValue = (qid, value)=> setAnswers(prev=>({...prev, [qid]:value}));

  const handleReset = () => {
      localStorage.removeItem(LS_KEY);
      setAnswers({});
      setSectionIndex(0);
      setView('form');
  }

  const risks = riskCountByDomain(answers);
  const bmi = answers["LQ-BMI"] ? calcBMI(answers["LQ-BMI"].height_cm, answers["LQ-BMI"].weight_kg) : null;
  const scores = calculateScores(answers);
  const maxScores = { kcl: KCL_MAX_SCORES, lq: LQ_MAX_SCORES };
  
  const handleGoToResult = () => {
      if(isComplete) {
          setView('result');
      }
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 py-6">
      <div className="w-[390px] mx-auto bg-white border border-gray-200 shadow rounded-2xl overflow-hidden">
        {/* ヘッダ */}
        <div className="px-4 py-3 border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">基本チェックリスト・後期高齢者質問票</div>
              <div className="text-[11px] text-gray-500">（非医療判定・参考情報）</div>
            </div>
            <div className="flex gap-2">
              <button className="px-2 py-1 rounded-md border border-gray-300 text-[11px] hover:bg-gray-50" onClick={handleReset}>最初からやりなおす</button>
            </div>
          </div>

          {/* 進捗バー & 応援キャラクター */}
          {view === 'form' && (
            <div className="mt-3">
              <div className="flex items-end gap-2 mb-2">
                <div className="w-12 h-12 flex-shrink-0">
                  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <g transform="translate(0, 5)">
                      {/* <!-- Body --> */}
                      <rect x="25" y="70" width="50" height="25" rx="10" fill="#81e6d9" />
                      {/* <!-- Head --> */}
                      <rect x="20" y="20" width="60" height="60" rx="30" fill="#ffedd5" />
                      {/* <!-- Hair --> */}
                      <path d="M 20 50 C 20 20, 80 20, 80 50 L 80 60 C 80 60, 60 50, 50 50 C 40 50, 20 60, 20 60 Z" fill="#4a5568" />
                      {/* <!-- Eyes --> */}
                      <circle cx="40" cy="55" r="7" fill="white" />
                      <circle cx="60" cy="55" r="7" fill="white" />
                      <circle cx="42" cy="57" r="4" fill="#2d3748" />
                      <circle cx="62" cy="57" r="4" fill="#2d3748" />
                      <circle cx="40" cy="54" r="1.5" fill="white" />
                      <circle cx="60" cy="54" r="1.5" fill="white" />
                      {/* <!-- Mouth --> */}
                      <path d="M 45 70 Q 50 75, 55 70" stroke="#c05621" fill="none" strokeWidth="2" strokeLinecap="round" />
                    </g>
                  </svg>
                </div>
                { cheeringMessage && (
                  <div className="relative bg-blue-100 text-blue-800 text-xs rounded-lg px-3 py-2 shadow-sm">
                    {cheeringMessage}
                    <div className="absolute left-3 -bottom-2 w-0 h-0 border-t-[10px] border-t-blue-100 border-r-[10px] border-r-transparent"></div>
                  </div>
                )}
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 transition-all" style={{width:`${progress}%`}}/>
              </div>
              <div className="text-right text-[10px] text-gray-500 mt-1">{progress}%</div>
            </div>
          )}
        </div>

        {/* 本文 */}
        <div className="h-[720px] overflow-y-auto px-4 py-3">
          {view === 'form' ? (
            <>
              {/* セクションタイトル（例：プロフィール（0/3）） */}
              <div className="mb-3">
                <div className="text-base font-semibold text-gray-900">
                  {current.name}（{answeredIn(current.items)}/{current.items.length}）
                </div>
                <div className="text-[11px] text-gray-500">未回答の設問に回答すると「次へ」に進めます</div>
              </div>

              {/* 設問カード */}
              <div className="space-y-3">
                {current.items.map(q=>(
                  <QuestionRow key={q.id} q={q} value={answers[q.id]} setValue={setValue}/>
                ))}
              </div>

              {/* ナビゲーション */}
              <div className="flex justify-between mt-4">
                <button
                  onClick={()=> setSectionIndex(i=>Math.max(0,i-1))}
                  disabled={sectionIndex===0}
                  className={"px-4 py-2 rounded-lg border text-sm " + (sectionIndex===0 ? "opacity-50 cursor-not-allowed border-gray-300 text-gray-400" : "border-gray-400 hover:bg-gray-50")}
                >
                  戻る
                </button>
                {sectionIndex === sections.length - 1 ? (
                   <button
                    onClick={handleGoToResult}
                    disabled={!isComplete}
                    className={"px-4 py-2 rounded-lg text-sm " + (!isComplete ? "bg-blue-400/50 cursor-not-allowed text-white" : "bg-blue-600 hover:bg-blue-500 text-white")}
                   >
                     結果を見る
                   </button>
                ) : (
                  <button
                    onClick={()=> canNextSection() && setSectionIndex(i=>Math.min(sections.length-1,i+1))}
                    disabled={!canNextSection()}
                    className={"px-4 py-2 rounded-lg text-sm " + (!canNextSection() ? "bg-blue-400/50 cursor-not-allowed text-white" : "bg-blue-600 hover:bg-blue-500 text-white")}
                  >
                    次へ
                  </button>
                )}
              </div>
            </>
          ) : (
            <ResultPanel answers={answers} risks={risks} bmi={bmi} onBack={() => setView('form')} scores={scores} maxScores={maxScores} />
          )}

          <div className="h-6"/>
        </div>
      </div>
    </div>
  );
}

/* ---------------- UI部品 ---------------- */
function QuestionRow({ q, value, setValue }) {
  if (q.type === "bool") {
    const v = value || "";
    return (
      <div className="bg-gray-50 p-3 rounded-lg border border-gray-300">
        <div className="text-[13px] mb-2">{q.text}</div>
        <div className="flex gap-2 flex-wrap">
          {["はい","いいえ"].map(opt=>(
            <button key={opt}
              className={"px-3 py-1.5 rounded-lg border text-sm " + (v===opt ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-400 hover:bg-gray-100")}
              onClick={()=> setValue(q.id, opt)}
            >{opt}</button>
          ))}
        </div>
      </div>
    );
  }

  if (q.type === "choice") {
    const v = value || "";
    return (
      <div className="bg-gray-50 p-3 rounded-lg border border-gray-300">
        <div className="text-[13px] mb-2">{q.text}</div>
        <div className="flex gap-2 flex-wrap">
          {q.options.map(opt=>(
            <button key={opt}
              className={"px-3 py-1.5 rounded-lg border text-sm " + (v===opt ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-400 hover:bg-gray-100")}
              onClick={()=> setValue(q.id, opt)}
            >{opt}</button>
          ))}
        </div>
      </div>
    );
  }

if (q.type === "group" && q.id === "LQ-BMI") {
  const v = value || {};
  const bmi = calcBMI(v.height_cm, v.weight_kg);

  const handleValueChange = (field, amount) => {
    const def = field === 'height_cm' ? 160 : 50;
    const cur = parseFloat(v[field]) || def;
    const next = Math.max(0, cur + amount);
    setValue(q.id, { ...v, [field]: Number(next.toFixed(1)) });
  };

  return (
    <div className="bg-gray-50 p-3 rounded-lg border border-gray-300">
      <div className="text-[13px] mb-2">{q.text}</div>

      {/* 👇 ここを flex-wrap に変更（幅が足りなければ自動で折り返す） */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm w-14">身長(cm)</span>
          <button className="px-2 py-1 border rounded" onClick={() => handleValueChange('height_cm', -0.5)}>-</button>
          <input
            className="w-20 px-2 py-1 border rounded"
            value={v.height_cm ?? ""}
            onChange={e => setValue(q.id, { ...v, height_cm: Number(e.target.value) || "" })}
            placeholder="160"
          />
          <button className="px-2 py-1 border rounded" onClick={() => handleValueChange('height_cm', 0.5)}>+</button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm w-14">体重(kg)</span>
          <button className="px-2 py-1 border rounded" onClick={() => handleValueChange('weight_kg', -0.5)}>-</button>
          <input
            className="w-20 px-2 py-1 border rounded"
            value={v.weight_kg ?? ""}
            onChange={e => setValue(q.id, { ...v, weight_kg: Number(e.target.value) || "" })}
            placeholder="50"
          />
          <button className="px-2 py-1 border rounded" onClick={() => handleValueChange('weight_kg', 0.5)}>+</button>
        </div>
      </div>

      <div className="text-[12px] text-gray-600 mt-2">BMI: {bmi ?? "-"}</div>
    </div>
  );
}

  }

  // それ以外の型は今は未使用
  return null;
}

function AnswerSummaryTable({ title, questionIds, allQuestions, answers }) {
  const questionMap = useMemo(() => {
    const map = new Map();
    allQuestions.forEach(q => map.set(q.id, q));
    return map;
  }, [allQuestions]);

  return (
    <div className="bg-gray-50 p-3 rounded-lg border border-gray-300 mb-3">
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px] table-auto">
          <colgroup>
            <col style={{ width: '70%' }} />
            <col style={{ width: '30%' }} />
          </colgroup>
          <thead>
            <tr className="border-b">
              <th className="py-2 font-semibold">質問項目</th>
              <th className="py-2 font-semibold text-right">回答</th>
            </tr>
          </thead>
          <tbody>
            {questionIds.map((id, index) => {
              const q = questionMap.get(id);
              if (!q) return null;

              let answerContent = answers[id] ?? "-";
              if (q.id === 'LQ-BMI' && answers[id]) {
                const { height_cm, weight_kg } = answers[id] || {};
                const bmi = calcBMI(height_cm, weight_kg);
                answerContent = (
                  <div className="text-right">
                    <div>{`身長:${height_cm || '-'}cm`}</div>
                    <div>{`体重:${weight_kg || '-'}kg`}</div>
                    <div>{`→BMI:${bmi || '-'}`}</div>
                  </div>
                );
              }

              return (
                <tr key={id} className="border-b border-gray-200 last:border-b-0">
                  <td className="py-2 pr-2 align-top">{`${index + 1}. ${q.text}`}</td>
                  <td className="py-2 font-medium">{answerContent}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultPanel({ answers, risks, bmi, onBack, scores, maxScores }){
  const [resultView, setResultView] = useState('summary'); // 'summary', 'kcl_answers', or 'lq_answers'
  const [fbText, setFbText] = useState("");
  const [fbLoading, setFbLoading] = useState(false);
  const totalRisks = sum(risks);

  // === Pyodideを使ってフィードバックを生成 ===
// === Pyodideを使ってフィードバックを生成 ===
async function onClickGenerate() {
  setFbLoading(true);
  setFbText("");
  try {
    const kclOn = makeKclOn(answers);        // 1..25 のON配列
    const khqFlags = makeKhqFlags(answers);  // {5:true} など（なければ {}）

    const txt = await generateFeedbackWithPyodide({
      age_group: "後期高齢者",
      sex: "女",
      kclOnArray: kclOn,
      khqFlags: khqFlags,
      extras: {} // 例: {"khq10_falls_count": 0}
    });

    setFbText(txt);
  } catch (e) {
    console.error(e);
    setFbText("フィードバック生成でエラーが発生しました。");
  } finally {
    setFbLoading(false);
  }
}
  useEffect(() => { onClickGenerate(); }, []);  // 初回マウント時に自動生成

  const hints=[];
  if((risks["運動"]||0)>=3) hints.push("運動の項目に複数の注意。転倒予防の運動や短時間の散歩から始めましょう。");
  if((risks["口腔"]||0)>=2) hints.push("口腔の項目に注意あり。むせ・咀嚼の変化が続く場合は早めの相談を。");
  if((risks["栄養"]||0)>=2) hints.push("栄養の項目に注意あり。たんぱく質摂取・食事回数の見直しを。");
  if((risks["認知"]||0)>=1) hints.push("認知の変化が見られます。生活リズムやコミュニケーションの工夫を。");
  if((risks["うつ"]||0)>=2) hints.push("気分面の負担が示唆されます。相談窓口の活用や日中活動を増やす工夫を。");
  if(answers["LQ-SMOKE"]==="吸っている") hints.push("喫煙は健康リスクと関連します。禁煙支援の活用をご検討ください。");
  if(bmi && bmi<18.5) hints.push("BMIがやや低めです。食事量やたんぱく質の摂取を意識しましょう。");
  if(bmi && bmi>=27) hints.push("BMIがやや高めです。活動量と食事バランスの見直しを。");

  const kclCategoryLabels = {
    iadl: "① 日常生活関連動作 (#1-5)",
    motor: "② 運動器の機能 (#6-10)",
    nutrition: "③ 低栄養状態 (#11-12)",
    oral: "④ 口腔機能 (#13-15)",
    housebound: "⑤ 閉じこもり (#16-17)",
    cognition: "⑥ 認知機能 (#18-20)",
    depression: "⑦ 抑うつ気分 (#21-25)",
  };
  const lqCategoryLabels = {
    healthStatus: "（1）健康状態",
    mentalHealth: "（2）心の健康状態",
    dietary: "（3）食習慣",
    oral: "（4）口腔機能",
    weightChange: "（5）体重変化",
    exerciseFall: "（6）運動・転倒",
    cognition: "（7）認知機能",
    smoking: "（8）喫煙",
    social: "（9）社会参加",
    support: "（10）ソーシャルサポート",
  };

  if (resultView === 'kcl_answers') {
    return (
      <div className="pb-6">
        <div className="text-lg font-semibold mb-1">回答一覧</div>
        <div className="text-[11px] text-gray-500 mb-3">あなたが回答した内容の一覧です。</div>
        
        <AnswerSummaryTable
          title="フレイル基本チェックリスト 回答"
          questionIds={KCL_DISPLAY_ORDER}
          allQuestions={QUESTIONS}
          answers={answers}
        />
        
        <div className="flex gap-2 mt-4">
          <button className="px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
            onClick={() => setResultView('summary')}>
            サマリーに戻る
          </button>
        </div>
      </div>
    );
  }
  
  if (resultView === 'lq_answers') {
    return (
      <div className="pb-6">
        <div className="text-lg font-semibold mb-1">回答一覧</div>
        <div className="text-[11px] text-gray-500 mb-3">あなたが回答した内容の一覧です。</div>
        
        <AnswerSummaryTable
          title="後期高齢者質問票 回答"
          questionIds={LQ_DISPLAY_ORDER}
          allQuestions={QUESTIONS}
          answers={answers}
        />
        
        <div className="flex gap-2 mt-4">
          <button className="px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
            onClick={() => setResultView('summary')}>
            サマリーに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <div className="text-lg font-semibold mb-1">結果サマリ（参考）</div>
      <div className="text-[11px] text-gray-500 mb-3">※本アプリは医療判定を行いません</div>

      {/* フレイル基本チェックリスト */}
      <div className="bg-gray-50 p-3 rounded-lg border border-gray-300 mb-3">
        <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-semibold">フレイル基本チェックリスト</div>
            <button 
                className="px-2 py-1 rounded-md border border-gray-300 text-[11px] hover:bg-gray-50"
                onClick={() => setResultView('kcl_answers')}>
                回答一覧表
            </button>
        </div>
        <div className="space-y-2 text-[12px] text-gray-700">
          {Object.entries(kclCategoryLabels).map(([key, label]) => {
            const score = scores.kclScores[key];
            const maxScore = maxScores.kcl[key];
            const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
            return (
              <div key={key}>
                <div className="flex justify-between items-center">
                  <span>{label}</span>
                  <span className="font-semibold">{score} / {maxScore} 点</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-blue-600" style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-gray-200 mt-3 pt-2 space-y-1 text-sm">
          <div className="flex justify-between font-semibold">
            <span>うつを除く20項目の合計</span>
            <span>{scores.kclTotalNoDepression} 点</span>
          </div>
          <div className="flex justify-between font-bold text-blue-600">
            <span>総合点 (全25項目)</span>
            <span>{scores.kclTotal} 点</span>
          </div>
        </div>
      </div>
      
      {/* 後期高齢者質問票 */}
      <div className="bg-gray-50 p-3 rounded-lg border border-gray-300 mb-3">
        <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-semibold">後期高齢者質問票</div>
            <button 
                className="px-2 py-1 rounded-md border border-gray-300 text-[11px] hover:bg-gray-50"
                onClick={() => setResultView('lq_answers')}>
                回答一覧表
            </button>
        </div>
        <div className="space-y-2 text-[12px] text-gray-700">
          {Object.entries(lqCategoryLabels).map(([key, label]) => {
            const score = scores.lqScores[key];
            const maxScore = maxScores.lq[key];
            const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
            return (
              <div key={key}>
                <div className="flex justify-between items-center">
                  <span>{label}</span>
                  <span className="font-semibold">{score} / {maxScore} 点</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-blue-600" style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* プロフィール概要 */}
      <div className="bg-gray-50 p-3 rounded-lg border border-gray-300 mb-3 mt-4">
        <div className="text-sm mb-2">プロフィール概要</div>
        <ul className="text-[12px] text-gray-700 space-y-1">
          <li>健康状態: {answers["LQ-HEALTH"]||"-"}</li>
          <li>生活満足度: {answers["LQ-SATIS"]||"-"}</li>
          <li>BMI: {bmi ?? "-"}</li>
          <li>喫煙: {answers["LQ-SMOKE"]||"-"}</li>
          <li>注意合計: {totalRisks}</li>
        </ul>
      </div>

      {/* ヒント */}
      {hints.length>0 && (
<div className="bg-white rounded-xl border p-3 mt-3">
  <div className="text-sm font-semibold mb-2">ヒント（自己管理の例）</div>

  {/* フィードバック表示（優先） */}
  {fbText ? (
    // 段落そのまま表示
    <div className="text-[13px] whitespace-pre-wrap leading-6">
      {fbText}
    </div>
  ) : fbLoading ? (
    <div className="text-[13px] text-gray-500">生成中です…</div>
  ) : (
    // まだ生成していない場合の既存デフォルト
    <ul className="list-disc pl-5 text-[13px] leading-6">
      <li>運動の項目に複数の注意。転倒予防の運動や短時間の散歩から始めましょう。</li>
      <li>口腔の項目に注意あり。むせ・咀嚼の変化が続く場合は早めの相談を。</li>
      <li>認知の変化が見られます。生活リズムやコミュニケーションの工夫を。</li>
      <li>気分面の負担が示唆されます。相談窓口の活用や日中活動を増やす工夫を。</li>
      <li>喫煙は健康リスクと関連します。禁煙支援の活用をご検討ください。</li>
    </ul>
  )}
</div>

      )}

      {/* 操作 */}
      <div className="flex gap-2">
        <button className="px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
          onClick={onBack}>
          回答へ戻る
        </button>
      </div>
    </div>
  );
}

// === Pyodide経由でPython関数を呼ぶラッパ（グローバル定義） ===
async function generateFeedbackWithPyodide({ age_group, sex, kclOnArray, khqFlags, extras = {} }) {
  const pyodide = await window.pyodideReady; // 初期化待ち

  // js_build_feedback は Python 側で定義された “関数” なので globals.get で取得
  const pyFunc = pyodide.globals.get('js_build_feedback');
  if (!pyFunc) throw new Error('Pyodide: js_build_feedback が見つかりません');

  // 呼び出し（JS配列/オブジェクトは自動変換されます）
  const result = pyFunc(age_group, sex, kclOnArray, khqFlags, extras);

  // 返り値の安全な文字列化
  const text = (result && typeof result.toString === 'function')
    ? result.toString()
    : String(result ?? '');

  // 後片付け（PyProxy解放が可能な場合）
  try { result && result.destroy && result.destroy(); } catch {}
  try { pyFunc && pyFunc.destroy && pyFunc.destroy(); } catch {}

  return text.trim();
}


/* ---------------- Viewer互換エクスポート ---------------- */
window.App = App;
window.renderApp = function(mountEl){
  const el = mountEl
    || document.getElementById("app")
    || document.getElementById("root")
    || (() => {
         const d = document.createElement("div");
         d.id = "app";
         document.body.appendChild(d);
         return d;
       })();
  const root = ReactDOM.createRoot(el);
  root.render(<App />);
};








