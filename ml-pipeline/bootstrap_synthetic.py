import os
import random
import csv
import json
from datetime import datetime, timedelta

# Configuration
NUM_FACILITIES = 5
NUM_MEDICINES = 10
DAYS_OF_HISTORY = 100 # In standard setup, will generate ~100k rows
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

FACILITIES = [
    {"id": "shirur-phc-001", "name": "Shirur PHC", "type": "PHC", "lat": 18.8286, "lon": 74.3789, "doctors": 2, "nurses": 4},
    {"id": "khed-chc-002", "name": "Khed CHC", "type": "CHC", "lat": 18.8624, "lon": 73.8864, "doctors": 6, "nurses": 12},
    {"id": "junnar-chc-003", "name": "Junnar CHC", "type": "CHC", "lat": 19.2104, "lon": 73.8763, "doctors": 5, "nurses": 10},
    {"id": "ambegaon-phc-004", "name": "Ambegaon PHC", "type": "PHC", "lat": 19.0125, "lon": 73.9124, "doctors": 2, "nurses": 3},
    {"id": "manchar-chc-005", "name": "Manchar CHC", "type": "CHC", "lat": 19.0084, "lon": 74.0125, "doctors": 4, "nurses": 8}
]

MEDICINES = [
    {"id": "med-001", "name": "Amoxicillin 500mg", "category": "Antibiotic", "min": 200, "max": 2000},
    {"id": "med-002", "name": "Paracetamol 500mg", "category": "Analgesic", "min": 500, "max": 5000},
    {"id": "med-003", "name": "Oral Rehydration Salts (ORS)", "category": "Rehydration", "min": 300, "max": 3000},
    {"id": "med-004", "name": "Metformin 500mg", "category": "Antidiabetic", "min": 200, "max": 4000},
    {"id": "med-005", "name": "Amlodipine 5mg", "category": "Antihypertensive", "min": 200, "max": 4000},
    {"id": "med-006", "name": "Atorvastatin 10mg", "category": "Cardiovascular", "min": 150, "max": 3000},
    {"id": "med-007", "name": "Oxytocin Injection 5IU", "category": "Maternal Care", "min": 50, "max": 500},
    {"id": "med-008", "name": "Anti-Rabies Vaccine", "category": "Vaccine", "min": 20, "max": 200},
    {"id": "med-009", "name": "Albendazole 400mg", "category": "Dewormer", "min": 100, "max": 1000},
    {"id": "med-010", "name": "Iron Folic Acid Tablets", "category": "Supplement", "min": 1000, "max": 10000}
]

DISEASES = [
    {"code": "J06.9", "display": "Acute upper respiratory infection", "category": "Respiratory"},
    {"code": "A09.9", "display": "Gastroenteritis and colitis", "category": "Waterborne"},
    {"code": "E11.9", "display": "Type 2 diabetes mellitus", "category": "NCD"},
    {"code": "I10", "display": "Essential hypertension", "category": "NCD"},
    {"code": "B54", "display": "Unspecified malaria", "category": "Vector-borne"},
    {"code": "A90", "display": "Dengue fever", "category": "Vector-borne"}
]

