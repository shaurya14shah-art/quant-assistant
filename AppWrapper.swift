import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    var window: NSWindow!
    var webView: WKWebView!

    func applicationDidFinishLaunching(_ aNotification: Notification) {
        let rect = NSRect(x: 0, y: 0, width: 1280, height: 800)
        
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.center()
        window.title = "Quant Assistant"
        window.titlebarAppearsTransparent = true
        window.delegate = self
        
        let webConfiguration = WKWebViewConfiguration()
        webView = WKWebView(frame: rect, configuration: webConfiguration)
        webView.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15 QuantAssistantApp/1.0"
        
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        
        if let url = URL(string: "http://127.0.0.1:3000") {
            let request = URLRequest(url: url)
            webView.load(request)
        }
        
        NSApp.activate(ignoringOtherApps: true)
    }

    func windowWillClose(_ notification: Notification) {
        NSApplication.shared.terminate(self)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
