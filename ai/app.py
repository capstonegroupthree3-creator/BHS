import sys
import os
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import LabelEncoder
import traceback

app = Flask(__name__)
CORS(app)

# Global variables for models and encoders
pregnancy_model = None
pregnancy_label_encoder = None
nutrition_model = None

def generate_and_train_pregnancy_model():
    """
    Generates a realistic synthetic dataset for maternal risk assessment
    and trains a scikit-learn RandomForestClassifier.
    """
    global pregnancy_model, pregnancy_label_encoder
    
    print("Generating synthetic data and training Pregnancy Risk ML Model...")
    
    np.random.seed(42)
    n_samples = 1500
    
    # Generate synthetic features
    age = np.random.randint(14, 45, n_samples)
    systolic_bp = np.random.randint(90, 160, n_samples)
    diastolic_bp = np.random.randint(55, 105, n_samples)
    weight_gain_kg = np.random.uniform(2, 22, n_samples)
    pregnancy_week = np.random.randint(4, 40, n_samples)
    has_diabetes = np.random.choice([0, 1], n_samples, p=[0.85, 0.15])
    has_hypertension = np.random.choice([0, 1], n_samples, p=[0.90, 0.10])
    
    # Define rules for risk labelling (Ground truth for ML training)
    risk_labels = []
    for i in range(n_samples):
        # Base criteria
        score = 0
        
        # Age risks
        if age[i] < 18:  # Teenage pregnancy
            score += 3
        elif age[i] > 35:  # Advanced maternal age
            score += 2
            
        # Blood Pressure risks
        if systolic_bp[i] >= 140 or diastolic_bp[i] >= 90:
            score += 4  # Pre-eclampsia threshold
        elif systolic_bp[i] >= 130 or diastolic_bp[i] >= 85:
            score += 2
            
        # Pre-existing conditions
        if has_diabetes[i] == 1:
            score += 3
        if has_hypertension[i] == 1:
            score += 3
            
        # Weight gain risks
        if weight_gain_kg[i] < 5 and pregnancy_week[i] > 20:
            score += 2
        elif weight_gain_kg[i] > 18 and pregnancy_week[i] > 20:
            score += 2
            
        # Risk classification mapping
        if score >= 6 or (systolic_bp[i] >= 145 or diastolic_bp[i] >= 95):
            risk_labels.append("Critical")
        elif score >= 4:
            risk_labels.append("High")
        elif score >= 2:
            risk_labels.append("Medium")
        else:
            risk_labels.append("Low")
            
    df = pd.DataFrame({
        'age': age,
        'systolic_bp': systolic_bp,
        'diastolic_bp': diastolic_bp,
        'weight_gain': weight_gain_kg,
        'week': pregnancy_week,
        'diabetes': has_diabetes,
        'hypertension': has_hypertension,
        'risk': risk_labels
    })
    
    # Train model
    X = df[['age', 'systolic_bp', 'diastolic_bp', 'weight_gain', 'week', 'diabetes', 'hypertension']]
    y = df['risk']
    
    pregnancy_model = RandomForestClassifier(n_estimators=100, random_state=42)
    pregnancy_model.fit(X, y)
    print("Pregnancy Risk model trained successfully!")

def generate_and_train_nutrition_model():
    """
    Trains a simple classifier to predict child malnutrition severity
    based on WHO-like indicators (age, height, weight, sex, BMI).
    """
    global nutrition_model
    
    print("Training Child Nutrition Classification Model...")
    
    np.random.seed(100)
    n_samples = 1500
    
    age_months = np.random.randint(1, 60, n_samples)
    sex = np.random.choice([0, 1], n_samples) # 0 = M, 1 = F
    height = np.random.uniform(50, 115, n_samples)
    # Generate weight relative to height
    base_weight = (height / 100) ** 2 * 16.0
    weight = base_weight * np.random.uniform(0.6, 1.5, n_samples)
    
    bmi = weight / ((height / 100) ** 2)
    
    status = []
    for i in range(n_samples):
        # Rule-based generation
        b = bmi[i]
        if b < 13.0:
            status.append("Severe Wasting")
        elif b < 14.5:
            status.append("Wasting")
        elif b > 22.0:
            status.append("Obese")
        elif b > 19.0:
            status.append("Overweight")
        else:
            status.append("Normal")
            
    df = pd.DataFrame({
        'age_months': age_months,
        'sex': sex,
        'height': height,
        'weight': weight,
        'bmi': bmi,
        'status': status
    })
    
    X = df[['age_months', 'sex', 'height', 'weight', 'bmi']]
    y = df['status']
    
    nutrition_model = RandomForestClassifier(n_estimators=100, random_state=42)
    nutrition_model.fit(X, y)
    print("Child Nutrition model trained successfully!")

# Initialize models
generate_and_train_pregnancy_model()
generate_and_train_nutrition_model()


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "Smart Barangay Health AI"}), 200