def generate_data():
    print("Bootstrapping GroundTruth AI Synthetic Dataset...")
    
    # 1. Generate Inventory Snapshots (Time-series)
    # Output schema: snapshot_date, facility_id, medicine_id, stock_level, issued_quantity, received_quantity
    inventory_file = os.path.join(OUTPUT_DIR, "inventory_daily_snapshots.csv")
    print(f"Generating inventory snapshots in: {inventory_file}")
    
    inventory_count = 0
    with open(inventory_file, mode="w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["snapshot_date", "facility_id", "medicine_id", "stock_level", "issued_quantity", "received_quantity"])
        
        start_date = datetime.utcnow() - timedelta(days=DAYS_OF_HISTORY)
        
        # In-memory dictionary to track ongoing stock levels
        current_levels = {}
        for f in FACILITIES:
            for m in MEDICINES:
                # Initialize random starting level between min and max
                current_levels[(f["id"], m["id"])] = random.randint(m["min"], m["max"])
        
        for d in range(DAYS_OF_HISTORY):
            current_date = (start_date + timedelta(days=d)).strftime("%Y-%m-%d")
            
            for f in FACILITIES:
                for m in MEDICINES:
                    # Daily consumption simulation (dependent on facility size and random drift)
                    multiplier = 3 if f["type"] == "CHC" else 1
                    base_consumption = random.randint(1, 15) * multiplier
                    
                    # Add seasonal flu spikes to antibiotics
                    if m["id"] == "med-001" and d in range(30, 45): # Simulate a 2-week outbreak spike
                        base_consumption *= 4
                    
                    issued = min(current_levels[(f["id"], m["id"])], base_consumption)
                    current_levels[(f["id"], m["id"])] -= issued
                    
                    # Reorder delivery simulation
                    received = 0
                    # If stock falls below minimum, trigger a reorder that arrives 7 days later (or simulated here)
                    if current_levels[(f["id"], m["id"])] < m["min"] and random.random() < 0.15:
                        received = random.randint(m["min"] * 2, m["max"])
                        current_levels[(f["id"], m["id"])] += received
                    
                    stock = current_levels[(f["id"], m["id"])]
                    
                    writer.writerow([current_date, f["id"], m["id"], stock, issued, received])
                    inventory_count += 1

    # 2. Generate Health Event Logs
    # Output schema: event_id, facility_id, timestamp, disease_code, patient_age, patient_gender, symptoms, prescribed_medicines (json)
    events_file = os.path.join(OUTPUT_DIR, "health_events_flat.csv")
    print(f"Generating health events in: {events_file}")
    
    events_count = 0
    with open(events_file, mode="w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["event_id", "facility_id", "timestamp", "disease_code", "patient_age", "patient_gender", "symptoms", "prescribed_medicines"])
        
        start_date = datetime.utcnow() - timedelta(days=DAYS_OF_HISTORY)
        
        for d in range(DAYS_OF_HISTORY):
            current_day = start_date + timedelta(days=d)
            
            for f in FACILITIES:
                # Large clinics process more patients
                multiplier = 5 if f["type"] == "CHC" else 2
                daily_patients = random.randint(10, 40) * multiplier
                
                for p in range(daily_patients):
                    event_id = f"evt-{d:03d}-{f['id'][:3]}-{p:03d}"
                    timestamp = (current_day + timedelta(hours=random.randint(9, 16), minutes=random.randint(0, 59))).strftime("%Y-%m-%d %H:%M:%S")
                    
                    disease = random.choice(DISEASES)
                    patient_age = random.randint(1, 85)
                    patient_gender = random.choice(["Male", "Female", "Other"])
                    
                    # Generate logical symptoms
                    if disease["category"] == "Respiratory":
                        symptoms = json.dumps(["cough", "fever", "runny nose"])
                        prescribed = json.dumps([{"medicine_id": "med-001", "quantity": 10}, {"medicine_id": "med-002", "quantity": 10}])
                    elif disease["category"] == "Waterborne":
                        symptoms = json.dumps(["diarrhea", "vomiting", "dehydration"])
                        prescribed = json.dumps([{"medicine_id": "med-003", "quantity": 5}])
                    elif disease["category"] == "Vector-borne":
                        symptoms = json.dumps(["high fever", "chills", "joint pain"])
                        prescribed = json.dumps([{"medicine_id": "med-002", "quantity": 15}])
                    else: # NCDs
                        symptoms = json.dumps(["high blood pressure" if disease["code"] == "I10" else "polyuria"])
                        med_id = "med-005" if disease["code"] == "I10" else "med-004"
                        prescribed = json.dumps([{"medicine_id": med_id, "quantity": 30}])
                        
                    writer.writerow([event_id, f["id"], timestamp, disease["code"], patient_age, patient_gender, symptoms, prescribed])
                    events_count += 1
                    
    print(f"Successfully generated {inventory_count} inventory records and {events_count} clinical events.")
    
    # 3. Direct Firestore Ingestion Configuration (JSON file for direct import/seeding)
    seeding_config = os.path.join(OUTPUT_DIR, "firestore_seed_data.json")
    print(f"Generating Firestore bootstrap seed configuration: {seeding_config}")
    
    seed_data = {
        "facilities": FACILITIES,
        "medicines": MEDICINES,
        "districts": [
            {"districtId": "pune-001", "name": "Pune", "state": "Maharashtra", "resilienceScore": 81.5}
        ]
    }
    
    with open(seeding_config, "w") as f_json:
        json.dump(seed_data, f_json, indent=2)

if __name__ == "__main__":
    generate_data()
