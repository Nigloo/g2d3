
import sys
import io
import os
import argparse
import http.server



class G2D3HTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
  def send_head(self):
    """Common code for GET and HEAD commands.

    This sends the response code and MIME headers.

    Return value is either a file object (which has to be copied
    to the outputfile by the caller unless the command was HEAD,
    and must be closed by the caller under all circumstances), or
    None, in which case the caller has nothing further to do.

    """
    action = self.path[1:]
    if action == 'list_file':
      path = './'
      return self.list_files(path, ['html', 'js'])
    
    return super().send_head()
    
    
  def list_files(self, path, extensions):
    """Produce a list of file with given extensions

    Return value is either a file object, or None (indicating an
    error).  In either case, the headers are sent, making the
    interface the same as for send_head().

    """
    try:
        list = os.listdir(self.translate_path('/')+'/'+path)
    except OSError:
        self.send_error(404, "No permission to list directory")
        return None
    
    list = [name for name in list for ext in extensions if name.lower().endswith('.'+ext)]
    r = []
    for name in list:
      r.append(name)
    
    enc = sys.getfilesystemencoding()
    encoded = '\n'.join(r).encode(enc)
    f = io.BytesIO()
    f.write(encoded)
    f.seek(0)
    self.send_response(200)
    self.send_header("Content-type", "text/plain; charset=%s" % enc)
    self.send_header("Content-Length", str(len(encoded)))
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


if __name__ == "__main__":
  main()
