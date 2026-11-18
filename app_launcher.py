import webview
import subprocess
import time
import os
import signal
import sys
import threading
import socket

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def wait_for_port(port, timeout=30):
    start_time = time.time()
    while time.time() - start_time < timeout:
        if is_port_in_use(port):
            return True
        time.sleep(0.5)
    return False

def kill_port(port):
    try:
        # Find PIDs listening on the port
        output = subprocess.check_output(["lsof", "-t", f"-i:{port}"]).decode().strip()
        if output:
            for pid in output.split():
                try:
                    os.kill(int(pid), signal.SIGKILL)
                except:
                    pass
    except Exception:
        pass # No process found

class JSApi:
    def __init__(self):
        self.window = None
        
    def save_state(self, state_json):
        import webview
        if not self.window:
            return False
        result = self.window.create_file_dialog(webview.SAVE_DIALOG, directory='', save_filename='quant_brain_state.json')
        if result and len(result) > 0:
            file_path = result[0]
            with open(file_path, 'w') as f:
                f.write(state_json)
            return True
        return False
        
    def load_state(self):
        import webview
        if not self.window:
            return None
        result = self.window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=('JSON Files (*.json)',))
        if result and len(result) > 0:
            file_path = result[0]
            with open(file_path, 'r') as f:
                return f.read()
        return None
        
    def minimize_window(self):
        import webview
        if self.window:
            self.window.minimize()

    def close_window(self):
        import webview
        if self.window:
            self.window.destroy()

def main():
    if getattr(sys, 'frozen', False):
        # We are bundled by PyInstaller
        root_dir = sys._MEIPASS
        # Use bundled uvicorn and python
        python_exe = sys.executable
        # We will import uvicorn and run it in a thread so we don't even need subprocess for the backend!
        backend_dir = os.path.join(root_dir, "backend")
        sys.path.append(backend_dir)
    else:
        root_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.join(root_dir, "backend")
    
    print("Cleaning up existing processes...")
    kill_port(8000)
    time.sleep(1)
    
    print("Starting Backend (which now serves the static Frontend)...")
    
    if getattr(sys, 'frozen', False):
        import uvicorn
        from backend.main import app
        
        def run_uvicorn():
            uvicorn.run(app, host="127.0.0.1", port=8000, log_level="error")
            
        server_thread = threading.Thread(target=run_uvicorn, daemon=True)
        server_thread.start()
        backend_process = None
    else:
        # Start the backend server via subprocess for local dev
        backend_process = subprocess.Popen(
            ["/bin/bash", "-c", f"{backend_dir}/venv/bin/python -m uvicorn main:app --port 8000"],
            cwd=backend_dir,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid
        )
    
    print("Waiting for server to be ready on port 8000...")
    if not wait_for_port(8000):
        print("Error: Server did not start in time.")
        if backend_process:
            os.killpg(os.getpgid(backend_process.pid), signal.SIGTERM)
        sys.exit(1)
        
    print("Server ready. Launching App Window...")
    
    api = JSApi()
    
    # Create the app window using pywebview
    # We now point to port 8000 where FastAPI serves the static frontend!
    window = webview.create_window(
        'Agent Eminence', 
        'http://127.0.0.1:8000',
        width=1280,
        height=800,
        min_size=(1024, 768),
        frameless=True,
        easy_drag=False,
        js_api=api
    )
    api.window = window
    
    # Run the webview event loop
    webview.start()
    
    # When the window is closed, clean up subprocesses
    print("Window closed. Shutting down server...")
    if backend_process:
        try:
            os.killpg(os.getpgid(backend_process.pid), signal.SIGTERM)
        except Exception:
            pass
    
    print("App exited cleanly.")

if __name__ == "__main__":
    main()
