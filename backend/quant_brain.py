"""
QuantBrain — Self-Improving Ensemble Prediction Engine
=========================================================
Implements 9 quantitative finance models with a Bayesian meta-learner
that continuously re-weights the ensemble based on prediction accuracy.

Models:
  1. GARCH(1,1)              — Conditional volatility forecasting
  2. Ornstein-Uhlenbeck      — Mean-reversion SDE
  3. Merton Jump Diffusion   — GBM + Poisson jumps
  4. Kalman Filter            — State-space smoothing
  5. ARIMA                    — Trend extrapolation
  6. Wavelet Decomposition    — Multi-scale denoising
  7. Fourier Harmonics        — Cyclical frequency extraction
  8. Regime Detection         — Bull/Bear HMM
  9. Black-Scholes            — Options-implied boundaries

Meta-learner:
  Bayesian exponential weight update after every prediction cycle.
  weight_i ← (1 - lr) * weight_i + lr * exp(-α * error_i²)
"""

import numpy as np
import pandas as pd
from scipy.stats import norm
from scipy.ndimage import gaussian_filter1d
from scipy.fft import fft, fftfreq
import warnings
import threading

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────
# MODEL 1: GARCH(1,1) Volatility Forecasting
# ─────────────────────────────────────────────────────────────
class GARCHModel:
    """
    Generalized Autoregressive Conditional Heteroskedasticity.
    σ²_t = ω + α·ε²_{t-1} + β·σ²_{t-1}
    Captures volatility clustering — big moves beget big moves.
    """
    def __init__(self):
        self.omega = 0.0
        self.alpha = 0.0
        self.beta = 0.0
        self.fitted = False

    def fit(self, returns: np.ndarray):
        try:
            from arch import arch_model
            am = arch_model(returns * 100, vol='GARCH', p=1, q=1, mean='Zero', rescale=False)
            res = am.fit(disp='off', show_warning=False)
            self.omega = res.params.get('omega', 0.01)
            self.alpha = res.params.get('alpha[1]', 0.1)
            self.beta = res.params.get('beta[1]', 0.85)
            self.last_resid = (returns[-1] * 100) if len(returns) > 0 else 0.0
            cond_vol = res.conditional_volatility
            self.last_var = (cond_vol.iloc[-1] if hasattr(cond_vol, 'iloc') else cond_vol[-1]) ** 2 if len(cond_vol) > 0 else 1.0
            self.fitted = True
        except Exception:
            # Fallback: use simple exponential weighted variance
            self.omega = 0.01
            self.alpha = 0.1
            self.beta = 0.85
            self.last_resid = (returns[-1] * 100) if len(returns) > 0 else 0.0
            ewm_var = pd.Series(returns).ewm(span=20).var().iloc[-1]
            self.last_var = max(ewm_var * 10000, 1e-8) if not np.isnan(ewm_var) else 1.0
            self.fitted = True

    def predict(self, last_price: float, days: int) -> np.ndarray:
        if not self.fitted:
            return np.full(days, last_price)
        
        predicted_prices = np.zeros(days)
        var_t = self.last_var
        resid_t = self.last_resid
        price = last_price
        
        for t in range(days):
            var_t = self.omega + self.alpha * resid_t**2 + self.beta * var_t
            sigma_t = np.sqrt(max(var_t, 1e-8)) / 100  # back to decimal
            # GBM step with GARCH volatility
            price = price * np.exp(-0.5 * sigma_t**2 + sigma_t * np.random.normal())
            predicted_prices[t] = price
            resid_t = (price / predicted_prices[t-1] - 1) * 100 if t > 0 else resid_t
        
        return predicted_prices