@app.route('/predict/nutrition', methods=['POST'])
def predict_nutrition():
    """
    Calculates BMI, predicts malnutrition class, and outputs suggestions.
    Body: { "age_months": 24, "sex": "M", "height_cm": 86, "weight_kg": 12 }
    """
    try:
        data = request.json
        age_months = int(data.get('age_months', 12))
        sex_str = data.get('sex', 'M')
        height_cm = float(data.get('height_cm', 75.0))
        weight_kg = float(data.get('weight_kg', 10.0))
        
        # Calculate BMI
        height_m = height_cm / 100.0
        bmi = weight_kg / (height_m ** 2)
        
        # Encode sex
        sex_encoded = 0 if sex_str.upper() == 'M' else 1
        
        # Predict status using ML model
        features = [[age_months, sex_encoded, height_cm, weight_kg, bmi]]
        predicted_status = nutrition_model.predict(features)[0]
        
        # Recommendations generator
        interventions = {
            "Severe Wasting": {
                "risk_level": "Critical",
                "color": "Red",
                "action": "Immediate medical referral to Municipal/Rural Health Unit (RHU).",
                "diet": "Prescribe Ready-to-Use Therapeutic Food (RUTF) and F-75/F-100 therapeutic milk.",
                "monitoring": "Daily home visits by Barangay Health Worker (BHW) and weekly weight checks."
            },
            "Wasting": {
                "risk_level": "High",
                "color": "Orange",
                "action": "Enroll in the Barangay Supplementary Feeding Program.",
                "diet": "High-protein, energy-dense local foods. Vitamin A & Micronutrient powder supplementation.",
                "monitoring": "Bi-weekly growth monitoring visits."
            },
            "Normal": {
                "risk_level": "Low",
                "color": "Green",
                "action": "Continue routine checkups and standard monitoring.",
                "diet": "Diverse complementary feeding. Breastfeeding up to 2 years if possible.",
                "monitoring": "Monthly growth monitoring at the local health center."
            },
            "Overweight": {
                "risk_level": "Medium",
                "color": "Yellow",
                "action": "Nutrition counseling for parents. Monitor physical play time.",
                "diet": "Reduce sugary drinks and processed snacks. Increase vegetables and fruits.",
                "monitoring": "Monthly growth monitoring."
            },
            "Obese": {
                "risk_level": "High",
                "color": "Orange",
                "action": "Pediatric consultation at Rural Health Unit (RHU) for endocrine screening.",
                "diet": "Structured nutritional plan. Eliminate empty calories and high-fructose syrups.",
                "monitoring": "Bi-weekly checks and activity log review."
            }
        }
        
        rec = interventions.get(predicted_status, interventions["Normal"])
        
        return jsonify({
            "bmi": round(bmi, 2),
            "nutrition_status": predicted_status,
            "risk_level": rec["risk_level"],
            "color": rec["color"],
            "recommendations": {
                "action": rec["action"],
                "diet": rec["diet"],
                "monitoring": rec["monitoring"]
            }
        }), 200
        
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 400


@app.route('/predict/pregnancy_risk', methods=['POST'])
def predict_pregnancy_risk():
    """
    Predicts pregnancy risk class and returns customized recommendations.
    Body: { "age": 17, "week": 16, "systolic_bp": 110, "diastolic_bp": 70, "weight_gain": 5, "diabetes": 0, "hypertension": 0 }
    """
    try:
        data = request.json
        age = int(data.get('age', 25))
        week = int(data.get('week', 12))
        systolic_bp = int(data.get('systolic_bp', 115))
        diastolic_bp = int(data.get('diastolic_bp', 75))
        weight_gain = float(data.get('weight_gain', 4.0))
        diabetes = int(data.get('diabetes', 0))
        hypertension = int(data.get('hypertension', 0))
        
        # Predict using ML model
        features = [[age, systolic_bp, diastolic_bp, weight_gain, week, diabetes, hypertension]]
        predicted_risk = pregnancy_model.predict(features)[0]
        
        # Enforce Rule-Based overrides (Clinical safety nets)
        # 1. Teenage Pregnancy
        is_teenage = age < 20
        # 2. Critical Hypertension Overrides
        if systolic_bp >= 140 or diastolic_bp >= 90:
            predicted_risk = "Critical"
        elif (systolic_bp >= 130 or diastolic_bp >= 85) and predicted_risk == "Low":
            predicted_risk = "Medium"
            
        risk_details = {
            "Low": {
                "color": "Green",
                "visits": "Routine monthly prenatal checkups.",
                "actions": "Standard prenatal vitamins (Iron + Folic acid). Normal activity.",
                "referral": "Continue care at local Barangay Health Center."
            },
            "Medium": {
                "color": "Yellow",
                "visits": "Bi-weekly checkups and home visits.",
                "actions": "BP monitoring, nutritional advice to manage weight gain, lifestyle assessment.",
                "referral": "Review by midwife / regular physician at RHU."
            },
            "High": {
                "color": "Orange",
                "visits": "Weekly checkups and specialized tests.",
                "actions": "Pre-eclampsia screening, strict diet, close monitoring of fetal movement.",
                "referral": "Refer to obstetrician at Rural Health Unit (RHU)."
            },
            "Critical": {
                "color": "Red",
                "visits": "Immediate clinical admission / urgent care.",
                "actions": "Antihypertensive administration, continuous fetal monitoring, bedrest.",
                "referral": "IMMEDIATE REFERRAL to Municipal Hospital or Tertiary Medical Center."
            }
        }
        
        details = risk_details.get(predicted_risk, risk_details["Low"])
        
        return jsonify({
            "risk_status": predicted_risk,
            "color": details["color"],
            "is_teenage_pregnancy": is_teenage,
            "recommendations": {
                "visit_schedule": details["visits"],
                "clinical_actions": details["actions"],
                "referral_path": details["referral"]
            }
        }), 200
        
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 400


