import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './AppV3'
import './styles.css'
import './enhancements.css'
import './professional.css'
import './managerial.css'
import './executive.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