# ─────────────────────────────────────────────────────────────
# MODEL 2: Ornstein-Uhlenbeck Mean Reversion
# ─────────────────────────────────────────────────────────────
class OrnsteinUhlenbeckModel:
    """
    dX = θ(μ - X)dt + σdW
    Price reverts to long-run mean μ at speed θ.
    Calibrated via maximum likelihood on log-prices.
    """
    def __init__(self):
        self.theta = 0.0  # reversion speed
        self.mu = 0.0     # long-run mean
        self.sigma = 0.0  # diffusion coefficient
        self.fitted = False

    def fit(self, prices: np.ndarray):
        try:
            log_prices = np.log(prices)
            n = len(log_prices)
            if n < 10:
                raise ValueError("Too few data points")
            
            dt = 1.0 / 252.0  # daily
            
            # MLE calibration for OU process
            x = log_prices[:-1]
            y = log_prices[1:]
            
            Sx = np.sum(x)
            Sy = np.sum(y)
            Sxx = np.sum(x * x)
            Sxy = np.sum(x * y)
            Syy = np.sum(y * y)
            n_obs = len(x)
            
            # OLS regression: y = a + b*x
            b = (n_obs * Sxy - Sx * Sy) / (n_obs * Sxx - Sx**2 + 1e-12)
            a = (Sy - b * Sx) / n_obs
            
            # Extract OU parameters
            self.theta = -np.log(max(abs(b), 1e-8)) / dt
            self.mu = a / (1 - b) if abs(1 - b) > 1e-8 else np.mean(log_prices)
            
            residuals = y - (a + b * x)
            var_e = np.var(residuals)
            self.sigma = np.sqrt(var_e * 2 * self.theta / (1 - np.exp(-2 * self.theta * dt) + 1e-12))
            
            # Clamp to reasonable ranges
            self.theta = np.clip(self.theta, 0.01, 100.0)
            self.sigma = np.clip(self.sigma, 0.01, 2.0)
            self.fitted = True
        except Exception:
            self.theta = 5.0
            self.mu = np.log(prices[-1]) if len(prices) > 0 else 5.0
            self.sigma = 0.2
            self.fitted = True

    def predict(self, last_price: float, days: int) -> np.ndarray:
        if not self.fitted:
            return np.full(days, last_price)
        
        dt = 1.0 / 252.0
        x = np.log(last_price)
        predicted = np.zeros(days)
        
        for t in range(days):
            dx = self.theta * (self.mu - x) * dt + self.sigma * np.sqrt(dt) * np.random.normal()
            x += dx
            predicted[t] = np.exp(x)
        
        return predicted


# ─────────────────────────────────────────────────────────────
# MODEL 3: Merton Jump Diffusion
# ─────────────────────────────────────────────────────────────
class MertonJumpDiffusionModel:
    """
    dS/S = (μ - λk)dt + σdW + JdN
    GBM with Poisson jump shocks. Captures gap moves.
    λ = jump intensity, J ~ N(μ_J, σ_J)
    """
    def __init__(self):
        self.mu = 0.0
        self.sigma = 0.0
        self.lam = 0.0       # jump intensity (events per year)
        self.mu_j = 0.0      # mean jump size
        self.sigma_j = 0.0   # jump volatility
        self.fitted = False

    def fit(self, returns: np.ndarray):
        try:
            self.mu = np.mean(returns) * 252
            self.sigma = np.std(returns) * np.sqrt(252)
            
            # Detect jumps: returns > 2.5 standard deviations
            threshold = 2.5 * np.std(returns)
            jumps = returns[np.abs(returns) > threshold]
            
            if len(jumps) > 2:
                self.lam = len(jumps) / (len(returns) / 252.0)  # annualized jump rate
                self.mu_j = np.mean(jumps)
                self.sigma_j = np.std(jumps)
            else:
                self.lam = 2.0  # ~2 jump events per year
                self.mu_j = 0.0
                self.sigma_j = self.sigma * 0.5
            
            self.fitted = True
        except Exception:
            self.mu = 0.1
            self.sigma = 0.2
            self.lam = 2.0
            self.mu_j = 0.0
            self.sigma_j = 0.1
            self.fitted = True

    def predict(self, last_price: float, days: int) -> np.ndarray:
        if not self.fitted:
            return np.full(days, last_price)
        
        dt = 1.0 / 252.0
        k = np.exp(self.mu_j + 0.5 * self.sigma_j**2) - 1
        price = last_price
        predicted = np.zeros(days)
        
        for t in range(days):
            # Diffusion component
            diffusion = (self.mu - self.lam * k - 0.5 * self.sigma**2) * dt
            diffusion += self.sigma * np.sqrt(dt) * np.random.normal()
            
            # Jump component (Poisson)
            n_jumps = np.random.poisson(self.lam * dt)
            jump = 0.0
            if n_jumps > 0:
                jump = np.sum(np.random.normal(self.mu_j, self.sigma_j, n_jumps))
            
            price *= np.exp(diffusion + jump)
            predicted[t] = price
        
        return predicted