@app.route('/predict/disease_trends', methods=['POST'])
def predict_disease_trends():
    """
    Fits linear/polynomial regression to historical monthly aggregates and projects future 3 months.
    Body: [ {"year": 2025, "month": 7, "cases": 12}, {"year": 2025, "month": 8, "cases": 15}, ... ]
    """
    try:
        historical_data = request.json
        if not historical_data or len(historical_data) < 3:
            # Return baseline prediction if insufficient data
            return jsonify({
                "forecast": [
                    {"month_label": "Next Month", "predicted_cases": 5},
                    {"month_label": "In 2 Months", "predicted_cases": 6},
                    {"month_label": "In 3 Months", "predicted_cases": 5}
                ],
                "model_accuracy_score": 0.0
            }), 200
            
        # Parse data
        df = pd.DataFrame(historical_data)
        
        # Sort chronologically
        df['time_index'] = range(len(df))
        
        X = df[['time_index']].values
        y = df['cases'].values
        
        # Fit Linear Regression
        model = LinearRegression()
        model.fit(X, y)
        
        # Forecast future 3 months
        future_indices = np.array([[len(df)], [len(df) + 1], [len(df) + 2]])
        predictions = model.predict(future_indices)
        
        # Clamp predictions to >= 0
        predictions = np.clip(predictions, 0, None)
        
        months_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        
        # Resolve target month labels
        last_row = df.iloc[-1]
        last_m = int(last_row['month'])
        last_y = int(last_row['year'])
        
        forecast_results = []
        for i, pred in enumerate(predictions):
            next_m = last_m + i + 1
            years_to_add = (next_m - 1) // 12
            target_m = (next_m - 1) % 12 + 1
            target_y = last_y + years_to_add
            
            month_label = f"{months_names[target_m - 1]} {target_y}"
            forecast_results.append({
                "month_label": month_label,
                "predicted_cases": int(round(pred))
            })
            
        r2 = model.score(X, y)
        
        return jsonify({
            "forecast": forecast_results,
            "model_accuracy_score": round(float(r2), 4)
        }), 200
        
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 400


@app.route('/predict/priority', methods=['POST'])
def predict_priority():
    """
    Ranks patients based on multi-criteria risk scoring.
    Body: {
        "citizens": [
            { "id": 1, "type": "child", "nutrition_status": "Severe Wasting", "missed_vaccines": 3 },
            { "id": 2, "type": "pregnant", "risk_status": "Critical", "age": 38 },
            { "id": 3, "type": "child", "nutrition_status": "Normal", "missed_vaccines": 0 }
        ]
    }
    """
    try:
        data = request.json
        citizens = data.get('citizens', [])
        
        ranked_citizens = []
        for citizen in citizens:
            score = 0
            c_type = citizen.get('type')
            
            if c_type == 'child':
                nut = citizen.get('nutrition_status', 'Normal')
                missed = int(citizen.get('missed_vaccines', 0))
                
                # Weighting parameters
                if nut == 'Severe Wasting':
                    score += 50
                elif nut in ['Wasting', 'Obese']:
                    score += 30
                elif nut == 'Overweight':
                    score += 15
                    
                score += (missed * 10)
                
            elif c_type == 'pregnant':
                risk = citizen.get('risk_status', 'Low')
                age = int(citizen.get('age', 25))
                
                if risk == 'Critical':
                    score += 60
                elif risk == 'High':
                    score += 40
                elif risk == 'Medium':
                    score += 20
                    
                if age < 20: # Teenage pregnancy risk
                    score += 15
                elif age > 35: # Advanced maternal age
                    score += 10
            
            # Map priority level
            if score >= 50:
                level = "Critical"
                color = "Red"
            elif score >= 30:
                level = "High"
                color = "Orange"
            elif score >= 15:
                level = "Medium"
                color = "Yellow"
            else:
                level = "Low"
                color = "Green"
                
            ranked_citizens.append({
                "id": citizen.get('id'),
                "type": c_type,
                "priority_score": score,
                "priority_level": level,
                "color": color
            })
            
        # Sort descending by score
        ranked_citizens.sort(key=lambda x: x['priority_score'], reverse=True)
        
        return jsonify(ranked_citizens), 200
        
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 400

