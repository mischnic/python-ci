#!/usr/bin/env python
from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
from threading import Thread
import os, time, subprocess, errno, datetime, urlparse
import hmac, hashlib, re, json, jwt

import latex


OUTPUT_SUFFIX = os.environ.get('OUTPUT_SUFFIX', "_build")
SECRET = os.environ.get('SECRET', "")
TOKEN = os.environ.get('TOKEN', "")
DOMAIN = os.environ.get('URL', "")
PASSWORD = os.environ.get('PASSWORD', "")
JWT_SECRET = os.environ.get('JWT_SECRET', "secret")
PROJECTS = "[]" if os.environ.get('PROJECTS', None) is None else "["+",".join(['"'+x+'"' for x in os.environ.get('PROJECTS').split(",")])+"]"

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

def parseRef(proj, ref):
	if ref == "latest":
		return os.path.basename(os.path.realpath(proj+OUTPUT_SUFFIX+"/"+ref))
	else:
		return ref

def loadJSON(fileName):
	data = None
	try:
		f = open(fileName, "r")
		try:
			data = json.load(f)
		finally:
			f.close()
	except IOError:
		pass
	except ValueError:
		pass

	return data

def getConfig(proj):
	return loadJSON(proj+"/.ci.json")

def getBuildPath(proj, ref):
	return proj+OUTPUT_SUFFIX +"/"+ ref


def updateStatus(ref, proj, msg, (start, duration), errorMsg = None, stats = {}):
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

	data = {
		"ref": ref,
		"status": msg,
		"errorMsg": errorMsg,
		"start": round(start*1000),
		"duration": duration,
		"stats": stats
	}	

	with open(getBuildPath(proj, ref)+"/.status.json", "w") as f:
		f.write(json.dumps(data))

	if TOKEN:
		gh.setStatus(proj, ref, msg, DOMAIN+"/"+proj+"/"+ref, errorMsg)


def getStatus(ref, proj):
	return loadJSON(getBuildPath(proj, ref)+"/.status.json")

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

compileLang = dict(
	latex = latex.doCompile,
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
			successfulCompile, lastLogCompile = compileLang[lang](proj, getBuildPath(proj, ref), main)
			lastLog += lastLogCompile
			successful = successfulCompile
		else:
			lastLog += "not compiling" + "\n"

	stats = {}
	if successful:
		cfg = getConfig(proj)
		if "stats" in cfg:
			if cfg["language"] == "latex" and "counts" in cfg["stats"]:
				(success, counts) = latex.count(proj, getBuildPath(proj, ref), cfg["main"]+".tex")
				if success:
					stats["counts"] = counts
				else:
					stats["counts"] = False	

	log(">>> Finished "+ref)
	lastLog += ">>> Finished: "+time.strftime("%X")+" "+ref  + "\n"

	with open(getBuildPath(proj, ref)+"/.log", 'w') as lastLogFile:
		lastLogFile.write(lastLog)

	updateStatus(ref, proj, "success" if successful else "error", (timeStart, time.time() - timeStart),
		"Git stage failed" if not successfulGit else
		"Config error" if not successfulCfg else
		"Compile stage failed" if not successfulCompile else None, stats)

	symlink_force(ref, getBuildPath(proj, "latest"))


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
		if not data:
			if status == 404:
				data = "Not Found"
			elif status == 401:
				data = "Unauthorized"
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
		parsed = urlparse.urlparse(self.path)
		path = parsed.path
		query = urlparse.parse_qs(parsed.query)

		message = ""
		status = 404


		match = re.search(r"^\/([a-zA-z+-]+)(?:\/?$|\/(?:([0-9a-f]*|latest)\/)?(.*)?)", path)
		# matches: 1=Project | 2=hash or empty | 3=file or empty

		if match is not None:
			project, ref, fileName = match.group(1,2,3)
			ref = parseRef(project,ref)
			if os.path.isdir(project):
				cfg = getConfig(project)
				main = cfg.get('main') if cfg else None

				if main and fileName == "svg":
					self._sendFile(getBuildPath(project, ref)+"/.status.svg",
										[("Content-type", "image/svg+xml"),
											("etag", ref),
											("cache-control", "no-cache")])
					return

				if "Authorization" in self.headers or "token" in query:
					token = ""
					if "Authorization" in self.headers:
						token = self.headers['Authorization'][7:]
					elif "token" in query:
						token = query["token"][0]
					else:
						self._send(401)
						return
					try:
						data = jwt.decode(token, JWT_SECRET)
						if not data["user"] == "user":
							self._send(401)
							return
					except jwt.ExpiredSignatureError:
						self._send(401, "Expired")
						return
				else:
					self._send(401)
					return

				# list of all commits
				if not ref and not fileName:
					dirs = [entry for entry in os.listdir(project+OUTPUT_SUFFIX) if entry != "latest" and os.path.isdir(project+OUTPUT_SUFFIX+"/"+entry) ]

					data = []
					for ref in dirs:
						data.append({
							"commit": gh.getCommitDetails(project, ref),
							"build": getStatus(ref, project)
						})

					self._send(200, json.dumps({
							"list" : data,
							"language" : cfg.get("language", None),
							"latest": parseRef(project, "latest")
						}), [("Content-type", "application/json")])
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
		elif path == "/":
			if "Authorization" in self.headers or "token" in query:
				token = ""
				if "Authorization" in self.headers:
					token = self.headers['Authorization'][7:]
				elif "token" in query:
					token = query["token"][0]
				else:
					self._send(401)
					return
				try:
					data = jwt.decode(token, JWT_SECRET)
					if not data["user"] == "user":
						self._send(401)
						return
				except jwt.ExpiredSignatureError:
					self._send(401, "Expired")
					return
			else:
				self._send(401)
				return

			self._send(200, PROJECTS)
			return

		self._send(status, message)

	def do_POST(self):
		content_length = int(self.headers['Content-Length'])
		post_data = self.rfile.read(content_length)

		if urlparse.urlparse(self.path).path == "/login":
			data = json.loads(post_data)
			username, password = data["username"], data["password"]
			if username == "user" and password == PASSWORD:
				jwt_payload = jwt.encode({
					"user": username,
				    "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=30)
				}, JWT_SECRET)

				self._send(200, jwt_payload)
			else:
				self._send(401)
		else:
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
		server = HTTPServer(('localhost', 8000), Handler)
		print "Started server"
		server.serve_forever()
	except KeyboardInterrupt:
		print '\n^C received, shutting down the server'
		server.socket.close()
