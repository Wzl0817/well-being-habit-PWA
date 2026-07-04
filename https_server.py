"""HTTPS 预览服务器 - 支持 Service Worker 通知测试"""
import http.server, ssl, socket, os, sys

PORT = 8766
DIR = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)
    
    def end_headers(self):
        self.send_header('Service-Worker-Allowed', '/')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        pass

httpd = http.server.HTTPServer(('0.0.0.0', PORT), Handler)
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(os.path.join(DIR, 'cert.pem'), os.path.join(DIR, 'key.pem'))
httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)

# 守护进程化：脱离当前 shell 会话
pid = os.fork()
if pid > 0:
    os._exit(0)
os.setsid()

# 获取局域网 IP（供手机访问）
local_ip = '127.0.0.1'
try:
    import subprocess
    r = subprocess.run(['ipconfig', 'getifaddr', 'en0'], capture_output=True, text=True)
    ip = r.stdout.strip()
    if ip:
        local_ip = ip
    else:
        r = subprocess.run(['ipconfig', 'getifaddr', 'en1'], capture_output=True, text=True)
        ip = r.stdout.strip()
        if ip:
            local_ip = ip
except:
    pass

print(f"\n  ✅ 预览服务器已启动")
print(f"  ─────────────────────────────────────")
print(f"  📱 手机访问 (HTTPS):")
print(f"     https://{local_ip}:{PORT}/")
print(f"  ─────────────────────────────────────")
print(f"  ⚠️  首次访问需接受证书警告")
print(f"     Safari → 点击「显示详情」→「访问此网站」")
print(f"  ─────────────────────────────────────\n")

try:
    httpd.serve_forever()
except KeyboardInterrupt:
    httpd.shutdown()
