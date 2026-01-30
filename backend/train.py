import torch
import torch.nn as nn
import numpy as np
from model import SpendingLSTM

data = np.array([50, 20, 100, 45, 60, 200, 40, 35, 120, 80] * 10, dtype=np.float32)
data = data.reshape(-1, 1)

def create_sequences(data, seq_length):
    xs, ys = [], []
    for i in range(len(data)-seq_length-1):
        x = data[i:(i+seq_length)]
        y = data[i+seq_length]
        xs.append(x)
        ys.append(y)
    return torch.from_numpy(np.array(xs)), torch.from_numpy(np.array(ys))

seq_length = 5
X_train, y_train = create_sequences(data, seq_length)

model = SpendingLSTM()
criterion = nn.MSELoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.01)

print("Training LSTM...")
for epoch in range(100):
    outputs = model(X_train)
    optimizer.zero_grad()
    loss = criterion(outputs, y_train)
    loss.backward()
    optimizer.step()

    if epoch % 10 == 0:
        print(f"Epoch {epoch}, Loss: {loss.item():.4f}")

torch.save(model.state_dict(), "forecast_model.pth")
print("Model saved to forecast_model.pth")