@app.route('/predict/child_growth_nutrition', methods=['POST'])
def predict_child_growth_nutrition():
    """
    Calculates BMI, Stunting status, Wasting status, Micronutrient deficiency risks,
    and returns comprehensive actionable recommendations for child health improvement.
    Body: { "age_months": 24, "sex": "M", "height_cm": 74.0, "weight_kg": 7.5 }
    """
    try:
        data = request.json
        age_months = int(data.get('age_months', 12))
        sex_str = data.get('sex', 'M').upper()
        height_cm = float(data.get('height_cm', 75.0))
        weight_kg = float(data.get('weight_kg', 10.0))

        # 1. BMI Calculation
        height_m = height_cm / 100.0
        bmi = round(weight_kg / (height_m ** 2), 2)

        # 2. Wasting Classification (Weight-for-Height)
        if bmi < 13.5:
            wasting_status = "Severe Wasting"
        elif bmi < 14.5:
            wasting_status = "Wasting"
        elif bmi > 22.0:
            wasting_status = "Obese"
        elif bmi > 18.5:
            wasting_status = "Overweight"
        else:
            wasting_status = "Normal"

        # 3. Stunting Classification (Height-for-Age benchmark estimation)
        # Median height (cm) estimation for Under-5 children: ~49 + (1.5 * age_months)
        expected_height = 49.0 + (1.35 * age_months)
        height_ratio = height_cm / expected_height

        if height_ratio < 0.85:
            stunting_status = "Severe Stunting"
        elif height_ratio < 0.92:
            stunting_status = "Stunted"
        else:
            stunting_status = "Normal"

        # 4. Micronutrient Deficiency Risk Evaluation
        deficiencies = []
        if wasting_status in ["Severe Wasting", "Wasting"] or stunting_status in ["Severe Stunting", "Stunted"]:
            deficiencies.append("Iron Deficiency Anemia (High Risk)")
            deficiencies.append("Vitamin A Deficiency (Moderate-High Risk)")
            deficiencies.append("Zinc Deficiency (High Risk)")
        elif age_months >= 6 and age_months <= 59:
            deficiencies.append("Subclinical Micronutrient Risk (Routine Monitoring)")

        micro_risk_str = ", ".join(deficiencies) if deficiencies else "Low Risk - Adequate Intake"

        # 5. Formulate Actionable Recommendations
        if wasting_status == "Severe Wasting" or stunting_status == "Severe Stunting":
            overall_risk = "Critical"
            color = "Red"
            action = "IMMEDIATE REFERRAL to Municipal Health Officer / Rural Health Unit (RHU) for severe acute malnutrition (SAM) management."
            diet = "Provide Ready-to-Use Therapeutic Food (RUTF) (2-3 sachets/day). Feed small, frequent energy-dense meals (khichdi, mashed sweet potato with milk/butter, egg yolk)."
            supplements = "Administer Vitamin A (200,000 IU mega-dose), Micronutrient Powder (MNP) 1 sachet daily, and Oral Rehydration Solution (ORS) + Zinc (20mg/day for 14 days) if diarrhea is present."
            monitoring = "Weekly weight & height tracking by Barangay Health Worker (BHW) and weekly home visit."
        elif wasting_status == "Wasting" or stunting_status == "Stunted":
            overall_risk = "High"
            color = "Orange"
            action = "Enroll in the Barangay Supplementary Feeding Program and request pediatric review."
            diet = "Increase protein and micronutrient-dense local foods: malunggay-fortified soup, boiled eggs, monggo with fish, mashed banana, and whole milk."
            supplements = "Iron + Folic Acid syrup (3mg elemental iron/kg/day), Vitamin A supplementation (100,000 - 200,000 IU based on age)."
            monitoring = "Bi-weekly growth monitoring visits at Barangay Health Center."
        elif wasting_status in ["Overweight", "Obese"]:
            overall_risk = "Medium"
            color = "Yellow"
            action = "Counsel parents on active play, reducing sedentary screen time, and dietary modification."
            diet = "Eliminate sugary drinks, juices, and processed snacks. Encourage whole fruits, vegetables, water, and structured mealtimes."
            supplements = "Routine age-appropriate multivitamins. Avoid appetite stimulants."
            monitoring = "Monthly growth monitoring at local health center."
        else:
            overall_risk = "Low"
            color = "Green"
            action = "Continue standard child health care and routine monthly monitoring."
            diet = "Maintain balanced diet with 4 food groups daily (Carbohydrates, Proteins, Vegetables/Fruits, Healthy Fats). Breastfeeding up to 2 years."
            supplements = "Routine Vitamin A every 6 months and Micronutrient Powder (MNP)."
            monitoring = "Monthly routine Operation Timbang checkup."

        return jsonify({
            "bmi": bmi,
            "wasting_status": wasting_status,
            "stunting_status": stunting_status,
            "micronutrient_deficiency_risk": micro_risk_str,
            "overall_risk": overall_risk,
            "color": color,
            "recommendations": {
                "action": action,
                "diet": diet,
                "supplements": supplements,
                "monitoring": monitoring
            }
        }), 200

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 400


@app.route('/predict/maternal_care_recommendations', methods=['POST'])
def predict_maternal_care_recommendations():
    """
    Provides trimester-specific medical, supplement, and nutritional care plans for pregnant mothers.
    Body: { "age": 17, "gestational_week": 16, "systolic_bp": 110, "diastolic_bp": 70, "risk_status": "High" }
    """
    try:
        data = request.json
        age = int(data.get('age', 25))
        week = int(data.get('gestational_week', 12))
        sys_bp = int(data.get('systolic_bp', 115))
        dia_bp = int(data.get('diastolic_bp', 75))
        risk_status = data.get('risk_status', 'Low')

        # Trimester determination
        if week <= 12:
            trimester = "1st Trimester (Weeks 1-12)"
        elif week <= 27:
            trimester = "2nd Trimester (Weeks 13-27)"
        else:
            trimester = "3rd Trimester (Weeks 28-40)"

        # Medications & Supplementation Protocol (DOH Philippines Clinical Standards)
        meds = []
        if week <= 12:
            meds.append("Folic Acid 400mcg - 800mcg daily (Essential for neural tube defect prevention)")
        else:
            meds.append("Ferrous Sulfate (60mg elemental iron) + Folic Acid (400mcg) 1 tablet daily")
            meds.append("Calcium Carbonate 1000mg daily (Take 2 hours apart from Iron to optimize absorption)")

        # High-risk / Condition Overrides
        if age < 20:
            meds.append("Prenatal Multivitamins with Zinc & Iodine (Adolescent fortification)")
        if age >= 35 or risk_status in ["High", "Critical"]:
            meds.append("Low-Dose Aspirin 85mg - 150mg daily (Preeclampsia prophylaxis, start week 12-16)")
        if sys_bp >= 130 or dia_bp >= 85:
            meds.append("Methyldopa 250mg - 500mg (Anti-hypertensive therapy as prescribed by RHU OB-GYN)")

        meds.append("Tetanus Toxoid / Tdap Immunization (Dose 1 & 2 verification)")

        # Dietary & Lifestyle Plan
        diet_plan = (
            "Increase daily caloric intake by +300-450 kcal. Focus on iron-rich foods (red meat, liver, dark leafy greens like malunggay/kangkong), "
            "calcium sources (milk, cheese, small fish with bones), iodized salt moderation, and drinking at least 8-10 glasses of clean water daily."
        )

        # Red Flag Warning Signs
        red_flags = [
            "Severe persistent headache or visual disturbances (blurring, spots)",
            "Sudden swelling (edema) in face, hands, or feet",
            "Vaginal bleeding or fluid leakage",
            "Severe abdominal pain or persistent fever",
            "Decreased or absent fetal movements (especially in 3rd trimester)"
        ]

        return jsonify({
            "trimester": trimester,
            "risk_status": risk_status,
            "is_teenage_pregnancy": age < 20,
            "prescribed_medications": meds,
            "dietary_plan": diet_plan,
            "red_flags": red_flags,
            "recommended_visit_frequency": (
                "Weekly checkup & RHU referral" if risk_status == "Critical" else
                "Bi-weekly checkup" if risk_status == "High" else
                "Monthly prenatal visit"
            )
        }), 200

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 400


