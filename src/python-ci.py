#!/usr/bin/env python
from functools import wraps
from flask import Flask, request, send_file, make_response
import jwt, datetime, hmac, hashlib, os, json
from werkzeug.routing import BaseConverter, ValidationError

import compile, gh
from utils import getBuildPath, getProjPath, parseRef, getConfig

SECRET = os.environ.get('SECRET', "")
PASSWORD = os.environ.get('PASSWORD', "")
JWT_SECRET = os.environ.get('JWT_SECRET', "secret")
PROJECTS = "[]" if os.environ.get('PROJECTS', None) is None else "["+",".join(['"'+x+'"' for x in os.environ.get('PROJECTS').split(",")])+"]"


class StringConverter(BaseConverter):
	def __init__(self, url_map, exc="."):
		super(StringConverter, self).__init__(url_map)
		self.exc = list(exc)

	def to_python(self, value):
		if any(x not in value for x in self.exc):
			return value
		raise ValidationError()

	def to_url(self, value):
		return value and 'yes' or 'no'


app = Flask(__name__, static_url_path='')
app.url_map.converters['str'] = StringConverter

#
# UTILS
#

def check_auth(func):
	@wraps(func)
	def wrapper(*args, **kwargs):
		if "Authorization" in request.headers or "token" in request.args:
			token = ""
			if "Authorization" in request.headers:
				token = request.headers['Authorization'][7:]
			elif "token" in request.args:
				token = request.args["token"]
			else:
				return "Unauthorized", 401
			try:
				data = jwt.decode(token, JWT_SECRET)
				if data["user"] != "user":
					return "Forbidden", 403
			except jwt.ExpiredSignatureError:
				return "Expired token", 401
			except jwt.DecodeError as e:
				print(e)
				return "Invalid token", 403
		else:
			return "Unauthorized", 401

		return func(*args, **kwargs)

	return wrapper

def error_handler(func):
	@wraps(func)
	def wrapper(*args, **kwargs):
		try:
			return func(*args, **kwargs)
		except IOError:
			return "Not found", 404
		except Exception as e:
			print(e)
			return "Server error", 500

	return wrapper

def nocache(view):
	@wraps(view)
	def no_cache(*args, **kwargs):
		response = make_response(view(*args, **kwargs))
		# response.headers['Last-Modified'] = datetime.now()
		response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
		response.headers['Pragma'] = 'no-cache'
		response.headers['Expires'] = '-1'
		return response

	return no_cache


#
# GENERAL
#

@app.route('/login', methods=["POST"])
def login():
	json_d = request.get_json()
	username = json_d["username"]
	password = json_d["password"]
	if username == "user" and password == PASSWORD:
		jwt_payload = jwt.encode({
			"user": username,
			"exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=30)
		}, JWT_SECRET)
		return jwt_payload

	return "", 401

@app.route('/')
@check_auth
def list_projects():
	return PROJECTS, 200, {'Content-Type': 'application/json'}

@app.route('/<str:proj>/', strict_slashes=True)
@check_auth
def get_builds(proj):
	if not os.path.isfile(getProjPath(proj)+"/.ci.json"):
		return "Not found", 404

	if os.path.exists(getBuildPath(proj)):
		dirs = [entry for entry in os.listdir(getBuildPath(proj)) 
						if entry != "latest" and os.path.isdir(getBuildPath(proj, entry)) ]

		data = []
		for ref in dirs:
			data.append({
				"commit": gh.getCommitDetails(proj, ref),
				"build": compile.getStatus(proj, ref)
			})

		return json.dumps({
				"list" : data,
				"language" : getConfig(proj).get("language", None),
				"latest": parseRef(proj, "latest")
			}), {"Content-Type": "application/json"}
	else:
		return json.dumps({
				"list" : [],
				"language" : getConfig(proj).get("language", None),
				"latest": ""
			}), {"Content-Type": "application/json"}


@app.route('/<proj>/<ref>/status')
@check_auth
@nocache
def get_build_details(proj, ref):
	return send_file(compile.getStatus(proj, parseRef(proj, ref), True), mimetype="application/json")

@app.route('/<proj>/<ref>/diff/<ref2>')
@check_auth
@nocache
def get_diff(proj, ref, ref2):
	return json.dumps(
		{
			"diff": gh.getRepo(proj).compare(ref2, ref).html_url,
			"commits": [gh.getCommitDetails(x) for x in gh.getCommitDiff(proj, ref2, ref)]
		}
		), {"Content-Type": "application/json"}



def artifacts(proj, ref):
	config = getConfig(proj)
	lang = config.get("language", None)
	if lang == "latex":
		data = {}
		main = config.get("main", None)
		if os.path.isfile(getBuildPath(proj,ref)+"/"+main+".pdf"):
			data["pdf"] = "PDF"
		
		return data if data else None
	elif lang == "npm":
		data = {}
		if os.path.isfile(getBuildPath(proj,ref)+"/output.zip"):
			data["output.zip"] = "Output"
		
		return data if data else None

#
# FILES
#

@app.route('/<proj>/<ref>/artifacts')
@check_auth
@nocache
@error_handler
def get_artifacts(proj, ref):
	return json.dumps(artifacts(proj, ref)), {"Content-Type": "application/json"}


@app.route('/<proj>/<ref>/log')
@check_auth
@nocache
@error_handler
def get_build_log(proj, ref):
	return send_file(getBuildPath(proj, parseRef(proj,ref))+"/.log", mimetype="text/plain", add_etags=False)

@app.route('/<proj>/<ref>/svg')
@check_auth
@nocache
@error_handler
def get_build_svg(proj, ref):
	return send_file(getBuildPath(proj, parseRef(proj,ref))+"/.status.svg", mimetype="image/svg+xml", add_etags=False)

@app.route('/<proj>/<ref>/pdf')
@check_auth
@nocache
@error_handler
def get_build_pdf(proj, ref):
	response = make_response(send_file(getBuildPath(proj, parseRef(proj,ref))+"/main.pdf", mimetype="application/pdf", add_etags=False))
	response.headers['content-disposition'] = 'inline; filename='+proj+'.pdf'
	return response

@app.route('/<proj>/<ref>/output.zip')
@check_auth
@nocache
@error_handler
def get_build_zip(proj, ref):
	return send_file(getBuildPath(proj, parseRef(proj,ref))+"/output.zip", mimetype="application/zip", add_etags=False)


@app.route('/<proj>/latest/svg')
@nocache
@error_handler
def get_latest_svg(proj):
	return send_file(getBuildPath(proj, parseRef(proj,"latest"))+"/.status.svg", mimetype="image/svg+xml", add_etags=False)


#
# BUILDS
#

@app.route('/<proj>/<ref>/build')
@check_auth
@error_handler
def start_build(proj,ref):
	return compile.startCompile(proj, ref)


@app.route('/<proj>', methods=["POST"])
@error_handler
def github_build(proj):

	if SECRET and SECRET != "<<Github Webhook secret>>":
		(signature_func, signature) = request.headers['X-Hub-Signature'].split("=")
		if signature_func == "sha1":
			mac = hmac.new(str(SECRET), msg=request.data, digestmod=hashlib.sha1)
			if not hmac.compare_digest(str(mac.hexdigest()), str(signature)):
				return "Forbidden", 403

	if request.headers["X-GitHub-Event"] == "push" and request.headers["content-type"] == "application/json":
		data = request.get_json()
		print(data['head_commit']['id']+": "+data['head_commit']['message'])
		return  compile.startCompile(proj, data['head_commit']['id'])

	return "Not found", 404