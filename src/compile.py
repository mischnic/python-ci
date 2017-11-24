import time, os, json, shutil
from threading import Thread
import latex, git
from flask_sse import Channel
from utils import symlink_force, getBuildPath, getProjPath, getConfig, loadJSON, runSubprocess
from typing import Tuple, Callable, Union, Dict, Any; assert Dict, Any

TOKEN = os.environ.get('TOKEN', "")
DOMAIN = os.environ.get('URL', "")

compileThread = None

#
# STATUS
#

def updateStatus(proj: str, ref: str, channel: Channel, msg: str, start_duration: Tuple[float, float],
					errorMsg: str = None, stats: dict = {}) -> None:
	(start, duration) = start_duration
	if msg == "success":
		color = "#4c1"
	elif msg == "pending":
		color = "#efc60f"
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

	artifacts = {}
	if msg == "success":
		config = getConfig(proj, ref)
		lang = config.get("language", None)
		if lang == "latex":
			main = config.get("main", None)
			if os.path.isfile(getBuildPath(proj,ref)+"/"+main+".pdf"):
				artifacts["pdf"] = "PDF"
		elif lang == "npm":
			if os.path.isfile(getBuildPath(proj,ref)+"/output.zip"):
				artifacts["output.zip"] = "ZIP"

	data = {
		"ref": ref,
		"status": msg,
		"errorMsg": errorMsg,
		"start": round(start*1000),
		"duration": duration,
		"stats": stats,
		"artifacts": artifacts
	}

	channel.publish(proj, {"event": "status", "data": data})

	with open(getBuildPath(proj, ref)+"/.status.json", "w") as f:
		f.write(json.dumps(data))

	if TOKEN:
		git.setStatus(proj, ref, msg, DOMAIN+"/"+proj+"/"+ref, errorMsg)


#
# COMPILE
#

def getStatus(proj: str, ref: str, raw: bool=False) -> Union[dict, str]:
	if raw:
		return getBuildPath(proj, ref)+"/.status.json"

	return loadJSON(getBuildPath(proj, ref)+"/.status.json")


def updateGit(proj: str, ref: str, log: Callable[[str], None]):
	successful = True
	try:
		log(">>> git fetch --all\n")
		rv = runSubprocess(["git", "fetch", "--all"], log, cwd=getProjPath(proj))
		if rv != 0:
			raise Exception(rv)

		log(">>> git reset --hard "+ref+"\n")
		rv = runSubprocess(["git", "reset", "--hard", ref], log, cwd=getProjPath(proj))
		if rv != 0:
			raise Exception(rv)

		log(">>> git diff --stat "+ref+"~1 "+ref+"\n")
		rv = runSubprocess(["git", "diff", "--stat=100", ref+"~1", ref], log, cwd=getProjPath(proj))
		if rv != 0:
			raise Exception(rv)

	except Exception as e:
		successful = False
		log("git operations failed: "+str(e) + "\n")

	return successful

def npm(proj: str, buildPath: str, cfg: dict, log: Callable[[str], None]) -> bool:
	successful = True

	root = cfg.get("root", "")
	output = cfg.get("output", "")
	env = cfg.get("env", {})
	cwd = getProjPath(proj)+"/"+root

	if output:
		try:
			log(">>> yarn install\n")
			rv = runSubprocess(["yarn", "install"], log, cwd=cwd, env=env)
			if rv != 0:
				raise Exception(rv)

			log(">>> yarn build\n")
			rv = runSubprocess(["yarn", "build"], log, cwd=cwd, env=env)
			if rv != 0:
				raise Exception(rv)

			log(">>> creating output archive...\n")
			shutil.make_archive(buildPath+"/output", "zip", root_dir=cwd, base_dir="./"+output)

		except Exception as e:
			successful = False
			log("yarn failed: "+str(e) + "\n")
	else:
		successful = False
		log("Missing 'output' in config")

	return successful

compileLang = dict(
	latex = latex.doCompile,
	git = lambda a,b,c,d: True,
	npm = npm
) #type: Dict[str, Callable[[str, str, dict, Callable[[str], None]], bool]]

def doCompile(proj: str, ref: str, channel: Channel) -> None:
	if not os.path.exists(getBuildPath(proj, ref)):
			os.makedirs(getBuildPath(proj, ref))

	with open(getBuildPath(proj, ref)+"/.log", 'w', 1) as logFile:

		def log(s):
			logFile.write(s)
			channel.publish(proj, {"event": "log", "data": s})

		timeStart = time.time()

		updateStatus(proj, ref, channel, "pending", (timeStart, None))
		print(">> Started: "+time.strftime("%c"))
		log(">> Started: "+time.strftime("%c") + "\n")

		successful = True

		successfulGit = updateGit(proj, ref, log)
		successful = successfulGit

		shutil.copy2(getProjPath(proj)+"/.ci.json", getBuildPath(proj, ref)+"/.ci.json");

		cfg = getConfig(proj, ref)
		if successful:
			successfulCfg = True
			lang = cfg.get("language", None)

			if not lang:
				successfulCfg = False
				successful = successfulCfg

			if successful:
				if not os.path.exists(getBuildPath(proj)):
					log("creating "+getBuildPath(proj))
					os.makedirs(getBuildPath(proj))
				successfulCompile = compileLang[lang](proj, getBuildPath(proj, ref), cfg, log)
				successful = successfulCompile
			else:
				log("not compiling" + "\n")

		stats = {} #type: Dict[str, Union[str, Any]]
		if successful:
			if "stats" in cfg:
				if cfg["language"] == "latex" and "counts" in cfg["stats"]:
					(success, counts) = latex.count(getProjPath(proj), getBuildPath(proj, ref), cfg["main"]+".tex")
					if success:
						stats["counts"] = counts
					else:
						stats["counts"] = False

		print(">> Finished "+ref)
		log((">>" if successful else ">!")+" Finished: "+time.strftime("%X")+" "+ref + "\n")

	updateStatus(proj, ref, channel, "success" if successful else "error", (timeStart, time.time() - timeStart),
		"Git stage failed" if not successfulGit else
		"Config error" if not successfulCfg else
		"Compile stage failed" if not successfulCompile else None, stats)

	symlink_force(ref, getBuildPath(proj, "latest"))


def startCompile(proj: str, ref: str, channel: Channel) -> Tuple[str, int]:
	global compileThread
	if compileThread and compileThread.isAlive():
		return "Currently compiling", 503
	else:
		compileThread =	Thread(target=doCompile, args=(proj, ref, channel))
		compileThread.start()
		return "Compiling Started", 200
