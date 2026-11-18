import time
from backend.quant_brain import QuantBrain
import numpy as np

prices = np.random.lognormal(mean=0, sigma=0.02, size=200).cumsum() + 100
brain = QuantBrain()
brain.fit(prices)

start = time.time()
for _ in range(10):
    brain.predict(150, 30)
end = time.time()
print(f"Average predict time: {(end-start)/10:.4f} seconds")
