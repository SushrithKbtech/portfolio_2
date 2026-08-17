// The projects, lifted from github.com/SushrithKbtech/my-portfolio — same copy, same order.
// Each becomes one panel on the helix.
//   n    display title          d    the line that runs under it in the caption
//   k    section label          hue  the panel's colour, used by the generated poster
//   live the deployed URL, if there is one — a screenshot of it becomes the panel art
//   repo source, where it's public
export const SYSTEMS = [
  { id:'satark',  n:'SATARK.AI',        k:'Agentic AI',   hue:['#ff4d9d','#7b2ff7'],
    live:'https://adaptive-honeypot-agent.vercel.app',
    repo:'https://github.com/SushrithKbtech/finalguvi',
    d:'Conversational agent that engages scam callers to extract intelligence — numbers, bank details, tactics — with GPT-4.1-mini "Bridge Logic" prompting. Top 8 nationwide, 15,000+ teams.' },

  { id:'bhasha',  n:'BHASHABUDDY',      k:'Full Stack',   hue:['#5ee9ff','#1745ff'],
    live:'https://parampara-one.vercel.app',
    d:'Full-stack platform helping NRI children learn their native language through lessons and games. React/Vite, Supabase auth, OpenAI conversational practice, TTS pronunciation feedback.' },

  { id:'qbank',   n:'OUTCOME-QBANK',    k:'RAG',          hue:['#c8ff5e','#0fbf6a'],
    live:'https://question-bank-generator-bwvhnf3nfcblcmbhyf9zvt.streamlit.app/',
    d:'Ingests course PDFs and generates outcome-aligned exam questions. ChromaDB vector store, SentenceTransformer retrieval, and a self-auditing critique-retry loop. In faculty use.' },

  { id:'voice',   n:'VOICE TRANSLATION', k:'Edge AI',     hue:['#ffb35e','#ff2f6d'],
    d:'Real-time translation that keeps the speaker’s own voice across languages. Whisper STT into M2M100 into XTTS v2 voice cloning, tuned to run low-latency on a Raspberry Pi.' },

  { id:'ids',     n:'HYBRID DL IDS',    k:'Research',     hue:['#b98cff','#2de1c2'],
    d:'Intrusion detection pairing a supervised MLP with an unsupervised AutoEncoder on CSE-CIC-IDS2018. 98.12% accuracy, 96.95% macro-F1, and a fusion engine that cuts false negatives on novel attacks.' },

  { id:'board',   n:'AI BOARDROOM',     k:'Multi-agent',  hue:['#ffffff','#8ea2ff'],
    d:'A boardroom of AI agents — VC, skeptic, CTO, founder — that debate your startup idea from every angle and hand back a scored verdict.' },

  { id:'risk',    n:'RISK ASSESSMENT',  k:'Orchestration', hue:['#7cf5c0','#2b6cff'],
    live:'https://prism-risk-rho.vercel.app/',
    d:'Four agents on Relevance AI — description, location, historical claims, safety — scoring risk in parallel, with conflict resolution producing explainable levels, premium adjustments and confidence.' },
];
