#!/usr/bin/env python
from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
from threading import Thread
import os, time, subprocess
from urlparse import urlparse
import hmac, hashlib, re, json, yaml


OUTPUT_SUFFIX = os.environ.get('OUTPUT_DIR', "_build")
SECRET = os.environ['SECRET']

compileThread = 0


def log(s):
	print s
	# with open('python-ci.log', 'a') as logFile:
	# 	logFile.write(s+"\n")

def parseRef(ref):
	if ref == "latest":
		return "1f31488cca82ad562eb9ef7e3e85041ddd29a8ff"
	else:
		return ref

def getConfig(proj):
	with open(proj+"/.ci.yml", "r") as ymlfile:
		return yaml.load(ymlfile)


def updateStatus(ref, proj, fileName, msg):
	with open(getBuildPath(proj, ref)+"/_"+fileName, "w") as f:
		f.write(msg+":"+ref)

def getBuildPath(proj, ref):
	return proj+OUTPUT_SUFFIX +"/"+ parseRef(ref)


def getStatus(ref, proj, fileName):
	lastRef = ""
	status = False

	try:
		infoFile = open(getBuildPath(proj, ref)+"/_"+fileName, 'r')
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

def compileLatex(proj, ref, fileName):
	lastLog = ""
	successful = True

	cmd = ["latexmk",
				"-interaction=nonstopmode",
				# "-gg",
				"-file-line-error",
				"-jobname="+getBuildPath(proj, ref)+"/"+fileName,
				"-pdf", proj+"/"+fileName+".tex" ]

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




def doCompile(lang, ref, proj, fileName):
	log(">>> Started: "+time.strftime("%c"))
	lastLog = ">>> Started: "+time.strftime("%c") + "\n"

	if not os.path.exists(getBuildPath(proj, ref)):
		os.makedirs(getBuildPath(proj, ref))
	updateStatus(ref, proj, fileName, "RUN")
	successful = True

	successful, lastLogGit = updateGit(proj, ref)
	lastLog += lastLogGit

	if successful:
		successful, lastLogCompile = compileLang[lang](proj, ref, fileName)
		lastLog += lastLogCompile
	else:
		lastLog += "not compiling" + "\n"

	log(">>> Finished "+ref)
	lastLog += ">>> Finished: "+time.strftime("%X")+" "+ref  + "\n"

	with open(getBuildPath(proj, ref)+"/_"+fileName+".log", 'w') as lastLogFile:
		lastLogFile.write(lastLog)

	updateStatus(ref, proj, fileName, "OK" if successful else "ERROR")


def startCompile(lang, ref, proj, fileName):
	global compileThread
	# pylint: disable=no-member
	if compileThread and compileThread.isAlive():
		return (503, "Currently compiling")
	else:
		compileThread =	Thread(target=doCompile, args=(lang, ref, proj, fileName))
		compileThread.start()
		return (200, "Compiling Started")


class Handler(BaseHTTPRequestHandler):
	def _send(self, status, data = "", headers = None):
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

		path = urlparse(self.path).path

		message = ""
		status = 404

		match = re.search(r"^\/([a-zA-z+-]+)(?:\/?$|(?:\/([0-9a-f]*))?\/(.*))", path)
		# matches: 1=Project | 2=hash or empty | 3=file or empty

		if match is not None:
			project, ref, fileName = match.group(1,2)
			if os.path.isdir(project):
				cfg = getConfig(project)
				lang = cfg["language"].lower()

				main = cfg.get('main')

				if fileName == "build":
					status, message = startCompile(lang, ref, project, main)
				elif fileName == "output.pdf":
					try:
						f = open(getBuildPath(project, "latest")+"/"+main+".pdf" , "rb")
						try:
							self._send(200, f.read(), [("Content-type", "application/pdf")])
						finally:
							f.close()
					except IOError:
						self._send(404)
					return

				elif fileName == "output.log":
					try:
						f = open(getBuildPath(project, "latest")+"/_"+main+".log" , "r")
						try:
							self._send(200, f.read(), [("Content-type", "text/plain")])
						finally:
							f.close()
					except IOError:
						self._send(404)
					return

				elif fileName == "output.svg":
					buildStatus, lastRef = getStatus("latest", project, main)

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

		project = self.path[1:]

		(signature_func, signature) = self.headers['X-Hub-Signature'].split("=")
		output = "Error"
		status = 200

		cfg = getConfig(project)
		lang = cfg["language"].lower()

		main = cfg.get('main')

		if SECRET and SECRET != "<<Github Webhook secret>>":
			if signature_func == "sha1":
				mac = hmac.new(str(SECRET), msg=post_data, digestmod=hashlib.sha1)
				if not hmac.compare_digest(str(mac.hexdigest()), str(signature)):
					self._send(403, output)
					return

		if self.headers["X-GitHub-Event"] == "push" and self.headers["content-type"] == "application/json":
			data = json.loads(post_data)
			print data['head_commit']['id']+":\n"+data['head_commit']['message']
			status, output = startCompile(lang, data['head_commit']['id'], project, main)


		self._send(status, output)

	def log_message(self, format, *args):
		log("%s - - [%s] %s" % (self.client_address[0], self.log_date_time_string(), format%args))



if __name__ == '__main__':
	try:
		server = HTTPServer(('localhost', 8000), Handler)
		server.serve_forever()
	except KeyboardInterrupt:
		print '\n^C received, shutting down the web server'
		server.socket.close()
