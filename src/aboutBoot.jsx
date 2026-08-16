import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './hero.css'
import './about.css'
import About from './about.jsx'
import { installPageFade } from './pageFade'

installPageFade()

createRoot(document.getElementById('root')).render(<StrictMode><About /></StrictMode>)
