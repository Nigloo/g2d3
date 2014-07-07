#!/usr/bin/env python3

import sys
import io
import os
import argparse
import json
import urllib
import http.server


class G2D3HTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
  """Custom server for G2D3
  
  """
  def __init__(self, *args, **kwargs):
    self.post_var = {}
    super().__init__(*args, **kwargs)
  
  def do_POST(self):
    """Serve a POST request."""
    
    # Look for data length
    content_length = self.headers.get('Content-Length')
    if content_length == None:
      self.send_error(411, 'Length Required')
      return None
    try:
      content_length = int(content_length)
    except ValueError:
      self.send_error(417, 'Bad Length\nExpected a number, got: '+content_length)
      return None
    
    # Look for data type
    content_type = self.headers.get('Content-Type')
    if content_type == None:
      self.send_error(417, 'Content Type Required')
      return None
    supported_content_type = ['application/json', 'application/x-www-form-urlencoded']
    if content_type not in supported_content_type:
      self.send_error(415, 'Bad Content Type\nExpected: '+(', '.join(supported_content_type))+'\nGot: '+content_type)
      return None
    
    enc = sys.getfilesystemencoding()
    data = str(self.rfile.read(content_length), enc)
    
    # Parse posted data
    self.post_var = {}
    try:
      if content_type == 'application/json':
        self.post_var = json.loads(data)
      elif content_type == 'application/x-www-form-urlencoded':
        self.post_var = urllib.parse.parse_qs(data)
        for k,v in self.post_var.items():
          if len(v) == 1:
            self.post_var[k] = v[0]
    except Exception as e:
      self.send_error(400, 'Request Syntax Incorrect')
      return None
    
    self.do_GET()
    self.post_var = {}
  
  
  def send_head(self):
    """Common code for GET, HEAD and POST commands.

    This sends the response code and MIME headers.

    Return value is either a file object (which has to be copied
    to the outputfile by the caller unless the command was HEAD,
    and must be closed by the caller under all circumstances), or
    None, in which case the caller has nothing further to do.

    """
    action = self.path[1:]
    if action == 'list_files':
      path = self.post_var.get('path', './')
      extensions = self.post_var.get('ext')
      if extensions != None and not isinstance(extensions, list):
        extensions = [extensions]
      
      return self.list_files(path, extensions)
    
    return super().send_head()
    
    
  def list_files(self, path, extensions=None):
    """Produce a list of file with given extensions

    Return value is either a file object, or None (indicating an
    error).  In either case, the headers are sent, making the
    interface the same as for send_head().

    """
    try:
        list = os.listdir(self.translate_path('/')+'/'+path)
    except OSError:
        self.send_error(404, 'No permission to list directory')
        return None
    
    if extensions != None:
      list = [name for name in list for ext in extensions if name.lower().endswith('.'+ext)]
    r = []
    for name in list:
      r.append('"'+name+'"')
    
    enc = sys.getfilesystemencoding()
    encoded = ('['+(','.join(r))+']').encode(enc)
    f = io.BytesIO()
    f.write(encoded)
    f.seek(0)
    self.send_response(200)
    self.send_header('Content-Type', 'application/json; charset=%s' % enc)
    self.send_header('Content-Length', str(len(encoded)))
    self.end_headers()
    return f


def main():
  parser = argparse.ArgumentParser(description='HTTP Server for G2D3')
  parser.add_argument('--bind', '-b', default='', metavar='ADDRESS',
                      help='Specify alternate bind address '
                           '[default: all interfaces]')
  parser.add_argument('port', action='store',
                      default=8000, type=int,
                      nargs='?',
                      help='Specify alternate port [default: 8000]')
  
  args = parser.parse_args()
  
  handler = G2D3HTTPRequestHandler
  server = http.server.HTTPServer
  server_address = (args.bind, args.port)
  httpd = server(server_address, handler)
  print('G2D3Server serving HTTP on',args.bind,'port',args.port,'...')

  httpd.serve_forever()


if __name__ == '__main__':
  main()
