#!/usr/bin/env python
from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
from urlparse import urlparse, parse_qs
from threading import Thread
import os, time, subprocess, json, time, hmac, hashlib, re, yaml

OUTPUT_DIR = os.environ.get('OUTPUT_DIR', "_build")
SECRET = os.environ['SECRET']

compileThread = 0

def log(s):
	print s
	# with open('python-ci.log', 'a') as logFile:
	# 	logFile.write(s+"\n")
	pass


def getConfig(proj):
	with open(proj+"/.ci.yml", "r") as ymlfile:
		return yaml.load(ymlfile)


def updateStatus(proj, file, msg,ref):
	with open( proj+OUTPUT_DIR+"/_"+file , "w") as f:
		f.write(msg+":"+ref);

def getStatus(proj, file):
	lastRef = ""
	status = False

	try:
		infoFile = open(proj+OUTPUT_DIR+"/_"+file, 'r')
		try:
			d = infoFile.read().split(":")
			status = d[0]
			lastRef = d[1][:7]
		finally:
			infoFile.close()
	except IOError:
		lastRef = "-"

	return (status, lastRef)




def updateGit(proj, ref):
	lastLog = ""
	successful = True
	try:
		lastLog += subprocess.check_output(["git", "pull", "origin", "master"], cwd=proj, stderr=subprocess.STDOUT) + "\n"
		lastLog += subprocess.check_output(["git", "reset", "--hard", ref], cwd=proj, stderr=subprocess.STDOUT) + "\n"
		
	except subprocess.CalledProcessError as exc:
		lastLog += exc.output + "\n"
		lastLog += "git operations failed: "+str(exc.returncode) + "\n"
		successful = False

	return (successful, lastLog)

def compileLatex(proj, file):
	lastLog = ""
	successful = True

	cmd = ["latexmk",
		"-interaction=nonstopmode",
		# "-gg",
		"-file-line-error",
		"-jobname="+proj+OUTPUT_DIR+"/"+file,
		"-pdf", proj+"/"+file+".tex"]

	try:
		lastLog += subprocess.check_output(cmd, stderr=subprocess.STDOUT) + "\n"

	except subprocess.CalledProcessError as exc:
		lastLog += exc.output + "\n"
		lastLog += "latexmk failed: "+str(exc.returncode) + "\n"
		successful = False

	return (successful, lastLog)


compileLang = dict(
	latex = compileLatex
)




def compile(lang, ref, proj, file):
	log(">>> Started: "+time.strftime("%c"))
	lastLog = ">>> Started: "+time.strftime("%c") + "\n"
	updateStatus(proj, file, "RUN",ref)
	successful = True

	successful, lastLogGit = updateGit(proj, ref)
	lastLog += lastLogGit

	if successful:
		successful, lastLogCompile = compileLang["latex"](proj, file)
		lastLog += lastLogCompile
	else:
		lastLog += "not compiling" + "\n"

	log(">>> Finished "+ref)
	lastLog += ">>> Finished: "+time.strftime("%X")+" "+ref  + "\n"

	with open(proj+OUTPUT_DIR+"/_"+file+".log", 'w') as lastLogFile:
		lastLogFile.write(lastLog)

	updateStatus(proj, file, "OK" if successful else "ERROR",ref)


def start_compile(lang, ref, proj, file):
	global compileThread

	if compileThread != 0 and compileThread.isAlive():
		return (503, "Currently compiling")
	else:
		compileThread =	Thread(target=compile, args=(lang, ref, proj, file))
		compileThread.start()
		return (200, "Compiling Started")



class Handler(BaseHTTPRequestHandler):
	def _send(self, status, data, headers = []):
		if not data and status == 404:
			data = "Not Found"

		self.send_response(status)
		for x in headers:
			name, value = x
			self.send_header(name, value)
			
		self.end_headers()
		self.wfile.write(data)


	def do_GET(self):
		global compileThread

		parsed_path = urlparse(self.path)
		query = parse_qs(parsed_path.query, keep_blank_values=True)

		message = ""
		status = 404

		match = re.search(r"\/([a-zA-z+-]+)\/(.*)", parsed_path.path)

		if match is not None:
			project, file = match.group(1,2)
			if os.path.isdir(project):
				cfg = getConfig(project)
				lang = cfg["language"].lower()

				if lang == "latex":
					main = cfg['main']

					if file == "" and "ref" in query:
						status, message = start_compile(lang, query["ref"][0], project, main)
					elif file == "output.pdf":
						try:
							f = open(project+OUTPUT_DIR+"/"+main+".pdf" , "rb")
							try:
								self._send(200, f.read(), [("Content-type", "application/pdf")]);
							finally:
								f.close()
						except IOError:
							self._send(404)
						return

					elif file == "output.log":
						try:
							f = open(project+OUTPUT_DIR+"/_"+main+".log" , "r")
							try:
								self._send(200, f.read(), [("Content-type", "text/plain")]);
							finally:
								f.close()
						except IOError:
							self._send(404)
						return

					elif file == "output.svg":
						buildStatus, lastRef = getStatus(project, main)

						if buildStatus == "OK":
							buildStatus = "#4c1"
						elif buildStatus == "RUN":
							buildStatus = "darkgrey"
						else:
							buildStatus = "red"

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
						</svg>""".format(buildStatus, buildStatus, lastRef, lastRef)

						self._send(200, svg, [("Content-type", "image/svg+xml"),
												("etag", lastRef),
												("cache-control", "no-cache")])
						return
		
		self._send(status, message)

	def do_POST(self):
		content_length = int(self.headers['Content-Length'])
		post_data = self.rfile.read(content_length)

		project = self.path[1:];

		(signature_func, signature) = self.headers['X-Hub-Signature'].split("=")
		output = "Error"
		status = 200

		cfg = getConfig(project)
		lang = cfg["language"].lower()

		if lang == "latex":
			main = cfg['main']

			if SECRET and SECRET != "<<Github Webhook secret>>":
				if signature_func == "sha1":
					mac = hmac.new(str(SECRET), msg=post_data, digestmod=hashlib.sha1)
					if not hmac.compare_digest(str(mac.hexdigest()), str(signature)):
						self._send(403, output);
						return

			if self.headers["X-GitHub-Event"] == "push" and self.headers["content-type"] == "application/json":
				data = json.loads(post_data)
				print data['head_commit']['id']+":\n"+data['head_commit']['message']
				status, output = start_compile(lang, data['head_commit']['id'], project, main)


		self._send(status, output);

	def log_message(self, format, *args):
		log("%s - - [%s] %s" % (self.client_address[0], self.log_date_time_string(), format%args))



if __name__ == '__main__':
	try:
		server = HTTPServer(('localhost', 8000), Handler)
		server.serve_forever()
	except KeyboardInterrupt:
		print '\n^C received, shutting down the web server'
		server.socket.close()
