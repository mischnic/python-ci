#!/usr/bin/env python
from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
from threading import Thread
import os, time, subprocess, errno
from urlparse import urlparse
import hmac, hashlib, re, json


OUTPUT_SUFFIX = os.environ.get('OUTPUT_SUFFIX', "_build")
SECRET = os.environ.get('SECRET', "")
TOKEN = os.environ.get('TOKEN', "")
DOMAIN = os.environ.get('URL', "")

if TOKEN:
	import gh


compileThread = 0


def log(s):
	print s
	# with open('python-ci.log', 'a') as logFile:
	# 	logFile.write(s+"\n")


def symlink_force(target, link_name):
	try:
		os.symlink(target, link_name)
	except OSError, e:
		if e.errno == errno.EEXIST:
			os.remove(link_name)
			os.symlink(target, link_name)
		else:
			raise e

def parseRef(ref):
	if ref == "":
		return "last"
	else:
		return ref

def getConfig(proj):
	data = None
	try:
		f = open(proj+"/.ci.json", "r")
		try:
			data = json.load(f)
		finally:
			f.close()
	except IOError:
		pass
	except ValueError:
		pass

	return data

def getBuildPath(proj, ref):
	if parseRef(ref) is None:
		return proj+OUTPUT_SUFFIX +"/"+ "last"
	else:
		return proj+OUTPUT_SUFFIX +"/"+ parseRef(ref)


def updateStatus(ref, proj, msg, (start, duration), errorMsg = None):
	if msg == "success":
		color = "#4c1"
	elif msg == "pending":
		color = "darkgrey"
	else:
		color = "red"

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
	</svg>""".format(color, color, ref[:7], ref[:7])

	with open(getBuildPath(proj, ref)+"/.status.svg", "w") as f:
		f.write(svg)

	with open(getBuildPath(proj, ref)+"/.status.json", "w") as f:
		f.write(json.dumps({
				"ref": ref,
				"status": msg,
				"errorMsg": errorMsg,
				"start": round(start*1000),
				"duration": duration
			}))

	if TOKEN:
		gh.setStatus(proj, ref, msg, DOMAIN+"/"+proj+"/"+ref, errorMsg)


def getStatus(ref, proj):
	with open(getBuildPath(proj, ref)+"/.status.json", "r") as f:
		return json.load(f)


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
	latex = compileLatex,
	git = lambda a,b,c,d: (True, "")
)


def doCompile(proj, ref):
	timeStart = time.time()
	log(">>> Started: "+time.strftime("%c"))
	lastLog = ">>> Started: "+time.strftime("%c") + "\n"

	if not os.path.exists(getBuildPath(proj, ref)):
		os.makedirs(getBuildPath(proj, ref))
	updateStatus(ref, proj, "pending", (timeStart, None))
	successful = True

	successfulGit, lastLogGit = updateGit(proj, ref)
	lastLog += lastLogGit
	successful = successfulGit

	if successful:
		successfulCfg = True
		cfg = getConfig(proj)
		lang = cfg.get("language", None)
		main = cfg.get("main", None)

		if not lang or not main:
			successfulCfg = False
			successful = successfulCfg

		if successful:
			successfulCompile, lastLogCompile = compileLang[lang](proj, ref, main)
			lastLog += lastLogCompile
			successful = successfulCompile
		else:
			lastLog += "not compiling" + "\n"

	log(">>> Finished "+ref)
	lastLog += ">>> Finished: "+time.strftime("%X")+" "+ref  + "\n"

	with open(getBuildPath(proj, ref)+"/.log", 'w') as lastLogFile:
		lastLogFile.write(lastLog)

	updateStatus(ref, proj, "success" if successful else "error", (timeStart, time.time() - timeStart),
		"Git stage failed" if not successfulGit else
		"Config error" if not successfulCfg else
		"Compile stage failed" if not successfulCompile else None)

	symlink_force(ref, getBuildPath(proj, None))


def startCompile(proj, ref):
	global compileThread
	# pylint: disable=no-member
	if compileThread and compileThread.isAlive():
		return (503, "Currently compiling")
	else:
		compileThread =	Thread(target=doCompile, args=(proj, ref))
		compileThread.start()
		return (200, "Compiling Started")


class Handler(BaseHTTPRequestHandler):
	def _send(self, status, data = "", headers = None):
		if not data and status == 404:
			data = "Not Found"
		headers = headers or []

		self.send_response(status)
		for x in headers:
			name, value = x
			self.send_header(name, value)

		self.end_headers()
		self.wfile.write(data)

	def _sendFile(self, path, headers, binary = False):
		try:
			f = open(path, "rb" if binary else "r")
			try:
				self._send(200, f.read(), headers)
			finally:
				f.close()
		except IOError:
			self._send(404)


	def do_GET(self):
		path = urlparse(self.path).path

		message = ""
		status = 404

		match = re.search(r"^\/([a-zA-z+-]+)(?:\/?$|\/(?:([0-9a-f]*)\/)?(.*)?)", path)
		# matches: 1=Project | 2=hash or empty | 3=file or empty

		if match is not None:
			project, ref, fileName = match.group(1,2,3)
			if os.path.isdir(project):
				cfg = getConfig(project)

				main = cfg.get('main') if cfg else None

				# list of all commits
				if not ref and not fileName:
					dirs = [entry for entry in os.listdir(project+OUTPUT_SUFFIX) if entry != "last" and os.path.isdir(project+OUTPUT_SUFFIX+"/"+entry) ]

					data = []
					for ref in dirs:
						data.append({
							"commit": gh.getCommitDetails(project, ref),
							"build": getStatus(ref, project)
						})

					self._send(200, json.dumps(data), [("Content-type", "application/json")])
					return

				# status of ref
				elif ref and fileName == "status":
					self._send(200, json.dumps(getStatus(ref, project)), [("Content-type", "application/json")])
					return

				# elif ref and not fileName and main:
				# 	self._send(200, json.dumps(["log", "svg", "pdf"]), [("Content-type", "application/json")])
				# 	return

				elif ref and fileName == "build":
					status, message = startCompile(project, ref)
				else:
					if main:
						if fileName == "pdf":
							self._sendFile(getBuildPath(project, ref)+"/"+main+".pdf", [("Content-type", "application/pdf")], True)
							return

						elif fileName == "log":
							self._sendFile(getBuildPath(project, ref)+"/.log", [("Content-type", "text/plain")])
							return

						elif fileName == "svg":
							self._sendFile(getBuildPath(project, ref)+"/.status.svg",
												[("Content-type", "image/svg+xml"),
													("etag", ref),
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

		if SECRET and SECRET != "<<Github Webhook secret>>":
			if signature_func == "sha1":
				mac = hmac.new(str(SECRET), msg=post_data, digestmod=hashlib.sha1)
				if not hmac.compare_digest(str(mac.hexdigest()), str(signature)):
					self._send(403, output)
					return

		if self.headers["X-GitHub-Event"] == "push" and self.headers["content-type"] == "application/json":
			data = json.loads(post_data)
			print data['head_commit']['id']+": "+data['head_commit']['message']
			status, output = startCompile(project, data['head_commit']['id'])


		self._send(status, output)

	def log_message(self, format, *args):
		log("%s - - [%s] %s" % (self.client_address[0], self.log_date_time_string(), format%args))



if __name__ == '__main__':
	try:
		server = HTTPServer(('', 8000), Handler)
		print "Started server"
		server.serve_forever()
	except KeyboardInterrupt:
		print '\n^C received, shutting down the server'
		server.socket.close()
