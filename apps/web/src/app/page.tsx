"use client";

import React, { useState, useEffect } from "react";

// Types
interface Prediction {
  predictionId: string;
  targetType: string;
  targetId: string;
  value: number;
  generatedAt: string;
  targetDate: string;
  xaiExplanation: string;
}

interface Intervention {
  interventionId: string;
  title: string;
  urgency: string;
  status: string;
  targetFacilityId: string;
  sourceFacilityId?: string;
  payload: any;
  simulationImpact: string;
  assignedApprover: string;
}

export default function CommandCenter() {
  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState<"radar" | "simulator" | "scribe" | "alerts">("radar");
  const [selectedDistrict, setSelectedDistrict] = useState("Pune");
  const [selectedDay, setSelectedDay] = useState(1);
  const [activePredictions, setActivePredictions] = useState<Prediction[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);

  // Map & Selected Clinic State
  const [selectedClinic, setSelectedClinic] = useState<string | null>("shirur-phc-001");

  // Simulation parameters
  const [simTargetFacility, setSimTargetFacility] = useState("shirur-phc-001");
  const [simResourceType, setSimResourceType] = useState("medicine");
  const [simQuantity, setSimQuantity] = useState(500);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Scribe parameters
  const [isRecording, setIsRecording] = useState(false);
  const [scribeLanguage, setScribeLanguage] = useState("hi");
  const [scribeResult, setScribeResult] = useState<any | null>(null);
  const [customClinicalNote, setCustomClinicalNote] = useState("");

  // Static Mock Data for GIS map coordinates & clinics
  const clinics = [
    { id: "shirur-phc-001", name: "Shirur PHC", type: "PHC", x: 220, y: 150, statusDay1: "critical", statusDay14: "critical", doctors: 2, nurses: 4, amoxicillin: 80 },
    { id: "khed-chc-002", name: "Khed CHC", type: "CHC", x: 80, y: 130, statusDay1: "normal", statusDay14: "warning", doctors: 6, nurses: 12, amoxicillin: 1500 },
    { id: "junnar-chc-003", name: "Junnar CHC", type: "CHC", x: 120, y: 50, statusDay1: "normal", statusDay14: "normal", doctors: 5, nurses: 10, amoxicillin: 2200 },
    { id: "ambegaon-phc-004", name: "Ambegaon PHC", type: "PHC", x: 180, y: 90, statusDay1: "warning", statusDay14: "normal", doctors: 2, nurses: 3, amoxicillin: 110 },
    { id: "manchar-chc-005", name: "Manchar CHC", type: "CHC", x: 150, y: 190, statusDay1: "normal", statusDay14: "warning", doctors: 4, nurses: 8, amoxicillin: 850 }
  ];

  // Mock initial fetch
  useEffect(() => {
    // Standard mock predictions matching the model main backend outputs
    const predictionsData: Prediction[] = [
      {
        predictionId: "pred-001",
        targetType: "MEDICINE_STOCKOUT",
        targetId: "shirur-phc-001",
        value: 0.88,
        generatedAt: "2026-07-07T18:00:00Z",
        targetDate: "2026-07-16T18:00:00Z",
        xaiExplanation: "Predicted stockout of Amoxicillin 500mg within 9 days. Driven by a 42% spike in childhood respiratory diagnoses in Khed-Shirur sub-districts and a current inventory runway of only 4 days."
      },
      {
        predictionId: "pred-002",
        targetType: "PATIENT_SURGE",
        targetId: "khed-chc-002",
        value: 0.74,
        generatedAt: "2026-07-07T18:00:00Z",
        targetDate: "2026-07-09T18:00:00Z",
        xaiExplanation: "Predicted surge (+35% patient footfall) expected in the outpatient department. Strongly correlated with localized viral fever patterns detected in private pharmacy antipyretic sales data and seasonal monsoon humidity spikes."
      },
      {
        predictionId: "pred-003",
        targetType: "STAFF_BURNOUT",
        targetId: "khed-chc-002",
        value: 0.65,
        generatedAt: "2026-07-07T16:00:00Z",
        targetDate: "2026-07-12T16:00:00Z",
        xaiExplanation: "High burn-out probability flagged for clinical nursing staff. Clinical nurse-to-patient ratio has exceeded 1:35 for 5 consecutive days due to unmanaged seasonal surge patterns."
      },
      {
        predictionId: "pred-004",
        targetType: "VULNERABLE_DROPOUT",
        targetId: "pregnant-cohort-03",
        value: 0.81,
        generatedAt: "2026-07-07T19:00:00Z",
        targetDate: "2026-07-14T19:00:00Z",
        xaiExplanation: "A cohort of 14 high-risk pregnant women in Shirur sub-district are predicted to drop out of their 3rd antenatal check (ANC). Main indicators: agricultural harvesting peak limits scheduling, and average transit distance exceeds 6.2km with no transit support."
      }
    ];
    
    const interventionsData: Intervention[] = [
      {
        interventionId: "int-101",
        title: "Redistribute 500 units of Amoxicillin from Junnar CHC to Shirur PHC",
        urgency: "CRITICAL",
        status: "PENDING",
        targetFacilityId: "shirur-phc-001",
        sourceFacilityId: "junnar-chc-003",
        payload: { medicineId: "med-0045", quantity: 500 },
        simulationImpact: "Reduces Amoxicillin stockout risk at Shirur PHC from 88% to 4%, while retaining a secure 32-day stock buffer at Junnar CHC.",
        assignedApprover: "District Health Officer (DHO) Pune"
      }
    ];

    setActivePredictions(predictionsData);
    setInterventions(interventionsData);
    setSelectedPrediction(predictionsData[0]); // Select first by default
  }, []);

  // Run Simulation Handler
  const handleRunSimulation = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);
    
    // Simulate API delay
    setTimeout(() => {
      const waitReduction = simResourceType === "staff" ? 25 : 12;
      const feasibility = simQuantity > 1000 ? 5.8 : 8.9;
      
      setSimulationResult({
        simulatedScenario: `Allocate ${simQuantity} ${simResourceType === "medicine" ? "units" : "hours"} to ${clinics.find(c => c.id === simTargetFacility)?.name}`,
        impactMetrics: {
          wait_time_reduction_pct: waitReduction,
          burnout_risk_shift_pct: simResourceType === "staff" ? -14.5 : -2.0,
          system_level_stability_gain_pct: simResourceType === "medicine" ? 31.0 : 18.0
        },
        operationalFeasibilityScore: feasibility,
        riskLevel: feasibility > 7.0 ? "LOW" : "MEDIUM"
      });
      setIsSimulating(false);
    }, 1200);
  };

  // Run Interventions Approval Handler
  const approveIntervention = (id: string) => {
    setInterventions(prev => 
      prev.map(int => int.interventionId === id ? { ...int, status: "EXECUTED" } : int)
    );
  };

  // Mock Recording & Scribe Transcribe Handler
  const handleScribeAction = () => {
    if (isRecording) {
      // Stop recording and process
      setIsRecording(false);
      
      // Simulate Gemini transcribe & structure output
      setScribeResult({
        transcription: customClinicalNote || (scribeLanguage === "hi" 
          ? "मरीज को तीन दिनों से तेज बुखार है और लगातार सूखी खांसी आ रही है। सांस फूलने की समस्या भी है।" 
          : "रुग्णाला तीन दिवसांपासून तीव्र ताप आहे आणि खोकला आहे. श्वास घेण्यास त्रास होत आहे."),
        translation: "Patient has high fever for three days, dry cough, and breathing difficulty.",
        structuredFHIR: {
          "resourceType": "Encounter",
          "status": "finished",
          "class": { "code": "AMB", "display": "ambulatory" },
          "reasonCode": [
            { "coding": [{ "system": "http://snomed.info/sct", "code": "386661006", "display": "Fever (symptom)" }] },
            { "coding": [{ "system": "http://snomed.info/sct", "code": "49727002", "display": "Cough (symptom)" }] }
          ]
        },
        analyticsExtract: {
          symptomsDetected: ["fever", "dry cough", "dyspnea"],
          severityRisk: "MEDIUM",
          suggestedOutbreakSignal: "ILI (Influenza-Like Illness)"
        }
      });
    } else {
      setIsRecording(true);
      setScribeResult(null);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === "critical") return "var(--critical)";
    if (status === "warning") return "var(--warning)";
    return "var(--success)";
  };

  const selectedClinicData = clinics.find(c => c.id === selectedClinic);

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="app-header">
        <div className="header-logo">
          <img src="/logo_light.svg" alt="GroundTruth AI Logo" />
        </div>
        <div className="header-meta">
          <select 
            value={selectedDistrict} 
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="district-selector"
          >
            <option value="Pune">Pune District Command</option>
            <option value="Satara">Satara District Command</option>
            <option value="Thane">Thane District Command</option>
          </select>
          <div className="user-badge">
            <span className="user-role-dot"></span>
            <span>DHO Office (Pune)</span>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="workspace-body">
        {/* Navigation Sidebar */}
        <aside className="nav-sidebar">
          <div className="nav-links">
            <button 
              onClick={() => setActiveTab("radar")}
              className={`nav-item ${activeTab === "radar" ? "active" : ""}`}
            >
              <span>🧭</span>
              District Risk Radar
            </button>
            <button 
              onClick={() => setActiveTab("simulator")}
              className={`nav-item ${activeTab === "simulator" ? "active" : ""}`}
            >
              <span>🔄</span>
              What-If Simulator
            </button>
            <button 
              onClick={() => setActiveTab("scribe")}
              className={`nav-item ${activeTab === "scribe" ? "active" : ""}`}
            >
              <span>🎙️</span>
              Clinical Scribe (AI)
            </button>
            <button 
              onClick={() => setActiveTab("alerts")}
              className={`nav-item ${activeTab === "alerts" ? "active" : ""}`}
            >
              <span>⚠️</span>
              Active Interventions
            </button>
          </div>
          <div className="sidebar-footer">
            <p>GroundTruth AI v1.0.0</p>
            <p style={{ marginTop: "4px", fontSize: "0.75rem", opacity: 0.7 }}>Google Cloud Build with AI</p>
          </div>
        </aside>

        {/* Main Workspace Viewport */}
        <main className="main-viewport">
          {/* Active Tab Screen Layouts */}
          
          {/* TAB 1: RISK RADAR SCREEN */}
          {activeTab === "radar" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
                <div>
                  <div className="card-surface" style={{ marginBottom: "24px" }}>
                    <div className="card-title">
                      <span>Spatial Health Risk Map (GIS Interface)</span>
                      <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                        Viewing: Day {selectedDay} Forecast
                      </span>
                    </div>
                    {/* SVG Map Graphic */}
                    <div className="map-canvas">
                      <svg width="100%" height="100%" viewBox="0 0 350 250" style={{ background: "#F1EEE8" }}>
                        {/* District Boundaries Lines */}
                        <path d="M 20 40 L 150 20 L 330 60 L 300 200 L 140 230 L 30 180 Z" fill="#F8F6F1" stroke="var(--border)" strokeWidth="2" strokeDasharray="4 4" />
                        <path d="M 150 20 L 140 230" fill="none" stroke="var(--border)" strokeWidth="1" />
                        <path d="M 20 40 L 300 200" fill="none" stroke="var(--border)" strokeWidth="1" />
                        
                        {/* Clinic Nodes */}
                        {clinics.map((clinic) => {
                          const status = selectedDay === 1 ? clinic.statusDay1 : clinic.statusDay14;
                          return (
                            <g 
                              key={clinic.id} 
                              transform={`translate(${clinic.x}, ${clinic.y})`}
                              style={{ cursor: "pointer" }}
                              onClick={() => setSelectedClinic(clinic.id)}
                            >
                              <circle 
                                r="12" 
                                fill={getStatusColor(status)} 
                                stroke="#ffffff" 
                                strokeWidth="3" 
                                style={{ filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.1))" }}
                              />
                              {selectedClinic === clinic.id && (
                                <circle r="18" fill="none" stroke={getStatusColor(status)} strokeWidth="2" strokeDasharray="3 3" />
                              )}
                              <text y="-18" textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--text-primary)" fontFamily="var(--font-family-sans)">
                                {clinic.name}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>

                  {/* 14-Day Timeline Bar */}
                  <div className="timeline-bar">
                    <div style={{ marginBottom: "12px", fontSize: "0.85rem", fontWeight: 700, color: "var(--primary)" }}>
                      14-Day Proactive Operational Forecasting Timeline
                    </div>
                    <div className="timeline-days">
                      {Array.from({ length: 14 }, (_, i) => i + 1).map((day) => {
                        const isSelected = selectedDay === day;
                        // Let's add mock statuses for days
                        let status = "normal";
                        if (day >= 9) status = "critical"; // Amoxicillin stockout occurs
                        else if (day >= 5) status = "warning";

                        return (
                          <div 
                            key={day} 
                            onClick={() => setSelectedDay(day)}
                            className={`timeline-day ${isSelected ? "selected" : ""}`}
                          >
                            <span className="timeline-date-label">Jul {7 + day}</span>
                            <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>D{day}</span>
                            <span className={`timeline-status-dot ${status}`}></span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Clinic Metadata Inspector */}
                <div className="card-surface" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <h3 style={{ color: "var(--primary)", marginBottom: "6px" }}>Facility Inspector</h3>
                    {selectedClinicData ? (
                      <>
                        <div style={{ fontSize: "1.3rem", fontWeight: 700, margin: "12px 0 6px 0" }}>{selectedClinicData.name}</div>
                        <div style={{ display: "inline-block", background: getStatusColor(selectedDay === 1 ? selectedClinicData.statusDay1 : selectedClinicData.statusDay14), color: "white", padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700, marginBottom: "20px" }}>
                          {selectedDay === 1 ? selectedClinicData.statusDay1.toUpperCase() : selectedClinicData.statusDay14.toUpperCase()} STATUS (DAY {selectedDay})
                        </div>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Facility Tier</div>
                            <div style={{ fontWeight: 700 }}>{selectedClinicData.type === "CHC" ? "Community Health Centre" : "Primary Health Centre"}</div>
                          </div>
                          <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Medical Staffing</div>
                            <div style={{ fontWeight: 700 }}>{selectedClinicData.doctors} Doctors | {selectedClinicData.nurses} Nurses</div>
                          </div>
                          <div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Amoxicillin 500mg Level</div>
                            <div style={{ fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
                              <span>{selectedDay >= 9 ? 0 : selectedClinicData.amoxicillin} units</span>
                              <span style={{ color: selectedDay >= 9 ? "var(--critical)" : "var(--success)" }}>
                                {selectedDay >= 9 ? "(Stockout!)" : "(Stable Runway)"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Select a facility pin on the GIS radar map to inspect real-time metrics.</p>
                    )}
                  </div>
                  
                  {selectedClinicData && selectedDay >= 9 && selectedClinicData.id === "shirur-phc-001" && (
                    <div style={{ background: "rgba(162, 75, 54, 0.08)", border: "1px solid var(--critical)", borderRadius: "8px", padding: "12px", marginTop: "20px" }}>
                      <div style={{ fontWeight: 700, color: "var(--critical)", fontSize: "0.85rem", marginBottom: "4px" }}>Proactive Stockout Alert</div>
                      <p style={{ fontSize: "0.8rem", color: "var(--text-primary)" }}>AI forecasts an absolute stockout in 9 days due to a pediatric respiratory spike. Click the <strong>What-If Simulator</strong> tab to model reallocations.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: WHAT-IF SIMULATOR SCREEN */}
          {activeTab === "simulator" && (
            <>
              <div className="split-viewport">
                {/* Left Panel - Simulation Control parameters */}
                <div className="card-surface">
                  <div className="card-title">Intervention Simulator & Policy Planner</div>
                  <form onSubmit={handleRunSimulation}>
                    <div className="sim-input-group">
                      <label>Target Facility (Recipient)</label>
                      <select 
                        value={simTargetFacility} 
                        onChange={(e) => setSimTargetFacility(e.target.value)}
                        className="sim-input-field"
                      >
                        <option value="shirur-phc-001">Shirur PHC (Amoxicillin Stockout Risk)</option>
                        <option value="khed-chc-002">Khed CHC (Surge Risk)</option>
                        <option value="manchar-chc-005">Manchar CHC (Overloaded Staff)</option>
                      </select>
                    </div>
                    
                    <div className="sim-input-group">
                      <label>Resource Relocation Type</label>
                      <select 
                        value={simResourceType} 
                        onChange={(e) => setSimResourceType(e.target.value)}
                        className="sim-input-field"
                      >
                        <option value="medicine">Medicine stock (Amoxicillin 500mg)</option>
                        <option value="staff">Medical Staff Shifts (Nurse hours)</option>
                      </select>
                    </div>

                    <div className="sim-input-group">
                      <label>Quantity / Unit Volume</label>
                      <input 
                        type="number" 
                        value={simQuantity} 
                        onChange={(e) => setSimQuantity(Number(e.target.value))}
                        className="sim-input-field" 
                        min="50" 
                        max="5000"
                      />
                    </div>

                    <button 
                      type="submit" 
                      className="btn-pill" 
                      style={{ width: "100%", marginTop: "12px", height: "45px" }}
                      disabled={isSimulating}
                    >
                      {isSimulating ? "Running Agent Simulations..." : "Simulate Operational Impact"}
                    </button>
                  </form>
                </div>

                {/* Right Panel - Simulator Outputs */}
                <div className="card-surface" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div className="card-title">Projected Outcome & Feasibility</div>
                    
                    {simulationResult ? (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                          <div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Operational Feasibility</div>
                            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--primary)" }}>{simulationResult.operationalFeasibilityScore}/10</div>
                          </div>
                          <div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Simulated Risk Level</div>
                            <div style={{ display: "inline-block", background: simulationResult.riskLevel === "LOW" ? "var(--success)" : "var(--warning)", color: "white", padding: "4px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700 }}>
                              {simulationResult.riskLevel} RISK
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "white", padding: "16px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Outpatient Wait Times</span>
                            <span style={{ fontWeight: 700, color: "var(--success)" }}>-{simulationResult.impactMetrics.wait_time_reduction_pct}%</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Staff Burnout Probability</span>
                            <span style={{ fontWeight: 700, color: "var(--success)" }}>{simulationResult.impactMetrics.burnout_risk_shift_pct}%</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>System Resilience Stability</span>
                            <span style={{ fontWeight: 700, color: "var(--success)" }}>+{simulationResult.impactMetrics.system_level_stability_gain_pct}%</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>Adjust parameters on the left and trigger simulation to preview dynamic outcomes before implementing changes.</p>
                    )}
                  </div>

                  {simulationResult && (
                    <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                      <button 
                        onClick={() => {
                          const newInt: Intervention = {
                            interventionId: `int-sim-${Date.now()}`,
                            title: `Simulated: Send ${simQuantity} ${simResourceType === "medicine" ? "Amoxicillin units" : "Nurse hours"} to ${clinics.find(c => c.id === simTargetFacility)?.name}`,
                            urgency: "HIGH",
                            status: "PENDING",
                            targetFacilityId: simTargetFacility,
                            payload: { quantity: simQuantity },
                            simulationImpact: `Feasibility Score: ${simulationResult.operationalFeasibilityScore}/10`,
                            assignedApprover: "District Health Officer"
                          };
                          setInterventions(prev => [newInt, ...prev]);
                          setActiveTab("alerts");
                        }} 
                        className="btn-pill" 
                        style={{ flex: 1 }}
                      >
                        Queue Intervention Proposal
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 3: CLINICAL SCRIBE SCREEN */}
          {activeTab === "scribe" && (
            <>
              <div className="split-viewport">
                {/* Left Scriptor Recorder */}
                <div className="card-surface">
                  <div className="card-title">Speech-to-Insights Clinical Scribe</div>
                  
                  <div className="recorder-box">
                    <button 
                      onClick={handleScribeAction} 
                      className={`record-btn ${isRecording ? "recording" : ""}`}
                    >
                      {isRecording ? "⏹️" : "🎤"}
                    </button>
                    
                    <h3 style={{ marginBottom: "8px" }}>
                      {isRecording ? "Recording Medical Consultation Note..." : "Click Mic to Begin Audio Transcription"}
                    </h3>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "20px" }}>
                      Doctors speak in regional languages (Hindi/Marathi/English) during consultation. The AI transcribes, translates, and structures FHIR records.
                    </p>

                    <div className="sim-input-group" style={{ width: "100%", textAlign: "left" }}>
                      <label>Audio Language Input</label>
                      <select 
                        value={scribeLanguage} 
                        onChange={(e) => setScribeLanguage(e.target.value)} 
                        className="sim-input-field"
                      >
                        <option value="hi">Hindi (हिन्दी)</option>
                        <option value="mr">Marathi (मराठी)</option>
                        <option value="en">English (India)</option>
                      </select>
                    </div>

                    <div className="sim-input-group" style={{ width: "100%", textAlign: "left" }}>
                      <label>Custom Consult Mock Text (Optional)</label>
                      <textarea 
                        value={customClinicalNote} 
                        onChange={(e) => setCustomClinicalNote(e.target.value)} 
                        placeholder="Or write/paste custom clinical audio consultation transcript here..."
                        className="sim-input-field"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Structurer FHIR Outputs */}
                <div className="card-surface">
                  <div className="card-title">AI Extraction Result</div>
                  
                  {scribeResult ? (
                    <div style={{ display: "flex", flexGrow: 1, flexDirection: "column", gap: "16px" }}>
                      <div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700 }}>Transcribed Consultation</div>
                        <div style={{ fontSize: "0.95rem", background: "white", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)", marginTop: "4px" }}>
                          "{scribeResult.transcription}"
                        </div>
                      </div>
                      
                      <div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700 }}>English Translation</div>
                        <div style={{ fontSize: "0.95rem", background: "white", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)", marginTop: "4px", fontStyle: "italic" }}>
                          "{scribeResult.translation}"
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div style={{ background: "rgba(0, 168, 120, 0.08)", padding: "12px", borderRadius: "8px", border: "1px solid var(--secondary)" }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--secondary)", fontWeight: 700 }}>DISEASE SIGNALS</span>
                          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{scribeResult.analyticsExtract.suggestedOutbreakSignal}</div>
                        </div>
                        <div style={{ background: "rgba(199, 119, 47, 0.08)", padding: "12px", borderRadius: "8px", border: "1px solid var(--accent)" }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 700 }}>OUTBREAK SEVERITY</span>
                          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{scribeResult.analyticsExtract.severityRisk}</div>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "4px" }}>Structured HL7 FHIR Model (JSON)</div>
                        <pre className="fhir-codeblock">
                          {JSON.stringify(scribeResult.structuredFHIR, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>Record a mock consultation or write consult notes on the left to review structured FHIR output.</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 4: ACTIVE INTERVENTIONS SCREEN */}
          {activeTab === "alerts" && (
            <>
              <div className="card-surface">
                <div className="card-title">District Interventions Queue</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {interventions.map((int) => (
                    <div 
                      key={int.interventionId} 
                      style={{ 
                        background: "white", 
                        border: "1px solid var(--border)", 
                        borderRadius: "10px", 
                        padding: "20px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                          <span style={{ background: int.urgency === "CRITICAL" ? "var(--critical)" : "var(--warning)", color: "white", fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: "20px" }}>
                            {int.urgency}
                          </span>
                          <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>ID: {int.interventionId}</span>
                        </div>
                        <h4 style={{ color: "var(--primary)", fontSize: "1.1rem", marginBottom: "6px" }}>{int.title}</h4>
                        <p style={{ fontSize: "0.88rem", color: "var(--success)", fontWeight: 600 }}>{int.simulationImpact}</p>
                      </div>
                      
                      <div>
                        {int.status === "PENDING" ? (
                          <button 
                            onClick={() => approveIntervention(int.interventionId)}
                            className="btn-pill" 
                            style={{ background: "var(--secondary)" }}
                          >
                            Approve & Dispatch
                          </button>
                        ) : (
                          <span style={{ color: "var(--success)", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                            ✓ Dispatched
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </main>

        {/* Right Sidebar - Proactive AI Risk Stream */}
        <aside className="prediction-sidebar">
          <div className="sidebar-title">
            <h3>Proactive Risk Feed</h3>
            <span className="alert-count-badge">{activePredictions.length} Alerts</span>
          </div>
          
          <div className="prediction-list">
            {activePredictions.map((pred) => (
              <div 
                key={pred.predictionId} 
                onClick={() => setSelectedPrediction(pred)}
                className={`alert-card ${pred.value >= 0.8 ? "critical" : "warning"} ${selectedPrediction?.predictionId === pred.predictionId ? "selected-card" : ""}`}
                style={{ 
                  backgroundColor: selectedPrediction?.predictionId === pred.predictionId ? "var(--surface)" : "#ffffff",
                  border: selectedPrediction?.predictionId === pred.predictionId ? "1px solid var(--border)" : "none" 
                }}
              >
                <div className="alert-header">
                  <span style={{ color: pred.value >= 0.8 ? "var(--critical)" : "var(--warning)" }}>
                    {pred.targetType.replace("_", " ")}
                  </span>
                  <span>{Math.round(pred.value * 100)}% Risk</span>
                </div>
                <div className="alert-body">
                  {pred.targetId === "shirur-phc-001" ? "Shirur PHC" : pred.targetId === "khed-chc-002" ? "Khed CHC" : "Vulnerable Maternal Cohort"}
                </div>
                <div className="alert-meta">
                  Est. Target: {new Date(pred.targetDate).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
          
          {/* Selected Prediction Explanation Panel */}
          {selectedPrediction && (
            <div style={{ padding: "20px", borderTop: "1px solid var(--border)", background: "#ffffff" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "6px" }}>Explainable AI (XAI) Insight</div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-primary)", lineHeight: "1.4" }}>
                {selectedPrediction.xaiExplanation}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