@app.route('/predict/community_programs', methods=['POST'])
def predict_community_programs():
    """
    Analyzes barangay health statistics and generates targeted intervention program recommendations
    for health center workers to review and approve.
    Body: { "teenage_count": 2, "malnutrition_count": 3, "stunting_count": 2, "dengue_cases": 8, "missed_vaccines": 10 }
    """
    try:
        data = request.json
        teenage_count = int(data.get('teenage_count', 0))
        malnutrition_count = int(data.get('malnutrition_count', 0))
        stunting_count = int(data.get('stunting_count', 0))
        dengue_cases = int(data.get('dengue_cases', 0))
        missed_vaccines = int(data.get('missed_vaccines', 0))

        recommendations = []

        # 1. Teenage Pregnancy Program Recommendation
        if teenage_count > 0:
            recommendations.append({
                "title": "Adolescent Health & Reproductive Wellness Seminar",
                "category": "teenage_pregnancy",
                "target_audience": "Adolescents (Ages 12-19), Young Parents & Barangay Youth Leaders",
                "ai_rationale": f"AI identified {teenage_count} active teenage pregnancy case(s) requiring community support, sex education, and maternal healthcare awareness.",
                "description": "Interactive educational workshop covering adolescent reproductive health, safe motherhood, nutrition during teenage pregnancy, and access to free health center counseling.",
                "proposed_days_from_now": 14,
                "location": "Barangay Multi-Purpose Hall"
            })

        # 2. Child Malnutrition & Stunting Feeding Drive
        if malnutrition_count > 0 or stunting_count > 0:
            recommendations.append({
                "title": "Barangay Operation Timbang & Supplementary Feeding Program",
                "category": "malnutrition",
                "target_audience": "Parents of Infants & Children under 5 years old",
                "ai_rationale": f"AI detected {malnutrition_count} malnourished child(ren) and {stunting_count} stunted child(ren) needing immediate nutritional intervention.",
                "description": "Comprehensive child growth screening, distribution of Ready-to-Use Therapeutic Food (RUTF), Vitamin A mega-dose drops, Micronutrient Powders, and parent nutrition cooking demos.",
                "proposed_days_from_now": 7,
                "location": "Barangay Health Center Grounds"
            })

        # 3. Dengue Vector Control Campaign
        if dengue_cases >= 3:
            recommendations.append({
                "title": "Barangay Dengue 4S Search-and-Destroy Cleanup Drive",
                "category": "dengue",
                "target_audience": "All Barangay Residents & Household Heads",
                "ai_rationale": f"AI epidemic forecasting detected {dengue_cases} reported dengue case(s). Immediate vector control is recommended.",
                "description": "Barangay-wide standing water cleanup, free larvicide (Abate) application in water containers, fever surveillance, and mosquito fogging in high-risk zones.",
                "proposed_days_from_now": 5,
                "location": "Barangay Wide / Covered Court"
            })

        # 4. Immunization Catch-up Drive
        if missed_vaccines >= 5:
            recommendations.append({
                "title": "Barangay Immunization Catch-Up & Door-to-Door Vaccination Drive",
                "category": "vaccination",
                "target_audience": "Parents of Children with Overdue Immunization Records",
                "ai_rationale": f"AI identified {missed_vaccines} overdue vaccination dose(s). Immediate catch-up is required to prevent vaccine-preventable disease outbreaks.",
                "description": "Door-to-door BHW visits and health center clinic for administering overdue Pentavalent, OPV, IPV, PCV, and MMR doses.",
                "proposed_days_from_now": 10,
                "location": "Barangay Health Center & Mobile Patrol"
            })

        # Always include baseline programs if list is empty or small
        if len(recommendations) < 2:
            recommendations.append({
                "title": "Barangay Camagong Maternal & Child Health Awareness Seminar",
                "category": "maternal",
                "target_audience": "Pregnant Women, Nursing Mothers & BHW Caregivers",
                "ai_rationale": "Routine AI epidemiological monitoring recommends monthly maternal health education and prenatal supplement distribution across all districts.",
                "description": "Interactive orientation on prenatal checkups, birth planning, proper nutrition, Iron/Folic Acid intake, and essential intrapartum care.",
                "proposed_days_from_now": 7,
                "location": "Barangay Camagong Health Center"
            })
            recommendations.append({
                "title": "Barangay Senior Citizen Wellness & Hypertension Screening Drive",
                "category": "general",
                "target_audience": "Senior Citizens (Ages 60+) & Chronic Illness Patients",
                "ai_rationale": "AI routine screening recommends regular blood pressure, blood glucose, and maintenance drug compliance tracking for elders across all Sitios.",
                "description": "Free blood pressure monitoring, blood sugar testing, elder health counseling, and maintenance medication review by rural health personnel.",
                "proposed_days_from_now": 12,
                "location": "Barangay Multi-Purpose Hall"
            })

        return jsonify({"recommended_programs": recommendations}), 200

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 400


