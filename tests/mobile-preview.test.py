import importlib.util, pathlib, subprocess, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
class PreviewTest(unittest.TestCase):
 def test_preview_safety_contract(self):
  # Exercise actual handler routing with an in-memory request; no server or outbound network.
  source=(ROOT/'scripts/mobile-preview.py').read_text();source=source[:source.index('parser=argparse.ArgumentParser()')]
  scope={'__file__':str(ROOT/'scripts/mobile-preview.py')};exec(compile(source,'mobile-preview.py','exec'),scope)
  import io
  class Request(scope['Preview']):
   def __init__(self,path):self.path=path;self.headers={};self.wfile=io.BytesIO();self.code=None
   def send_response(self,status,*args):self.code=status
   def send_header(self,*args):pass
   def end_headers(self):pass
   def send_error(self,status,*args):self.code=status
  for path in ['/api/nhl-events','/api/nhl-props','/api/nhl-schedule','/api/anything']:
   request=Request(path);request.do_GET();self.assertEqual(request.code,503);self.assertIn(b'no provider contacted',request.wfile.getvalue())
  for path in ['/lib/collector-configuration.js','/scripts/paper-runner.mjs','/docs/security-schema.sql','/.git/config','/../package.json']:
   request=Request(path);request.do_GET();self.assertEqual(request.code,404)
  request=Request('/api/paper-ledger');request.do_GET();self.assertEqual(request.code,200);self.assertIn(b'"events": []',request.wfile.getvalue())
if __name__=='__main__':unittest.main()
