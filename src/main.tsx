import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './AppV2'
import './styles.css'
import './enhancements.css'
import './professional.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
