import { useEffect, useRef, useState } from 'react'
import NeuralBackdrop from './neural.jsx'
import OsLogin from './osLogin.jsx'

/* ABOUT — every word here comes from github.com/SushrithKbtech/my-portfolio. Nothing is invented:
   the bio, the numbers, the skill levels, the dates and the certificate scores are lifted from
   that page, restyled into this site's language. */

const STATS = [
  { n: '8.83', l: 'CGPA / 10' },
  { n: 'Top 8', l: 'of 15,000+ teams · national hackathon' },
  { n: '01', l: 'Springer-associated research paper' },
  { n: '6+', l: 'AI projects shipped' },
]

const SKILLS = [
  ['Python', 92], ['Generative AI · LLMs', 90], ['Machine Learning', 88], ['RAG Systems', 87],
  ['Agentic AI', 85], ['Full-Stack Development', 84], ['React', 82], ['Node.js', 80],
]

const CHIPS = ['Prompt Engineering', 'LangGraph', 'ChromaDB', 'Hugging Face', 'Whisper',
  'Supabase', 'Express', 'Tailwind CSS', 'Streamlit', 'Edge AI · Raspberry Pi', 'Network Security']

const WINS = [
  { h: 'Top 8 Nationwide — HCL GUVI AI Impact Summit 2026', w: '2026 · Team n0l0ck',
    p: 'Scored 88/100 among 15,000+ teams at Bharat Mandapam with Satark.ai, an agentic honeypot API for real-time scam detection.' },
  { h: 'Research Paper — SWSIoT-2025, with Springer', w: 'September 2025',
    p: 'Co-authored and presented “Hybrid AI-Powered Framework for Real-Time DDoS Detection Using ML and Entropy-Based Analysis” at the Int’l Conference on Smart Wireless Systems and IoT.' },
  { h: '1st Prize — Avishkar Project Exhibition', w: 'Vemana Institute of Technology · ISTE & IEEE',
    p: 'First prize (INR 3,000) for a Traffic Management System at the inter-college exhibition.' },
]

const EDU = [
  { h: 'RV University, Bengaluru', w: '2023 — 2027',
    p: 'B.Tech (Hons.) — CSE, Artificial Intelligence & Machine Learning · CGPA 8.83 / 10' },
  { h: 'Bangalore International Academy', w: '2022', p: 'Class 12 · CBSE · 76.40%' },
  { h: 'National Hill View Public School, Bengaluru', w: '2020', p: 'Class 10 · CBSE · 85.67%' },
]

const CERTS = [
  { h: 'Affective Computing', w: 'NPTEL · 93/100',
    p: 'AI × psychology × design — machines that recognise and respond to human emotion.' },
  { h: 'Software Testing', w: 'NPTEL · 84/100 · Elite + Top 1%',
    p: '12-week course — test design, black/white-box techniques, automation, QA across the SDLC.' },
  { h: 'Transformer Models & BERT', w: 'Simplilearn × Google Cloud',
    p: 'Attention mechanisms, transformer language modelling, and BERT in NLP tasks.' },
  { h: 'Open Source Models with Hugging Face', w: 'Simplilearn SkillUp',
    p: 'The HF ecosystem, open-source model selection, and practical NLP usage.' },
  { h: 'Introduction to LangGraph', w: 'Simplilearn SkillUp',
    p: 'Agentic workflow orchestration, stateful multi-step LLM pipelines, graph-based agents.' },
]

/* One observer for the whole page rather than one per element, and it disconnects the moment
   everything has been seen — a page this static shouldn't keep a callback alive to the end of
   the session. */
function useReveal() {
  const root = useRef()
  useEffect(() => {
    const els = Array.from(root.current?.querySelectorAll('.rv') ?? [])
    if (!els.length) return
    let left = els.length
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return
        e.target.classList.add('in')
        // skill bars fill from their data-level once they're actually on screen
        e.target.querySelectorAll('.bar u').forEach(u => { u.style.width = `${u.dataset.level}%` })
        io.unobserve(e.target)
        if (--left === 0) io.disconnect()
      })
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
  return root
}

/* Each section travels in as ONE piece from alternating sides — heading and body together, from
   off the edge of the screen rather than nudging up from below. */
function Section({ tag, title, children, side = 'left' }) {
  return (
    <section className="sec rv" data-side={side}>
      <h2><span className="tag">{tag}</span>{title}</h2>
      <div>{children}</div>
    </section>
  )
}

function Item({ h, w, p }) {
  return (
    <div className="item">
      <h3>{h}</h3>
      <p className="when">{w}</p>
      <p>{p}</p>
    </div>
  )
}

export default function About() {
  const root = useReveal()
  const [booted, setBooted] = useState(false)
  return (
    <div className="about" ref={root}>
      {!booted && <OsLogin onDone={() => setBooted(true)} />}
      <NeuralBackdrop />
      <nav>
        <span className="mark"><a href="/">SK</a></span>
        <a className="link" href="/">Home</a>
        <a className="link" href="/about.html">About</a>
        {/* the contact stage lives at the end of the home page's scroll */}
        <a className="enter" href="/#contact">Contact</a>
      </nav>

      <div className="wrap" data-booted={booted ? '1' : '0'}>
        <header className="ahead">
          <h1 className="rv" data-side="up">About</h1>
          <div className="rv" data-side="up">
            <span className="tag">Player profile</span>
            <p className="lede">
              <strong>AI/ML engineer and full-stack developer</strong> pursuing a B.Tech (Hons.) in
              CSE with an AI/ML specialisation at <em>RV University, Bengaluru</em>. I build
              real-world AI systems — RAG pipelines, agentic AI, and network-security research —
              including <em>Satark.ai</em>, an agentic honeypot API that placed <strong>Top 8
              nationwide</strong> at the HCL GUVI AI Impact Summit 2026, and a co-authored paper on
              hybrid AI-powered DDoS detection presented at SWSIoT-2025 in association with
              Springer. I care about clean UI, scalable systems, and AI that actually ships.
            </p>
            <div className="stats">
              {STATS.map(s => (
                <div className="stat" key={s.l}><b>{s.n}</b><span>{s.l}</span></div>
              ))}
            </div>
          </div>
        </header>

        <Section tag="02 / Skill tree" title="Skills" side="left">
          <div className="skills-grid">
            {SKILLS.map(([name, lvl]) => (
              <div className="skill" key={name}>
                <div className="row"><span>{name}</span><i>LVL {lvl}</i></div>
                <div className="bar"><u data-level={lvl} /></div>
              </div>
            ))}
          </div>
          <div className="chips">{CHIPS.map(c => <span key={c}>{c}</span>)}</div>
        </Section>

        <Section tag="04 / Trophy room" title="Achievements" side="right">
          {WINS.map(w => <Item key={w.h} {...w} />)}
        </Section>

        <Section tag="05 / Origin story" title="Education" side="left">
          {EDU.map(e => <Item key={e.h} {...e} />)}
        </Section>

        <Section tag="06 / Scrolls" title="Certifications" side="right">
          {CERTS.map(c => <Item key={c.h} {...c} />)}
        </Section>

        {/* Contact deliberately left out — it gets its own treatment elsewhere. */}
        <p className="foot">© 2026 Sushrith Kandagatla · Bengaluru</p>
      </div>
    </div>
  )
}
