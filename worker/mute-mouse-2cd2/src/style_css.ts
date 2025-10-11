export const STYLE_CSS = `
/* ==========================================================================
   Rosen Bridge Monitor - Stylesheet
   Distribution-ready version
   ========================================================================== */

/* ------------------------------
   Base Reset & Body
   ------------------------------ */
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    color: #333;
}

/* ------------------------------
   Layout Containers
   ------------------------------ */
.container { max-width: 1200px; margin: 0 auto; padding: 20px; }
.header { text-align: center; margin-bottom: 30px; color: white; }
/*.header h1 {
    font-size: 2.5rem;
    margin-bottom: 10px;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}*/

.header h1 {
  font-size: 2.5rem;
  font-weight: 300;  /* Light weight */
  letter-spacing: 0.05em;
  margin-bottom: 1.6rem;
  text-align: center;
  color: white;
}



/* ------------------------------
   Summary Section
   ------------------------------ */
.summary {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: 20px;
    margin-bottom: 30px;
}

.summary-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.summary-column-label {
    font-size: 1rem;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    text-align: center;
}

.summary-card {
    background: white;
    padding: 15px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    text-align: center;
    transition: transform 0.2s ease;
}
.summary-card:hover { transform: translateY(-3px); }

.summary-card h3 {
    font-size: 1.4rem;
    margin-bottom: 4px;
    font-weight: bold;
}
.summary-card p {
    font-size: 0.8rem;
    text-transform: uppercase;
    color: #555;
    margin: 0;
}

/* Color accents for summary cards - UPDATED */
.summary-card.healthy h3 { color: #10B981; }
.summary-card.unstable h3 { color: #F59E0B; }
.summary-card.broken h3 { color: #EF4444; }
.summary-card.sufficient h3 { color: #10B981; }  /* Green for sufficient (2+) */
.summary-card.critical h3 { color: #F59E0B; }    /* Orange for critical (1) */
.summary-card.exhausted h3 { color: #EF4444; }   /* Red for exhausted (0) */

/* ------------------------------
   Watcher Cards Grid
   ------------------------------ */
.watchers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 25px;
    margin-bottom: 40px;
}

.watcher-card {
    background: white;
    border-radius: 15px;
    padding: 20px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.watcher-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 35px rgba(0,0,0,0.15);
}

/* ------------------------------
   Watcher Header (top line)
   ------------------------------ */
.watcher-header {
    display: table;
    width: 100%;
    margin-bottom: 15px;
    padding-bottom: 15px;
    border-bottom: 2px solid #f0f0f0;
}
.watcher-name {
    display: table-cell;
    vertical-align: middle;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 1.1rem;
    font-weight: 600;
    color: #333;
}
.network-badge {
    display: table-cell;
    vertical-align: middle;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: white;
    text-align: center;
}

/* Network-specific badge colors - FIXED */
.network-ergo { background: #FF5E18; }
.network-ethereum { background: #627EEA; }  /* FIXED: was ethernet */
.network-binance { background: #F3BA2F; }
.network-bitcoin { background: #F7931A; }
.network-cardano { background: #0033AD; }
.network-doge { background: #C2A633; }
.network-unknown { background: #6B7280; }

/* ------------------------------
   Watcher Card Detail Rows
   ------------------------------ */
.status-row-2col {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 1rem;  /* bumped for readability */
}
.status-col { flex: 1; }
.status-col.right {
    text-align: right;
    color: #333;
    font-size: 1rem;
    font-weight: 500;
}

.watcher-card .status-row {
    margin-bottom: 4px;
    font-size: 1rem;  /* bumped from 0.9rem */
}

.watcher-card .status-row:last-of-type { margin-bottom: 10px; }

/* ------------------------------
   Balances Section
   ------------------------------ */

/* Separator line above balances */
.balances-separator {
  border: none;
  border-top: 1px solid #ccc;  /* consistent light grey */
  margin: 10px 0 6px 0;
}

/* Balances row */
.balances-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1rem;
  margin-top: 6px;
}

/* Columns */
.balances-row div {
  flex: 1;
}

.balances-row div:first-child {
  text-align: left;   /* ERG hugs left */
}

.balances-row div:nth-child(2) {
  text-align: center; /* eRSN centered */
}

.balances-row div:last-child {
  text-align: right;  /* RSN hugs right */
}

/* Labels and values */
.status-label { font-weight: 500; color: #666; }
.status-value { font-weight: 600; }

/* ------------------------------
   Status indicators
   ------------------------------ */
.status-indicator { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; }
.status-running { background: #10B981; }
.status-stopped { background: #EF4444; }
.status-unknown { background: #6B7280; }

/* ------------------------------
   Permit Status - UPDATED & CLARIFIED
   ------------------------------ */

/* Inline permit status colors for individual watcher cards */
.permit-sufficient { color: #10B981; font-weight: 600; }  /* Green for sufficient (2+) */
.permit-critical { color: #F59E0B; font-weight: 600; }    /* Orange for critical (1) */
.permit-exhausted { color: #EF4444; font-weight: 600; }   /* Red for exhausted (0) */
.permit-offline { color: #ff1744; font-weight: bold; }   /* Vivid Red for offline (-) */

/* Permit Status Box - UPDATED with clear logic */
.permit-status {
    margin-top: 15px;
    padding: 15px;
    border-radius: 10px;
    font-weight: 500;
}

/* Legacy permit status classes (for compatibility) */
.permit-healthy { background: #ECFDF5; color: #065F46; border-left: 4px solid #10B981; }
.permit-warning { background: #FFFBEB; color: #92400E; border-left: 4px solid #F59E0B; }
.permit-idle { background: #F9FAFB; color: #374151; border-left: 4px solid #6B7280; }
.permit-unknown { background: #F3F4F6; color: #4B5563; border-left: 4px solid #9CA3AF; }
.permit-out-of-permits { background: #1F2937; color: #F3F4F6; border-left: 4px solid #111827; }
.permit-watcher-down { color: #ff1744; font-weight: bold; }

/* ------------------------------
   Balances + Alerts
   ------------------------------ */
.low-balance { color: #EF4444 !important; font-weight: bold !important; }

/* ------------------------------
   Permit Progress Bar
   ------------------------------ */
.progress-bar { width: 100%; height: 6px; background: #E5E7EB; border-radius: 3px; overflow: hidden; margin-top: 8px; }
.progress-fill { height: 100%; transition: width 0.3s ease; }
.progress-healthy { background: #10B981; }   /* Green for sufficient (2+ permits) */
.progress-warning { background: #F59E0B; }    /* Orange for critical (1 permit) */
.progress-critical { background: #EF4444; }  /* Red for exhausted (0 permits) */

/* ------------------------------
   Last Update & Status Messages
   ------------------------------ */
.last-update { text-align: center; color: white; margin-top: 30px; font-size: 0.9rem; }
.loading { text-align: center; color: white; font-size: 1.2rem; margin-top: 50px; }
.error { background: #FEF2F2; color: #991B1B; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #EF4444; }

/* ------------------------------
   Responsive Adjustments
   ------------------------------ */
@media (max-width: 768px) {
    .container { padding: 15px; }
    .header h1 { font-size: 1.5rem; margin-bottom: 10px; text-shadow: 1px 1px 2px rgba(0,0,0,0.2); }
    .watchers-grid { grid-template-columns: 1fr; }
    .summary { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) {
    .summary { grid-template-columns: 1fr; }
    .watcher-header { flex-direction: column; align-items: flex-start; gap: 10px; }
}

/* ------------------------------
   Health Colors (inline labels)
   ------------------------------ */
.health-green { color: #10b981; font-weight: 600; }
.health-orange { color: #f59e0b; font-weight: 600; }
.health-red   { color: #ef4444; font-weight: 600; }
.health-down { color: #ff1744; font-weight: bold; }

/* ------------------------------
   Summary Groups
   ------------------------------ */
.summary-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 20px;
}
.summary-group-label {
    grid-column: span 2;
    font-size: 14px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* ------------------------------
   Last Updated (Header line)
   ------------------------------ */
.last-updated-top {
    text-align: center;
    margin: 10px 0;
    font-size: 1.6rem;
    font-weight: 600;
    color: #fff;
}
.last-updated-top.stale { color: #EF4444; font-weight: 700; }

/* ------------------------------
   Monitor Status Line
   ------------------------------ */
.monitor-status-line {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px 24px;
    margin-bottom: 25px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    font-size: 1.05rem;
    font-weight: 500;
    color: #1F2937;
    transition: transform 0.2s ease;
}

.monitor-status-line:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.12);
}

.status-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    display: inline-block;
    transition: all 0.3s ease;
}

.status-dot.green {
    background: #10B981;
}

.status-dot.orange {
    background: #F59E0B;
}

.status-dot.red {
    background: #EF4444;
/*    box-shadow: 0 0 12px rgba(239, 68, 68, 0.8);*/
/*    animation: pulse-red 2s infinite;*/
}

@keyframes pulse-red {
    0%, 100% { box-shadow: 0 0 12px rgba(239, 68, 68, 0.8); }
    50% { box-shadow: 0 0 20px rgba(239, 68, 68, 1); }
}

.monitor-status-line .separator {
    color: #CBD5E1;
    font-weight: 400;
    margin: 0 6px;
}

.monitor-status-line #timerA,
.monitor-status-line #timerB {
    font-family: 'Monaco', 'Courier New', monospace;
    font-weight: 700;
    font-size: 1.1rem;
    color: #10B981;
    letter-spacing: 0.5px;
}

@media (max-width: 768px) {
    .monitor-status-line {
        font-size: 0.9rem;
        padding: 12px 16px;
        gap: 8px;
    }
    .monitor-status-line #timerA,
    .monitor-status-line #timerB {
        font-size: 0.95rem;
    }
}
.status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
}

.status-dot.green {
    background: #10B981;
}

.status-dot.orange {
    background: #F59E0B;
}

.status-dot.red {
    background: #EF4444;
}

.monitor-status-line .separator {
    color: #94a3b8;
    margin: 0 4px;
}

.monitor-status-line #timerA,
.monitor-status-line #timerB {
    font-family: 'Monaco', 'Courier New', monospace;
    font-weight: 600;
    color: #1F2937;
}

.monitor-status-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 25px;
}

.monitor-status-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.05rem;
  font-weight: 500;
  color: #1F2937;
  min-width: 0;
  transition: transform 0.2s ease;
}

.monitor-status-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.12);
}

@media (max-width: 768px) {
  .monitor-status-group {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .monitor-status-card {
    font-size: 0.95rem;
    padding: 14px 12px;
  }
}

.monitor-status-card .status-dot {
  margin-right: 10px;
}

/* Summary count styling for WATCHERS (numerator colored, slash/denominator dark) */
.summary-card h3 .count-num { font-weight: 800; }         /* weight for all numerators */
.summary-card h3 .count-div,
.summary-card h3 .count-den { color: #1F2937; font-weight: 800; } /* dark grey, bold */

/* Numerator color depends on the row */
.summary-card.healthy  h3 .count-num { color: #10B981; }  /* green */
.summary-card.unstable h3 .count-num { color: #F59E0B; }  /* orange */
.summary-card.broken   h3 .count-num { color: #EF4444; }  /* red */

/* ------------------------------
   Enhanced Login Styles
   ------------------------------ */
.login {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #0c1419 0%, #1a2832 100%);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
}

.login-container {
  background: rgba(18, 24, 27, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 3rem;
  width: 100%;
  max-width: 420px;
  backdrop-filter: blur(20px);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05);
  position: relative;
  overflow: hidden;
}

.login-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #4ade80, transparent);
  opacity: 0.6;
}

.login-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.lock-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 1.5rem;
  background: linear-gradient(135deg, #4ade80, #22c55e);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(74, 222, 128, 0.25);
}

.lock-icon svg {
  width: 24px;
  height: 24px;
  color: #0c1419;
}

.login-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #f8fafc;
  margin-bottom: 0.5rem;
}

.login-subtitle {
  color: #94a3b8;
  font-size: 0.9rem;
  line-height: 1.5;
}

.form-group {
  margin-bottom: 1.5rem;
  position: relative;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  color: #e2e8f0;
  font-weight: 500;
  font-size: 0.9rem;
}

.password-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.form-input {
  width: 100%;
  padding: 0.875rem 3rem 0.875rem 1rem;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #f8fafc;
  font-size: 1rem;
  transition: all 0.2s ease;
  outline: none;
}

.form-input::placeholder {
  color: #64748b;
}

.form-input:focus {
  border-color: #4ade80;
  box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.1);
  background: rgba(30, 41, 59, 0.9);
}

.password-toggle {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: color 0.2s ease;
}

.password-toggle:hover {
  color: #94a3b8;
}

.password-toggle svg {
  width: 20px;
  height: 20px;
}

.checkbox-group {
  margin-bottom: 1.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  color: #e2e8f0;
  font-size: 0.9rem;
}

.checkbox-input {
  opacity: 0;
  position: absolute;
}

.checkbox-custom {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  margin-right: 0.75rem;
  position: relative;
  transition: all 0.2s ease;
}

.checkbox-input:checked + .checkbox-custom {
  background: #4ade80;
  border-color: #4ade80;
}

.checkbox-input:checked + .checkbox-custom::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #0c1419;
  font-size: 12px;
  font-weight: bold;
}

.submit-button {
  width: 100%;
  padding: 0.875rem;
  background: linear-gradient(135deg, #4ade80, #22c55e);
  border: none;
  border-radius: 8px;
  color: #0c1419;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.submit-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 25px rgba(74, 222, 128, 0.35);
}

.submit-button:active {
  transform: translateY(0);
}

.submit-button.loading {
  color: transparent;
}

.submit-button .spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  border: 2px solid rgba(12, 20, 25, 0.3);
  border-top: 2px solid #0c1419;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  display: none;
}

.submit-button.loading .spinner {
  display: block;
}

@keyframes spin {
  0% { transform: translate(-50%, -50%) rotate(0deg); }
  100% { transform: translate(-50%, -50%) rotate(360deg); }
}

.error-message {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  padding: 0.75rem;
  margin-top: 1rem;
  color: #fca5a5;
  font-size: 0.875rem;
  display: none;
}

.error-message.show {
  display: block;
  animation: slideIn 0.3s ease;
}

.error-message:not(:empty) {
  display: block;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.security-note {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  text-align: center;
}

.security-icon {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #4ade80;
  font-size: 0.8rem;
  font-weight: 500;
}

@media (max-width: 480px) {
  .login-container {
    margin: 1rem;
    padding: 2rem;
  }
}
`;