# ─────────────────────────────────────────────────────────────
# MODEL 4: Kalman Filter State Estimation
# ─────────────────────────────────────────────────────────────
class KalmanFilterModel:
    """
    Linear state-space model:
      x_t = F·x_{t-1} + w    (state transition)
      z_t = H·x_t + v        (observation)
    Treats "true price" as hidden state corrupted by market noise.
    """
    def __init__(self):
        self.state = 0.0
        self.covariance = 1.0
        self.process_noise = 0.0
        self.measurement_noise = 0.0
        self.fitted = False

    def fit(self, prices: np.ndarray):
        try:
            returns = np.diff(np.log(prices))
            self.process_noise = np.var(returns) * 0.5
            self.measurement_noise = np.var(returns) * 2.0
            
            # Run Kalman filter over historical data to calibrate
            self.state = np.log(prices[0])
            self.covariance = 1.0
            
            for obs in np.log(prices):
                # Predict
                pred_state = self.state
                pred_cov = self.covariance + self.process_noise
                
                # Update
                innovation = obs - pred_state
                S = pred_cov + self.measurement_noise
                K = pred_cov / (S + 1e-12)  # Kalman gain
                
                self.state = pred_state + K * innovation
                self.covariance = (1 - K) * pred_cov
            
            self.fitted = True
        except Exception:
            self.state = np.log(prices[-1]) if len(prices) > 0 else 5.0
            self.covariance = 0.01
            self.process_noise = 0.001
            self.measurement_noise = 0.01
            self.fitted = True

    def predict(self, last_price: float, days: int) -> np.ndarray:
        if not self.fitted:
            return np.full(days, last_price)
        
        predicted = np.zeros(days)
        state = self.state
        cov = self.covariance
        
        for t in range(days):
            # Propagate state with growing uncertainty
            state = state  # random walk assumption
            cov = cov + self.process_noise
            
            # Sample from posterior
            sample = np.random.normal(state, np.sqrt(cov))
            predicted[t] = np.exp(sample)
        
        return predicted


# ─────────────────────────────────────────────────────────────
# MODEL 5: ARIMA Trend Extrapolation
# ─────────────────────────────────────────────────────────────
class ARIMAModel:
    """
    AutoRegressive Integrated Moving Average.
    Auto-selects (p,d,q) via BIC. Extrapolates trend component.
    """
    def __init__(self):
        self.model_fit = None
        self.fitted = False

    def fit(self, prices: np.ndarray):
        try:
            from statsmodels.tsa.arima.model import ARIMA
            
            # Use log prices for stationarity
            log_prices = np.log(prices[-60:])  # last 60 days for speed
            
            # Try a few standard orders and pick best BIC
            best_bic = np.inf
            best_order = (1, 1, 1)
            
            for p in [1, 2]:
                for q in [0, 1]:
                    try:
                        model = ARIMA(log_prices, order=(p, 1, q))
                        fit = model.fit(method_kwargs={"warn_convergence": False})
                        if fit.bic < best_bic:
                            best_bic = fit.bic
                            best_order = (p, 1, q)
                            self.model_fit = fit
                    except Exception:
                        continue
            
            if self.model_fit is None:
                model = ARIMA(log_prices, order=(1, 1, 0))
                self.model_fit = model.fit(method_kwargs={"warn_convergence": False})
            
            self.fitted = True
        except Exception:
            self.fitted = False

    def predict(self, last_price: float, days: int) -> np.ndarray:
        if not self.fitted or self.model_fit is None:
            # Linear extrapolation fallback
            return np.full(days, last_price)
        
        try:
            forecast = self.model_fit.forecast(steps=days)
            predicted = np.exp(forecast.values)
            return predicted
        except Exception:
            return np.full(days, last_price)


# ─────────────────────────────────────────────────────────────
# MODEL 6: Wavelet Multi-Scale Decomposition
# ─────────────────────────────────────────────────────────────
class WaveletModel:
    """
    Discrete Wavelet Transform using Daubechies wavelets.
    Decomposes price into trend + detail coefficients at multiple scales.
    Reconstructs denoised signal and extrapolates.
    """
    def __init__(self):
        self.trend = None
        self.last_slope = 0.0
        self.fitted = False

    def fit(self, prices: np.ndarray):
        try:
            import pywt
            
            # Pad to power of 2 if needed
            n = len(prices)
            level = min(4, pywt.dwt_max_level(n, 'db4'))
            if level < 1:
                level = 1
            
            # Decompose
            coeffs = pywt.wavedec(prices, 'db4', level=level)
            
            # Zero out detail coefficients (denoise) — keep only approximation + first detail
            for i in range(2, len(coeffs)):
                coeffs[i] = np.zeros_like(coeffs[i])
            
            # Reconstruct denoised signal
            self.trend = pywt.waverec(coeffs, 'db4')[:n]
            
            # Compute slope for extrapolation
            if len(self.trend) >= 5:
                self.last_slope = np.mean(np.diff(self.trend[-5:]))
            else:
                self.last_slope = 0.0
            
            self.fitted = True
        except Exception:
            self.trend = prices.copy() if prices is not None else np.array([100.0])
            self.last_slope = 0.0
            self.fitted = True

    def predict(self, last_price: float, days: int) -> np.ndarray:
        if not self.fitted:
            return np.full(days, last_price)
        
        # Extrapolate the denoised trend
        last_trend = self.trend[-1] if self.trend is not None and len(self.trend) > 0 else last_price
        predicted = np.zeros(days)
        
        for t in range(days):
            # Damped extrapolation (trend decays toward flat over time)
            damping = np.exp(-0.02 * t)
            noise = np.random.normal(0, abs(self.last_slope) * 0.5)
            predicted[t] = last_trend + self.last_slope * (t + 1) * damping + noise
        
        # Ensure no negative prices
        predicted = np.maximum(predicted, last_price * 0.5)
        return predicted


