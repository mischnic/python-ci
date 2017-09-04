#!/usr/bin/env python
from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
from urlparse import urlparse, parse_qs
from threading import Thread
import os, time, subprocess, json, time, hmac, hashlib


PROJECT = os.environ['PROJECT']
FILE = os.environ['FILE']
OUTPUT_DIR = os.environ['OUTPUT_DIR']
SECRET = os.environ['SECRET']

compileThread = 0
logFile = open('python-ci.log', 'a')

def log(s):
	# print s
	logFile.write(s+"\n")
	pass

def writeLastStatus(msg,ref):
	with open( OUTPUT_DIR+"/_"+FILE , "w") as f:
		f.write(msg+":"+ref);

def getLastStatus():
	lastRef = ""
	status = False

	try:
		infoFile = open(OUTPUT_DIR+"/_"+FILE, 'r')
		try:
			d = infoFile.read().split(":")
			status = d[0]
			lastRef = d[1][:7]
		finally:
			infoFile.close()
	except IOError:
		lastRef = "-"

	return (status, lastRef)

def compile(ref):
	lastLog = ">>>Started: "+time.strftime("%c") + "\n"
	writeLastStatus("RUN",ref)
	successful = True
	try:
		lastLog += subprocess.check_output(["git", "pull", "origin", "master"], cwd=PROJECT, stderr=subprocess.STDOUT) + "\n"
		lastLog += subprocess.check_output(["git", "reset", "--hard", ref], cwd=PROJECT, stderr=subprocess.STDOUT) + "\n"
		# lastLog += subprocess.check_output(["git", "checkout", ref], cwd=PROJECT, stderr=subprocess.STDOUT) + "\n"
		args = ["latexmk", 
					"-interaction=nonstopmode", 
					"-gg",
					"-file-line-error",
					"-jobname="+OUTPUT_DIR+"/"+FILE, 
					"-pdf", PROJECT+"/"+FILE+".tex"]

		try:
			out = subprocess.check_output(args, stderr=subprocess.STDOUT)
			lastLog += out + "\n"
		except subprocess.CalledProcessError as exc:
			lastLog += exc.output + "\n"
			lastLog += "latexmk failed: "+str(exc.returncode) + "\n"
			successful = False
	except subprocess.CalledProcessError as exc:
		lastLog += exc.output + "\n"
		lastLog += "git operations failed: "+str(exc.returncode) + "\n"
		lastLog += "not compiling" + "\n"
		successful = False

	log(">>>Finished "+ref)
	lastLog += ">>>Finished: "+time.strftime("%X")+" "+ref  + "\n"

	with open(OUTPUT_DIR+"/_"+FILE+".log", 'w') as lastLogFile:
		lastLogFile.write(lastLog)

	writeLastStatus("OK" if successful else "ERROR",ref)

def start_compile(ref):
	global compileThread

	if compileThread != 0 and compileThread.isAlive():
		return "Currently compiling"
	else:
		compileThread =	Thread(target=compile, args=(ref,))
		compileThread.start()
		return "Compiling Started"

class Handler(BaseHTTPRequestHandler):
	def do_GET(self):
		global compileThread

		parsed_path = urlparse(self.path)

		query = parse_qs(parsed_path.query, keep_blank_values=True)

		message = ""
		status = 200

		if parsed_path.path == "/" and "ref" in query:
			message = start_compile(query["ref"][0])
		elif parsed_path.path == "/output.pdf":
			try:
				f = open( OUTPUT_DIR+"/"+FILE+".pdf" , "rb")
				try:
					self.send_response(200)
					self.send_header("Content-type", "application/pdf")
					self.end_headers()
					self.wfile.write(f.read())
				finally:
					f.close()
			except IOError:
				self.send_response(404)
				self.end_headers()
			return

		elif parsed_path.path == "/output.log":
			try:
				f = open( OUTPUT_DIR+"/_"+FILE+".log" , "r")
				try:
					self.send_response(200)
					self.send_header("Content-type", "text/plain")
					self.end_headers()
					self.wfile.write(f.read())
				finally:
					f.close()
			except IOError:
				self.send_response(404)
				self.end_headers()
			return

		elif parsed_path.path == "/output.svg":
			status, lastRef = getLastStatus()

			if status == "OK":
				status = "#4c1"
			elif status == "RUN":
				status = "darkgrey"
			else:
				status = "red"

			svg = """
			<svg xmlns="http://www.w3.org/2000/svg" width="90" height="20">
				<linearGradient id="a" x2="0" y2="100%">
					<stop offset="0" stop-color="#bbb" stop-opacity=".1" />
					<stop offset="1" stop-opacity=".1" />
				</linearGradient>
				<rect rx="3" width="90" height="20" fill="#555" />
				<rect rx="3" x="37" width="53" height="20" fill="{}" />
				<path fill="{}" d="M37 0h4v20h-4z" />
				<rect rx="3" width="90" height="20" fill="url(#a)" />
				<g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
					<text x="19.5" y="15" fill="#010101" fill-opacity=".3">built</text>
					<text x="19.5" y="14">built</text>
					<text x="62.5" y="15" fill="#010101" fill-opacity=".3">{}</text>
					<text x="62.5" y="14">{}</text>
				</g>
			</svg>""".format(status, status, lastRef, lastRef);
			self.send_response(200)
			self.send_header("Content-type", "image/svg+xml")
			self.send_header("etag", lastRef)
			self.send_header("cache-control", "no-cache")
			self.end_headers()
			self.wfile.write(svg)
			return
		else:
			status = 404
			message = "Not Found"
		
		self.send_response(status)
		self.end_headers()
		self.wfile.write(message)

	def do_POST(self):
		content_length = int(self.headers['Content-Length'])
		post_data = self.rfile.read(content_length)

		(signature_func, signature) = self.headers['X-Hub-Signature'].split("=")
		output = "Error"
		status = 200

		if signature_func == "sha1":
			mac = hmac.new(str(SECRET), msg=post_data, digestmod=hashlib.sha1)

			if not hmac.compare_digest(str(mac.hexdigest()), str(signature)):
				status = 403
			else:
				if self.headers["X-GitHub-Event"] == "push" and self.headers["content-type"] == "application/json":
					data = json.loads(post_data)
					print data['head_commit']['id']+":\n"+data['head_commit']['message']
					output = start_compile(data['head_commit']['id'])

		self.send_response(status)
		self.end_headers()
		self.wfile.write(output)

	def log_message(self, format, *args):
		log("%s - - [%s] %s" % (self.client_address[0], self.log_date_time_string(), format%args))


if __name__ == '__main__':
	try:
		server = HTTPServer(('localhost', 8000), Handler)
		server.serve_forever()
	except KeyboardInterrupt:
		print '\n^C received, shutting down the web server'
		server.socket.close()
	finally:
		logFile.close()
