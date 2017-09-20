#!/usr/bin/env python
from functools import wraps
from flask import Flask, request, send_file
import jwt, datetime, hmac, hashlib, os

import compile
from utils import getBuildPath, parseRef


SECRET = os.environ.get('SECRET', "")
PASSWORD = os.environ.get('PASSWORD', "")
JWT_SECRET = os.environ.get('JWT_SECRET', "secret")
PROJECTS = "[]" if os.environ.get('PROJECTS', None) is None else "["+",".join(['"'+x+'"' for x in os.environ.get('PROJECTS').split(",")])+"]"

app = Flask(__name__, static_url_path='')

#
# UTILS
#

def check_auth(func):
	@wraps(func)
	def wrapper(*args, **kwargs):
		# if "Authorization" in request.headers or "token" in request.args:
		# 	token = ""
		# 	if "Authorization" in request.headers:
		# 		token = request.headers['Authorization'][7:]
		# 	elif "token" in request.args:
		# 		token = request.args["token"]
		# 	else:
		# 		return "", 401
		# 	try:
		# 		data = jwt.decode(token, JWT_SECRET)
		# 		if data["user"] != "user":
		# 			return "", 401
		# 	except jwt.ExpiredSignatureError:
		# 		return "Expired token", 401
		# 	except jwt.DecodeError as e:
		# 		print e
		# 		return "Invalid token", 401
		# else:
		# 	return "", 401

		return func(*args, **kwargs)

	return wrapper

def error_handler(func):
	@wraps(func)
	def wrapper(*args, **kwargs):
		try:
			return func(*args, **kwargs)
		except IOError:
			return "Not found", 404
		except:
			return "Server error", 500

	return wrapper


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
	return PROJECTS, 200, {'Content-Type': 'text/css'}

@app.route('/<proj>/')
@check_auth
def get_builds(proj):
	return proj


@app.route('/<proj>/<ref>')
@check_auth
def get_build_details(proj,ref):
	return proj+"@"+ref


#
# FILES
#


@app.route('/<proj>/<ref>/log')
@check_auth
@error_handler
def get_build_log(proj,ref):
	return send_file(getBuildPath(proj, parseRef(proj,ref))+"/.log", mimetype="text/plain")

@app.route('/<proj>/<ref>/svg')
@check_auth
@error_handler
def get_build_svg(proj,ref):
	return send_file(getBuildPath(proj, parseRef(proj,ref))+"/.status.svg", mimetype="image/svg+xml")

@app.route('/<proj>/<ref>/pdf')
@check_auth
@error_handler
def get_build_pdf(proj,ref):
	return send_file(getBuildPath(proj, parseRef(proj,ref))+"/main.pdf", mimetype="application/pdf")

@app.route('/<proj>/latest/svg')
@error_handler
def get_latest_svg(proj):
	return get_build_svg(proj, "latest")


#
# BUILDS
#

@app.route('/<proj>/<ref>/build')
@check_auth
def start_build(proj,ref):
	return "start "+proj+"@"+ref+" build"


@app.route('/<proj>', methods=["POST"])
def github_build(project):
	(signature_func, signature) = request.headers['X-Hub-Signature'].split("=")
	output = "Error"
	status = 200

	if SECRET and SECRET != "<<Github Webhook secret>>":
		if signature_func == "sha1":
			mac = hmac.new(str(SECRET), msg=request.data, digestmod=hashlib.sha1)
			if not hmac.compare_digest(str(mac.hexdigest()), str(signature)):
				return output, 403

	if request.headers["X-GitHub-Event"] == "push" and request.headers["content-type"] == "application/json":
		data = request.get_json()
		print data['head_commit']['id']+": "+data['head_commit']['message']
		status, output = compile.startCompile(project, data['head_commit']['id'])

	return output, status
