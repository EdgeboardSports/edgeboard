from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from urllib.parse import urlparse,parse_qs
import os,json,argparse
from pathlib import Path
os.chdir(Path(__file__).resolve().parents[1])
class Preview(SimpleHTTPRequestHandler):
 def do_GET(self):
  path=urlparse(self.path).path
  if path.startswith('/api/'):
   if path=='/api/paper-ledger' and parse_qs(urlparse(self.headers.get('Referer','')).query).get('qaLedger')==['error']: body={'message':'Synthetic unavailable ledger'};status=503
   elif path=='/api/paper-ledger': body={'schemaVersion':1,'events':[],'runs':[],'lastRunAt':None};status=200
   elif path=='/api/game-archive': body={'games':[],'teamNames':{}};status=200
   elif path=='/api/feed-status': body={'schedule':{'state':'paused'},'odds':{'state':'blocked','blockers':['Synthetic preview: live feeds paused.']},'automation':{'state':'paused','message':'Collection paused · local UI preview'}};status=200
   else: body={'message':'Synthetic preview: source unavailable; no provider contacted.'};status=503
   raw=json.dumps(body).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',len(raw));self.end_headers();self.wfile.write(raw);return
  pages={'index','best-picks','game','game-markets','player','paper','props','odds','budget'}
  modules={'best-picks-engine.js','game-model.js','game-paper.js','game-day.js','paper-core.js','prop-history.js','quote-selection.js','research-context.js','shots-model.js','count-model.js','evaluation-core.js'}
  allowed={'/'}|{'/'+p for p in pages}|{'/'+p+'.html' for p in pages}|{'/'+p for p in modules}|{'/assets/ui.css','/assets/ui.js','/assets/best-picks.js','/tests/ui/mobile-preview.html','/tests/ui/mobile-samples.html'}
  if path not in allowed:
   self.send_error(404);return
  if path=='/':self.path='/index.html'
  elif '.' not in path.rsplit('/',1)[-1]:self.path=path+'.html'
  return super().do_GET()
 def end_headers(self):
  self.send_header('Cache-Control','no-store');super().end_headers()
 def do_HEAD(self):self.send_error(405)
 def log_message(self,*args):pass
parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=4173);parser.add_argument('--host',default='0.0.0.0');parser.add_argument('--strictPort',action='store_true');args=parser.parse_args()
ThreadingHTTPServer(('0.0.0.0',args.port),Preview).serve_forever()