@app.route('/predict/disease_medications', methods=['POST'])
def predict_disease_medications():
    """
    Returns AI-suggested maintenance medications and treatment guidelines for a given disease or medical condition.
    Body: { "disease_name": "Hypertension" }
    """
    try:
        data = request.json
        disease = data.get('disease_name', '').strip().lower()

        if 'hyper' in disease or 'bp' in disease or 'blood pressure' in disease:
            meds = [
                {"name": "Amlodipine Besylate", "dosage": "5 mg", "frequency": "Once daily after breakfast", "notes": "Calcium channel blocker. Monitor BP daily; report ankle edema."},
                {"name": "Losartan Potassium", "dosage": "50 mg", "frequency": "Once daily in the morning", "notes": "ARB anti-hypertensive. Maintain low-sodium diet and hydrate."}
            ]
        elif 'diabet' in disease or 'sugar' in disease:
            meds = [
                {"name": "Metformin Hydrochloride", "dosage": "500 mg", "frequency": "1 tablet twice daily with meals", "notes": "First-line GDM/Type 2 diabetes therapy. Take with meals to reduce GI upset."},
                {"name": "Glimepiride", "dosage": "2 mg", "frequency": "Once daily before breakfast", "notes": "Sulfonylurea. Monitor for hypoglycemia signs (shakiness, sweating)."}
            ]
        elif 'dengue' in disease or 'fever' in disease:
            meds = [
                {"name": "Paracetamol (Biogesic)", "dosage": "500 mg", "frequency": "Every 4-6 hours PRN for fever", "notes": "Do NOT take Aspirin or Ibuprofen (increased bleeding risk in Dengue)."},
                {"name": "Oral Rehydration Salts (ORS)", "dosage": "1 sachet in 1L water", "frequency": "Sip frequently throughout day", "notes": "Prevents dehydration and plasma leakage in Dengue fever."}
            ]
        elif 'cataract' in disease or 'eye' in disease or 'sight' in disease:
            meds = [
                {"name": "Latanoprost Eye Drops 0.005%", "dosage": "1 drop", "frequency": "Once daily in affected eye at bedtime", "notes": "Ophthalmic solution. Wash hands before application."},
                {"name": "Multivitamins with Lutein & Zeaxanthin", "dosage": "1 capsule", "frequency": "Once daily after meals", "notes": "Ocular antioxidants to slow macular/cataract progression."}
            ]
        elif 'asthma' in disease or 'respiratory' in disease or 'cough' in disease:
            meds = [
                {"name": "Salbutamol Inhaler 100mcg", "dosage": "1-2 puffs", "frequency": "Every 4-6 hours PRN for shortness of breath", "notes": "Fast-acting bronchodilator. Rinse mouth after use."},
                {"name": "Amoxicillin 500mg", "dosage": "500 mg", "frequency": "1 capsule 3 times daily for 7 days", "notes": "Complete full course if bacterial respiratory infection is present."}
            ]
        elif 'anemia' in disease or 'iron' in disease:
            meds = [
                {"name": "Ferrous Sulfate + Folic Acid", "dosage": "60mg / 400mcg", "frequency": "1 tablet daily at bedtime", "notes": "Take on empty stomach or with Vitamin C; avoid milk/coffee within 2 hours."}
            ]
        else:
            meds = [
                {"name": "Multivitamins + Essential Minerals", "dosage": "1 capsule", "frequency": "Once daily after meals", "notes": "Routine nutritional fortification. Consult RHU doctor for targeted therapy."}
            ]

        return jsonify({"disease": data.get('disease_name'), "suggested_medications": meds}), 200
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 400


