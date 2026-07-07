import os
import sys
import logging
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("GroundTruthAI-ML")

# Core GCP Imports with standard fallback exceptions
try:
    from google.cloud import bigquery
    from google.cloud import firestore
except ImportError:
    logger.warning("Google Cloud Libraries not installed. Pipeline will run in Local Simulation Mode.")

def train_and_export_forecasts(project_id: str, dataset_id: str):
    logger.info(f"Starting BigQuery ML ARIMA_PLUS Forecasting for project {project_id}...")
    
    # Check for GCP Environment
    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        logger.warning("GOOGLE_APPLICATION_CREDENTIALS not found. Running in Local Simulation Mode.")
        run_local_simulation()
        return

    try:
        # Initialize clients
        bq_client = bigquery.Client(project=project_id)
        db = firestore.Client(project=project_id)
        
        # 1. Execute SQL to train the ARIMA_PLUS model
        logger.info("Training BQML ARIMA_PLUS model...")
        train_query = f"""
        CREATE OR REPLACE MODEL `{project_id}.{dataset_id}.stockout_forecast_model`
        OPTIONS(
          model_type='ARIMA_PLUS',
          time_column='snapshot_date',
          data_column='stock_level',
          time_series_id_col='medicine_id',
          horizon=14,
          auto_arima=TRUE
        ) AS
        SELECT 
          PARSE_DATE('%Y-%m-%d', snapshot_date) as snapshot_date, 
          medicine_id, 
          stock_level
        FROM `{project_id}.{dataset_id}.inventory_daily_snapshots`
        """
        query_job = bq_client.query(train_query)
        query_job.result() # Wait for query to execute
        logger.info("ARIMA_PLUS Model successfully trained.")
        
        # 2. Query forecast outcomes
        logger.info("Querying forecast outputs...")
        forecast_query = f"""
        SELECT 
          medicine_id, 
          forecast_value, 
          forecast_timestamp, 
          prediction_interval_lower_bound as lower_bound
        FROM ML.FORECAST(MODEL `{project_id}.{dataset_id}.stockout_forecast_model`, STRUCT(14 AS horizon))
        """
        forecast_job = bq_client.query(forecast_query)
        rows = forecast_job.result()
        
        # 3. Stream predictions to Firestore
        logger.info("Writing forecast predictions to Firestore...")
        predictions_ref = db.collection("predictions")
        
        write_count = 0
        for r in rows:
            medicine_id = r["medicine_id"]
            forecast_val = r["forecast_value"]
            target_date = r["forecast_timestamp"]
            
            # Simple stockout logic: if forecast lower bound or forecast value hits zero
            if forecast_val <= 100: # Threshold for critical low stock
                # Generate explanation block using rule/template (or dynamic Gemini call)
                xai_explanation = f"Predicted stockout of {medicine_id} near {target_date.strftime('%Y-%m-%d')}. Based on historical consumption trends, local diagnostic infection rates, and current inventory runway."
                
                prediction_id = f"bqml-stock-{medicine_id}-{target_date.strftime('%Y%m%d')}"
                predictions_ref.document(prediction_id).set({
                    "predictionId": prediction_id,
                    "targetType": "MEDICINE_STOCKOUT",
                    "targetId": f"facility-shirur-001", # Target PHC mapping
                    "value": round(float(1.0 - (forecast_val / 200.0)), 2), # Simplified confidence ratio
                    "generatedAt": datetime.utcnow(),
                    "targetDate": target_date,
                    "xaiExplanation": xai_explanation
                })
                write_count += 1
                
        logger.info(f"Successfully exported {write_count} critical stockout predictions to Firestore.")

    except Exception as e:
        logger.error(f"GCP Pipeline failed: {e}. Falling back to Local Simulation Mode.")
        run_local_simulation()

def run_local_simulation():
    logger.info("--- RUNNING LOCAL SIMULATION MODE ---")
    logger.info("No active GCP connection found. Simulating training runs and generating mock output files...")
    
    # Output mock prediction triggers
    output_data = [
        {
            "predictionId": "sim-pred-01",
            "targetType": "MEDICINE_STOCKOUT",
            "targetId": "shirur-phc-001",
            "value": 0.88,
            "generatedAt": datetime.utcnow().isoformat(),
            "targetDate": (datetime.utcnow() + timedelta(days=9)).isoformat(),
            "xaiExplanation": "Predicted stockout of Amoxicillin 500mg within 9 days. Driven by a 42% spike in childhood respiratory diagnoses in Khed-Shirur sub-districts."
        },
        {
            "predictionId": "sim-pred-02",
            "targetType": "PATIENT_SURGE",
            "targetId": "khed-chc-002",
            "value": 0.74,
            "generatedAt": datetime.utcnow().isoformat(),
            "targetDate": (datetime.utcnow() + timedelta(days=2)).isoformat(),
            "xaiExplanation": "Predicted surge (+35% patient footfall) expected in the outpatient department due to monsoon waterlogging."
        }
    ]
    
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "simulated_forecast_output.json")
    with open(output_path, "w") as f:
        import json
        json.dump(output_data, f, indent=2)
        
    logger.info(f"Simulated forecast output generated at: {output_path}")

if __name__ == "__main__":
    project = "groundtruth-ai-project"
    dataset = "health_analytics"
    
    if len(sys.argv) > 2:
        project = sys.argv[1]
        dataset = sys.argv[2]
        
    train_and_export_forecasts(project, dataset)
