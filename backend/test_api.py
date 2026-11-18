import sys
from main import screener, ScreenerRequest

req = ScreenerRequest(capital=10000, risk_tolerance="Medium", target_roi=15.0, time_horizon_years=5)
try:
    res = screener(req)
    print("Success:", res)
except Exception as e:
    import traceback
    traceback.print_exc()
