from fastapi import FastAPI
from pydantic import BaseModel
import torch
import numpy as np
from model import SpendingLSTM

app = FastAPI()

model = SpendingLSTM()

try:
    model.load_state_dict(torch.load("forecast_model.pth"))
    model.eval()
    print("LSTM Model Loaded Successfully.")
except:
    print("Warning: No model found. Please train the model first.")

class ForecastRequest(BaseModel):
    recent_spending: list[float]

@app.post("/predict")
async def predict_spending(req: ForecastRequest):
    input_data = torch.tensor(req.recent_spending).float().view(1, 5, 1)

    with torch.no_grad():
        prediction = model(input_data)

    predicted_val = prediction.item()

    return {
        "status": "success",
        "predicted_next_day_spend": round(predicted_val, 2),
        "message": f"Based on your last 5 days, I predict you will spend ${round(predicted_val, 2)} tomorrow."
    }

@app.post("/chat")
async def chat_agent(query: dict):

    return {"reply": f"I analyze your finance data. You asked: '{query.get('text')}'."}