@app.route('/predict/chatbot', methods=['POST'])
def predict_chatbot():
    """
    Intelligent Healthcare Assistant Chatbot.
    Receives user query + real database context (child records, parent details, maternal risks, vaccinations)
    and formats intelligent, clear, structured responses.
    """
    try:
        data = request.json
        user_message = data.get('message', '').strip().lower()
        context_data = data.get('context_data', {})

        user_role = context_data.get('user_role', 'parent')
        parent_name = context_data.get('parent_name', 'Parent')
        children = context_data.get('children', [])
        parents = context_data.get('parents', [])
        pregnant = context_data.get('pregnant', [])
        programs = context_data.get('programs', [])

        # Process user query intent
        response_text = ""
        action_type = None
        target_child = None

        # Check for Worker Edit Data Request
        is_edit_request = any(k in user_message for k in ['edit', 'update', 'change', 'modify', 'record visit']) and user_role in ['health_personnel', 'admin']

        # 1. Search for specific Child or Parent query
        matching_children = []
        for c in children:
            full_name = f"{c.get('first_name', '')} {c.get('last_name', '')}".lower()
            if any(name_part in full_name for name_part in user_message.split() if len(name_part) > 2) or ("child" in user_message and len(children) >= 1):
                matching_children.append(c)

        # Handle Worker Edit Form Trigger
        if is_edit_request:
            target_child = matching_children[0] if matching_children else (children[0] if children else None)
            if target_child:
                action_type = "open_edit_form"
                response_text = (
                    f"### 📝 Health Worker Action: Edit Child Data\n\n"
                    f"I have opened the interactive editing form for **{target_child.get('first_name')} {target_child.get('last_name')}**. "
                    f"Please update height (cm), weight (kg), or visit details below to re-calculate growth status:"
                )
            else:
                response_text = "No child record selected to edit. Please specify the child's name, e.g. *'Edit data for Juan Cruz'*."

        # Case A: Specific Child Search or "children" list query
        elif ("child" in user_message or "kid" in user_message or "baby" in user_message or matching_children) and not ("pregnant" in user_message or "mother" in user_message):
            targets = matching_children if matching_children else children
            if targets:
                response_text += "### 👶 Child Health Record Inquiry\n\n"
                for c in targets:
                    bmi_val = c.get('bmi', 'N/A')
                    nut_stat = c.get('nutrition_status', 'Normal')
                    stunt_stat = c.get('stunting_status', 'Normal')
                    wast_stat = c.get('wasting_status', 'Normal')
                    missed = c.get('missed_vaccines', 0)
                    micro_risk = c.get('micronutrient_deficiency_risk', 'Low Risk')

                    response_text += f"**Child:** {c.get('first_name')} {c.get('last_name')} ({c.get('sex', 'M')})\n"
                    response_text += f"- **Birthdate / Age:** {c.get('birthdate', 'N/A')}\n"
                    response_text += f"- **Parent / Guardian:** {c.get('parent_name', 'N/A')} (Contact: {c.get('parent_contact', 'N/A')})\n"
                    response_text += f"- **Barangay:** {c.get('barangay_name', 'N/A')}\n"
                    response_text += f"- **BMI / Weight Status:** {bmi_val} — `{nut_stat}`\n"
                    response_text += f"- **Stunting Evaluation:** `{stunt_stat}`\n"
                    response_text += f"- **Wasting Evaluation:** `{wast_stat}`\n"
                    response_text += f"- **Micronutrient Risk:** {micro_risk}\n"
                    response_text += f"- **Vaccination Alert:** {missed} missed/overdue vaccine dose(s)\n"

                    # AI Action Advice
                    if nut_stat in ["Severe Wasting", "Wasting"] or stunt_stat in ["Severe Stunting", "Stunted"]:
                        response_text += f"  > 💡 **AI Clinical Recommendation:** Enroll child in Barangay Supplementary Feeding Program. Administer Ready-to-Use Therapeutic Food (RUTF) and Vitamin A drops. Schedule weekly growth check.\n\n"
                    else:
                        response_text += f"  > 💡 **AI Guidance:** Growth is on track. Ensure monthly Operation Timbang monitoring.\n\n"
            else:
                if user_role == 'parent':
                    response_text = "🔒 **Data Privacy Notice (RA 10173):** You do not have registered child records under this name. As a parent account, you can only view health records for your own linked children."
                else:
                    response_text = "No matching child records found in the barangay database. Please check the spelling or register the child first."

        # Case B: Pregnant Women / Maternal Query
        elif "pregnant" in user_message or "mother" in user_message or "maternal" in user_message or matching_pregnant:
            targets = matching_pregnant if matching_pregnant else pregnant
            if targets:
                response_text += "### 🤰 Maternal Health & Pregnancy Record Inquiry\n\n"
                for p in targets:
                    risk = p.get('risk_status', 'Low')
                    week = p.get('pregnancy_week', 12)
                    bp = p.get('blood_pressure', '110/70')
                    meds = p.get('prescribed_medications', 'Folic Acid 400mcg daily')

                    response_text += f"**Mother:** {p.get('first_name')} {p.get('last_name')} (Age: {p.get('age')})\n"
                    response_text += f"- **Gestational Week:** Week {week}\n"
                    response_text += f"- **Expected Delivery:** {p.get('expected_delivery_date', 'N/A')}\n"
                    response_text += f"- **Barangay:** {p.get('barangay_name', 'N/A')}\n"
                    response_text += f"- **AI Risk Classification:** `{risk} Risk`"
                    if p.get('age', 25) < 20:
                        response_text += " ⚠️ *(Teenage Pregnancy Flag)*"
                    response_text += "\n"
                    response_text += f"- **Latest Blood Pressure:** {bp}\n"
                    response_text += f"- **Prescribed Medications:** {meds}\n"

                    if risk in ["High", "Critical"]:
                        response_text += f"  > 🚨 **AI Urgent Warning:** High risk maternal case. Require bi-weekly/weekly checkup at RHU and pre-eclampsia monitoring.\n\n"
                    else:
                        response_text += f"  > 💡 **AI Care Note:** Routine monthly prenatal checkup. Ensure daily Ferrous Sulfate + Folic Acid intake.\n\n"
            else:
                if user_role == 'parent':
                    response_text = "🔒 **Data Privacy Notice (RA 10173):** No maternal health record found under your parent account."
                else:
                    response_text = "No matching pregnant mother records found in the barangay database."

        # Case C: Malnutrition / Diet advice query
        elif "malnutrition" in user_message or "diet" in user_message or "feed" in user_message or "wasting" in user_message or "stunting" in user_message:
            response_text = (
                "### 🥗 AI Malnutrition & Growth Care Guidelines\n\n"
                "**For Children with Wasting / Underweight:**\n"
                "1. **Therapeutic Foods:** Administer Ready-to-Use Therapeutic Food (RUTF) sachets (2-3/day) for severe cases.\n"
                "2. **Nutrient-Dense Local Diet:** Mashed monggo with dilis, malunggay soup, boiled eggs, avocado, and banana.\n"
                "3. **Micronutrient Supplementation:** High-dose Vitamin A drops + Iron syrup (3mg/kg/day) + Zinc supplementation.\n\n"
                "**For Children with Stunting (Height-for-Age Deficit):**\n"
                "1. **High Protein & Calcium:** Whole milk, small fish eaten with bones, poultry, legumes.\n"
                "2. **Long-term Monitoring:** Monthly height tracking at health center.\n\n"
                "**For Obese / Overweight Children:**\n"
                "1. Replace sugary drinks & processed snacks with water and fresh fruits.\n"
                "2. Encourage 60 minutes of active physical play daily."
            )

        # Case D: Vaccine Query
        elif "vaccine" in user_message or "immunization" in user_message or "dose" in user_message:
            response_text = (
                "### 💉 Mandatory Philippine DOH Child Immunization Schedule\n\n"
                "- **At Birth:** BCG (Tuberculosis) + Hepatitis B\n"
                "- **1.5, 2.5, 3.5 Months:** Pentavalent (DPT-HepB-Hib) + OPV (Oral Polio) + PCV (Pneumococcal)\n"
                "- **3.5 & 9 Months:** IPV (Inactivated Polio)\n"
                "- **9 & 12 Months:** MMR (Measles, Mumps, Rubella)\n\n"
                "💡 *Tip: Ask me about your child's name to view overdue vaccine doses.*"
            )

        # Case E: Default AI Assistant Greeting & Overview
        else:
            if user_role == 'parent':
                my_kids = len(children)
                response_text = (
                    f"Hello **{parentName}**! I am your personal **Family Health AI Assistant** 🤖.\n\n"
                    f"**Your Linked Family Summary:**\n"
                    f"- 👶 **Children Registered:** {my_kids} child(ren) linked to your account.\n"
                    f"- 🔒 *For your privacy (RA 10173 Data Privacy Act), I will only answer questions about your own children and family healthcare.*\n\n"
                    f"**How I can help you:**\n"
                    f"1. Ask about your child's health (e.g. *'Show my child records'* or *'Is my child malnourished?'*).\n"
                    f"2. Ask about vaccines (e.g. *'Overdue vaccines'*).\n"
                    f"3. Ask for nutrition & feeding guidelines."
                )
            else:
                total_children = len(children)
                total_preg = len(pregnant)
                malnourished = len([c for c in children if c.get('nutrition_status') in ['Wasting', 'Severe Wasting']])
                high_risk_preg = len([p for p in pregnant if p.get('risk_status') in ['High', 'Critical']])

                response_text = (
                    f"Hello! I am your **Smart Barangay Health AI Assistant** 🤖.\n\n"
                    f"**Barangay-Wide Health Summary:**\n"
                    f"- 👶 **Children Enrolled:** {total_children} ({malnourished} flagged for malnutrition)\n"
                    f"- 🤰 **Pregnant Mothers:** {total_preg} ({high_risk_preg} classified high/critical risk)\n\n"
                    f"**How I can help you:**\n"
                    f"1. Type any citizen name (e.g. *'Show me Maria Cruz'*) to view growth, BMI, stunting/wasting, and vaccines.\n"
                    f"2. Type *'Show pregnant mothers'* to view maternal risk levels and prescribed prenatal medications.\n"
                    f"3. Type *'Malnutrition advice'* for dietary and therapeutic feeding guidelines."
                )

        return jsonify({
            "response": response_text,
            "action_type": action_type,
            "target_child": target_child
        }), 200

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 400


