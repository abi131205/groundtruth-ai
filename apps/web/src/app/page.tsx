"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { 
  Compass, 
  Activity, 
  Mic, 
  Square, 
  Check, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  Sparkles, 
  ShieldAlert,
  ChevronRight,
  Database,
  RefreshCw,
  Send
} from "lucide-react";

// Dynamically import Leaflet MapComponent to avoid Next.js SSR document undefined errors
const MapComponent = dynamic(() => import("./MapComponent"), { ssr: false });

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";

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
  const [isOffline, setIsOffline] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);

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
  const [isProcessingText, setIsProcessingText] = useState(false);
  const [recordedMimeType, setRecordedMimeType] = useState("audio/webm");

  // Microphone audio chunks refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Static Mock Data (GIS map coordinates & clinics fallback + dynamic coordinates)
  const clinics = [
    { id: "shirur-phc-001", name: "Shirur PHC", type: "PHC", lat: 18.8286, lon: 74.3789, statusDay1: "critical", statusDay14: "critical", doctors: 2, nurses: 4, amoxicillin: 80 },
    { id: "khed-chc-002", name: "Khed CHC", type: "CHC", lat: 18.8624, lon: 73.8864, statusDay1: "normal", statusDay14: "warning", doctors: 6, nurses: 12, amoxicillin: 1500 },
    { id: "junnar-chc-003", name: "Junnar CHC", type: "CHC", lat: 19.2104, lon: 73.8763, statusDay1: "normal", statusDay14: "normal", doctors: 5, nurses: 10, amoxicillin: 2200 },
    { id: "ambegaon-phc-004", name: "Ambegaon PHC", type: "PHC", lat: 19.0125, lon: 73.9124, statusDay1: "warning", statusDay14: "normal", doctors: 2, nurses: 3, amoxicillin: 110 },
    { id: "manchar-chc-005", name: "Manchar CHC", type: "CHC", lat: 19.0084, lon: 74.0125, statusDay1: "normal", statusDay14: "warning", doctors: 4, nurses: 8, amoxicillin: 850 }
  ];

  const getAuthHeaders = () => ({
    "Content-Type": "application/json",
    "Authorization": "Bearer mock-admin-token"
  });

  // Fetch initial predictions and interventions
  const fetchData = async () => {
    setIsConnecting(true);
    try {
      const predsRes = await fetch(`${API_BASE_URL}/api/v1/predictions?district_id=${selectedDistrict}`, {
        headers: getAuthHeaders()
      });
      const intsRes = await fetch(`${API_BASE_URL}/api/v1/interventions`, {
        headers: getAuthHeaders()
      });

      if (!predsRes.ok || !intsRes.ok) {
        throw new Error("Backend response error");
      }

      const predsData = await predsRes.json();
      const intsData = await intsRes.json();

      setActivePredictions(predsData);
      setInterventions(intsData);
      
      if (predsData.length > 0) {
        setSelectedPrediction(predsData[0]);
      }
      setIsOffline(false);
    } catch (err) {
      console.warn("FastAPI backend unreachable. Using offline mock fallback.", err);
      setIsOffline(true);
      
      // Load static mock data as fallback
      const predictionsDataMock: Prediction[] = [
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
      
      const interventionsDataMock: Intervention[] = [
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

      setActivePredictions(predictionsDataMock);
      setInterventions(interventionsDataMock);
      setSelectedPrediction(predictionsDataMock[0]);
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDistrict]);

  // Run Simulation Handler
  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);

    if (isOffline) {
      // Simulate API delay locally
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
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/simulation`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          targetFacilityId: simTargetFacility,
          resourceType: simResourceType,
          quantity: simQuantity
        })
      });
      if (!res.ok) throw new Error("Simulation failed");
      const data = await res.json();
      setSimulationResult(data);
    } catch (err) {
      console.error("Simulation request error", err);
      setIsOffline(true);
    } finally {
      setIsSimulating(false);
    }
  };

  // Run Interventions Approval Handler
  const approveIntervention = async (id: string) => {
    // If offline, just update locally
    if (isOffline) {
      setInterventions(prev => 
        prev.map(int => int.interventionId === id ? { ...int, status: "EXECUTED" } : int)
      );
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/interventions/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: "EXECUTED" })
      });
      if (res.ok) {
        setInterventions(prev => 
          prev.map(int => int.interventionId === id ? { ...int, status: "EXECUTED" } : int)
        );
      } else {
        // Fallback update on mismatch
        setInterventions(prev => 
          prev.map(int => int.interventionId === id ? { ...int, status: "EXECUTED" } : int)
        );
      }
    } catch (err) {
      console.error("Approval sync failed. Updating locally.", err);
      setInterventions(prev => 
        prev.map(int => int.interventionId === id ? { ...int, status: "EXECUTED" } : int)
      );
    }
  };

  // Scribe live voice recorder controls
  const handleStartRecording = async () => {
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let options = {};
      let mimeType = "audio/webm";
      
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm")) {
          options = { mimeType: "audio/webm" };
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          options = { mimeType: "audio/ogg" };
          mimeType = "audio/ogg";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          options = { mimeType: "audio/mp4" };
          mimeType = "audio/mp4";
        }
      }
      
      setRecordedMimeType(mimeType);

      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setIsProcessingText(true);

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Data = reader.result as string;
          // Extract only the base64 content
          const audioBase64 = base64Data.split(",")[1];
          await processClinicalAudio(audioBase64, mimeType);
        };

        // Stop all track devices to release microphone access
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setScribeResult(null);
    } catch (err) {
      console.error("Failed to start voice recorder", err);
      alert("Microphone connection failed. Please ensure mic permission is granted.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processClinicalAudio = async (audioBase64: string, mimeTypeOverride?: string) => {
    const currentMimeType = mimeTypeOverride || recordedMimeType;
    if (isOffline) {
      // Local mock scribe processing
      setTimeout(() => {
        setScribeResult({
          transcription: scribeLanguage === "hi" 
            ? "मरीज को तीन दिनों से तेज बुखार है और लगातार सूखी खांसी आ रही है। सांस फूलने की समस्या भी है।" 
            : "रुग्णाला तीन दिवसांपासून तीव्र ताप आहे आणि खोकला आहे. श्वास घेण्यास त्रास होत आहे.",
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
        setIsProcessingText(false);
      }, 1200);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/scribe/transcribe`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          audioBase64,
          audioMimeType: currentMimeType,
          languageCode: scribeLanguage,
          facilityId: selectedClinic || "shirur-phc-001"
        })
      });

      if (!res.ok) throw new Error("Transcription server error");
      const data = await res.json();
      setScribeResult(data);
    } catch (err) {
      console.error("Transcription server request failed", err);
      alert("Transcription request failed. Falling back to offline simulator.");
      setIsOffline(true);
    } finally {
      setIsProcessingText(false);
    }
  };

  // Handle typing-based text processing
  const handleProcessText = async () => {
    if (!customClinicalNote.trim()) return;
    setIsProcessingText(true);

    if (isOffline) {
      setTimeout(() => {
        setScribeResult({
          transcription: customClinicalNote,
          translation: customClinicalNote,
          structuredFHIR: {
            "resourceType": "Encounter",
            "status": "finished",
            "class": { "code": "AMB", "display": "ambulatory" },
            "reasonCode": [
              { "coding": [{ "system": "http://snomed.info/sct", "code": "386661006", "display": "Fever" }] }
            ]
          },
          analyticsExtract: {
            symptomsDetected: ["fever"],
            severityRisk: "LOW",
            suggestedOutbreakSignal: "Local Consultation"
          }
        });
        setIsProcessingText(false);
      }, 1000);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/scribe/transcribe`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          textPrompt: customClinicalNote,
          languageCode: scribeLanguage,
          facilityId: selectedClinic || "shirur-phc-001"
        })
      });

      if (!res.ok) throw new Error("Text processing request failed");
      const data = await res.json();
      setScribeResult(data);
    } catch (err) {
      console.error("Failed to process text prompt", err);
    } finally {
      setIsProcessingText(false);
    }
  };

  const handleQueueIntervention = async () => {
    if (!simulationResult) return;
    const title = `Simulated: Send ${simQuantity} ${simResourceType === "medicine" ? "Amoxicillin units" : "Nurse hours"} to ${clinics.find(c => c.id === simTargetFacility)?.name}`;

    if (isOffline) {
      const newInt: Intervention = {
        interventionId: `int-sim-${Date.now()}`,
        title,
        urgency: "HIGH",
        status: "PENDING",
        targetFacilityId: simTargetFacility,
        payload: { quantity: simQuantity },
        simulationImpact: `Feasibility Score: ${simulationResult.operationalFeasibilityScore}/10`,
        assignedApprover: "District Health Officer"
      };
      setInterventions(prev => [newInt, ...prev]);
      setActiveTab("alerts");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/interventions`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title,
          urgency: "HIGH",
          targetFacilityId: simTargetFacility,
          sourceFacilityId: "junnar-chc-003",
          payload: { quantity: simQuantity }
        })
      });

      if (res.ok) {
        const responseData = await res.json();
        const newInt: Intervention = {
          interventionId: responseData.interventionId,
          title,
          urgency: "HIGH",
          status: "PENDING",
          targetFacilityId: simTargetFacility,
          payload: { quantity: simQuantity },
          simulationImpact: `Feasibility Score: ${simulationResult.operationalFeasibilityScore}/10`,
          assignedApprover: "District Health Officer"
        };
        setInterventions(prev => [newInt, ...prev]);
        setActiveTab("alerts");
      }
    } catch (err) {
      console.error("Queue intervention request failed", err);
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
        <div className="header-logo" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img src="/logo_light.svg" alt="GroundTruth AI Logo" style={{ height: "30px" }} />
        </div>
        
        <div className="header-meta">
          {/* Status Indicator */}
          <div 
            onClick={fetchData}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "6px", 
              padding: "4px 10px", 
              borderRadius: "12px", 
              fontSize: "0.8rem", 
              fontWeight: 600, 
              backgroundColor: isOffline ? "rgba(162, 75, 54, 0.1)" : "rgba(46, 125, 90, 0.1)",
              color: isOffline ? "var(--critical)" : "var(--success)",
              cursor: "pointer",
              border: `1px solid ${isOffline ? "var(--critical)" : "var(--success)"}`
            }}
            title="Click to reconnect/refresh"
          >
            {isConnecting ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : isOffline ? (
              <>
                <ShieldAlert size={12} />
                <span>Offline Mode</span>
              </>
            ) : (
              <>
                <Database size={12} />
                <span>Connected</span>
              </>
            )}
          </div>

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

      {/* Network Status Warning Banner */}
      {isOffline && (
        <div style={{
          background: "rgba(162, 75, 54, 0.08)",
          borderBottom: "1px solid rgba(162, 75, 54, 0.2)",
          color: "var(--critical)",
          padding: "8px 24px",
          fontSize: "0.82rem",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <ShieldAlert size={14} />
          <span>Local client is running in **Offline Mode** (FastAPI backend server is unreachable at {API_BASE_URL}). Projections and simulations are operating on static fallbacks.</span>
        </div>
      )}

      {/* Main Workspace Frame */}
      <div className="workspace-body">
        {/* Navigation Sidebar */}
        <aside className="nav-sidebar">
          <div className="nav-links">
            <button 
              onClick={() => setActiveTab("radar")}
              className={`nav-item ${activeTab === "radar" ? "active" : ""}`}
            >
              <Compass size={18} />
              District Risk Radar
            </button>
            <button 
              onClick={() => setActiveTab("simulator")}
              className={`nav-item ${activeTab === "simulator" ? "active" : ""}`}
            >
              <TrendingUp size={18} />
              What-If Simulator
            </button>
            <button 
              onClick={() => setActiveTab("scribe")}
              className={`nav-item ${activeTab === "scribe" ? "active" : ""}`}
            >
              <Mic size={18} />
              Clinical Scribe (AI)
            </button>
            <button 
              onClick={() => setActiveTab("alerts")}
              className={`nav-item ${activeTab === "alerts" ? "active" : ""}`}
            >
              <Activity size={18} />
              Active Interventions
            </button>
          </div>
          <div className="sidebar-footer">
            <p>GroundTruth AI v1.1.0</p>
            <p style={{ marginTop: "4px", fontSize: "0.75rem", opacity: 0.7 }}>Google Cloud Build with AI</p>
          </div>
        </aside>

        {/* Main Workspace Viewport */}
        <main className="main-viewport">
          {/* TAB 1: RISK RADAR SCREEN */}
          {activeTab === "radar" && (
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", height: "100%" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <div className="card-surface" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "380px" }}>
                  <div className="card-title">
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Compass size={18} style={{ color: "var(--primary)" }} />
                      Spatial Health Risk Map (GIS Interface)
                    </span>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      Viewing: Day {selectedDay} Forecast
                    </span>
                  </div>
                  {/* Leaflet Map Visualizer */}
                  <div className="map-canvas" style={{ flex: 1, minHeight: "300px" }}>
                    <MapComponent 
                      clinics={clinics}
                      selectedClinic={selectedClinic}
                      setSelectedClinic={setSelectedClinic}
                      selectedDay={selectedDay}
                      getStatusColor={getStatusColor}
                    />
                  </div>
                </div>

                {/* 14-Day Timeline Bar */}
                <div className="timeline-bar">
                  <div style={{ marginBottom: "12px", fontSize: "0.85rem", fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Activity size={14} />
                    14-Day Proactive Operational Forecasting Timeline
                  </div>
                  <div className="timeline-days">
                    {Array.from({ length: 14 }, (_, i) => i + 1).map((day) => {
                      const isSelected = selectedDay === day;
                      let status = "normal";
                      if (day >= 9) status = "critical";
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
                  <h3 style={{ color: "var(--primary)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Database size={18} />
                    Facility Inspector
                  </h3>
                  {selectedClinicData ? (
                    <>
                      <div style={{ fontSize: "1.3rem", fontWeight: 700, margin: "12px 0 6px 0" }}>{selectedClinicData.name}</div>
                      <div style={{ display: "inline-block", background: getStatusColor(selectedDay === 1 ? selectedClinicData.statusDay1 : selectedClinicData.statusDay14), color: "white", padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700, marginBottom: "20px" }}>
                        {(selectedDay === 1 ? selectedClinicData.statusDay1.toUpperCase() : selectedClinicData.statusDay14.toUpperCase())} STATUS (DAY {selectedDay})
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
                            <span style={{ color: selectedDay >= 9 ? "var(--critical)" : "var(--success)", fontWeight: 700 }}>
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
                    <div style={{ fontWeight: 700, color: "var(--critical)", fontSize: "0.85rem", marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <AlertTriangle size={14} />
                      Proactive Stockout Alert
                    </div>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-primary)" }}>AI forecasts an absolute stockout in 9 days due to a pediatric respiratory spike. Click the <strong>What-If Simulator</strong> tab to model reallocations.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: WHAT-IF SIMULATOR SCREEN */}
          {activeTab === "simulator" && (
            <div className="split-viewport">
              {/* Left Panel - Simulation Control parameters */}
              <div className="card-surface">
                <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <TrendingUp size={18} style={{ color: "var(--primary)" }} />
                  Intervention Simulator & Policy Planner
                </div>
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
                    style={{ width: "100%", marginTop: "12px", height: "45px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                    disabled={isSimulating}
                  >
                    {isSimulating ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Running Agent Simulations...
                      </>
                    ) : (
                      <>
                        <TrendingUp size={16} />
                        Simulate Operational Impact
                      </>
                    )}
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
                      onClick={handleQueueIntervention} 
                      className="btn-pill" 
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                    >
                      <CheckCircle size={16} />
                      Queue Intervention Proposal
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CLINICAL SCRIBE SCREEN */}
          {activeTab === "scribe" && (
            <div className="split-viewport">
              {/* Left Scriptor Recorder */}
              <div className="card-surface">
                <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Mic size={18} style={{ color: "var(--primary)" }} />
                  Speech-to-Insights Clinical Scribe
                </div>
                
                <div className="recorder-box">
                  {isRecording ? (
                    <button 
                      onClick={handleStopRecording} 
                      className="record-btn recording"
                    >
                      <Square size={24} fill="white" />
                    </button>
                  ) : (
                    <button 
                      onClick={handleStartRecording} 
                      className="record-btn"
                    >
                      <Mic size={24} />
                    </button>
                  )}
                  
                  <h3 style={{ marginBottom: "8px" }}>
                    {isRecording ? "Listening to Audio Consultation..." : "Click Mic to Start Live Recording"}
                  </h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "20px" }}>
                    Speak naturally in Hindi, Marathi, or English. Gemini structures audio notes into standardized HL7 FHIR records.
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
                    <label>Or Enter Clinical Note Text</label>
                    <textarea 
                      value={customClinicalNote} 
                      onChange={(e) => setCustomClinicalNote(e.target.value)} 
                      placeholder="Paste clinical dictation text or audio transcript here..."
                      className="sim-input-field"
                      rows={3}
                    />
                  </div>

                  <button
                    onClick={handleProcessText}
                    disabled={isProcessingText || !customClinicalNote.trim()}
                    className="btn-pill"
                    style={{ width: "100%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                  >
                    {isProcessingText ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Analyzing Clinical Data...
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        Process Text Note
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Structurer FHIR Outputs */}
              <div className="card-surface" style={{ display: "flex", flexDirection: "column" }}>
                <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Sparkles size={18} style={{ color: "var(--secondary)" }} />
                  AI Extraction Result
                </div>
                
                {isProcessingText ? (
                  <div style={{ display: "flex", flexGrow: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
                    <RefreshCw size={36} className="animate-spin" style={{ color: "var(--primary)" }} />
                    <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Gemini is structuring consultation data...</span>
                  </div>
                ) : scribeResult ? (
                  <div style={{ display: "flex", flexGrow: 1, flexDirection: "column", gap: "16px", overflowY: "auto" }}>
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
                        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{scribeResult.analyticsExtract?.suggestedOutbreakSignal}</div>
                      </div>
                      <div style={{ background: "rgba(199, 119, 47, 0.08)", padding: "12px", borderRadius: "8px", border: "1px solid var(--accent)" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 700 }}>OUTBREAK SEVERITY</span>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{scribeResult.analyticsExtract?.severityRisk}</div>
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
          )}

          {/* TAB 4: ACTIVE INTERVENTIONS SCREEN */}
          {activeTab === "alerts" && (
            <div className="card-surface">
              <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Activity size={18} style={{ color: "var(--primary)" }} />
                District Interventions Queue
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {interventions.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", padding: "20px", textAlign: "center" }}>No pending dispatches.</p>
                ) : (
                  interventions.map((int) => (
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
                            style={{ background: "var(--secondary)", display: "flex", alignItems: "center", gap: "4px" }}
                          >
                            <Check size={14} />
                            Approve & Dispatch
                          </button>
                        ) : (
                          <span style={{ color: "var(--success)", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                            <CheckCircle size={14} />
                            ✓ Dispatched
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
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
                  <span style={{ color: pred.value >= 0.8 ? "var(--critical)" : "var(--warning)", fontWeight: 700 }}>
                    {pred.targetType.replace("_", " ")}
                  </span>
                  <span>{Math.round(pred.value * 100)}% Risk</span>
                </div>
                <div className="alert-body">
                  {pred.targetId === "shirur-phc-001" ? "Shirur PHC" : pred.targetId === "khed-chc-002" ? "Khed CHC" : "Vulnerable Maternal Cohort"}
                </div>
                <div className="alert-meta" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Est. Target: {new Date(pred.targetDate).toLocaleDateString()}</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            ))}
          </div>
          
          {/* Selected Prediction Explanation Panel */}
          {selectedPrediction && (
            <div style={{ padding: "20px", borderTop: "1px solid var(--border)", background: "#ffffff" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700, marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                <Sparkles size={14} style={{ color: "var(--accent)" }} />
                Explainable AI (XAI) Insight
              </div>
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