# ─────────────────────────────────────────────────────────────
# MODEL 7: Fourier Harmonic Extraction
# ─────────────────────────────────────────────────────────────
class FourierModel:
    """
    FFT-based cyclical pattern detection.
    Extracts top-k dominant frequencies and projects harmonics forward.
    """
    def __init__(self):
        self.harmonics = []  # list of (freq, amplitude, phase)
        self.N = 0
        self.fitted = False

    def fit(self, prices: np.ndarray):
        try:
            self.N = len(prices)
            yf = fft(prices)
            xf = fftfreq(self.N, 1.0)
            
            # Get top 5 non-DC frequencies
            slice_idx = int(self.N // 2)
            magnitudes = np.abs(np.asarray(yf[1:slice_idx]))
            top_indices = np.argsort(magnitudes)[::-1][:5] + 1
            
            self.harmonics = []
            for idx in top_indices:
                freq = xf[idx]
                amp = np.abs(yf[idx]) / self.N
                phase = np.angle(yf[idx])
                if freq != 0:
                    self.harmonics.append((freq, amp, phase))
            
            self.fitted = True
        except Exception:
            self.fitted = False

    def predict(self, last_price: float, days: int) -> np.ndarray:
        if not self.fitted or not self.harmonics:
            return np.full(days, last_price)
        
        t = np.arange(self.N, self.N + days)
        signal = np.zeros(days)
        
        for freq, amp, phase in self.harmonics:
            signal += amp * np.cos(2 * np.pi * freq * t + phase) * 2
        
        # The Fourier signal is a delta around last_price
        predicted = last_price + signal
        return predicted


# ─────────────────────────────────────────────────────────────
# MODEL 8: Regime Detection (Simplified HMM)
# ─────────────────────────────────────────────────────────────
class RegimeDetectorModel:
    """
    2-state Hidden Markov Model (bull/bear).
    Detects current regime from returns distribution.
    Uses regime-specific drift and volatility for prediction.
    """
    def __init__(self):
        self.current_regime = 0  # 0=bull, 1=bear
        self.regime_params = {
            0: {'mu': 0.001, 'sigma': 0.01},  # bull
            1: {'mu': -0.001, 'sigma': 0.02}, # bear
        }
        self.transition_matrix = np.array([[0.95, 0.05], [0.10, 0.90]])
        self.fitted = False

    def fit(self, returns: np.ndarray):
        try:
            # Simple regime detection via rolling statistics
            n = len(returns)
            if n < 40:
                raise ValueError("Too few points")
            
            # Split returns into two clusters using K-means
            from sklearn.cluster import KMeans
            X = returns.reshape(-1, 1)
            km = KMeans(n_clusters=2, random_state=42, n_init=10)
            labels = km.fit_predict(X)
            
            # Identify bull (higher mean) and bear (lower mean)
            means = [returns[labels == i].mean() for i in range(2)]
            bull_label = np.argmax(means)
            bear_label = 1 - bull_label
            
            bull_returns = returns[labels == bull_label]
            bear_returns = returns[labels == bear_label]
            
            self.regime_params[0] = {
                'mu': float(np.mean(bull_returns)),
                'sigma': float(np.std(bull_returns))
            }
            self.regime_params[1] = {
                'mu': float(np.mean(bear_returns)),
                'sigma': float(np.std(bear_returns))
            }
            
            # Estimate transition probabilities from label sequence
            transitions = np.zeros((2, 2))
            mapped_labels = np.where(labels == bull_label, 0, 1)
            for i in range(len(mapped_labels) - 1):
                transitions[mapped_labels[i], mapped_labels[i+1]] += 1
            
            # Normalize rows
            row_sums = transitions.sum(axis=1, keepdims=True)
            row_sums[row_sums == 0] = 1
            self.transition_matrix = transitions / row_sums
            
            # Current regime = last label
            self.current_regime = mapped_labels[-1]
            self.fitted = True
        except Exception:
            self.current_regime = 0
            self.fitted = True

    def predict(self, last_price: float, days: int) -> np.ndarray:
        if not self.fitted:
            return np.full(days, last_price)
        
        predicted = np.zeros(days)
        price = last_price
        regime = self.current_regime
        
        for t in range(days):
            params = self.regime_params[regime]
            ret = np.random.normal(params['mu'], params['sigma'])
            price *= (1 + ret)
            predicted[t] = price
            
            # Regime transition
            if np.random.random() > self.transition_matrix[regime, regime]:
                regime = 1 - regime
        
        return predicted


# ─────────────────────────────────────────────────────────────
# MODEL 9: Black-Scholes Boundary
# ─────────────────────────────────────────────────────────────
class BlackScholesModel:
    """
    Black-Scholes PDE for implied move boundaries.
    Produces mean = last_price * exp(rT), with BS cone as bounds.
    """
    def __init__(self):
        self.r = 0.045
        self.annualized_sigma = 0.2
        self.expected_move = 0.0
        self.fitted = False

    def fit(self, returns: np.ndarray):
        try:
            sigma = np.std(returns)
            self.annualized_sigma = sigma * np.sqrt(252)
            self.fitted = True
        except Exception:
            self.fitted = True

    def predict(self, last_price: float, days: int) -> np.ndarray:
        if not self.fitted:
            return np.full(days, last_price)
        
        T_arr = np.arange(1, days + 1) / 252.0
        # Risk-neutral drift
        drift = (self.r - 0.5 * self.annualized_sigma**2) * T_arr
        diffusion = self.annualized_sigma * np.sqrt(T_arr) * np.random.normal(size=days)
        predicted = last_price * np.exp(drift + diffusion)
        return predicted


# ─────────────────────────────────────────────────────────────
# RISK MANAGEMENT: Kelly Criterion + VaR/CVaR
# ─────────────────────────────────────────────────────────────
def kelly_criterion(win_prob: float, avg_win: float, avg_loss: float) -> float:
    """
    f* = (bp - q) / b
    Optimal fraction of capital to risk per trade.
    """
    if avg_loss == 0:
        return 0.0
    b = avg_win / abs(avg_loss)
    if b == 0:
        return 0.0
    p = win_prob
    q = 1 - p
    f = (b * p - q) / b
    return float(np.clip(f, 0.0, 1.0))


def compute_var_cvar(returns: np.ndarray, confidence: float = 0.95):
    """
    Value at Risk and Conditional Value at Risk (Expected Shortfall).
    """
    sorted_returns = np.sort(returns)
    idx = int((1 - confidence) * len(sorted_returns))
    var = -sorted_returns[max(idx, 0)]
    cvar = -np.mean(sorted_returns[:max(idx, 1)])
    return float(var), float(cvar)


# ─────────────────────────────────────────────────────────────
# FAST HEURISTIC NEURONS (Quant Neural Engine)
# ─────────────────────────────────────────────────────────────
class SMAModel:
    def fit(self, data: np.ndarray):
        self.data = data[-20:] if len(data) > 0 else np.array([])
    def predict(self, last_price: float, days: int) -> np.ndarray:
        pred = np.zeros(days)
        curr = list(self.data)
        for i in range(days):
            val = sum(curr[-20:]) / min(20, len(curr)) if curr else last_price
            pred[i] = val
            curr.append(val)
        return pred

class WMAModel:
    def fit(self, data: np.ndarray):
        self.data = data[-20:] if len(data) > 0 else np.array([])
    def predict(self, last_price: float, days: int) -> np.ndarray:
        pred = np.zeros(days)
        curr = list(self.data)
        for i in range(days):
            window = curr[-20:]
            n = len(window)
            if n == 0:
                val = last_price
            else:
                weights = np.arange(1, n + 1)
                val = float(np.sum(np.array(window) * weights) / weights.sum())
            pred[i] = val
            curr.append(val)
        return pred

class EMAModel:
    def fit(self, data: np.ndarray):
        self.data = data[-20:] if len(data) > 0 else np.array([])
    def predict(self, last_price: float, days: int) -> np.ndarray:
        pred = np.zeros(days)
        if len(self.data) == 0:
            return np.full(days, last_price)
        alpha = 2 / (len(self.data) + 1)
        ema = self.data[0]
        for val in self.data[1:]:
            ema = (val - ema) * alpha + ema
        for i in range(days):
            pred[i] = ema
        return pred

class LinearTrendModel:
    def fit(self, data: np.ndarray):
        self.data = data[-20:] if len(data) > 0 else np.array([])
    def predict(self, last_price: float, days: int) -> np.ndarray:
        pred = np.zeros(days)
        n = len(self.data)
        if n < 2:
            return np.full(days, last_price)
        x = np.arange(n)
        m, b = np.polyfit(x, self.data, 1)
        for i in range(days):
            pred[i] = m * (n + i) + b
        return pred

class MomentumModel:
    def fit(self, data: np.ndarray):
        self.data = data[-20:] if len(data) > 0 else np.array([])
    def predict(self, last_price: float, days: int) -> np.ndarray:
        pred = np.zeros(days)
        if len(self.data) < 2:
            return np.full(days, last_price)
        roc = self.data[-1] - self.data[-2]
        curr = self.data[-1]
        for i in range(days):
            curr += roc
            pred[i] = curr
            roc *= 0.9  # Dampen momentum
        return pred


# ═════════════════════════════════════════════════════════════
# QUANT BRAIN — Master Orchestrator with Self-Learning
# ═════════════════════════════════════════════════════════════
class QuantBrain:
    """
    Self-improving ensemble of 9 quantitative models.
    
    The Bayesian meta-learner continuously re-weights models:
      1. Each model predicts the next price
      2. When the actual price arrives, compute per-model error
      3. Update weights: w_i ← (1-lr) * w_i + lr * exp(-α * err_i²)
      4. Normalize weights to sum to 1
    
    Over time, models that predict well gain influence;
    models that miss lose it.
    """
    
    MODEL_NAMES = [
        "GARCH(1,1)",
        "Ornstein-Uhlenbeck",
        "Merton Jump Diffusion",
        "Kalman Filter",
        "ARIMA",
        "Wavelet Transform",
        "Fourier Harmonics",
        "Regime Detection",
        "Black-Scholes",
        "Simple Moving Average",
        "Weighted Moving Average",
        "Exponential Moving Average",
        "Linear Trend",
        "Rate of Change (Momentum)"
    ]
    
    def __init__(self, learning_rate: float = 0.15, error_sensitivity: float = 500.0):
        self.models = [
            GARCHModel(),
            OrnsteinUhlenbeckModel(),
            MertonJumpDiffusionModel(),
            KalmanFilterModel(),
            ARIMAModel(),
            WaveletModel(),
            FourierModel(),
            RegimeDetectorModel(),
            BlackScholesModel(),
            SMAModel(),
            WMAModel(),
            EMAModel(),
            LinearTrendModel(),
            MomentumModel()
        ]
        
        self.n_models = len(self.models)
        self.weights = np.ones(self.n_models) / self.n_models  # uniform init
        self.learning_rate = learning_rate
        self.error_sensitivity = error_sensitivity
        
        # Tracking
        self.last_predictions = np.zeros(self.n_models)
        self.cumulative_errors = np.zeros(self.n_models)
        self.prediction_count = 0
        self.model_accuracies = np.ones(self.n_models) * 100.0
        
        self.fitted = False
        self._lock = threading.Lock()
        
        # Load persistent state if exists
        self.load_state()

    def fit(self, prices: np.ndarray):
        """Fit all 9 sub-models to historical price data."""
        returns = np.diff(np.log(prices))
        
        # Dynamic Bayesian Alpha Scaling
        # Scale the error sensitivity inversely to market volatility so we don't
        # crush weights too aggressively during turbulent regimes.
        volatility = np.std(returns) if len(returns) > 1 else 0.015
        vol_ratio = 0.015 / max(volatility, 1e-4)
        self.error_sensitivity = max(100.0, min(1000.0, 500.0 * vol_ratio))
        
        # Fit each model (some use prices, some use returns)
        self.models[0].fit(returns)                     # GARCH
        self.models[1].fit(prices)                      # OU
        self.models[2].fit(returns)                     # Merton
        self.models[3].fit(prices)                      # Kalman
        self.models[4].fit(prices)                      # ARIMA
        self.models[5].fit(prices)                      # Wavelet
        self.models[6].fit(prices)                      # Fourier
        self.models[7].fit(returns)                     # Regime
        self.models[8].fit(returns)                     # Black-Scholes
        self.models[9].fit(prices)                      # SMA
        self.models[10].fit(prices)                     # WMA
        self.models[11].fit(prices)                     # EMA
        self.models[12].fit(prices)                     # Trend
        self.models[13].fit(prices)                     # Momentum
        
        self.fitted = True

    def predict(self, last_price: float, days: int) -> dict:
        """
        Run all 9 models, combine via weighted average.
        Returns the ensemble prediction + per-model diagnostics.
        """
        if not self.fitted:
            return {
                "mean_path": np.full(days, last_price),
                "bull_path": np.full(days, last_price * 1.05),
                "bear_path": np.full(days, last_price * 0.95),
                "upper_bound": np.full(days, last_price * 1.1),
                "lower_bound": np.full(days, last_price * 0.9),
                "diagnostics": self.get_diagnostics(),
            }
        
        all_predictions = np.zeros((self.n_models, days))
        
        for i, model in enumerate(self.models):
            try:
                pred = model.predict(last_price, days)
                # Sanitize: replace NaN with last_price and clamp to prevent explosion
                pred = np.nan_to_num(pred, nan=last_price, posinf=last_price * 1.5, neginf=last_price * 0.5)
                pred = np.clip(pred, last_price * 0.5, last_price * 1.5)
                all_predictions[i] = pred
            except Exception:
                all_predictions[i] = np.full(days, last_price)
        
        # Store first-step predictions for learning
        with self._lock:
            self.last_predictions = all_predictions[:, 0].copy()
        
        # Weighted ensemble
        w = self.weights / self.weights.sum()
        mean_path = np.average(all_predictions, axis=0, weights=w)
        
        # Compute spread for bull/bear/bounds
        stds = np.std(all_predictions, axis=0)
        bull_path = mean_path + stds * 1.0
        bear_path = mean_path - stds * 1.0
        upper_bound = mean_path + stds * 1.65
        lower_bound = mean_path - stds * 1.65
        
        # Risk metrics from the ensemble distribution
        final_returns = (all_predictions[:, -1] / last_price) - 1
        win_prob = float(np.mean(final_returns > 0))
        avg_win = float(np.mean(final_returns[final_returns > 0])) if np.any(final_returns > 0) else 0.0
        avg_loss = float(np.mean(final_returns[final_returns < 0])) if np.any(final_returns < 0) else 0.0
        kelly = kelly_criterion(win_prob, avg_win, abs(avg_loss) if avg_loss != 0 else 0.01)
        var_95, cvar_95 = compute_var_cvar(final_returns)
        
        return {
            "mean_path": mean_path,
            "bull_path": bull_path,
            "bear_path": bear_path,
            "upper_bound": upper_bound,
            "lower_bound": lower_bound,
            "all_predictions": all_predictions,
            "risk": {
                "kelly_fraction": kelly,
                "var_95": var_95,
                "cvar_95": cvar_95,
                "win_probability": win_prob,
            },
            "diagnostics": self.get_diagnostics(),
        }

    def predict_single_step(self, last_price: float) -> dict:
        """
        Predict just 1 step ahead (for live streaming).
        Returns per-model predictions and the weighted ensemble value.
        """
        if not self.fitted:
            return {"ensemble": last_price, "per_model": {}}
        
        predictions = {}
        values = np.zeros(self.n_models)
        
        for i, model in enumerate(self.models):
            try:
                pred = model.predict(last_price, 1)
                safe_pred = np.nan_to_num(pred[0], nan=last_price, posinf=last_price * 1.5, neginf=last_price * 0.5)
                val = float(np.clip(safe_pred, last_price * 0.95, last_price * 1.05))
            except Exception:
                val = last_price
            values[i] = val
            predictions[self.MODEL_NAMES[i]] = val
        
        with self._lock:
            self.last_predictions = values.copy()
        
        w = self.weights / self.weights.sum()
        ensemble = float(np.average(values, weights=w))
        
        return {"ensemble": ensemble, "per_model": predictions}

    def learn(self, actual_price: float):
        """
        Bayesian weight update after observing the actual price.
        Models that predicted closer to reality gain weight.
        """
        with self._lock:
            if not self.fitted or np.all(self.last_predictions == 0):
                return
            
            self.prediction_count += 1
            
            for i in range(self.n_models):
                predicted = self.last_predictions[i]
                if predicted == 0:
                    continue
                
                # Relative error
                error = abs(predicted - actual_price) / actual_price
                self.cumulative_errors[i] += error
                
                # Per-model accuracy (exponential moving average)
                accuracy = max(0.0, 100.0 * (1.0 - error))
                alpha_ema = 0.1
                self.model_accuracies[i] = (1 - alpha_ema) * self.model_accuracies[i] + alpha_ema * accuracy
                
                # Bayesian weight update: exp(-sensitivity * error²)
                # Clip the exponent to prevent underflow to exactly 0
                exponent = np.clip(-self.error_sensitivity * error**2, -700.0, 0.0)
                weight_update = np.exp(exponent)
                self.weights[i] = (1 - self.learning_rate) * self.weights[i] + self.learning_rate * weight_update
            
            # Normalize weights
            total = self.weights.sum()
            if total > 0:
                self.weights /= total
                
                # Prevent complete domination by regularizing back towards uniform distribution
                uniform_w = np.ones(self.n_models) / self.n_models
                self.weights = 0.90 * self.weights + 0.10 * uniform_w
            else:
                self.weights = np.ones(self.n_models) / self.n_models
            
            # Persist state after learning
            self.save_state()

    def save_state(self):
        import json
        import os
        filepath = os.path.join(os.path.dirname(__file__), 'brain_state.json')
        try:
            state = {
                "weights": self.weights.tolist(),
                "cumulative_errors": self.cumulative_errors.tolist(),
                "prediction_count": self.prediction_count,
                "model_accuracies": self.model_accuracies.tolist()
            }
            with open(filepath, 'w') as f:
                json.dump(state, f)
        except Exception as e:
            print(f"Failed to save QuantBrain state: {e}")

    def load_state(self):
        import json
        import os
        filepath = os.path.join(os.path.dirname(__file__), 'brain_state.json')
        try:
            if os.path.exists(filepath):
                with open(filepath, 'r') as f:
                    state = json.load(f)
                if len(state["weights"]) == self.n_models:
                    self.weights = np.array(state["weights"])
                    self.cumulative_errors = np.array(state["cumulative_errors"])
                    self.prediction_count = state["prediction_count"]
                    self.model_accuracies = np.array(state["model_accuracies"])
        except Exception as e:
            print(f"Failed to load QuantBrain state: {e}")

    def get_diagnostics(self) -> dict:
        """Return current model weights, accuracies, and learning stats."""
        with self._lock:
            return {
                "model_names": self.MODEL_NAMES,
                "weights": [round(float(w), 4) for w in self.weights],
                "accuracies": [round(float(a), 2) for a in self.model_accuracies],
                "prediction_count": self.prediction_count,
                "avg_errors": [
                    round(float(e / max(self.prediction_count, 1)), 6) 
                    for e in self.cumulative_errors
                ],
            }
            
    def reset(self):
        """Reset the brain to its initial uniform state."""
        with self._lock:
            self.weights = np.ones(self.n_models) / self.n_models
            self.cumulative_errors = np.zeros(self.n_models)
            self.prediction_count = 0
            self.model_accuracies = np.zeros(self.n_models)
            self.save_state()

    def import_state(self, state: dict):
        """Import brain state from a dictionary."""
        with self._lock:
            if "weights" in state and len(state["weights"]) == self.n_models:
                self.weights = np.array(state["weights"])
            if "cumulative_errors" in state and len(state["cumulative_errors"]) == self.n_models:
                self.cumulative_errors = np.array(state["cumulative_errors"])
            if "prediction_count" in state:
                self.prediction_count = state["prediction_count"]
            if "model_accuracies" in state and len(state["model_accuracies"]) == self.n_models:
                self.model_accuracies = np.array(state["model_accuracies"])
            self.save_state()

# ═════════════════════════════════════════════════════════════
# GLOBAL NEURAL ENGINE — A single brain that learns across all tickers
# ═════════════════════════════════════════════════════════════
_GLOBAL_BRAIN = QuantBrain()
_BRAIN_LOCK = threading.Lock()
_CURRENT_TICKER = None
_IS_PAUSED = False


import typing

def get_brain(ticker: str, prices: typing.Optional[np.ndarray] = None) -> QuantBrain:
    """
    Get the global QuantBrain.
    If prices are provided, fits the underlying statistical parameters to the new ticker,
    but the Bayesian meta-weights and accuracies persist globally, ensuring continuous learning.
    """
    global _CURRENT_TICKER
    with _BRAIN_LOCK:
        if prices is not None and len(prices) > 20 and _CURRENT_TICKER != ticker:
            _GLOBAL_BRAIN.fit(prices)
            _CURRENT_TICKER = ticker
        return _GLOBAL_BRAIN