@app.route('/predict/medication_precautions', methods=['POST'])
def predict_medication_precautions():
    """
    Auto-detects AI precautions and usage advice based on medication name, dosage, and patient profile.
    Connects to Google Gemini API when key is available, with intelligent fallback.
    Body: { "medication_name": "Amlodipine", "dosage": "5mg", "medical_conditions": "Hypertension" }
    """
    try:
        data = request.json
        med_name = data.get('medication_name', '').strip()
        dosage = data.get('dosage', '').strip()
        conditions = data.get('medical_conditions', '').strip()
        
        gemini_key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
        
        if gemini_key:
            try:
                import urllib.request
                import json
                prompt = f"Act as a clinical pharmacist for a community health center. Provide concise, essential AI safety precautions and usage advice (2-3 sentences max) for prescribing {med_name} {dosage} to a patient with conditions: {conditions}. Focus on timing, side effects, and monitoring."
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
                req_data = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode('utf-8')
                req = urllib.request.Request(url, data=req_data, headers={'Content-Type': 'application/json'})
                with urllib.request.urlopen(req, timeout=5) as response:
                    res_json = json.loads(response.read().decode('utf-8'))
                    ai_text = res_json['candidates'][0]['content']['parts'][0]['text'].strip()
                    return jsonify({"ai_precautions": ai_text, "source": "Gemini AI"}), 200
            except Exception as ge:
                print(f"Gemini API call warning: {ge}")
        
        # Rule-based Clinical Fallback engine
        med_lower = med_name.lower()
        if 'amlodipine' in med_lower or 'nifedipine' in med_lower or 'losartan' in med_lower or 'captopril' in med_lower:
            advice = f"Take {med_name} strictly once daily after breakfast. Monitor blood pressure daily and report dizziness or swelling in ankles. Limit sodium intake."
        elif 'metformin' in med_lower or 'glimepiride' in med_lower or 'insulin' in med_lower:
            advice = f"Administer {med_name} with meals to minimize stomach upset. Monitor blood sugar levels regularly. Always carry a quick source of sugar in case of hypoglycemia symptoms."
        elif 'folic' in med_lower or 'ferrous' in med_lower or 'iron' in med_lower:
            advice = f"Take {med_name} with a glass of water or citrus juice (Vitamin C) for maximum absorption. Avoid taking within 2 hours of milk, tea, or calcium supplements."
        elif 'latanoprost' in med_lower or 'timolol' in med_lower or 'eye' in med_lower:
            advice = f"Instill 1 drop into affected eye(s) at bedtime. Avoid letting dropper tip touch eye surfaces. Schedule regular intraocular pressure checks."
        elif 'paracetamol' in med_lower or 'biogesic' in med_lower or 'ibuprofen' in med_lower:
            advice = f"Take {med_name} for pain/fever as needed (maximum 4000mg/day). Do not consume alcohol while taking paracetamol to prevent liver toxicity."
        else:
            advice = f"Take {med_name} ({dosage}) strictly as directed by healthcare worker. Take with food if stomach discomfort occurs and complete the full prescribed course."
            
        return jsonify({"ai_precautions": advice, "source": "Clinical AI Engine"}), 200
        
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 400


if __name__ == '__main__':
    # Flask runs on port 5001 to avoid conflicting with the Node API (port 5000)
    port = int(os.environ.get('PORT', 5001))
    print(f"Starting Smart Barangay Health AI Service on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)


